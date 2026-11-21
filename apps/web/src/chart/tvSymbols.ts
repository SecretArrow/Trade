import type { Timeframe } from '@trade/core';

/**
 * Mapping from Trade symbol ids to TradingView symbols for the embedded
 * Advanced Chart widget.
 *
 * Symbols registry (packages/core/src/symbols.ts):
 *   - BTC/USDT   (crypto)         -> BINANCE:BTCUSDT
 *   - XAU/USD    (spot gold)      -> OANDA:XAUUSD
 *   - XAUT/USDT  (tokenized gold) -> BINANCE:PAXGUSDT (PAXG is the
 *     tokenized-gold proxy with a liquid Binance spot pair)
 */
const TV_SYMBOLS: Record<string, string> = {
  'BTC/USDT': 'BINANCE:BTCUSDT',
  'XAU/USD': 'OANDA:XAUUSD',
  'XAUT/USDT': 'BINANCE:PAXGUSDT',
};

/**
 * Convert a Trade symbol id to a TradingView symbol string
 * (e.g. `'XAU/USD'` -> `'OANDA:XAUUSD'`).
 *
 * Any other crypto pair quoted in USDT falls back to the Binance spot
 * symbol derived from the id (`'ETH/USDT'` -> `'BINANCE:ETHUSDT'`).
 * Unknown ids resolve to `'BINANCE:BTCUSDT'` so the widget always has a
 * valid symbol to render.
 */
export function toTradingViewSymbol(symbolId: string): string {
  const exact = TV_SYMBOLS[symbolId];
  if (exact) return exact;
  if (symbolId.endsWith('/USDT')) {
    return `BINANCE:${symbolId.replace('/', '').toUpperCase()}`;
  }
  return 'BINANCE:BTCUSDT';
}

const TV_INTERVALS: Record<Timeframe, string> = {
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

/**
 * Convert a Trade timeframe to the TradingView widget interval
 * (e.g. `'15m'` -> `'15'`, `'1D'` -> `'D'`).
 */
export function toTradingViewInterval(tf: Timeframe): string {
  return TV_INTERVALS[tf] ?? '15';
}
