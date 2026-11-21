import type { Candle } from '@trade/core';

/**
 * Shared REST-polling live subscription used by providers without a candle
 * WebSocket. Emits closed candles once and the forming candle on every poll,
 * and closes the previous forming candle with its final values.
 */
export function pollForCandles(
  fetchLast: () => Promise<Candle[]>,
  onTick: (candle: Candle, closed: boolean) => void,
  onStatus: (status: 'live' | 'delayed' | 'offline') => void,
  intervalMs = 10_000,
): () => void {
  let lastCandle: Candle | null = null;
  let stopped = false;
  let consecutiveErrors = 0;

  const timer = setInterval(async () => {
    if (stopped) return;
    try {
      const candles = [...(await fetchLast())].sort((a, b) => a.time - b.time);
      consecutiveErrors = 0;
      if (candles.length === 0) return;
      const forming = candles[candles.length - 1];
      if (lastCandle && lastCandle.time < forming.time) {
        // the previously forming candle is now history: emit its final state
        onTick(lastCandle, true);
        lastCandle = null;
      }
      if (!lastCandle) {
        for (const c of candles) {
          if (c.time < forming.time) onTick(c, true);
        }
      }
      onTick(forming, false);
      lastCandle = forming;
      onStatus('delayed');
    } catch {
      consecutiveErrors += 1;
      if (consecutiveErrors >= 3) onStatus('offline');
    }
  }, intervalMs);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

export function requireKey(value: string | undefined, sourceName: string): string {
  if (!value) throw new Error(`${sourceName} needs a personal API key (Settings)`);
  return value;
}
