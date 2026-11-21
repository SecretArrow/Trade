import type { Anchor, Drawing, DrawingTool } from './model';
import { TOOL_MIN_POINTS } from './model';

export const DRAWINGS_SCHEMA_VERSION = 1;

export interface SerializedDrawings {
  version: number;
  drawings: Drawing[];
}

const TOOL_SET = new Set<string>(Object.keys(TOOL_MIN_POINTS));

function isAnchor(value: unknown): value is Anchor {
  if (typeof value !== 'object' || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.time === 'number' &&
    Number.isFinite(a.time) &&
    typeof a.price === 'number' &&
    Number.isFinite(a.price)
  );
}

function isDrawing(value: unknown): value is Drawing {
  if (typeof value !== 'object' || value === null) return false;
  const d = value as Record<string, unknown>;
  return (
    typeof d.id === 'string' &&
    typeof d.tool === 'string' &&
    TOOL_SET.has(d.tool) &&
    typeof d.symbol === 'string' &&
    Array.isArray(d.anchors) &&
    (d.anchors as unknown[]).every(isAnchor)
  );
}

/** Parse persisted drawings, dropping anything malformed. Never throws. */
export function deserializeDrawings(raw: string | null): Drawing[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { drawings?: unknown };
    if (!Array.isArray(parsed.drawings)) return [];
    return parsed.drawings.filter(isDrawing);
  } catch {
    return [];
  }
}

export function serializeDrawings(drawings: Drawing[]): string {
  const payload: SerializedDrawings = { version: DRAWINGS_SCHEMA_VERSION, drawings };
  return JSON.stringify(payload);
}

/** Group drawings by symbol for per-instrument persistence. */
export function groupBySymbol(drawings: Drawing[]): Record<string, Drawing[]> {
  const out: Record<string, Drawing[]> = {};
  for (const d of drawings) {
    (out[d.symbol] ??= []).push(d);
  }
  return out;
}

export function nextZIndex(drawings: Drawing[]): number {
  return drawings.reduce((max, d) => Math.max(max, d.zIndex), 0) + 1;
}

/** Human-readable summary used by the object tree. */
export function describeDrawing(d: Drawing): string {
  const labels: Partial<Record<DrawingTool, string>> = {
    trendline: 'Trend line',
    ray: 'Ray',
    'extended-line': 'Extended line',
    'horizontal-line': 'Horizontal line',
    'horizontal-ray': 'Horizontal ray',
    'vertical-line': 'Vertical line',
    'parallel-channel': 'Parallel channel',
    rectangle: 'Rectangle',
    ellipse: 'Ellipse',
    triangle: 'Triangle',
    polyline: 'Path',
    brush: 'Brush',
    arrow: 'Arrow',
    'text-label': 'Text',
    'price-label': 'Price label',
    'price-range': 'Price range',
    'date-range': 'Date range',
    'date-price-range': 'Date & price range',
    measure: 'Measure',
    'fib-retracement': 'Fib retracement',
    'fib-extension': 'Fib extension',
    'fib-channel': 'Fib channel',
    'fib-time-zones': 'Fib time zones',
    'fib-fan': 'Fib fan',
    'fib-arcs': 'Fib arcs',
    'gann-fan': 'Gann fan',
    'gann-box': 'Gann box',
    pitchfork: 'Andrews pitchfork',
    'regression-trend': 'Regression trend',
    'position-long': 'Long position',
    'position-short': 'Short position',
    'anchored-vwap': 'Anchored VWAP',
    callout: 'Callout',
    flag: 'Flag',
  };
  const base = labels[d.tool] ?? d.tool;
  return d.text ? `${base}: ${d.text}` : base;
}
