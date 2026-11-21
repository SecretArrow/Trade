import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { Candle, ThemeName } from '@trade/core';
import { formatPct, formatPrice } from '@trade/core';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { Drawing } from '@trade/drawings';
import { hitTestDrawing, hitTestHandle } from '@trade/drawings';
import { FIB_LEVELS, FIB_EXTENSION_LEVELS, TOOL_MIN_POINTS, newDrawing } from '@trade/drawings';
import type { IndicatorOutput } from '@trade/indicators';
import { useStore } from '../state/store';

type MainSeries =
  | ISeriesApi<'Candlestick'>
  | ISeriesApi<'Bar'>
  | ISeriesApi<'Line'>
  | ISeriesApi<'Area'>
  | ISeriesApi<'Baseline'>;

interface Props {
  chartRef: MutableRefObject<IChartApi | null>;
  mainSeriesRef: MutableRefObject<MainSeries | null>;
  candlesRef: MutableRefObject<Candle[]>;
  outputsRef: MutableRefObject<{ id: string; type: string; output: IndicatorOutput | null }[]>;
  outputsVersionRef: MutableRefObject<number>;
  symbol: string;
  drawings: Drawing[];
  activeTool: string | null;
  magnet: boolean;
  theme: ThemeName;
  tfSeconds: number;
}

interface Point {
  x: number;
  y: number;
}

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

export function DrawingOverlay(props: Props) {
  const {
    chartRef,
    mainSeriesRef,
    candlesRef,
    outputsRef,
    outputsVersionRef,
    symbol,
    drawings,
    activeTool,
    magnet,
    theme,
    tfSeconds,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pendingRef = useRef<{ time: number; price: number }[]>([]);
  const cursorRef = useRef<{ time: number; price: number } | null>(null);
  const dragRef = useRef<{
    mode: 'none' | 'move' | 'handle';
    drawingId: string | null;
    handleIndex: number;
    startX: number;
    startY: number;
    origAnchors: { time: number; price: number }[];
    moved: boolean;
  }>({
    mode: 'none',
    drawingId: null,
    handleIndex: -1,
    startX: 0,
    startY: 0,
    origAnchors: [],
    moved: false,
  });
  const liveAnchorsRef = useRef<{ time: number; price: number }[] | null>(null);
  const brushRef = useRef<{ time: number; price: number }[]>([]);
  const rafRef = useRef(0);
  const lastOutputsVersion = useRef(-1);

  const stateRef = useRef({ symbol, drawings, activeTool, magnet, theme, tfSeconds });
  stateRef.current = { symbol, drawings, activeTool, magnet, theme, tfSeconds };

  // ---------- coordinate mapping ----------
  function barIndexOf(time: number): number {
    const candles = candlesRef.current;
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
    const exact = candles[lo].time === time ? lo : lo - 0.5;
    return exact;
  }

  function viewInfo(): { from: number; to: number; width: number } | null {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    if (!chart || !canvas) return null;
    const range = chart.timeScale().getVisibleLogicalRange();
    if (!range) return null;
    const width = canvas.clientWidth;
    return { from: range.from, to: range.to, width };
  }

  function xOfTime(time: number): number | null {
    const info = viewInfo();
    if (!info) return null;
    const ppb = info.width / Math.max(1e-6, info.to - info.from);
    return (barIndexOf(time) - info.from) * ppb;
  }

  function timeOfX(x: number): number | null {
    const info = viewInfo();
    if (!info) return null;
    const logical = info.from + (x / info.width) * (info.to - info.from);
    const candles = candlesRef.current;
    if (candles.length === 0) return null;
    const idx = Math.round(logical);
    if (idx >= 0 && idx < candles.length) return candles[idx].time;
    if (idx < 0) return candles[0].time + logical * tfSeconds;
    return candles[candles.length - 1].time + (logical - (candles.length - 1)) * tfSeconds;
  }

  function yOfPrice(price: number): number | null {
    const series = mainSeriesRef.current;
    if (!series) return null;
    const y = series.priceToCoordinate(price);
    return y ?? null;
  }

  function priceOfY(y: number): number | null {
    const series = mainSeriesRef.current;
    if (!series) return null;
    const price = series.coordinateToPrice(y);
    return price ?? null;
  }

  function projectDrawing(
    d: Drawing,
    anchorsOverride?: { time: number; price: number }[],
  ): { x: number; y: number }[] {
    const anchors = anchorsOverride ?? d.anchors;
    const points: { x: number; y: number }[] = [];
    for (const a of anchors) {
      const x = xOfTime(a.time);
      const y = yOfPrice(a.price);
      points.push({ x: x ?? -9999, y: y ?? -9999 });
    }
    return points;
  }

  // ---------- drawing (canvas) ----------
  function scheduleRedraw() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      redraw();
    });
  }

  function redraw() {
    const canvas = canvasRef.current;
    const chart = chartRef.current;
    if (!canvas || !chart) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const st = stateRef.current;
    const isLight = st.theme === 'light';
    const textColor = isLight ? '#131722' : '#c8ccd4';
    ctx.font = '10px system-ui, sans-serif';

    // indicator zones and lines
    for (const entry of outputsRef.current) {
      const out = entry.output;
      if (!out) continue;
      for (const zone of out.zones ?? []) {
        const x1 = xOfTime(zone.fromTime);
        const x2 = xOfTime(zone.toTime);
        const yTop = yOfPrice(zone.top);
        const yBottom = yOfPrice(zone.bottom);
        if (x1 === null || x2 === null || yTop === null || yBottom === null) continue;
        const colors = ZONE_COLORS[zone.kind] ?? ZONE_COLORS.support;
        ctx.fillStyle = colors.fill;
        ctx.strokeStyle = colors.stroke;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(
          Math.min(x1, x2),
          Math.min(yTop, yBottom),
          Math.abs(x2 - x1),
          Math.abs(yBottom - yTop),
        );
        ctx.strokeRect(
          Math.min(x1, x2),
          Math.min(yTop, yBottom),
          Math.abs(x2 - x1),
          Math.abs(yBottom - yTop),
        );
        if (zone.label) {
          ctx.fillStyle = colors.stroke;
          ctx.fillText(zone.label, Math.min(x1, x2) + 4, Math.min(yTop, yBottom) + 11);
        }
        ctx.globalAlpha = 1;
      }
      for (const line of out.lines ?? []) {
        const x1 = xOfTime(line.x1);
        const x2 = xOfTime(line.x2);
        const y1 = yOfPrice(line.y1);
        const y2 = yOfPrice(line.y2);
        if (x1 === null || x2 === null || y1 === null || y2 === null) continue;
        ctx.strokeStyle = line.kind === 'channel-mid' ? '#f0a92e' : '#b46cff';
        ctx.setLineDash(line.kind === 'channel-mid' ? [4, 4] : []);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (line.label) {
          ctx.fillStyle = textColor;
          ctx.fillText(line.label, x2 + 4, y2 - 3);
        }
      }
    }

    // user drawings
    for (const d of st.drawings) {
      if (d.hidden || d.symbol !== st.symbol) continue;
      const anchors =
        d.id === dragRef.current.drawingId && liveAnchorsRef.current
          ? liveAnchorsRef.current
          : d.anchors;
      drawTool(ctx, d, projectDrawing(d, anchors ?? d.anchors), textColor, anchors ?? d.anchors);
    }

    // pending placement preview
    if (st.activeTool && pendingRef.current.length > 0) {
      const previewAnchors = [...pendingRef.current];
      if (cursorRef.current) previewAnchors.push(cursorRef.current);
      const preview: Drawing = {
        ...(newDrawing(st.activeTool as never, st.symbol, previewAnchors, 0) as Drawing),
        style: { color: '#f0a92e', opacity: 0.7, lineWidth: 1, dash: 'dashed' },
      };
      ctx.setLineDash([5, 4]);
      drawTool(ctx, preview, projectDrawing(preview), textColor, previewAnchors);
      ctx.setLineDash([]);
    }
  }

  function drawTool(
    ctx: CanvasRenderingContext2D,
    d: Drawing,
    points: Point[],
    textColor: string,
    anchors: { time: number; price: number }[],
  ) {
    if (points.length === 0) return;
    ctx.strokeStyle = d.style.color;
    ctx.fillStyle = d.style.color;
    ctx.lineWidth = d.style.lineWidth;
    ctx.globalAlpha = d.style.opacity;
    const dash = d.style.dash === 'dashed' ? [6, 4] : d.style.dash === 'dotted' ? [2, 3] : [];
    ctx.setLineDash(dash);
    const p = points;

    const line = (a: Point, b: Point) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    };

    switch (d.tool) {
      case 'trendline':
        if (p.length >= 2) line(p[0], p[1]);
        break;
      case 'ray':
      case 'extended-line': {
        if (p.length >= 2) {
          const dx = p[1].x - p[0].x;
          const dy = p[1].y - p[0].y;
          const len = Math.hypot(dx, dy) || 1;
          const scale = (ctx.canvas.clientWidth + ctx.canvas.clientHeight) / len;
          if (d.tool === 'ray') line(p[0], { x: p[0].x + dx * scale, y: p[0].y + dy * scale });
          else {
            line(
              { x: p[0].x - dx * scale, y: p[0].y - dy * scale },
              { x: p[1].x + dx * scale, y: p[1].y + dy * scale },
            );
          }
        }
        break;
      }
      case 'horizontal-line':
        line({ x: 0, y: p[0].y }, { x: ctx.canvas.clientWidth, y: p[0].y });
        break;
      case 'horizontal-ray':
        line({ x: p[0].x, y: p[0].y }, { x: ctx.canvas.clientWidth, y: p[0].y });
        break;
      case 'vertical-line':
        line({ x: p[0].x, y: 0 }, { x: p[0].x, y: ctx.canvas.clientHeight });
        break;
      case 'parallel-channel': {
        if (p.length >= 3) {
          line(p[0], p[1]);
          const dy = p[2].y - p[1].y;
          line({ x: p[0].x, y: p[0].y + dy }, { x: p[1].x, y: p[1].y + dy });
          ctx.globalAlpha = d.style.opacity * 0.15;
          ctx.beginPath();
          ctx.moveTo(p[0].x, p[0].y);
          ctx.lineTo(p[1].x, p[1].y);
          ctx.lineTo(p[1].x, p[1].y + dy);
          ctx.lineTo(p[0].x, p[0].y + dy);
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
          const w = Math.abs(p[1].x - p[0].x);
          const h = Math.abs(p[1].y - p[0].y);
          ctx.strokeRect(x, y, w, h);
          if (d.style.fill) {
            ctx.globalAlpha = d.style.opacity * 0.15;
            ctx.fillRect(x, y, w, h);
            ctx.globalAlpha = d.style.opacity;
          }
          if (d.tool === 'price-range' && anchors.length >= 2) {
            const diff = anchors[1].price - anchors[0].price;
            const pct = (diff / anchors[0].price) * 100;
            ctx.fillStyle = textColor;
            ctx.fillText(`${formatPrice(diff, 2)} (${formatPct(pct)})`, x + 4, y - 4);
          }
        }
        break;
      }
      case 'ellipse': {
        if (p.length >= 2) {
          ctx.beginPath();
          ctx.ellipse(
            (p[0].x + p[1].x) / 2,
            (p[0].y + p[1].y) / 2,
            Math.abs(p[1].x - p[0].x) / 2,
            Math.abs(p[1].y - p[0].y) / 2,
            0,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }
        break;
      }
      case 'triangle':
        if (p.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(p[0].x, p[0].y);
          ctx.lineTo(p[1].x, p[1].y);
          ctx.lineTo(p[2].x, p[2].y);
          ctx.closePath();
          ctx.stroke();
        }
        break;
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
          const size = 10;
          ctx.beginPath();
          ctx.moveTo(p[1].x, p[1].y);
          ctx.lineTo(p[1].x - size * Math.cos(angle - 0.4), p[1].y - size * Math.sin(angle - 0.4));
          ctx.lineTo(p[1].x - size * Math.cos(angle + 0.4), p[1].y - size * Math.sin(angle + 0.4));
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'text-label':
      case 'callout': {
        ctx.fillStyle = textColor;
        if (d.tool === 'text-label' && d.text) ctx.fillText(d.text, p[0].x + 4, p[0].y - 4);
        if (d.tool === 'callout' && d.text) {
          const w = ctx.measureText(d.text).width + 10;
          ctx.fillStyle = d.style.color;
          ctx.fillRect(p[0].x + 8, p[0].y - 22, w, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(d.text, p[0].x + 13, p[0].y - 10);
        }
        break;
      }
      case 'price-label': {
        const label = formatPrice(anchors[0]?.price ?? 0, 2);
        const w = ctx.measureText(label).width + 10;
        ctx.fillRect(p[0].x, p[0].y - 9, w, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, p[0].x + 5, p[0].y + 3);
        break;
      }
      case 'measure': {
        if (p.length >= 2 && anchors.length >= 2) {
          const x = Math.min(p[0].x, p[1].x);
          const y = Math.min(p[0].y, p[1].y);
          ctx.globalAlpha = 0.12;
          ctx.fillRect(x, y, Math.abs(p[1].x - p[0].x), Math.abs(p[1].y - p[0].y));
          ctx.globalAlpha = d.style.opacity;
          ctx.strokeRect(x, y, Math.abs(p[1].x - p[0].x), Math.abs(p[1].y - p[0].y));
          const diff = anchors[1].price - anchors[0].price;
          const pct = (diff / anchors[0].price) * 100;
          const bars = Math.round((anchors[1].time - anchors[0].time) / Math.max(1, tfSeconds));
          ctx.fillStyle = textColor;
          ctx.fillText(`${formatPrice(diff, 2)} (${formatPct(pct)}) ${bars} bars`, x + 4, y - 4);
        }
        break;
      }
      case 'fib-retracement':
      case 'fib-extension': {
        if (p.length >= 2 && anchors.length >= 2) {
          const levels = d.tool === 'fib-retracement' ? FIB_LEVELS : FIB_EXTENSION_LEVELS;
          const x1 = Math.min(p[0].x, p[1].x);
          const x2 = Math.max(p[0].x, p[1].x);
          for (const level of levels) {
            const price = anchors[0].price + (anchors[1].price - anchors[0].price) * level;
            const y = yOfPrice(price);
            if (y === null) continue;
            ctx.strokeStyle = level === 0.618 || level === 1.618 ? '#f0a92e' : d.style.color;
            line({ x: x1, y }, { x: x2, y });
            ctx.fillStyle = textColor;
            ctx.fillText(`${(level * 100).toFixed(1)}%`, x2 + 4, y + 3);
          }
        }
        break;
      }
      case 'fib-channel':
      case 'fib-fan':
      case 'fib-arcs':
      case 'fib-time-zones':
      case 'gann-fan':
      case 'gann-box':
      case 'pitchfork':
      case 'regression-trend': {
        drawAdvancedTool(ctx, d, p, anchors, textColor, line);
        break;
      }
      case 'position-long':
      case 'position-short': {
        if (p.length >= 2 && anchors.length >= 2) {
          const isLong = d.tool === 'position-long';
          const entry = anchors[0].price;
          const target = anchors[1].price;
          const rr = Number(d.meta?.rr ?? 2);
          const risk = Math.abs(target - entry) / rr;
          const stop = isLong ? entry - risk : entry + risk;
          const yEntry = yOfPrice(entry);
          const yTarget = yOfPrice(target);
          const yStop = yOfPrice(stop);
          const x1 = Math.min(p[0].x, p[1].x);
          const x2 = Math.max(p[0].x, p[1].x);
          if (yEntry !== null && yTarget !== null && yStop !== null) {
            ctx.fillStyle = 'rgba(38,166,154,0.15)';
            ctx.fillRect(x1, Math.min(yEntry, yTarget), x2 - x1, Math.abs(yTarget - yEntry));
            ctx.fillStyle = 'rgba(239,83,80,0.15)';
            ctx.fillRect(x1, Math.min(yEntry, yStop), x2 - x1, Math.abs(yStop - yEntry));
            ctx.strokeStyle = '#26a69a';
            line({ x: x1, y: yEntry }, { x: x2, y: yEntry });
            line({ x: x1, y: yTarget }, { x: x2, y: yTarget });
            ctx.strokeStyle = '#ef5350';
            line({ x: x1, y: yStop }, { x: x2, y: yStop });
            ctx.fillStyle = textColor;
            const pct = ((target - entry) / entry) * 100;
            ctx.fillText(
              `${isLong ? 'Long' : 'Short'} R:R 1:${rr} P&L ${formatPct(pct)}`,
              x1 + 4,
              Math.min(yEntry, yTarget) - 4,
            );
            const account = Number(d.meta?.accountSize ?? 10000);
            const riskPct = Number(d.meta?.riskPct ?? 1);
            const size = risk > 0 ? (account * (riskPct / 100)) / risk : 0;
            ctx.fillText(`Size ${size.toFixed(4)}`, x1 + 4, Math.min(yEntry, yTarget) + 11);
          }
        }
        break;
      }
      case 'anchored-vwap': {
        const candles = candlesRef.current;
        const from = anchors[0]?.time ?? 0;
        let cumPV = 0;
        let cumVol = 0;
        ctx.beginPath();
        let started = false;
        for (const c of candles) {
          if (c.time < from) continue;
          const tp = (c.high + c.low + c.close) / 3;
          cumPV += tp * c.volume;
          cumVol += c.volume;
          const vwapPrice = cumVol === 0 ? c.close : cumPV / cumVol;
          const x = xOfTime(c.time);
          const y = yOfPrice(vwapPrice);
          if (x === null || y === null) continue;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = '#ec407a';
        ctx.stroke();
        break;
      }
      case 'flag': {
        ctx.beginPath();
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[0].x, p[0].y - 14);
        ctx.stroke();
        ctx.fillRect(p[0].x, p[0].y - 14, 10, 7);
        break;
      }
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // selection handles
    const selectedId = selectedDrawingIdRef.current;
    if (d.id === selectedId) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#4f8cff';
      for (const point of p) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function drawAdvancedTool(
    ctx: CanvasRenderingContext2D,
    d: Drawing,
    p: Point[],
    anchors: { time: number; price: number }[],
    textColor: string,
    line: (a: Point, b: Point) => void,
  ) {
    if (p.length === 0) return;
    switch (d.tool) {
      case 'fib-fan':
      case 'gann-fan': {
        if (p.length < 2) break;
        const ratios =
          d.tool === 'fib-fan'
            ? [0.382, 0.5, 0.618, 1]
            : [1 / 8, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 8];
        for (const r of ratios) {
          const end = { x: p[1].x, y: p[0].y + (p[1].y - p[0].y) * r };
          line(p[0], end);
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
          const t = (anchors[0]?.time ?? 0) + n * tfSeconds;
          const x = xOfTime(t);
          if (x === null) continue;
          line({ x, y: 0 }, { x, y: ctx.canvas.clientHeight });
          ctx.fillStyle = textColor;
          ctx.fillText(String(n), x + 3, 14);
        }
        break;
      }
      case 'fib-channel': {
        if (p.length < 3) break;
        for (const r of [0.382, 0.5, 0.618, 1]) {
          const dy = (p[2].y - p[1].y) * r;
          line({ x: p[0].x, y: p[0].y + dy }, { x: p[1].x, y: p[1].y + dy });
        }
        break;
      }
      case 'gann-box': {
        if (p.length < 2) break;
        const x = Math.min(p[0].x, p[1].x);
        const y = Math.min(p[0].y, p[1].y);
        const w = Math.abs(p[1].x - p[0].x);
        const h = Math.abs(p[1].y - p[0].y);
        ctx.strokeRect(x, y, w, h);
        for (const f of [0.25, 0.5, 0.75]) {
          line({ x: x + w * f, y }, { x: x + w * f, y: y + h });
          line({ x, y: y + h * f }, { x: x + w, y: y + h * f });
        }
        line({ x, y }, { x: x + w, y: y + h });
        line({ x, y: y + h }, { x: x + w, y });
        break;
      }
      case 'pitchfork': {
        if (p.length < 3) break;
        const midX = (p[1].x + p[2].x) / 2;
        const midY = (p[1].y + p[2].y) / 2;
        const dx = midX - p[0].x;
        const dy = midY - p[0].y;
        const scale = 2;
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
        const candles = candlesRef.current;
        const from = anchors[0].time;
        const to = anchors[1].time;
        const slice = candles.filter((c) => c.time >= from && c.time <= to);
        if (slice.length < 2) break;
        const n = slice.length;
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumXX = 0;
        slice.forEach((c, i) => {
          sumX += i;
          sumY += c.close;
          sumXY += i * c.close;
          sumXX += i * i;
        });
        const denom = n * sumXX - sumX * sumX;
        const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
        const intercept = (sumY - slope * sumX) / n;
        const y0 = yOfPrice(intercept);
        const y1 = yOfPrice(intercept + slope * (n - 1));
        if (y0 === null || y1 === null) break;
        line({ x: p[0].x, y: y0 }, { x: p[1].x, y: y1 });
        break;
      }
    }
  }

  // ---------- selection (kept in a ref to avoid re-render loops) ----------
  const selectedDrawingIdRef = useRef<string | null>(null);
  useEffect(() => {
    const unsub = useStore.subscribe((state) => {
      if (state.selectedDrawingId !== selectedDrawingIdRef.current) {
        selectedDrawingIdRef.current = state.selectedDrawingId;
        scheduleRedraw();
      }
    });
    return unsub;
  }, []);

  // ---------- pointer interactions ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return undefined;

    const getPoint = (ev: PointerEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };

    const snapPoint = (x: number, y: number): { time: number; price: number } => {
      const time = timeOfX(x);
      let price = priceOfY(y);
      if (time === null || price === null) return { time: time ?? 0, price: price ?? 0 };
      if (!stateRef.current.magnet) return { time, price };
      // magnet: snap to the nearest OHLC of the candle under the cursor
      const candles = candlesRef.current;
      let idx = candles.findIndex((c) => c.time === time);
      if (idx < 0) {
        const logical = barIndexOf(time);
        idx = Math.max(0, Math.min(candles.length - 1, Math.round(logical)));
      }
      const c = candles[idx];
      if (!c) return { time, price };
      let bestPrice = price;
      let bestDist = 8;
      for (const candidate of [c.open, c.high, c.low, c.close]) {
        const cy = yOfPrice(candidate);
        if (cy === null) continue;
        const dist = Math.abs(cy - y);
        if (dist < bestDist) {
          bestDist = dist;
          bestPrice = candidate;
        }
      }
      return { time: c.time, price: bestPrice };
    };

    const onPointerMove = (ev: PointerEvent) => {
      const { x, y } = getPoint(ev);
      cursorRef.current = snapPoint(x, y);
      if (dragRef.current.mode !== 'none' && dragRef.current.drawingId) {
        const st = stateRef.current;
        const drawing = st.drawings.find((d) => d.id === dragRef.current.drawingId);
        if (!drawing || drawing.locked) return;
        ev.stopPropagation();
        const current = snapPoint(x, y);
        if (dragRef.current.mode === 'handle') {
          const anchors = dragRef.current.origAnchors.map((a, i) =>
            i === dragRef.current.handleIndex ? current : a,
          );
          liveAnchorsRef.current = anchors;
        } else {
          const start = {
            time: timeOfX(dragRef.current.startX) ?? 0,
            price: priceOfY(dragRef.current.startY) ?? 0,
          };
          const dt = current.time - start.time;
          const dp = current.price - start.price;
          liveAnchorsRef.current = dragRef.current.origAnchors.map((a) => ({
            time: a.time + dt,
            price: a.price + dp,
          }));
        }
        dragRef.current.moved = true;
        scheduleRedraw();
        return;
      }
      if (stateRef.current.activeTool) {
        scheduleRedraw();
        container.style.cursor = 'crosshair';
        return;
      }
      // hover detection
      const st = stateRef.current;
      let hovering = false;
      for (const d of [...st.drawings].reverse()) {
        if (d.hidden || d.symbol !== st.symbol) continue;
        const points = projectDrawing(d);
        if (hitTestDrawing(x, y, { drawing: d, points })) {
          hovering = true;
          break;
        }
      }
      container.style.cursor = hovering ? 'pointer' : '';
    };

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      const { x, y } = getPoint(ev);
      const st = stateRef.current;

      if (st.activeTool) {
        ev.stopPropagation();
        ev.preventDefault();
        const point = snapPoint(x, y);
        if (st.activeTool === 'brush') {
          brushRef.current = [point];
          return;
        }
        pendingRef.current.push(point);
        const minPoints = TOOL_MIN_POINTS[st.activeTool as never] ?? 2;
        if (pendingRef.current.length >= minPoints) {
          const drawing = newDrawing(
            st.activeTool as never,
            st.symbol,
            [...pendingRef.current],
            Math.max(0, ...st.drawings.map((d) => d.zIndex)) + 1,
          );
          useStore.getState().addDrawing(drawing);
          pendingRef.current = [];
          useStore.getState().setActiveTool(null);
        }
        scheduleRedraw();
        return;
      }

      // selection / handle / move
      for (const d of [...st.drawings].sort((a, b) => b.zIndex - a.zIndex)) {
        if (d.hidden || d.symbol !== st.symbol) continue;
        const points = projectDrawing(d);
        if (d.id === selectedDrawingIdRef.current) {
          const handle = hitTestHandle(x, y, { drawing: d, points });
          if (handle >= 0 && !d.locked) {
            ev.stopPropagation();
            dragRef.current = {
              mode: 'handle',
              drawingId: d.id,
              handleIndex: handle,
              startX: x,
              startY: y,
              origAnchors: d.anchors.map((a) => ({ ...a })),
              moved: false,
            };
            return;
          }
        }
        if (hitTestDrawing(x, y, { drawing: d, points })) {
          ev.stopPropagation();
          useStore.getState().selectDrawing(d.id);
          selectedDrawingIdRef.current = d.id;
          if (!d.locked) {
            dragRef.current = {
              mode: 'move',
              drawingId: d.id,
              handleIndex: -1,
              startX: x,
              startY: y,
              origAnchors: d.anchors.map((a) => ({ ...a })),
              moved: false,
            };
          }
          scheduleRedraw();
          return;
        }
      }
      if (selectedDrawingIdRef.current) {
        useStore.getState().selectDrawing(null);
        selectedDrawingIdRef.current = null;
        scheduleRedraw();
      }
    };

    const onPointerUp = () => {
      const drag = dragRef.current;
      if (drag.mode !== 'none' && drag.drawingId && drag.moved && liveAnchorsRef.current) {
        useStore.getState().updateDrawing(drag.drawingId, { anchors: liveAnchorsRef.current });
      }
      if (stateRef.current.activeTool === 'brush' && brushRef.current.length > 1) {
        const drawing = newDrawing(
          'brush',
          stateRef.current.symbol,
          brushRef.current,
          Math.max(0, ...stateRef.current.drawings.map((d) => d.zIndex)) + 1,
        );
        useStore.getState().addDrawing(drawing);
        useStore.getState().setActiveTool(null);
      }
      brushRef.current = [];
      dragRef.current = {
        mode: 'none',
        drawingId: null,
        handleIndex: -1,
        startX: 0,
        startY: 0,
        origAnchors: [],
        moved: false,
      };
      liveAnchorsRef.current = null;
      scheduleRedraw();
    };

    const onDouble = () => {
      pendingRef.current = [];
      useStore.getState().setActiveTool(null);
      scheduleRedraw();
    };

    const onContext = (ev: MouseEvent) => {
      if (stateRef.current.activeTool) {
        ev.preventDefault();
        pendingRef.current = [];
        useStore.getState().setActiveTool(null);
        scheduleRedraw();
      }
    };

    container.addEventListener('pointermove', onPointerMove, { capture: true });
    container.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('dblclick', onDouble, { capture: true });
    container.addEventListener('contextmenu', onContext);
    return () => {
      container.removeEventListener('pointermove', onPointerMove, { capture: true });
      container.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('dblclick', onDouble, { capture: true });
      container.removeEventListener('contextmenu', onContext);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- redraw triggers ----------
  useEffect(() => {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    if (!chart || !canvas) return undefined;
    const onRange = () => scheduleRedraw();
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange);
    const observer = new ResizeObserver(scheduleRedraw);
    observer.observe(canvas);
    const interval = setInterval(() => {
      if (lastOutputsVersion.current !== outputsVersionRef.current) {
        lastOutputsVersion.current = outputsVersionRef.current;
        scheduleRedraw();
      }
    }, 300);
    scheduleRedraw();
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange);
      observer.disconnect();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scheduleRedraw();
  }, [drawings, activeTool]);

  return <canvas className="drawing-overlay" ref={canvasRef} />;
}
