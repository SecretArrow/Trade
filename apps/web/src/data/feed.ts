import type { Candle, ConnectionStatus, Timeframe } from '@trade/core';
import { getProvider } from '@trade/providers';
import { runCrossCheck } from '@trade/providers';
import type { ProviderSettings } from '@trade/providers';
import { symbolInfo } from '../state/store';

type Listener = (state: FeedState) => void;

export interface FeedState {
  candles: Candle[];
  status: ConnectionStatus;
  lastTickAt: number;
  lastPrice: number | null;
  serverOffset: number;
  crosscheck: { deviation: number | null; secondary: { provider: string; price: number } | null };
}

/** @internal registered by the chart layer to observe state identity changes. */
export const feedListeners = new Set<Listener>();

interface FeedOptions {
  symbol: string;
  timeframe: Timeframe;
  providerId: string;
  settings: ProviderSettings;
  onCandles?: (candles: Candle[]) => void;
  onTick?: (candle: Candle, closed: boolean) => void;
}

/**
 * One live data session per chart pane: history load, subscription with
 * status tracking, server-time offset and a periodic cross-provider price
 * accuracy check. Never mixes providers inside one series; a provider switch
 * must create a new Feed.
 */
export class Feed {
  private unsubscribe: (() => void) | null = null;
  private crosscheckTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  state: FeedState = {
    candles: [],
    status: 'loading',
    lastTickAt: 0,
    lastPrice: null,
    serverOffset: 0,
    crosscheck: { deviation: null, secondary: null },
  };

  constructor(private readonly options: FeedOptions) {}

  async start(): Promise<void> {
    const { symbol, timeframe, providerId, settings } = this.options;
    const provider = getProvider(providerId);
    try {
      const candles = await provider.getCandles({ symbol, timeframe, limit: 500 }, settings);
      if (this.disposed) return;
      this.state.candles = candles;
      this.state.lastPrice = candles.length > 0 ? candles[candles.length - 1].close : null;
      this.state.status = 'loading';
      this.emit();
      this.options.onCandles?.(candles);
    } catch (err) {
      if (this.disposed) return;
      this.state.status = 'offline';
      this.emit();
      throw err;
    }

    this.unsubscribe = provider.subscribe(
      symbol,
      timeframe,
      (candle, closed) => {
        if (this.disposed) return;
        const last = this.state.candles[this.state.candles.length - 1];
        if (last && candle.time === last.time) {
          this.state.candles[this.state.candles.length - 1] = candle;
        } else if (!last || candle.time > last.time) {
          this.state.candles.push(candle);
          if (this.state.candles.length > 20000) this.state.candles.shift();
        }
        this.state.lastPrice = candle.close;
        this.state.lastTickAt = Date.now();
        this.options.onTick?.(candle, closed);
      },
      (status) => {
        if (this.disposed) return;
        this.state.status = status;
        this.state.lastTickAt = Date.now();
        this.emit();
      },
      settings,
    );

    // server time offset (best effort)
    provider
      .getServerTime(settings)
      .then((server) => {
        if (!this.disposed) this.state.serverOffset = server - Date.now() / 1000;
      })
      .catch(() => undefined);

    // periodic cross-provider accuracy check
    const runCheck = () => {
      if (this.disposed) return;
      runCrossCheck(symbol, symbolInfo(symbol).kind, providerId, settings).then((res) => {
        if (this.disposed) return;
        this.state.crosscheck = {
          deviation: res.secondary ? res.deviationPct : null,
          secondary: res.secondary
            ? { provider: res.secondary.provider, price: res.secondary.price }
            : null,
        };
        this.emit();
      });
    };
    runCheck();
    this.crosscheckTimer = setInterval(runCheck, 30_000);
  }

  private emit(): void {
    this.state = { ...this.state };
    for (const listener of feedListeners) listener(this.state);
  }

  stop(): void {
    this.disposed = true;
    this.unsubscribe?.();
    if (this.crosscheckTimer) clearInterval(this.crosscheckTimer);
  }
}
