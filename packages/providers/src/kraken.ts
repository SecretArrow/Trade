import type { Candle, Ticker, Timeframe } from '@trade/core';
import type { ProviderAdapter, SymbolMapping } from './types';
import { getJson } from './net';
import { normalizeCandles } from './normalizers';
import { ReconnectingWs } from './ws';

const BASE = 'https://api.kraken.com';
const WS_URL = 'wss://ws.kraken.com/v2';

const TF_MINUTES: Partial<Record<Timeframe, number>> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
  '4h': 240,
  '1D': 1440,
  '1W': 10080,
  '1M': 21600,
};

const SYMBOLS: Record<string, SymbolMapping> = {
  'BTC/USDT': { native: 'XBTUSDT', channel: 'BTC/USDT' },
  'XAUT/USDT': { native: 'XAUTUSD', channel: 'XAUT/USD', note: 'XAUT/USD (USD quote, not USDT)' },
};

export type KrakenOhlcRow = [number, string, string, string, string, string, string, number];

export function mapKrakenOhlc(rows: KrakenOhlcRow[]): Candle[] {
  return normalizeCandles(
    rows.map((r) => ({
      time: r[0],
      open: Number.parseFloat(r[1]),
      high: Number.parseFloat(r[2]),
      low: Number.parseFloat(r[3]),
      close: Number.parseFloat(r[4]),
      volume: Number.parseFloat(r[6]),
    })),
  );
}

interface KrakenWsMessage {
  channel?: string;
  type?: string;
  data?: {
    symbol: string;
    interval: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    time: number;
  }[];
}

export function createKrakenProvider(): ProviderAdapter {
  const timeframes = Object.keys(TF_MINUTES) as Timeframe[];
  return {
    id: 'kraken',
    name: 'Kraken',
    isProxyInstrument: () => false,
    instrumentLabel: (symbol) => SYMBOLS[symbol]?.note ?? SYMBOLS[symbol]?.native ?? symbol,
    supports: (symbol) => symbol in SYMBOLS,
    capabilities: () => ({
      timeframes,
      ws: true,
      historyDepth: 720,
    }),
    async getCandles(req) {
      const m = SYMBOLS[req.symbol];
      const minutes = TF_MINUTES[req.timeframe];
      if (!m || !minutes) throw new Error(`Kraken does not support ${req.symbol} ${req.timeframe}`);
      const res = await getJson<{ error: string[]; result: Record<string, KrakenOhlcRow[]> }>(
        `${BASE}/0/public/OHLC?pair=${m.native}&interval=${minutes}`,
      );
      if (res.error.length > 0) throw new Error(`Kraken error: ${res.error[0]}`);
      const key = Object.keys(res.result).find((k) => k !== 'last');
      if (!key) throw new Error('Kraken returned no data');
      return mapKrakenOhlc(res.result[key]);
    },
    subscribe(symbol, timeframe, onTick, onStatus) {
      const m = SYMBOLS[symbol];
      const minutes = TF_MINUTES[timeframe];
      if (!m || !minutes) return () => undefined;
      const ws = new ReconnectingWs({
        url: WS_URL,
        onMessage: (raw) => {
          const msg = raw as KrakenWsMessage;
          if (msg.channel !== 'ohlc' || !msg.data) return;
          const closed = msg.type === 'candle_complete';
          for (const d of msg.data) {
            onTick(
              {
                time: Math.floor(d.time / 1000),
                open: Number.parseFloat(d.open),
                high: Number.parseFloat(d.high),
                low: Number.parseFloat(d.low),
                close: Number.parseFloat(d.close),
                volume: Number.parseFloat(d.volume),
              },
              closed,
            );
          }
          onStatus('live');
        },
        onStatus: (s) =>
          onStatus(s === 'open' ? 'live' : s === 'connecting' ? 'loading' : 'offline'),
      });
      ws.connect();
      ws.send(
        JSON.stringify({
          method: 'subscribe',
          params: { channel: 'ohlc', symbol: m.channel, interval: minutes },
        }),
      );
      return () => ws.close();
    },
    async getTicker(symbol): Promise<Ticker> {
      const m = SYMBOLS[symbol];
      if (!m) throw new Error(`Kraken does not list ${symbol}`);
      const res = await getJson<{
        error: string[];
        result: Record<string, { c: string[]; h: string[]; l: string[]; o: string }>;
      }>(`${BASE}/0/public/Ticker?pair=${m.native}`, { cacheTtlMs: 4000 });
      if (res.error.length > 0) throw new Error(`Kraken error: ${res.error[0]}`);
      const key = Object.keys(res.result)[0];
      const t = res.result[key];
      const last = Number.parseFloat(t.c[0]);
      const open = Number.parseFloat(t.o);
      return {
        symbol,
        last,
        changePct24h: open === 0 ? undefined : ((last - open) / open) * 100,
        high24h: Number.parseFloat(t.h[1] ?? t.h[0]),
        low24h: Number.parseFloat(t.l[1] ?? t.l[0]),
        ts: Date.now() / 1000,
      };
    },
    async getServerTime() {
      const res = await getJson<{ result: { unixtime: number } }>(`${BASE}/0/public/Time`);
      return res.result.unixtime;
    },
  };
}
