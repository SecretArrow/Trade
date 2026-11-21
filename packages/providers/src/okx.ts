import type { Candle, Ticker, Timeframe } from '@trade/core';
import type { ProviderAdapter, SymbolMapping } from './types';
import { getJson } from './net';
import { normalizeCandles } from './normalizers';
import { ReconnectingWs } from './ws';

const BASE = 'https://www.okx.com';
const WS_BASE = 'wss://ws.okx.com:8443/ws/v5/public';

const TF: Record<Timeframe, string> = {
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1H',
  '2h': '2H',
  '4h': '4H',
  '6h': '6H',
  '12h': '12H',
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
};

const SYMBOLS: Record<string, SymbolMapping> = {
  'BTC/USDT': { native: 'BTC-USDT' },
  'XAUT/USDT': { native: 'XAUT-USDT' },
};

export type OkxCandleRow = [string, string, string, string, string, string, ...unknown[]];

export function mapOkxCandles(rows: OkxCandleRow[]): Candle[] {
  return normalizeCandles(
    rows.map((r) => ({
      time: Math.floor(Number.parseFloat(r[0]) / 1000),
      open: Number.parseFloat(r[1]),
      high: Number.parseFloat(r[2]),
      low: Number.parseFloat(r[3]),
      close: Number.parseFloat(r[4]),
      volume: Number.parseFloat(r[5]),
    })),
  );
}

interface OkxWs {
  arg?: { channel: string; instId: string };
  data?: OkxCandleRow[];
}

export function createOkxProvider(): ProviderAdapter {
  return {
    id: 'okx',
    name: 'OKX',
    isProxyInstrument: () => false,
    instrumentLabel: (symbol) => SYMBOLS[symbol]?.native ?? symbol,
    supports: (symbol) => symbol in SYMBOLS,
    capabilities: () => ({
      timeframes: Object.keys(TF) as Timeframe[],
      ws: true,
      historyDepth: 300,
    }),
    async getCandles(req) {
      const m = SYMBOLS[req.symbol];
      if (!m) throw new Error(`OKX does not list ${req.symbol}`);
      const params = new URLSearchParams({
        instId: m.native,
        bar: TF[req.timeframe],
        limit: String(Math.min(req.limit ?? 300, 300)),
      });
      const res = await getJson<{ code: string; msg: string; data: OkxCandleRow[] }>(
        `${BASE}/api/v5/market/candles?${params}`,
      );
      if (res.code !== '0') throw new Error(`OKX error: ${res.msg}`);
      return mapOkxCandles(res.data);
    },
    subscribe(symbol, timeframe, onTick, onStatus) {
      const m = SYMBOLS[symbol];
      if (!m) return () => undefined;
      const ws = new ReconnectingWs({
        url: WS_BASE,
        onMessage: (raw) => {
          const msg = raw as OkxWs;
          for (const row of msg.data ?? []) {
            onTick(
              {
                time: Math.floor(Number.parseFloat(row[0]) / 1000),
                open: Number.parseFloat(row[1]),
                high: Number.parseFloat(row[2]),
                low: Number.parseFloat(row[3]),
                close: Number.parseFloat(row[4]),
                volume: Number.parseFloat(row[5]),
              },
              row.length > 8 ? row[8] === '1' : true,
            );
          }
          if (msg.data?.length) onStatus('live');
        },
        onStatus: (s) =>
          onStatus(s === 'open' ? 'live' : s === 'connecting' ? 'loading' : 'offline'),
        pingPayload: () => 'ping',
        pingIntervalMs: 20_000,
      });
      ws.connect();
      ws.send(
        JSON.stringify({
          op: 'subscribe',
          args: [{ channel: `candle${TF[timeframe]}`, instId: m.native }],
        }),
      );
      return () => ws.close();
    },
    async getTicker(symbol): Promise<Ticker> {
      const m = SYMBOLS[symbol];
      if (!m) throw new Error(`OKX does not list ${symbol}`);
      const res = await getJson<{
        code: string;
        data: { last: string; open24h: string; high24h: string; low24h: string }[];
      }>(`${BASE}/api/v5/market/ticker?instId=${m.native}`, { cacheTtlMs: 4000 });
      const t = res.data[0];
      if (!t) throw new Error('OKX ticker unavailable');
      const open = Number.parseFloat(t.open24h);
      const last = Number.parseFloat(t.last);
      return {
        symbol,
        last,
        changePct24h: open === 0 ? undefined : ((last - open) / open) * 100,
        high24h: Number.parseFloat(t.high24h),
        low24h: Number.parseFloat(t.low24h),
        ts: Date.now() / 1000,
      };
    },
    async getServerTime() {
      const res = await getJson<{ data: string[] }>(`${BASE}/api/v5/public/time`);
      return Number.parseFloat(res.data[0]) / 1000;
    },
  };
}
