import type { Candle } from '@trade/core';

export type SourceKey = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'volume';

export type PlotValues = (number | null)[];

export interface ChartMarker {
  time: number;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'circle' | 'arrowUp' | 'arrowDown' | 'square';
  text: string;
}

export interface ZoneOut {
  fromTime: number;
  toTime: number;
  top: number;
  bottom: number;
  kind:
    | 'supply'
    | 'demand'
    | 'resistance'
    | 'support'
    | 'fvg-bull'
    | 'fvg-bear'
    | 'order-block-bull'
    | 'order-block-bear';
  label?: string;
  strength?: number;
  state?: 'candidate' | 'validated' | 'invalidated' | 'mitigated';
}

export interface LineOut {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'trendline' | 'channel-upper' | 'channel-lower' | 'channel-mid' | 'projection';
  label?: string;
}

export interface LevelOut {
  price: number;
  label: string;
  kind?: string;
}

export interface BreakRetestEvent {
  direction: 'long' | 'short';
  level: number;
  zoneTop: number;
  zoneBottom: number;
  breakTime: number;
  retestTime?: number;
  confirmTime?: number;
  entry?: number;
  stop?: number;
  target?: number;
  status: 'waiting-retest' | 'retested' | 'confirmed' | 'invalidated';
}

export interface IndicatorOutput {
  plots: Record<string, PlotValues>;
  markers?: ChartMarker[];
  zones?: ZoneOut[];
  lines?: LineOut[];
  levels?: LevelOut[];
  events?: BreakRetestEvent[];
  /** Rendering hints, e.g. plot shifts for Ichimoku. */
  meta?: Record<string, string | number>;
}

export interface IndicatorParams {
  [key: string]: number | string | boolean;
}

export type IndicatorCompute = (
  candles: Candle[],
  params: IndicatorParams,
  ctx?: Record<string, unknown>,
) => IndicatorOutput;

export type ParamType = 'number' | 'source' | 'select' | 'boolean';

export interface ParamSpec {
  key: string;
  label: string;
  type: ParamType;
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
}

export interface PlotStyle {
  color: string;
  lineWidth: 1 | 2 | 3 | 4;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

export interface IndicatorDefinition {
  type: string;
  name: string;
  group: 'ma' | 'bands' | 'oscillators' | 'trend' | 'volume' | 'structure' | 'patterns';
  pane: 'main' | 'separate';
  params: ParamSpec[];
  plots: Record<string, PlotStyle>;
  compute: IndicatorCompute;
}
