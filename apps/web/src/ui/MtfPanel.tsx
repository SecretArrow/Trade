import { useMemo } from 'react';
import { useStore } from '../state/store';
import { translate } from '../i18n';
import { detectNesting } from '../strategy/mtf';
import {
  MTF_STEPS,
  TRADE_MODES,
  TRADE_MODE_ORDER,
  tfRoleInMode,
} from '../strategy/mtf';
import type { BiasDirection, TradeMode } from '../strategy/mtf';

const ROLE_TINT: Record<'major' | 'confirm' | 'trading', string> = {
  major: 'var(--accent)',
  confirm: 'var(--up)',
  trading: 'var(--warn, #f0a020)',
};

export function MtfPanel() {
  const locale = useStore((s) => s.locale);
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const settings = useStore((s) => s.settings);
  const panes = useStore((s) => s.panes);
  const activePane = useStore((s) => s.activePane);
  const drawings = useStore((s) => s.drawings);
  const activeSymbol = panes[activePane]?.symbol ?? '';

  const mode: TradeMode = settings.tradeMode;
  const activeTf = panes[activePane]?.timeframe;

  const cascade = mode === 'off' ? null : TRADE_MODES[mode];

  // Deteksi zona bertumpuk (nesting) di simbol aktif.
  const nestingPairs = useMemo(() => {
    if (mode === 'off') return [];
    return detectNesting(
      drawings.filter((d) => d.symbol === activeSymbol),
      { overlapThreshold: 0.5, zonesOnly: true },
    );
  }, [drawings, activeSymbol, mode]);

  const requiredDone = MTF_STEPS.filter((s) => s.required).every((s) => settings.mtfSteps[s.key]);
  const requiredTotal = MTF_STEPS.filter((s) => s.required).length;
  const requiredCount = MTF_STEPS.filter((s) => s.required && settings.mtfSteps[s.key]).length;

  return (
    <div className="mtf-panel">
      <div className="mtf-mode-grid">
        <button
          type="button"
          className={`mtf-mode-card${mode === 'off' ? ' active' : ''}`}
          onClick={() => useStore.getState().setTradeMode('off')}
        >
          <span className="mtf-mode-name">{t('trade_mode_off')}</span>
          <span className="mtf-mode-desc">{t('trade_mode_off_desc')}</span>
        </button>
        {TRADE_MODE_ORDER.map((m) => {
          const c = TRADE_MODES[m];
          return (
            <button
              key={m}
              type="button"
              className={`mtf-mode-card${mode === m ? ' active' : ''}`}
              onClick={() => useStore.getState().setTradeMode(m)}
            >
              <span className="mtf-mode-name">{t(`trade_mode_${m}`)}</span>
              <span className="mtf-mode-cascade">
                {c.major} <span className="arrow">→</span> {c.confirm} <span className="arrow">→</span>{' '}
                {c.trading}
              </span>
              <span className="mtf-mode-desc">{t(`trade_mode_${m}_desc`)}</span>
            </button>
          );
        })}
      </div>

      {cascade && (
        <>
          <div className="mtf-cascade-row" role="group" aria-label="MTF cascade">
            {(['major', 'confirm', 'trading'] as const).map((role) => {
              const tf = cascade[role];
              const isActive = activeTf === tf;
              const isMember = activeTf ? tfRoleInMode(activeTf, mode as Exclude<TradeMode, 'off'>) === role : false;
              const roleLabelKey =
                role === 'major' ? 'major' : role === 'confirm' ? 'mtf_confirm_role' : 'mtf_trading_role';
              return (
                <button
                  key={role}
                  type="button"
                  className={`mtf-tf-btn${isActive ? ' active' : ''}${isMember ? ' member' : ''}`}
                  style={{ borderColor: ROLE_TINT[role] }}
                  onClick={() => useStore.getState().setTimeframe(activePane, tf)}
                  title={`${t(roleLabelKey)} — ${t(`${role}_role`)}`}
                >
                  <span className="mtf-tf-role" style={{ color: ROLE_TINT[role] }}>
                    {t(roleLabelKey)}
                  </span>
                  <span className="mtf-tf-label">{tf}</span>
                  <span className="mtf-tf-role-label">{t(`${role}_role`)}</span>
                </button>
              );
            })}
          </div>

          <div className="mtf-bias-row" role="group" aria-label={t('bias')}>
            <span className="mtf-section-label">{t('bias')}</span>
            <BiasBtn value="none" current={settings.mtfBias} label={t('bias_none')} />
            <BiasBtn value="buy" current={settings.mtfBias} label={t('bias_buy')} tone="up" />
            <BiasBtn value="sell" current={settings.mtfBias} label={t('bias_sell')} tone="down" />
          </div>

          <div className="mtf-nesting-card">
            <div className="mtf-nesting-head">
              <span className="mtf-section-label">{t('mtf_nesting')}</span>
              {nestingPairs.length > 0 ? (
                <span className="mtf-badge good">
                  {nestingPairs.length === 1
                    ? t('mtf_nesting_found_singular')
                    : t('mtf_nesting_found_plural', { n: nestingPairs.length })}
                </span>
              ) : (
                <span className="mtf-badge dim">{t('mtf_nesting_none')}</span>
              )}
            </div>
            {nestingPairs.length > 0 && (
              <ul className="mtf-nesting-list">
                {nestingPairs.slice(0, 6).map((p, i) => (
                  <li key={i}>
                    <span className="mtf-pair-a">{labelOf(p.drawingA.tool)}</span>
                    <span className="mtf-pair-x">×</span>
                    <span className="mtf-pair-b">{labelOf(p.drawingB.tool)}</span>
                    <span className="mtf-pair-pct">{Math.round(p.overlapPct * 100)}%</span>
                    {p.innerOuter && <span className="mtf-pair-inner">inner</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mtf-checklist">
            <div className="mtf-checklist-head">
              <span className="mtf-section-label">{t('mtf_checklist')}</span>
              <button
                type="button"
                className="btn tiny"
                onClick={() => useStore.getState().resetMtfChecklist()}
              >
                {t('mtf_reset')}
              </button>
            </div>
            <ul className="mtf-check-list">
              {MTF_STEPS.map((step) => (
                <li key={step.key}>
                  <label className={`mtf-check-row${step.required ? '' : ' optional'}`}>
                    <input
                      type="checkbox"
                      checked={!!settings.mtfSteps[step.key]}
                      onChange={() => useStore.getState().toggleMtfStep(step.key)}
                    />
                    <span className="mtf-check-label">{locale === 'id' ? step.labelId : step.label}</span>
                    {!step.required && <span className="mtf-check-tag">bonus</span>}
                  </label>
                </li>
              ))}
            </ul>
            <div className={`mtf-status${requiredDone ? ' ready' : ' blocked'}`}>
              {requiredDone
                ? t('mtf_ready')
                : `${t('mtf_blocked')} (${requiredCount}/${requiredTotal})`}
            </div>
          </div>

          <p className="mtf-explainer dim small">{t('mtf_explainer')}</p>
          <p className="mtf-video-ref dim tiny">{t('mtf_video_ref')}</p>
        </>
      )}
    </div>
  );
}

function BiasBtn(props: {
  value: BiasDirection;
  current: BiasDirection;
  label: string;
  tone?: 'up' | 'down';
}) {
  const cls = `mtf-bias-btn${props.current === props.value ? ' active' : ''}${
    props.tone ? ` ${props.tone}` : ''
  }`;
  return (
    <button
      type="button"
      className={cls}
      aria-pressed={props.current === props.value}
      onClick={() => useStore.getState().setMtfBias(props.value)}
    >
      {props.label}
    </button>
  );
}

function labelOf(tool: string): string {
  return tool.replace(/-/g, ' ');
}
