import { useEffect, useRef } from 'react';
import {
  ColorType,
  CrosshairMode,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle } from '@trade/core';
import { generateDemoCandles } from '../demo';

export function toLineData(candles: Candle[]) {
  return candles.map((c) => ({
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

export function ChartPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const chart: IChartApi = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e14' },
        textColor: '#c8ccd4',
      },
      grid: {
        vertLines: { color: '#161b25' },
        horzLines: { color: '#161b25' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#1e242f' },
      timeScale: { borderColor: '#1e242f', timeVisible: true, secondsVisible: false },
    });

    const series: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const candles = generateDemoCandles('BTC/USDT', '15m');
    series.setData(toLineData(candles));
    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, []);

  return <div className="chart-panel" ref={containerRef} />;
}
