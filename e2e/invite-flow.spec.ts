/**
 * Phase 5 — invite-flow e2e spec
 *
 * Scenario: a plain member (no expert status) visits /invite/e2e-invite-token.
 * On success they are redirected to /onboarding/expert, proving they were made an
 * approved expert by the redeem_expert_invite RPC.
 *
 * Full flow also authors+publishes an idea and confirms it lands at /ideas/<slug>
 * (not archived), proving the gating trigger now treats them as an expert.
 */
import { test, expect } from '@playwright/test';
import { ROLES } from './auth';

test('member redeems invite → expert onboarding → can publish open idea', async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: ROLES.member.state });
  const page = await ctx.newPage();

  // ── Step 1: visit the invite link ──
  await page.goto('/invite/e2e-invite-token');

  // On success the server redirects 303 → /onboarding/expert (SSR; no JS needed).
  await page.waitForURL(/\/onboarding\/expert/, { timeout: 10_000 });

  // Onboarding page should be visible
  await expect(page.getByRole('heading', { name: /Welcome to the expert roster/i })).toBeVisible();

  // ── Step 2: go to the console and publish an idea to confirm expert gating ──
  await page.goto('/dashboard?tab=lab');

  // Wait for Svelte hydration (same pattern as lab.spec.ts)
  await page.waitForFunction(() => {
    const input = document.querySelector('input[placeholder="New idea…"]');
    if (!input) return false;
    return Object.getOwnPropertySymbols(input).some(s => s.toString() === 'Symbol(events)');
  }, { timeout: 10_000 });

  const title = `Invite E2E ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByPlaceholder('New idea…').pressSequentially(title);
  await page.getByPlaceholder('New idea…').press('Enter');

  // Optimistic row appears
  await expect(page.getByText(title)).toBeVisible();

  // Expand the card
  await page.getByText(title).click();

  const publishBtn = page.getByRole('button', { name: 'Publish' });
  await expect(publishBtn).toBeEnabled({ timeout: 10_000 });

  await publishBtn.click();

  // Fill summary in the publish dialog
  await page.getByLabel('Summary').fill('A non-empty summary from the invite flow e2e test.');
  await page.getByRole('button', { name: 'Publish idea' }).click();

  // Expert publishes straight to open → redirects to /ideas/<slug>
  await page.waitForURL(/\/ideas\/[a-z0-9-]+$/, { timeout: 15_000 });

  // Idea is publicly visible (not archived)
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  await ctx.close();
});
