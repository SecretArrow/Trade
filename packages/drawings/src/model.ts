export type DrawingTool =
  | 'trendline'
  | 'ray'
  | 'extended-line'
  | 'horizontal-line'
  | 'horizontal-ray'
  | 'vertical-line'
  | 'parallel-channel'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'polyline'
  | 'brush'
  | 'arrow'
  | 'text-label'
  | 'price-label'
  | 'price-range'
  | 'date-range'
  | 'date-price-range'
  | 'measure'
  | 'fib-retracement'
  | 'fib-extension'
  | 'fib-channel'
  | 'fib-time-zones'
  | 'fib-fan'
  | 'fib-arcs'
  | 'gann-fan'
  | 'gann-box'
  | 'pitchfork'
  | 'regression-trend'
  | 'position-long'
  | 'position-short'
  | 'anchored-vwap'
  | 'callout'
  | 'flag';

export interface Anchor {
  /** UTC seconds. */
  time: number;
  price: number;
}

export interface DrawingStyle {
  color: string;
  fill?: string;
  opacity: number;
  lineWidth: number;
  dash: 'solid' | 'dashed' | 'dotted';
}

export interface Drawing {
  id: string;
  tool: DrawingTool;
  symbol: string;
  anchors: Anchor[];
  style: DrawingStyle;
  text?: string;
  locked: boolean;
  hidden: boolean;
  /** Extra tool-specific settings (fib levels, position size, ...). */
  meta?: Record<string, number | string | boolean>;
  zIndex: number;
  createdAt: number;
}

export const TOOL_MIN_POINTS: Record<DrawingTool, number> = {
  trendline: 2,
  ray: 2,
  'extended-line': 2,
  'horizontal-line': 1,
  'horizontal-ray': 1,
  'vertical-line': 1,
  'parallel-channel': 3,
  rectangle: 2,
  ellipse: 2,
  triangle: 3,
  polyline: 2,
  brush: 1,
  arrow: 2,
  'text-label': 1,
  'price-label': 1,
  'price-range': 2,
  'date-range': 2,
  'date-price-range': 2,
  measure: 2,
  'fib-retracement': 2,
  'fib-extension': 2,
  'fib-channel': 3,
  'fib-time-zones': 1,
  'fib-fan': 2,
  'fib-arcs': 2,
  'gann-fan': 1,
  'gann-box': 2,
  pitchfork: 3,
  'regression-trend': 2,
  'position-long': 2,
  'position-short': 2,
  'anchored-vwap': 1,
  callout: 1,
  flag: 1,
};

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
export const FIB_EXTENSION_LEVELS = [1, 1.272, 1.618, 2, 2.618];

export function defaultStyle(color = '#4f8cff'): DrawingStyle {
  return { color, opacity: 0.85, lineWidth: 1.5, dash: 'solid' };
}

export function newDrawing(
  tool: DrawingTool,
  symbol: string,
  anchors: Anchor[],
  zIndex: number,
  color = '#4f8cff',
): Drawing {
  return {
    id: `d${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    tool,
    symbol,
    anchors,
    style: defaultStyle(color),
    locked: false,
    hidden: false,
    zIndex,
    createdAt: Date.now(),
  };
}
