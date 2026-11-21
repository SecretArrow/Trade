import type { Candle } from '@trade/core';
import type {
  IndicatorDefinition,
  IndicatorOutput,
  IndicatorParams,
  ParamSpec,
  PlotStyle,
  SourceKey,
} from './types';
import { dema, ema, envelope, hma, maRibbon, sma, tema, vwma, wma } from './movingAverages';
import { bollingerBands, donchianChannel, keltnerChannel, stdDevIndicator } from './bands';
import {
  awesomeOscillator,
  cci,
  macd,
  momentum,
  roc,
  rsi,
  stochastic,
  stochRsi,
  williamsR,
} from './momentum';
import { adx, ichimoku, psar, supertrend } from './trend';
import { accumulationDistribution, chaikinMoneyFlow, mfi, obv, volumeWithMa, vwap } from './volume';
import { pivotPoints } from './pivots';
import {
  channel,
  divergence,
  fairValueGaps,
  fibonacciAuto,
  marketStructure,
  mtfSupportResistance,
  orderBlocks,
  supplyDemand,
  supportResistance,
  trendlines,
} from './structure';
import { breakRetest } from './breakRetest';
import { detectPatterns, PATTERN_NAMES, type PatternKey } from './patterns';
import { atrValues } from './bands';

const C = {
  up: '#26a69a',
  down: '#ef5350',
  blue: '#4f8cff',
  purple: '#b46cff',
  orange: '#f0a92e',
  gray: '#7d8590',
  teal: '#26c6da',
  pink: '#ec407a',
  green: '#66bb6a',
};

function num(params: IndicatorParams, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === 'number' ? v : fallback;
}

function str(params: IndicatorParams, key: string, fallback: string): string {
  const v = params[key];
  return typeof v === 'string' ? v : fallback;
}

function src(params: IndicatorParams, key = 'source'): SourceKey {
  return str(params, key, 'close') as SourceKey;
}

const sourceParam: ParamSpec = {
  key: 'source',
  label: 'Source',
  type: 'select',
  default: 'close',
  options: [
    { value: 'close', label: 'Close' },
    { value: 'open', label: 'Open' },
    { value: 'high', label: 'High' },
    { value: 'low', label: 'Low' },
    { value: 'hl2', label: 'HL/2' },
    { value: 'hlc3', label: 'HLC/3' },
    { value: 'ohlc4', label: 'OHLC/4' },
  ],
};

function periodParam(def = 20, label = 'Period'): ParamSpec {
  return { key: 'period', label, type: 'number', default: def, min: 1, max: 500, step: 1 };
}

function plot(color: string, lineWidth: 1 | 2 | 3 | 4 = 2): PlotStyle {
  return { color, lineWidth };
}

export const DEFINITIONS: IndicatorDefinition[] = [
  // ----- moving averages -----
  {
    type: 'sma',
    name: 'Simple MA',
    group: 'ma',
    pane: 'main',
    params: [periodParam(20), sourceParam],
    plots: { sma: plot(C.blue) },
    compute: (c, p) => ({ plots: { sma: sma(c, num(p, 'period', 20), src(p)) } }),
  },
  {
    type: 'ema',
    name: 'Exponential MA',
    group: 'ma',
    pane: 'main',
    params: [periodParam(20), sourceParam],
    plots: { ema: plot(C.blue) },
    compute: (c, p) => ({ plots: { ema: ema(c, num(p, 'period', 20), src(p)) } }),
  },
  {
    type: 'wma',
    name: 'Weighted MA',
    group: 'ma',
    pane: 'main',
    params: [periodParam(20), sourceParam],
    plots: { wma: plot(C.teal) },
    compute: (c, p) => ({ plots: { wma: wma(c, num(p, 'period', 20), src(p)) } }),
  },
  {
    type: 'vwma',
    name: 'Volume Weighted MA',
    group: 'ma',
    pane: 'main',
    params: [periodParam(20)],
    plots: { vwma: plot(C.purple) },
    compute: (c, p) => ({ plots: { vwma: vwma(c, num(p, 'period', 20)) } }),
  },
  {
    type: 'hma',
    name: 'Hull MA',
    group: 'ma',
    pane: 'main',
    params: [periodParam(21)],
    plots: { hma: plot(C.orange) },
    compute: (c, p) => ({ plots: { hma: hma(c, num(p, 'period', 21)) } }),
  },
  {
    type: 'dema',
    name: 'Double EMA',
    group: 'ma',
    pane: 'main',
    params: [periodParam(20), sourceParam],
    plots: { dema: plot(C.teal) },
    compute: (c, p) => ({ plots: { dema: dema(c, num(p, 'period', 20), src(p)) } }),
  },
  {
    type: 'tema',
    name: 'Triple EMA',
    group: 'ma',
    pane: 'main',
    params: [periodParam(20), sourceParam],
    plots: { tema: plot(C.pink) },
    compute: (c, p) => ({ plots: { tema: tema(c, num(p, 'period', 20), src(p)) } }),
  },
  {
    type: 'ma-ribbon',
    name: 'MA Ribbon',
    group: 'ma',
    pane: 'main',
    params: [
      { key: 'period', label: 'Base period', type: 'number', default: 10, min: 2, max: 200 },
      { key: 'count', label: 'Lines', type: 'number', default: 6, min: 2, max: 12 },
      { key: 'spacing', label: 'Spacing', type: 'number', default: 10, min: 1, max: 100 },
    ],
    plots: {},
    compute: (c, p) => ({ plots: maRibbon(c, num(p, 'period', 10), num(p, 'count', 6), num(p, 'spacing', 10)) }),
  },
  {
    type: 'envelope',
    name: 'Envelope',
    group: 'ma',
    pane: 'main',
    params: [
      periodParam(20),
      { key: 'k', label: 'Percent', type: 'number', default: 2, min: 0.1, max: 20, step: 0.1 },
      sourceParam,
    ],
    plots: { upper: plot(C.gray), basis: plot(C.blue), lower: plot(C.gray) },
    compute: (c, p) => ({ plots: envelope(c, num(p, 'period', 20), num(p, 'k', 2), src(p)) }),
  },

  // ----- bands -----
  {
    type: 'bollinger',
    name: 'Bollinger Bands',
    group: 'bands',
    pane: 'main',
    params: [
      periodParam(20),
      { key: 'mult', label: 'StdDev', type: 'number', default: 2, min: 0.5, max: 5, step: 0.1 },
      sourceParam,
    ],
    plots: { upper: plot(C.gray), middle: plot(C.blue), lower: plot(C.gray) },
    compute: (c, p) => ({ plots: bollingerBands(c, num(p, 'period', 20), num(p, 'mult', 2), src(p)) }),
  },
  {
    type: 'keltner',
    name: 'Keltner Channel',
    group: 'bands',
    pane: 'main',
    params: [
      { key: 'emaPeriod', label: 'EMA period', type: 'number', default: 20, min: 2, max: 200 },
      { key: 'atrPeriod', label: 'ATR period', type: 'number', default: 10, min: 2, max: 200 },
      { key: 'mult', label: 'ATR multiplier', type: 'number', default: 2, min: 0.5, max: 5, step: 0.1 },
    ],
    plots: { upper: plot(C.teal), middle: plot(C.blue), lower: plot(C.teal) },
    compute: (c, p) => ({
      plots: keltnerChannel(c, num(p, 'emaPeriod', 20), num(p, 'atrPeriod', 10), num(p, 'mult', 2)),
    }),
  },
  {
    type: 'donchian',
    name: 'Donchian Channel',
    group: 'bands',
    pane: 'main',
    params: [periodParam(20)],
    plots: { upper: plot(C.purple), middle: plot(C.gray, 1), lower: plot(C.purple) },
    compute: (c, p) => ({ plots: donchianChannel(c, num(p, 'period', 20)) }),
  },

  // ----- oscillators -----
  {
    type: 'rsi',
    name: 'RSI',
    group: 'oscillators',
    pane: 'separate',
    params: [periodParam(14), sourceParam],
    plots: { rsi: plot(C.purple) },
    compute: (c, p) => ({ plots: { rsi: rsi(c, num(p, 'period', 14), src(p)) } }),
  },
  {
    type: 'stochastic',
    name: 'Stochastic',
    group: 'oscillators',
    pane: 'separate',
    params: [
      { key: 'kPeriod', label: '%K length', type: 'number', default: 14, min: 1, max: 200 },
      { key: 'smooth', label: '%K smooth', type: 'number', default: 3, min: 1, max: 50 },
      { key: 'dPeriod', label: '%D length', type: 'number', default: 3, min: 1, max: 50 },
    ],
    plots: { k: plot(C.blue), d: plot(C.orange) },
    compute: (c, p) => ({
      plots: (() => {
        const r = stochastic(c, num(p, 'kPeriod', 14), num(p, 'dPeriod', 3), num(p, 'smooth', 3));
        return { k: r.k, d: r.d };
      })(),
    }),
  },
  {
    type: 'stoch-rsi',
    name: 'Stochastic RSI',
    group: 'oscillators',
    pane: 'separate',
    params: [
      { key: 'rsiPeriod', label: 'RSI length', type: 'number', default: 14, min: 2, max: 200 },
      { key: 'stochPeriod', label: 'Stoch length', type: 'number', default: 14, min: 2, max: 200 },
      { key: 'kPeriod', label: '%K smooth', type: 'number', default: 3, min: 1, max: 50 },
      { key: 'dPeriod', label: '%D smooth', type: 'number', default: 3, min: 1, max: 50 },
    ],
    plots: { k: plot(C.blue), d: plot(C.orange) },
    compute: (c, p) => ({
      plots: (() => {
        const r = stochRsi(c, num(p, 'rsiPeriod', 14), num(p, 'stochPeriod', 14), num(p, 'kPeriod', 3), num(p, 'dPeriod', 3));
        return { k: r.k, d: r.d };
      })(),
    }),
  },
  {
    type: 'macd',
    name: 'MACD',
    group: 'oscillators',
    pane: 'separate',
    params: [
      { key: 'fast', label: 'Fast length', type: 'number', default: 12, min: 2, max: 200 },
      { key: 'slow', label: 'Slow length', type: 'number', default: 26, min: 3, max: 400 },
      { key: 'signal', label: 'Signal length', type: 'number', default: 9, min: 1, max: 100 },
      sourceParam,
    ],
    plots: { macd: plot(C.blue), signal: plot(C.orange), histogram: plot(C.gray, 1) },
    compute: (c, p) => ({
      plots: (() => {
        const r = macd(c, num(p, 'fast', 12), num(p, 'slow', 26), num(p, 'signal', 9), src(p));
        return { macd: r.macd, signal: r.signal, histogram: r.histogram };
      })(),
    }),
  },
  {
    type: 'cci',
    name: 'Commodity Channel Index',
    group: 'oscillators',
    pane: 'separate',
    params: [periodParam(20)],
    plots: { cci: plot(C.teal) },
    compute: (c, p) => ({ plots: { cci: cci(c, num(p, 'period', 20)) } }),
  },
  {
    type: 'williams-r',
    name: 'Williams %R',
    group: 'oscillators',
    pane: 'separate',
    params: [periodParam(14)],
    plots: { wr: plot(C.pink) },
    compute: (c, p) => ({ plots: { wr: williamsR(c, num(p, 'period', 14)) } }),
  },
  {
    type: 'roc',
    name: 'Rate of Change',
    group: 'oscillators',
    pane: 'separate',
    params: [periodParam(9), sourceParam],
    plots: { roc: plot(C.green) },
    compute: (c, p) => ({ plots: { roc: roc(c, num(p, 'period', 9), src(p)) } }),
  },
  {
    type: 'momentum',
    name: 'Momentum',
    group: 'oscillators',
    pane: 'separate',
    params: [periodParam(10), sourceParam],
    plots: { mom: plot(C.green) },
    compute: (c, p) => ({ plots: { mom: momentum(c, num(p, 'period', 10), src(p)) } }),
  },
  {
    type: 'ao',
    name: 'Awesome Oscillator',
    group: 'oscillators',
    pane: 'separate',
    params: [],
    plots: { ao: plot(C.blue) },
    compute: (c) => ({ plots: { ao: awesomeOscillator(c) } }),
  },
  {
    type: 'stddev',
    name: 'Standard Deviation',
    group: 'oscillators',
    pane: 'separate',
    params: [periodParam(20), sourceParam],
    plots: { sd: plot(C.gray) },
    compute: (c, p) => ({ plots: { sd: stdDevIndicator(c, num(p, 'period', 20), src(p)) } }),
  },

  // ----- trend -----
  {
    type: 'atr',
    name: 'Average True Range',
    group: 'trend',
    pane: 'separate',
    params: [periodParam(14)],
    plots: { atr: plot(C.orange) },
    compute: (c, p) => ({ plots: { atr: atrValues(c, num(p, 'period', 14)) } }),
  },
  {
    type: 'adx',
    name: 'ADX / DMI',
    group: 'trend',
    pane: 'separate',
    params: [
      { key: 'adxPeriod', label: 'ADX length', type: 'number', default: 14, min: 2, max: 100 },
      { key: 'diPeriod', label: 'DI length', type: 'number', default: 14, min: 2, max: 100 },
    ],
    plots: { adx: plot(C.blue), plusDI: plot(C.up, 1), minusDI: plot(C.down, 1) },
    compute: (c, p) => ({
      plots: (() => {
        const r = adx(c, num(p, 'adxPeriod', 14), num(p, 'diPeriod', 14));
        return { adx: r.adx, plusDI: r.plusDI, minusDI: r.minusDI };
      })(),
    }),
  },
  {
    type: 'psar',
    name: 'Parabolic SAR',
    group: 'trend',
    pane: 'main',
    params: [
      { key: 'step', label: 'Step', type: 'number', default: 0.02, min: 0.01, max: 0.2, step: 0.01 },
      { key: 'max', label: 'Max', type: 'number', default: 0.2, min: 0.05, max: 1, step: 0.05 },
    ],
    plots: { psar: plot(C.orange, 1) },
    compute: (c, p) => {
      const r = psar(c, num(p, 'step', 0.02), num(p, 'max', 0.2));
      return { plots: { psar: r.psar }, markers: r.markers };
    },
  },
  {
    type: 'supertrend',
    name: 'Supertrend',
    group: 'trend',
    pane: 'main',
    params: [
      { key: 'atrPeriod', label: 'ATR length', type: 'number', default: 10, min: 2, max: 100 },
      { key: 'mult', label: 'Multiplier', type: 'number', default: 3, min: 0.5, max: 10, step: 0.1 },
    ],
    plots: { supertrend: plot(C.green) },
    compute: (c, p) => {
      const r = supertrend(c, num(p, 'atrPeriod', 10), num(p, 'mult', 3));
      return { plots: { supertrend: r.supertrend }, markers: r.markers };
    },
  },
  {
    type: 'ichimoku',
    name: 'Ichimoku Cloud',
    group: 'trend',
    pane: 'main',
    params: [
      { key: 'conversion', label: 'Conversion', type: 'number', default: 9, min: 2, max: 100 },
      { key: 'base', label: 'Base', type: 'number', default: 26, min: 2, max: 200 },
      { key: 'spanB', label: 'Span B', type: 'number', default: 52, min: 2, max: 400 },
      { key: 'displacement', label: 'Displacement', type: 'number', default: 26, min: 1, max: 200 },
    ],
    plots: {
      tenkan: plot(C.blue, 1),
      kijun: plot(C.orange, 1),
      senkouA: plot(C.up, 1),
      senkouB: plot(C.down, 1),
      chikou: plot(C.purple, 1),
    },
    compute: (c, p) => {
      const r = ichimoku(c, num(p, 'conversion', 9), num(p, 'base', 26), num(p, 'spanB', 52), num(p, 'displacement', 26));
      return {
        plots: {
          tenkan: r.tenkan,
          kijun: r.kijun,
          senkouA: r.senkouA,
          senkouB: r.senkouB,
          chikou: r.chikou,
        },
        meta: { shiftPlots: 'senkouA,senkouB', displacement: r.displacement },
      };
    },
  },

  // ----- volume -----
  {
    type: 'volume',
    name: 'Volume',
    group: 'volume',
    pane: 'main',
    params: [{ key: 'maPeriod', label: 'MA period', type: 'number', default: 20, min: 1, max: 200 }],
    plots: { volume: plot(C.gray, 1), volumeMa: plot(C.orange, 1) },
    compute: (c, p) => ({ plots: volumeWithMa(c, num(p, 'maPeriod', 20)) }),
  },
  {
    type: 'vwap',
    name: 'VWAP (session)',
    group: 'volume',
    pane: 'main',
    params: [
      {
        key: 'anchor',
        label: 'Anchor',
        type: 'select',
        default: 'day',
        options: [
          { value: 'day', label: 'Daily' },
          { value: 'week', label: 'Weekly' },
          { value: 'month', label: 'Monthly' },
        ],
      },
    ],
    plots: { vwap: plot(C.pink) },
    compute: (c, p) => ({
      plots: { vwap: vwap(c, str(p, 'anchor', 'day') as 'day' | 'week' | 'month') },
    }),
  },
  {
    type: 'obv',
    name: 'On-Balance Volume',
    group: 'volume',
    pane: 'separate',
    params: [],
    plots: { obv: plot(C.blue) },
    compute: (c) => ({ plots: { obv: obv(c) } }),
  },
  {
    type: 'mfi',
    name: 'Money Flow Index',
    group: 'volume',
    pane: 'separate',
    params: [periodParam(14)],
    plots: { mfi: plot(C.purple) },
    compute: (c, p) => ({ plots: { mfi: mfi(c, num(p, 'period', 14)) } }),
  },
  {
    type: 'ad',
    name: 'Accumulation/Distribution',
    group: 'volume',
    pane: 'separate',
    params: [],
    plots: { ad: plot(C.teal) },
    compute: (c) => ({ plots: { ad: accumulationDistribution(c) } }),
  },
  {
    type: 'cmf',
    name: 'Chaikin Money Flow',
    group: 'volume',
    pane: 'separate',
    params: [periodParam(20)],
    plots: { cmf: plot(C.teal) },
    compute: (c, p) => ({ plots: { cmf: chaikinMoneyFlow(c, num(p, 'period', 20)) } }),
  },

  // ----- structure & strategy -----
  {
    type: 'sr-auto',
    name: 'Support & Resistance zones',
    group: 'structure',
    pane: 'main',
    params: [
      { key: 'strength', label: 'Pivot strength', type: 'number', default: 3, min: 1, max: 10 },
      { key: 'clusterPct', label: 'Cluster %', type: 'number', default: 0.25, min: 0.05, max: 2, step: 0.05 },
      { key: 'maxZones', label: 'Max zones', type: 'number', default: 8, min: 1, max: 20 },
    ],
    plots: {},
    compute: (c, p) => {
      const s = num(p, 'strength', 3);
      const zones = supportResistance(c, {
        left: s,
        right: s,
        clusterPct: num(p, 'clusterPct', 0.25),
        maxZones: num(p, 'maxZones', 8),
      });
      return {
        plots: {},
        zones: zones.map((z) => ({
          ...z,
          label: `${z.label} [${z.state}]`,
        })),
      };
    },
  },
  {
    type: 'mtf-sr',
    name: 'Higher-TF S/R (H4)',
    group: 'structure',
    pane: 'main',
    params: [
      { key: 'strength', label: 'Pivot strength', type: 'number', default: 3, min: 1, max: 10 },
      { key: 'clusterPct', label: 'Cluster %', type: 'number', default: 0.3, min: 0.05, max: 2, step: 0.05 },
    ],
    plots: {},
    compute: (c, p, ctx) => {
      const s = num(p, 'strength', 3);
      const resample = (ctx as { resample?: (x: Candle[]) => Candle[] }).resample;
      if (!resample) return { plots: {}, zones: [] };
      const zones = mtfSupportResistance(c, resample, {
        left: s,
        right: s,
        clusterPct: num(p, 'clusterPct', 0.3),
        maxZones: 6,
      });
      return { plots: {}, zones: zones.map((z) => ({ ...z, label: `HTF ${z.label} [${z.state}]` })) };
    },
  },
  {
    type: 'break-retest',
    name: 'Break & Retest detector',
    group: 'structure',
    pane: 'main',
    params: [
      { key: 'tolerancePct', label: 'Tolerance %', type: 'number', default: 0.15, min: 0.01, max: 2, step: 0.01 },
      { key: 'strength', label: 'Pivot strength', type: 'number', default: 3, min: 1, max: 10 },
      { key: 'maxWait', label: 'Max wait (bars)', type: 'number', default: 25, min: 3, max: 100 },
      { key: 'rr', label: 'Risk:Reward', type: 'number', default: 3, min: 1, max: 10, step: 0.5 },
    ],
    plots: {},
    compute: (c, p) => {
      const s = num(p, 'strength', 3);
      const r = breakRetest(c, {
        tolerancePct: num(p, 'tolerancePct', 0.15),
        left: s,
        right: s,
        maxWait: num(p, 'maxWait', 25),
        rr: num(p, 'rr', 3),
      });
      return { plots: {}, markers: r.markers, zones: r.zones, levels: r.levels, events: r.events };
    },
  },
  {
    type: 'supply-demand',
    name: 'Supply & Demand zones',
    group: 'structure',
    pane: 'main',
    params: [{ key: 'maxZones', label: 'Max zones', type: 'number', default: 6, min: 1, max: 15 }],
    plots: {},
    compute: (c, p) => ({ plots: {}, zones: supplyDemand(c, num(p, 'maxZones', 6)) }),
  },
  {
    type: 'order-blocks',
    name: 'Order blocks',
    group: 'structure',
    pane: 'main',
    params: [
      { key: 'impulseMult', label: 'Impulse x ATR', type: 'number', default: 1.2, min: 0.2, max: 5, step: 0.1 },
    ],
    plots: {},
    compute: (c, p) => ({ plots: {}, zones: orderBlocks(c, 14, num(p, 'impulseMult', 1.2)) }),
  },
  {
    type: 'fvg',
    name: 'Fair Value Gaps',
    group: 'structure',
    pane: 'main',
    params: [{ key: 'minGapPct', label: 'Min gap %', type: 'number', default: 0.05, min: 0.01, max: 1, step: 0.01 }],
    plots: {},
    compute: (c, p) => ({ plots: {}, zones: fairValueGaps(c, num(p, 'minGapPct', 0.05)) }),
  },
  {
    type: 'market-structure',
    name: 'Market structure (HH/HL/BOS/CHoCH)',
    group: 'structure',
    pane: 'main',
    params: [{ key: 'strength', label: 'Pivot strength', type: 'number', default: 3, min: 1, max: 10 }],
    plots: {},
    compute: (c, p) => {
      const r = marketStructure(c, num(p, 'strength', 3));
      return { plots: {}, markers: r.markers };
    },
  },
  {
    type: 'trendlines-auto',
    name: 'Auto trendlines',
    group: 'structure',
    pane: 'main',
    params: [{ key: 'strength', label: 'Pivot strength', type: 'number', default: 3, min: 1, max: 10 }],
    plots: {},
    compute: (c, p) => ({ plots: {}, lines: trendlines(c, num(p, 'strength', 3)) }),
  },
  {
    type: 'channel-auto',
    name: 'Auto channel (zigzag gated)',
    group: 'structure',
    pane: 'main',
    params: [{ key: 'strength', label: 'Pivot strength', type: 'number', default: 3, min: 1, max: 10 }],
    plots: {},
    compute: (c, p) => {
      const r = channel(c, num(p, 'strength', 3));
      const markers: import('./types').ChartMarker[] = [];
      if (r.projection) {
        markers.push({
          time: r.projection.time,
          position: 'inBar',
          color: '#f0a92e',
          shape: 'circle',
          text: 'P4 projection',
        });
      }
      return { plots: {}, lines: r.lines, markers };
    },
  },
  {
    type: 'fib-auto',
    name: 'Auto Fibonacci levels',
    group: 'structure',
    pane: 'main',
    params: [{ key: 'lookback', label: 'Lookback bars', type: 'number', default: 150, min: 30, max: 1000 }],
    plots: {},
    compute: (c, p) => ({
      plots: {},
      levels: fibonacciAuto(c, num(p, 'lookback', 150)).map((l) => ({
        price: l.price,
        label: l.label,
        kind: l.golden ? 'golden' : undefined,
      })),
    }),
  },
  {
    type: 'divergence',
    name: 'Divergence (RSI/MACD)',
    group: 'structure',
    pane: 'main',
    params: [
      {
        key: 'osc',
        label: 'Oscillator',
        type: 'select',
        default: 'rsi',
        options: [
          { value: 'rsi', label: 'RSI' },
          { value: 'macd', label: 'MACD' },
        ],
      },
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        default: 'both',
        options: [
          { value: 'regular', label: 'Regular' },
          { value: 'hidden', label: 'Hidden' },
          { value: 'both', label: 'Both' },
        ],
      },
    ],
    plots: {},
    compute: (c, p) => ({
      plots: {},
      markers: divergence(c, {
        osc: str(p, 'osc', 'rsi') as 'rsi' | 'macd',
        mode: str(p, 'mode', 'both') as 'regular' | 'hidden' | 'both',
      }),
    }),
  },
  {
    type: 'patterns',
    name: 'Candlestick patterns',
    group: 'patterns',
    pane: 'main',
    params: [],
    plots: {},
    compute: (c, p) => {
      const enabledParam = p.enabled;
      const all = new Set(Object.keys(PATTERN_NAMES) as PatternKey[]);
      const enabled =
        typeof enabledParam === 'string' && enabledParam.length > 0
          ? new Set(enabledParam.split(',') as PatternKey[])
          : all;
      return { plots: {}, markers: detectPatterns(c, enabled) };
    },
  },
  {
    type: 'pivot-points',
    name: 'Pivot Points',
    group: 'structure',
    pane: 'main',
    params: [
      {
        key: 'mode',
        label: 'Mode',
        type: 'select',
        default: 'classic',
        options: [
          { value: 'classic', label: 'Classic' },
          { value: 'fibonacci', label: 'Fibonacci' },
          { value: 'camarilla', label: 'Camarilla' },
        ],
      },
      {
        key: 'anchor',
        label: 'Anchor',
        type: 'select',
        default: 'day',
        options: [
          { value: 'day', label: 'Previous day' },
          { value: 'week', label: 'Previous week' },
          { value: 'month', label: 'Previous month' },
        ],
      },
    ],
    plots: {},
    compute: (c, p) => {
      const levels = pivotPoints(
        c,
        str(p, 'mode', 'classic') as 'classic' | 'fibonacci' | 'camarilla',
        str(p, 'anchor', 'day') as 'day' | 'week' | 'month',
      );
      if (!levels) return { plots: {} };
      return {
        plots: {},
        levels: [
          { price: levels.p, label: 'P', kind: 'pivot' },
          { price: levels.r1, label: 'R1', kind: 'resistance' },
          { price: levels.r2, label: 'R2', kind: 'resistance' },
          { price: levels.r3, label: 'R3', kind: 'resistance' },
          { price: levels.s1, label: 'S1', kind: 'support' },
          { price: levels.s2, label: 'S2', kind: 'support' },
          { price: levels.s3, label: 'S3', kind: 'support' },
        ],
      };
    },
  },
  {
    type: 'ma-confluence',
    name: 'MA 50/200 dynamic levels',
    group: 'ma',
    pane: 'main',
    params: [],
    plots: { ma50: plot(C.orange, 1), ma200: plot(C.blue, 1) },
    compute: (c) => ({
      plots: { ma50: sma(c, 50), ma200: sma(c, 200) },
    }),
  },
];

export function getDefinition(type: string): IndicatorDefinition | undefined {
  return DEFINITIONS.find((d) => d.type === type);
}

export function defaultParams(def: IndicatorDefinition): IndicatorParams {
  const out: IndicatorParams = {};
  for (const p of def.params) out[p.key] = p.default;
  return out;
}

/** Compute an indicator by type key with params filled from defaults. */
export function computeIndicator(
  type: string,
  candles: Candle[],
  params: IndicatorParams = {},
  ctx?: Record<string, unknown>,
): IndicatorOutput | null {
  const def = getDefinition(type);
  if (!def) return null;
  const merged = { ...defaultParams(def), ...params };
  return def.compute(candles, merged, ctx);
}
