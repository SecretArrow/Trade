import type { DrawingTool } from '@trade/drawings';
import { useStore } from '../state/store';
import { translate } from '../i18n';
import { ToolIcon } from './icons';

interface ToolEntry {
  tool: DrawingTool;
  title: string;
  shortcut?: string;
}

const GROUPS: ToolEntry[][] = [
  [
    { tool: 'trendline', title: 'Trend line', shortcut: 'Alt+T' },
    { tool: 'ray', title: 'Ray' },
    { tool: 'extended-line', title: 'Extended line' },
    { tool: 'horizontal-line', title: 'Horizontal line', shortcut: 'Alt+H' },
    { tool: 'horizontal-ray', title: 'Horizontal ray' },
    { tool: 'vertical-line', title: 'Vertical line' },
  ],
  [
    { tool: 'parallel-channel', title: 'Parallel channel' },
    { tool: 'rectangle', title: 'Rectangle', shortcut: 'Alt+R' },
    { tool: 'ellipse', title: 'Ellipse' },
    { tool: 'triangle', title: 'Triangle' },
    { tool: 'polyline', title: 'Path / polyline' },
    { tool: 'brush', title: 'Brush' },
    { tool: 'arrow', title: 'Arrow' },
  ],
  [
    { tool: 'text-label', title: 'Text label' },
    { tool: 'price-label', title: 'Price label' },
    { tool: 'callout', title: 'Callout' },
    { tool: 'flag', title: 'Flag' },
    { tool: 'price-range', title: 'Price range' },
    { tool: 'date-range', title: 'Date range' },
    { tool: 'date-price-range', title: 'Date & price range' },
    { tool: 'measure', title: 'Measure' },
  ],
  [
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
  [
    { tool: 'position-long', title: 'Long position tool (R:R)', shortcut: 'Alt+P' },
    { tool: 'position-short', title: 'Short position tool (R:R)' },
    { tool: 'anchored-vwap', title: 'Anchored VWAP', shortcut: 'Alt+V' },
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
              <ToolIcon tool={entry.tool} />
            </button>
          ))}
        </div>
      ))}
      <div className="tool-group">
        <button
          type="button"
          className="tool-btn"
          title={`${t('undo')} (Ctrl+Z)`}
          aria-label={t('undo')}
          onClick={() => useStore.getState().undo()}
        >
          <ToolIcon tool="undo" />
        </button>
        <button
          type="button"
          className="tool-btn"
          title={`${t('redo')} (Ctrl+Y)`}
          aria-label={t('redo')}
          onClick={() => useStore.getState().redo()}
        >
          <ToolIcon tool="redo" />
        </button>
      </div>
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
