import { useEffect, useRef, useState } from 'react';
import { SYMBOLS, formatPrice } from '@trade/core';
import { useStore } from '../state/store';
import { translate } from '../i18n';
import { Modal } from './primitives';

export function SymbolSearch(props: { onClose: () => void }) {
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const activePane = useStore((s) => s.activePane);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [props]);

  const q = query.trim().toLowerCase();
  const results = SYMBOLS.filter(
    (s) =>
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.base.toLowerCase().includes(q),
  );

  return (
    <Modal title={t('search_symbol')} onClose={props.onClose}>
      <input
        ref={inputRef}
        className="search-input"
        type="text"
        placeholder="BTC, XAU, XAUT..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t('search_symbol')}
      />
      <div className="symbol-results">
        {results.map((s) => (
          <button
            key={s.id}
            type="button"
            className="symbol-result"
            onClick={() => {
              useStore.getState().setSymbol(activePane, s.id);
              props.onClose();
            }}
          >
            <span className="symbol-id">{s.id}</span>
            <span className="symbol-desc">{s.name}</span>
            <span className="symbol-kind">{s.kind.replace('-', ' ')}</span>
            <span className="symbol-base">{formatPrice(s.basePrice, s.pricePrecision)}</span>
          </button>
        ))}
        {results.length === 0 && <div className="dim">No matches</div>}
      </div>
    </Modal>
  );
}
