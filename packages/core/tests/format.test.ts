import { describe, expect, it } from 'vitest';
import { formatAge, formatCompact, formatPct, formatPrice } from '../src';

describe('format helpers', () => {
  it('formats prices with precision', () => {
    expect(formatPrice(1234.5, 2)).toBe('1,234.50');
    expect(formatPrice(3540.123, 2)).toBe('3,540.12');
    expect(formatPrice(0.123456, 4)).toBe('0.1235');
  });

  it('formats compact volumes', () => {
    expect(formatCompact(1500)).toBe('1.50K');
    expect(formatCompact(2_400_000)).toBe('2.40M');
    expect(formatCompact(1_100_000_000)).toBe('1.10B');
    expect(formatCompact(42)).toBe('42.00');
  });

  it('formats signed percentages', () => {
    expect(formatPct(1.234)).toBe('+1.23%');
    expect(formatPct(-1.234)).toBe('-1.23%');
    expect(formatPct(1.234, false)).toBe('1.23%');
  });

  it('formats ages', () => {
    expect(formatAge(30)).toBe('30s');
    expect(formatAge(65)).toBe('1m 05s');
    expect(formatAge(3700)).toBe('1h 01m');
    expect(formatAge(-5)).toBe('0s');
  });
});
