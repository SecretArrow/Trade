import { expect, test } from '@playwright/test';

test.describe('app shell', () => {
  test('loads and renders a chart', async ({ page }) => {
    await page.goto('/?src=demo');
    await expect(page).toHaveTitle(/Trade/);
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.getByText('For informational purposes only')).toBeVisible();
  });
});
