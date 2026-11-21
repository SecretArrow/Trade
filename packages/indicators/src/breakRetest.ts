import type { Candle } from '@trade/core';
import type { BreakRetestEvent, ChartMarker, LevelOut, ZoneOut } from './types';
import { bodyBottom, bodyTop, isBull } from './util';
import { swingPoints } from './pivots';
import { supportResistance } from './structure';

export interface BreakRetestOptions {
  /** Retest zone width as +/- percent around the level. */
  tolerancePct?: number;
  left?: number;
  right?: number;
  /** Candles to scan back for setups. */
  lookback?: number;
  /** Minimum candles to wait for a retest after the break. */
  minWait?: number;
  /** Maximum candles after the break for the retest to stay valid. */
  maxWait?: number;
  /** Confirmation close buffer beyond the zone as percent of price. */
  confirmBufferPct?: number;
  /** Risk-reward multiple for the suggested target. */
  rr?: number;
}

export interface BreakRetestResult {
  events: BreakRetestEvent[];
  markers: ChartMarker[];
  zones: ZoneOut[];
  levels: LevelOut[];
}

function isBullishEngulfing(prev: Candle, cur: Candle): boolean {
  return !isBull(prev) && isBull(cur) && cur.close > prev.open && cur.open < prev.close;
}

function isBearishEngulfing(prev: Candle, cur: Candle): boolean {
  return isBull(prev) && !isBull(cur) && cur.close < prev.open && cur.open > prev.close;
}

function isBullishPinBar(c: Candle): boolean {
  const range = c.high - c.low;
  if (range <= 0) return false;
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  return lowerWick > range * 0.55 && upperWick < range * 0.2;
}

function isBearishPinBar(c: Candle): boolean {
  const range = c.high - c.low;
  if (range <= 0) return false;
  const lowerWick = Math.min(c.open, c.close) - c.low;
  const upperWick = c.high - Math.max(c.open, c.close);
  return upperWick > range * 0.55 && lowerWick < range * 0.2;
}

/**
 * Break & retest detector.
 *
 * Rules (industry-standard break-and-retest methodology):
 * 1. A level is only broken when a candle BODY CLOSES outside the zone; a
 *    wick pierce that closes back inside is a false breakout and is marked.
 * 2. After a valid break the level flips role (broken resistance becomes
 *    support and vice versa) and we wait for price to return into the zone.
 * 3. A setup is confirmed when, inside the retest window, a confirmation
 *    candle (bullish/bearish engulfing or pin bar) closes back in the
 *    breakout direction with a small buffer.
 * 4. Suggestions are informational: entry at the zone edge, stop beyond the
 *    far edge, target at `rr` times the risk.
 */
export function breakRetest(candles: Candle[], options: BreakRetestOptions = {}): BreakRetestResult {
  const tolerancePct = options.tolerancePct ?? 0.15;
  const left = options.left ?? 3;
  const right = options.right ?? 3;
  const lookback = options.lookback ?? 250;
  const minWait = options.minWait ?? 1;
  const maxWait = options.maxWait ?? 25;
  const confirmBufferPct = options.confirmBufferPct ?? 0.05;
  const rr = options.rr ?? 3;

  const events: BreakRetestEvent[] = [];
  const markers: ChartMarker[] = [];
  const zones: ZoneOut[] = [];
  const levels: LevelOut[] = [];

  if (candles.length < left + right + 10) {
    return { events, markers, zones, levels };
  }

  const start = Math.max(0, candles.length - lookback);
  const window = candles.slice(start);
  const pivots = swingPoints(window, left, right);
  if (pivots.length === 0) return { events, markers, zones, levels };

  // Build candidate levels from pivots in the first 70% of the window so the
  // remaining 30% can contain the break, retest and confirmation.
  const cutIdx = Math.floor(window.length * 0.7);
  const levelsToTest = pivots.filter((p) => p.index < cutIdx);

  for (const pivot of levelsToTest) {
    const level = pivot.price;
    const tol = (level * tolerancePct) / 100;
    const zoneTop = level + tol;
    const zoneBottom = level - tol;
    const isResistance = pivot.kind === 'high';
    const direction: 'long' | 'short' = isResistance ? 'long' : 'short';

    let breakIdx = -1;
    let falseBreakIdx = -1;
    for (let i = pivot.index + 1; i < window.length; i++) {
      const c = window[i];
      if (isResistance) {
        if (bodyTop(c) > zoneTop && c.close > zoneTop) {
          breakIdx = i;
          break;
        }
        if (c.high > zoneTop && c.close <= zoneTop && falseBreakIdx === -1) {
          falseBreakIdx = i;
        }
      } else {
        if (bodyBottom(c) < zoneBottom && c.close < zoneBottom) {
          breakIdx = i;
          break;
        }
        if (c.low < zoneBottom && c.close >= zoneBottom && falseBreakIdx === -1) {
          falseBreakIdx = i;
        }
      }
    }

    if (falseBreakIdx >= 0 && breakIdx === -1) {
      markers.push({
        time: window[falseBreakIdx].time,
        position: isResistance ? 'aboveBar' : 'belowBar',
        color: '#f0a92e',
        shape: 'square',
        text: 'False break',
      });
      continue;
    }
    if (breakIdx < 0) continue;

    markers.push({
      time: window[breakIdx].time,
      position: isResistance ? 'aboveBar' : 'belowBar',
      color: '#4f8cff',
      shape: isResistance ? 'arrowUp' : 'arrowDown',
      text: 'Break',
    });

    // retest search window
    let retestIdx = -1;
    const searchEnd = Math.min(window.length - 1, breakIdx + maxWait);
    for (let i = breakIdx + minWait; i <= searchEnd; i++) {
      const c = window[i];
      if (isResistance) {
        if (c.low <= zoneTop && c.close > zoneBottom) {
          retestIdx = i;
          break;
        }
        if (c.close < zoneBottom) break; // invalidated before retest
      } else {
        if (c.high >= zoneBottom && c.close < zoneTop) {
          retestIdx = i;
          break;
        }
        if (c.close > zoneTop) break; // invalidated before retest
      }
    }
    if (retestIdx < 0) continue;

    // confirmation search after retest begins
    let confirmIdx = -1;
    for (let i = retestIdx; i <= searchEnd; i++) {
      const c = window[i];
      const prev = window[i - 1];
      if (isResistance) {
        const buffer = (zoneTop * confirmBufferPct) / 100;
        const pattern = isBullishPinBar(c) || isBullishEngulfing(prev, c) || isBull(c);
        if (c.close > zoneTop + buffer && pattern) {
          confirmIdx = i;
          break;
        }
        if (c.close < zoneBottom) break;
      } else {
        const buffer = (zoneBottom * confirmBufferPct) / 100;
        const pattern = isBearishPinBar(c) || isBearishEngulfing(prev, c) || !isBull(c);
        if (c.close < zoneBottom - buffer && pattern) {
          confirmIdx = i;
          break;
        }
        if (c.close > zoneTop) break;
      }
    }

    const event: BreakRetestEvent = {
      direction,
      level,
      zoneTop,
      zoneBottom,
      breakTime: window[breakIdx].time,
      retestTime: window[retestIdx].time,
      confirmTime: confirmIdx >= 0 ? window[confirmIdx].time : undefined,
      status: confirmIdx >= 0 ? 'confirmed' : 'retested',
      entry: confirmIdx >= 0 ? window[confirmIdx].close : undefined,
      stop: direction === 'long' ? zoneBottom : zoneTop,
    };
    if (event.entry !== undefined && event.stop !== undefined) {
      const risk = Math.abs(event.entry - event.stop);
      event.target = direction === 'long' ? event.entry + rr * risk : event.entry - rr * risk;
    }
    events.push(event);

    zones.push({
      fromTime: window[retestIdx].time,
      toTime: window[Math.min(window.length - 1, retestIdx + 8)].time,
      top: zoneTop,
      bottom: zoneBottom,
      kind: isResistance ? 'support' : 'resistance',
      label: `Retest zone (${direction})`,
    });

    if (confirmIdx >= 0) {
      markers.push({
        time: window[confirmIdx].time,
        position: direction === 'long' ? 'belowBar' : 'aboveBar',
        color: '#26a69a',
        shape: direction === 'long' ? 'arrowUp' : 'arrowDown',
        text: 'Confirm',
      });
    }
  }

  // suggest levels for the most recent actionable event
  const latest = events[events.length - 1];
  if (latest && latest.entry !== undefined && latest.stop !== undefined && latest.target !== undefined) {
    levels.push(
      { price: latest.entry, label: 'Entry (info)', kind: 'entry' },
      { price: latest.stop, label: 'Stop (info)', kind: 'stop' },
      { price: latest.target, label: `Target ${rr}R (info)`, kind: 'target' },
    );
  }

  return { events, markers, zones, levels };
}
