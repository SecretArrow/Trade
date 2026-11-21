import type { ProviderAdapter, ProviderSettings } from './types';
import { createBinanceProvider } from './binance';
import { createBybitProvider } from './bybit';
import { createOkxProvider } from './okx';
import { createKrakenProvider } from './kraken';
import { createCoinbaseProvider } from './coinbase';
import { createGateProvider } from './gate';
import { createTwelveDataProvider } from './twelvedata';
import { createYahooProvider } from './yahoo';
import { createStooqProvider } from './stooq';
import { createDemoProvider } from './demo';

export type ProviderId =
  | 'binance'
  | 'bybit'
  | 'okx'
  | 'kraken'
  | 'coinbase'
  | 'gate'
  | 'twelvedata'
  | 'yahoo'
  | 'stooq'
  | 'demo';

const FACTORIES: Record<ProviderId, () => ProviderAdapter> = {
  binance: createBinanceProvider,
  bybit: createBybitProvider,
  okx: createOkxProvider,
  kraken: createKrakenProvider,
  coinbase: createCoinbaseProvider,
  gate: createGateProvider,
  twelvedata: createTwelveDataProvider,
  yahoo: createYahooProvider,
  stooq: createStooqProvider,
  demo: createDemoProvider,
};

const cache = new Map<string, ProviderAdapter>();

export function getProvider(id: string): ProviderAdapter {
  const existing = cache.get(id);
  if (existing) return existing;
  const factory = FACTORIES[id as ProviderId];
  if (!factory) throw new Error(`Unknown provider: ${id}`);
  const adapter = factory();
  cache.set(id, adapter);
  return adapter;
}

export const PROVIDER_ORDER: ProviderId[] = [
  'binance',
  'bybit',
  'okx',
  'kraken',
  'coinbase',
  'gate',
  'twelvedata',
  'yahoo',
  'stooq',
  'demo',
];

/** Adapters that can serve the symbol with the current settings. */
export function providersForSymbol(symbol: string, settings: ProviderSettings): ProviderAdapter[] {
  return PROVIDER_ORDER.map((id) => getProvider(id)).filter((p) => {
    try {
      return p.supports(symbol, settings);
    } catch {
      return false;
    }
  });
}
