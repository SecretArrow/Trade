import type { Candle, ConnectionStatus, Ticker, Timeframe } from '@trade/core';

export interface ProviderCapabilities {
  timeframes: Timeframe[];
  ws: boolean;
  /** Approximate max candles returned per request. */
  historyDepth: number;
  requiresKey?: boolean;
  requiresProxy?: boolean;
  /** Live updates are approximated with REST polling. */
  polling?: boolean;
}

export interface CandleRequest {
  symbol: string;
  timeframe: Timeframe;
  from?: number;
  to?: number;
  limit?: number;
}

export type TickHandler = (candle: Candle, closed: boolean) => void;
export type StatusHandler = (status: ConnectionStatus) => void;

export interface ProviderSettings {
  /** Twelve Data API key (stored only in the browser). */
  twelveDataKey?: string;
  /** Base URL of the optional CORS proxy worker, e.g. https://proxy.example.workers.dev */
  proxyUrl?: string;
}

export interface ProviderAdapter {
  id: string;
  name: string;
  /** True when the instrument is a proxy for another instrument (e.g. a gold perp standing in for spot gold). */
  isProxyInstrument(symbol: string): boolean;
  /** Human label for the instrument on this provider, e.g. "PAXG/USDT (tokenized gold)". */
  instrumentLabel(symbol: string): string;
  supports(symbol: string, settings: ProviderSettings): boolean;
  capabilities(symbol: string): ProviderCapabilities | null;
  getCandles(req: CandleRequest, settings: ProviderSettings): Promise<Candle[]>;
  /** Start a live subscription; returns an unsubscribe function. */
  subscribe(
    symbol: string,
    timeframe: Timeframe,
    onTick: TickHandler,
    onStatus: StatusHandler,
    settings: ProviderSettings,
  ): () => void;
  getTicker(symbol: string, settings: ProviderSettings): Promise<Ticker>;
  getServerTime(settings: ProviderSettings): Promise<number>;
}

export interface SymbolMapping {
  /** Provider-native symbol string. */
  native: string;
  /** Extra label when the provider's instrument differs from the requested pair. */
  note?: string;
  proxy?: boolean;
  /** Bybit category or similar routing hint. */
  channel?: string;
}
