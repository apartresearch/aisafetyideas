import { test, expect } from '@playwright/test';

test('unauthenticated user is redirected from /dashboard to /login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('login page renders both auth options', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByPlaceholder('you@email.com')).toBeVisible();
});
