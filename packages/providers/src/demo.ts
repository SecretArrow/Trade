import { alignTime, getSymbol, hashString, mulberry32, roundTo, tfToSeconds } from '@trade/core';
import type { Candle, Ticker, Timeframe } from '@trade/core';
import type { ProviderAdapter } from './types';
import { normalizeCandles } from './normalizers';

const VOLATILITY: Record<string, number> = {
  crypto: 0.004,
  'spot-gold': 0.0015,
  'tokenized-gold': 0.0016,
};

/**
 * Deterministic synthetic candles. The same (symbol, timeframe, length)
 * always produces the identical price path, which keeps e2e tests stable.
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
    if (i % 40 === 0) drift = (rand() - 0.5) * vol * 0.6;
    const open = price;
    const close = open * (1 + drift + (rand() - 0.5) * 2 * vol);
    const high = Math.max(open, close) * (1 + rand() * vol * 0.8);
    const low = Math.min(open, close) * (1 - rand() * vol * 0.8);
    candles.push({
      time,
      open: roundTo(open, info.pricePrecision),
      high: roundTo(high, info.pricePrecision),
      low: roundTo(low, info.pricePrecision),
      close: roundTo(close, info.pricePrecision),
      volume: Math.round((0.4 + rand()) * 100000) / 100,
    });
    price = roundTo(close, info.pricePrecision);
  }
  return candles;
}

/** Simulated live feed: mutates the forming candle, rolls over on schedule. */
export function createDemoProvider(): ProviderAdapter {
  return {
    id: 'demo',
    name: 'Demo (synthetic)',
    isProxyInstrument: () => false,
    instrumentLabel: (symbol) => `${symbol} — synthetic data`,
    supports: () => true,
    capabilities: () => ({
      timeframes: ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1D', '1W', '1M'],
      ws: false,
      polling: true,
      historyDepth: 5000,
    }),
    async getCandles(req) {
      return normalizeCandles(generateDemoCandles(req.symbol, req.timeframe, req.limit ?? 500));
    },
    subscribe(symbol, timeframe, onTick, onStatus) {
      const info = getSymbol(symbol);
      const step = tfToSeconds(timeframe);
      const rand = mulberry32((info.demoSeed ^ hashString(`${timeframe}-live`)) >>> 0);
      let series = generateDemoCandles(symbol, timeframe, 200);
      let forming: Candle = { ...series[series.length - 1] };
      const tick = () => {
        const nowBucket = alignTime(Math.floor(Date.now() / 1000), timeframe);
        if (nowBucket > forming.time) {
          // roll over: close the forming candle and open a new one
          onTick(forming, true);
          const vol = VOLATILITY[info.kind] ?? 0.003;
          const open = forming.close;
          const close = open * (1 + (rand() - 0.5) * 2 * vol);
          forming = {
            time: nowBucket,
            open: roundTo(open, info.pricePrecision),
            high: roundTo(Math.max(open, close), info.pricePrecision),
            low: roundTo(Math.min(open, close), info.pricePrecision),
            close: roundTo(close, info.pricePrecision),
            volume: Math.round((0.4 + rand()) * 100000) / 100,
          };
        } else {
          const vol = VOLATILITY[info.kind] ?? 0.003;
          const close = forming.close * (1 + (rand() - 0.5) * vol);
          forming = {
            ...forming,
            close: roundTo(close, info.pricePrecision),
            high: roundTo(Math.max(forming.high, close), info.pricePrecision),
            low: roundTo(Math.min(forming.low, close), info.pricePrecision),
            volume: Math.round((forming.volume + rand() * 500) * 100) / 100,
          };
        }
        series = [...series.slice(-499), forming];
        onTick(forming, false);
        onStatus('live');
      };
      tick();
      const timer = setInterval(tick, 2000);
      return () => clearInterval(timer);
    },
    async getTicker(symbol): Promise<Ticker> {
      const series = generateDemoCandles(symbol, '15m', 2);
      const last = series[series.length - 1];
      const prev = series[0];
      return {
        symbol,
        last: last.close,
        changePct24h: ((last.close - prev.open) / prev.open) * 100,
        high24h: last.high,
        low24h: last.low,
        ts: Date.now() / 1000,
      };
    },
    async getServerTime() {
      return Date.now() / 1000;
    },
  };
}
