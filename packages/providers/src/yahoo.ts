import type { Candle, Ticker, Timeframe } from '@trade/core';
import type { ProviderAdapter, SymbolMapping } from './types';
import { getJson, proxied } from './net';
import { normalizeCandles } from './normalizers';
import { pollForCandles } from './polling';

const BASE = 'https://query1.finance.yahoo.com';

const TF_RANGE: Partial<Record<Timeframe, { interval: string; range: string }>> = {
  '1m': { interval: '1m', range: '7d' },
  '5m': { interval: '5m', range: '1mo' },
  '15m': { interval: '15m', range: '60d' },
  '30m': { interval: '30m', range: '60d' },
  '1h': { interval: '60m', range: '730d' },
  '1D': { interval: '1d', range: '10y' },
  '1W': { interval: '1wk', range: '10y' },
  '1M': { interval: '1mo', range: '10y' },
};

const SYMBOLS: Record<string, SymbolMapping> = {
  'BTC/USDT': { native: 'BTC-USD', note: 'BTC/USD (USD quote)' },
  'XAU/USD': { native: 'XAUUSD=X' },
};

export interface YahooChartResponse {
  chart?: {
    result?: {
      meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number };
      timestamp?: number[];
      indicators?: {
        quote?: {
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }[];
      };
    }[];
    error?: unknown;
  };
}

export function mapYahooChart(res: YahooChartResponse): Candle[] {
  const result = res.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const stamps = result?.timestamp ?? [];
  const out: Candle[] = [];
  for (let i = 0; i < stamps.length; i++) {
    const open = quote?.open?.[i];
    const high = quote?.high?.[i];
    const low = quote?.low?.[i];
    const close = quote?.close?.[i];
    const volume = quote?.volume?.[i];
    if (open == null || high == null || low == null || close == null) continue;
    out.push({ time: stamps[i], open, high, low, close, volume: volume ?? 0 });
  }
  return normalizeCandles(out);
}

/** Yahoo blocks browser CORS; all calls are routed through the optional proxy. */
export function createYahooProvider(): ProviderAdapter {
  const timeframes = Object.keys(TF_RANGE) as Timeframe[];
  return {
    id: 'yahoo',
    name: 'Yahoo Finance',
    isProxyInstrument: () => false,
    instrumentLabel: (symbol) => SYMBOLS[symbol]?.note ?? SYMBOLS[symbol]?.native ?? symbol,
    supports: (symbol, settings) => symbol in SYMBOLS && Boolean(settings.proxyUrl),
    capabilities: () => ({
      timeframes,
      ws: false,
      polling: true,
      historyDepth: 1000,
      requiresProxy: true,
    }),
    async getCandles(req, settings) {
      const m = SYMBOLS[req.symbol];
      const conf = TF_RANGE[req.timeframe];
      if (!m || !conf) throw new Error(`Yahoo does not support ${req.symbol} ${req.timeframe}`);
      const url = `${BASE}/v8/finance/chart/${encodeURIComponent(m.native)}?interval=${conf.interval}&range=${conf.range}`;
      const res = await getJson<YahooChartResponse>(proxied(url, settings.proxyUrl), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      return mapYahooChart(res);
    },
    subscribe(symbol, timeframe, onTick, onStatus, settings) {
      const adapter = this;
      return pollForCandles(
        () => adapter.getCandles({ symbol, timeframe, limit: 5 }, settings),
        onTick,
        onStatus,
        15_000,
      );
    },
    async getTicker(symbol, settings): Promise<Ticker> {
      const m = SYMBOLS[symbol];
      if (!m) throw new Error(`Yahoo does not list ${symbol}`);
      const url = `${BASE}/v8/finance/chart/${encodeURIComponent(m.native)}?interval=1d&range=2d`;
      const res = await getJson<YahooChartResponse>(proxied(url, settings.proxyUrl), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const meta = res.chart?.result?.[0]?.meta;
      const last = meta?.regularMarketPrice;
      const prev = meta?.chartPreviousClose ?? meta?.previousClose;
      if (last == null) throw new Error('Yahoo ticker unavailable');
      return {
        symbol,
        last,
        changePct24h: prev ? ((last - prev) / prev) * 100 : undefined,
        ts: Date.now() / 1000,
      };
    },
    async getServerTime() {
      return Date.now() / 1000;
    },
  };
}
