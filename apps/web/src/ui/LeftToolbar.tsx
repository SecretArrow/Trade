import { useEffect, useRef, useState } from 'react';
import type { DrawingTool } from '@trade/drawings';
import { useStore } from '../state/store';
import { translate } from '../i18n';
import { ToolIcon } from './icons';

interface ToolEntry {
  tool: DrawingTool;
  title: string;
  shortcut?: string;
}

/**
 * Flyout groups — TradingView-style. Primary tool is shown on the button;
 * chevron opens a popup with the related tools. When a non-primary tool is
 * selected, the primary slot shows that tool's icon instead.
 */
interface FlyoutGroup {
  id: string;
  primary: DrawingTool;
  tools: ToolEntry[];
}

const FLYOUTS: FlyoutGroup[] = [
  {
    id: 'lines',
    primary: 'trendline',
    tools: [
      { tool: 'trendline', title: 'Trend line', shortcut: 'Alt+T' },
      { tool: 'ray', title: 'Ray' },
      { tool: 'extended-line', title: 'Extended line' },
      { tool: 'horizontal-line', title: 'Horizontal line', shortcut: 'Alt+H' },
      { tool: 'horizontal-ray', title: 'Horizontal ray' },
      { tool: 'vertical-line', title: 'Vertical line' },
    ],
  },
  {
    id: 'shapes',
    primary: 'parallel-channel',
    tools: [
      { tool: 'parallel-channel', title: 'Parallel channel' },
      { tool: 'rectangle', title: 'Rectangle', shortcut: 'Alt+R' },
      { tool: 'ellipse', title: 'Ellipse' },
      { tool: 'triangle', title: 'Triangle' },
      { tool: 'polyline', title: 'Path / polyline' },
      { tool: 'brush', title: 'Brush' },
      { tool: 'arrow', title: 'Arrow' },
    ],
  },
  {
    id: 'annotate',
    primary: 'text-label',
    tools: [
      { tool: 'text-label', title: 'Text label' },
      { tool: 'price-label', title: 'Price label' },
      { tool: 'callout', title: 'Callout' },
      { tool: 'flag', title: 'Flag' },
      { tool: 'price-range', title: 'Price range' },
      { tool: 'date-range', title: 'Date range' },
      { tool: 'date-price-range', title: 'Date & price range' },
      { tool: 'measure', title: 'Measure' },
    ],
  },
  {
    id: 'fib',
    primary: 'fib-retracement',
    tools: [
      { tool: 'fib-retracement', title: 'Fibonacci retracement', shortcut: 'Alt+F' },
      { tool: 'fib-extension', title: 'Fibonacci extension' },
      { tool: 'fib-channel', title: 'Fibonacci channel' },
      { tool: 'fib-time-zones', title: 'Fibonacci time zones' },
      { tool: 'fib-fan', title: 'Fibonacci fan' },
      { tool: 'fib-arcs', title: 'Fibonacci arcs' },
      { tool: 'gann-fan', title: 'Gann fan' },
      { tool: 'gann-box', title: 'Gann box' },
      { tool: 'pitchfork', title: 'Andrews pitchfork' },
      { tool: 'regression-trend', title: 'Regression trend' },
    ],
  },
  {
    id: 'position',
    primary: 'position-long',
    tools: [
      { tool: 'position-long', title: 'Long position tool (R:R)', shortcut: 'Alt+P' },
      { tool: 'position-short', title: 'Short position tool (R:R)' },
      { tool: 'anchored-vwap', title: 'Anchored VWAP', shortcut: 'Alt+V' },
    ],
  },
];

interface FlatEntry {
  tool: 'undo' | 'redo' | 'duplicate' | 'delete' | 'magnet' | 'hide-all' | 'show-all' | 'lock-all';
  titleKey: string;
  shortcut?: string;
}

const FOOTER: FlatEntry[][] = [
  [
    { tool: 'undo', titleKey: 'undo', shortcut: 'Ctrl+Z' },
    { tool: 'redo', titleKey: 'redo', shortcut: 'Ctrl+Y' },
  ],
  [
    { tool: 'magnet', titleKey: 'magnet_mode' },
    { tool: 'hide-all', titleKey: 'hide' },
    { tool: 'show-all', titleKey: 'show' },
    { tool: 'lock-all', titleKey: 'lock' },
  ],
];

export function LeftToolbar() {
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const activeTool = useStore((s) => s.activeTool);
  const selectedDrawingId = useStore((s) => s.selectedDrawingId);
  const magnet = useStore((s) => s.magnet);
  const drawings = useStore((s) => s.drawings);
  const panes = useStore((s) => s.panes);
  const activePane = useStore((s) => s.activePane);

  const [openFlyout, setOpenFlyout] = useState<string | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);

  // Close flyout on outside click / Escape.
  useEffect(() => {
    if (!openFlyout) return;
    const onDown = (e: MouseEvent) => {
      if (!flyoutRef.current) return;
      if (!flyoutRef.current.contains(e.target as Node)) setOpenFlyout(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenFlyout(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openFlyout]);

  const activeSymbol = panes[activePane]?.symbol ?? '';
  const symbolDrawings = drawings.filter((d) => d.symbol === activeSymbol);
  const allHidden = symbolDrawings.length > 0 && symbolDrawings.every((d) => d.hidden);
  const allLocked = symbolDrawings.length > 0 && symbolDrawings.every((d) => d.locked);

  const toggleTool = (tool: DrawingTool) => {
    useStore.getState().setActiveTool(activeTool === tool ? null : tool);
    setOpenFlyout(null);
  };

  return (
    <div className="left-toolbar" role="toolbar" aria-label="Drawing tools">
      {FLYOUTS.map((group) => {
        // Show the active tool's icon on the primary slot if it belongs to this group.
        const activeEntry = group.tools.find((e) => e.tool === activeTool) ?? group.tools[0];
        const primaryEntry = group.tools[0];
        const isActive = group.tools.some((e) => e.tool === activeTool);
        const title =
          activeEntry.tool === primaryEntry.tool
            ? primaryEntry.title
            : `${primaryEntry.title} · ${activeEntry.title}`;
        return (
          <div key={group.id} className="tool-flyout" ref={openFlyout === group.id ? flyoutRef : undefined}>
            <div className="tool-flyout-row">
              <button
                type="button"
                className={`tool-btn primary${isActive ? ' active' : ''}`}
                title={`${title}${primaryEntry.shortcut ? ` (${primaryEntry.shortcut})` : ''}`}
                aria-label={title}
                aria-pressed={isActive}
                onClick={() => toggleTool(activeEntry.tool)}
              >
                <ToolIcon tool={activeEntry.tool} />
              </button>
              <button
                type="button"
                className={`tool-btn chevron${openFlyout === group.id ? ' open' : ''}`}
                title={translate(locale, 'drawing_flyout_more', { n: group.tools.length - 1 })}
                aria-label={`More ${group.id} tools`}
                aria-expanded={openFlyout === group.id}
                onClick={() => setOpenFlyout(openFlyout === group.id ? null : group.id)}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            {openFlyout === group.id && (
              <div className="tool-flyout-popup" role="menu">
                {group.tools.map((entry) => (
                  <button
                    key={entry.tool}
                    type="button"
                    role="menuitemradio"
                    aria-checked={activeTool === entry.tool}
                    className={`flyout-item${activeTool === entry.tool ? ' active' : ''}`}
                    title={`${entry.title}${entry.shortcut ? ` (${entry.shortcut})` : ''}`}
                    onClick={() => toggleTool(entry.tool)}
                  >
                    <ToolIcon tool={entry.tool} size={16} />
                    <span className="flyout-label">{entry.title}</span>
                    {entry.shortcut && <span className="flyout-shortcut">{entry.shortcut}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {FOOTER.map((row, i) => (
        <div key={i} className="tool-group">
          {row.map((entry) => {
            const isActive =
              entry.tool === 'magnet'
                ? magnet
                : entry.tool === 'hide-all'
                  ? allHidden
                  : entry.tool === 'lock-all'
                    ? allLocked
                    : false;
            const handler = () => {
              if (entry.tool === 'undo') return useStore.getState().undo();
              if (entry.tool === 'redo') return useStore.getState().redo();
              if (entry.tool === 'magnet') return useStore.getState().toggleMagnet();
              if (entry.tool === 'hide-all') {
                const next = !allHidden;
                for (const d of symbolDrawings) useStore.getState().updateDrawing(d.id, { hidden: next });
                return;
              }
              if (entry.tool === 'show-all') {
                for (const d of symbolDrawings) useStore.getState().updateDrawing(d.id, { hidden: false });
                return;
              }
              if (entry.tool === 'lock-all') {
                const next = !allLocked;
                for (const d of symbolDrawings) useStore.getState().updateDrawing(d.id, { locked: next });
                return;
              }
            };
            return (
              <button
                key={entry.tool}
                type="button"
                className={`tool-btn${isActive ? ' active' : ''}`}
                title={`${t(entry.titleKey)}${entry.shortcut ? ` (${entry.shortcut})` : ''}`}
                aria-label={t(entry.titleKey)}
                aria-pressed={isActive}
                onClick={handler}
              >
                <ToolIcon tool={entry.tool} />
              </button>
            );
          })}
        </div>
      ))}

      {selectedDrawingId && (
        <div className="tool-group">
          <button
            type="button"
            className="tool-btn"
            title={t('duplicate')}
            aria-label={t('duplicate')}
            onClick={() => useStore.getState().duplicateDrawing(selectedDrawingId)}
          >
            <ToolIcon tool="duplicate" />
          </button>
          <button
            type="button"
            className="tool-btn danger"
            title={`${t('delete')} (Del)`}
            aria-label={t('delete')}
            onClick={() => useStore.getState().removeDrawing(selectedDrawingId)}
          >
            <ToolIcon tool="delete" />
          </button>
        </div>
      )}
    </div>
  );
}
