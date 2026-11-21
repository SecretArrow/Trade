import { describe, expect, it } from 'vitest';
import {
  clamp,
  hashString,
  linearRegression,
  mean,
  median,
  mulberry32,
  pctChange,
  roundTo,
  stdev,
} from '../src';

describe('math helpers', () => {
  it('clamps values', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it('rounds to decimals', () => {
    expect(roundTo(1.2384, 2)).toBe(1.24);
    expect(roundTo(1234, 0)).toBe(1234);
  });

  it('computes percentage change safely', () => {
    expect(pctChange(100, 110)).toBe(10);
    expect(pctChange(110, 100)).toBeCloseTo(-9.0909, 3);
    expect(pctChange(0, 5)).toBe(0);
  });

  it('computes mean, stdev and median', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(stdev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(mean([])).toBe(0);
    expect(stdev([])).toBe(0);
    expect(median([])).toBe(0);
  });

  it('fits a line with least squares', () => {
    const r = linearRegression([1, 3, 5, 7]);
    expect(r.slope).toBeCloseTo(2, 6);
    expect(r.intercept).toBeCloseTo(1, 6);
  });

  it('handles degenerate regression input', () => {
    expect(linearRegression([])).toEqual({ slope: 0, intercept: 0 });
    expect(linearRegression([5])).toEqual({ slope: 0, intercept: 5 });
  });
});

describe('deterministic randomness', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(42);
    const c = mulberry32(43);
    const seqA = [a(), a(), a()];
    const seqC = [c(), c(), c()];
    expect(seqA).not.toEqual(seqC);
  });

  it('stays within [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hashes strings stably', () => {
    expect(hashString('btc-usdt')).toBe(hashString('btc-usdt'));
    expect(hashString('btc-usdt')).not.toBe(hashString('btc-usdu'));
  });
});
