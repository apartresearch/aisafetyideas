import { test, expect } from '@playwright/test';
import { ROLES } from './auth';

test('capture a draft, then publish it as an expert', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: ROLES.expert.state });
  const page = await ctx.newPage();

  await page.goto('/dashboard?tab=lab');

  // SvelteKit SSR delivers the shell immediately; Svelte 5 hydration (loading the JS
  // bundle + running it) happens asynchronously.  The DraftCapture input's onkeydown
  // handler is registered via Svelte 5's event-delegation mechanism, which stores the
  // handler on the element via a Symbol(events) property.  We wait until that symbol
  // is present — meaning Svelte has fully mounted and wired up the keydown handler —
  // before we start typing.
  await page.waitForFunction(() => {
    const input = document.querySelector('input[placeholder="New idea…"]');
    if (!input) return false;
    return Object.getOwnPropertySymbols(input).some(s => s.toString() === 'Symbol(events)');
  }, { timeout: 10_000 });

  // ── Capture a draft ──
  const title = `Lab Draft ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByPlaceholder('New idea…').pressSequentially(title);
  await page.getByPlaceholder('New idea…').press('Enter');

  // Optimistic row appears immediately
  await expect(page.getByText(title)).toBeVisible();

  // ── Expand the card by clicking its header ──
  await page.getByText(title).click();

  // Wait for the draft to reconcile (id transitions from tmp-* → real UUID, Publish button enables)
  const publishBtn = page.getByRole('button', { name: 'Publish' });
  await expect(publishBtn).toBeEnabled({ timeout: 10_000 });

  // ── Open the publish dialog ──
  await publishBtn.click();

  // Dialog is now open; fill in the required summary field
  await page.getByLabel('Summary').fill('A non-empty summary written during the e2e test.');

  // ── Submit ──
  await page.getByRole('button', { name: 'Publish idea' }).click();

  // Expert publishes straight to open → action redirects 303 to /ideas/<slug>
  await page.waitForURL(/\/ideas\/[a-z0-9-]+$/, { timeout: 15_000 });

  // The idea detail page shows the heading
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  await ctx.close();
});
