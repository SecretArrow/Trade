import type { Candle } from '@trade/core';
import { alignTime, formatDate } from '@trade/core';

export interface SwingPoint {
  index: number;
  time: number;
  price: number;
  kind: 'high' | 'low';
}

/**
 * Fractal swing pivots: a high is a candle whose `left` predecessors and
 * `right` successors all have lower highs (lows are mirrored).
 */
export function swingPoints(candles: Candle[], left: number, right: number): SwingPoint[] {
  const out: SwingPoint[] = [];
  for (let i = left; i < candles.length - right; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - left; j <= i + right; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) {
      out.push({ index: i, time: candles[i].time, price: candles[i].high, kind: 'high' });
    }
    if (isLow) {
      out.push({ index: i, time: candles[i].time, price: candles[i].low, kind: 'low' });
    }
  }
  return out;
}

export type PivotMode = 'classic' | 'fibonacci' | 'camarilla';

export interface PivotLevels {
  time: number;
  p: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

function previousPeriodCandle(candles: Candle[], anchor: 'day' | 'week' | 'month'): Candle | null {
  if (candles.length === 0) return null;
  const tf = anchor === 'day' ? '1D' : anchor === 'week' ? '1W' : '1M';
  const lastBucket = alignTime(candles[candles.length - 1].time, tf);
  let open = NaN;
  let high = -Infinity;
  let low = Infinity;
  let close = NaN;
  let volume = 0;
  let found = false;
  for (const c of candles) {
    if (alignTime(c.time, tf) !== lastBucket) {
      // any candle before the current period
      open = Number.isNaN(open) ? c.open : open;
      high = Math.max(high, c.high);
      low = Math.min(low, c.low);
      close = c.close;
      volume += c.volume;
      found = true;
    }
  }
  if (!found) return null;
  return { time: lastBucket, open, high, low, close, volume };
}

export function pivotPoints(
  candles: Candle[],
  mode: PivotMode,
  anchor: 'day' | 'week' | 'month' = 'day',
): PivotLevels | null {
  const prev = previousPeriodCandle(candles, anchor);
  if (!prev) return null;
  const { high, low, close } = prev;
  const range = high - low;
  const p = (high + low + close) / 3;
  let levels: PivotLevels;
  if (mode === 'fibonacci') {
    levels = {
      time: prev.time,
      p,
      r1: p + 0.382 * range,
      r2: p + 0.618 * range,
      r3: p + range,
      s1: p - 0.382 * range,
      s2: p - 0.618 * range,
      s3: p - range,
    };
  } else if (mode === 'camarilla') {
    levels = {
      time: prev.time,
      p: close,
      r1: close + (range * 1.1) / 12,
      r2: close + (range * 1.1) / 6,
      r3: close + (range * 1.1) / 4,
      s1: close - (range * 1.1) / 12,
      s2: close - (range * 1.1) / 6,
      s3: close - (range * 1.1) / 4,
    };
  } else {
    levels = {
      time: prev.time,
      p,
      r1: 2 * p - low,
      r2: p + range,
      r3: high + 2 * (p - low),
      s1: 2 * p - high,
      s2: p - range,
      s3: low - 2 * (high - p),
    };
  }
  return levels;
}

/** Human label for the anchor period used in tooltips. */
export function pivotLabel(candles: Candle[], anchor: 'day' | 'week' | 'month'): string {
  if (candles.length === 0) return '';
  const tf = anchor === 'day' ? '1D' : anchor === 'week' ? '1W' : '1M';
  return formatDate(alignTime(candles[candles.length - 1].time, tf));
}
