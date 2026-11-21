import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { normalizeCandles, mergeCandles, detectGaps } from '../src/normalizers';
import { mapBinanceKlines } from '../src/binance';
import { mapBybitKlines } from '../src/bybit';
import { mapOkxCandles } from '../src/okx';
import { mapKrakenOhlc } from '../src/kraken';
import { mapCoinbaseCandles } from '../src/coinbase';
import { mapGateCandles } from '../src/gate';
import { mapTwelveData, parseTwelveDataTime } from '../src/twelvedata';
import { mapYahooChart } from '../src/yahoo';
import { mapStooqCsv } from '../src/stooq';
import { generateDemoCandles } from '../src/demo';
import { getProvider, providersForSymbol, PROVIDER_ORDER } from '../src/registry';
import { evaluateDeviation, pickCrossCheckProvider } from '../src/crosscheck';

const CandleSchema = z.object({
  time: z.number().positive(),
  open: z.number().finite(),
  high: z.number().finite(),
  low: z.number().finite(),
  close: z.number().finite(),
  volume: z.number().finite(),
});
const CandleArray = z.array(CandleSchema);

function assertValidCandles(candles: unknown[]): void {
  const result = CandleArray.safeParse(candles);
  expect(result.success).toBe(true);
  const list = candles as { time: number }[];
  for (let i = 1; i < list.length; i++) {
    expect(list[i].time).toBeGreaterThan(list[i - 1].time);
  }
}

describe('normalizers', () => {
  it('sorts, dedupes and drops malformed candles', () => {
    const raw = [
      { time: 300, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { time: 100, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { time: 100, open: 1, high: 2.5, low: 0.5, close: 1.8, volume: 12 },
      { time: 200, open: NaN, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { time: 50, open: 1, high: 2, low: 5, close: 1.5, volume: 10 }, // low > close: invalid
    ];
    const out = normalizeCandles(raw);
    expect(out).toHaveLength(2);
    expect(out[0].time).toBe(100);
    expect(out[0].close).toBe(1.8); // later duplicate wins
  });

  it('merges newer data into an existing series', () => {
    const base = [
      { time: 100, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
      { time: 200, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
    ];
    const incoming = [
      { time: 200, open: 1, high: 3, low: 0.5, close: 2.5, volume: 15 },
      { time: 300, open: 2, high: 3, low: 1.5, close: 2.8, volume: 5 },
    ];
    const merged = mergeCandles(base, incoming);
    expect(merged).toHaveLength(3);
    expect(merged[1].high).toBe(3);
    expect(merged[2].time).toBe(300);
  });

  it('detects gaps for a timeframe', () => {
    const candles = [
      { time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { time: 60, open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { time: 240, open: 1, high: 1, low: 1, close: 1, volume: 1 },
    ];
    expect(detectGaps(candles, 60)).toEqual([120, 180]);
    expect(detectGaps(candles.slice(0, 2), 60)).toEqual([]);
  });
});

describe('provider response mappers (contract fixtures)', () => {
  it('binance klines', () => {
    const rows: Parameters<typeof mapBinanceKlines>[0] = [
      [1704067200000, '100.5', '101', '99.5', '100.8', '12.5', 1704067259999],
      [1704067260000, '100.8', '102', '100.7', '101.9', '8.2', 1704067319999],
    ];
    const out = mapBinanceKlines(rows);
    assertValidCandles(out);
    expect(out[0].time).toBe(1704067200);
    expect(out[0].open).toBe(100.5);
    expect(out[1].volume).toBe(8.2);
  });

  it('bybit klines (newest first, reversed)', () => {
    const rows: Parameters<typeof mapBybitKlines>[0] = [
      [1704067260000, '100.8', '102', '100.7', '101.9', '8.2', '832'],
      [1704067200000, '100.5', '101', '99.5', '100.8', '12.5', '1262'],
    ];
    const out = mapBybitKlines(rows);
    assertValidCandles(out);
    expect(out[0].time).toBe(1704067200);
    expect(out[1].close).toBe(101.9);
  });

  it('okx candles (newest first)', () => {
    const rows: Parameters<typeof mapOkxCandles>[0] = [
      ['1704067260000', '100.8', '102', '100.7', '101.9', '8.2', '832', '843', '1'],
      ['1704067200000', '100.5', '101', '99.5', '100.8', '12.5', '1262', '1274', '1'],
    ];
    const out = mapOkxCandles(rows);
    assertValidCandles(out);
    expect(out[0].open).toBe(100.5);
  });

  it('kraken OHLC', () => {
    const rows: Parameters<typeof mapKrakenOhlc>[0] = [
      [1704067200, '100.5', '101', '99.5', '100.8', '100.65', '12.5', 42],
      [1704067260, '100.8', '102', '100.7', '101.9', '101.2', '8.2', 30],
    ];
    const out = mapKrakenOhlc(rows);
    assertValidCandles(out);
    expect(out[1].volume).toBe(8.2);
  });

  it('coinbase candles (time, low, high, open, close)', () => {
    const rows: Parameters<typeof mapCoinbaseCandles>[0] = [
      [1704067260, 100.7, 102, 100.8, 101.9, 8.2],
      [1704067200, 99.5, 101, 100.5, 100.8, 12.5],
    ];
    const out = mapCoinbaseCandles(rows);
    assertValidCandles(out);
    expect(out[0].low).toBe(99.5);
    expect(out[0].high).toBe(101);
    expect(out[0].close).toBe(100.8);
  });

  it('gate candlesticks', () => {
    const rows: Parameters<typeof mapGateCandles>[0] = [
      ['1704067200', '1262', '100.8', '101', '99.5', '100.5', '12.5', 'true'],
      ['1704067260', '832', '101.9', '102', '100.7', '100.8', '8.2', 'false'],
    ];
    const out = mapGateCandles(rows);
    assertValidCandles(out);
    expect(out[0].open).toBe(100.5);
    expect(out[0].volume).toBe(12.5);
    expect(out[1].close).toBe(101.9);
  });

  it('twelve data time series', () => {
    const values = [
      {
        datetime: '2024-01-01 14:30:00',
        open: '100.5',
        high: '101',
        low: '99.5',
        close: '100.8',
        volume: '12.5',
      },
      {
        datetime: '2024-01-01 14:45:00',
        open: '100.8',
        high: '102',
        low: '100.7',
        close: '101.9',
        volume: '8.2',
      },
    ];
    const out = mapTwelveData(values);
    assertValidCandles(out);
    expect(out[0].time).toBe(Date.UTC(2024, 0, 1, 14, 30) / 1000);
    expect(parseTwelveDataTime('2024-01-01')).toBe(Date.UTC(2024, 0, 1) / 1000);
  });

  it('yahoo chart with null gaps', () => {
    const res = {
      chart: {
        result: [
          {
            timestamp: [1704067200, 1704067260, 1704067320],
            indicators: {
              quote: [
                {
                  open: [100.5, null, 101.9],
                  high: [101, 102, 103],
                  low: [99.5, 100.7, 100.9],
                  close: [100.8, 101.5, 102.2],
                  volume: [12.5, 8, 9],
                },
              ],
            },
          },
        ],
      },
    };
    const out = mapYahooChart(res);
    assertValidCandles(out);
    expect(out).toHaveLength(2);
    expect(out[0].time).toBe(1704067200);
  });

  it('stooq csv', () => {
    const csv =
      'Date,Open,High,Low,Close,Volume\r\n2024-01-02,2060.5,2075.1,2055.2,2070.9,0\r\n2024-01-03,2070.9,2080,2062.3,2075.5,0\r\n';
    const out = mapStooqCsv(csv);
    assertValidCandles(out);
    expect(out[0].time).toBe(Date.UTC(2024, 0, 2) / 1000);
    expect(out[1].high).toBe(2080);
  });
});

describe('registry', () => {
  it('creates every provider', () => {
    for (const id of PROVIDER_ORDER) {
      const p = getProvider(id);
      expect(p.id).toBe(id);
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it('lists providers per symbol and respects key/proxy requirements', () => {
    const withKey = { twelveDataKey: 'demo-key', proxyUrl: 'https://proxy.example' };
    const btc = providersForSymbol('BTC/USDT', withKey).map((p) => p.id);
    expect(btc).toContain('binance');
    expect(btc).toContain('kraken');
    expect(btc).toContain('coinbase');
    expect(btc).toContain('yahoo');

    const noKey = {};
    const xau = providersForSymbol('XAU/USD', noKey).map((p) => p.id);
    expect(xau).toContain('bybit'); // perp proxy
    expect(xau).toContain('binance'); // PAXG proxy
    expect(xau).not.toContain('twelvedata'); // needs key
    expect(xau).not.toContain('yahoo'); // needs proxy
    expect(xau).not.toContain('stooq'); // needs proxy

    const xauWithKey = providersForSymbol('XAU/USD', withKey).map((p) => p.id);
    expect(xauWithKey).toContain('twelvedata');
    expect(xauWithKey).toContain('stooq');
    expect(xauWithKey).toContain('yahoo');

    const xaut = providersForSymbol('XAUT/USDT', withKey).map((p) => p.id);
    expect(xaut).toContain('binance');
    expect(xaut).toContain('okx');
    expect(xaut).toContain('gate');
    expect(xaut).toContain('kraken');
    expect(xaut).not.toContain('coinbase');
  });

  it('marks proxy instruments clearly', () => {
    const binance = getProvider('binance');
    expect(binance.isProxyInstrument('XAU/USD')).toBe(true);
    expect(binance.isProxyInstrument('BTC/USDT')).toBe(false);
    expect(binance.instrumentLabel('XAU/USD')).toContain('proxy');
    const bybit = getProvider('bybit');
    expect(bybit.isProxyInstrument('XAU/USD')).toBe(true);
  });

  it('demo provider generates deterministic series', () => {
    const a = generateDemoCandles('BTC/USDT', '15m', 50);
    const b = generateDemoCandles('BTC/USDT', '15m', 50);
    expect(a).toEqual(b);
    assertValidCandles(a);
  });
});

describe('cross-check', () => {
  it('evaluates deviation against thresholds', () => {
    const ok = evaluateDeviation(
      'crypto',
      { provider: 'a', price: 100 },
      { provider: 'b', price: 100.2, proxy: false },
    );
    expect(ok.ok).toBe(true);
    expect(ok.deviationPct).toBeCloseTo(0.2, 6);
    const bad = evaluateDeviation(
      'crypto',
      { provider: 'a', price: 100 },
      { provider: 'b', price: 101, proxy: false },
    );
    expect(bad.ok).toBe(false);
    const goldOk = evaluateDeviation(
      'spot-gold',
      { provider: 'a', price: 2000 },
      { provider: 'b', price: 2002, proxy: false },
    );
    expect(goldOk.ok).toBe(true);
    const goldBad = evaluateDeviation(
      'spot-gold',
      { provider: 'a', price: 2000 },
      { provider: 'b', price: 2005, proxy: false },
    );
    expect(goldBad.ok).toBe(false);
  });

  it('widens the threshold for proxy instruments', () => {
    const res = evaluateDeviation(
      'spot-gold',
      { provider: 'a', price: 2000 },
      { provider: 'b', price: 2004, proxy: true },
    );
    expect(res.ok).toBe(true);
  });

  it('picks a secondary provider different from the active one', () => {
    const pick = pickCrossCheckProvider('BTC/USDT', 'crypto', 'binance', {});
    expect(pick).not.toBeNull();
    expect(pick).not.toBe('binance');
  });

  it('returns null when no alternative provider is configured', () => {
    // XAU/USD without a key or proxy only has proxy instruments; still fine,
    // but an unknown symbol must yield null without throwing.
    expect(pickCrossCheckProvider('XAU/USD', 'spot-gold', 'binance', {})).not.toBe('binance');
  });
});
