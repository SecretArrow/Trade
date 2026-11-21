import type { Anchor, Drawing } from './model';

/** Squared distance from point P to segment AB. All in pixels. */
export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function pointInRect(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  tol = 0,
): boolean {
  const left = Math.min(x1, x2) - tol;
  const right = Math.max(x1, x2) + tol;
  const top = Math.min(y1, y2) - tol;
  const bottom = Math.max(y1, y2) + tol;
  return px >= left && px <= right && py >= top && py <= bottom;
}

export function pointNearPoint(px: number, py: number, x: number, y: number, tol: number): boolean {
  return Math.hypot(px - x, py - y) <= tol;
}

export interface ProjectedDrawing {
  drawing: Drawing;
  points: { x: number; y: number }[];
}

export interface HitTestOptions {
  /** Pixel tolerance for line/edge hits. */
  tolerance?: number;
}

/**
 * Hit-test a drawing given its projected anchor points. Returns true when the
 * pointer (px, py) is within tolerance of the drawing body.
 */
export function hitTestDrawing(
  px: number,
  py: number,
  projected: ProjectedDrawing,
  options: HitTestOptions = {},
): boolean {
  const tol = options.tolerance ?? 6;
  const { drawing, points } = projected;
  if (drawing.hidden || points.length === 0) return false;

  const tool = drawing.tool;
  if (
    tool === 'rectangle' ||
    tool === 'ellipse' ||
    tool === 'price-range' ||
    tool === 'date-range' ||
    tool === 'date-price-range' ||
    tool === 'measure' ||
    tool === 'fib-retracement' ||
    tool === 'fib-extension' ||
    tool === 'gann-box' ||
    tool === 'position-long' ||
    tool === 'position-short' ||
    tool === 'fib-channel'
  ) {
    if (points.length >= 2) {
      return pointInRect(px, py, points[0].x, points[0].y, points[1].x, points[1].y, tol);
    }
    return false;
  }

  if (tool === 'horizontal-line' || tool === 'horizontal-ray') {
    return Math.abs(py - points[0].y) <= tol;
  }
  if (tool === 'vertical-line' || tool === 'fib-time-zones') {
    return Math.abs(px - points[0].x) <= tol;
  }
  if (tool === 'text-label' || tool === 'price-label' || tool === 'callout' || tool === 'flag') {
    return pointNearPoint(px, py, points[0].x, points[0].y, 12);
  }

  // polyline-like tools: any segment hit
  for (let i = 1; i < points.length; i++) {
    if (distToSegment(px, py, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y) <= tol) {
      return true;
    }
  }
  // single-point tools with a body (anchored vwap)
  if (points.length === 1) {
    return pointNearPoint(px, py, points[0].x, points[0].y, 12);
  }
  return false;
}

/** Which anchor handle (if any) is under the pointer. */
export function hitTestHandle(
  px: number,
  py: number,
  projected: ProjectedDrawing,
  tol = 8,
): number {
  for (let i = 0; i < projected.points.length; i++) {
    if (pointNearPoint(px, py, projected.points[i].x, projected.points[i].y, tol)) return i;
  }
  return -1;
}

/**
 * Move a drawing by a delta expressed in projected pixel space, remapped to
 * time/price anchors via the supplied converters.
 */
export function translateAnchors(
  anchors: Anchor[],
  dxPx: number,
  dyPx: number,
  pxToTime: (px: number) => number,
  pxToPrice: (px: number) => number,
  timeOf: (a: Anchor) => number,
  priceOf: (a: Anchor) => number,
  project: (a: Anchor) => { x: number; y: number },
): Anchor[] {
  return anchors.map((a) => {
    const p = project(a);
    return {
      time: pxToTime(p.x + dxPx) ?? timeOf(a),
      price: pxToPrice(p.y + dyPx) ?? priceOf(a),
    };
  });
}
