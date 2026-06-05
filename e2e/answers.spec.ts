import { test, expect } from '@playwright/test';

// NOTE: these assert the unauthenticated auth-gate redirect only (the submit loader redirects on !user BEFORE
// it looks up the idea, so the random UUID is irrelevant). The authenticated submit→verify→admin-gate happy
// path is proven by the pgTAP RLS/RPC suite (Task 3); a full authed browser E2E is deferred to Plan 5 polish.
test('submit-answer route requires auth (redirects to login)', async ({ page }) => {
  await page.goto('/ideas/00000000-0000-0000-0000-000000000000/answer');
  await expect(page).toHaveURL(/\/login/);
});

test('admin payouts requires auth (redirects to login)', async ({ page }) => {
  await page.goto('/admin/payouts');
  await expect(page).toHaveURL(/\/login/);
});
