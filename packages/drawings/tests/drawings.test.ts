import { describe, expect, it } from 'vitest';
import {
  distToSegment,
  hitTestDrawing,
  hitTestHandle,
  pointInRect,
  pointNearPoint,
} from '../src/hittest';
import {
  deserializeDrawings,
  describeDrawing,
  nextZIndex,
  serializeDrawings,
} from '../src/serialize';
import { newDrawing, TOOL_MIN_POINTS } from '../src/model';

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

  it('declares minimum anchor counts for every tool', () => {
    const tools = Object.keys(TOOL_MIN_POINTS);
    expect(tools.length).toBeGreaterThanOrEqual(33);
    for (const tool of tools) {
      expect(TOOL_MIN_POINTS[tool as keyof typeof TOOL_MIN_POINTS]).toBeGreaterThanOrEqual(1);
    }
  });
});
