import type { Candle } from '@trade/core';
import { alignTime } from '@trade/core';
import type { PlotValues } from './types';
import { smaValues } from './util';

/** On-Balance Volume. */
export function obv(candles: Candle[]): PlotValues {
  const out: PlotValues = new Array(candles.length).fill(null);
  let acc = 0;
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      out[i] = 0;
      continue;
    }
    const c = candles[i];
    const prev = candles[i - 1];
    if (c.close > prev.close) acc += c.volume;
    else if (c.close < prev.close) acc -= c.volume;
    out[i] = acc;
  }
  return out;
}

/** Money Flow Index. */
export function mfi(candles: Candle[], period: number): PlotValues {
  const n = candles.length;
  const out: PlotValues = new Array(n).fill(null);
  const posFlow: number[] = [0];
  const negFlow: number[] = [0];
  for (let i = 1; i < n; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    const prevTp = (candles[i - 1].high + candles[i - 1].low + candles[i - 1].close) / 3;
    const flow = tp * candles[i].volume;
    posFlow.push(tp > prevTp ? flow : 0);
    negFlow.push(tp < prevTp ? flow : 0);
  }
  for (let i = period; i < n; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      pos += posFlow[j];
      neg += negFlow[j];
    }
    if (neg === 0) out[i] = 100;
    else out[i] = 100 - 100 / (1 + pos / neg);
  }
  return out;
}

/** Accumulation / Distribution line. */
export function accumulationDistribution(candles: Candle[]): PlotValues {
  const out: PlotValues = new Array(candles.length).fill(null);
  let acc = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const range = c.high - c.low;
    const mfm = range === 0 ? 0 : (c.close - c.low - (c.high - c.close)) / range;
    acc += mfm * c.volume;
    out[i] = acc;
  }
  return out;
}

/** Chaikin Money Flow. */
export function chaikinMoneyFlow(candles: Candle[], period: number): PlotValues {
  const n = candles.length;
  const out: PlotValues = new Array(n).fill(null);
  const mf: number[] = candles.map((c) => {
    const range = c.high - c.low;
    const mfm = range === 0 ? 0 : (c.close - c.low - (c.high - c.close)) / range;
    return mfm * c.volume;
  });
  const vol = candles.map((c) => c.volume);
  for (let i = period - 1; i < n; i++) {
    let sumMf = 0;
    let sumVol = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumMf += mf[j];
      sumVol += vol[j];
    }
    out[i] = sumVol === 0 ? 0 : sumMf / sumVol;
  }
  return out;
}

export type VwapAnchor = 'day' | 'week' | 'month';

/** Session-anchored VWAP (resets at the anchor boundary, UTC). */
export function vwap(candles: Candle[], anchor: VwapAnchor = 'day'): PlotValues {
  const out: PlotValues = new Array(candles.length).fill(null);
  const tf: '1D' | '1W' | '1M' = anchor === 'day' ? '1D' : anchor === 'week' ? '1W' : '1M';
  let currentBucket = -1;
  let cumPV = 0;
  let cumVol = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const bucket = alignTime(c.time, tf);
    if (bucket !== currentBucket) {
      currentBucket = bucket;
      cumPV = 0;
      cumVol = 0;
    }
    const tp = (c.high + c.low + c.close) / 3;
    cumPV += tp * c.volume;
    cumVol += c.volume;
    out[i] = cumVol === 0 ? c.close : cumPV / cumVol;
  }
  return out;
}

export interface VolumeResult {
  volume: PlotValues;
  volumeMa: PlotValues;
}

/** Volume histogram values plus a moving average. */
export function volumeWithMa(candles: Candle[], maPeriod: number): VolumeResult {
  const vol = candles.map((c) => c.volume);
  return { volume: vol, volumeMa: smaValues(vol, maPeriod) };
}
