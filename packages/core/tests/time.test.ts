import { describe, expect, it } from 'vitest';
import {
  alignTime,
  candlesBetween,
  formatDate,
  formatTime,
  nextCandleTime,
  resampleCandles,
  tfToSeconds,
} from '../src';
import type { Candle } from '../src';

describe('tfToSeconds', () => {
  it('maps all timeframes', () => {
    expect(tfToSeconds('1m')).toBe(60);
    expect(tfToSeconds('3m')).toBe(180);
    expect(tfToSeconds('15m')).toBe(900);
    expect(tfToSeconds('12h')).toBe(43200);
    expect(tfToSeconds('1D')).toBe(86400);
    expect(tfToSeconds('1W')).toBe(604800);
  });
});

describe('alignTime', () => {
  it('aligns intraday timeframes', () => {
    expect(alignTime(3661, '1h')).toBe(3600);
    expect(alignTime(3661, '15m')).toBe(3600);
    expect(alignTime(3610, '5m')).toBe(3600);
    expect(alignTime(3601, '1m')).toBe(3600);
    expect(alignTime(7200, '2h')).toBe(7200);
  });

  it('aligns to UTC midnight for 1D', () => {
    // 2024-01-15 13:45 UTC
    expect(alignTime(1705326300, '1D')).toBe(1705276800);
  });

  it('aligns to Monday for 1W', () => {
    // 2024-01-17 is a Wednesday; Monday is 2024-01-15 00:00 UTC
    expect(alignTime(1705497600, '1W')).toBe(1705276800);
  });

  it('keeps Sunday inside the previous week', () => {
    // 2024-01-14 is a Sunday; its week starts Monday 2024-01-08 00:00 UTC
    expect(alignTime(1705200000, '1W')).toBe(1704672000);
  });

  it('aligns to first of month for 1M', () => {
    expect(alignTime(1705326300, '1M')).toBe(1704067200);
  });
});

describe('nextCandleTime', () => {
  it('advances intraday candles', () => {
    expect(nextCandleTime(3601, '1h')).toBe(7200);
    expect(nextCandleTime(3601, '15m')).toBe(4500);
  });

  it('advances weeks and months on the calendar', () => {
    expect(nextCandleTime(1705276800, '1W')).toBe(1705881600);
    // 2024-01 -> 2024-02-01 00:00 UTC
    expect(nextCandleTime(1704067200, '1M')).toBe(1706745600);
  });
});

describe('resampleCandles', () => {
  const base: Candle[] = [
    { time: 0, open: 100, high: 110, low: 95, close: 105, volume: 10 },
    { time: 300, open: 105, high: 120, low: 104, close: 118, volume: 15 },
    { time: 600, open: 118, high: 125, low: 100, close: 102, volume: 20 },
    { time: 900, open: 102, high: 108, low: 90, close: 95, volume: 12 },
  ];

  it('aggregates 5m candles into 15m candles', () => {
    const out = resampleCandles(base, '15m');
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      time: 0,
      open: 100,
      high: 120,
      low: 95,
      close: 102,
      volume: 45,
    });
    expect(out[1]).toEqual({ time: 900, open: 102, high: 108, low: 90, close: 95, volume: 12 });
  });

  it('aggregates into daily candles', () => {
    const day1 = 1704067200; // 2024-01-01
    const candles: Candle[] = [
      { time: day1 + 3600, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 },
      { time: day1 + 7200, open: 1.5, high: 3, low: 1.4, close: 2.5, volume: 2 },
      { time: day1 + 86400 + 60, open: 2.5, high: 4, low: 2.4, close: 3.5, volume: 3 },
    ];
    const out = resampleCandles(candles, '1D');
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ time: day1, open: 1, high: 3, low: 0.5, close: 2.5, volume: 3 });
    expect(out[1]).toEqual({
      time: day1 + 86400,
      open: 2.5,
      high: 4,
      low: 2.4,
      close: 3.5,
      volume: 3,
    });
  });

  it('returns empty for empty input', () => {
    expect(resampleCandles([], '1h')).toEqual([]);
  });
});

describe('candlesBetween', () => {
  it('counts candles in a window', () => {
    expect(candlesBetween(0, 3600, '1m')).toBe(60);
    expect(candlesBetween(0, 7200, '1h')).toBe(2);
    expect(candlesBetween(0, 1, '1D')).toBe(0);
  });

  it('counts calendar months', () => {
    expect(candlesBetween(1704067200, 1706745600, '1M')).toBe(1);
  });
});

describe('time formatting', () => {
  it('formats UTC date and time', () => {
    expect(formatTime(1704067200)).toBe('2024-01-01 00:00');
    expect(formatTime(1705326300)).toBe('2024-01-15 13:45');
    expect(formatTime(1705326300, false)).toBe('13:45');
    expect(formatDate(1705326300)).toBe('2024-01-15');
  });
});
