import { test, expect } from '@playwright/test';

// Plan 5's new public surface. The authed comment/interest WRITE path is enforced at the RLS layer (proven by
// pgTAP) and type-checked end-to-end; a full authed browser flow is deferred to the ETL/launch hardening pass.
test('experts roster renders', async ({ page }) => {
  await page.goto('/experts');
  await expect(page.getByRole('heading', { name: 'Experts' })).toBeVisible();
});

test('experts roster is public (no login redirect)', async ({ page }) => {
  await page.goto('/experts');
  await expect(page).toHaveURL(/\/experts$/);
});
