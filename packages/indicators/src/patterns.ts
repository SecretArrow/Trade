import type { Candle } from '@trade/core';
import type { ChartMarker } from './types';
import { bodySize, isBull, lowerWick, upperWick } from './util';

export type PatternKey =
  | 'bullish-engulfing'
  | 'bearish-engulfing'
  | 'hammer'
  | 'shooting-star'
  | 'doji'
  | 'morning-star'
  | 'evening-star'
  | 'inside-bar'
  | 'three-white-soldiers'
  | 'three-black-crows';

export const PATTERN_NAMES: Record<PatternKey, string> = {
  'bullish-engulfing': 'Bullish engulfing',
  'bearish-engulfing': 'Bearish engulfing',
  hammer: 'Hammer / pin bar',
  'shooting-star': 'Shooting star / pin bar',
  doji: 'Doji',
  'morning-star': 'Morning star',
  'evening-star': 'Evening star',
  'inside-bar': 'Inside bar',
  'three-white-soldiers': 'Three white soldiers',
  'three-black-crows': 'Three black crows',
};

function range(c: Candle): number {
  return c.high - c.low;
}

export function detectPatterns(candles: Candle[], enabled: Set<PatternKey>): ChartMarker[] {
  const out: ChartMarker[] = [];
  for (let i = 2; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const pp = candles[i - 2];

    if (
      enabled.has('bullish-engulfing') &&
      !isBull(p) &&
      isBull(c) &&
      c.close > p.open &&
      c.open < p.close
    ) {
      out.push(m(c, 'belowBar', '#26a69a', 'arrowUp', 'Engulf'));
    }
    if (
      enabled.has('bearish-engulfing') &&
      isBull(p) &&
      !isBull(c) &&
      c.close < p.open &&
      c.open > p.close
    ) {
      out.push(m(c, 'aboveBar', '#ef5350', 'arrowDown', 'Engulf'));
    }
    if (
      enabled.has('hammer') &&
      range(c) > 0 &&
      lowerWick(c) > range(c) * 0.55 &&
      upperWick(c) < range(c) * 0.2
    ) {
      out.push(m(c, 'belowBar', '#26a69a', 'arrowUp', 'Hammer'));
    }
    if (
      enabled.has('shooting-star') &&
      range(c) > 0 &&
      upperWick(c) > range(c) * 0.55 &&
      lowerWick(c) < range(c) * 0.2
    ) {
      out.push(m(c, 'aboveBar', '#ef5350', 'arrowDown', 'Star'));
    }
    if (enabled.has('doji') && range(c) > 0 && bodySize(c) <= range(c) * 0.1) {
      out.push(m(c, 'inBar', '#f0a92e', 'circle', 'Doji'));
    }
    if (
      enabled.has('morning-star') &&
      !isBull(pp) &&
      bodySize(p) < bodySize(pp) * 0.5 &&
      isBull(c) &&
      c.close > (pp.open + pp.close) / 2
    ) {
      out.push(m(c, 'belowBar', '#26a69a', 'arrowUp', 'M.Star'));
    }
    if (
      enabled.has('evening-star') &&
      isBull(pp) &&
      bodySize(p) < bodySize(pp) * 0.5 &&
      !isBull(c) &&
      c.close < (pp.open + pp.close) / 2
    ) {
      out.push(m(c, 'aboveBar', '#ef5350', 'arrowDown', 'E.Star'));
    }
    if (enabled.has('inside-bar') && c.high < p.high && c.low > p.low) {
      out.push(m(c, 'aboveBar', '#7d8590', 'circle', 'IB'));
    }
    if (
      enabled.has('three-white-soldiers') &&
      isBull(pp) &&
      isBull(p) &&
      isBull(c) &&
      c.close > p.close &&
      p.close > pp.close &&
      bodySize(c) > range(c) * 0.5
    ) {
      out.push(m(c, 'belowBar', '#26a69a', 'arrowUp', '3 soldiers'));
    }
    if (
      enabled.has('three-black-crows') &&
      !isBull(pp) &&
      !isBull(p) &&
      !isBull(c) &&
      c.close < p.close &&
      p.close < pp.close &&
      bodySize(c) > range(c) * 0.5
    ) {
      out.push(m(c, 'aboveBar', '#ef5350', 'arrowDown', '3 crows'));
    }
  }
  return out;
}

function m(
  c: Candle,
  position: ChartMarker['position'],
  color: string,
  shape: ChartMarker['shape'],
  text: string,
): ChartMarker {
  return { time: c.time, position, color, shape, text };
}
