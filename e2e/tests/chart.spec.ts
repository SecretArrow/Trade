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
    const { viewport } = page;
    test.skip(viewport && viewport.width < 900, 'desktop layout only');
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

  test('draws a trendline that persists after reload', async ({ page }) => {
    const { viewport } = page;
    test.skip(viewport && viewport.width < 900, 'desktop layout only');
    await page.goto('/?src=demo');
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.locator('.tool-btn').first().click(); // trendline tool
    const chart = page.locator('.chart-panel').first();
    const box = await chart.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThan(100);
    expect(box?.height).toBeGreaterThan(100);
    const b = box as { x: number; y: number; width: number; height: number };
    // Click directly on the chart panel at relative positions so Playwright
    // auto-waits and routes the pointer events through the container's
    // capturing pointerdown listener.
    await chart.click({ position: { x: b.width * 0.3, y: b.height * 0.4 } });
    await chart.click({ position: { x: b.width * 0.7, y: b.height * 0.6 } });
    // the tool resets itself after placement
    await expect(page.locator('.tool-btn.active')).toHaveCount(0);

    // Confirm the drawing was actually added before reloading.
    await page.getByRole('tab', { name: 'Objects' }).click();
    await expect(page.locator('.object-row')).toHaveCount(1);

    await page.reload();
    await expect(page.locator('canvas').first()).toBeVisible();
    // the persisted drawing shows up in the object tree
    await page.getByRole('tab', { name: 'Objects' }).click();
    await expect(page.locator('.object-row')).toHaveCount(1);
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
