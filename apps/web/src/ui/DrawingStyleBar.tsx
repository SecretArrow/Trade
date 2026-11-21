import { useEffect, useRef } from 'react';
import type { DrawingTool } from '@trade/drawings';
import { useStore } from '../state/store';
import { translate } from '../i18n';
import { ToolIcon } from './icons';

const PALETTE = [
  '#2962ff',
  '#00bcd4',
  '#26a69a',
  '#66bb6a',
  '#fdd835',
  '#ff9800',
  '#ef5350',
  '#ec407a',
  '#ab47bc',
  '#ffffff',
];

const LINE_WIDTHS = [1, 2, 3, 4];

const DASH_MODES = ['solid', 'dashed', 'dotted'] as const;

const DASH_TITLE: Record<(typeof DASH_MODES)[number], string> = {
  solid: 'style_solid',
  dashed: 'style_dashed',
  dotted: 'style_dotted',
};

/** Tools whose style supports an area fill. */
const FILL_TOOLS: DrawingTool[] = [
  'rectangle',
  'ellipse',
  'triangle',
  'parallel-channel',
  'gann-box',
  'price-range',
  'date-range',
  'date-price-range',
  'fib-retracement',
  'fib-extension',
  'fib-channel',
];

/** Tools that carry editable text. */
const TEXT_TOOLS: DrawingTool[] = ['text-label', 'callout'];

/**
 * Floating format toolbar for the selected drawing (TradingView-style). Shows
 * only the sections relevant to the drawing's tool; null when nothing is
 * selected.
 */
export function DrawingStyleBar(): JSX.Element | null {
  const drawings = useStore((s) => s.drawings);
  const selectedDrawingId = useStore((s) => s.selectedDrawingId);
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const textRef = useRef<HTMLInputElement | null>(null);

  const d = selectedDrawingId ? drawings.find((x) => x.id === selectedDrawingId) : undefined;
  const tool = d?.tool;
  const text = d?.text ?? '';

  // Auto-focus the text input when a fresh text drawing is placed, so the bar
  // opens ready to type.
  useEffect(() => {
    if (!tool || !TEXT_TOOLS.includes(tool) || text !== '') return;
    textRef.current?.focus();
  }, [tool, text]);

  // "Edit text" in the drawing context menu re-focuses the input even when the
  // drawing is already selected (plain re-selection would be a no-op). The
  // frame delay lets the input mount first.
  useEffect(() => {
    const onEditText = () => requestAnimationFrame(() => textRef.current?.focus());
    window.addEventListener('trade:edit-drawing-text', onEditText);
    return () => window.removeEventListener('trade:edit-drawing-text', onEditText);
  }, []);

  if (!d) return null;

  return (
    <div className="drawing-style-bar" role="toolbar" aria-label="Drawing style">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          className={`style-swatch${d.style.color === c ? ' active' : ''}`}
          style={{ background: c }}
          title={t('style_color')}
          aria-pressed={d.style.color === c}
          onClick={() =>
            useStore.getState().updateDrawing(d.id, { style: { ...d.style, color: c } })
          }
        />
      ))}

      <span className="style-separator" />

      {LINE_WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          className={`style-width-btn${d.style.lineWidth === w ? ' active' : ''}`}
          data-w={w}
          title={t('style_width')}
          onClick={() =>
            useStore.getState().updateDrawing(d.id, { style: { ...d.style, lineWidth: w } })
          }
        >
          <span className="style-width-line" style={{ height: w }} />
        </button>
      ))}

      {DASH_MODES.map((dash) => (
        <button
          key={dash}
          type="button"
          className={`style-dash-btn${d.style.dash === dash ? ' active' : ''}`}
          data-dash={dash}
          title={t(DASH_TITLE[dash])}
          onClick={() => useStore.getState().updateDrawing(d.id, { style: { ...d.style, dash } })}
        >
          <span className={`style-dash-icon style-dash-icon-${dash}`} />
        </button>
      ))}

      {FILL_TOOLS.includes(d.tool) && (
        <button
          type="button"
          className={`style-fill-btn${d.style.fill ? ' active' : ''}`}
          title={t('style_fill')}
          aria-pressed={!!d.style.fill}
          onClick={() =>
            useStore.getState().updateDrawing(d.id, {
              style: { ...d.style, fill: d.style.fill ? undefined : d.style.color },
            })
          }
        >
          <FillIcon active={!!d.style.fill} />
        </button>
      )}

      <span className="style-separator" />

      <input
        type="range"
        className="style-opacity-input"
        min={10}
        max={100}
        step={5}
        value={Math.round(d.style.opacity * 100)}
        title={t('style_opacity')}
        onPointerDown={() => useStore.getState().snapshotHistory()}
        onChange={(e) =>
          useStore
            .getState()
            .updateDrawing(
              d.id,
              { style: { ...d.style, opacity: Number(e.target.value) / 100 } },
              { silent: true },
            )
        }
      />

      {TEXT_TOOLS.includes(d.tool) && (
        <>
          <span className="style-separator" />
          <input
            ref={textRef}
            className="style-text-input"
            type="text"
            value={d.text ?? ''}
            placeholder={t('drawing_text_placeholder')}
            onFocus={() => useStore.getState().snapshotHistory()}
            onChange={(e) =>
              useStore.getState().updateDrawing(d.id, { text: e.target.value }, { silent: true })
            }
          />
        </>
      )}

      <span className="style-separator" />

      <button
        type="button"
        className={`style-action-btn${d.locked ? ' active' : ''}`}
        title={d.locked ? t('menu_unlock') : t('menu_lock')}
        aria-pressed={d.locked}
        onClick={() => useStore.getState().updateDrawing(d.id, { locked: !d.locked })}
      >
        {d.locked ? <ToolIcon tool="lock-all" size={15} /> : <UnlockIcon />}
      </button>
      <button
        type="button"
        className="style-action-btn"
        title={t('duplicate')}
        onClick={() => useStore.getState().duplicateDrawing(d.id)}
      >
        <ToolIcon tool="duplicate" size={15} />
      </button>
      <button
        type="button"
        className="style-action-btn danger"
        title={t('delete')}
        onClick={() => useStore.getState().removeDrawing(d.id)}
      >
        <ToolIcon tool="delete" size={15} />
      </button>
      <button
        type="button"
        className="style-action-btn"
        title={t('style_close')}
        onClick={() => useStore.getState().selectDrawing(null)}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/* Glyphs for the few states icons.tsx does not cover (same 24x24 grid style). */

function FillIcon(props: { active: boolean }) {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x={4.5} y={4.5} width={15} height={15} rx={2} />
      <rect
        x={8}
        y={8}
        width={8}
        height={8}
        rx={1}
        fill="currentColor"
        stroke="none"
        opacity={props.active ? 1 : 0.3}
      />
    </svg>
  );
}

function UnlockIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x={5} y={10.5} width={14} height={9.5} rx={1.5} />
      <path d="M8 10.5 V7 A4 4 0 0 1 16 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6 L18 18" />
      <path d="M18 6 L6 18" />
    </svg>
  );
}
