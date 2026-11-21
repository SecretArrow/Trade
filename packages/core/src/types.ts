export interface Candle {
  /** UTC seconds of the candle open time. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Timeframe =
  '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1D' | '1W' | '1M';

export type ChartType =
  'candles' | 'hollow' | 'bars' | 'line' | 'area' | 'heikin-ashi' | 'baseline';

export type ScaleMode = 'linear' | 'log' | 'percent';

export type ThemeName = 'dark' | 'light' | 'system';

export type Locale = 'en' | 'id';

export type LayoutMode = 'single' | '2-col' | '2x2';

export type SymbolKind = 'crypto' | 'spot-gold' | 'tokenized-gold';

export interface SymbolInfo {
  id: string;
  base: string;
  quote: string;
  name: string;
  kind: SymbolKind;
  pricePrecision: number;
  volumePrecision: number;
  basePrice: number;
  demoSeed: number;
}

export interface Ticker {
  symbol: string;
  last: number;
  changePct24h?: number;
  high24h?: number;
  low24h?: number;
  ts: number;
}

export type ConnectionStatus = 'loading' | 'live' | 'delayed' | 'offline';
