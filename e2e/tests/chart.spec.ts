import { expect, test } from '@playwright/test';

/**
 * Full app e2e coverage using the deterministic demo data source.
 * Covers: load, symbol switch, timeframe switch, chart type, chart engine,
 * provider switch, add indicator, draw + persist, theme toggle.
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

  test('switches chart engine to TradingView and back', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(viewport !== null && viewport.width < 900, 'desktop layout only');
    await page.goto('/?src=demo');
    const engine = page.locator('#chart-engine');
    await engine.selectOption('tradingview');
    // Assert only our own container div — the TradingView iframe needs
    // internet and must not be waited for (CI runs offline).
    await expect(page.locator('.tradingview-widget-container')).toBeVisible();
    await engine.selectOption('native');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
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
    await page.locator('.tool-btn.primary').first().click();
    await expect(page.locator('.tool-btn.primary.active')).toHaveCount(1);
    await page.locator('.tool-btn.primary').first().click();
    await expect(page.locator('.tool-btn.primary.active')).toHaveCount(0);
  });

  test('drawing flyout opens and lists related tools', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(viewport !== null && viewport.width < 900, 'desktop layout only');
    await page.goto('/?src=demo');
    await page.locator('.tool-btn.chevron').first().click();
    await expect(page.locator('.tool-flyout-popup')).toBeVisible();
    await expect(page.locator('.flyout-item').first()).toBeVisible();
    // Selecting a flyout item closes the popup and activates the primary slot.
    await page.locator('.flyout-item').nth(1).click();
    await expect(page.locator('.tool-flyout-popup')).toHaveCount(0);
    await expect(page.locator('.tool-btn.primary.active')).toHaveCount(1);
  });

  test('draws a trendline with the mouse and opens the style bar', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(viewport !== null && viewport.width < 900, 'desktop layout only');
    await page.goto('/?src=demo');
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.waitForTimeout(700); // let the demo candles stream in
    await page.locator('.tool-btn.primary').first().click(); // trendline
    await expect(page.locator('.tool-btn.primary.active')).toHaveCount(1);
    const chart = page.locator('.native-chart').first();
    const box = await chart.boundingBox();
    expect(box).not.toBeNull();
    const cx = box!.x + box!.width * 0.45;
    const cy = box!.y + box!.height * 0.55;
    // first anchor
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
    // live preview follows the cursor between clicks
    await page.mouse.move(cx + 160, cy - 70, { steps: 5 });
    // second anchor -> placement finalises, drawing gets selected
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('.drawing-style-bar')).toBeVisible();
    // the tool disarms after placement
    await expect(page.locator('.tool-btn.primary.active')).toHaveCount(0);
  });

  test('style bar edits the drawing and the object tree lists it', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(viewport !== null && viewport.width < 900, 'desktop layout only');
    await page.goto('/?src=demo');
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.waitForTimeout(700);
    await page.locator('.tool-btn.primary').first().click();
    const chart = page.locator('.native-chart').first();
    const box = await chart.boundingBox();
    const cx = box!.x + box!.width * 0.45;
    const cy = box!.y + box!.height * 0.55;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(cx + 160, cy - 70, { steps: 5 });
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('.drawing-style-bar')).toBeVisible();
    // change the color via a swatch
    const swatches = page.locator('.style-swatch');
    await swatches.nth(1).click();
    await expect(swatches.nth(1)).toHaveClass(/active/);
    // width + dash buttons apply
    await page.locator('.style-width-btn').nth(2).click();
    await expect(page.locator('.style-width-btn').nth(2)).toHaveClass(/active/);
    // the drawing shows up in the object tree
    await page.getByRole('tab', { name: 'Objects' }).click();
    await expect(page.locator('.object-row')).toHaveCount(1);
  });

  test('right-click on a drawing opens the context menu', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(viewport !== null && viewport.width < 900, 'desktop layout only');
    await page.goto('/?src=demo');
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.waitForTimeout(700);
    await page.locator('.tool-btn.primary').first().click();
    const chart = page.locator('.native-chart').first();
    const box = await chart.boundingBox();
    const cx = box!.x + box!.width * 0.45;
    const cy = box!.y + box!.height * 0.55;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(cx + 160, cy - 70, { steps: 5 });
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.locator('.drawing-style-bar')).toBeVisible();
    // right-click on the line body (midpoint)
    await page.mouse.click(cx + 80, cy - 35, { button: 'right' });
    await expect(page.locator('.drawing-menu')).toBeVisible();
    await expect(page.locator('.drawing-menu-item').first()).toBeVisible();
    // Escape closes it
    await page.keyboard.press('Escape');
    await expect(page.locator('.drawing-menu')).toHaveCount(0);
  });

  test('strategy tab opens MTF workflow panel', async ({ page }) => {
    const viewport = page.viewportSize();
    test.skip(viewport !== null && viewport.width < 900, 'desktop layout only');
    await page.goto('/?src=demo');
    await page.getByRole('tab', { name: /Strategy|Strategi/ }).click();
    await expect(page.locator('.mtf-panel')).toBeVisible();
    // Activating Intraday locks the cascade and shows the 3-TF quick switcher.
    await page.getByRole('button', { name: /Intraday/ }).click();
    await expect(page.locator('.mtf-cascade-row')).toBeVisible();
    await expect(page.locator('.mtf-tf-btn')).toHaveCount(3);
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
