import { test, expect } from '@playwright/test';

test('ideas browse renders', async ({ page }) => {
  await page.goto('/ideas');
  await expect(page.getByRole('heading', { name: 'Ideas' })).toBeVisible();
});

test('console requires auth', async ({ page }) => {
  await page.goto('/console');
  await expect(page).toHaveURL(/\/login/);
});

test('admin experts requires auth', async ({ page }) => {
  await page.goto('/admin/experts');
  await expect(page).toHaveURL(/\/login/);
});
