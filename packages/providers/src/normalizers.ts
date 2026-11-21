import type { Candle } from '@trade/core';

/**
 * Normalize a raw candle list: drop malformed rows, sort ascending by open
 * time, and de-duplicate (later entries win). Guarantees the invariants the
 * chart engine and indicators rely on.
 */
export function normalizeCandles(raw: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of raw) {
    if (
      !Number.isFinite(c.time) ||
      c.time <= 0 ||
      !Number.isFinite(c.open) ||
      !Number.isFinite(c.high) ||
      !Number.isFinite(c.low) ||
      !Number.isFinite(c.close) ||
      !Number.isFinite(c.volume)
    ) {
      continue;
    }
    if (c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close)) {
      // inconsistent OHLC; skip rather than corrupt the series
      continue;
    }
    map.set(c.time, c);
  }
  return [...map.values()].sort((a, b) => a.time - b.time);
}

/**
 * Merge a newer batch into an existing series: updates shared candles,
 * appends new ones, never mixes older history back in.
 */
export function mergeCandles(existing: Candle[], incoming: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of existing) map.set(c.time, c);
  for (const c of incoming) map.set(c.time, c);
  return [...map.values()].sort((a, b) => a.time - b.time);
}

/**
 * Detect gaps in a candle series for the given timeframe (seconds per
 * candle). Returns the open times that are missing between the first and
 * last candle.
 */
export function detectGaps(candles: Candle[], tfSeconds: number): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const expected = candles[i - 1].time + tfSeconds;
    for (let t = expected; t < candles[i].time; t += tfSeconds) {
      gaps.push(t);
      if (gaps.length > 500) return gaps;
    }
  }
  return gaps;
}
