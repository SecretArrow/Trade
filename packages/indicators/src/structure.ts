import type { Candle } from '@trade/core';
import type { ChartMarker, LineOut, PlotValues, ZoneOut } from './types';
import { swingPoints, type SwingPoint } from './pivots';
import { atrValues } from './bands';
import { macd, rsi } from './momentum';
import { bodySize, bodyTop, bodyBottom, isBull, smaValues } from './util';

// ---------------------------------------------------------------------------
// Support / resistance with break-validation lifecycle
// ---------------------------------------------------------------------------

export interface SrOptions {
  left?: number;
  right?: number;
  clusterPct?: number;
  maxZones?: number;
}

export interface SrZone extends ZoneOut {
  touches: number;
  wickTests: number;
  crossings: number;
  strength: number;
}

/**
 * Support/resistance detection. Zones are clusters of swing pivots.
 *
 * Lifecycle (industry-standard zone analysis): a zone starts as a
 * `candidate`; once price has broken through it with a candle BODY close it
 * becomes `validated` (the classic role-reversal reference level); repeated
 * body crossings reduce its strength ("too many tests weaken the zone") and
 * mark it `invalidated` once it has been crossed more than twice.
 */
export function supportResistance(candles: Candle[], options: SrOptions = {}): SrZone[] {
  const left = options.left ?? 3;
  const right = options.right ?? 3;
  const clusterPct = options.clusterPct ?? 0.25;
  const maxZones = options.maxZones ?? 8;
  if (candles.length < left + right + 1) return [];

  const pivots = swingPoints(candles, left, right);
  if (pivots.length === 0) return [];

  // cluster pivots by price proximity
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const clusters: SwingPoint[][] = [];
  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    if (last) {
      const ref = last[0].price;
      if (Math.abs(p.price - ref) / ref * 100 <= clusterPct) {
        last.push(p);
        continue;
      }
    }
    clusters.push([p]);
  }

  const zones: SrZone[] = [];
  for (const cluster of clusters) {
    if (cluster.length === 0) continue;
    const prices = cluster.map((p) => p.price);
    const refPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    let top = Math.max(...prices);
    let bottom = Math.min(...prices);
    if (top === bottom) {
      const atr = atrValues(candles, 14);
      const lastAtr = atr[atr.length - 1] ?? refPrice * 0.002;
      const pad = (lastAtr === null ? refPrice * 0.002 : lastAtr) * 0.5;
      top += pad;
      bottom -= pad;
    }
    const firstIdx = Math.min(...cluster.map((p) => p.index));
    const lastIdx = Math.max(...cluster.map((p) => p.index));

    // count body crossings and wick tests after the zone formed
    let crossings = 0;
    let wickTests = 0;
    let touches = cluster.length;
    let side: 'above' | 'below' | null = null;
    for (let i = firstIdx + 1; i < candles.length; i++) {
      const c = candles[i];
      const cTop = bodyTop(c);
      const cBottom = bodyBottom(c);
      const nowSide: 'above' | 'below' = cBottom > top ? 'above' : cTop < bottom ? 'below' : 'inside';
      if (nowSide === 'inside') {
        if (side === 'above' || side === 'below') {
          // re-entering the zone from one side: a wick test or body test
          if (c.high >= bottom && c.low <= top) wickTests += 1;
          touches += 1;
        }
      } else if (side !== null && nowSide !== side) {
        crossings += 1;
        side = nowSide;
      } else if (side === null) {
        side = nowSide;
      }
    }

    const strength = touches + wickTests * 0.5 - crossings * 1.5 + recencyBoost(cluster, candles.length);
    const state: SrZone['state'] =
      crossings >= 3 ? 'invalidated' : crossings >= 1 ? 'validated' : 'candidate';
    zones.push({
      fromTime: candles[Math.max(0, firstIdx - 1)].time,
      toTime: candles[candles.length - 1].time,
      top,
      bottom,
      kind: cluster[0].kind === 'high' ? 'resistance' : 'support',
      label: `${cluster[0].kind === 'high' ? 'R' : 'S'} x${touches}${crossings > 0 ? ` broken x${crossings}` : ''}`,
      strength,
      state,
      touches,
      wickTests,
      crossings,
    });
  }
  zones.sort((a, b) => b.strength - a.strength);
  return zones.slice(0, maxZones);
}

function recencyBoost(cluster: SwingPoint[], total: number): number {
  const lastIdx = Math.max(...cluster.map((p) => p.index));
  const age = total - lastIdx;
  return age < 20 ? 1.5 : age < 60 ? 0.5 : 0;
}

// ---------------------------------------------------------------------------
// Market structure: HH/HL/LH/LL, BOS, CHoCH
// ---------------------------------------------------------------------------

export interface StructurePoint extends SwingPoint {
  label: 'HH' | 'HL' | 'LH' | 'LL';
}

export interface MarketStructureResult {
  points: StructurePoint[];
  markers: ChartMarker[];
  trend: 'up' | 'down' | 'sideways';
}

/** Alternating zigzag from swing points (keeps the more extreme of consecutive same-kind pivots). */
export function zigzag(candles: Candle[], left: number, right: number): SwingPoint[] {
  const raw = swingPoints(candles, left, right);
  const out: SwingPoint[] = [];
  for (const p of raw) {
    const last = out[out.length - 1];
    if (!last || last.kind !== p.kind) {
      out.push(p);
    } else {
      // same kind: keep the more extreme pivot
      if (p.kind === 'high' ? p.price > last.price : p.price < last.price) out[out.length - 1] = p;
    }
  }
  return out;
}

export function marketStructure(candles: Candle[], swingPeriod = 3): MarketStructureResult {
  const pivots = zigzag(candles, swingPeriod, swingPeriod);
  const points: StructurePoint[] = [];
  const markers: ChartMarker[] = [];
  let prevHigh: SwingPoint | null = null;
  let prevLow: SwingPoint | null = null;
  let trend: 'up' | 'down' | 'sideways' = 'sideways';

  for (const p of pivots) {
    if (p.kind === 'high') {
      if (prevHigh) {
        const label = p.price > prevHigh.price ? 'HH' : 'LH';
        points.push({ ...p, label });
        markers.push({
          time: p.time,
          position: 'aboveBar',
          color: label === 'HH' ? '#26a69a' : '#ef5350',
          shape: 'square',
          text: label,
        });
      }
      prevHigh = p;
    } else {
      if (prevLow) {
        const label = p.price > prevLow.price ? 'HL' : 'LL';
        points.push({ ...p, label });
        markers.push({
          time: p.time,
          position: 'belowBar',
          color: label === 'HL' ? '#26a69a' : '#ef5350',
          shape: 'square',
          text: label,
        });
      }
      prevLow = p;
    }
  }

  // BOS / CHoCH detection on closes
  let lastHigh: SwingPoint | null = null;
  let lastLow: SwingPoint | null = null;
  let pivotIdx = 0;
  for (let i = 0; i < candles.length; i++) {
    while (pivotIdx < pivots.length && pivots[pivotIdx].index <= i) {
      const p = pivots[pivotIdx];
      if (p.kind === 'high') lastHigh = p;
      else lastLow = p;
      pivotIdx++;
    }
    const c = candles[i];
    if (lastHigh && c.close > lastHigh.price && i > lastHigh.index) {
      const kind = trend === 'up' ? 'BOS' : 'CHoCH';
      markers.push({ time: c.time, position: 'aboveBar', color: '#4f8cff', shape: 'arrowUp', text: kind });
      trend = 'up';
      lastHigh = null;
    } else if (lastLow && c.close < lastLow.price && i > lastLow.index) {
      const kind = trend === 'down' ? 'BOS' : 'CHoCH';
      markers.push({ time: c.time, position: 'belowBar', color: '#b46cff', shape: 'arrowDown', text: kind });
      trend = 'down';
      lastLow = null;
    }
  }
  return { points, markers, trend };
}

// ---------------------------------------------------------------------------
// Zigzag-gated parallel channel with 4th-pivot projection
// ---------------------------------------------------------------------------

export interface ChannelResult {
  lines: LineOut[];
  projection?: { time: number; price: number };
  direction: 'up' | 'down' | null;
}

/**
 * Parallel channel built from the last three alternating pivots. A channel is
 * only emitted when the 3-pivot precondition exists (a gate borrowed from
 * classical channel theory); the 4th-pivot projection marks the expected
 * next touch area.
 */
export function channel(candles: Candle[], swingPeriod = 3): ChannelResult {
  const pivots = zigzag(candles, swingPeriod, swingPeriod);
  if (pivots.length < 3) return { lines: [], direction: null };
  const p1 = pivots[pivots.length - 3];
  const p2 = pivots[pivots.length - 2];
  const p3 = pivots[pivots.length - 1];
  if (p2.kind === 'low' && p1.kind === 'high' && p3.kind === 'high') {
    // bearish channel: lower highs
    if (p3.price < p1.price) {
      const slope = (p3.price - p1.price) / (p3.time - p1.time || 1);
      const endTime = candles[candles.length - 1].time + (p3.time - p1.time) / 4;
      const upper: LineOut = { x1: p1.time, y1: p1.price, x2: endTime, y2: p1.price + slope * (endTime - p1.time), kind: 'channel-upper', label: 'Channel upper' };
      const lower: LineOut = { x1: p2.time, y1: p2.price, x2: endTime, y2: p2.price + slope * (endTime - p2.time), kind: 'channel-lower', label: 'Channel lower' };
      const midY = (y1: number, y2: number) => (y1 + y2) / 2;
      const mid: LineOut = {
        x1: p2.time,
        y1: midY(p1.price, p2.price),
        x2: endTime,
        y2: midY(upper.y2, lower.y2),
        kind: 'channel-mid',
        label: 'Channel mid',
      };
      const projTime = p3.time + (p3.time - p1.time) / 2;
      return {
        lines: [upper, lower, mid],
        projection: { time: projTime, price: p2.price + slope * (projTime - p2.time) },
        direction: 'down',
      };
    }
  }
  if (p2.kind === 'high' && p1.kind === 'low' && p3.kind === 'low') {
    // bullish channel: higher lows
    if (p3.price > p1.price) {
      const slope = (p3.price - p1.price) / (p3.time - p1.time || 1);
      const endTime = candles[candles.length - 1].time + (p3.time - p1.time) / 4;
      const lower: LineOut = { x1: p1.time, y1: p1.price, x2: endTime, y2: p1.price + slope * (endTime - p1.time), kind: 'channel-lower', label: 'Channel lower' };
      const upper: LineOut = { x1: p2.time, y1: p2.price, x2: endTime, y2: p2.price + slope * (endTime - p2.time), kind: 'channel-upper', label: 'Channel upper' };
      const mid: LineOut = {
        x1: p2.time,
        y1: (p1.price + p2.price) / 2,
        x2: endTime,
        y2: (upper.y2 + lower.y2) / 2,
        kind: 'channel-mid',
        label: 'Channel mid',
      };
      const projTime = p3.time + (p3.time - p1.time) / 2;
      return {
        lines: [upper, lower, mid],
        projection: { time: projTime, price: p2.price + slope * (projTime - p2.time) },
        direction: 'up',
      };
    }
  }
  return { lines: [], direction: null };
}

// ---------------------------------------------------------------------------
// Supply / demand zones (strict 3-candle pattern)
// ---------------------------------------------------------------------------

export interface SndZone extends ZoneOut {
  midPrice: number;
  retested: boolean;
  mitigated: boolean;
}

/**
 * Supply/demand zones from the strict three-candle pattern:
 * green-red-green = demand, red-green-red = supply. The middle candle is the
 * zone origin; its 50% level is the preferred entry. A later retest marks the
 * zone as battle-tested (a validity boost, not a weakness), while a body
 * close through the far side mitigates it.
 */
export function supplyDemand(candles: Candle[], maxZones = 6): SndZone[] {
  const out: SndZone[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const a = candles[i - 1];
    const b = candles[i];
    const c = candles[i + 1];
    const aBull = isBull(a);
    const bBear = !isBull(b);
    const cBull = isBull(c);
    let kind: 'demand' | 'supply' | null = null;
    if (aBull && bBear && cBull && c.close > a.high) kind = 'demand';
    if (!aBull && !bBear && !cBull && c.close < a.low) kind = 'supply';
    if (!kind) continue;
    const top = b.high;
    const bottom = b.low;
    const midPrice = (top + bottom) / 2;
    let retested = false;
    let mitigated = false;
    for (let j = i + 2; j < candles.length; j++) {
      const x = candles[j];
      if (kind === 'demand') {
        if (x.low <= top) retested = true;
        if (bodyBottom(x) < bottom) mitigated = true;
      } else {
        if (x.high >= bottom) retested = true;
        if (bodyTop(x) > top) mitigated = true;
      }
    }
    out.push({
      fromTime: b.time,
      toTime: candles[candles.length - 1].time,
      top,
      bottom,
      kind,
      label: `${kind === 'demand' ? 'Demand' : 'Supply'}${retested ? ' (retested)' : ''}${mitigated ? ' [mitigated]' : ''}`,
      state: mitigated ? 'mitigated' : retested ? 'validated' : 'candidate',
      midPrice,
      retested,
      mitigated,
    });
  }
  // newest first, unmitigated prioritized
  out.sort((a, b) => {
    const ma = a.mitigated ? 1 : 0;
    const mb = b.mitigated ? 1 : 0;
    if (ma !== mb) return ma - mb;
    return b.fromTime - a.fromTime;
  });
  return out.slice(0, maxZones);
}

// ---------------------------------------------------------------------------
// Fair value gaps (imbalance)
// ---------------------------------------------------------------------------

export function fairValueGaps(candles: Candle[], minGapPct = 0.05, maxZones = 8): ZoneOut[] {
  const out: ZoneOut[] = [];
  for (let i = 2; i < candles.length; i++) {
    const c0 = candles[i - 2];
    const c2 = candles[i];
    const bullGap = c2.low - c0.high;
    const bearGap = c0.low - c2.high;
    const price = c2.close;
    if (bullGap / price * 100 >= minGapPct) {
      let filled = false;
      for (let j = i + 1; j < candles.length && !filled; j++) {
        if (candles[j].low <= c0.high) filled = true;
      }
      out.push({
        fromTime: candles[i - 1].time,
        toTime: candles[candles.length - 1].time,
        top: c2.low,
        bottom: c0.high,
        kind: 'fvg-bull',
        label: `FVG${filled ? ' (filled)' : ''}`,
        state: filled ? 'mitigated' : 'candidate',
      });
    } else if (bearGap / price * 100 >= minGapPct) {
      let filled = false;
      for (let j = i + 1; j < candles.length && !filled; j++) {
        if (candles[j].high >= c0.low) filled = true;
      }
      out.push({
        fromTime: candles[i - 1].time,
        toTime: candles[candles.length - 1].time,
        top: c0.low,
        bottom: c2.high,
        kind: 'fvg-bear',
        label: `FVG${filled ? ' (filled)' : ''}`,
        state: filled ? 'mitigated' : 'candidate',
      });
    }
  }
  return out.slice(-maxZones);
}

// ---------------------------------------------------------------------------
// Order blocks
// ---------------------------------------------------------------------------

export function orderBlocks(candles: Candle[], atrPeriod = 14, impulseMult = 1.2, maxZones = 6): ZoneOut[] {
  const atr = atrValues(candles, atrPeriod);
  const out: ZoneOut[] = [];
  for (let i = 0; i + 4 <= candles.length - 1; i++) {
    const a = atr[i];
    if (a === null) continue;
    const origin = candles[i];
    let bullBody = 0;
    let bearBody = 0;
    for (let j = i + 1; j <= i + 3; j++) {
      const c = candles[j];
      if (isBull(c)) bullBody += c.close - c.open;
      else bearBody += c.open - c.close;
    }
    const isBullOb = !isBull(origin) && bullBody > impulseMult * a;
    const isBearOb = isBull(origin) && bearBody > impulseMult * a;
    if (!isBullOb && !isBearOb) continue;
    let mitigated = false;
    for (let j = i + 4; j < candles.length; j++) {
      const x = candles[j];
      if (isBullOb && x.low < origin.low) mitigated = true;
      if (isBearOb && x.high > origin.high) mitigated = true;
    }
    out.push({
      fromTime: origin.time,
      toTime: candles[candles.length - 1].time,
      top: origin.high,
      bottom: origin.low,
      kind: isBullOb ? 'order-block-bull' : 'order-block-bear',
      label: `${isBullOb ? 'Bull' : 'Bear'} OB${mitigated ? ' (mitigated)' : ''}`,
      state: mitigated ? 'mitigated' : 'candidate',
    });
  }
  return out.slice(-maxZones);
}

// ---------------------------------------------------------------------------
// Auto Fibonacci levels (golden ratio emphasized)
// ---------------------------------------------------------------------------

export interface FibLevel {
  price: number;
  label: string;
  golden: boolean;
}

export function fibonacciAuto(candles: Candle[], lookback = 150): FibLevel[] {
  const start = Math.max(0, candles.length - lookback);
  const window = candles.slice(start);
  if (window.length < 5) return [];
  let hiIdx = 0;
  let loIdx = 0;
  for (let i = 1; i < window.length; i++) {
    if (window[i].high > window[hiIdx].high) hiIdx = i;
    if (window[i].low < window[loIdx].low) loIdx = i;
  }
  const hi = window[hiIdx].high;
  const lo = window[loIdx].low;
  if (hi === lo) return [];
  const upMove = loIdx < hiIdx;
  const ratios: [number, string, boolean][] = [
    [0, '0', false],
    [0.236, '23.6%', false],
    [0.382, '38.2%', false],
    [0.5, '50%', false],
    [0.618, '61.8% (golden)', true],
    [0.786, '78.6%', false],
    [1, '100%', false],
    [1.272, '127.2% ext', false],
    [1.618, '161.8% ext (golden)', true],
  ];
  return ratios.map(([r, label, golden]) => ({
    price: upMove ? hi - (hi - lo) * r : lo + (hi - lo) * r,
    label: `Fib ${label}`,
    golden,
  }));
}

// ---------------------------------------------------------------------------
// Divergence (regular + hidden)
// ---------------------------------------------------------------------------

export interface DivergenceOptions {
  osc?: 'rsi' | 'macd';
  mode?: 'regular' | 'hidden' | 'both';
  left?: number;
  right?: number;
}

export interface DivergenceMarker extends ChartMarker {
  kind: 'regular-bull' | 'regular-bear' | 'hidden-bull' | 'hidden-bear';
}

export function divergence(candles: Candle[], options: DivergenceOptions = {}): DivergenceMarker[] {
  const oscType = options.osc ?? 'rsi';
  const mode = options.mode ?? 'both';
  const left = options.left ?? 2;
  const right = options.right ?? 2;
  if (candles.length < left + right + 5) return [];

  let osc: PlotValues;
  if (oscType === 'macd') {
    osc = macd(candles, 12, 26, 9).histogram;
  } else {
    osc = rsi(candles, 14);
  }

  const highs = swingPoints(candles, left, right).filter((p) => p.kind === 'high');
  const lows = swingPoints(candles, left, right).filter((p) => p.kind === 'low');
  const out: DivergenceMarker[] = [];

  if (mode !== 'hidden') {
    // regular bearish: higher high in price, lower high in osc
    for (let i = 1; i < highs.length; i++) {
      const a = highs[i - 1];
      const b = highs[i];
      const oa = osc[a.index];
      const ob = osc[b.index];
      if (oa === null || ob === null) continue;
      if (b.price > a.price && ob < oa) {
        out.push({ time: b.time, position: 'aboveBar', color: '#ef5350', shape: 'arrowDown', text: `Bear div`, kind: 'regular-bear' });
      }
    }
    // regular bullish: lower low in price, higher low in osc
    for (let i = 1; i < lows.length; i++) {
      const a = lows[i - 1];
      const b = lows[i];
      const oa = osc[a.index];
      const ob = osc[b.index];
      if (oa === null || ob === null) continue;
      if (b.price < a.price && ob > oa) {
        out.push({ time: b.time, position: 'belowBar', color: '#26a69a', shape: 'arrowUp', text: `Bull div`, kind: 'regular-bull' });
      }
    }
  }
  if (mode !== 'regular') {
    // hidden bearish: lower high in price, higher high in osc
    for (let i = 1; i < highs.length; i++) {
      const a = highs[i - 1];
      const b = highs[i];
      const oa = osc[a.index];
      const ob = osc[b.index];
      if (oa === null || ob === null) continue;
      if (b.price < a.price && ob > oa) {
        out.push({ time: b.time, position: 'aboveBar', color: '#f0a92e', shape: 'arrowDown', text: 'Hidden bear div', kind: 'hidden-bear' });
      }
    }
    // hidden bullish: higher low in price, lower low in osc
    for (let i = 1; i < lows.length; i++) {
      const a = lows[i - 1];
      const b = lows[i];
      const oa = osc[a.index];
      const ob = osc[b.index];
      if (oa === null || ob === null) continue;
      if (b.price > a.price && ob < oa) {
        out.push({ time: b.time, position: 'belowBar', color: '#f0a92e', shape: 'arrowUp', text: 'Hidden bull div', kind: 'hidden-bull' });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Auto trendlines
// ---------------------------------------------------------------------------

export function trendlines(candles: Candle[], swingPeriod = 3, maxPivots = 8): LineOut[] {
  const pivots = zigzag(candles, swingPeriod, swingPeriod);
  const highs = pivots.filter((p) => p.kind === 'high').slice(-maxPivots);
  const lows = pivots.filter((p) => p.kind === 'low').slice(-maxPivots);
  const atr = atrValues(candles, 14);
  const lastAtr = atr[atr.length - 1] ?? 0;
  const tol = (lastAtr === null ? 0 : lastAtr) * 0.5;
  const out: LineOut[] = [];

  const best = (points: SwingPoint[], kind: 'trendline'): LineOut | null => {
    let bestLine: LineOut | null = null;
    let bestTouches = 0;
    for (let i = 0; i < points.length - 1; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i];
        const b = points[j];
        const slope = (b.price - a.price) / (b.time - a.time || 1);
        let touches = 2;
        for (const p of points) {
          if (p === a || p === b) continue;
          const y = a.price + slope * (p.time - a.time);
          if (Math.abs(p.price - y) <= Math.max(tol, p.price * 0.001)) touches += 1;
        }
        if (touches >= 3 && touches > bestTouches) {
          bestTouches = touches;
          const endTime = candles[candles.length - 1].time;
          bestLine = {
            x1: a.time,
            y1: a.price,
            x2: endTime,
            y2: a.price + slope * (endTime - a.time),
            kind,
            label: `Trendline x${touches}`,
          };
        }
      }
    }
    return bestLine;
  };

  const upper = best(highs, 'trendline');
  const lower = best(lows, 'trendline');
  if (upper) out.push(upper);
  if (lower) out.push(lower);
  return out;
}

// ---------------------------------------------------------------------------
// Higher-timeframe support/resistance for multi-timeframe confluence
// ---------------------------------------------------------------------------

export function mtfSupportResistance(
  candles: Candle[],
  resample: (c: Candle[]) => Candle[],
  options?: SrOptions,
): SrZone[] {
  const higher = resample(candles);
  if (higher.length === 0) return [];
  const zones = supportResistance(higher, options);
  const lastTime = candles[candles.length - 1].time;
  return zones.map((z) => ({ ...z, toTime: Math.max(z.toTime, lastTime) }));
}

/** Simple MA confluence helper: is price near an MA (within `pct`)? */
export function nearMa(candles: Candle[], period: number, pct = 0.3): boolean {
  const ma = smaValues(
    candles.map((c) => c.close),
    period,
  );
  const lastMa = ma[ma.length - 1];
  const lastClose = candles[candles.length - 1].close;
  if (lastMa === null) return false;
  return (Math.abs(lastClose - lastMa) / lastClose) * 100 <= pct;
}

export { bodySize };
