import { useState } from 'react';
import { getDefinition } from '@trade/indicators';
import { useStore } from '../state/store';
import { translate } from '../i18n';
import { requestNotificationPermission } from '../alerts/engine';
import { Field, Modal } from './primitives';

export function SettingsDialog(props: { onClose: () => void }) {
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const settings = useStore((s) => s.settings);

  const onExport = () => {
    const state = useStore.getState();
    const payload = {
      version: state.version,
      locale: state.locale,
      theme: state.theme,
      layout: state.layout,
      scaleMode: state.scaleMode,
      magnet: state.magnet,
      providerBySymbol: state.providerBySymbol,
      indicators: state.indicators,
      indicatorTemplates: state.indicatorTemplates,
      drawings: state.drawings,
      alerts: state.alerts,
      settings: state.settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trade-workspace.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        useStore.getState().importState(data);
        useStore.getState().pushToast('Workspace imported', 'success');
      } catch {
        useStore.getState().pushToast('Invalid workspace file', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <Modal title={t('settings')} onClose={props.onClose}>
      <Field label={t('api_key')}>
        <input
          type="password"
          className="text-input"
          value={settings.twelveDataKey ?? ''}
          placeholder="Twelve Data"
          onChange={(e) => useStore.getState().updateSettings({ twelveDataKey: e.target.value })}
        />
      </Field>
      <p className="dim small">
        Stored only in this browser (localStorage). Never sent anywhere else.
      </p>
      <Field label={t('proxy_url')}>
        <input
          type="text"
          className="text-input"
          value={settings.proxyUrl ?? ''}
          placeholder="https://your-proxy.example.workers.dev"
          onChange={(e) => useStore.getState().updateSettings({ proxyUrl: e.target.value })}
        />
      </Field>
      <Field label={t('notify_browser')}>
        <input
          type="checkbox"
          checked={settings.notifications}
          onChange={async (e) => {
            useStore.getState().updateSettings({ notifications: e.target.checked });
            if (e.target.checked) await requestNotificationPermission();
          }}
        />
      </Field>
      <Field label={t('sound')}>
        <input
          type="checkbox"
          checked={settings.sound}
          onChange={(e) => useStore.getState().updateSettings({ sound: e.target.checked })}
        />
      </Field>
      <Field label="Account size">
        <input
          type="number"
          className="text-input"
          value={settings.accountSize}
          onChange={(e) =>
            useStore.getState().updateSettings({ accountSize: Number(e.target.value) || 0 })
          }
        />
      </Field>
      <Field label="Risk % per trade">
        <input
          type="number"
          className="text-input"
          value={settings.riskPct}
          step="0.25"
          onChange={(e) =>
            useStore.getState().updateSettings({ riskPct: Number(e.target.value) || 1 })
          }
        />
      </Field>
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onExport}>
          {t('export_state')}
        </button>
        <label className="btn file-btn">
          {t('import_state')}
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
            }}
          />
        </label>
      </div>
    </Modal>
  );
}

export function IndicatorSettingsDialog() {
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const indicators = useStore((s) => s.indicators);
  const editingId = useStore((s) => s.editingIndicatorId);
  const instance = indicators.find((i) => i.id === editingId);
  const def = instance ? getDefinition(instance.type) : undefined;
  const [params, setParams] = useState<Record<string, number | string | boolean>>(
    () => instance?.params ?? {},
  );
  if (!instance || !def) return null;

  return (
    <Modal
      title={`${t('indicator_settings')} — ${def.name}`}
      onClose={() => useStore.getState().setEditingIndicator(null)}
    >
      {def.params.length === 0 && <p className="dim">No settings for this indicator.</p>}
      {def.params.map((spec) => (
        <Field key={spec.key} label={spec.label}>
          {spec.type === 'select' ? (
            <select
              className="tb-select"
              value={String(params[spec.key] ?? spec.default)}
              onChange={(e) => setParams({ ...params, [spec.key]: e.target.value })}
            >
              {spec.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              className="text-input"
              value={Number(params[spec.key] ?? spec.default)}
              min={spec.min}
              max={spec.max}
              step={spec.step ?? 1}
              onChange={(e) => setParams({ ...params, [spec.key]: Number(e.target.value) })}
            />
          )}
        </Field>
      ))}
      <div className="dialog-actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            useStore.getState().updateIndicator(instance.id, params);
            useStore.getState().setEditingIndicator(null);
          }}
        >
          {t('save')}
        </button>
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            useStore.getState().removeIndicator(instance.id);
            useStore.getState().setEditingIndicator(null);
          }}
        >
          {t('remove')}
        </button>
      </div>
    </Modal>
  );
}

export function AlertDialog(props: { onClose: () => void; symbol: string }) {
  const locale = useStore((s) => s.locale);
  const t = (key: string) => translate(locale, key);
  const alerts = useStore((s) => s.alerts);
  const [value, setValue] = useState('');
  const [kind, setKind] = useState<'price-above' | 'price-below' | 'price-cross'>('price-above');

  return (
    <Modal title={t('price_alert')} onClose={props.onClose}>
      <div className="alert-form">
        <select
          className="tb-select"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="price-above">{t('above')}</option>
          <option value="price-below">{t('below')}</option>
          <option value="price-cross">{t('cross')}</option>
        </select>
        <input
          type="number"
          className="text-input"
          placeholder="0.00"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="button"
          className="btn"
          disabled={value === ''}
          onClick={() => {
            useStore.getState().addAlert({
              symbol: props.symbol,
              kind,
              value: Number(value),
              active: true,
              repeat: false,
            });
            setValue('');
          }}
        >
          {t('add_alert')}
        </button>
      </div>
      <div className="alert-list">
        {alerts.map((a) => (
          <div key={a.id} className="alert-row">
            <span>{a.symbol}</span>
            <span>{a.kind.replace('price-', '')}</span>
            <span>{a.value}</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => useStore.getState().toggleAlert(a.id)}
            >
              {a.active ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => useStore.getState().removeAlert(a.id)}
            >
              x
            </button>
          </div>
        ))}
        {alerts.length === 0 && <p className="dim">{t('no_data')}</p>}
      </div>
    </Modal>
  );
}
