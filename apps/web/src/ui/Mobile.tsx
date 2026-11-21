import { useState } from 'react';
import { useStore } from '../state/store';
import { translate } from '../i18n';
import { RightSidebar } from './RightSidebar';
import { LeftToolbar } from './LeftToolbar';
import { SettingsDialog } from './Dialogs';

export type SheetKind =
  'watchlist' | 'indicators' | 'objects' | 'templates' | 'tools' | 'settings' | null;

/** Mobile bottom navigation with bottom sheets. */
export function BottomNav() {
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const activeTool = useStore((s) => s.activeTool);

  const items: { id: SheetKind; label: string }[] = [
    { id: 'watchlist', label: t('watchlist') },
    { id: 'indicators', label: t('indicators') },
    { id: 'tools', label: 'Tools' },
    { id: 'objects', label: t('object_tree') },
    { id: 'settings', label: t('settings') },
  ];

  return (
    <>
      <nav className="bottom-nav mobile-only" aria-label="Mobile navigation">
        {items.map((item) => (
          <button
            key={item.id ?? 'none'}
            type="button"
            className={`bottom-nav-btn${sheet === item.id ? ' active' : ''}`}
            aria-pressed={sheet === item.id}
            onClick={() => setSheet(sheet === item.id ? null : item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {sheet === 'tools' && (
        <div
          className="sheet-backdrop mobile-only"
          onClick={(e) => e.currentTarget === e.target && setSheet(null)}
        >
          <div className="sheet" role="dialog" aria-label="Drawing tools">
            <div className="sheet-header">
              <span>Drawing tools</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSheet(null)}
                aria-label="Close"
              >
                x
              </button>
            </div>
            <div className="sheet-body tools-sheet">
              <LeftToolbar />
            </div>
          </div>
        </div>
      )}
      {(sheet === 'watchlist' ||
        sheet === 'indicators' ||
        sheet === 'objects' ||
        sheet === 'templates') && (
        <div
          className="sheet-backdrop mobile-only"
          onClick={(e) => e.currentTarget === e.target && setSheet(null)}
        >
          <div className="sheet sheet-tall" role="dialog">
            <div className="sheet-header">
              <span>{t(sheet)}</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setSheet(null)}
                aria-label="Close"
              >
                x
              </button>
            </div>
            <div className="sheet-body">
              <RightSidebar initialTab={sheet} />
            </div>
          </div>
        </div>
      )}
      {sheet === 'settings' && <SettingsDialog onClose={() => setSheet(null)} />}
      {activeTool && (
        <div className="mobile-tool-hint mobile-only">
          {activeTool} — tap chart to place, double-tap to finish
        </div>
      )}
    </>
  );
}

export function MobileSheet() {
  // Sheets are rendered by BottomNav; kept for future panels.
  return null;
}
