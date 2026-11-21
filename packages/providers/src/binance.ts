import type { Candle, Ticker, Timeframe } from '@trade/core';
import type { ProviderAdapter, ProviderSettings, SymbolMapping } from './types';
import { getJson } from './net';
import { normalizeCandles } from './normalizers';
import { ReconnectingWs } from './ws';

const BASE = 'https://api.binance.com';
const WS_BASE = 'wss://stream.binance.com:9443/ws';

const TF: Record<Timeframe, string> = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '6h': '6h',
  '12h': '12h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1M',
};

const SYMBOLS: Record<string, SymbolMapping> = {
  'BTC/USDT': { native: 'BTCUSDT' },
  'XAU/USD': { native: 'PAXGUSDT', proxy: true, note: 'PAXG (tokenized gold) proxy for spot gold' },
  'XAUT/USDT': { native: 'XAUTUSDT' },
};

export type BinanceKlineRow = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  ...unknown[],
];

export function mapBinanceKlines(rows: BinanceKlineRow[]): Candle[] {
  return normalizeCandles(
    rows.map((r) => ({
      time: Math.floor(r[0] / 1000),
      open: Number.parseFloat(r[1]),
      high: Number.parseFloat(r[2]),
      low: Number.parseFloat(r[3]),
      close: Number.parseFloat(r[4]),
      volume: Number.parseFloat(r[5]),
    })),
  );
}

interface BinanceKlineWs {
  k?: {
    t: number;
    o: string;
    h: string;
    l: string;
    c: string;
    v: string;
    x: boolean;
  };
}

export function createBinanceProvider(): ProviderAdapter {
  return {
    id: 'binance',
    name: 'Binance',
    isProxyInstrument: (symbol) => SYMBOLS[symbol]?.proxy === true,
    instrumentLabel: (symbol) => {
      const m = SYMBOLS[symbol];
      return m?.note ?? m?.native ?? symbol;
    },
    supports: (symbol) => symbol in SYMBOLS,
    capabilities: () => ({
      timeframes: Object.keys(TF) as Timeframe[],
      ws: true,
      historyDepth: 1000,
    }),
    async getCandles(req) {
      const m = SYMBOLS[req.symbol];
      if (!m) throw new Error(`Binance does not list ${req.symbol}`);
      const params = new URLSearchParams({
        symbol: m.native,
        interval: TF[req.timeframe],
        limit: String(Math.min(req.limit ?? 500, 1000)),
      });
      if (req.from) params.set('startTime', String(req.from * 1000));
      if (req.to) params.set('endTime', String(req.to * 1000));
      const rows = await getJson<BinanceKlineRow[]>(`${BASE}/api/v3/klines?${params}`);
      return mapBinanceKlines(rows);
    },
    subscribe(symbol, timeframe, onTick, onStatus) {
      const m = SYMBOLS[symbol];
      if (!m) return () => undefined;
      const stream = `${m.native.toLowerCase()}@kline_${TF[timeframe]}`;
      const ws = new ReconnectingWs({
        url: `${WS_BASE}/${stream}`,
        onMessage: (raw) => {
          const msg = raw as BinanceKlineWs;
          if (!msg.k) return;
          onTick(
            {
              time: Math.floor(msg.k.t / 1000),
              open: Number.parseFloat(msg.k.o),
              high: Number.parseFloat(msg.k.h),
              low: Number.parseFloat(msg.k.l),
              close: Number.parseFloat(msg.k.c),
              volume: Number.parseFloat(msg.k.v),
            },
            msg.k.x,
          );
          onStatus('live');
        },
        onStatus: (s) =>
          onStatus(s === 'open' ? 'live' : s === 'connecting' ? 'loading' : 'offline'),
      });
      ws.connect();
      return () => ws.close();
    },
    async getTicker(symbol): Promise<Ticker> {
      const m = SYMBOLS[symbol];
      if (!m) throw new Error(`Binance does not list ${symbol}`);
      const t = await getJson<{
        lastPrice: string;
        priceChangePercent: string;
        highPrice: string;
        lowPrice: string;
      }>(`${BASE}/api/v3/ticker/24hr?symbol=${m.native}`, { cacheTtlMs: 4000 });
      return {
        symbol,
        last: Number.parseFloat(t.lastPrice),
        changePct24h: Number.parseFloat(t.priceChangePercent),
        high24h: Number.parseFloat(t.highPrice),
        low24h: Number.parseFloat(t.lowPrice),
        ts: Date.now() / 1000,
      };
    },
    async getServerTime() {
      const t = await getJson<{ serverTime: number }>(`${BASE}/api/v3/time`);
      return t.serverTime / 1000;
    },
  };
}
