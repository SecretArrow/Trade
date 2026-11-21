import { useEffect, useState } from 'react';
import type { ChartType, LayoutMode, Timeframe } from '@trade/core';
import { TIMEFRAMES, formatPrice, getSymbol } from '@trade/core';
import { DEFINITIONS } from '@trade/indicators';
import { getProvider, providersForSymbol } from '@trade/providers';
import { useStore } from '../state/store';
import type { ChartEngine } from '../state/store';
import { translate } from '../i18n';
import { Modal } from './primitives';
import { SymbolSearch } from './SymbolSearch';
import { IndicatorSettingsDialog, SettingsDialog, AlertDialog } from './Dialogs';

const CHART_TYPES: { value: ChartType; labelKey: string }[] = [
  { value: 'candles', labelKey: 'candles' },
  { value: 'hollow', labelKey: 'hollow' },
  { value: 'bars', labelKey: 'bars' },
  { value: 'line', labelKey: 'line' },
  { value: 'area', labelKey: 'area' },
  { value: 'heikin-ashi', labelKey: 'heikin_ashi' },
  { value: 'baseline', labelKey: 'baseline' },
];

const GROUP_LABELS: Record<string, string> = {
  ma: 'Moving averages',
  bands: 'Bands & channels',
  oscillators: 'Oscillators',
  trend: 'Trend',
  volume: 'Volume',
  structure: 'Structure & setups',
  patterns: 'Patterns',
};

export function TopBar() {
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const panes = useStore((s) => s.panes);
  const activePane = useStore((s) => s.activePane);
  const pane = panes[activePane] ?? panes[0];
  const layout = useStore((s) => s.layout);
  const theme = useStore((s) => s.theme);
  const scaleMode = useStore((s) => s.scaleMode);
  const magnet = useStore((s) => s.magnet);
  const indicators = useStore((s) => s.indicators);
  const settings = useStore((s) => s.settings);
  const providerBySymbol = useStore((s) => s.providerBySymbol);
  const status = useStore((s) => s.status);
  const lastPrice = useStore((s) => s.lastPrice);

  const [showSearch, setShowSearch] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    const openSearch = () => setShowSearch(true);
    window.addEventListener('trade:open-search', openSearch);
    return () => window.removeEventListener('trade:open-search', openSearch);
  }, []);

  const providerId = providerBySymbol[pane?.symbol ?? ''] ?? 'demo';
  const availableProviders = pane
    ? providersForSymbol(pane.symbol, {
        twelveDataKey: settings.twelveDataKey,
        proxyUrl: settings.proxyUrl,
      })
    : [];
  const provider = getProvider(providerId);
  const caps = pane ? provider.capabilities(pane.symbol) : null;
  const symbolMeta = pane ? getSymbol(pane.symbol) : null;

  useEffect(() => {
    // auto-switch provider when the saved one does not support the symbol
    if (!pane) return;
    const ok = availableProviders.some((p) => p.id === providerId);
    if (!ok && availableProviders.length > 0) {
      useStore.getState().setProvider(pane.symbol, availableProviders[0].id);
    }
  }, [pane?.symbol, providerId, availableProviders, pane]);

  if (!pane || !symbolMeta) return null;

  const grouped = new Map<string, typeof DEFINITIONS>();
  for (const def of DEFINITIONS) {
    const list = grouped.get(def.group) ?? [];
    list.push(def);
    grouped.set(def.group, list);
  }

  return (
    <header className="topbar" role="toolbar" aria-label="Main toolbar">
      <button
        type="button"
        className="brand"
        onClick={() => setShowSearch(true)}
        title={t('search_symbol')}
      >
        Trade
      </button>
      <button type="button" className="tb-btn symbol-btn" onClick={() => setShowSearch(true)}>
        <span className="symbol-name">{pane.symbol}</span>
        {lastPrice !== null && (
          <span className="symbol-price">{formatPrice(lastPrice, symbolMeta.pricePrecision)}</span>
        )}
      </button>

      <div className="tf-picker" role="group" aria-label={t('timeframe')}>
        {TIMEFRAMES.map((tf) => {
          const supported = caps?.timeframes.includes(tf) ?? false;
          return (
            <button
              key={tf}
              type="button"
              className={`tf-btn${pane.timeframe === tf ? ' active' : ''}`}
              disabled={!supported}
              title={supported ? tf : t('timeframe_unsupported')}
              onClick={() => useStore.getState().setTimeframe(activePane, tf)}
            >
              {tf}
            </button>
          );
        })}
      </div>

      <div className="tb-group">
        <label className="tb-label" htmlFor="chart-type">
          {t('chart_type')}
        </label>
        <select
          id="chart-type"
          className="tb-select"
          value={pane.chartType}
          onChange={(e) =>
            useStore.getState().setChartType(activePane, e.target.value as ChartType)
          }
        >
          {CHART_TYPES.map((ct) => (
            <option key={ct.value} value={ct.value}>
              {t(ct.labelKey)}
            </option>
          ))}
        </select>
        <select
          id="chart-engine"
          className="tb-select"
          value={pane.engine ?? 'native'}
          aria-label={t('chart_engine')}
          onChange={(e) =>
            useStore.getState().setChartEngine(activePane, e.target.value as ChartEngine)
          }
        >
          <option value="native">{t('engine_native')}</option>
          <option value="tradingview">{t('engine_tradingview')}</option>
        </select>
      </div>

      <button type="button" className="tb-btn" onClick={() => setShowIndicators(true)}>
        {t('indicators')}
        {indicators.length > 0 && <span className="count-badge">{indicators.length}</span>}
      </button>

      <div className="tb-group">
        <label className="tb-label" htmlFor="provider">
          {t('data_source')}
        </label>
        <select
          id="provider"
          className="tb-select"
          value={providerId}
          onChange={(e) => useStore.getState().setProvider(pane.symbol, e.target.value)}
        >
          {availableProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isProxyInstrument(pane.symbol) ? ` (${t('proxy_label')})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="tb-group">
        <select
          className="tb-select"
          value={scaleMode}
          aria-label="Scale"
          onChange={(e) =>
            useStore.getState().setScaleMode(e.target.value as 'linear' | 'log' | 'percent')
          }
        >
          <option value="linear">Lin</option>
          <option value="log">Log</option>
          <option value="percent">%</option>
        </select>
        <select
          className="tb-select"
          value={layout}
          aria-label={t('layout')}
          onChange={(e) => useStore.getState().setLayout(e.target.value as LayoutMode)}
        >
          <option value="single">1</option>
          <option value="2-col">2</option>
          <option value="2x2">4</option>
        </select>
        <select
          className="tb-select"
          value={theme}
          aria-label={t('theme')}
          onChange={(e) =>
            useStore.getState().setTheme(e.target.value as 'dark' | 'light' | 'system')
          }
        >
          <option value="dark">Dark</option>
          <option value="light">Light</option>
          <option value="system">System</option>
        </select>
        <select
          className="tb-select"
          value={locale}
          aria-label={t('language')}
          onChange={(e) => useStore.getState().setLocale(e.target.value as 'en' | 'id')}
        >
          <option value="en">EN</option>
          <option value="id">ID</option>
        </select>
        <button
          type="button"
          className={`tb-btn${magnet ? ' active' : ''}`}
          onClick={() => useStore.getState().toggleMagnet()}
          title={t('magnet_mode')}
        >
          M
        </button>
      </div>

      <div className="tb-spacer" />
      <span className={`status-pill ${status}`}>
        {t(
          status === 'live'
            ? 'live'
            : status === 'delayed'
              ? 'delayed'
              : status === 'offline'
                ? 'offline'
                : 'loading',
        )}
      </span>
      <button type="button" className="tb-btn" onClick={() => setShowAlert(true)}>
        {t('alerts')}
      </button>
      <button type="button" className="tb-btn" onClick={() => setShowSettings(true)}>
        {t('settings')}
      </button>

      {showSearch && <SymbolSearch onClose={() => setShowSearch(false)} />}
      {showIndicators && (
        <Modal title={t('add_indicator')} onClose={() => setShowIndicators(false)} wide>
          <div className="indicator-groups">
            {[...grouped.entries()].map(([group, defs]) => (
              <div key={group} className="indicator-group">
                <h4>{GROUP_LABELS[group] ?? group}</h4>
                {defs.map((def) => (
                  <button
                    key={def.type}
                    type="button"
                    className="indicator-add-btn"
                    onClick={() => useStore.getState().addIndicator(def.type)}
                  >
                    {def.name}
                    <span className="dim">{def.pane === 'separate' ? 'pane' : 'overlay'}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </Modal>
      )}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showAlert && <AlertDialog onClose={() => setShowAlert(false)} symbol={pane.symbol} />}
      {useStore.getState().editingIndicatorId && <IndicatorSettingsDialog />}
    </header>
  );
}
