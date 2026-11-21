import { expect, test } from '@playwright/test';

/** Mobile viewport coverage (Pixel 7 / iPhone 14 projects). */
test.describe('mobile layout', () => {
  test('shows the bottom navigation and opens the watchlist sheet', async ({ page }) => {
    await page.goto('/?src=demo');
    await expect(page.locator('canvas').first()).toBeVisible();
    const bottomNav = page.locator('.bottom-nav');
    await expect(bottomNav).toBeVisible();
    await page.getByRole('button', { name: 'Watchlist' }).click();
    // the sheet lists the available pairs
    await expect(page.locator('.sheet .watch-row')).toHaveCount(3);
    await page.locator('.sheet .watch-row', { hasText: 'XAU/USD' }).click();
    await expect(page.locator('.legend-symbol')).toHaveText('XAU/USD');
  });

  test('opens the tools sheet and selects a drawing tool', async ({ page }) => {
    await page.goto('/?src=demo');
    await page.getByRole('button', { name: 'Tools', exact: true }).click();
    await expect(page.locator('.sheet .left-toolbar')).toBeVisible();
    await page.locator('.sheet .tool-btn').first().click();
    await expect(page.locator('.mobile-tool-hint')).toBeVisible();
  });
});
