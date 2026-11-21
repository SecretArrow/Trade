import { describe, expect, it } from 'vitest';
import {
  distToSegment,
  hitTestDrawing,
  hitTestHandle,
  pointInRect,
  pointNearPoint,
  translateAnchors,
} from '../src/hittest';
import {
  deserializeDrawings,
  describeDrawing,
  groupBySymbol,
  nextZIndex,
  serializeDrawings,
} from '../src/serialize';
import { newDrawing, TOOL_MIN_POINTS } from '../src/model';
import { constrainPointPx, constrainSquarePx } from '../src/geometry';

describe('geometry', () => {
  it('computes distance to a segment', () => {
    expect(distToSegment(0, 0, -1, 0, 1, 0)).toBe(0);
    expect(distToSegment(0, 5, -1, 0, 1, 0)).toBe(5);
    expect(distToSegment(5, 5, -1, 0, 1, 0)).toBeCloseTo(Math.hypot(4, 5), 6);
    // degenerate segment (point)
    expect(distToSegment(3, 4, 0, 0, 0, 0)).toBe(5);
  });

  it('tests rect and point containment', () => {
    expect(pointInRect(5, 5, 0, 0, 10, 10)).toBe(true);
    expect(pointInRect(15, 5, 0, 0, 10, 10)).toBe(false);
    expect(pointInRect(5, 5, 10, 10, 0, 0)).toBe(true); // reversed corners
    // tolerance expands the rectangle on all sides
    expect(pointInRect(12, 5, 0, 0, 10, 10, 3)).toBe(true);
    expect(pointInRect(14, 5, 0, 0, 10, 10, 3)).toBe(false);
    expect(pointNearPoint(1, 1, 0, 0, 2)).toBe(true);
    expect(pointNearPoint(5, 5, 0, 0, 2)).toBe(false);
  });
});

describe('hit testing drawings', () => {
  const trendline = newDrawing(
    'trendline',
    'BTC/USDT',
    [
      { time: 100, price: 50 },
      { time: 200, price: 60 },
    ],
    1,
  );
  const rect = newDrawing(
    'rectangle',
    'BTC/USDT',
    [
      { time: 100, price: 60 },
      { time: 200, price: 50 },
    ],
    2,
  );

  it('hits a trendline near its body', () => {
    expect(
      hitTestDrawing(50, 55, {
        drawing: trendline,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
      }),
    ).toBe(true);
    expect(
      hitTestDrawing(50, 55, {
        drawing: trendline,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
      }),
    ).toBe(false);
  });

  it('hits rectangles by area', () => {
    expect(
      hitTestDrawing(50, 50, {
        drawing: rect,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
      }),
    ).toBe(true);
    expect(
      hitTestDrawing(150, 150, {
        drawing: rect,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
      }),
    ).toBe(false);
  });

  it('ignores hidden drawings', () => {
    const hidden = { ...trendline, hidden: true };
    expect(
      hitTestDrawing(50, 50, {
        drawing: hidden,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
      }),
    ).toBe(false);
  });

  it('finds anchor handles', () => {
    const projected = {
      drawing: trendline,
      points: [
        { x: 10, y: 10 },
        { x: 100, y: 40 },
      ],
    };
    expect(hitTestHandle(12, 12, projected)).toBe(0);
    expect(hitTestHandle(98, 41, projected)).toBe(1);
    expect(hitTestHandle(50, 25, projected)).toBe(-1);
  });

  it('hits horizontal lines by y distance', () => {
    const hline = newDrawing('horizontal-line', 'BTC/USDT', [{ time: 100, price: 50 }], 3);
    expect(hitTestDrawing(999, 103, { drawing: hline, points: [{ x: 0, y: 100 }] })).toBe(true);
    expect(hitTestDrawing(999, 120, { drawing: hline, points: [{ x: 0, y: 100 }] })).toBe(false);
  });

  it('translates anchors through pixel/time converters', () => {
    const anchors = [
      { time: 100, price: 50 },
      { time: 200, price: 60 },
    ];
    // identity projectors: px == time, py == price; converters shift by 1
    const moved = translateAnchors(
      anchors,
      10,
      -5,
      (px) => px,
      (py) => py,
      (a) => a.time,
      (a) => a.price,
      (a) => ({ x: a.time, y: a.price }),
    );
    expect(moved).toEqual([
      { time: 110, price: 45 },
      { time: 210, price: 55 },
    ]);
  });

  it('falls back to original time/price when converters return null', () => {
    const anchors = [{ time: 100, price: 50 }];
    const moved = translateAnchors(
      anchors,
      10,
      5,
      () => null as unknown as number,
      () => null as unknown as number,
      (a) => a.time,
      (a) => a.price,
      (a) => ({ x: a.time, y: a.price }),
    );
    expect(moved).toEqual([{ time: 100, price: 50 }]);
  });
});

describe('serialization', () => {
  it('round-trips drawings', () => {
    const drawings = [
      newDrawing(
        'trendline',
        'BTC/USDT',
        [
          { time: 1, price: 2 },
          { time: 3, price: 4 },
        ],
        1,
      ),
      newDrawing(
        'fib-retracement',
        'XAU/USD',
        [
          { time: 1, price: 2 },
          { time: 3, price: 4 },
        ],
        2,
      ),
    ];
    const restored = deserializeDrawings(serializeDrawings(drawings));
    expect(restored).toHaveLength(2);
    expect(restored[0].tool).toBe('trendline');
    expect(restored[1].symbol).toBe('XAU/USD');
  });

  it('drops malformed entries without throwing', () => {
    expect(deserializeDrawings(null)).toEqual([]);
    expect(deserializeDrawings('not json')).toEqual([]);
    expect(deserializeDrawings('{"drawings":[{"id":"x"}]}')).toEqual([]);
    expect(
      deserializeDrawings(
        '{"drawings":[{"id":"x","tool":"nope","symbol":"s","anchors":[{"time":1,"price":2}]}]}',
      ),
    ).toEqual([]);
  });

  it('computes z-index and labels', () => {
    const a = newDrawing('rectangle', 'BTC/USDT', [], 5);
    const b = newDrawing('anchored-vwap', 'BTC/USDT', [], 9);
    expect(nextZIndex([a, b])).toBe(10);
    expect(describeDrawing(a)).toBe('Rectangle');
    expect(describeDrawing(b)).toBe('Anchored VWAP');
  });

  it('groups drawings by symbol', () => {
    const a = newDrawing('rectangle', 'BTC/USDT', [], 1);
    const b = newDrawing('trendline', 'XAU/USD', [], 2);
    const c = newDrawing('ray', 'BTC/USDT', [], 3);
    const groups = groupBySymbol([a, b, c]);
    expect(Object.keys(groups).sort()).toEqual(['BTC/USDT', 'XAU/USD']);
    expect(groups['BTC/USDT']).toHaveLength(2);
    expect(groups['XAU/USD']).toHaveLength(1);
    expect(groupBySymbol([])).toEqual({});
  });

  it('declares minimum anchor counts for every tool', () => {
    const tools = Object.keys(TOOL_MIN_POINTS);
    expect(tools.length).toBeGreaterThanOrEqual(33);
    for (const tool of tools) {
      expect(TOOL_MIN_POINTS[tool as keyof typeof TOOL_MIN_POINTS]).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('geometry constraints', () => {
  it('snaps a near-horizontal drag to exactly 0 degrees', () => {
    const out = constrainPointPx({ x: 0, y: 0 }, { x: 100, y: 9 });
    expect(out.y).toBeCloseTo(0, 6);
    expect(out.x).toBeCloseTo(Math.hypot(100, 9), 5);
  });

  it('snaps to 45 degrees when closer to the diagonal', () => {
    const out = constrainPointPx({ x: 0, y: 0 }, { x: 100, y: 80 });
    expect(out.x).toBeCloseTo(out.y, 6);
  });

  it('snaps to 90 degrees for a mostly vertical drag', () => {
    const out = constrainPointPx({ x: 10, y: 10 }, { x: 12, y: 110 });
    expect(out.x).toBeCloseTo(10, 6);
    // distance from base is preserved: hypot(2, 100)
    expect(out.y).toBeCloseTo(10 + Math.hypot(2, 100), 5);
  });

  it('keeps the point unchanged at the base', () => {
    expect(constrainPointPx({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });

  it('constrains a rectangle drag to a square on the dominant axis', () => {
    const out = constrainSquarePx({ x: 0, y: 0 }, { x: 80, y: 30 });
    expect(Math.abs(out.x)).toBe(80);
    expect(Math.abs(out.y)).toBe(80);
  });

  it('constrains upward-left drags too', () => {
    const out = constrainSquarePx({ x: 100, y: 100 }, { x: 20, y: 90 });
    // dx = -80 dominates, so both sides become 80 long
    expect(out.x).toBe(20);
    expect(out.y).toBe(20);
  });
});
