import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      // Network/async glue (adapter fetch + WebSocket + reconnect, live demo
      // feed, cross-provider check runner, HTTP transport, polling) is
      // exercised end-to-end by the e2e suite and the non-blocking live
      // provider-smoke job. The unit coverage gate applies to the
      // deterministic pure logic: normalizers, the provider registry, and the
      // response mappers (covered by zod contract fixtures). Adapter and
      // transport files are excluded so their untestable network code does
      // not dilute the threshold.
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
        'src/demo.ts',
        'src/crosscheck.ts',
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
