import { useEffect } from 'react';
import { useStore } from '../state/store';

const SHORTCUT_TOOLS: Record<string, string> = {
  AltT: 'trendline',
  AltH: 'horizontal-line',
  AltR: 'rectangle',
  AltF: 'fib-retracement',
  AltP: 'position-long',
  AltV: 'anchored-vwap',
};

/** Global keyboard shortcuts. */
export function GlobalShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.key === '/') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('trade:open-search'));
        return;
      }
      if (e.key === '?') {
        useStore.getState().setShowShortcuts(!useStore.getState().showShortcuts);
        return;
      }
      if (e.key === 'Escape') {
        if (useStore.getState().activeTool) useStore.getState().setActiveTool(null);
        else useStore.getState().setShowShortcuts(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useStore.getState().redo();
        else useStore.getState().undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useStore.getState().redo();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = useStore.getState().selectedDrawingId;
        if (selected) {
          e.preventDefault();
          useStore.getState().removeDrawing(selected);
        }
        return;
      }
      if (e.altKey) {
        const tool = SHORTCUT_TOOLS[`Alt${e.key.toUpperCase()}`];
        if (tool) {
          e.preventDefault();
          const current = useStore.getState().activeTool;
          useStore.getState().setActiveTool(current === tool ? null : tool);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return null;
}

const SHORTCUTS: [string, string][] = [
  ['/', 'Search symbol'],
  ['Alt+T', 'Trend line'],
  ['Alt+H', 'Horizontal line'],
  ['Alt+R', 'Rectangle'],
  ['Alt+F', 'Fibonacci retracement'],
  ['Alt+P', 'Long position tool'],
  ['Alt+V', 'Anchored VWAP'],
  ['Ctrl+Z / Ctrl+Y', 'Undo / redo drawings'],
  ['Delete', 'Delete selected drawing'],
  ['Escape', 'Cancel tool / close dialog'],
  ['?', 'This help'],
];

export function ShortcutHelp() {
  const show = useStore((s) => s.showShortcuts);
  if (!show) return null;
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) useStore.getState().setShowShortcuts(false);
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="modal-header">
          <span>Keyboard shortcuts</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => useStore.getState().setShowShortcuts(false)}
            aria-label="Close"
          >
            x
          </button>
        </div>
        <div className="modal-body">
          <table className="shortcut-table">
            <tbody>
              {SHORTCUTS.map(([key, label]) => (
                <tr key={key}>
                  <td className="shortcut-key">{key}</td>
                  <td>{label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
