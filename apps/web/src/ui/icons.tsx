import type { ReactElement } from 'react';

/**
 * Hand-crafted stroke icons for every drawing tool, drawn on a 24x24 grid
 * with round caps and currentColor so they theme automatically. No icon
 * dependency is added; glyphs follow common charting-tool conventions.
 */

const dot = (cx: number, cy: number): ReactElement => (
  <circle cx={cx} cy={cy} r={1.7} fill="currentColor" stroke="none" />
);

const GLYPHS: Record<string, ReactElement> = {
  trendline: (
    <>
      <path d="M5 18.5 L19 5.5" />
      {dot(4, 19.5)}
      {dot(20, 4.5)}
    </>
  ),
  ray: (
    <>
      <path d="M6 16.5 L21 6" />
      {dot(4.5, 17.5)}
    </>
  ),
  'extended-line': (
    <>
      <path d="M3 17 L21 7" />
      {dot(2.5, 17.5)}
      {dot(21.5, 6.5)}
    </>
  ),
  'horizontal-line': (
    <>
      <path d="M3 12 H21" />
      {dot(3, 12)}
      {dot(21, 12)}
    </>
  ),
  'horizontal-ray': (
    <>
      <path d="M6 12 H21" />
      {dot(4.5, 12)}
    </>
  ),
  'vertical-line': (
    <>
      <path d="M12 3 V21" />
      {dot(12, 3)}
      {dot(12, 21)}
    </>
  ),
  'parallel-channel': (
    <>
      <path d="M4 15 L20 7" />
      <path d="M4 20 L20 12" />
      <path d="M4 15 L4 20 M20 7 L20 12" opacity={0.55} />
    </>
  ),
  rectangle: <rect x={4} y={7} width={16} height={10} rx={1} />,
  ellipse: <ellipse cx={12} cy={12} rx={8} ry={5.5} />,
  triangle: <path d="M12 5 L20 18 H4 Z" />,
  polyline: <path d="M3 16 L9 8 L14 14 L21 6" />,
  brush: <path d="M4 19 C8 15 9 9 14 6 C16.5 4.8 18.5 5 20 6.5" />,
  arrow: (
    <>
      <path d="M5 19 L16.5 7.5" />
      <path d="M10.5 7 H17 V13.5" />
    </>
  ),
  'text-label': (
    <>
      <path d="M5 6 H19" />
      <path d="M12 6 V18" />
    </>
  ),
  'price-label': (
    <>
      <rect x={3.5} y={9} width={12} height={6} rx={1} />
      <path d="M15.5 12 H21" />
    </>
  ),
  callout: (
    <>
      <rect x={4} y={5} width={16} height={9} rx={2} />
      <path d="M9 14 V18.5 L13.5 14" />
    </>
  ),
  flag: (
    <>
      <path d="M6 4 V20" />
      <path d="M6 5 H18 L15 8.5 L18 12 H6" />
    </>
  ),
  'price-range': (
    <>
      <path d="M4 6 H20 M4 18 H20" />
      <path d="M12 8.5 V15.5 M9.5 11 L12 8.5 L14.5 11 M9.5 13 L12 15.5 L14.5 13" />
    </>
  ),
  'date-range': (
    <>
      <path d="M6 4 V20 M18 4 V20" />
      <path d="M8.5 12 H15.5 M11 9.5 L8.5 12 L11 14.5 M13 9.5 L15.5 12 L13 14.5" />
    </>
  ),
  'date-price-range': (
    <>
      <rect x={4} y={6} width={16} height={12} rx={1} />
      <path d="M8.5 15 L15.5 9 M12.5 9 H15.5 V12" />
    </>
  ),
  measure: (
    <>
      <rect x={3} y={9} width={18} height={6} rx={1} />
      <path d="M7 9 V11.5 M11 9 V11.5 M15 9 V11.5" />
    </>
  ),
  'fib-retracement': (
    <>
      <path d="M4 7 H20 M4 17 H20" />
      <path d="M5 17 L19 7" />
    </>
  ),
  'fib-extension': (
    <>
      <path d="M4 17 H20 M4 12 H20" />
      <path d="M4 19 L14 9 L20 5" strokeDasharray="0" />
      <path d="M14 9 L20 5" strokeDasharray="2.5 2.5" />
    </>
  ),
  'fib-channel': (
    <>
      <path d="M4 18 L20 10" />
      <path d="M4 13 L20 5" strokeDasharray="2.5 2.5" />
      <path d="M4 8 L20 0.5" opacity={0.5} />
    </>
  ),
  'fib-time-zones': <path d="M5 5 V19 M9.5 5 V19 M14.5 5 V19 M19 5 V19" />,
  'fib-fan': (
    <>
      <path d="M5 19 L20 16.5" />
      <path d="M5 19 L20 10.5" />
      <path d="M5 19 L14 5" />
      {dot(5, 19)}
    </>
  ),
  'fib-arcs': (
    <>
      <path d="M4 20 A8 8 0 0 1 12 12" />
      <path d="M4 20 A13 13 0 0 1 17 7" />
      <path d="M4 20 A18 18 0 0 1 22 2" />
      {dot(4, 20)}
    </>
  ),
  'gann-fan': (
    <>
      <path d="M4 20 L20 18" />
      <path d="M4 20 L20 12" />
      <path d="M4 20 L12 4" />
      {dot(4, 20)}
    </>
  ),
  'gann-box': (
    <>
      <rect x={4} y={6} width={16} height={12} rx={1} />
      <path d="M4 6 L20 18" />
    </>
  ),
  pitchfork: (
    <>
      <path d="M4 19 L11 12" />
      <path d="M11 12 L6 4.5" />
      <path d="M11 12 L14 5" />
      <path d="M11 12 L20 9" />
    </>
  ),
  'regression-trend': (
    <>
      <path d="M4 12.5 L20 10.5" />
      <path d="M4 7.5 L20 5.5" opacity={0.6} />
      <path d="M4 17.5 L20 15.5" opacity={0.6} />
      {dot(4, 12.5)}
      {dot(20, 10.5)}
    </>
  ),
  'position-long': (
    <>
      <rect x={4} y={6} width={16} height={12} rx={1} />
      <path d="M12 15 V9.5 M9.5 12 L12 9.5 L14.5 12" />
    </>
  ),
  'position-short': (
    <>
      <rect x={4} y={6} width={16} height={12} rx={1} />
      <path d="M12 9 V14.5 M9.5 12 L12 14.5 L14.5 12" />
    </>
  ),
  'anchored-vwap': (
    <>
      <path d="M4.5 17.5 C9 17.5 10 8 15 8 C17.5 8 19 10.5 21 12.5" />
      {dot(4, 17.5)}
    </>
  ),
  undo: (
    <>
      <path d="M8 4 L3 9 L8 14" />
      <path d="M3 9 H14 A6 6 0 0 1 20 15 V19" />
    </>
  ),
  redo: (
    <>
      <path d="M16 4 L21 9 L16 14" />
      <path d="M21 9 H10 A6 6 0 0 0 4 15 V19" />
    </>
  ),
  duplicate: (
    <>
      <rect x={8.5} y={8.5} width={12} height={12} rx={1.5} />
      <path d="M15.5 4 H5.5 A1.5 1.5 0 0 0 4 5.5 V15.5" />
    </>
  ),
  delete: (
    <>
      <path d="M4 7 H20" />
      <path d="M9.5 4.5 H14.5" />
      <path d="M6 7 L7.5 20 H16.5 L18 7" />
      <path d="M10 11 V16.5 M14 11 V16.5" />
    </>
  ),
  magnet: (
    <>
      <path d="M5 4 V11 A7 7 0 0 0 19 11 V4" />
      <path d="M5 4 H9 V11 A3 3 0 0 0 15 11 V4 H19" />
    </>
  ),
  'hide-all': (
    <>
      <path d="M3 12 C6 7 9 5 12 5 C15 5 18 7 21 12" />
      <path d="M3 12 C6 17 9 19 12 19 C15 19 18 17 21 12" opacity={0.55} />
      <path d="M4 4 L20 20" strokeDasharray="2.5 2" />
    </>
  ),
  'show-all': (
    <>
      <path d="M3 12 C6 7 9 5 12 5 C15 5 18 7 21 12" />
      <path d="M3 12 C6 17 9 19 12 19 C15 19 18 17 21 12" />
      {dot(12, 12)}
    </>
  ),
  'lock-all': (
    <>
      <rect x={5} y={10.5} width={14} height={9.5} rx={1.5} />
      <path d="M8 10.5 V7 A4 4 0 0 1 16 7 V10.5" />
    </>
  ),
};

export function ToolIcon(props: { tool: string; size?: number }) {
  const glyph = GLYPHS[props.tool];
  const size = props.size ?? 17;
  const tint =
    props.tool === 'position-long'
      ? 'var(--up)'
      : props.tool === 'position-short'
        ? 'var(--down)'
        : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={tint ? { color: tint } : undefined}
    >
      {glyph ?? <path d="M12 5 V19" />}
    </svg>
  );
}
