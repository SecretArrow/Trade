import { useEffect, useRef } from 'react';
import type { DrawingTool } from '@trade/drawings';
import { useStore } from '../state/store';
import { translate } from '../i18n';

export interface DrawingMenuState {
  x: number;
  y: number;
  drawingId: string;
}

/** Tools that offer an "Edit text" entry. */
const EDIT_TEXT_TOOLS: DrawingTool[] = ['text-label', 'callout', 'price-label', 'flag'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Right-click context menu for a drawing, clamped to the viewport. */
export function DrawingMenu(props: {
  state: DrawingMenuState;
  onClose: () => void;
}): JSX.Element | null {
  const drawings = useStore((s) => s.drawings);
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const d = drawings.find((x) => x.id === props.state.drawingId);

  // Close on outside pointerdown / Escape.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) props.onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [props.onClose]);

  if (!d) return null;

  const left = clamp(props.state.x, 8, window.innerWidth - 190);
  const top = clamp(props.state.y, 8, window.innerHeight - 240);

  return (
    <div
      ref={menuRef}
      className="drawing-menu"
      role="menu"
      style={{ left, top }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {EDIT_TEXT_TOOLS.includes(d.tool) && (
        <button
          type="button"
          className="drawing-menu-item"
          role="menuitem"
          onClick={() => {
            useStore.getState().selectDrawing(props.state.drawingId);
            // The style bar listens for this to focus its text input (re-selecting
            // an already-selected drawing alone would not re-render it).
            window.dispatchEvent(new CustomEvent('trade:edit-drawing-text'));
            props.onClose();
          }}
        >
          {t('menu_edit_text')}
        </button>
      )}
      <button
        type="button"
        className="drawing-menu-item"
        role="menuitem"
        onClick={() => {
          useStore.getState().duplicateDrawing(props.state.drawingId);
          props.onClose();
        }}
      >
        {t('menu_clone')}
      </button>
      <button
        type="button"
        className="drawing-menu-item"
        role="menuitem"
        onClick={() => {
          useStore.getState().updateDrawing(d.id, { locked: !d.locked });
          props.onClose();
        }}
      >
        {d.locked ? t('menu_unlock') : t('menu_lock')}
      </button>
      <button
        type="button"
        className="drawing-menu-item"
        role="menuitem"
        onClick={() => {
          useStore.getState().updateDrawing(d.id, { hidden: true });
          useStore.getState().selectDrawing(null);
          props.onClose();
        }}
      >
        {t('menu_hide')}
      </button>
      <div className="drawing-menu-separator" />
      <button
        type="button"
        className="drawing-menu-item danger"
        role="menuitem"
        onClick={() => {
          useStore.getState().removeDrawing(d.id);
          props.onClose();
        }}
      >
        {t('delete')}
      </button>
    </div>
  );
}
