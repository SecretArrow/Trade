import type { Candle, ThemeName } from '@trade/core';
import { formatPct, formatPrice } from '@trade/core';
import type {
  Coordinate,
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  Logical,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import type { Anchor, Drawing, DrawingTool } from '@trade/drawings';
import { FIB_EXTENSION_LEVELS, FIB_LEVELS, newDrawing } from '@trade/drawings';
import type { IndicatorOutput } from '@trade/indicators';

/**
 * Rendering engine for chart drawings, implemented as a lightweight-charts
 * series primitive. Everything (indicator zones, user drawings, placement
 * previews, selection handles, the transient measure tool) is painted inside
 * the chart's own render loop, so drawings stay perfectly glued to the
 * candles while the chart is panned, zoomed or rescaled.
 */

export interface OverlayOutputsEntry {
  id: string;
  type: string;
  output: IndicatorOutput | null;
}

export interface OverlayFrame {
  symbol: string;
  theme: ThemeName;
  tfSeconds: number;
  magnet: boolean;
  activeTool: string | null;
  /** Symbol-filtered drawings, zIndex ascending. */
  drawings: Drawing[];
  selectedId: string | null;
  hoverId: string | null;
  /** Anchors placed so far for a multi-click tool. */
  pending: Anchor[];
  /** Live cursor anchor (snapped) while a tool is armed. */
  cursor: Anchor | null;
  /** Points collected so far during a brush stroke. */
  brushLive: Anchor[];
  /** Live anchors override while a drawing is being dragged. */
  liveAnchors: Anchor[] | null;
  liveDrawingId: string | null;
  /** Transient measure box. */
  measure: { from: Anchor; to: Anchor } | null;
  candlesRef: { current: Candle[] };
  outputsRef: { current: OverlayOutputsEntry[] };
}

export function createOverlayFrame(): OverlayFrame {
  return {
    symbol: '',
    theme: 'dark',
    tfSeconds: 900,
    magnet: false,
    activeTool: null,
    drawings: [],
    selectedId: null,
    hoverId: null,
    pending: [],
    cursor: null,
    brushLive: [],
    liveAnchors: null,
    liveDrawingId: null,
    measure: null,
    candlesRef: { current: [] },
    outputsRef: { current: [] },
  };
}

/** Tools whose selection shows an extra midpoint (move) handle. */
export const MIDPOINT_TOOLS = new Set(['trendline', 'ray', 'extended-line', 'arrow']);

const ZONE_COLORS: Record<string, { fill: string; stroke: string }> = {
  supply: { fill: 'rgba(239,83,80,0.10)', stroke: '#ef5350' },
  demand: { fill: 'rgba(38,166,154,0.10)', stroke: '#26a69a' },
  resistance: { fill: 'rgba(79,140,255,0.08)', stroke: '#4f8cff' },
  support: { fill: 'rgba(79,140,255,0.08)', stroke: '#4f8cff' },
  'fvg-bull': { fill: 'rgba(38,198,218,0.10)', stroke: '#26c6da' },
  'fvg-bear': { fill: 'rgba(236,64,122,0.10)', stroke: '#ec407a' },
  'order-block-bull': { fill: 'rgba(102,187,106,0.10)', stroke: '#66bb6a' },
  'order-block-bear': { fill: 'rgba(255,183,77,0.10)', stroke: '#ffb74d' },
};

const FONT = '11px system-ui, sans-serif';
const FONT_MEDIUM = '600 11px system-ui, sans-serif';
const ACCENT = '#4f8cff';
const UP_COLOR = '#26a69a';
const DOWN_COLOR = '#ef5350';

interface Px {
  x: number;
  y: number;
}

/** Convert a time to a (possibly fractional) bar index within the candles. */
export function barIndexOf(time: number, candles: Candle[], tfSeconds: number): number {
  if (candles.length === 0) return 0;
  const first = candles[0].time;
  const last = candles[candles.length - 1].time;
  if (time <= first) return (time - first) / tfSeconds;
  if (time >= last) return candles.length - 1 + (time - last) / tfSeconds;
  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time < time) lo = mid + 1;
    else hi = mid;
  }
  return candles[lo].time === time ? lo : lo - 0.5;
}

export class DrawingsPrimitive implements ISeriesPrimitive<Time> {
  readonly frame: OverlayFrame = createOverlayFrame();

  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;

  private readonly rendererObj: ISeriesPrimitivePaneRenderer = {
    draw: (target: CanvasRenderingTarget2D) => this.drawAll(target),
  };
  private readonly paneView: ISeriesPrimitivePaneView = {
    zOrder: () => 'normal',
    renderer: () => this.rendererObj,
  };
  private readonly views: ISeriesPrimitivePaneView[] = [this.paneView];

  private readonly memoTime = new Map<number, number | null>();
  private readonly memoPrice = new Map<number, number | null>();

  // ---- lifecycle ----------------------------------------------------------

  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  paneViews(): readonly ISeriesPrimitivePaneView[] {
    return this.views;
  }

  /** Ask the chart for a repaint (used by the interaction controller). */
  requestRepaint(): void {
    this.requestUpdate?.();
  }

  // ---- coordinate mapping (safe to call inside and outside draw) ---------

  timeToX(time: number): number | null {
    const hit = this.memoTime.get(time);
    if (hit !== undefined) return hit;
    let x: number | null = null;
    const ts = this.chart?.timeScale();
    const candles = this.frame.candlesRef.current;
    if (ts && candles.length > 0) {
      const logical = barIndexOf(time, candles, this.frame.tfSeconds);
      x = ts.logicalToCoordinate(logical as Logical) as number | null;
    }
    this.memoTime.set(time, x);
    return x;
  }

  priceToY(price: number): number | null {
    const hit = this.memoPrice.get(price);
    if (hit !== undefined) return hit;
    const y = this.series ? (this.series.priceToCoordinate(price) as number | null) : null;
    this.memoPrice.set(price, y);
    return y;
  }

  /** Map a pixel x to the snapped candle time (`exact` keeps fractions). */
  xToTime(x: number, exact = false): number | null {
    const ts = this.chart?.timeScale();
    if (!ts) return null;
    const logical = ts.coordinateToLogical(x as Coordinate);
    if (logical === null) return null;
    const l = logical as number;
    const candles = this.frame.candlesRef.current;
    if (candles.length === 0) return null;
    if (exact) {
      const i = Math.min(candles.length - 1, Math.max(0, Math.round(l)));
      return candles[i].time + (l - i) * this.frame.tfSeconds;
    }
    const idx = Math.round(l);
    if (idx >= 0 && idx < candles.length) return candles[idx].time;
    if (idx < 0) return candles[0].time + l * this.frame.tfSeconds;
    const last = candles.length - 1;
    return candles[last].time + (l - last) * this.frame.tfSeconds;
  }

  yToPrice(y: number): number | null {
    if (!this.series) return null;
    return this.series.coordinateToPrice(y as Coordinate) as number | null;
  }

  /** A sensible per-keypress price step for arrow-key nudging (~1/60 of view). */
  priceNudgeStep(): number {
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return 0;
    const size = chart.paneSize();
    const top = series.coordinateToPrice(0 as Coordinate) as number | null;
    const bottom = series.coordinateToPrice(size.height as Coordinate) as number | null;
    if (top === null || bottom === null || size.height === 0) return 0;
    return Math.abs(top - bottom) / 60;
  }

  projectAnchors(anchors: Anchor[]): Px[] {
    return anchors.map((a) => ({
      x: this.timeToX(a.time) ?? -9999,
      y: this.priceToY(a.price) ?? -9999,
    }));
  }

  timeToLogical(time: number): number {
    return barIndexOf(time, this.frame.candlesRef.current, this.frame.tfSeconds);
  }

  // ---- rendering ----------------------------------------------------------

  private drawAll(target: CanvasRenderingTarget2D): void {
    const f = this.frame;
    const chart = this.chart;
    const series = this.series;
    if (!chart || !series) return;
    target.useMediaCoordinateSpace((scope) => {
      const ctx = scope.context;
      const w = scope.mediaSize.width;
      const h = scope.mediaSize.height;
      if (w <= 0 || h <= 0) return;
      const ts = chart.timeScale();
      const range = ts.getVisibleLogicalRange();
      if (range === null) return;

      this.memoTime.clear();
      this.memoPrice.clear();

      const isLight = f.theme === 'light';
      const textColor = isLight ? '#131722' : '#c8ccd4';
      const chipBg = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(11,14,20,0.78)';

      ctx.font = FONT;
      ctx.textBaseline = 'alphabetic';

      const ctxTools: RenderCtx = {
        ctx,
        w,
        h,
        textColor,
        chipBg,
        frame: f,
        candles: f.candlesRef.current,
        tfSeconds: f.tfSeconds,
        project: (a) => ({ x: this.timeToX(a.time) ?? -9999, y: this.priceToY(a.price) ?? -9999 }),
      };

      // 1. indicator zones and lines (below drawings)
      renderOutputs(ctxTools);

      // 2. user drawings
      const margin = 30;
      for (const d of f.drawings) {
        if (d.hidden) continue;
        const anchors = d.id === f.liveDrawingId && f.liveAnchors ? f.liveAnchors : d.anchors;
        if (!isDrawingVisible(d, anchors, range.from as number, range.to as number, margin, f))
          continue;
        renderDrawing(ctxTools, d, anchors);
      }

      // 3. pending preview / live brush / magnet dot
      renderPending(ctxTools);
      renderBrush(ctxTools);
      renderCursorDot(ctxTools);

      // 4. transient measure
      if (f.measure) renderMeasure(ctxTools, f.measure.from, f.measure.to);

      // 5. selection handles on top
      renderSelection(ctxTools);
    });
  }
}

// ---- culling --------------------------------------------------------------

const X_SPANNING_TOOLS = new Set(['horizontal-line', 'horizontal-ray']);
const RIGHT_EXTENDING_TOOLS = new Set(['anchored-vwap', 'fib-time-zones']);

function isDrawingVisible(
  d: Drawing,
  anchors: Anchor[],
  from: number,
  to: number,
  margin: number,
  f: OverlayFrame,
): boolean {
  if (X_SPANNING_TOOLS.has(d.tool)) return true;
  const logicals = anchors.map((a) => barIndexOf(a.time, f.candlesRef.current, f.tfSeconds));
  if (RIGHT_EXTENDING_TOOLS.has(d.tool)) return logicals[0] <= to + margin;
  if (logicals.length === 0) return true;
  const min = Math.min(...logicals);
  const max = Math.max(...logicals);
  return !(max < from - margin || min > to + margin);
}

// ---- render context + shared helpers ---------------------------------------

interface RenderCtx {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  textColor: string;
  chipBg: string;
  frame: OverlayFrame;
  candles: Candle[];
  tfSeconds: number;
  project: (a: Anchor) => Px;
}

function dashOf(ctx: CanvasRenderingContext2D, d: Drawing): void {
  ctx.setLineDash(d.style.dash === 'dashed' ? [6, 4] : d.style.dash === 'dotted' ? [2, 3] : []);
}

function drawChip(c: RenderCtx, x: number, y: number, text: string, bg: string, fg: string): void {
  const { ctx } = c;
  const pad = 4;
  const wTxt = ctx.measureText(text).width;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y - 9, wTxt + pad * 2, 15);
  ctx.fillStyle = fg;
  ctx.fillText(text, x + pad, y + 2);
}

// ---- indicator outputs ------------------------------------------------------

function renderOutputs(c: RenderCtx): void {
  const { ctx } = c;
  for (const entry of c.frame.outputsRef.current) {
    const out = entry.output;
    if (!out) continue;
    for (const zone of out.zones ?? []) {
      const pTop = c.project({ time: zone.fromTime, price: zone.top });
      const pBottom = c.project({ time: zone.fromTime, price: zone.bottom });
      const x1 = c.project({ time: zone.fromTime, price: zone.top }).x;
      const x2 = c.project({ time: zone.toTime, price: zone.top }).x;
      if (x1 === -9999 || x2 === -9999) continue;
      const colors = ZONE_COLORS[zone.kind] ?? ZONE_COLORS.support;
      ctx.fillStyle = colors.fill;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1;
      const left = Math.min(x1, x2);
      const top = Math.min(pTop.y, pBottom.y);
      const zw = Math.abs(x2 - x1);
      const zh = Math.abs(pBottom.y - pTop.y);
      ctx.fillRect(left, top, zw, zh);
      ctx.strokeRect(left, top, zw, zh);
      if (zone.label) {
        ctx.fillStyle = colors.stroke;
        ctx.fillText(zone.label, left + 4, top + 11);
      }
    }
    for (const line of out.lines ?? []) {
      const p1 = c.project({ time: line.x1, price: line.y1 });
      const p2 = c.project({ time: line.x2, price: line.y2 });
      if (p1.x === -9999 || p2.x === -9999) continue;
      ctx.strokeStyle = line.kind === 'channel-mid' ? '#f0a92e' : '#b46cff';
      ctx.setLineDash(line.kind === 'channel-mid' ? [4, 4] : []);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
      if (line.label) {
        ctx.fillStyle = c.textColor;
        ctx.fillText(line.label, p2.x + 4, p2.y - 3);
      }
    }
  }
}

// ---- user drawings ----------------------------------------------------------

function renderDrawing(c: RenderCtx, d: Drawing, anchors: Anchor[]): void {
  const { ctx } = c;
  const f = c.frame;
  const p = anchors.map(c.project);
  if (p.length === 0) return;
  const selected = d.id === f.selectedId;
  const hovered = d.id === f.hoverId && !selected;

  ctx.save();
  ctx.strokeStyle = d.style.color;
  ctx.fillStyle = d.style.color;
  ctx.lineWidth = d.style.lineWidth + (hovered ? 0.75 : 0);
  ctx.globalAlpha = hovered ? Math.min(1, d.style.opacity + 0.15) : d.style.opacity;
  if (selected) {
    ctx.shadowColor = d.style.color;
    ctx.shadowBlur = 6;
  }
  dashOf(ctx, d);

  drawToolShape(c, d, p, anchors);

  ctx.restore();
}

function drawToolShape(c: RenderCtx, d: Drawing, p: Px[], anchors: Anchor[]): void {
  const { ctx } = c;
  const line = (a: Px, b: Px) => {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  const diagonal = Math.hypot(c.w, c.h) + 10;
  const extendFrom = (a: Px, b: Px, back: boolean): void => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const scale = diagonal / len;
    line(a, { x: a.x + dx * scale, y: a.y + dy * scale });
    if (back) line(a, { x: a.x - dx * scale, y: a.y - dy * scale });
  };

  switch (d.tool) {
    case 'trendline':
      if (p.length >= 2) line(p[0], p[1]);
      break;
    case 'ray':
      if (p.length >= 2) extendFrom(p[0], p[1], false);
      break;
    case 'extended-line':
      if (p.length >= 2) extendFrom(p[0], p[1], true);
      break;
    case 'horizontal-line':
      if (p.length >= 1) line({ x: 0, y: p[0].y }, { x: c.w, y: p[0].y });
      break;
    case 'horizontal-ray':
      if (p.length >= 1) line({ x: p[0].x, y: p[0].y }, { x: c.w, y: p[0].y });
      break;
    case 'vertical-line':
      if (p.length >= 1) line({ x: p[0].x, y: 0 }, { x: p[0].x, y: c.h });
      break;
    case 'parallel-channel': {
      if (p.length >= 3) {
        line(p[0], p[1]);
        const dy = p[2].y - p[1].y;
        const dx = p[2].x - p[1].x;
        line({ x: p[0].x + dx, y: p[0].y + dy }, { x: p[1].x + dx, y: p[1].y + dy });
        ctx.globalAlpha = d.style.opacity * (d.style.fill ? 0.18 : 0.08);
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[1].x, p[1].y);
        ctx.lineTo(p[1].x + dx, p[1].y + dy);
        ctx.lineTo(p[0].x + dx, p[0].y + dy);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = d.style.opacity;
      }
      break;
    }
    case 'rectangle':
    case 'price-range':
    case 'date-range':
    case 'date-price-range': {
      if (p.length >= 2) {
        const x = Math.min(p[0].x, p[1].x);
        const y = Math.min(p[0].y, p[1].y);
        const bw = Math.abs(p[1].x - p[0].x);
        const bh = Math.abs(p[1].y - p[0].y);
        if (d.style.fill) {
          ctx.globalAlpha = d.style.opacity * 0.16;
          ctx.fillRect(x, y, bw, bh);
          ctx.globalAlpha = d.style.opacity;
        }
        ctx.strokeRect(x, y, bw, bh);
        if (d.tool === 'price-range' && anchors.length >= 2) {
          const diff = anchors[1].price - anchors[0].price;
          const pct = (diff / anchors[0].price) * 100;
          drawChip(
            c,
            x,
            y - 8,
            `${formatPrice(diff, 2)} (${formatPct(pct)})`,
            diff >= 0 ? 'rgba(38,166,154,0.9)' : 'rgba(239,83,80,0.9)',
            '#ffffff',
          );
        }
      }
      break;
    }
    case 'ellipse': {
      if (p.length >= 2) {
        const x = Math.min(p[0].x, p[1].x);
        const y = Math.min(p[0].y, p[1].y);
        const bw = Math.abs(p[1].x - p[0].x);
        const bh = Math.abs(p[1].y - p[0].y);
        ctx.beginPath();
        ctx.ellipse(x + bw / 2, y + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
        if (d.style.fill) {
          ctx.globalAlpha = d.style.opacity * 0.16;
          ctx.fill();
          ctx.globalAlpha = d.style.opacity;
        }
        ctx.stroke();
      }
      break;
    }
    case 'triangle': {
      if (p.length >= 3) {
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[1].x, p[1].y);
        ctx.lineTo(p[2].x, p[2].y);
        ctx.closePath();
        if (d.style.fill) {
          ctx.globalAlpha = d.style.opacity * 0.16;
          ctx.fill();
          ctx.globalAlpha = d.style.opacity;
        }
        ctx.stroke();
      }
      break;
    }
    case 'polyline':
    case 'brush': {
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
      ctx.stroke();
      break;
    }
    case 'arrow': {
      if (p.length >= 2) {
        line(p[0], p[1]);
        const angle = Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
        const size = Math.max(9, 3 + d.style.lineWidth * 2.5);
        ctx.beginPath();
        ctx.moveTo(p[1].x, p[1].y);
        ctx.lineTo(p[1].x - size * Math.cos(angle - 0.42), p[1].y - size * Math.sin(angle - 0.42));
        ctx.lineTo(p[1].x - size * Math.cos(angle + 0.42), p[1].y - size * Math.sin(angle + 0.42));
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'text-label': {
      if (!d.text) break;
      ctx.fillStyle = c.textColor;
      const lines = d.text.split('\n');
      lines.forEach((t, i) => ctx.fillText(t, p[0].x + 6, p[0].y - 6 + i * 14));
      break;
    }
    case 'callout': {
      if (d.text) {
        const lines = d.text.split('\n');
        const widest = Math.max(...lines.map((t) => ctx.measureText(t).width));
        const boxH = lines.length * 14 + 8;
        const bx = p[0].x + 10;
        const by = p[0].y - 12 - boxH;
        line(p[0], { x: bx, y: by + boxH });
        ctx.fillStyle = c.chipBg;
        ctx.fillRect(bx, by, widest + 12, boxH);
        ctx.strokeStyle = d.style.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, widest + 12, boxH);
        ctx.fillStyle = c.textColor;
        lines.forEach((t, i) => ctx.fillText(t, bx + 6, by + 14 + i * 14));
      }
      break;
    }
    case 'price-label': {
      const label = formatPrice(anchors[0]?.price ?? 0, 2);
      drawChip(c, p[0].x, p[0].y, label, d.style.color, '#ffffff');
      break;
    }
    case 'fib-retracement':
    case 'fib-extension': {
      if (p.length >= 2 && anchors.length >= 2) {
        const levels = d.tool === 'fib-retracement' ? FIB_LEVELS : FIB_EXTENSION_LEVELS;
        const x1 = Math.min(p[0].x, p[1].x);
        const x2 = Math.max(p[0].x, p[1].x);
        const prev: { y: number; price: number }[] = [];
        for (const level of levels) {
          const price = anchors[0].price + (anchors[1].price - anchors[0].price) * level;
          const y = c.project({ time: anchors[0].time, price }).y;
          if (y === -9999) continue;
          ctx.strokeStyle = level === 0.618 || level === 1.618 ? '#f0a92e' : d.style.color;
          line({ x: x1, y }, { x: x2, y });
          const last = prev[prev.length - 1];
          if (last && d.style.fill) {
            ctx.globalAlpha = d.style.opacity * 0.07;
            ctx.fillStyle = d.style.color;
            ctx.fillRect(x1, Math.min(last.y, y), x2 - x1, Math.abs(y - last.y));
            ctx.globalAlpha = d.style.opacity;
          }
          prev.push({ y, price });
          drawChip(
            c,
            x2 + 4,
            y,
            `${(level * 100).toFixed(1)}% · ${formatPrice(price, 2)}`,
            c.chipBg,
            c.textColor,
          );
        }
      }
      break;
    }
    case 'fib-channel': {
      if (p.length >= 3) {
        for (const r of [0.382, 0.5, 0.618, 1]) {
          const dy = (p[2].y - p[1].y) * r;
          const dx = (p[2].x - p[1].x) * r;
          line({ x: p[0].x + dx, y: p[0].y + dy }, { x: p[1].x + dx, y: p[1].y + dy });
        }
      }
      break;
    }
    case 'fib-fan':
    case 'gann-fan': {
      if (p.length < 2) break;
      const ratios =
        d.tool === 'fib-fan' ? [0.382, 0.5, 0.618, 1] : [1 / 8, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 8];
      for (const r of ratios) {
        line(p[0], { x: p[1].x, y: p[0].y + (p[1].y - p[0].y) * r });
      }
      break;
    }
    case 'fib-arcs': {
      if (p.length < 2) break;
      const radius = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      for (const r of [0.382, 0.5, 0.618, 1]) {
        ctx.beginPath();
        ctx.arc(p[0].x, p[0].y, radius * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'fib-time-zones': {
      for (const n of [1, 2, 3, 5, 8, 13, 21, 34]) {
        const t = (anchors[0]?.time ?? 0) + n * c.tfSeconds;
        const x = c.project({ time: t, price: anchors[0]?.price ?? 0 }).x;
        if (x === -9999) continue;
        line({ x, y: 0 }, { x, y: c.h });
        ctx.fillStyle = c.textColor;
        ctx.fillText(String(n), x + 3, 14);
      }
      break;
    }
    case 'gann-box': {
      if (p.length < 2) break;
      const x = Math.min(p[0].x, p[1].x);
      const y = Math.min(p[0].y, p[1].y);
      const bw = Math.abs(p[1].x - p[0].x);
      const bh = Math.abs(p[1].y - p[0].y);
      if (d.style.fill) {
        ctx.globalAlpha = d.style.opacity * 0.12;
        ctx.fillRect(x, y, bw, bh);
        ctx.globalAlpha = d.style.opacity;
      }
      ctx.strokeRect(x, y, bw, bh);
      for (const fr of [0.25, 0.5, 0.75]) {
        line({ x: x + bw * fr, y }, { x: x + bw * fr, y: y + bh });
        line({ x, y: y + bh * fr }, { x: x + bw, y: y + bh * fr });
      }
      line({ x, y }, { x: x + bw, y: y + bh });
      line({ x, y: y + bh }, { x: x + bw, y });
      break;
    }
    case 'pitchfork': {
      if (p.length < 3) break;
      const midX = (p[1].x + p[2].x) / 2;
      const midY = (p[1].y + p[2].y) / 2;
      const dx = midX - p[0].x;
      const dy = midY - p[0].y;
      const scale = 3;
      line(p[0], { x: midX + dx * scale, y: midY + dy * scale });
      const tdx = (p[2].x - p[1].x) / 2;
      const tdy = (p[2].y - p[1].y) / 2;
      line(
        { x: midX - tdx, y: midY - tdy },
        { x: midX + dx * scale - tdx, y: midY + dy * scale - tdy },
      );
      line(
        { x: midX + tdx, y: midY + tdy },
        { x: midX + dx * scale + tdx, y: midY + dy * scale + tdy },
      );
      break;
    }
    case 'regression-trend': {
      if (p.length < 2) break;
      const from = anchors[0].time;
      const to = anchors[1].time;
      const slice = c.candles.filter((cd) => cd.time >= from && cd.time <= to);
      if (slice.length < 2) break;
      const n = slice.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;
      slice.forEach((cd, i) => {
        sumX += i;
        sumY += cd.close;
        sumXY += i * cd.close;
        sumXX += i * i;
      });
      const denom = n * sumXX - sumX * sumX;
      const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
      const intercept = (sumY - slope * sumX) / n;
      const y0 = c.project({ time: from, price: intercept }).y;
      const y1 = c.project({ time: to, price: intercept + slope * (n - 1) }).y;
      if (y0 === -9999 || y1 === -9999) break;
      line({ x: p[0].x, y: y0 }, { x: p[1].x, y: y1 });
      break;
    }
    case 'position-long':
    case 'position-short': {
      if (anchors.length < 2) break;
      const isLong = d.tool === 'position-long';
      const entry = anchors[0].price;
      const target = anchors[1].price;
      const stop =
        anchors.length >= 3
          ? anchors[2].price
          : isLong
            ? entry - Math.abs(target - entry) / Number(d.meta?.rr ?? 2)
            : entry + Math.abs(target - entry) / Number(d.meta?.rr ?? 2);
      const rr = Math.abs(target - entry) / Math.max(1e-9, Math.abs(entry - stop));
      const x1 = Math.min(p[0].x, p[1].x);
      const x2 = Math.max(p[0].x, p[1].x);
      const proj = (price: number) => c.project({ time: anchors[0].time, price }).y;
      const yEntry = proj(entry);
      const yTarget = proj(target);
      const yStop = proj(stop);
      if (yEntry === -9999 || yTarget === -9999 || yStop === -9999) break;
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = UP_COLOR;
      ctx.fillRect(x1, Math.min(yEntry, yTarget), x2 - x1, Math.abs(yTarget - yEntry));
      ctx.fillStyle = DOWN_COLOR;
      ctx.fillRect(x1, Math.min(yEntry, yStop), x2 - x1, Math.abs(yStop - yEntry));
      ctx.globalAlpha = d.style.opacity;
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = ACCENT;
      line({ x: x1, y: yEntry }, { x: x2, y: yEntry });
      ctx.strokeStyle = UP_COLOR;
      line({ x: x1, y: yTarget }, { x: x2, y: yTarget });
      ctx.strokeStyle = DOWN_COLOR;
      line({ x: x1, y: yStop }, { x: x2, y: yStop });
      ctx.font = FONT_MEDIUM;
      drawChip(
        c,
        x1,
        Math.min(yEntry, yTarget) - 8,
        `Entry ${formatPrice(entry, 2)}`,
        c.chipBg,
        c.textColor,
      );
      drawChip(
        c,
        x1,
        yTarget - 8,
        `Target ${formatPrice(target, 2)}`,
        'rgba(38,166,154,0.92)',
        '#ffffff',
      );
      drawChip(c, x1, yStop - 8, `Stop ${formatPrice(stop, 2)}`, 'rgba(239,83,80,0.92)', '#ffffff');
      const pct = ((target - entry) / entry) * 100;
      const account = Number(d.meta?.accountSize ?? 10000);
      const riskPct = Number(d.meta?.riskPct ?? 1);
      const risk = Math.abs(entry - stop);
      const size = risk > 0 ? (account * (riskPct / 100)) / risk : 0;
      drawChip(
        c,
        x2,
        yEntry - 8,
        `${isLong ? 'Long' : 'Short'} ${formatPct(pct)} · R:R 1:${rr.toFixed(1)} · Size ${size.toFixed(4)}`,
        c.chipBg,
        c.textColor,
      );
      ctx.font = FONT;
      break;
    }
    case 'anchored-vwap': {
      const from = anchors[0]?.time ?? 0;
      let cumPV = 0;
      let cumVol = 0;
      ctx.beginPath();
      let started = false;
      for (const cd of c.candles) {
        if (cd.time < from) continue;
        const tp = (cd.high + cd.low + cd.close) / 3;
        cumPV += tp * cd.volume;
        cumVol += cd.volume;
        const vwapPrice = cumVol === 0 ? cd.close : cumPV / cumVol;
        const pt = c.project({ time: cd.time, price: vwapPrice });
        if (pt.x === -9999) continue;
        if (!started) {
          ctx.moveTo(pt.x, pt.y);
          started = true;
        } else {
          ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.strokeStyle = '#ec407a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'flag': {
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      ctx.lineTo(p[0].x, p[0].y - 16);
      ctx.stroke();
      ctx.fillRect(p[0].x, p[0].y - 16, 12, 8);
      break;
    }
    case 'measure':
      // handled transiently in renderMeasure
      break;
  }
}

// ---- pending preview / brush / measure / selection --------------------------

function renderPending(c: RenderCtx): void {
  const f = c.frame;
  if (!f.activeTool || f.pending.length === 0) return;
  const { ctx } = c;
  const anchors = [...f.pending];
  if (f.cursor) anchors.push(f.cursor);
  const preview: Drawing = {
    ...(newDrawing(f.activeTool as DrawingTool, f.symbol, anchors, 0) as Drawing),
    style: { color: '#f0a92e', opacity: 0.8, lineWidth: 1, dash: 'dashed' },
  };
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.globalAlpha = 0.85;
  renderDrawing(c, preview, anchors);
  ctx.restore();
}

function renderBrush(c: RenderCtx): void {
  const f = c.frame;
  if (f.brushLive.length < 2) return;
  const { ctx } = c;
  const preview: Drawing = {
    ...(newDrawing('brush', f.symbol, f.brushLive, 0) as Drawing),
    style: { color: '#f0a92e', opacity: 0.85, lineWidth: 1.5, dash: 'solid' },
  };
  ctx.save();
  renderDrawing(c, preview, f.brushLive);
  ctx.restore();
}

/** Magnet dot at the live snapped cursor while a tool is armed. */
function renderCursorDot(c: RenderCtx): void {
  const f = c.frame;
  if (!f.activeTool || !f.cursor) return;
  const pt = c.project(f.cursor);
  if (pt.x === -9999) return;
  const { ctx } = c;
  ctx.save();
  ctx.fillStyle = 'rgba(79,140,255,0.35)';
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function renderMeasure(c: RenderCtx, from: Anchor, to: Anchor): void {
  const { ctx } = c;
  const p1 = c.project(from);
  const p2 = c.project(to);
  if (p1.x === -9999 || p2.x === -9999) return;
  const up = to.price >= from.price;
  const color = to.price === from.price ? '#787b86' : up ? UP_COLOR : DOWN_COLOR;
  const x = Math.min(p1.x, p2.x);
  const y = Math.min(p1.y, p2.y);
  const bw = Math.abs(p2.x - p1.x);
  const bh = Math.abs(p2.y - p1.y);
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, bw, bh);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(x, y, bw, bh);
  ctx.setLineDash([]);
  const diff = to.price - from.price;
  const pct = (diff / from.price) * 100;
  const bars = Math.round(Math.abs(to.time - from.time) / Math.max(1, c.tfSeconds));
  ctx.font = FONT_MEDIUM;
  const text = `${diff >= 0 ? '+' : ''}${formatPrice(diff, 2)} (${formatPct(pct)}) · ${bars} bars`;
  const tw = ctx.measureText(text).width + 12;
  const labelX = x + bw - tw < 0 ? x : x + bw - tw;
  const labelY = Math.max(14, y - 6);
  ctx.fillStyle = color;
  ctx.fillRect(labelX, labelY - 11, tw, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, labelX + 6, labelY + 1);
  ctx.font = FONT;
  ctx.restore();
}

function renderSelection(c: RenderCtx): void {
  const f = c.frame;
  if (!f.selectedId) return;
  const d = f.drawings.find((dr) => dr.id === f.selectedId);
  if (!d || d.hidden) return;
  const anchors = d.id === f.liveDrawingId && f.liveAnchors ? f.liveAnchors : d.anchors;
  const p = anchors.map(c.project);
  const { ctx } = c;
  const border = d.locked ? '#787b86' : ACCENT;
  ctx.save();
  for (const pt of p) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(pt.x - 3.5, pt.y - 3.5, 7, 7);
    ctx.fill();
    ctx.stroke();
  }
  if (MIDPOINT_TOOLS.has(d.tool) && p.length >= 2 && !d.locked) {
    const mid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
    ctx.fillStyle = ACCENT;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mid.x, mid.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
