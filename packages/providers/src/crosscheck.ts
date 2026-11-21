import type { SymbolKind } from '@trade/core';
import type { ProviderSettings } from './types';
import { getProvider, PROVIDER_ORDER } from './registry';

/**
 * Price accuracy cross-check. Compares the last price of the active provider
 * with other providers that list the same instrument (or a clearly labelled
 * proxy for gold) and reports whether the deviation exceeds the threshold.
 */

export const DEVIATION_THRESHOLDS: Record<SymbolKind, number> = {
  crypto: 0.3,
  'spot-gold': 0.15,
  'tokenized-gold': 0.3,
};

export interface DeviationResult {
  ok: boolean;
  deviationPct: number;
  primary: { provider: string; price: number };
  secondary: { provider: string; price: number; proxy: boolean } | null;
  threshold: number;
}

/** Pick the best secondary provider to compare against for a symbol. */
export function pickCrossCheckProvider(
  symbol: string,
  kind: SymbolKind,
  activeProviderId: string,
  settings: ProviderSettings,
): string | null {
  const preferred: Record<string, string[]> = {
    'BTC/USDT': ['binance', 'bybit', 'okx', 'kraken', 'gate', 'coinbase'],
    'XAU/USD': ['binance', 'bybit', 'twelvedata'],
    'XAUT/USDT': ['binance', 'okx', 'gate', 'bybit', 'kraken'],
  };
  for (const id of preferred[symbol] ?? []) {
    if (id === activeProviderId) continue;
    const adapter = getProvider(id);
    if (adapter.supports(symbol, settings)) return id;
  }
  for (const id of PROVIDER_ORDER) {
    if (id === activeProviderId || id === 'demo') continue;
    const adapter = getProvider(id);
    if (adapter.supports(symbol, settings)) return id;
  }
  return null;
}

export function evaluateDeviation(
  kind: SymbolKind,
  primary: { provider: string; price: number },
  secondary: { provider: string; price: number; proxy: boolean } | null,
): DeviationResult {
  const threshold =
    secondary?.proxy && kind === 'spot-gold'
      ? DEVIATION_THRESHOLDS['spot-gold'] * 2 // proxies track spot loosely
      : DEVIATION_THRESHOLDS[kind];
  if (!secondary) {
    return { ok: true, deviationPct: 0, primary, secondary: null, threshold };
  }
  const deviationPct =
    primary.price === 0 ? 0 : (Math.abs(primary.price - secondary.price) / primary.price) * 100;
  return { ok: deviationPct <= threshold, deviationPct, primary, secondary, threshold };
}

/**
 * Run one cross-check: fetch the primary ticker and a secondary ticker and
 * evaluate the deviation. Never throws: a failed fetch yields a no-op result.
 */
export async function runCrossCheck(
  symbol: string,
  kind: SymbolKind,
  activeProviderId: string,
  settings: ProviderSettings,
): Promise<DeviationResult> {
  const primaryAdapter = getProvider(activeProviderId);
  try {
    const primaryTicker = await primaryAdapter.getTicker(symbol, settings);
    const secondaryId = pickCrossCheckProvider(symbol, kind, activeProviderId, settings);
    if (!secondaryId) {
      return evaluateDeviation(
        kind,
        {
          provider: activeProviderId,
          price: primaryTicker.last,
        },
        null,
      );
    }
    const secondaryAdapter = getProvider(secondaryId);
    const secondaryTicker = await secondaryAdapter.getTicker(symbol, settings);
    return evaluateDeviation(
      kind,
      { provider: activeProviderId, price: primaryTicker.last },
      {
        provider: secondaryId,
        price: secondaryTicker.last,
        proxy: secondaryAdapter.isProxyInstrument(symbol),
      },
    );
  } catch {
    return {
      ok: true,
      deviationPct: 0,
      primary: { provider: activeProviderId, price: 0 },
      secondary: null,
      threshold: 0,
    };
  }
}
