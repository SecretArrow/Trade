import type { Candle, Ticker, Timeframe } from '@trade/core';
import type { ProviderAdapter, SymbolMapping } from './types';
import { getJson } from './net';
import { normalizeCandles } from './normalizers';
import { ReconnectingWs } from './ws';

const BASE = 'https://api.bybit.com';
const WS_BASE = 'wss://stream.bybit.com/v5/public';

const TF: Record<Timeframe, string> = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '2h': '120',
  '4h': '240',
  '6h': '360',
  '12h': '720',
  '1D': 'D',
  '1W': 'W',
  '1M': 'M',
};

const SYMBOLS: Record<string, SymbolMapping> = {
  'BTC/USDT': { native: 'BTCUSDT', channel: 'linear' },
  'XAU/USD': {
    native: 'XAUUSDT',
    channel: 'linear',
    proxy: true,
    note: 'XAU/USDT perpetual proxy for spot gold',
  },
  'XAUT/USDT': { native: 'XAUTUSDT', channel: 'spot' },
};

export type BybitKlineRow = [number, string, string, string, string, string, string];

export function mapBybitKlines(rows: BybitKlineRow[]): Candle[] {
  // Bybit returns newest-first; normalizeCandles sorts ascending.
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

interface BybitWsKline {
  topic?: string;
  data?: {
    start: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    confirm: boolean;
  }[];
}

export function createBybitProvider(): ProviderAdapter {
  return {
    id: 'bybit',
    name: 'Bybit',
    isProxyInstrument: (symbol) => SYMBOLS[symbol]?.proxy === true,
    instrumentLabel: (symbol) => {
      const m = SYMBOLS[symbol];
      return m?.note ?? m?.native ?? symbol;
    },
    supports: (symbol) => symbol in SYMBOLS,
    capabilities: (symbol) => ({
      timeframes: Object.keys(TF) as Timeframe[],
      ws: true,
      historyDepth: 1000,
      ...(symbol === 'XAU/USD' ? { polling: false } : {}),
    }),
    async getCandles(req) {
      const m = SYMBOLS[req.symbol];
      if (!m) throw new Error(`Bybit does not list ${req.symbol}`);
      const params = new URLSearchParams({
        category: m.channel ?? 'linear',
        symbol: m.native,
        interval: TF[req.timeframe],
        limit: String(Math.min(req.limit ?? 500, 1000)),
      });
      const res = await getJson<{
        retCode: number;
        retMsg: string;
        result: { list: BybitKlineRow[] };
      }>(`${BASE}/v5/market/kline?${params}`);
      if (res.retCode !== 0) throw new Error(`Bybit error: ${res.retMsg}`);
      return mapBybitKlines(res.result.list);
    },
    subscribe(symbol, timeframe, onTick, onStatus) {
      const m = SYMBOLS[symbol];
      if (!m) return () => undefined;
      const ws = new ReconnectingWs({
        url: `${WS_BASE}/${m.channel ?? 'linear'}`,
        onMessage: (raw) => {
          const msg = raw as BybitWsKline;
          for (const k of msg.data ?? []) {
            onTick(
              {
                time: Math.floor(k.start / 1000),
                open: Number.parseFloat(k.open),
                high: Number.parseFloat(k.high),
                low: Number.parseFloat(k.low),
                close: Number.parseFloat(k.close),
                volume: Number.parseFloat(k.volume),
              },
              k.confirm,
            );
          }
          if (msg.data?.length) onStatus('live');
        },
        onStatus: (s) =>
          onStatus(s === 'open' ? 'live' : s === 'connecting' ? 'loading' : 'offline'),
        pingPayload: () => JSON.stringify({ op: 'ping' }),
        pingIntervalMs: 20_000,
      });
      ws.connect();
      ws.send(JSON.stringify({ op: 'subscribe', args: [`kline.${TF[timeframe]}.${m.native}`] }));
      return () => ws.close();
    },
    async getTicker(symbol): Promise<Ticker> {
      const m = SYMBOLS[symbol];
      if (!m) throw new Error(`Bybit does not list ${symbol}`);
      const res = await getJson<{
        retCode: number;
        result: {
          list: {
            lastPrice: string;
            price24hPcnt: string;
            highPrice24h: string;
            lowPrice24h: string;
          }[];
        };
      }>(`${BASE}/v5/market/tickers?category=${m.channel ?? 'linear'}&symbol=${m.native}`, {
        cacheTtlMs: 4000,
      });
      const t = res.result.list[0];
      if (!t) throw new Error('Bybit ticker unavailable');
      return {
        symbol,
        last: Number.parseFloat(t.lastPrice),
        changePct24h: Number.parseFloat(t.price24hPcnt) * 100,
        high24h: Number.parseFloat(t.highPrice24h),
        low24h: Number.parseFloat(t.lowPrice24h),
        ts: Date.now() / 1000,
      };
    },
    async getServerTime() {
      const res = await getJson<{ result: { timeServer: string } }>(`${BASE}/v5/market/time`);
      return Number.parseFloat(res.result.timeServer) / 1000;
    },
  };
}
