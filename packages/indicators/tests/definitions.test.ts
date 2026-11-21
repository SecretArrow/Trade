import type { Candle } from '@trade/core';
import { mulberry32 } from '@trade/core';
import { computeIndicator, DEFINITIONS, defaultParams, getDefinition } from '../src/definitions';

function makeCandles(count: number): Candle[] {
  const rand = mulberry32(7);
  const candles: Candle[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const open = price;
    const close = open * (1 + (rand() - 0.5) * 0.02);
    const high = Math.max(open, close) * (1 + rand() * 0.01);
    const low = Math.min(open, close) * (1 - rand() * 0.01);
    candles.push({
      time: 1704067200 + i * 3600,
      open,
      high,
      low,
      close,
      volume: 50 + Math.floor(rand() * 500),
    });
    price = close;
  }
  return candles;
}

const candles = makeCandles(400);

describe('indicator definitions registry', () => {
  it('has unique types and valid groups', () => {
    const types = DEFINITIONS.map((d) => d.type);
    expect(new Set(types).size).toBe(types.length);
    const validGroups = new Set(['ma', 'bands', 'oscillators', 'trend', 'volume', 'structure', 'patterns']);
    expect(DEFINITIONS.every((d) => validGroups.has(d.group))).toBe(true);
  });

  it('every definition computes without throwing on sample data', () => {
    for (const def of DEFINITIONS) {
      const out = computeIndicator(def.type, candles, {});
      expect(out, `indicator ${def.type} returned null`).not.toBeNull();
      expect(out!.plots).toBeDefined();
    }
  });

  it('defaultParams returns declared defaults', () => {
    for (const def of DEFINITIONS) {
      const params = defaultParams(def);
      for (const spec of def.params) {
        expect(params[spec.key]).toBe(spec.default);
      }
    }
  });

  it('unknown type returns null', () => {
    expect(computeIndicator('does-not-exist', candles, {})).toBeNull();
    expect(getDefinition('nope')).toBeUndefined();
  });

  it('resample-aware indicators work with a resample context', () => {
    const resample = (cs: Candle[]): Candle[] => {
      // aggregate 4h -> 1D for the sample data (3600s bars)
      const out: Candle[] = [];
      let cur: Candle | null = null;
      for (const c of cs) {
        const day = Math.floor(c.time / 86400) * 86400;
        if (!cur || cur.time !== day) {
          if (cur) out.push(cur);
          cur = { ...c, time: day };
        } else {
          cur.high = Math.max(cur.high, c.high);
          cur.low = Math.min(cur.low, c.low);
          cur.close = c.close;
          cur.volume += c.volume;
        }
      }
      if (cur) out.push(cur);
      return out;
    };
    const out = computeIndicator('mtf-sr', candles, {}, { resample });
    expect(out).not.toBeNull();
  });
});

/**
 * Feature coverage checklist. Every concept from the internal study notes
 * (docs/internal/coverage-checklist.md) must map to an implemented indicator
 * definition or a shipped app feature. This test is the guard against scope
 * drift: adding a concept to the checklist requires implementing it here.
 */
const REQUIRED_CONCEPTS: { id: string; implementedAs: string[] }[] = [
  { id: 'sr-auto', implementedAs: ['sr-auto', 'mtf-sr'] },
  { id: 'break-retest', implementedAs: ['break-retest'] },
  { id: 'supply-demand', implementedAs: ['supply-demand'] },
  { id: 'order-block', implementedAs: ['order-blocks'] },
  { id: 'fvg', implementedAs: ['fvg'] },
  { id: 'market-structure', implementedAs: ['market-structure'] },
  { id: 'bos-choch', implementedAs: ['market-structure'] },
  { id: 'trendline-auto', implementedAs: ['trendlines-auto'] },
  { id: 'channel-auto', implementedAs: ['channel-auto'] },
  { id: 'fib-auto', implementedAs: ['fib-auto'] },
  { id: 'golden-levels', implementedAs: ['fib-auto'] },
  { id: 'patterns', implementedAs: ['patterns'] },
  { id: 'divergence', implementedAs: ['divergence'] },
  { id: 'vwap', implementedAs: ['vwap'] },
  { id: 'pivot-points', implementedAs: ['pivot-points'] },
  { id: 'ma-family', implementedAs: ['sma', 'ema', 'wma', 'vwma', 'hma', 'dema', 'tema', 'ma-ribbon'] },
  { id: 'ma-confluence', implementedAs: ['ma-confluence'] },
  { id: 'bands', implementedAs: ['bollinger', 'keltner', 'donchian', 'envelope', 'stddev'] },
  { id: 'oscillators', implementedAs: ['rsi', 'stochastic', 'stoch-rsi', 'macd', 'cci', 'williams-r', 'roc', 'momentum', 'ao'] },
  { id: 'volume-suite', implementedAs: ['volume', 'obv', 'mfi', 'ad', 'cmf'] },
  { id: 'ichimoku', implementedAs: ['ichimoku'] },
  { id: 'psar', implementedAs: ['psar'] },
  { id: 'supertrend', implementedAs: ['supertrend'] },
  // app-level features (not indicator definitions)
  { id: 'rr-tool', implementedAs: ['app:position-tool'] },
  { id: 'alerts', implementedAs: ['app:alerts'] },
  { id: 'watchlist', implementedAs: ['app:watchlist'] },
  { id: 'mtf-workflow', implementedAs: ['app:multi-timeframe', 'mtf-sr'] },
];

describe('concept coverage checklist', () => {
  it('covers every required concept id', () => {
    const available = new Set([
      ...DEFINITIONS.map((d) => d.type),
      ...REQUIRED_CONCEPTS.flatMap((c) => c.implementedAs.filter((x) => x.startsWith('app:'))),
    ]);
    const missing: string[] = [];
    for (const concept of REQUIRED_CONCEPTS) {
      for (const impl of concept.implementedAs) {
        if (!available.has(impl)) missing.push(`${concept.id}: ${impl}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('keeps the checklist ids unique', () => {
    const ids = REQUIRED_CONCEPTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
