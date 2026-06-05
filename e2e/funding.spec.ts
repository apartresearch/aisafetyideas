import { test, expect } from '@playwright/test';

// Auth-gate only (the authed funding flow is proven by pgTAP); a full browser flow is deferred to Plan 5.
test('dashboard requires auth (redirects to login)', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('ideas browse still renders', async ({ page }) => {
  await page.goto('/ideas');
  await expect(page.getByRole('heading', { name: 'Ideas' })).toBeVisible();
});
