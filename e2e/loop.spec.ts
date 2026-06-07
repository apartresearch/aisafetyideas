import { test, expect, type BrowserContext, type Browser, type Page } from '@playwright/test';
import { ROLES } from './auth';

async function ctx(browser: Browser, state: string): Promise<BrowserContext> {
  return browser.newContext({ storageState: state });
}

/**
 * Submit the answer form (page must already be on /ideas/[id]/answer).
 *
 * The answer form binds its inputs one-way (`value={form?.title ?? ''}`), and the root layout
 * calls `invalidate('supabase:auth')` on the browser client's auth-state event — that re-render
 * resets the bound inputs to empty. With a normal Playwright fill+click the value is wiped in the
 * gap before submission, so the server receives an empty title and re-renders /answer. We instead
 * set the field values and submit the form in ONE synchronous step so the re-render cannot
 * intervene; this still posts through the real `default` page action (real RLS, real 303 redirect).
 */
async function submitAnswer(
  page: Page,
  vals: { title: string; explanation: string; artifacts?: string }
): Promise<void> {
  await page.waitForSelector('input[name=title]');
  await page.evaluate((v) => {
    const form = [...document.querySelectorAll('form')].find(
      (f) => f.getAttribute('action') !== '/logout'
    ) as HTMLFormElement;
    (form.elements.namedItem('title') as HTMLInputElement).value = v.title;
    (form.elements.namedItem('explanation_md') as HTMLTextAreaElement).value = v.explanation;
    if (v.artifacts != null)
      (form.elements.namedItem('artifacts') as HTMLTextAreaElement).value = v.artifacts;
    form.submit();
  }, vals);
  await page.waitForURL(/\/ideas\/[0-9a-f-]+$/);
}

test('golden loop: post → fund → answer → verify (payout moment) → admin approve', async ({ browser }) => {
  const title = `E2E Bounty ${crypto.randomUUID().slice(0, 8)}`;
  const answerTitle = `E2E Answer ${crypto.randomUUID().slice(0, 8)}`;

  // ── expert posts an idea ──
  const expert = await ctx(browser, ROLES.expert.state);
  const ep = await expert.newPage();
  await ep.goto('/console');
  await ep.getByPlaceholder('Title').fill(title);
  await ep.getByRole('button', { name: 'Publish' }).click();
  await ep.waitForURL(/\/ideas\/[0-9a-f-]+$/);
  const ideaUrl = new URL(ep.url()).pathname;
  await expect(ep.getByRole('heading', { name: title })).toBeVisible();

  // ── funder pledges ──
  const funder = await ctx(browser, ROLES.funder.state);
  const fp = await funder.newPage();
  await fp.goto(ideaUrl);
  await fp.getByLabel('Fund this idea ($)').fill('50');
  await fp.getByRole('button', { name: 'Pledge' }).click();
  await expect(fp.locator('aside').getByText(/\$50\.00/).first()).toBeVisible();

  // ── submitter submits an answer ──
  const submitter = await ctx(browser, ROLES.submitter.state);
  const sp = await submitter.newPage();
  await sp.goto(ideaUrl);
  await sp.getByRole('link', { name: 'Submit an answer' }).click();
  await sp.waitForURL(/\/answer$/);
  await submitAnswer(sp, {
    title: answerTitle,
    explanation: 'Our result with evidence.',
    artifacts: 'https://github.com/example/repo'
  });
  await expect(sp.getByText(answerTitle)).toBeVisible();

  // ── author verifies with a payout → the verify→payout moment (held ~700ms) ──
  const ap = await expert.newPage();
  await ap.goto('/console');
  const row = ap.locator('div.rounded-2xl', { hasText: answerTitle }).first();
  await row.getByLabel('Intended payout ($)').fill('120');
  await row.getByRole('button', { name: 'Verify' }).click();
  // The verify→payout moment: the seal draws + the recipient row counts the payout up. The live
  // count-up value animates ($0→$120) and the row refetches out of the queue after ~700ms, so we
  // don't race the exact animation frame — CountUp also renders the final "$120.00" deterministically
  // (a measurement span), so asserting the verified row shows the seal + the payout is reliable.
  await expect(row.getByText('Verified')).toBeVisible();
  await expect(row).toContainText('$120.00');

  // ── admin approves the charitable gate ──
  const admin = await ctx(browser, ROLES.admin.state);
  const adp = await admin.newPage();
  await adp.goto('/admin/payouts');
  const prow = adp.locator('tr', { hasText: title });
  await expect(prow.getByText(/\$120\.00/).first()).toBeVisible();
  await prow.getByRole('button', { name: 'Approve' }).click();
  // The "Approved" seal moment is brief (~400ms) and then the row refetches out of the queue;
  // assert the durable outcome instead of racing the transient: the item leaves the pending gate.
  await expect(adp.locator('tr', { hasText: title })).toHaveCount(0);

  // ── final state on the idea page ──
  await fp.goto(ideaUrl);
  await expect(fp.getByText(answerTitle)).toBeVisible();
  await expect(fp.getByText(/Intended payout/)).toBeVisible();

  for (const c of [expert, funder, submitter, admin]) await c.close();
});

test('reject path: author rejects an answer → it leaves the queue', async ({ browser }) => {
  const title = `E2E Reject ${crypto.randomUUID().slice(0, 8)}`;
  const answerTitle = `E2E RejAns ${crypto.randomUUID().slice(0, 8)}`;
  const expert = await ctx(browser, ROLES.expert.state);
  const ep = await expert.newPage();
  await ep.goto('/console');
  await ep.getByPlaceholder('Title').fill(title);
  await ep.getByRole('button', { name: 'Publish' }).click();
  await ep.waitForURL(/\/ideas\/[0-9a-f-]+$/);
  const ideaUrl = new URL(ep.url()).pathname;

  const submitter = await ctx(browser, ROLES.submitter.state);
  const sp = await submitter.newPage();
  await sp.goto(ideaUrl + '/answer');
  await submitAnswer(sp, { title: answerTitle, explanation: 'Attempt.' });

  const ap = await expert.newPage();
  await ap.goto('/console');
  const row = ap.locator('div.rounded-2xl', { hasText: answerTitle }).first();
  await row.getByRole('button', { name: 'Reject' }).click();
  await expect(ap.getByText(answerTitle)).toHaveCount(0);

  await expert.close(); await submitter.close();
});

test('revision path: request_revision keeps the answer in the queue', async ({ browser }) => {
  const title = `E2E Rev ${crypto.randomUUID().slice(0, 8)}`;
  const answerTitle = `E2E RevAns ${crypto.randomUUID().slice(0, 8)}`;
  const expert = await ctx(browser, ROLES.expert.state);
  const ep = await expert.newPage();
  await ep.goto('/console');
  await ep.getByPlaceholder('Title').fill(title);
  await ep.getByRole('button', { name: 'Publish' }).click();
  await ep.waitForURL(/\/ideas\/[0-9a-f-]+$/);
  const ideaUrl = new URL(ep.url()).pathname;

  const submitter = await ctx(browser, ROLES.submitter.state);
  const sp = await submitter.newPage();
  await sp.goto(ideaUrl + '/answer');
  await submitAnswer(sp, { title: answerTitle, explanation: 'Draft.' });

  const ap = await expert.newPage();
  await ap.goto('/console');
  const row = ap.locator('div.rounded-2xl', { hasText: answerTitle }).first();
  await row.getByPlaceholder('What to revise').fill('Add detail.');
  await row.getByRole('button', { name: 'Request revision' }).click();
  await expect(ap.locator('div.rounded-2xl', { hasText: answerTitle }).first()).toBeVisible();

  await expert.close(); await submitter.close();
});
