import type { Candle } from '@trade/core';
import type { PlotValues, SourceKey } from './types';
import { ema } from './movingAverages';
import { highestSeries, lowestSeries, rmaValues, smaValues, sourceSeries, stdevSeries, trueRanges } from './util';

export interface BandResult {
  upper: PlotValues;
  middle: PlotValues;
  lower: PlotValues;
}

export function bollingerBands(
  candles: Candle[],
  period: number,
  stdDevMult: number,
  source: SourceKey = 'close',
): BandResult {
  const values = sourceSeries(candles, source);
  const middle = smaValues(values, period);
  const sd = stdevSeries(values, period);
  return {
    middle,
    upper: middle.map((m, i) => (m === null || sd[i] === null ? null : m + stdDevMult * (sd[i] as number))),
    lower: middle.map((m, i) => (m === null || sd[i] === null ? null : m - stdDevMult * (sd[i] as number))),
  };
}

export function keltnerChannel(
  candles: Candle[],
  emaPeriod: number,
  atrPeriod: number,
  atrMult: number,
): BandResult {
  const middle = ema(candles, emaPeriod);
  const atrVals = atrValues(candles, atrPeriod);
  return {
    middle,
    upper: middle.map((m, i) => (m === null || atrVals[i] === null ? null : m + atrMult * (atrVals[i] as number))),
    lower: middle.map((m, i) => (m === null || atrVals[i] === null ? null : m - atrMult * (atrVals[i] as number))),
  };
}

export function donchianChannel(candles: Candle[], period: number): BandResult {
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const upper = highestSeries(highs, period);
  const lower = lowestSeries(lows, period);
  const middle = upper.map((u, i) => {
    const l = lower[i];
    if (u === null || l === null) return null;
    return (u + l) / 2;
  });
  return { upper, middle, lower };
}

/** Average True Range (Wilder smoothing of true range). */
export function atrValues(candles: Candle[], period: number): PlotValues {
  return rmaValues(trueRanges(candles), period);
}

export function stdDevIndicator(
  candles: Candle[],
  period: number,
  source: SourceKey = 'close',
): PlotValues {
  return stdevSeries(sourceSeries(candles, source), period);
}
