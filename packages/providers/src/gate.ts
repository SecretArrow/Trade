import type { Candle, Ticker, Timeframe } from '@trade/core';
import type { ProviderAdapter, SymbolMapping } from './types';
import { getJson } from './net';
import { normalizeCandles } from './normalizers';
import { ReconnectingWs } from './ws';

const BASE = 'https://api.gateio.ws';
const WS_URL = 'wss://api.gateio.ws/ws/v4/';

const TF: Partial<Record<Timeframe, string>> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1D': '1d',
  '1W': '7d',
  '1M': '30d',
};

const SYMBOLS: Record<string, SymbolMapping> = {
  'BTC/USDT': { native: 'BTC_USDT' },
  'XAUT/USDT': { native: 'XAUT_USDT' },
};

// [timestamp(s), quote volume, close, high, low, open, base volume, closed]
export type GateCandleRow = [string, string, string, string, string, string, string, string];

export function mapGateCandles(rows: GateCandleRow[]): Candle[] {
  return normalizeCandles(
    rows.map((r) => ({
      time: Number.parseInt(r[0], 10),
      open: Number.parseFloat(r[5]),
      high: Number.parseFloat(r[4]),
      low: Number.parseFloat(r[3]),
      close: Number.parseFloat(r[2]),
      volume: Number.parseFloat(r[6]),
    })),
  );
}

interface GateWsMessage {
  channel?: string;
  event?: string;
  result?: {
    t: number;
    o: string;
    h: string;
    l: string;
    c: string;
    v: string;
  };
}

export function createGateProvider(): ProviderAdapter {
  const timeframes = Object.keys(TF) as Timeframe[];
  return {
    id: 'gate',
    name: 'Gate.io',
    isProxyInstrument: () => false,
    instrumentLabel: (symbol) => SYMBOLS[symbol]?.native ?? symbol,
    supports: (symbol) => symbol in SYMBOLS,
    capabilities: () => ({
      timeframes,
      ws: true,
      historyDepth: 1000,
    }),
    async getCandles(req) {
      const m = SYMBOLS[req.symbol];
      const interval = TF[req.timeframe];
      if (!m || !interval)
        throw new Error(`Gate.io does not support ${req.symbol} ${req.timeframe}`);
      const params = new URLSearchParams({
        currency_pair: m.native,
        interval,
        limit: String(Math.min(req.limit ?? 500, 1000)),
      });
      if (req.from) params.set('from', String(req.from));
      if (req.to) params.set('to', String(req.to));
      const rows = await getJson<GateCandleRow[]>(`${BASE}/api/v4/spot/candlesticks?${params}`);
      return mapGateCandles(rows);
    },
    subscribe(symbol, timeframe, onTick, onStatus) {
      const m = SYMBOLS[symbol];
      const interval = TF[timeframe];
      if (!m || !interval) return () => undefined;
      const ws = new ReconnectingWs({
        url: WS_URL,
        onMessage: (raw) => {
          const msg = raw as GateWsMessage;
          if (msg.channel !== 'spot.candlesticks' || !msg.result) return;
          const r = msg.result;
          onTick(
            {
              time: r.t,
              open: Number.parseFloat(r.o),
              high: Number.parseFloat(r.h),
              low: Number.parseFloat(r.l),
              close: Number.parseFloat(r.c),
              volume: Number.parseFloat(r.v),
            },
            false,
          );
          onStatus('live');
        },
        onStatus: (s) =>
          onStatus(s === 'open' ? 'live' : s === 'connecting' ? 'loading' : 'offline'),
        pingPayload: () =>
          JSON.stringify({ time: Math.floor(Date.now() / 1000), channel: 'spot.ping' }),
        pingIntervalMs: 25_000,
      });
      ws.connect();
      ws.send(
        JSON.stringify({
          time: Math.floor(Date.now() / 1000),
          channel: 'spot.candlesticks',
          event: 'subscribe',
          payload: [m.native, interval],
        }),
      );
      return () => ws.close();
    },
    async getTicker(symbol): Promise<Ticker> {
      const m = SYMBOLS[symbol];
      if (!m) throw new Error(`Gate.io does not list ${symbol}`);
      const rows = await getJson<
        { last: string; change_percentage: string; high_24h: string; low_24h: string }[]
      >(`${BASE}/api/v4/spot/tickers?currency_pair=${m.native}`, { cacheTtlMs: 4000 });
      const t = rows[0];
      if (!t) throw new Error('Gate.io ticker unavailable');
      return {
        symbol,
        last: Number.parseFloat(t.last),
        changePct24h: Number.parseFloat(t.change_percentage),
        high24h: Number.parseFloat(t.high_24h),
        low24h: Number.parseFloat(t.low_24h),
        ts: Date.now() / 1000,
      };
    },
    async getServerTime() {
      const t = await getJson<{ server_time: number }>(`${BASE}/api/v4/spot/time`);
      return t.server_time;
    },
  };
}
