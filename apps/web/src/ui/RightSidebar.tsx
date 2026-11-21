import { useEffect, useState } from 'react';
import type { Ticker } from '@trade/core';
import { SYMBOLS, formatPct, formatPrice } from '@trade/core';
import { getProvider } from '@trade/providers';
import { getDefinition } from '@trade/indicators';
import { describeDrawing } from '@trade/drawings';
import { useStore } from '../state/store';
import { translate } from '../i18n';
import { MtfPanel } from './MtfPanel';

type Tab = 'watchlist' | 'indicators' | 'objects' | 'templates' | 'strategy';

export function RightSidebar(props: { initialTab?: Tab }) {
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const [tab, setTab] = useState<Tab>(props.initialTab ?? 'watchlist');
  const [tickers, setTickers] = useState<Record<string, Ticker>>({});
  const settings = useStore((s) => s.settings);
  const providerBySymbol = useStore((s) => s.providerBySymbol);
  const indicators = useStore((s) => s.indicators);
  const drawings = useStore((s) => s.drawings);
  const templates = useStore((s) => s.indicatorTemplates);
  const panes = useStore((s) => s.panes);
  const activePane = useStore((s) => s.activePane);
  const selectedDrawingId = useStore((s) => s.selectedDrawingId);
  const activeSymbol = panes[activePane]?.symbol ?? SYMBOLS[0].id;

  // watchlist polling
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      const next: Record<string, Ticker> = {};
      for (const symbol of SYMBOLS) {
        const providerId = providerBySymbol[symbol.id] ?? 'demo';
        try {
          next[symbol.id] = await getProvider(providerId).getTicker(symbol.id, {
            twelveDataKey: settings.twelveDataKey,
            proxyUrl: settings.proxyUrl,
          });
        } catch {
          try {
            next[symbol.id] = await getProvider('demo').getTicker(symbol.id, {});
          } catch {
            // ignore
          }
        }
      }
      if (!cancelled) setTickers(next);
    };
    poll();
    const timer = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [providerBySymbol, settings.twelveDataKey, settings.proxyUrl]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'watchlist', label: t('watchlist') },
    { id: 'indicators', label: t('indicators') },
    { id: 'objects', label: t('object_tree') },
    { id: 'strategy', label: t('mtf_strategy') },
    { id: 'templates', label: t('templates') },
  ];

  const symbolDrawings = drawings.filter((d) => d.symbol === activeSymbol);

  return (
    <aside className="right-sidebar">
      <div className="sidebar-tabs" role="tablist">
        {tabs.map((tabInfo) => (
          <button
            key={tabInfo.id}
            type="button"
            role="tab"
            aria-selected={tab === tabInfo.id}
            className={`sidebar-tab${tab === tabInfo.id ? ' active' : ''}`}
            onClick={() => setTab(tabInfo.id)}
          >
            {tabInfo.label}
          </button>
        ))}
      </div>

      <div className="sidebar-content">
        {tab === 'watchlist' && (
          <div className="watchlist">
            {SYMBOLS.map((s) => {
              const ticker = tickers[s.id];
              const change = ticker?.changePct24h;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`watch-row${activeSymbol === s.id ? ' active' : ''}`}
                  onClick={() => useStore.getState().setSymbol(activePane, s.id)}
                >
                  <span className="watch-symbol">{s.id}</span>
                  <span className="watch-price">
                    {ticker ? formatPrice(ticker.last, s.pricePrecision) : '...'}
                  </span>
                  <span
                    className={`watch-change${change !== undefined && change < 0 ? ' down' : ' up'}`}
                  >
                    {change !== undefined ? formatPct(change) : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {tab === 'indicators' && (
          <div className="indicator-list">
            {indicators.length === 0 && <p className="dim small">{t('no_data')}</p>}
            {indicators.map((instance) => {
              const def = getDefinition(instance.type);
              return (
                <div key={instance.id} className="indicator-row">
                  <button
                    type="button"
                    className="indicator-name"
                    onClick={() => useStore.getState().setEditingIndicator(instance.id)}
                  >
                    {def?.name ?? instance.type}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={instance.visible ? t('hide') : t('show')}
                    onClick={() => useStore.getState().toggleIndicatorVisible(instance.id)}
                  >
                    {instance.visible ? 'On' : 'Off'}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Up"
                    onClick={() => useStore.getState().reorderIndicator(instance.id, -1)}
                  >
                    ^
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Down"
                    onClick={() => useStore.getState().reorderIndicator(instance.id, 1)}
                  >
                    v
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title={t('remove')}
                    onClick={() => useStore.getState().removeIndicator(instance.id)}
                  >
                    x
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'objects' && (
          <div className="object-tree">
            <div className="object-actions">
              <button
                type="button"
                className="btn danger small"
                onClick={() => {
                  if (window.confirm(t('clear_all_drawings'))) {
                    useStore.getState().clearDrawings(activeSymbol);
                  }
                }}
              >
                {t('clear_all')}
              </button>
            </div>
            {symbolDrawings.length === 0 && <p className="dim small">{t('no_data')}</p>}
            {[...symbolDrawings]
              .sort((a, b) => b.zIndex - a.zIndex)
              .map((d) => (
                <div
                  key={d.id}
                  className={`object-row${selectedDrawingId === d.id ? ' active' : ''}`}
                  onClick={() => useStore.getState().selectDrawing(d.id)}
                >
                  <span
                    className={`object-swatch${d.hidden ? ' hidden' : ''}`}
                    style={{ background: d.style.color }}
                  />
                  <span className="object-name">{describeDrawing(d)}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    title={d.hidden ? t('show') : t('hide')}
                    onClick={(e) => {
                      e.stopPropagation();
                      useStore.getState().updateDrawing(d.id, { hidden: !d.hidden });
                    }}
                  >
                    {d.hidden ? 'Hid' : 'Vis'}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title={t('lock')}
                    onClick={(e) => {
                      e.stopPropagation();
                      useStore.getState().updateDrawing(d.id, { locked: !d.locked });
                    }}
                  >
                    {d.locked ? 'Lok' : 'Unl'}
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title={t('delete')}
                    onClick={(e) => {
                      e.stopPropagation();
                      useStore.getState().removeDrawing(d.id);
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
          </div>
        )}

        {tab === 'templates' && (
          <div className="templates">
            <TemplateForm />
            {templates.length === 0 && <p className="dim small">{t('no_data')}</p>}
            {templates.map((tpl) => (
              <div key={tpl.name} className="template-row">
                <span>{tpl.name}</span>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => useStore.getState().applyTemplate(tpl.name)}
                >
                  {t('apply')}
                </button>
                <button
                  type="button"
                  className="btn small danger"
                  onClick={() => useStore.getState().deleteTemplate(tpl.name)}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === 'strategy' && <MtfPanel />}
      </div>
    </aside>
  );
}

function TemplateForm() {
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const [name, setName] = useState('');
  return (
    <div className="template-form">
      <input
        type="text"
        className="text-input"
        placeholder={t('template_name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button
        type="button"
        className="btn small"
        disabled={name.trim() === ''}
        onClick={() => {
          useStore.getState().saveTemplate(name.trim());
          setName('');
        }}
      >
        {t('save_template')}
      </button>
    </div>
  );
}
