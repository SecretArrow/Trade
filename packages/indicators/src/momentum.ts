import type { Candle } from '@trade/core';
import type { PlotValues, SourceKey } from './types';
import { highestSeries, lowestSeries, rmaValues, smaValues, sourceSeries } from './util';

/** Relative Strength Index (Wilder). */
export function rsi(candles: Candle[], period: number, source: SourceKey = 'close'): PlotValues {
  const values = sourceSeries(candles, source);
  const gains: number[] = [0];
  const losses: number[] = [0];
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    gains.push(Math.max(0, diff));
    losses.push(Math.max(0, -diff));
  }
  const avgGain = rmaValues(gains, period);
  const avgLoss = rmaValues(losses, period);
  return avgGain.map((g, i) => {
    const l = avgLoss[i];
    if (g === null || l === null) return null;
    if (l === 0) return 100;
    const rs = g / l;
    return 100 - 100 / (1 + rs);
  });
}

export interface StochResult {
  k: PlotValues;
  d: PlotValues;
}

export function stochastic(candles: Candle[], kPeriod: number, dPeriod: number, smooth: number): StochResult {
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);
  const hh = highestSeries(highs, kPeriod);
  const ll = lowestSeries(lows, kPeriod);
  const raw = closes.map((c, i) => {
    const h = hh[i];
    const l = ll[i];
    if (h === null || l === null) return null;
    if (h === l) return 50;
    return ((c - l) / (h - l)) * 100;
  });
  const k = smaValues(raw.map((x) => x ?? 0), smooth).map((x, i) => (raw[i] === null ? null : x));
  const d = smaValues(k.map((x) => x ?? 0), dPeriod).map((x, i) => (k[i] === null ? null : x));
  return { k, d };
}

export function stochRsi(
  candles: Candle[],
  rsiPeriod: number,
  stochPeriod: number,
  kPeriod: number,
  dPeriod: number,
): StochResult {
  const rsiVals = rsi(candles, rsiPeriod);
  const nums = rsiVals.map((x) => x ?? 50);
  const hh = highestSeries(nums, stochPeriod);
  const ll = lowestSeries(nums, stochPeriod);
  const raw = rsiVals.map((r, i) => {
    const h = hh[i];
    const l = ll[i];
    if (r === null || h === null || l === null) return null;
    if (h === l) return 50;
    return ((r - l) / (h - l)) * 100;
  });
  const k = smaValues(raw.map((x) => x ?? 0), kPeriod).map((x, i) => (raw[i] === null ? null : x));
  const d = smaValues(k.map((x) => x ?? 0), dPeriod).map((x, i) => (k[i] === null ? null : x));
  return { k, d };
}

export interface MacdResult {
  macd: PlotValues;
  signal: PlotValues;
  histogram: PlotValues;
}

export function macd(
  candles: Candle[],
  fast: number,
  slow: number,
  signal: number,
  source: SourceKey = 'close',
): MacdResult {
  const values = sourceSeries(candles, source);
  const fastEma = emaNums(values, fast);
  const slowEma = emaNums(values, slow);
  const macdLine = fastEma.map((f, i) => {
    const s = slowEma[i];
    if (f === null || s === null) return null;
    return f - s;
  });
  const macdNums = macdLine.map((x) => x ?? 0);
  const startIdx = macdLine.findIndex((x) => x !== null);
  const signalRaw = emaNums(macdNums.slice(startIdx), signal);
  const signalLine: PlotValues = new Array(values.length).fill(null);
  if (startIdx >= 0) {
    for (let i = 0; i < signalRaw.length; i++) signalLine[startIdx + i] = signalRaw[i];
  }
  const histogram = macdLine.map((m, i) => {
    const s = signalLine[i];
    if (m === null || s === null) return null;
    return m - s;
  });
  return { macd: macdLine, signal: signalLine, histogram };
}

function emaNums(values: number[], period: number): PlotValues {
  const out: PlotValues = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let e = sum / period;
  out[period - 1] = e;
  for (let i = period; i < values.length; i++) {
    e = values[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}

/** Commodity Channel Index. */
export function cci(candles: Candle[], period: number): PlotValues {
  const tp = candles.map((c) => (c.high + c.low + c.close) / 3);
  const ma = smaValues(tp, period);
  return ma.map((m, i) => {
    if (m === null) return null;
    let acc = 0;
    for (let j = i - period + 1; j <= i; j++) acc += Math.abs(tp[j] - m);
    const meanDev = acc / period;
    if (meanDev === 0) return 0;
    return (tp[i] - m) / (0.015 * meanDev);
  });
}

/** Williams %R. */
export function williamsR(candles: Candle[], period: number): PlotValues {
  const hh = highestSeries(candles.map((c) => c.high), period);
  const ll = lowestSeries(candles.map((c) => c.low), period);
  return closes(candles).map((c, i) => {
    const h = hh[i];
    const l = ll[i];
    if (h === null || l === null) return null;
    if (h === l) return -50;
    return ((h - c) / (h - l)) * -100;
  });
}

/** Rate of change in percent. */
export function roc(candles: Candle[], period: number, source: SourceKey = 'close'): PlotValues {
  const values = sourceSeries(candles, source);
  return values.map((v, i) => {
    if (i < period) return null;
    const prev = values[i - period];
    if (prev === 0) return null;
    return ((v - prev) / prev) * 100;
  });
}

/** Raw momentum (difference over `period` candles). */
export function momentum(candles: Candle[], period: number, source: SourceKey = 'close'): PlotValues {
  const values = sourceSeries(candles, source);
  return values.map((v, i) => (i < period ? null : v - values[i - period]));
}

/** Awesome Oscillator: SMA5 - SMA34 of median price. */
export function awesomeOscillator(candles: Candle[]): PlotValues {
  const median = candles.map((c) => (c.high + c.low) / 2);
  const fast = smaValues(median, 5);
  const slow = smaValues(median, 34);
  return fast.map((f, i) => {
    const s = slow[i];
    if (f === null || s === null) return null;
    return f - s;
  });
}

function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}
