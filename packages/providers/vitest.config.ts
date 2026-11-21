import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // Network adapter I/O (fetch/subscribe/WebSocket/reconnect) is covered
      // end-to-end by the e2e suite and the non-blocking live provider-smoke
      // job; the unit coverage gate applies to the deterministic pure logic
      // (normalizers, registry, cross-check, demo generator, mappers). Adapter
      // files are excluded from the gate so their untestable network glue
      // does not dilute the threshold.
      exclude: [
        'src/binance.ts',
        'src/bybit.ts',
        'src/okx.ts',
        'src/kraken.ts',
        'src/coinbase.ts',
        'src/gate.ts',
        'src/twelvedata.ts',
        'src/yahoo.ts',
        'src/stooq.ts',
        'src/net.ts',
        'src/ws.ts',
        'src/polling.ts',
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 80,
      },
      reporter: ['text', 'text-summary'],
    },
  },
});
