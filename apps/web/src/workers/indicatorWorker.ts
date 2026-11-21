/// <reference lib="webworker" />
import type { Candle } from '@trade/core';
import { resampleCandles } from '@trade/core';
import { computeIndicator } from '@trade/indicators';
import type { IndicatorOutput } from '@trade/indicators';

export interface ComputeRequest {
  type: 'compute';
  key: string;
  candles: Candle[];
  configs: { id: string; type: string; params: Record<string, number | string | boolean> }[];
  /** Higher timeframe for multi-timeframe indicators, e.g. '1D'. */
  htf?: string;
}

export interface TickRequest {
  type: 'tick';
  key: string;
  candle: Candle;
}

export interface ResultMessage {
  type: 'result';
  key: string;
  outputs: { id: string; type: string; output: IndicatorOutput | null }[];
}

/**
 * Indicator worker. Full recomputes are triggered by 'compute' messages
 * (history reload, closed candle, settings change); live forming-candle
 * updates are batched and recomputed at most every 250 ms so the main thread
 * can keep a steady 60 fps even with 10k candles and many indicators.
 */
const pending: ComputeRequest | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const candlesByPane = new Map<string, Candle[]>();
const configByPane = new Map<string, ComputeRequest['configs']>();
const htfByPane = new Map<string, string | undefined>();

function runCompute(req: ComputeRequest): ResultMessage {
  candlesByPane.set(req.key, req.candles);
  configByPane.set(req.key, req.configs);
  htfByPane.set(req.key, req.htf);
  const outputs = req.configs.map((cfg) => {
    try {
      const ctx: Record<string, unknown> = {};
      if (req.htf) {
        ctx.resample = (candles: Candle[]) => resampleCandles(candles, req.htf as never);
      }
      return {
        id: cfg.id,
        type: cfg.type,
        output: computeIndicator(cfg.type, req.candles, cfg.params, ctx),
      };
    } catch {
      return { id: cfg.id, type: cfg.type, output: null };
    }
  });
  return { type: 'result', key: req.key, outputs };
}

self.onmessage = (ev: MessageEvent<ComputeRequest | TickRequest>) => {
  const msg = ev.data;
  if (msg.type === 'compute') {
    // direct compute for history loads
    const result = runCompute(msg);
    (self as unknown as Worker).postMessage(result);
    return;
  }
  if (msg.type === 'tick') {
    // update the stored series and schedule a throttled recompute
    const candles = candlesByPane.get(msg.key);
    const configs = configByPane.get(msg.key);
    if (!candles || !configs || configs.length === 0) return;
    const last = candles[candles.length - 1];
    if (last && last.time === msg.candle.time) {
      candles[candles.length - 1] = msg.candle;
    } else if (!last || msg.candle.time > last.time) {
      candles.push(msg.candle);
      if (candles.length > 20000) candles.shift();
    }
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const req: ComputeRequest = {
        type: 'compute',
        key: msg.key,
        candles: [...candles],
        configs,
        htf: htfByPane.get(msg.key),
      };
      const result = runCompute(req);
      (self as unknown as Worker).postMessage(result);
    }, 250);
  }
};
