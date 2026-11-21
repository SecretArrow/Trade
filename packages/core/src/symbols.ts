import type { SymbolInfo } from './types';

export const SYMBOLS: SymbolInfo[] = [
  {
    id: 'BTC/USDT',
    base: 'BTC',
    quote: 'USDT',
    name: 'Bitcoin / Tether',
    kind: 'crypto',
    pricePrecision: 2,
    volumePrecision: 3,
    basePrice: 97000,
    demoSeed: 1337,
  },
  {
    id: 'XAU/USD',
    base: 'XAU',
    quote: 'USD',
    name: 'Spot Gold / US Dollar',
    kind: 'spot-gold',
    pricePrecision: 2,
    volumePrecision: 0,
    basePrice: 3540,
    demoSeed: 4242,
  },
  {
    id: 'XAUT/USDT',
    base: 'XAUT',
    quote: 'USDT',
    name: 'Tether Gold / Tether',
    kind: 'tokenized-gold',
    pricePrecision: 2,
    volumePrecision: 2,
    basePrice: 3545,
    demoSeed: 9001,
  },
];

export function getSymbol(id: string): SymbolInfo {
  const found = SYMBOLS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown symbol: ${id}`);
  return found;
}
