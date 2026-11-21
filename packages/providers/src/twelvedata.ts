import type { Candle, Ticker, Timeframe } from '@trade/core';
import type { ProviderAdapter, SymbolMapping } from './types';
import { getJson } from './net';
import { normalizeCandles } from './normalizers';
import { pollForCandles, requireKey } from './polling';

const BASE = 'https://api.twelvedata.com';

const TF: Partial<Record<Timeframe, string>> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1h': '1h',
  '2h': '2h',
  '4h': '4h',
  '1D': '1day',
  '1W': '1week',
  '1M': '1month',
};

const SYMBOLS: Record<string, SymbolMapping> = {
  'BTC/USDT': { native: 'BTC/USD' },
  'XAU/USD': { native: 'XAU/USD' },
  'XAUT/USDT': { native: 'XAUT/USD' },
};

export interface TwelveDataValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

/** Parse "YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss" as UTC seconds. */
export function parseTwelveDataTime(datetime: string): number {
  const [datePart, timePart] = datetime.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  if (timePart) {
    const [hh, mm, ss] = timePart.split(':').map(Number);
    return Date.UTC(y, m - 1, d, hh ?? 0, mm ?? 0, ss ?? 0) / 1000;
  }
  return Date.UTC(y, m - 1, d) / 1000;
}

export function mapTwelveData(values: TwelveDataValue[]): Candle[] {
  return normalizeCandles(
    values.map((v) => ({
      time: parseTwelveDataTime(v.datetime),
      open: Number.parseFloat(v.open),
      high: Number.parseFloat(v.high),
      low: Number.parseFloat(v.low),
      close: Number.parseFloat(v.close),
      volume: Number.parseFloat(v.volume ?? '0'),
    })),
  );
}

export function createTwelveDataProvider(): ProviderAdapter {
  const timeframes = Object.keys(TF) as Timeframe[];
  return {
    id: 'twelvedata',
    name: 'Twelve Data',
    isProxyInstrument: () => false,
    instrumentLabel: (symbol) => SYMBOLS[symbol]?.native ?? symbol,
    supports: (symbol, settings) => symbol in SYMBOLS && Boolean(settings.twelveDataKey),
    capabilities: () => ({
      timeframes,
      ws: false,
      polling: true,
      historyDepth: 5000,
      requiresKey: true,
    }),
    async getCandles(req, settings) {
      const m = SYMBOLS[req.symbol];
      const interval = TF[req.timeframe];
      const key = requireKey(settings.twelveDataKey, 'Twelve Data');
      if (!m || !interval)
        throw new Error(`Twelve Data does not support ${req.symbol} ${req.timeframe}`);
      const params = new URLSearchParams({
        symbol: m.native,
        interval,
        outputsize: String(Math.min(req.limit ?? 500, 5000)),
        apikey: key,
      });
      const res = await getJson<{ status?: string; message?: string; values?: TwelveDataValue[] }>(
        `${BASE}/time_series?${params}`,
      );
      if (res.status === 'error' || !res.values) {
        throw new Error(`Twelve Data error: ${res.message ?? 'no data'}`);
      }
      return mapTwelveData(res.values);
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
      const key = requireKey(settings.twelveDataKey, 'Twelve Data');
      if (!m) throw new Error(`Twelve Data does not list ${symbol}`);
      const t = await getJson<{
        close?: string;
        percent_change?: string;
        high?: string;
        low?: string;
        datetime?: string;
      }>(`${BASE}/quote?symbol=${encodeURIComponent(m.native)}&apikey=${key}`, {
        cacheTtlMs: 8000,
      });
      return {
        symbol,
        last: Number.parseFloat(t.close ?? '0'),
        changePct24h: t.percent_change ? Number.parseFloat(t.percent_change) : undefined,
        high24h: t.high ? Number.parseFloat(t.high) : undefined,
        low24h: t.low ? Number.parseFloat(t.low) : undefined,
        ts: Date.now() / 1000,
      };
    },
    async getServerTime() {
      // Twelve Data has no public time endpoint; approximate with local clock.
      return Date.now() / 1000;
    },
  };
}
