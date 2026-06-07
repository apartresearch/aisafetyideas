import { test, expect } from '@playwright/test';
import { ROLES } from './auth';

test('funder dashboard reflects a pledge and a followed expert', async ({ browser }) => {
  const title = `E2E Dash ${crypto.randomUUID().slice(0, 8)}`;

  const expert = await browser.newContext({ storageState: ROLES.expert.state });
  const ep = await expert.newPage();
  await ep.goto('/console');
  await ep.getByPlaceholder('Title').fill(title);
  await ep.getByRole('button', { name: 'Publish' }).click();
  await ep.waitForURL(/\/ideas\/[0-9a-f-]+$/);
  const ideaUrl = new URL(ep.url()).pathname;

  const funder = await browser.newContext({ storageState: ROLES.funder.state });
  const fp = await funder.newPage();
  await fp.goto(ideaUrl);
  await fp.getByLabel('Fund this idea ($)').fill('25');
  await fp.getByRole('button', { name: 'Pledge' }).click();
  await expect(fp.locator('aside').getByText(/\$25\.00/).first()).toBeVisible();

  await fp.goto('/dashboard?tab=discover');
  // Follow every not-yet-followed expert (exact: true so "Follow" doesn't substring-match the
  // "Following" button). This guarantees we follow the author of `title`, whoever they sort as.
  // The follow form is a native POST (no use:enhance), so each click reloads the discover tab.
  for (let guard = 0; guard < 20; guard++) {
    const follow = fp.getByRole('button', { name: 'Follow', exact: true }).first();
    if (!(await follow.count())) break;
    await follow.click();
    await fp.waitForLoadState();
  }
  await expect(fp.getByRole('button', { name: 'Following' }).first()).toBeVisible();

  // feed half: the followed expert's open idea appears (feed is no longer the empty state)
  await fp.goto('/dashboard');
  await expect(fp.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(fp.getByText('No new open bounties')).toHaveCount(0);
  await expect(fp.getByRole('link', { name: new RegExp(title) }).first()).toBeVisible();

  // my-funding half: section + this pledge's row (idea title + $25.00). Don't assert exact Total (accumulates).
  await expect(fp.getByText('My funding')).toBeVisible();
  await expect(fp.getByText(/Total committed/)).toBeVisible();
  await expect(fp.locator('li', { hasText: title }).filter({ hasText: '$25.00' }).first()).toBeVisible();

  await expert.close(); await funder.close();
});
