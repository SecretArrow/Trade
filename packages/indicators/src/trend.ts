import type { Candle } from '@trade/core';
import type { ChartMarker, PlotValues } from './types';
import { highestSeries, lowestSeries, rmaValues } from './util';
import { atrValues } from './bands';

export interface AdxResult {
  adx: PlotValues;
  plusDI: PlotValues;
  minusDI: PlotValues;
}

/** Average Directional Index with +DI / -DI. */
export function adx(candles: Candle[], adxPeriod: number, diPeriod: number): AdxResult {
  const n = candles.length;
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  for (let i = 1; i < n; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
  }
  const tr = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const pc = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
  });
  const atr = rmaValues(tr, diPeriod);
  const smPlus = rmaValues(plusDM, diPeriod);
  const smMinus = rmaValues(minusDM, diPeriod);
  const plusDI: PlotValues = new Array(n).fill(null);
  const minusDI: PlotValues = new Array(n).fill(null);
  const dx: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = atr[i];
    const p = smPlus[i];
    const m = smMinus[i];
    if (a === null || p === null || m === null || a === 0) continue;
    const pdi = (p / a) * 100;
    const mdi = (m / a) * 100;
    plusDI[i] = pdi;
    minusDI[i] = mdi;
    const sum = pdi + mdi;
    dx[i] = sum === 0 ? 0 : (Math.abs(pdi - mdi) / sum) * 100;
  }
  const firstIdx = plusDI.findIndex((x) => x !== null);
  const adxOut: PlotValues = new Array(n).fill(null);
  if (firstIdx >= 0) {
    const smoothed = rmaValues(dx.slice(firstIdx), adxPeriod);
    for (let i = 0; i < smoothed.length; i++) adxOut[firstIdx + i] = smoothed[i];
  }
  return { adx: adxOut, plusDI, minusDI };
}

export interface PsarResult {
  psar: PlotValues;
  markers: ChartMarker[];
}

/** Parabolic SAR with flip markers. */
export function psar(candles: Candle[], afStep: number, afMax: number): PsarResult {
  const n = candles.length;
  const out: PlotValues = new Array(n).fill(null);
  const markers: ChartMarker[] = [];
  if (n < 2) return { psar: out, markers };

  let up = candles[1].close >= candles[0].close;
  let af = afStep;
  let ep = up ? candles[0].high : candles[0].low;
  let sar = up ? candles[0].low : candles[0].high;

  for (let i = 1; i < n; i++) {
    const c = candles[i];
    sar = sar + af * (ep - sar);
    if (up) {
      sar = Math.min(sar, candles[i - 1].low, i >= 2 ? candles[i - 2].low : candles[i - 1].low);
      if (c.high > ep) {
        ep = c.high;
        af = Math.min(afMax, af + afStep);
      }
      if (c.low < sar) {
        // flip to downtrend
        markers.push({ time: c.time, position: 'aboveBar', color: '#ef5350', shape: 'arrowDown', text: 'SAR flip' });
        up = false;
        sar = ep;
        ep = c.low;
        af = afStep;
      }
    } else {
      sar = Math.max(sar, candles[i - 1].high, i >= 2 ? candles[i - 2].high : candles[i - 1].high);
      if (c.low < ep) {
        ep = c.low;
        af = Math.min(afMax, af + afStep);
      }
      if (c.high > sar) {
        markers.push({ time: c.time, position: 'belowBar', color: '#26a69a', shape: 'arrowUp', text: 'SAR flip' });
        up = true;
        sar = ep;
        ep = c.high;
        af = afStep;
      }
    }
    out[i] = sar;
  }
  return { psar: out, markers };
}

export interface SupertrendResult {
  supertrend: PlotValues;
  direction: (1 | -1 | null)[];
  markers: ChartMarker[];
}

/** Supertrend: trailing stop-and-reverse band. */
export function supertrend(candles: Candle[], atrPeriod: number, mult: number): SupertrendResult {
  const n = candles.length;
  const atr = atrValues(candles, atrPeriod);
  const st: PlotValues = new Array(n).fill(null);
  const dir: (1 | -1 | null)[] = new Array(n).fill(null);
  const markers: ChartMarker[] = [];
  let upper = 0;
  let lower = 0;
  let trend: 1 | -1 = 1;
  for (let i = 0; i < n; i++) {
    const a = atr[i];
    if (a === null) continue;
    const hl2 = (candles[i].high + candles[i].low) / 2;
    let basicUpper = hl2 + mult * a;
    let basicLower = hl2 - mult * a;
    if (i > 0 && atr[i - 1] !== null) {
      basicUpper = candles[i - 1].close > upper ? Math.max(basicUpper, upper) : basicUpper;
      basicLower = candles[i - 1].close < lower ? Math.min(basicLower, lower) : basicLower;
    }
    const prevClose = i > 0 ? candles[i - 1].close : candles[i].close;
    if (prevClose > upper) trend = 1;
    else if (prevClose < lower) trend = -1;
    if (i > 0 && dir[i - 1] !== null && dir[i - 1] !== trend) {
      markers.push({
        time: candles[i].time,
        position: trend === 1 ? 'belowBar' : 'aboveBar',
        color: trend === 1 ? '#26a69a' : '#ef5350',
        shape: trend === 1 ? 'arrowUp' : 'arrowDown',
        text: `ST ${trend === 1 ? 'up' : 'down'}`,
      });
    }
    upper = basicUpper;
    lower = basicLower;
    dir[i] = trend;
    st[i] = trend === 1 ? lower : upper;
  }
  return { supertrend: st, direction: dir, markers };
}

export interface IchimokuResult {
  tenkan: PlotValues;
  kijun: PlotValues;
  senkouA: PlotValues;
  senkouB: PlotValues;
  chikou: PlotValues;
  /** Forward extension count (displacement) for senkou plots. */
  displacement: number;
}

/** Ichimoku Cloud. Senkou plots must be drawn `displacement` bars ahead. */
export function ichimoku(
  candles: Candle[],
  conversion: number,
  base: number,
  spanB: number,
  displacement: number,
): IchimokuResult {
  const n = candles.length;
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const mid = (p: number): PlotValues => {
    const h = highestSeries(highs, p);
    const l = lowestSeries(lows, p);
    return h.map((x, i) => {
      const y = l[i];
      if (x === null || y === null) return null;
      return (x + y) / 2;
    });
  };
  const tenkan = mid(conversion);
  const kijun = mid(base);
  const senkouA = tenkan.map((t, i) => {
    const k = kijun[i];
    if (t === null || k === null) return null;
    return (t + k) / 2;
  });
  const senkouB = mid(spanB);
  const chikou: PlotValues = new Array(n).fill(null);
  for (let i = displacement; i < n; i++) {
    chikou[i - displacement] = candles[i].close;
  }
  return { tenkan, kijun, senkouA, senkouB, chikou, displacement };
}
