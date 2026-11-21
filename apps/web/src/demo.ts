import { alignTime, getSymbol, hashString, mulberry32, roundTo, tfToSeconds } from '@trade/core';
import type { Candle, Timeframe } from '@trade/core';

const VOLATILITY: Record<string, number> = {
  crypto: 0.004,
  'spot-gold': 0.0015,
  'tokenized-gold': 0.0016,
};

/**
 * Deterministic synthetic candle generator used by the offline demo data
 * source and by the e2e test suite. The same (symbol, timeframe) pair always
 * produces the same price sequence.
 */
export function generateDemoCandles(symbolId: string, tf: Timeframe, count = 500): Candle[] {
  const info = getSymbol(symbolId);
  const rand = mulberry32((info.demoSeed ^ hashString(tf)) >>> 0);
  const step = tfToSeconds(tf);
  const vol = VOLATILITY[info.kind] ?? 0.003;

  const lastOpen = alignTime(Math.floor(Date.now() / 1000), tf);
  const candles: Candle[] = [];
  let price = info.basePrice;
  let drift = 0;

  for (let i = 0; i < count; i++) {
    const time = lastOpen - (count - 1 - i) * step;
    if (i % 40 === 0) {
      drift = (rand() - 0.5) * vol * 0.6;
    }
    const open = price;
    const ret = drift + (rand() - 0.5) * 2 * vol;
    const close = open * (1 + ret);
    const wickUp = Math.max(open, close) * (1 + rand() * vol * 0.8);
    const wickDown = Math.min(open, close) * (1 - rand() * vol * 0.8);
    const volume = Math.round((0.4 + rand()) * 1000 * 100) / 100;
    candles.push({
      time,
      open: roundTo(open, info.pricePrecision),
      high: roundTo(Math.max(wickUp, open, close), info.pricePrecision),
      low: roundTo(Math.min(wickDown, open, close), info.pricePrecision),
      close: roundTo(close, info.pricePrecision),
      volume,
    });
    price = roundTo(close, info.pricePrecision);
  }
  return candles;
}
