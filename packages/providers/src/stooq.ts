import type { Candle, Ticker } from '@trade/core';
import type { ProviderAdapter, SymbolMapping } from './types';
import { getText, proxied } from './net';
import { normalizeCandles } from './normalizers';
import { pollForCandles } from './polling';

const BASE = 'https://stooq.com';

const SYMBOLS: Record<string, SymbolMapping> = {
  'XAU/USD': { native: 'xauusd' },
};

export function mapStooqCsv(csv: string): Candle[] {
  const lines = csv.trim().split(/\r?\n/);
  const out: Candle[] = [];
  for (const line of lines.slice(1)) {
    const [date, openStr, highStr, lowStr, closeStr, volumeStr] = line.split(',');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const open = Number.parseFloat(openStr);
    const high = Number.parseFloat(highStr);
    const low = Number.parseFloat(lowStr);
    const close = Number.parseFloat(closeStr);
    if (!Number.isFinite(open) || !Number.isFinite(close)) continue;
    const [y, m, d] = date.split('-').map(Number);
    out.push({
      time: Date.UTC(y, m - 1, d) / 1000,
      open,
      high: Number.isFinite(high) ? high : Math.max(open, close),
      low: Number.isFinite(low) ? low : Math.min(open, close),
      close,
      volume: Number.parseFloat(volumeStr) || 0,
    });
  }
  return normalizeCandles(out);
}

/** Stooq delayed daily CSV; browser access goes through the optional proxy. */
export function createStooqProvider(): ProviderAdapter {
  const adapter: ProviderAdapter = {
    id: 'stooq',
    name: 'Stooq (delayed)',
    isProxyInstrument: () => false,
    instrumentLabel: (symbol) => SYMBOLS[symbol]?.note ?? SYMBOLS[symbol]?.native ?? symbol,
    supports: (symbol, settings) => symbol in SYMBOLS && Boolean(settings.proxyUrl),
    capabilities: () => ({
      timeframes: ['1D'],
      ws: false,
      polling: true,
      historyDepth: 5000,
      requiresProxy: true,
    }),
    async getCandles(req, settings) {
      const m = SYMBOLS[req.symbol];
      if (!m) throw new Error(`Stooq does not list ${req.symbol}`);
      if (req.timeframe !== '1D') throw new Error('Stooq provides daily candles only');
      const url = proxied(`${BASE}/q/d/l/?s=${m.native}&i=d`, settings.proxyUrl);
      return mapStooqCsv(await getText(url));
    },
    subscribe(symbol, timeframe, onTick, onStatus, settings) {
      return pollForCandles(
        () => adapter.getCandles({ symbol, timeframe, limit: 5 }, settings),
        onTick,
        onStatus,
        60_000,
      );
    },
    async getTicker(symbol, settings): Promise<Ticker> {
      const m = SYMBOLS[symbol];
      if (!m) throw new Error(`Stooq does not list ${symbol}`);
      const url = proxied(`${BASE}/q/l/?s=${m.native}&f=sd2t2ohlcv&h&e=csv`, settings.proxyUrl);
      const csv = await getText(url);
      const line = csv.trim().split(/\r?\n/)[1] ?? '';
      const parts = line.split(',');
      const close = Number.parseFloat(parts[6]);
      if (!Number.isFinite(close)) throw new Error('Stooq ticker unavailable');
      const open = Number.parseFloat(parts[3]);
      return {
        symbol,
        last: close,
        changePct24h:
          Number.isFinite(open) && open !== 0 ? ((close - open) / open) * 100 : undefined,
        ts: Date.now() / 1000,
      };
    },
    async getServerTime() {
      return Date.now() / 1000;
    },
  };
  return adapter;
}
