import type { Candle } from '@trade/core';
import type { PlotValues } from './types';
import { emaValues, smaValues, sourceSeries, wmaValues } from './util';
import type { SourceKey } from './types';

export function sma(candles: Candle[], period: number, source: SourceKey = 'close'): PlotValues {
  return smaValues(sourceSeries(candles, source), period);
}

export function ema(candles: Candle[], period: number, source: SourceKey = 'close'): PlotValues {
  return emaValues(sourceSeries(candles, source), period);
}

export function wma(candles: Candle[], period: number, source: SourceKey = 'close'): PlotValues {
  return wmaValues(sourceSeries(candles, source), period);
}

export function vwma(candles: Candle[], period: number): PlotValues {
  const pv: number[] = candles.map((c) => c.close * c.volume);
  const vol: number[] = candles.map((c) => c.volume);
  const a = smaValues(pv, period);
  const b = smaValues(vol, period);
  return a.map((x, i) => {
    const den = b[i];
    if (x === null || den === null || den === 0) return null;
    return x / den;
  });
}

/** Hull moving average. */
export function hma(candles: Candle[], period: number, source: SourceKey = 'close'): PlotValues {
  const values = sourceSeries(candles, source);
  const half = Math.max(1, Math.floor(period / 2));
  const sqrtP = Math.max(1, Math.round(Math.sqrt(period)));
  const w1 = wmaValues(values, half);
  const w2 = wmaValues(values, period);
  const diff = w1.map((x, i) => {
    const y = w2[i];
    if (x === null || y === null) return null;
    return 2 * x - y;
  });
  // wma of the diff, aligned to the diff series
  const out: PlotValues = new Array(values.length).fill(null);
  const nums: number[] = diff.map((x) => x ?? 0);
  const startIdx = diff.findIndex((x) => x !== null);
  if (startIdx === -1) return out;
  const sub = nums.slice(startIdx);
  const smoothed = wmaValues(sub, sqrtP);
  for (let i = 0; i < smoothed.length; i++) {
    out[startIdx + i] = smoothed[i];
  }
  return out;
}

export function dema(candles: Candle[], period: number, source: SourceKey = 'close'): PlotValues {
  const values = sourceSeries(candles, source);
  const e1 = emaValues(values, period);
  const e2 = emaValues(e1.map((x) => x ?? 0), period);
  return e1.map((x, i) => {
    const y = e2[i];
    if (x === null || y === null) return null;
    return 2 * x - y;
  });
}

export function tema(candles: Candle[], period: number, source: SourceKey = 'close'): PlotValues {
  const values = sourceSeries(candles, source);
  const e1 = emaValues(values, period);
  const e2 = emaValues(e1.map((x) => x ?? 0), period);
  const e3 = emaValues(e2.map((x) => x ?? 0), period);
  return e1.map((x, i) => {
    const y = e2[i];
    const z = e3[i];
    if (x === null || y === null || z === null) return null;
    return 3 * x - 3 * y + z;
  });
}

/** Moving average ribbon: `count` EMAs starting at `period` with `spacing` step. */
export function maRibbon(
  candles: Candle[],
  period: number,
  count: number,
  spacing: number,
): Record<string, PlotValues> {
  const plots: Record<string, PlotValues> = {};
  for (let i = 0; i < count; i++) {
    plots[`ma${i}`] = ema(candles, period + i * spacing);
  }
  return plots;
}

/** Envelope around a basis MA. */
export function envelope(
  candles: Candle[],
  period: number,
  kPercent: number,
  source: SourceKey = 'close',
): Record<string, PlotValues> {
  const basis = sma(candles, period, source);
  const k = kPercent / 100;
  return {
    basis,
    upper: basis.map((x) => (x === null ? null : x * (1 + k))),
    lower: basis.map((x) => (x === null ? null : x * (1 - k))),
  };
}
