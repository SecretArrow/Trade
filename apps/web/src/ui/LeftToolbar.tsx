import type { DrawingTool } from '@trade/drawings';
import { useStore } from '../state/store';
import { translate } from '../i18n';

interface ToolEntry {
  tool: DrawingTool;
  label: string;
  title: string;
  shortcut?: string;
}

const GROUPS: ToolEntry[][] = [
  [
    { tool: 'trendline', label: 'TL', title: 'Trend line', shortcut: 'Alt+T' },
    { tool: 'ray', label: 'RY', title: 'Ray' },
    { tool: 'extended-line', label: 'XL', title: 'Extended line' },
    { tool: 'horizontal-line', label: 'HZ', title: 'Horizontal line', shortcut: 'Alt+H' },
    { tool: 'horizontal-ray', label: 'HR', title: 'Horizontal ray' },
    { tool: 'vertical-line', label: 'VT', title: 'Vertical line' },
  ],
  [
    { tool: 'parallel-channel', label: 'CH', title: 'Parallel channel' },
    { tool: 'rectangle', label: 'RC', title: 'Rectangle', shortcut: 'Alt+R' },
    { tool: 'ellipse', label: 'EL', title: 'Ellipse' },
    { tool: 'triangle', label: 'TR', title: 'Triangle' },
    { tool: 'polyline', label: 'PA', title: 'Path / polyline' },
    { tool: 'brush', label: 'BR', title: 'Brush' },
    { tool: 'arrow', label: 'AR', title: 'Arrow' },
  ],
  [
    { tool: 'text-label', label: 'TX', title: 'Text label' },
    { tool: 'price-label', label: 'PL', title: 'Price label' },
    { tool: 'callout', label: 'CO', title: 'Callout' },
    { tool: 'flag', label: 'FG', title: 'Flag' },
    { tool: 'price-range', label: 'PR', title: 'Price range' },
    { tool: 'date-range', label: 'DR', title: 'Date range' },
    { tool: 'date-price-range', label: 'DP', title: 'Date & price range' },
    { tool: 'measure', label: 'MS', title: 'Measure' },
  ],
  [
    { tool: 'fib-retracement', label: 'FB', title: 'Fibonacci retracement', shortcut: 'Alt+F' },
    { tool: 'fib-extension', label: 'FE', title: 'Fibonacci extension' },
    { tool: 'fib-channel', label: 'FC', title: 'Fibonacci channel' },
    { tool: 'fib-time-zones', label: 'FT', title: 'Fibonacci time zones' },
    { tool: 'fib-fan', label: 'FF', title: 'Fibonacci fan' },
    { tool: 'fib-arcs', label: 'FA', title: 'Fibonacci arcs' },
    { tool: 'gann-fan', label: 'GF', title: 'Gann fan' },
    { tool: 'gann-box', label: 'GB', title: 'Gann box' },
    { tool: 'pitchfork', label: 'PF', title: 'Andrews pitchfork' },
    { tool: 'regression-trend', label: 'RG', title: 'Regression trend' },
  ],
  [
    { tool: 'position-long', label: 'LO', title: 'Long position tool (R:R)', shortcut: 'Alt+P' },
    { tool: 'position-short', label: 'SH', title: 'Short position tool (R:R)' },
    { tool: 'anchored-vwap', label: 'VW', title: 'Anchored VWAP', shortcut: 'Alt+V' },
  ],
];

export function LeftToolbar() {
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const activeTool = useStore((s) => s.activeTool);
  const selectedDrawingId = useStore((s) => s.selectedDrawingId);

  return (
    <div className="left-toolbar" role="toolbar" aria-label="Drawing tools">
      {GROUPS.map((group, gi) => (
        <div key={gi} className="tool-group">
          {group.map((entry) => (
            <button
              key={entry.tool}
              type="button"
              className={`tool-btn${activeTool === entry.tool ? ' active' : ''}`}
              title={`${entry.title}${entry.shortcut ? ` (${entry.shortcut})` : ''}`}
              aria-label={entry.title}
              aria-pressed={activeTool === entry.tool}
              onClick={() =>
                useStore.getState().setActiveTool(activeTool === entry.tool ? null : entry.tool)
              }
            >
              {entry.label}
            </button>
          ))}
        </div>
      ))}
      <div className="tool-group">
        <button
          type="button"
          className="tool-btn"
          title={`${t('undo')} (Ctrl+Z)`}
          onClick={() => useStore.getState().undo()}
        >
          UN
        </button>
        <button
          type="button"
          className="tool-btn"
          title={`${t('redo')} (Ctrl+Y)`}
          onClick={() => useStore.getState().redo()}
        >
          RE
        </button>
      </div>
      {selectedDrawingId && (
        <div className="tool-group">
          <button
            type="button"
            className="tool-btn"
            title={t('duplicate')}
            onClick={() => useStore.getState().duplicateDrawing(selectedDrawingId)}
          >
            DU
          </button>
          <button
            type="button"
            className="tool-btn danger"
            title={`${t('delete')} (Del)`}
            onClick={() => useStore.getState().removeDrawing(selectedDrawingId)}
          >
            DEL
          </button>
        </div>
      )}
    </div>
  );
}
