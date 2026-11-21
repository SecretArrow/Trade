import type { Candle, Ticker, Timeframe } from '@trade/core';
import type { ProviderAdapter, SymbolMapping } from './types';
import { getJson } from './net';
import { normalizeCandles } from './normalizers';
import { pollForCandles } from './polling';

const BASE = 'https://api.exchange.coinbase.com';

const TF_SECONDS: Partial<Record<Timeframe, number>> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '6h': 21600,
  '1D': 86400,
};

const SYMBOLS: Record<string, SymbolMapping> = {
  'BTC/USDT': { native: 'BTC-USD', note: 'BTC/USD (USD quote, not USDT)' },
};

export type CoinbaseCandleRow = [number, number, number, number, number, number];

export function mapCoinbaseCandles(rows: CoinbaseCandleRow[]): Candle[] {
  // Coinbase returns [time, low, high, open, close, volume], newest first.
  return normalizeCandles(
    rows.map((r) => ({
      time: r[0],
      low: r[1],
      high: r[2],
      open: r[3],
      close: r[4],
      volume: r[5],
    })),
  );
}

export function createCoinbaseProvider(): ProviderAdapter {
  const timeframes = Object.keys(TF_SECONDS) as Timeframe[];
  return {
    id: 'coinbase',
    name: 'Coinbase',
    isProxyInstrument: () => false,
    instrumentLabel: (symbol) => SYMBOLS[symbol]?.note ?? SYMBOLS[symbol]?.native ?? symbol,
    supports: (symbol) => symbol in SYMBOLS,
    capabilities: () => ({
      timeframes,
      ws: false,
      polling: true,
      historyDepth: 300,
    }),
    async getCandles(req) {
      const m = SYMBOLS[req.symbol];
      const granularity = TF_SECONDS[req.timeframe];
      if (!m || !granularity)
        throw new Error(`Coinbase does not support ${req.symbol} ${req.timeframe}`);
      const rows = await getJson<CoinbaseCandleRow[]>(
        `${BASE}/products/${m.native}/candles?granularity=${granularity}`,
      );
      return mapCoinbaseCandles(rows);
    },
    subscribe(symbol, timeframe, onTick, onStatus) {
      const adapter = this;
      return pollForCandles(
        () => adapter.getCandles({ symbol, timeframe, limit: 10 }, {}),
        onTick,
        onStatus,
        10_000,
      );
    },
    async getTicker(symbol): Promise<Ticker> {
      const m = SYMBOLS[symbol];
      if (!m) throw new Error(`Coinbase does not list ${symbol}`);
      const t = await getJson<{ last: string; open: string; high: string; low: string }>(
        `${BASE}/products/${m.native}/stats`,
        { cacheTtlMs: 4000 },
      );
      const last = Number.parseFloat(t.last);
      const open = Number.parseFloat(t.open);
      return {
        symbol,
        last,
        changePct24h: open === 0 ? undefined : ((last - open) / open) * 100,
        high24h: Number.parseFloat(t.high),
        low24h: Number.parseFloat(t.low),
        ts: Date.now() / 1000,
      };
    },
    async getServerTime() {
      const t = await getJson<{ epoch?: number; iso?: string }>(`${BASE}/time`);
      if (typeof t.epoch === 'number') return Math.round(t.epoch);
      if (t.iso) return Date.parse(t.iso) / 1000;
      return Date.now() / 1000;
    },
  };
}
