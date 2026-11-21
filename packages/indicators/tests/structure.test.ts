import { describe, expect, it } from 'vitest';
import type { Candle } from '@trade/core';
import {
  channel,
  divergence,
  fairValueGaps,
  fibonacciAuto,
  marketStructure,
  orderBlocks,
  supplyDemand,
  supportResistance,
  trendlines,
  zigzag,
} from '../src/structure';
import { breakRetest } from '../src/breakRetest';
import { detectPatterns } from '../src/patterns';
import { pivotPoints, swingPoints } from '../src/pivots';
import { heikinAshi } from '../src/heikin';

const T0 = 1704067200;

function candle(
  time: number,
  open: number,
  close: number,
  high?: number,
  low?: number,
  volume = 100,
): Candle {
  return {
    time,
    open,
    close,
    high: high ?? Math.max(open, close) + 1,
    low: low ?? Math.min(open, close) - 1,
    volume,
  };
}

describe('swing points and zigzag', () => {
  it('finds fractal pivots', () => {
    const candles: Candle[] = [];
    const shape = [1, 2, 3, 2, 1, 2, 3, 4, 3, 2, 1];
    for (let i = 0; i < 40; i++) {
      const price = 100 + shape[i % shape.length];
      candles.push(candle(T0 + i * 900, price - 0.5, price));
    }
    const pivots = swingPoints(candles, 2, 2);
    expect(pivots.length).toBeGreaterThan(0);
    expect(pivots.every((p) => p.kind === 'high' || p.kind === 'low')).toBe(true);
  });

  it('zigzag alternates kinds', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 60; i++) {
      const price = 100 + Math.sin(i / 4) * 10;
      candles.push(candle(T0 + i * 900, price - 0.5, price));
    }
    const zz = zigzag(candles, 2, 2);
    expect(zz.length).toBeGreaterThan(1);
    for (let i = 1; i < zz.length; i++) {
      expect(zz[i].kind).not.toBe(zz[i - 1].kind);
    }
  });
});

describe('support and resistance', () => {
  it('detects a tested resistance zone and marks it validated after a break', () => {
    const candles: Candle[] = [];
    // rising run into a spike, pullback, second lower high, pullback, body-close break
    for (let i = 0; i < 8; i++) {
      candles.push(candle(T0 + i * 3600, 100 + i, 101 + i, 102 + i, 99 + i));
    }
    candles.push(candle(T0 + 8 * 3600, 104, 110, 112, 103)); // swing high 112
    candles.push(candle(T0 + 9 * 3600, 109, 106, 110, 105));
    candles.push(candle(T0 + 10 * 3600, 106, 105, 107, 104));
    candles.push(candle(T0 + 11 * 3600, 105, 104, 106, 103));
    candles.push(candle(T0 + 12 * 3600, 104, 105, 106, 103));
    candles.push(candle(T0 + 13 * 3600, 105, 109.5, 111.5, 104)); // second high 111.5
    candles.push(candle(T0 + 14 * 3600, 108, 107, 109, 106));
    candles.push(candle(T0 + 15 * 3600, 107, 105, 108, 104));
    candles.push(candle(T0 + 16 * 3600, 105, 104, 106, 103));
    candles.push(candle(T0 + 17 * 3600, 104, 116, 117, 103.5)); // body close above zone
    const zones = supportResistance(candles, { left: 2, right: 2, clusterPct: 1, maxZones: 10 });
    expect(zones.length).toBeGreaterThan(0);
    const broken = zones.find((z) => z.crossings > 0);
    expect(broken).toBeDefined();
    if (broken) {
      expect(broken.state).toBe('validated');
      expect(broken.kind).toBe('resistance');
    }
  });
});

describe('market structure', () => {
  it('labels HH/HL/LH/LL and detects breaks', () => {
    const candles: Candle[] = [];
    const seq = [100, 102, 101, 104, 103, 107, 106, 111, 110, 116];
    for (let i = 0; i < seq.length; i++) {
      const p = seq[i];
      candles.push(candle(T0 + i * 3600, p - 1, p, p + 1.5, p - 2.5));
    }
    const result = marketStructure(candles, 1);
    expect(result.points.some((p) => p.label === 'HH' || p.label === 'HL')).toBe(true);
    expect(result.markers.some((m) => m.text === 'BOS' || m.text === 'CHoCH')).toBe(true);
  });
});

describe('channel detection', () => {
  it('builds a bearish channel from the last three zigzag pivots', () => {
    const candles: Candle[] = [
      candle(T0 + 0 * 3600, 118, 120, 121, 117),
      candle(T0 + 1 * 3600, 119, 115, 120, 114),
      candle(T0 + 2 * 3600, 116, 111, 117, 110),
      candle(T0 + 3 * 3600, 112, 113, 114, 111),
      candle(T0 + 4 * 3600, 111.5, 114, 115, 110.5),
      candle(T0 + 5 * 3600, 112.5, 111.5, 113.5, 109.5),
      candle(T0 + 6 * 3600, 110, 108, 111, 107),
      candle(T0 + 7 * 3600, 108.5, 109, 110, 108),
      candle(T0 + 8 * 3600, 109, 112, 113, 108.5),
      candle(T0 + 9 * 3600, 111, 110, 112, 109),
    ];
    const result = channel(candles, 1);
    expect(result.lines).toHaveLength(3);
    expect(result.direction).toBe('down');
    expect(result.projection).toBeDefined();
  });

  it('returns empty when fewer than three pivots exist', () => {
    const candles = [candle(T0, 1, 1), candle(T0 + 900, 2, 2), candle(T0 + 1800, 3, 3)];
    expect(channel(candles, 1).lines).toHaveLength(0);
  });
});

describe('supply and demand', () => {
  it('detects the strict green-red-green demand pattern', () => {
    const candles: Candle[] = [
      candle(T0, 99, 98, 99.5, 97.5),
      candle(T0 + 900, 98, 97, 98.5, 96.5),
      candle(T0 + 1800, 97, 100, 101, 96), // green
      candle(T0 + 2700, 99.5, 98, 100.5, 97), // red origin, zone 97..100.5
      candle(T0 + 3600, 98.5, 102, 103, 98), // green closing above first high
      candle(T0 + 4500, 101, 101.5, 102, 100.8), // stays above the zone
      candle(T0 + 5400, 101.5, 102, 102.5, 101.2),
    ];
    const zones = supplyDemand(candles, 5);
    const demand = zones.find((z) => z.kind === 'demand');
    expect(demand).toBeDefined();
    if (demand) {
      expect(demand.state).toBe('candidate');
      expect(demand.retested).toBe(false);
      expect(demand.midPrice).toBeCloseTo((97 + 100.5) / 2, 6);
    }
  });

  it('marks a retested zone as validated', () => {
    const candles: Candle[] = [
      candle(T0, 99, 98, 99.5, 97.5),
      candle(T0 + 900, 98, 97, 98.5, 96.5),
      candle(T0 + 1800, 97, 100, 101, 96),
      candle(T0 + 2700, 99.5, 98, 100.5, 97),
      candle(T0 + 3600, 98.5, 102, 103, 98),
      candle(T0 + 4500, 101, 99, 101.5, 98.8), // low enters the zone
      candle(T0 + 5400, 99.5, 103, 103.5, 99.2),
    ];
    const zones = supplyDemand(candles, 5);
    const demand = zones.find((z) => z.kind === 'demand');
    expect(demand).toBeDefined();
    if (demand) {
      expect(demand.retested).toBe(true);
      expect(demand.state).toBe('validated');
    }
  });
});

describe('fair value gaps and order blocks', () => {
  it('detects a bullish FVG', () => {
    const candles: Candle[] = [
      candle(T0, 100, 101, 101.5, 99.5),
      candle(T0 + 900, 101, 103, 103.5, 100.5),
      candle(T0 + 1800, 106, 108, 108.5, 105.5), // gap above candle[0] high
      candle(T0 + 2700, 108, 109, 109.5, 107),
    ];
    const zones = fairValueGaps(candles, 0.05, 10);
    expect(zones.some((z) => z.kind === 'fvg-bull')).toBe(true);
  });

  it('detects an order block before an impulse', () => {
    const candles: Candle[] = [
      candle(T0, 100, 100.5, 101, 99.5),
      candle(T0 + 900, 100.5, 101, 101.5, 100),
      candle(T0 + 1800, 101, 101.5, 102, 100.5),
      candle(T0 + 2700, 101.5, 99, 102, 98.5), // red origin
      candle(T0 + 3600, 99.5, 104.5, 105, 99),
      candle(T0 + 4500, 104, 109, 109.5, 103.5),
      candle(T0 + 5400, 108.5, 113.5, 114, 108),
    ];
    const zones = orderBlocks(candles, 3, 0.2, 10);
    expect(zones.some((z) => z.kind === 'order-block-bull')).toBe(true);
  });
});

describe('fibonacci auto levels', () => {
  it('includes golden ratio levels between swing extremes', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 30; i++) candles.push(candle(T0 + i * 3600, 99 + i * 0.2, 100 + i * 0.2));
    for (let i = 0; i < 20; i++)
      candles.push(candle(T0 + (30 + i) * 3600, 106 - i * 0.2, 105 - i * 0.2));
    const levels = fibonacciAuto(candles, 100);
    expect(levels).toHaveLength(9);
    expect(levels.some((l) => l.golden)).toBe(true);
    const golden = levels.find((l) => l.label.includes('61.8'));
    expect(golden?.golden).toBe(true);
  });
});

describe('divergence', () => {
  it('runs on oscillating data and returns markers', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 60; i++) {
      const price = 100 + Math.sin(i / 5) * 8 - i * 0.15;
      candles.push(candle(T0 + i * 3600, price - 1, price, price + 1.5, price - 2));
    }
    const markers = divergence(candles, { osc: 'rsi', mode: 'both' });
    expect(Array.isArray(markers)).toBe(true);
  });
});

describe('trendlines', () => {
  it('returns at most two lines and never crashes', () => {
    const candles: Candle[] = [];
    let p = 100;
    for (let i = 0; i < 50; i++) {
      p += Math.sin(i * 2.7) * 2 + Math.cos(i * 1.3);
      candles.push(candle(T0 + i * 3600, p - 0.5, p));
    }
    const lines = trendlines(candles, 2);
    expect(lines.length).toBeLessThanOrEqual(2);
  });
});

describe('break & retest', () => {
  function trendWithBreak(): Candle[] {
    const candles: Candle[] = [];
    for (let i = 0; i < 10; i++) {
      candles.push(candle(T0 + i * 3600, 100 + i, 101 + i, 101.5 + i, 99.5 + i));
    }
    // idx 9 peak: high 110.5
    candles.push(candle(T0 + 10 * 3600, 109, 107, 109.4, 106.6));
    candles.push(candle(T0 + 11 * 3600, 107, 105, 107.4, 104.7));
    candles.push(candle(T0 + 12 * 3600, 105, 106, 106.4, 104.7));
    candles.push(candle(T0 + 13 * 3600, 106, 108, 108.4, 105.6));
    candles.push(candle(T0 + 14 * 3600, 108, 109, 109.4, 107.6));
    candles.push(candle(T0 + 15 * 3600, 109, 109.2, 110.2, 108.8)); // second high 110.2
    candles.push(candle(T0 + 16 * 3600, 109, 107, 109.3, 106.7));
    candles.push(candle(T0 + 17 * 3600, 107, 106, 107.3, 105.7));
    candles.push(candle(T0 + 18 * 3600, 106, 107, 107.4, 105.7));
    candles.push(candle(T0 + 19 * 3600, 107, 113, 113.4, 106.7)); // body close break
    candles.push(candle(T0 + 20 * 3600, 113, 112, 113.3, 110.8)); // retest
    candles.push(candle(T0 + 21 * 3600, 112, 114, 114.3, 111.8)); // bullish confirmation
    candles.push(candle(T0 + 22 * 3600, 114, 115, 115.3, 113.7));
    return candles;
  }

  it('detects break, retest and confirmation of a resistance level', () => {
    const result = breakRetest(trendWithBreak(), {
      tolerancePct: 0.5,
      left: 2,
      right: 2,
      maxWait: 20,
      rr: 3,
    });
    const confirmed = result.events.find((e) => e.status === 'confirmed');
    expect(confirmed).toBeDefined();
    if (confirmed) {
      expect(confirmed.direction).toBe('long');
      expect(confirmed.entry).toBeDefined();
      expect(confirmed.stop).toBeDefined();
      expect(confirmed.target).toBeDefined();
      const risk = (confirmed.entry as number) - (confirmed.stop as number);
      expect(risk).toBeGreaterThan(0);
      expect((confirmed.target as number) - (confirmed.entry as number)).toBeCloseTo(3 * risk, 4);
    }
    expect(result.markers.some((m) => m.text === 'Break')).toBe(true);
    expect(result.markers.some((m) => m.text === 'Confirm')).toBe(true);
    expect(result.zones.length).toBeGreaterThan(0);
  });

  it('marks wick-only breaks as false breaks', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 10; i++) {
      candles.push(candle(T0 + i * 3600, 100 + i, 101 + i, 101.5 + i, 99.5 + i));
    }
    candles.push(candle(T0 + 10 * 3600, 109, 107.5, 109.4, 107));
    candles.push(candle(T0 + 11 * 3600, 107.5, 108, 108.3, 106.8));
    candles.push(candle(T0 + 12 * 3600, 108, 108.5, 112, 107.5)); // wick above, close inside
    candles.push(candle(T0 + 13 * 3600, 108.5, 107, 108.8, 106.5));
    candles.push(candle(T0 + 14 * 3600, 107, 107.5, 107.9, 106.5));
    const result = breakRetest(candles, { tolerancePct: 0.5, left: 2, right: 2 });
    expect(result.markers.some((m) => m.text === 'False break')).toBe(true);
    expect(result.events).toHaveLength(0);
  });
});

describe('patterns', () => {
  it('detects bullish engulfing', () => {
    const candles = [
      candle(T0, 101, 99, 101.5, 98.5),
      candle(T0 + 900, 98.5, 102, 102.5, 98),
      candle(T0 + 1800, 102, 102),
    ];
    const markers = detectPatterns(candles, new Set(['bullish-engulfing']));
    expect(markers.some((m) => m.text === 'Engulf')).toBe(true);
  });

  it('detects hammer, doji and inside bar', () => {
    const candles = [
      candle(T0, 100, 100.5, 101, 99.5),
      candle(T0 + 900, 100.5, 100.6, 101, 95), // hammer
      candle(T0 + 1800, 100.6, 100.62, 100.7, 100.55), // doji
      candle(T0 + 2700, 100.6, 100.61, 100.65, 100.58), // inside bar
    ];
    const markers = detectPatterns(candles, new Set(['hammer', 'doji', 'inside-bar']));
    expect(markers.some((m) => m.text === 'Hammer')).toBe(true);
    expect(markers.some((m) => m.text === 'Doji')).toBe(true);
    expect(markers.some((m) => m.text === 'IB')).toBe(true);
  });
});

describe('pivot points', () => {
  it('computes classic pivots ordered around P', () => {
    const candles: Candle[] = [];
    for (let i = 0; i < 96 * 2; i++) {
      const price = 100 + Math.sin(i / 6) * 5;
      candles.push(candle(T0 + i * 900, price - 0.5, price));
    }
    const levels = pivotPoints(candles, 'classic', 'day');
    expect(levels).not.toBeNull();
    if (levels) {
      expect(levels.r1).toBeGreaterThan(levels.p);
      expect(levels.s1).toBeLessThan(levels.p);
      expect(levels.r2).toBeGreaterThan(levels.r1);
      expect(levels.s2).toBeLessThan(levels.s1);
    }
  });

  it('returns null when no previous period exists', () => {
    const candles = [candle(T0, 100, 101), candle(T0 + 900, 101, 102)];
    expect(pivotPoints(candles, 'classic', 'day')).toBeNull();
  });
});

describe('heikin ashi', () => {
  it('smooths candles while keeping times and count', () => {
    const candles = [
      candle(T0, 100, 104, 105, 99),
      candle(T0 + 900, 104, 102, 106, 101),
      candle(T0 + 1800, 102, 106, 107, 101.5),
    ];
    const ha = heikinAshi(candles);
    expect(ha).toHaveLength(3);
    expect(ha[0].time).toBe(T0);
    expect(ha[0].close).toBeCloseTo((100 + 105 + 99 + 104) / 4, 8);
    expect(ha[1].open).toBeCloseTo(((100 + 104) / 2 + ha[0].close) / 2, 8);
    expect(ha[2].high).toBeGreaterThanOrEqual(ha[2].open);
    expect(ha[2].high).toBeGreaterThanOrEqual(ha[2].close);
  });
});
