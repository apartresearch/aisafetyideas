import { test, expect } from '@playwright/test';
import { ROLES } from './auth';

test.describe('authed-but-unauthorized (403, not a /login redirect)', () => {
  test.use({ storageState: ROLES.funder.state });

  test('a member gets 403 on /console', async ({ page }) => {
    const resp = await page.goto('/console');
    expect(resp?.status()).toBe(403);
    await expect(page.getByText('Approved experts only')).toBeVisible();
  });
  test('a member gets 403 on /admin/experts', async ({ page }) => {
    const resp = await page.goto('/admin/experts');
    expect(resp?.status()).toBe(403);
    await expect(page.getByText('Admins only')).toBeVisible();
  });
  test('a member gets 403 on /admin/payouts', async ({ page }) => {
    const resp = await page.goto('/admin/payouts');
    expect(resp?.status()).toBe(403);
    await expect(page.getByText('Admins only')).toBeVisible();
  });
});

test("a second expert does not see another expert's answers in their review queue", async ({ browser }) => {
  const title = `E2E Iso ${crypto.randomUUID().slice(0, 8)}`;
  const answerTitle = `E2E IsoAns ${crypto.randomUUID().slice(0, 8)}`;

  const expert = await browser.newContext({ storageState: ROLES.expert.state });
  const ep = await expert.newPage();
  await ep.goto('/console');
  await ep.getByPlaceholder('Title').fill(title);
  await ep.getByRole('button', { name: 'Publish' }).click();
  await ep.waitForURL(/\/ideas\/[0-9a-f-]+$/);
  const ideaUrl = new URL(ep.url()).pathname;

  const submitter = await browser.newContext({ storageState: ROLES.submitter.state });
  const sp = await submitter.newPage();
  // submit an answer (same robust one-step set+submit pattern as loop.spec.ts: the answer form
  // binds inputs one-way and the auth re-render wipes a normal fill+click, so set the field
  // values and submit the form in ONE synchronous step — posts through the real default action).
  await sp.goto(ideaUrl + '/answer');
  await sp.waitForSelector('input[name=title]');
  await sp.evaluate((v) => {
    const form = [...document.querySelectorAll('form')].find(
      (f) => f.getAttribute('action') !== '/logout'
    ) as HTMLFormElement;
    (form.elements.namedItem('title') as HTMLInputElement).value = v.title;
    (form.elements.namedItem('explanation_md') as HTMLTextAreaElement).value = v.explanation;
    form.submit();
  }, { title: answerTitle, explanation: 'Isolation check answer.' });
  await sp.waitForURL(/\/ideas\/[0-9a-f-]+$/);
  await expect(sp.getByText(answerTitle)).toBeVisible();

  const expert2 = await browser.newContext({ storageState: ROLES.expert2.state });
  const e2p = await expert2.newPage();
  await e2p.goto('/console');
  await expect(e2p.getByText(answerTitle)).toHaveCount(0);   // not in expert2's queue (scoped to own ideas)

  await expert.close(); await submitter.close(); await expert2.close();
});
