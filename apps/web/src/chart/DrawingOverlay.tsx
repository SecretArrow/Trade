import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { Candle, ThemeName } from '@trade/core';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { Anchor, Drawing, DrawingTool } from '@trade/drawings';
import { hitTestDrawing, hitTestHandle } from '@trade/drawings';
import { constrainPointPx, constrainSquarePx, TOOL_MIN_POINTS, newDrawing } from '@trade/drawings';
import type { IndicatorOutput } from '@trade/indicators';
import { useStore } from '../state/store';
import { DrawingStyleBar } from '../ui/DrawingStyleBar';
import { DrawingMenu } from '../ui/DrawingMenu';
import type { DrawingMenuState } from '../ui/DrawingMenu';
import { MIDPOINT_TOOLS } from './overlayEngine';
import type { DrawingsPrimitive } from './overlayEngine';

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
  overlayRef: MutableRefObject<DrawingsPrimitive | null>;
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

const ANGLE_TOOLS = new Set(['trendline', 'ray', 'extended-line', 'arrow']);
const SQUARE_TOOLS = new Set(['rectangle', 'ellipse', 'gann-box']);
const TEXT_TOOLS = new Set(['text-label', 'callout', 'price-label', 'flag']);
const NEVER_AUTO_COMPLETE = new Set(['polyline']);
const HANDLE_TOL = 8;

type DragMode = 'none' | 'move' | 'mid' | 'handle' | 'brush' | 'measure';

interface DragState {
  mode: DragMode;
  drawingId: string | null;
  handleIndex: number;
  startAnchor: Anchor | null;
  origAnchors: Anchor[];
  moved: boolean;
  silent: boolean;
}

const NO_DRAG: DragState = {
  mode: 'none',
  drawingId: null,
  handleIndex: -1,
  startAnchor: null,
  origAnchors: [],
  moved: false,
  silent: false,
};

export function DrawingOverlay(props: Props) {
  const {
    chartRef,
    candlesRef,
    outputsRef,
    outputsVersionRef,
    overlayRef,
    symbol,
    drawings,
    activeTool,
    magnet,
    theme,
    tfSeconds,
  } = props;

  const layerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState>(NO_DRAG);
  const lastNudgeRef = useRef(0);
  const measureLingerRef = useRef(0);
  const gesturesOnRef = useRef(true);
  const [menu, setMenu] = useState<DrawingMenuState | null>(null);

  const stateRef = useRef({ symbol, drawings, activeTool, magnet, theme, tfSeconds });
  stateRef.current = { symbol, drawings, activeTool, magnet, theme, tfSeconds };

  const ov = overlayRef.current;

  // ---- frame sync ---------------------------------------------------------

  useEffect(() => {
    const prim = overlayRef.current;
    if (!prim) return;
    const f = prim.frame;
    f.symbol = symbol;
    f.theme = theme;
    f.tfSeconds = tfSeconds;
    f.magnet = magnet;
    f.drawings = drawings;
    f.activeTool = activeTool;
    f.candlesRef = candlesRef;
    f.outputsRef = outputsRef;
    prim.requestRepaint();
  });

  // store-driven frame updates (selection, disarm from elsewhere, magnet)
  useEffect(() => {
    const unsub = useStore.subscribe((state, prev) => {
      const prim = overlayRef.current;
      if (!prim) return;
      const f = prim.frame;
      let dirty = false;
      if (state.selectedDrawingId !== f.selectedId) {
        f.selectedId = state.selectedDrawingId;
        dirty = true;
      }
      if (state.activeTool !== prev.activeTool) {
        if (state.activeTool === null) {
          f.pending = [];
          f.brushLive = [];
          f.measure = null;
        }
        f.activeTool = state.activeTool;
        dirty = true;
      }
      if (state.magnet !== f.magnet) {
        f.magnet = state.magnet;
        dirty = true;
      }
      if (dirty) prim.requestRepaint();
    });
    return unsub;
  }, [overlayRef]);

  // poll indicator outputs for overlay zones/lines
  useEffect(() => {
    let last = -1;
    const id = window.setInterval(() => {
      if (last !== outputsVersionRef.current) {
        last = outputsVersionRef.current;
        overlayRef.current?.requestRepaint();
      }
    }, 300);
    return () => window.clearInterval(id);
  }, [outputsVersionRef, overlayRef]);

  // ---- chart gesture gating (drawings must own the drag) -------------------

  function setGestures(on: boolean): void {
    if (gesturesOnRef.current === on) return;
    gesturesOnRef.current = on;
    chartRef.current?.applyOptions({
      handleScroll: on
        ? { pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true }
        : { pressedMouseMove: false, horzTouchDrag: false, vertTouchDrag: false },
    });
  }

  function updateGestures(): void {
    const busy = stateRef.current.activeTool !== null || dragRef.current.mode !== 'none';
    setGestures(!busy);
  }

  useEffect(() => {
    updateGestures();
    return () => {
      try {
        setGestures(true);
      } catch {
        /* chart may already be gone */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  // ---- coordinate helpers ---------------------------------------------------

  function project(a: Anchor): Point {
    if (!ov) return { x: -9999, y: -9999 };
    return {
      x: ov.timeToX(a.time) ?? -9999,
      y: ov.priceToY(a.price) ?? -9999,
    };
  }

  function pxToAnchor(x: number, y: number, exact = false): Anchor | null {
    if (!ov) return null;
    const time = ov.xToTime(x, exact);
    const price = ov.yToPrice(y);
    if (time === null || price === null) return null;
    return { time, price };
  }

  function snapPoint(x: number, y: number): Anchor | null {
    if (!ov) return null;
    const raw = pxToAnchor(x, y);
    if (!raw) return null;
    if (!stateRef.current.magnet) return raw;
    const candles = candlesRef.current;
    if (candles.length === 0) return raw;
    let idx = candles.findIndex((c) => c.time === raw.time);
    if (idx < 0) {
      idx = Math.max(0, Math.min(candles.length - 1, Math.round(ov.timeToLogical(raw.time))));
    }
    const c = candles[idx];
    if (!c) return raw;
    let bestPrice = raw.price;
    let bestDist = 8;
    for (const candidate of [c.open, c.high, c.low, c.close]) {
      const cy = ov.priceToY(candidate);
      if (cy === null) continue;
      const dist = Math.abs(cy - y);
      if (dist < bestDist) {
        bestDist = dist;
        bestPrice = candidate;
      }
    }
    return { time: c.time, price: bestPrice };
  }

  /** TradingView-style Shift constrain in pixel space. */
  function applyShift(
    ev: PointerEvent | KeyboardEvent | null,
    tool: string,
    base: Anchor | null,
    target: Point,
  ): Point {
    if (!ev || !ev.shiftKey || !base) return target;
    const b = project(base);
    if (b.x === -9999) return target;
    if (ANGLE_TOOLS.has(tool)) return constrainPointPx(b, target);
    if (SQUARE_TOOLS.has(tool)) return constrainSquarePx(b, target);
    return target;
  }

  function constrainedAnchor(
    ev: PointerEvent,
    tool: string,
    base: Anchor | null,
    x: number,
    y: number,
  ): Anchor | null {
    const target: Point = { x, y };
    if (ANGLE_TOOLS.has(tool) || SQUARE_TOOLS.has(tool)) {
      const constrained = applyShift(ev, tool, base, target);
      if (constrained !== target) {
        return pxToAnchor(constrained.x, constrained.y, true);
      }
    }
    return snapPoint(x, y);
  }

  // ---- pointer interactions -------------------------------------------------

  useEffect(() => {
    const layer = layerRef.current;
    const container = layer?.parentElement;
    if (!layer || !container || !ov) return undefined;

    const getPoint = (ev: PointerEvent): Point => {
      const rect = container.getBoundingClientRect();
      return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    };

    const isUiEvent = (ev: Event): boolean =>
      ev.target instanceof Element &&
      !!ev.target.closest('.drawing-style-bar, .drawing-menu, .chart-legend, .chart-actions');

    const setCursor = (css: string): void => {
      container.style.cursor = css;
    };

    const repaint = (): void => {
      ov.requestRepaint();
    };

    const topDrawingAt = (x: number, y: number): Drawing | null => {
      const list = [...stateRef.current.drawings].sort((a, b) => b.zIndex - a.zIndex);
      for (const d of list) {
        if (d.hidden) continue;
        const points = d.anchors.map(project);
        if (hitTestDrawing(x, y, { drawing: d, points })) return d;
      }
      return null;
    };

    const finalize = (tool: string, anchors: Anchor[]): void => {
      const st = stateRef.current;
      const minZ = Math.max(0, ...useStore.getState().drawings.map((d) => d.zIndex)) + 1;
      const finalAnchors =
        tool === 'position-long' || tool === 'position-short'
          ? expandPositionAnchors(tool, anchors)
          : anchors;
      const drawing = newDrawing(tool as DrawingTool, st.symbol, finalAnchors, minZ);
      const store = useStore.getState();
      store.addDrawing(drawing);
      store.setActiveTool(null);
      store.selectDrawing(drawing.id);
      ov.frame.pending = [];
      ov.frame.brushLive = [];
      repaint();
    };

    const onPointerDown = (ev: PointerEvent): void => {
      if (ev.button !== 0 || isUiEvent(ev)) return;
      const { x, y } = getPoint(ev);
      const st = stateRef.current;
      const f = ov.frame;

      if (st.activeTool) {
        ev.preventDefault();
        ev.stopPropagation();
        container.setPointerCapture?.(ev.pointerId);
        if (st.activeTool === 'measure') {
          const from = snapPoint(x, y);
          if (!from) return;
          dragRef.current = { ...NO_DRAG, mode: 'measure', startAnchor: from };
          f.measure = { from, to: from };
          repaint();
          return;
        }
        if (st.activeTool === 'brush') {
          const start = snapPoint(x, y);
          if (!start) return;
          dragRef.current = { ...NO_DRAG, mode: 'brush' };
          f.brushLive = [start];
          repaint();
          return;
        }
        const point = snapPoint(x, y);
        if (!point) return;
        f.pending.push(point);
        const min = TOOL_MIN_POINTS[st.activeTool as DrawingTool] ?? 2;
        if (!NEVER_AUTO_COMPLETE.has(st.activeTool) && f.pending.length >= min) {
          finalize(st.activeTool, f.pending);
        } else {
          repaint();
        }
        return;
      }

      // ---- selection / handle / move / clone ----
      const list = [...st.drawings].sort((a, b) => b.zIndex - a.zIndex);
      for (const d of list) {
        if (d.hidden) continue;
        const points = d.anchors.map(project);
        if (d.id === f.selectedId && !d.locked) {
          const handle = hitTestHandle(x, y, { drawing: d, points }, HANDLE_TOL);
          if (handle >= 0) {
            ev.preventDefault();
            ev.stopPropagation();
            container.setPointerCapture?.(ev.pointerId);
            dragRef.current = {
              ...NO_DRAG,
              mode: 'handle',
              drawingId: d.id,
              handleIndex: handle,
              origAnchors: d.anchors.map((a) => ({ ...a })),
            };
            updateGestures();
            return;
          }
          if (MIDPOINT_TOOLS.has(d.tool) && points.length >= 2) {
            const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
            if (Math.hypot(mid.x - x, mid.y - y) <= HANDLE_TOL) {
              ev.preventDefault();
              ev.stopPropagation();
              container.setPointerCapture?.(ev.pointerId);
              const start = snapPoint(x, y);
              dragRef.current = {
                ...NO_DRAG,
                mode: 'move',
                drawingId: d.id,
                startAnchor: start,
                origAnchors: d.anchors.map((a) => ({ ...a })),
              };
              updateGestures();
              return;
            }
          }
        }
        if (hitTestDrawing(x, y, { drawing: d, points })) {
          ev.preventDefault();
          ev.stopPropagation();
          container.setPointerCapture?.(ev.pointerId);
          if (ev.ctrlKey || ev.metaKey) {
            // clone-drag, one undo entry for the whole gesture
            const newId = useStore.getState().duplicateDrawing(d.id);
            if (newId) {
              useStore.getState().selectDrawing(newId);
              const start = snapPoint(x, y);
              dragRef.current = {
                ...NO_DRAG,
                mode: 'move',
                drawingId: newId,
                startAnchor: start,
                origAnchors: d.anchors.map((a) => ({ ...a })),
                silent: true,
              };
              updateGestures();
              return;
            }
          }
          useStore.getState().selectDrawing(d.id);
          if (!d.locked) {
            const start = snapPoint(x, y);
            dragRef.current = {
              ...NO_DRAG,
              mode: 'move',
              drawingId: d.id,
              startAnchor: start,
              origAnchors: d.anchors.map((a) => ({ ...a })),
            };
            updateGestures();
          }
          repaint();
          return;
        }
      }
      if (useStore.getState().selectedDrawingId) {
        useStore.getState().selectDrawing(null);
        repaint();
      }
    };

    const onPointerMove = (ev: PointerEvent): void => {
      if (isUiEvent(ev)) return;
      const { x, y } = getPoint(ev);
      const st = stateRef.current;
      const f = ov.frame;
      const drag = dragRef.current;

      if (drag.mode === 'measure' && drag.startAnchor) {
        const to = snapPoint(x, y);
        if (to) {
          f.measure = { from: drag.startAnchor, to };
          repaint();
        }
        return;
      }

      if (drag.mode === 'brush') {
        const point = snapPoint(x, y);
        if (point && f.brushLive.length > 0) {
          const last = f.brushLive[f.brushLive.length - 1];
          const lp = project(last);
          if (Math.hypot(lp.x - x, lp.y - y) >= 3) {
            f.brushLive.push(point);
            repaint();
          }
        }
        return;
      }

      if (drag.mode !== 'none' && drag.drawingId) {
        const store = useStore.getState();
        const drawing = store.drawings.find((d) => d.id === drag.drawingId);
        if (!drawing || drawing.locked) return;
        if (drag.mode === 'handle') {
          let current: Anchor | null;
          if (drawing.tool === 'horizontal-line' || drawing.tool === 'horizontal-ray') {
            const p = snapPoint(x, y);
            current = p ? { time: drag.origAnchors[drag.handleIndex].time, price: p.price } : null;
          } else if (drawing.tool === 'vertical-line') {
            const p = snapPoint(x, y);
            current = p ? { time: p.time, price: drag.origAnchors[drag.handleIndex].price } : null;
          } else {
            const base =
              drawing.anchors.length === 2
                ? drag.origAnchors[drag.handleIndex === 0 ? 1 : 0]
                : drag.origAnchors[0];
            current = constrainedAnchor(ev, drawing.tool, base, x, y);
          }
          if (current) {
            f.liveAnchors = drag.origAnchors.map((a, i) => (i === drag.handleIndex ? current : a));
            f.liveDrawingId = drawing.id;
            drag.moved = true;
            repaint();
          }
          return;
        }
        // move (body or midpoint)
        const current = snapPoint(x, y);
        const start = drag.startAnchor;
        if (current && start) {
          const dt = current.time - start.time;
          const dp = current.price - start.price;
          f.liveAnchors = drag.origAnchors.map((a) => ({ time: a.time + dt, price: a.price + dp }));
          f.liveDrawingId = drawing.id;
          drag.moved = true;
          repaint();
        }
        return;
      }

      if (st.activeTool) {
        const base = f.pending.length > 0 ? f.pending[0] : null;
        const cursor = constrainedAnchor(ev, st.activeTool, base, x, y);
        f.cursor = cursor;
        setCursor('crosshair');
        repaint();
        return;
      }

      // hover
      const hit = topDrawingAt(x, y);
      const hoverId = hit?.id ?? null;
      if (hoverId !== f.hoverId) {
        f.hoverId = hoverId;
        repaint();
      }
      setCursor(hit ? (hit.id === f.selectedId ? 'move' : 'pointer') : '');
    };

    const onPointerUp = (ev: PointerEvent): void => {
      const drag = dragRef.current;
      const f = ov.frame;
      if (container.hasPointerCapture?.(ev.pointerId)) {
        container.releasePointerCapture?.(ev.pointerId);
      }
      if (drag.mode === 'measure') {
        window.clearTimeout(measureLingerRef.current);
        measureLingerRef.current = window.setTimeout(() => {
          f.measure = null;
          repaint();
        }, 1200);
        dragRef.current = NO_DRAG;
        updateGestures();
        return;
      }
      if (drag.mode === 'brush') {
        if (f.brushLive.length >= 2) finalize('brush', f.brushLive);
        else {
          f.brushLive = [];
          useStore.getState().setActiveTool(null);
          repaint();
        }
        dragRef.current = NO_DRAG;
        updateGestures();
        return;
      }
      if (drag.mode !== 'none' && drag.drawingId && drag.moved && f.liveAnchors) {
        useStore
          .getState()
          .updateDrawing(drag.drawingId, { anchors: f.liveAnchors }, { silent: drag.silent });
      }
      dragRef.current = NO_DRAG;
      f.liveAnchors = null;
      f.liveDrawingId = null;
      updateGestures();
      repaint();
    };

    const onDoubleClick = (ev: MouseEvent): void => {
      if (isUiEvent(ev)) return;
      const f = ov.frame;
      const st = stateRef.current;
      if (st.activeTool === 'polyline') {
        if (f.pending.length >= 2) {
          ev.preventDefault();
          finalize('polyline', f.pending);
          return;
        }
      }
      if (st.activeTool) {
        ev.preventDefault();
        f.pending = [];
        useStore.getState().setActiveTool(null);
        repaint();
        return;
      }
      const rect = container.getBoundingClientRect();
      const hit = topDrawingAt(ev.clientX - rect.left, ev.clientY - rect.top);
      if (hit) {
        useStore.getState().selectDrawing(hit.id);
        if (TEXT_TOOLS.has(hit.tool)) {
          window.dispatchEvent(new CustomEvent('trade:edit-drawing-text'));
        }
        repaint();
      }
    };

    const onContextMenu = (ev: MouseEvent): void => {
      if (isUiEvent(ev)) return;
      const st = stateRef.current;
      if (st.activeTool) {
        ev.preventDefault();
        ov.frame.pending = [];
        ov.frame.brushLive = [];
        useStore.getState().setActiveTool(null);
        repaint();
        return;
      }
      const rect = container.getBoundingClientRect();
      const hit = topDrawingAt(ev.clientX - rect.left, ev.clientY - rect.top);
      if (hit) {
        ev.preventDefault();
        useStore.getState().selectDrawing(hit.id);
        setMenu({ x: ev.clientX, y: ev.clientY, drawingId: hit.id });
        repaint();
      }
    };

    const onKeyDown = (ev: KeyboardEvent): void => {
      const target = ev.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const f = ov.frame;
      if (ev.key === 'Escape') {
        let dirty = false;
        if (dragRef.current.mode !== 'none') {
          dragRef.current = NO_DRAG;
          f.liveAnchors = null;
          f.liveDrawingId = null;
          dirty = true;
        }
        if (f.pending.length > 0 || f.brushLive.length > 0 || f.measure) {
          f.pending = [];
          f.brushLive = [];
          f.measure = null;
          dirty = true;
        }
        if (dirty) {
          updateGestures();
          repaint();
        }
        return;
      }
      if (
        ev.key === 'Enter' &&
        stateRef.current.activeTool === 'polyline' &&
        f.pending.length >= 2
      ) {
        ev.preventDefault();
        finalize('polyline', f.pending);
        return;
      }
      // arrow-key nudge of the selected drawing
      const selectedId = useStore.getState().selectedDrawingId;
      if (!selectedId || !ev.key.startsWith('Arrow')) return;
      const store = useStore.getState();
      const d = store.drawings.find((dr) => dr.id === selectedId);
      if (!d || d.locked || d.symbol !== stateRef.current.symbol) return;
      ev.preventDefault();
      const now = Date.now();
      if (now - lastNudgeRef.current > 500) store.snapshotHistory();
      lastNudgeRef.current = now;
      const factor = ev.shiftKey ? 5 : 1;
      const anchors = d.anchors.map((a) => {
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
          const bars = (ev.key === 'ArrowRight' ? 1 : -1) * factor * (f.tfSeconds || 900);
          return { ...a, time: shiftTime(a.time, bars) };
        }
        const step = (ov.priceNudgeStep() || a.price * 0.002) * factor;
        return { ...a, price: a.price + (ev.key === 'ArrowUp' ? step : -step) };
      });
      store.updateDrawing(d.id, { anchors }, { silent: true });
      repaint();
    };

    const shiftTime = (time: number, deltaSeconds: number): number => {
      const candles = candlesRef.current;
      if (candles.length === 0) return time + deltaSeconds;
      const idx = Math.round(ov.timeToLogical(time));
      const next = idx + Math.round(deltaSeconds / (stateRef.current.tfSeconds || 900));
      if (next < 0 || next > candles.length - 1) return time + deltaSeconds;
      return candles[next].time;
    };

    container.addEventListener('pointermove', onPointerMove, { capture: true });
    container.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('dblclick', onDoubleClick, { capture: true });
    container.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      container.removeEventListener('pointermove', onPointerMove, { capture: true });
      container.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('dblclick', onDoubleClick, { capture: true });
      container.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(measureLingerRef.current);
      setCursor('');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ov]);

  // ---- position tool: expand [entry, target] to [entry, target, stop] -------

  function expandPositionAnchors(tool: string, anchors: Anchor[]): Anchor[] {
    if (anchors.length < 2) return anchors;
    const isLong = tool === 'position-long';
    const entry = anchors[0];
    const target = anchors[1];
    const risk = Math.abs(target.price - entry.price) / 2;
    const stop = isLong ? entry.price - risk : entry.price + risk;
    return [entry, target, { time: target.time, price: stop }];
  }

  return (
    <div className="drawing-ui-layer" ref={layerRef}>
      <DrawingStyleBar />
      {menu && <DrawingMenu state={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
