import { useEffect, useRef, useState } from 'react';
import type { ThemeName, Timeframe } from '@trade/core';
import { useStore } from '../state/store';
import { translate } from '../i18n';
import type { Locale } from '../i18n';
import { toTradingViewInterval, toTradingViewSymbol } from './tvSymbols';

/** Official free Advanced Chart embed loader (injects an iframe). */
const EMBED_SCRIPT_URL =
  'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

/** Selector of the inner widget mount point inside the container. */
const WIDGET_DIV_SELECTOR = '.tradingview-widget-container__widget';

/** How long to wait for the iframe before treating the widget as failed. */
const LOAD_TIMEOUT_MS = 8000;

type WidgetState = 'loading' | 'ready' | 'failed';

/** Config accepted by the official embed-widget-advanced-chart.js script. */
interface AdvancedChartConfig {
  symbol: string;
  interval: string;
  timezone: string;
  theme: 'light' | 'dark';
  style: string;
  locale: 'en' | 'id';
  backgroundColor: string;
  gridColor: string;
  allow_symbol_change: boolean;
  save_image: boolean;
  calendar: boolean;
  hide_side_toolbar: boolean;
  withdateranges: boolean;
  details: boolean;
  hotlist: boolean;
  studies: string[];
  support_host: string;
}

/**
 * Free TradingView Advanced Chart embed. The widget (including TradingView's
 * own drawing toolbar) lives in an iframe injected by the official embed
 * script; if the script cannot load — offline, blocked, or CSP — a fallback
 * offers switching the pane back to the native engine.
 */
export function TradingViewChart(props: {
  symbol: string;
  timeframe: Timeframe;
  theme: ThemeName;
  locale: string;
  paneIndex: number;
}) {
  const { symbol, timeframe, theme, locale, paneIndex } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<WidgetState>('loading');

  const lang: Locale = locale === 'id' ? 'id' : 'en';
  const t = (key: string) => translate(lang, key);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    setState('loading');

    const config = buildConfig(symbol, timeframe, theme, locale);
    ensureWidgetDiv(container);

    let disposed = false;
    const script = createWidget(container, config, () => {
      if (!disposed) setState('failed');
    });

    // The embed script injects its iframe asynchronously; observe the
    // container so the loading hint disappears as soon as it arrives.
    const observer = new MutationObserver(() => {
      if (container.querySelector('iframe')) setState('ready');
    });
    observer.observe(container, { childList: true, subtree: true });

    const timer = window.setTimeout(() => {
      if (!container.querySelector('iframe') && !disposed) setState('failed');
    }, LOAD_TIMEOUT_MS);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer.disconnect();
      destroyWidget(container, script);
    };
  }, [symbol, timeframe, theme, locale]);

  return (
    <div className="tradingview-widget-container" ref={containerRef}>
      {state === 'loading' && <div className="tv-status">{t('tv_loading')}</div>}
      {state === 'failed' && (
        <div className="tv-fallback" role="alert">
          <span>{t('tv_load_failed')}</span>
          <button
            type="button"
            onClick={() => useStore.getState().setChartEngine(paneIndex, 'native')}
          >
            {t('tv_switch_native')}
          </button>
        </div>
      )}
    </div>
  );
}

function buildConfig(
  symbol: string,
  timeframe: Timeframe,
  theme: ThemeName,
  locale: string,
): AdvancedChartConfig {
  const light = theme === 'light';
  return {
    symbol: toTradingViewSymbol(symbol),
    interval: toTradingViewInterval(timeframe),
    timezone: 'Etc/UTC',
    theme: light ? 'light' : 'dark',
    style: '1',
    locale: locale === 'id' ? 'id' : 'en',
    backgroundColor: light ? '#FFFFFF' : '#131722',
    gridColor: light ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)',
    allow_symbol_change: true,
    save_image: true,
    calendar: false,
    // keep TradingView's native drawing toolbar visible — the whole point
    hide_side_toolbar: false,
    withdateranges: true,
    details: false,
    hotlist: false,
    studies: [],
    support_host: 'https://www.tradingview.com',
  };
}

/** Create (or restore) the inner widget mount div inside the container. */
function ensureWidgetDiv(container: HTMLElement): HTMLElement {
  const existing = container.querySelector<HTMLDivElement>(WIDGET_DIV_SELECTOR);
  if (existing) return existing;
  const widgetDiv = document.createElement('div');
  widgetDiv.className = 'tradingview-widget-container__widget';
  container.prepend(widgetDiv);
  return widgetDiv;
}

/**
 * Append the official embed script with the JSON config as its text content.
 * The script reads its config from the tag itself and injects the iframe.
 */
function createWidget(
  container: HTMLElement,
  config: AdvancedChartConfig,
  onFail: () => void,
): HTMLScriptElement {
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.async = true;
  script.src = EMBED_SCRIPT_URL;
  script.textContent = JSON.stringify(config);
  script.onerror = onFail;
  container.appendChild(script);
  return script;
}

/**
 * Tear the widget down: remove the script element and any injected iframe,
 * and restore the inner widget div to a pristine state. Idempotent, so it is
 * safe for React StrictMode double-mounts and repeated dependency changes.
 */
function destroyWidget(container: HTMLElement, script: HTMLScriptElement | null): void {
  if (script) {
    script.onerror = null;
    script.remove();
  }
  for (const iframe of Array.from(container.querySelectorAll('iframe'))) {
    iframe.remove();
  }
  const widgetDiv = container.querySelector<HTMLElement>(WIDGET_DIV_SELECTOR);
  if (widgetDiv) widgetDiv.replaceChildren();
}
