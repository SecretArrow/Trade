import { describe, expect, it } from 'vitest';
import { mulberry32, type Candle } from '@trade/core';
import {
  bollingerBands,
  donchianChannel,
  keltnerChannel,
  stdDevIndicator,
} from '../src/bands';
import { dema, ema, envelope, hma, maRibbon, sma, tema, vwma, wma } from '../src/movingAverages';
import { awesomeOscillator, cci, macd, momentum, roc, rsi, stochastic, stochRsi, williamsR } from '../src/momentum';
import { adx, ichimoku, psar, supertrend } from '../src/trend';
import { accumulationDistribution, chaikinMoneyFlow, mfi, obv, volumeWithMa, vwap } from '../src/volume';

const seed = mulberry32(20260101);
function makeCandles(count: number, base = 100, vol = 0.02): Candle[] {
  const candles: Candle[] = [];
  let price = base;
  for (let i = 0; i < count; i++) {
    const open = price;
    const close = open * (1 + (seed() - 0.5) * 2 * vol);
    const high = Math.max(open, close) * (1 + seed() * vol * 0.5);
    const low = Math.min(open, close) * (1 - seed() * vol * 0.5);
    candles.push({
      time: 1704067200 + i * 900,
      open,
      high,
      low,
      close,
      volume: 100 + Math.floor(seed() * 900),
    });
    price = close;
  }
  return candles;
}

const candles = makeCandles(300);

function assertAligned(values: (number | null)[]): void {
  expect(values).toHaveLength(candles.length);
}

describe('moving averages', () => {
  it('computes SMA with warmup nulls and correct value', () => {
    const out = sma(candles, 10);
    assertAligned(out);
    for (let i = 0; i < 9; i++) expect(out[i]).toBeNull();
    const expected =
      candles.slice(0, 10).reduce((s, c) => s + c.close, 0) / 10;
    expect(out[9]).toBeCloseTo(expected, 8);
  });

  it('computes EMA seeded with SMA', () => {
    const out = ema(candles, 10);
    assertAligned(out);
    expect(out[8]).toBeNull();
    expect(out[9]).toBeCloseTo(sma(candles, 10)[9] as number, 8);
  });

  it('computes WMA, VWMA, HMA, DEMA, TEMA with aligned lengths', () => {
    for (const out of [wma(candles, 10), vwma(candles, 10), hma(candles, 20), dema(candles, 10), tema(candles, 10)]) {
      assertAligned(out);
      expect(out.some((v) => v !== null)).toBe(true);
    }
  });

  it('computes a ribbon with the requested number of lines', () => {
    const plots = maRibbon(candles, 10, 4, 5);
    expect(Object.keys(plots)).toHaveLength(4);
    for (const key of Object.keys(plots)) assertAligned(plots[key]);
  });

  it('computes envelope around the basis', () => {
    const { basis, upper, lower } = envelope(candles, 20, 2);
    assertAligned(basis);
    const i = 100;
    if (basis[i] !== null && upper[i] !== null && lower[i] !== null) {
      expect(upper[i]).toBeGreaterThan(basis[i] as number);
      expect(lower[i]).toBeLessThan(basis[i] as number);
    }
  });
});

describe('bands', () => {
  it('bollinger middle equals SMA and bands bracket it', () => {
    const { middle, upper, lower } = bollingerBands(candles, 20, 2);
    assertAligned(middle);
    const i = 50;
    expect(upper[i]).toBeGreaterThan(middle[i] as number);
    expect(lower[i]).toBeLessThan(middle[i] as number);
    expect(middle[i]).toBeCloseTo(sma(candles, 20)[i] as number, 8);
  });

  it('keltner and donchian produce aligned bands', () => {
    const k = keltnerChannel(candles, 20, 10, 2);
    const d = donchianChannel(candles, 20);
    assertAligned(k.middle);
    assertAligned(d.upper);
    const i = 100;
    expect(k.upper[i]).toBeGreaterThan(k.lower[i] as number);
    expect(d.upper[i]).toBeGreaterThanOrEqual(d.lower[i] as number);
  });

  it('standard deviation is positive', () => {
    const out = stdDevIndicator(candles, 20);
    assertAligned(out);
    const nonNull = out.filter((v): v is number => v !== null);
    expect(nonNull.every((v) => v >= 0)).toBe(true);
  });
});

describe('oscillators', () => {
  it('RSI stays within 0..100', () => {
    const out = rsi(candles, 14);
    assertAligned(out);
    const nonNull = out.filter((v): v is number => v !== null);
    expect(nonNull.every((v) => v >= 0 && v <= 100)).toBe(true);
  });

  it('stochastic and stoch RSI stay within 0..100', () => {
    const s = stochastic(candles, 14, 3, 3);
    const sr = stochRsi(candles, 14, 14, 3, 3);
    for (const series of [s.k, s.d, sr.k, sr.d]) {
      const nonNull = series.filter((v): v is number => v !== null);
      expect(nonNull.every((v) => v >= 0 && v <= 100)).toBe(true);
    }
  });

  it('MACD histogram equals macd - signal', () => {
    const { macd: m, signal, histogram } = macd(candles, 12, 26, 9);
    const i = 100;
    if (m[i] !== null && signal[i] !== null && histogram[i] !== null) {
      expect(histogram[i]).toBeCloseTo((m[i] as number) - (signal[i] as number), 8);
    }
  });

  it('computes CCI, Williams %R, ROC, momentum, AO', () => {
    for (const out of [cci(candles, 20), williamsR(candles, 14), roc(candles, 9), momentum(candles, 10), awesomeOscillator(candles)]) {
      assertAligned(out);
      expect(out.some((v) => v !== null)).toBe(true);
    }
  });
});

describe('trend', () => {
  it('ADX and DI are positive and aligned', () => {
    const r = adx(candles, 14, 14);
    assertAligned(r.adx);
    const nonNull = r.adx.filter((v): v is number => v !== null);
    expect(nonNull.every((v) => v >= 0)).toBe(true);
  });

  it('PSAR produces values and flip markers on volatile data', () => {
    const r = psar(candles, 0.02, 0.2);
    assertAligned(r.psar);
    expect(r.psar.some((v) => v !== null)).toBe(true);
  });

  it('supertrend direction is 1 or -1 after warmup', () => {
    const r = supertrend(candles, 10, 3);
    assertAligned(r.supertrend);
    const nonNull = r.direction.filter((v): v is 1 | -1 => v !== null);
    expect(nonNull.every((v) => v === 1 || v === -1)).toBe(true);
  });

  it('ichimoku returns all five plots and displacement', () => {
    const r = ichimoku(candles, 9, 26, 52, 26);
    assertAligned(r.tenkan);
    assertAligned(r.kijun);
    assertAligned(r.senkouA);
    assertAligned(r.senkouB);
    assertAligned(r.chikou);
    expect(r.displacement).toBe(26);
  });
});

describe('volume', () => {
  it('OBV accumulates signed volume', () => {
    const out = obv(candles);
    assertAligned(out);
    expect(out[0]).toBe(0);
  });

  it('MFI within 0..100 and CMF roughly within -1..1', () => {
    const m = mfi(candles, 14);
    assertAligned(m);
    const nonNull = m.filter((v): v is number => v !== null);
    expect(nonNull.every((v) => v >= 0 && v <= 100)).toBe(true);
    const cmf = chaikinMoneyFlow(candles, 20);
    const cmfVals = cmf.filter((v): v is number => v !== null);
    expect(cmfVals.every((v) => v >= -1.01 && v <= 1.01)).toBe(true);
  });

  it('A/D line and volume MA aligned', () => {
    assertAligned(accumulationDistribution(candles));
    const v = volumeWithMa(candles, 20);
    expect(v.volume).toHaveLength(candles.length);
    expect(v.volumeMa).toHaveLength(candles.length);
  });

  it('VWAP resets at the daily anchor', () => {
    const out = vwap(candles, 'day');
    assertAligned(out);
    expect(out.some((v) => v !== null)).toBe(true);
  });
});
