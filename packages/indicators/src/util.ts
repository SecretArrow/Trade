import type { Candle } from '@trade/core';
import type { PlotValues, SourceKey } from './types';

export function sourceSeries(candles: Candle[], source: SourceKey = 'close'): number[] {
  switch (source) {
    case 'open':
      return candles.map((c) => c.open);
    case 'high':
      return candles.map((c) => c.high);
    case 'low':
      return candles.map((c) => c.low);
    case 'close':
      return candles.map((c) => c.close);
    case 'volume':
      return candles.map((c) => c.volume);
    case 'hl2':
      return candles.map((c) => (c.high + c.low) / 2);
    case 'hlc3':
      return candles.map((c) => (c.high + c.low + c.close) / 3);
    case 'ohlc4':
      return candles.map((c) => (c.open + c.high + c.low + c.close) / 4);
  }
}

export function smaValues(values: number[], period: number): PlotValues {
  const out: PlotValues = new Array(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function emaValues(values: number[], period: number): PlotValues {
  const out: PlotValues = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let ema = sum / period;
  out[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    out[i] = ema;
  }
  return out;
}

/** Wilder's smoothing (RMA), used by RSI/ATR/ADX. */
export function rmaValues(values: number[], period: number): PlotValues {
  const out: PlotValues = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let rma = sum / period;
  out[period - 1] = rma;
  for (let i = period; i < values.length; i++) {
    rma = (rma * (period - 1) + values[i]) / period;
    out[i] = rma;
  }
  return out;
}

export function wmaValues(values: number[], period: number): PlotValues {
  const out: PlotValues = new Array(values.length).fill(null);
  if (period <= 0) return out;
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let acc = 0;
    for (let j = 0; j < period; j++) {
      acc += values[i - period + 1 + j] * (j + 1);
    }
    out[i] = acc / denom;
  }
  return out;
}

export function stdevSeries(values: number[], period: number): PlotValues {
  const out: PlotValues = new Array(values.length).fill(null);
  if (period <= 1) return out;
  for (let i = period - 1; i < values.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += values[j];
    const m = sum / period;
    let acc = 0;
    for (let j = i - period + 1; j <= i; j++) acc += (values[j] - m) ** 2;
    out[i] = Math.sqrt(acc / period);
  }
  return out;
}

export function highestSeries(values: number[], period: number): PlotValues {
  const out: PlotValues = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let h = values[i - period + 1];
    for (let j = i - period + 1; j <= i; j++) h = Math.max(h, values[j]);
    out[i] = h;
  }
  return out;
}

export function lowestSeries(values: number[], period: number): PlotValues {
  const out: PlotValues = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let l = values[i - period + 1];
    for (let j = i - period + 1; j <= i; j++) l = Math.min(l, values[j]);
    out[i] = l;
  }
  return out;
}

export function trueRanges(candles: Candle[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      out.push(c.high - c.low);
    } else {
      const prevClose = candles[i - 1].close;
      out.push(Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose)));
    }
  }
  return out;
}

export function isBull(c: Candle): boolean {
  return c.close >= c.open;
}

export function bodySize(c: Candle): number {
  return Math.abs(c.close - c.open);
}

export function bodyTop(c: Candle): number {
  return Math.max(c.open, c.close);
}

export function bodyBottom(c: Candle): number {
  return Math.min(c.open, c.close);
}

export function upperWick(c: Candle): number {
  return c.high - bodyTop(c);
}

export function lowerWick(c: Candle): number {
  return bodyBottom(c) - c.low;
}
