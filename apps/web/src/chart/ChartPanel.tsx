import { useEffect, useMemo, useRef, useState } from 'react';
import type { Candle, ThemeName } from '@trade/core';
import { formatCompact, formatPrice, tfToSeconds } from '@trade/core';
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { heikinAshi, getDefinition } from '@trade/indicators';
import type { IndicatorOutput } from '@trade/indicators';
import { Feed } from '../data/feed';
import { useStore } from '../state/store';
import { translate } from '../i18n';
import { checkAlerts } from '../alerts/engine';
import { DrawingOverlay } from './DrawingOverlay';
import { TradingViewChart } from './TradingViewChart';

export const THEME_COLORS = {
  dark: {
    background: '#0b0e14',
    text: '#c8ccd4',
    grid: '#161b25',
    border: '#1e242f',
  },
  light: {
    background: '#ffffff',
    text: '#131722',
    grid: '#eef1f6',
    border: '#e0e3eb',
  },
} as const;

type MainSeries =
  | ISeriesApi<'Candlestick'>
  | ISeriesApi<'Bar'>
  | ISeriesApi<'Line'>
  | ISeriesApi<'Area'>
  | ISeriesApi<'Baseline'>;

export interface PaneOutputs {
  type: 'result';
  key: string;
  outputs: { id: string; type: string; output: IndicatorOutput | null }[];
}

function themeOf(theme: ThemeName): {
  background: string;
  text: string;
  grid: string;
  border: string;
} {
  return theme === 'light' ? THEME_COLORS.light : THEME_COLORS.dark;
}

function candleSeriesData(candles: Candle[]) {
  return candles.map((c) => ({
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

export function ChartPanel(props: {
  paneIndex: number;
  active: boolean;
  theme: ThemeName;
  locale: string;
}) {
  const { paneIndex, active, theme, locale } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<MainSeries | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const feedRef = useRef<Feed | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const outputsRef = useRef<{ id: string; type: string; output: IndicatorOutput | null }[]>([]);
  const outputsVersionRef = useRef(0);
  const legendThrottleRef = useRef(0);
  const refitOnDataRef = useRef(false);

  const pane = useStore((s) => s.panes[paneIndex]);
  const engine = pane?.engine ?? 'native';
  const indicators = useStore((s) => s.indicators);
  const providerId = useStore((s) => s.providerBySymbol[pane?.symbol ?? ''] ?? 'demo');
  const settings = useStore((s) => s.settings);
  const scaleMode = useStore((s) => s.scaleMode);
  const magnet = useStore((s) => s.magnet);
  const activeTool = useStore((s) => s.activeTool);
  const drawings = useStore((s) => s.drawings);

  // refs keeping latest values for stable callbacks (worker / feed handlers)
  const indicatorsRef = useRef(indicators);
  indicatorsRef.current = indicators;
  const paneRef = useRef(pane);
  paneRef.current = pane;
  const paneKeyRef = useRef('');
  const tfSecondsRef = useRef(900);
  if (pane) {
    tfSecondsRef.current = tfToSeconds(pane.timeframe);
    paneKeyRef.current = `${paneIndex}:${pane.symbol}:${pane.timeframe}:${providerId}`;
  }

  const colors = themeOf(theme);
  const paneKey = paneKeyRef.current;
  const symbolDrawings = useMemo(
    () => drawings.filter((d) => d.symbol === pane?.symbol),
    [drawings, pane?.symbol],
  );

  const t = (key: string) => translate(locale === 'id' ? 'id' : 'en', key);

  const [legend, setLegend] = useState<{ candle: Candle | null; prevClose: number | null }>({
    candle: null,
    prevClose: null,
  });
  const [statusInfo, setStatusInfo] = useState<{
    status: string;
    lastTickAt: number;
    deviation: number | null;
    secondary: string | null;
  }>({ status: 'loading', lastTickAt: 0, deviation: null, secondary: null });
  const [feedError, setFeedError] = useState<string | null>(null);

  function applyMainData() {
    const series = mainSeriesRef.current;
    const candles = candlesRef.current;
    const currentPane = paneRef.current;
    if (!series || !currentPane || candles.length === 0) return;
    if (['line', 'area', 'baseline'].includes(currentPane.chartType)) {
      series.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    } else if (currentPane.chartType === 'heikin-ashi') {
      series.setData(candleSeriesData(heikinAshi(candles)));
    } else {
      series.setData(candleSeriesData(candles));
    }
    // after a chart re-creation (engine switch back to native) restore the view
    if (refitOnDataRef.current) {
      refitOnDataRef.current = false;
      chartRef.current?.timeScale().fitContent();
    }
  }

  function updateMainSeries(candle: Candle) {
    const series = mainSeriesRef.current;
    const currentPane = paneRef.current;
    if (!series || !currentPane) return;
    if (['line', 'area', 'baseline'].includes(currentPane.chartType)) {
      series.update({ time: candle.time as UTCTimestamp, value: candle.close });
    } else if (currentPane.chartType === 'heikin-ashi') {
      const candles = candlesRef.current;
      const ha = heikinAshi(candles.slice(-3).concat([candle]));
      const last = ha[ha.length - 1];
      series.update({
        time: candle.time as UTCTimestamp,
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      });
    } else {
      series.update({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      });
    }
  }

  function postCompute() {
    const worker = workerRef.current;
    if (!worker || candlesRef.current.length === 0) return;
    const configs = indicatorsRef.current
      .filter((i) => i.visible)
      .map((i) => ({ id: i.id, type: i.type, params: i.params }));
    const tf = paneRef.current?.timeframe;
    worker.postMessage({
      type: 'compute',
      key: paneKeyRef.current,
      candles: [...candlesRef.current],
      configs,
      htf: tf === '1D' || tf === '1W' || tf === '1M' ? '1W' : '1D',
    });
  }

  function scaleMarginsFor(index: number, total: number): { top: number; bottom: number } {
    const n = Math.max(total, 1);
    const paneHeight = 0.3 / n - 0.02;
    const paneTop = 0.68 + (index / n) * 0.3;
    return { top: paneTop + 0.01, bottom: Math.max(0.005, 1 - paneTop - paneHeight) };
  }

  function applyIndicatorOutputs() {
    const chart = chartRef.current;
    const series = mainSeriesRef.current;
    if (!chart || !series) return;
    const candles = candlesRef.current;
    const visible = indicatorsRef.current.filter((i) => i.visible);
    const separateList = visible.filter((i) => getDefinition(i.type)?.pane === 'separate');
    const hasVolume = visible.some((i) => i.type === 'volume');

    chart.priceScale('right').applyOptions({
      scaleMargins:
        separateList.length > 0 ? { top: 0.06, bottom: 0.4 } : { top: 0.08, bottom: 0.12 },
    });

    const keep = new Set<string>();
    for (const instance of visible) {
      const def = getDefinition(instance.type);
      if (!def) continue;
      const entry = outputsRef.current.find((o) => o.id === instance.id);
      const output = entry?.output;
      if (instance.type === 'volume' && output) {
        if (!volumeSeriesRef.current) {
          volumeSeriesRef.current = chart.addHistogramSeries({
            priceScaleId: 'volume',
            priceFormat: { type: 'volume' },
            priceLineVisible: false,
            lastValueVisible: false,
          });
          chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
        }
        const vol = output.plots.volume;
        if (vol) {
          volumeSeriesRef.current.setData(
            candles
              .map((c, i) => ({
                time: c.time as UTCTimestamp,
                value: vol[i] ?? 0,
                color: c.close >= c.open ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)',
              }))
              .filter((d) => d.value !== 0),
          );
        }
      }
      if (!output) continue;

      const shiftPlots = String(output.meta?.shiftPlots ?? '')
        .split(',')
        .filter(Boolean);
      const displacement = Number(output.meta?.displacement ?? 0);

      for (const [plotKey, style] of Object.entries(def.plots)) {
        if (instance.type === 'volume' && plotKey === 'volume') continue;
        const values = output.plots[plotKey];
        if (!values) continue;
        const seriesId = `${instance.id}:${plotKey}`;
        keep.add(seriesId);
        let line = indicatorSeriesRef.current.get(seriesId);
        if (!line) {
          line = chart.addLineSeries({
            color: style.color,
            lineWidth: style.lineWidth,
            lineStyle:
              style.lineStyle === 'dashed'
                ? LineStyle.Dashed
                : style.lineStyle === 'dotted'
                  ? LineStyle.Dotted
                  : LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: def.pane === 'separate',
            crosshairMarkerVisible: false,
          });
          indicatorSeriesRef.current.set(seriesId, line);
        }
        if (def.pane === 'separate') {
          const idx = separateList.findIndex((s) => s.id === instance.id);
          const scaleId = `osc-${instance.id}`;
          line.applyOptions({ priceScaleId: scaleId });
          chart
            .priceScale(scaleId)
            .applyOptions({ scaleMargins: scaleMarginsFor(idx, separateList.length) });
        } else if (instance.type === 'volume' && plotKey === 'volumeMa') {
          line.applyOptions({ priceScaleId: 'volume' });
        }
        const shifted = shiftPlots.includes(plotKey);
        const data: { time: UTCTimestamp; value: number }[] = [];
        for (let i = 0; i < candles.length; i++) {
          const v = values[i];
          if (v === null || v === undefined) continue;
          let time: number;
          if (shifted && displacement > 0) {
            const futureIndex = i + displacement;
            time =
              futureIndex < candles.length
                ? candles[futureIndex].time
                : candles[candles.length - 1].time +
                  (futureIndex - candles.length + 1) * tfSecondsRef.current;
          } else {
            time = candles[i].time;
          }
          data.push({ time: time as UTCTimestamp, value: v });
        }
        line.setData(data);
      }
    }

    for (const [seriesId, line] of indicatorSeriesRef.current) {
      if (!keep.has(seriesId)) {
        chart.removeSeries(line);
        indicatorSeriesRef.current.delete(seriesId);
      }
    }
    if (!hasVolume && volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }

    const markers: SeriesMarker<Time>[] = [];
    for (const entry of outputsRef.current) {
      const instance = indicatorsRef.current.find((i) => i.id === entry.id);
      if (!instance || !instance.visible || !entry.output?.markers) continue;
      for (const m of entry.output.markers) {
        markers.push({
          time: m.time as UTCTimestamp,
          position: m.position,
          color: m.color,
          shape: m.shape,
          text: m.text,
        });
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    series.setMarkers(markers);

    for (const line of priceLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch {
        // series was recreated
      }
    }
    priceLinesRef.current = [];
    for (const entry of outputsRef.current) {
      const instance = indicatorsRef.current.find((i) => i.id === entry.id);
      if (!instance || !instance.visible || !entry.output?.levels) continue;
      for (const level of entry.output.levels) {
        const color =
          level.kind === 'golden'
            ? '#f0a92e'
            : level.kind === 'entry' || level.kind === 'target'
              ? '#26a69a'
              : level.kind === 'stop'
                ? '#ef5350'
                : '#7d8590';
        const priceLine = series.createPriceLine({
          price: level.price,
          color,
          lineWidth: 1,
          lineStyle: level.kind === 'golden' ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title: level.label,
        });
        priceLinesRef.current.push(priceLine);
      }
    }
  }

  function setLegendThrottled() {
    const now = Date.now();
    if (now - legendThrottleRef.current < 250) return;
    legendThrottleRef.current = now;
    const candles = candlesRef.current;
    const last = candles[candles.length - 1];
    if (last) {
      setLegend({ candle: last, prevClose: candles[candles.length - 2]?.close ?? null });
    }
  }

  // ---- worker lifecycle ----
  useEffect(() => {
    const worker = new Worker(new URL('../workers/indicatorWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (ev: MessageEvent<PaneOutputs>) => {
      const data = ev.data;
      if (data.key !== paneKeyRef.current) return;
      outputsRef.current = data.outputs;
      outputsVersionRef.current += 1;
      applyIndicatorOutputs();
      setLegendThrottled();
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // ---- chart creation ----
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontSize: 11,
      },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: colors.border, scaleMargins: { top: 0.08, bottom: 0.12 } },
      timeScale: {
        borderColor: colors.border,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 6,
      },
    });
    chartRef.current = chart;
    refitOnDataRef.current = true;
    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeriesRef.current.clear();
      priceLinesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  // ---- theme ----
  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
      },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
    });
  }, [colors.background, colors.text, colors.grid, colors.border]);

  // ---- main series per chart type ----
  useEffect(() => {
    const chart = chartRef.current;
    const currentPane = paneRef.current;
    if (!chart || !currentPane) return;
    if (mainSeriesRef.current) {
      chart.removeSeries(mainSeriesRef.current);
      mainSeriesRef.current = null;
      priceLinesRef.current = [];
    }
    const up = '#26a69a';
    const down = '#ef5350';
    switch (currentPane.chartType) {
      case 'hollow':
        mainSeriesRef.current = chart.addCandlestickSeries({
          upColor: 'rgba(0,0,0,0)',
          downColor: 'rgba(0,0,0,0)',
          borderUpColor: up,
          borderDownColor: down,
          wickUpColor: up,
          wickDownColor: down,
          borderVisible: true,
        });
        break;
      case 'bars':
        mainSeriesRef.current = chart.addBarSeries({
          upColor: up,
          downColor: down,
          thinBars: false,
        });
        break;
      case 'line':
        mainSeriesRef.current = chart.addLineSeries({ color: '#4f8cff', lineWidth: 2 });
        break;
      case 'area':
        mainSeriesRef.current = chart.addAreaSeries({
          lineColor: '#4f8cff',
          topColor: 'rgba(79,140,255,0.28)',
          bottomColor: 'rgba(79,140,255,0.02)',
        });
        break;
      case 'baseline': {
        const first = candlesRef.current[0]?.close ?? 0;
        mainSeriesRef.current = chart.addBaselineSeries({
          baseValue: { type: 'price', price: first },
          topLineColor: up,
          topFillColor1: 'rgba(38,166,154,0.28)',
          topFillColor2: 'rgba(38,166,154,0.02)',
          bottomLineColor: down,
          bottomFillColor1: 'rgba(239,83,80,0.02)',
          bottomFillColor2: 'rgba(239,83,80,0.28)',
        });
        break;
      }
      default:
        mainSeriesRef.current = chart.addCandlestickSeries({
          upColor: up,
          downColor: down,
          borderVisible: false,
          wickUpColor: up,
          wickDownColor: down,
        });
    }
    applyMainData();
    applyIndicatorOutputs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane?.chartType, engine]);

  // ---- price scale mode ----
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.priceScale('right').applyOptions({
      mode: scaleMode === 'log' ? 1 : scaleMode === 'percent' ? 2 : 0,
    });
  }, [scaleMode, engine]);

  // ---- feed ----
  useEffect(() => {
    const currentPane = paneRef.current;
    if (!currentPane) return undefined;
    let cancelled = false;
    feedRef.current?.stop();
    setFeedError(null);
    candlesRef.current = [];
    const feed = new Feed({
      symbol: currentPane.symbol,
      timeframe: currentPane.timeframe,
      providerId,
      settings: { twelveDataKey: settings.twelveDataKey, proxyUrl: settings.proxyUrl },
      onCandles: (candles) => {
        if (cancelled) return;
        candlesRef.current = candles;
        applyMainData();
        chartRef.current?.timeScale().fitContent();
        postCompute();
        setLegendThrottled();
      },
      onTick: (candle, closed) => {
        if (cancelled) return;
        updateMainSeries(candle);
        workerRef.current?.postMessage({ type: 'tick', key: paneKeyRef.current, candle });
        if (closed) postCompute();
        setLegendThrottled();
        checkAlerts(currentPane.symbol, candle.close);
      },
    });
    feedRef.current = feed;
    feed
      .start()
      .then(() => {
        if (!cancelled) {
          setStatusInfo({
            status: feed.state.status,
            lastTickAt: feed.state.lastTickAt,
            deviation: feed.state.crosscheck.deviation,
            secondary: feed.state.crosscheck.secondary?.provider ?? null,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setFeedError(t('no_data'));
      });
    const statusTimer = setInterval(() => {
      const f = feedRef.current;
      if (!f) return;
      setStatusInfo({
        status: f.state.status,
        lastTickAt: f.state.lastTickAt,
        deviation: f.state.crosscheck.deviation,
        secondary: f.state.crosscheck.secondary?.provider ?? null,
      });
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(statusTimer);
      feed.stop();
      feedRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane?.symbol, pane?.timeframe, providerId, settings.twelveDataKey, settings.proxyUrl]);

  // ---- indicators config changes ----
  useEffect(() => {
    postCompute();
    applyIndicatorOutputs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators, paneKey]);

  // ---- crosshair legend ----
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const handler = (param: MouseEventParams) => {
      const candles = candlesRef.current;
      if (param.time !== undefined && param.point) {
        const time = param.time as number;
        const idx = candles.findIndex((c) => c.time === time);
        if (idx >= 0) {
          setLegend({ candle: candles[idx], prevClose: idx > 0 ? candles[idx - 1].close : null });
          return;
        }
      }
      const last = candles[candles.length - 1];
      if (last) setLegend({ candle: last, prevClose: candles[candles.length - 2]?.close ?? null });
    };
    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [paneKey, pane?.chartType, engine]);

  if (!pane) return null;

  const statusLabel =
    statusInfo.status === 'live'
      ? t('live')
      : statusInfo.status === 'delayed'
        ? t('delayed')
        : statusInfo.status === 'offline'
          ? t('offline')
          : t('loading');

  return (
    <div
      className={`chart-panel${active ? ' active' : ''}`}
      onClick={() => useStore.getState().setActivePane(paneIndex)}
    >
      {engine === 'tradingview' ? (
        <TradingViewChart
          symbol={pane.symbol}
          timeframe={pane.timeframe}
          theme={theme}
          locale={locale}
          paneIndex={paneIndex}
        />
      ) : (
        <>
          <div className="native-chart" ref={containerRef}>
            <DrawingOverlay
              chartRef={chartRef}
              mainSeriesRef={mainSeriesRef}
              candlesRef={candlesRef}
              outputsRef={outputsRef}
              outputsVersionRef={outputsVersionRef}
              symbol={pane.symbol}
              drawings={symbolDrawings}
              activeTool={activeTool}
              magnet={magnet}
              theme={theme}
              tfSeconds={tfSecondsRef.current}
            />
            <div className="chart-legend">
              <div className="legend-row">
                <span className="legend-symbol">{pane.symbol}</span>
                <span className="legend-tf">{pane.timeframe}</span>
                <span className="legend-provider">{providerId}</span>
              </div>
              {legend.candle && (
                <div className="legend-row legend-ohlc">
                  <span>
                    {t('ohlc_legend_open')} {formatPrice(legend.candle.open, 2)}
                  </span>
                  <span>
                    {t('ohlc_legend_high')} {formatPrice(legend.candle.high, 2)}
                  </span>
                  <span>
                    {t('ohlc_legend_low')} {formatPrice(legend.candle.low, 2)}
                  </span>
                  <span>
                    {t('ohlc_legend_close')}{' '}
                    <span
                      className={
                        legend.prevClose !== null && legend.candle.close >= legend.prevClose
                          ? 'up'
                          : 'down'
                      }
                    >
                      {formatPrice(legend.candle.close, 2)}
                    </span>
                  </span>
                  <span className="legend-vol">V {formatCompact(legend.candle.volume)}</span>
                </div>
              )}
              {indicators.filter((i) => i.visible).length > 0 && (
                <div className="legend-row legend-indicators">
                  {indicators
                    .filter((i) => i.visible)
                    .map((i) => (
                      <span key={i.id} className="legend-indicator">
                        {getDefinition(i.type)?.name ?? i.type}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>
          <div className="chart-actions">
            <button
              type="button"
              className="icon-btn"
              title={t('screenshot')}
              onClick={() => {
                const chart = chartRef.current;
                if (!chart) return;
                chart.takeScreenshot().toBlob((blob) => {
                  if (!blob) return;
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `trade-${pane.symbol.replace('/', '')}-${pane.timeframe}.png`;
                  a.click();
                  URL.revokeObjectURL(url);
                });
              }}
            >
              PNG
            </button>
            <button
              type="button"
              className="icon-btn"
              title={t('fullscreen')}
              onClick={() => {
                const el = containerRef.current?.closest('.chart-cell');
                if (!el) return;
                if (document.fullscreenElement) document.exitFullscreen();
                else el.requestFullscreen().catch(() => undefined);
              }}
            >
              FS
            </button>
            <button
              type="button"
              className="icon-btn"
              title="Fit"
              onClick={() => chartRef.current?.timeScale().fitContent()}
            >
              FIT
            </button>
          </div>
        </>
      )}
      <div className={`status-badge ${statusInfo.status}`}>
        <span className="status-dot" />
        {statusLabel}
        {statusInfo.lastTickAt > 0 && (
          <span className="status-age">
            {Math.max(0, Math.floor((Date.now() - statusInfo.lastTickAt) / 1000))}s
          </span>
        )}
      </div>
      {statusInfo.deviation !== null && statusInfo.secondary && (
        <div className="crosscheck-badge">
          {t('price_check')} {statusInfo.deviation.toFixed(3)}% ({statusInfo.secondary})
        </div>
      )}
      {feedError && <div className="feed-error">{feedError}</div>}
      {providerId === 'demo' && <div className="demo-badge">{t('demo_notice')}</div>}
    </div>
  );
}
