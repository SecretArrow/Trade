/**
 * Pixel-space constraining helpers used while a drawing is being placed or
 * edited with the Shift modifier held (TradingView-style behaviour):
 * - lines snap their angle to multiples of 45 degrees
 * - box-like tools keep a perfect square ratio
 */

const TAU = Math.PI * 2;

function normalizeAngle(a: number): number {
  const t = a % TAU;
  return t < 0 ? t + TAU : t;
}

export interface PxPoint {
  x: number;
  y: number;
}

/**
 * Snap the direction from `base` to `target` to the nearest multiple of
 * `stepDeg` degrees while preserving the distance between the two points.
 * Returns the constrained target.
 */
export function constrainPointPx(base: PxPoint, target: PxPoint, stepDeg = 45): PxPoint {
  const dx = target.x - base.x;
  const dy = target.y - base.y;
  if (dx === 0 && dy === 0) return { ...target };
  const step = (stepDeg * Math.PI) / 180;
  const angle = normalizeAngle(Math.atan2(dy, dx));
  const snapped = Math.round(angle / step) * step;
  const len = Math.hypot(dx, dy);
  return {
    x: base.x + Math.cos(snapped) * len,
    y: base.y + Math.sin(snapped) * len,
  };
}

/**
 * Constrain `target` so that the box it forms with the fixed `opposite`
 * corner keeps equal width and height (perfect square), preserving the
 * dominant axis of the drag.
 */
export function constrainSquarePx(opposite: PxPoint, target: PxPoint): PxPoint {
  const dx = target.x - opposite.x;
  const dy = target.y - opposite.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: opposite.x + Math.sign(dx || 1) * size,
    y: opposite.y + Math.sign(dy || 1) * size,
  };
}
