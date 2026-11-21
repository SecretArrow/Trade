import { formatPrice } from '@trade/core';
import { useStore } from '../state/store';

let audioCtx: AudioContext | null = null;

function beep(): void {
  try {
    audioCtx ??= new AudioContext();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
    setTimeout(() => {
      const osc2 = audioCtx!.createOscillator();
      const gain2 = audioCtx!.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 1180;
      gain2.gain.setValueAtTime(0.12, audioCtx!.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx!.currentTime + 0.3);
      osc2.connect(gain2).connect(audioCtx!.destination);
      osc2.start();
      osc2.stop(audioCtx!.currentTime + 0.3);
    }, 420);
  } catch {
    // audio unavailable
  }
}

/** Check all active alerts for a symbol against the latest price. */
export function checkAlerts(symbol: string, price: number): void {
  const state = useStore.getState();
  for (const alert of state.alerts) {
    if (!alert.active || alert.symbol !== symbol) continue;
    if (alert.triggeredAt && Date.now() - alert.triggeredAt < 5000) continue;
    let hit = false;
    if (alert.kind === 'price-above') hit = price >= alert.value;
    else if (alert.kind === 'price-below') hit = price <= alert.value;
    else if (alert.kind === 'price-cross')
      hit = Math.abs(price - alert.value) / alert.value < 0.0002;
    if (!hit) continue;

    const info = symbol.split('/')[0];
    useStore.getState().markAlertTriggered(alert.id);
    useStore
      .getState()
      .pushToast(
        `${info} ${alert.kind === 'price-above' ? '>=' : alert.kind === 'price-below' ? '<=' : '='} ${formatPrice(alert.value, 2)} — current ${formatPrice(price, 2)}`,
        'success',
      );
    const settings = useStore.getState().settings;
    if (settings.sound) beep();
    if (
      settings.notifications &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      new Notification(`Trade — ${symbol}`, {
        body: `Price ${formatPrice(price, 2)} crossed your alert at ${formatPrice(alert.value, 2)}`,
      });
    }
  }
}

export async function requestNotificationPermission(): Promise<void> {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // denied
    }
  }
}
