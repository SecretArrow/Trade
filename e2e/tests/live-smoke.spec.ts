import { expect, test } from '@playwright/test';

/**
 * Tiny live-data smoke test. Hits a public exchange REST endpoint directly.
 * Runs in a dedicated non-blocking CI job; failures must never block deploys.
 */
test('public exchange REST API is alive and returns a price', async ({ request }) => {
  const res = await request.get('https://api.kraken.com/0/public/Ticker?pair=XBTUSDT', {
    timeout: 15_000,
  });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as {
    result?: Record<string, { c?: string[][] }>;
  };
  const first = Object.values(body.result ?? {})[0];
  const last = Number.parseFloat(first?.c?.[0]?.[0] ?? '0');
  expect(last).toBeGreaterThan(0);
});
