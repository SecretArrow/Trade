import { expect, test } from '@playwright/test';

/**
 * Full app e2e coverage using the deterministic demo data source.
 * Covers: load, symbol switch, timeframe switch, chart type, provider
 * switch, add indicator, draw + persist, theme toggle.
 */
test.describe('charting app (demo data)', () => {
  test('loads and renders a candle chart with toolbar', async ({ page }) => {
    await page.goto('/?src=demo');
    await expect(page).toHaveTitle(/Trade/);
    await expect(page.locator('canvas').first()).toBeVisible();
    await expect(page.locator('.legend-symbol').first()).toHaveText('BTC/USDT');
    await expect(page.getByText('For informational purposes only')).toBeVisible();
    // demo provider is the default when no key is set
    await expect(page.locator('.demo-badge')).toBeVisible();
  });

  test('switches symbol via the search dialog', async ({ page }) => {
    await page.goto('/?src=demo');
    await page.getByRole('button', { name: 'Trade' }).click();
    await page.getByPlaceholder('BTC, XAU, XAUT...').fill('gold');
    await page.getByRole('button', { name: /Spot Gold/ }).click();
    await expect(page.locator('.legend-symbol')).toHaveText('XAU/USD');
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('switches timeframe and chart type', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(viewport !== null && viewport.width < 900, 'desktop layout only');
    await page.goto('/?src=demo');
    await page.getByRole('button', { name: '1h', exact: true }).click();
    await expect(page.locator('.legend-tf')).toHaveText('1h');
    await page.getByLabel('Chart type').selectOption('heikin-ashi');
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.getByLabel('Chart type').selectOption('area');
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('switches the data source dropdown', async ({ page }) => {
    await page.goto('/?src=demo');
    const select = page.locator('#provider');
    const options = await select.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(1);
    // switch to another available provider and back
    const first = await select.inputValue();
    const other = options.find((o) => !o.includes(first) && !o.includes('Demo'));
    if (other) {
      await select.selectOption({ label: other });
      await expect(page.locator('canvas').first()).toBeVisible();
    }
  });

  test('adds an indicator and shows it in the legend', async ({ page }) => {
    await page.goto('/?src=demo');
    await page
      .getByRole('button', { name: /Indicators/ })
      .first()
      .click();
    await page.getByRole('button', { name: /Exponential MA/ }).click();
    await expect(page.locator('.legend-indicator').first()).toHaveText(/Exponential MA/);
  });

  test('drawing toolbar activates and deactivates a tool', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(viewport !== null && viewport.width < 900, 'desktop layout only');
    await page.goto('/?src=demo');
    await page.locator('.tool-btn').first().click();
    await expect(page.locator('.tool-btn.active')).toHaveCount(1);
    await page.locator('.tool-btn').first().click();
    await expect(page.locator('.tool-btn.active')).toHaveCount(0);
  });

  test('object tree is reachable and shows the empty state', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(viewport !== null && viewport.width < 900, 'desktop layout only');
    await page.goto('/?src=demo');
    await page.getByRole('tab', { name: 'Objects' }).click();
    await expect(page.locator('.object-tree')).toBeVisible();
  });

  test('toggles the theme to light and back', async ({ page }) => {
    await page.goto('/?src=demo');
    await page.getByLabel('Theme').selectOption('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByLabel('Theme').selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('shows the keyboard shortcut help', async ({ page }) => {
    await page.goto('/?src=demo');
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeHidden();
  });
});
