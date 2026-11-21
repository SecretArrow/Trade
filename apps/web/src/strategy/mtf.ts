/**
 * Multi-Timeframe trade workflow — Bang RAN MTF methodology.
 *
 * Idea (dari video https://www.youtube.com/watch?v=1E12EuGaL1c):
 * - Setiap trade punya 3 time frame dengan fungsi berbeda:
 *   1. Major   → menentukan arah/bias + zona SnR besar
 *   2. Confirm → bukti reaksi (trendline break / struktur break / SND fresh)
 *   3. Trading → zona SND presisi untuk entry
 * - Target selalu dibatasi zona TF di atasnya; jangan entry M1 lalu target swing.
 * - SND yang bertumpuk (nesting) antar-TF = setup terkuat.
 *
 * Modul ini hanya berisi konstanta + pure helper — UI/state di tempat lain.
 */

import type { Timeframe } from '@trade/core';
import { tfToSeconds } from '@trade/core';
import type { Drawing } from '@trade/drawings';

export type TradeMode = 'swing' | 'intraday' | 'scalping' | 'off';

export interface ModeCascade {
  major: Timeframe;
  confirm: Timeframe;
  trading: Timeframe;
  /** Karakter singkat untuk ditampilkan di UI. */
  character: string;
  /** Rasio major:confirm:trading (detik) — dipakai untuk validasi/edukasi. */
  ratios: readonly [number, number, number];
}

export const TRADE_MODES: Record<Exclude<TradeMode, 'off'>, ModeCascade> = {
  swing: {
    major: '1W',
    confirm: '4h',
    trading: '1h',
    character: 'Tahan berhari–berminggu, target ratusan pips',
    ratios: [604800, 14400, 3600],
  },
  intraday: {
    major: '4h',
    confirm: '30m',
    trading: '15m',
    character: 'Selesai dalam sehari, tidak menginap',
    ratios: [14400, 1800, 900],
  },
  scalping: {
    major: '30m',
    confirm: '5m',
    trading: '1m',
    character: 'Hitungan menit–jam, target kecil, cepat keluar',
    ratios: [1800, 300, 60],
  },
} as const;

export const TRADE_MODE_ORDER: readonly Exclude<TradeMode, 'off'>[] = [
  'swing',
  'intraday',
  'scalping',
] as const;

/** State checklist sebelum klik Buy/Sell — persis dari video. */
export type MtfStepKey =
  | 'mode'
  | 'major-bias'
  | 'price-in-major-zone'
  | 'confirm-evidence'
  | 'entry-snd'
  | 'nesting'
  | 'sl-outside-zone'
  | 'tp-capped';

export interface MtfStep {
  key: MtfStepKey;
  /** Label EN. */
  label: string;
  /** Label ID. */
  labelId: string;
  /** Wajib untuk validasi (true) atau bonus (false). */
  required: boolean;
}

export const MTF_STEPS: readonly MtfStep[] = [
  { key: 'mode', label: 'Mode locked (Swing/Intraday/Scalping)', labelId: 'Mode terkunci', required: true },
  { key: 'major-bias', label: 'Major bias clear (Buy/Sell)', labelId: 'Bias Major jelas', required: true },
  { key: 'price-in-major-zone', label: 'Price reached Major zone', labelId: 'Harga masuk zona Major', required: true },
  { key: 'confirm-evidence', label: 'Confirm: trendline/structure/SND', labelId: 'Confirm: trendline/struktur/SND', required: true },
  { key: 'entry-snd', label: 'Trading TF: SND zone present', labelId: 'Trading TF: zona SND ada', required: true },
  { key: 'nesting', label: 'SND nested across TFs (stronger)', labelId: 'SND bertumpuk antar-TF (lebih kuat)', required: false },
  { key: 'sl-outside-zone', label: 'SL outside zone + spread buffer', labelId: 'SL di luar zona + buffer spread', required: true },
  { key: 'tp-capped', label: 'TP capped at next larger TF zone', labelId: 'TP dibatasi zona TF besar berikutnya', required: true },
] as const;

export type BiasDirection = 'none' | 'buy' | 'sell';

/** Apakah TF ini termasuk dalam pasangan mode tertentu? */
export function tfRoleInMode(
  tf: Timeframe,
  mode: Exclude<TradeMode, 'off'>,
): 'major' | 'confirm' | 'trading' | null {
  const c = TRADE_MODES[mode];
  if (tf === c.major) return 'major';
  if (tf === c.confirm) return 'confirm';
  if (tf === c.trading) return 'trading';
  return null;
}

/** Apakah urutan TF naik? Untuk edukasi: major > confirm > trading harus benar. */
export function isCascadeOrdered(mode: Exclude<TradeMode, 'off'>): boolean {
  const c = TRADE_MODES[mode];
  return (
    tfToSeconds(c.major) > tfToSeconds(c.confirm) && tfToSeconds(c.confirm) > tfToSeconds(c.trading)
  );
}

/** Ambil peran berikutnya dalam alur (major → confirm → trading). */
export function nextRole(role: 'major' | 'confirm' | 'trading'): 'confirm' | 'trading' | null {
  if (role === 'major') return 'confirm';
  if (role === 'confirm') return 'trading';
  return null;
}

/**
 * Deteksi "SND nesting" — zona supply/demand/rectangle/extended dari TF berbeda
 * yang tumpang tindih secara vertikal (price overlap > 50%). Ini poin emas dari
 * video: zona kecil di dalam zona besar = probabilitas tinggi.
 *
 * Hanya mempertimbangkan drawing yang punya rentang harga (rectangle, supply/
 * demand zone, parallel channel, fib-retracement, position tool).
 */
export interface NestingPair {
  drawingA: Drawing;
  drawingB: Drawing;
  overlapPct: number;
  /** True bila salah satu drawing "membungkus" yang lain (inner zone). */
  innerOuter: boolean;
}

const ZONE_TOOLS = new Set<string>([
  'rectangle',
  'parallel-channel',
  'fib-retracement',
  'position-long',
  'position-short',
]);

function priceBounds(d: Drawing): { lo: number; hi: number } | null {
  if (d.anchors.length < 1) return null;
  if (d.tool === 'horizontal-line' || d.tool === 'horizontal-ray' || d.tool === 'anchored-vwap') {
    const p = d.anchors[0].price;
    return { lo: p, hi: p };
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const a of d.anchors) {
    if (a.price < lo) lo = a.price;
    if (a.price > hi) hi = a.price;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) return null;
  return { lo, hi };
}

/** Hitung overlap vertikal antar dua drawing (0..1). */
export function priceOverlap(a: Drawing, b: Drawing): number {
  const ba = priceBounds(a);
  const bb = priceBounds(b);
  if (!ba || !bb) return 0;
  const lo = Math.max(ba.lo, bb.lo);
  const hi = Math.min(ba.hi, bb.hi);
  if (hi <= lo) return 0;
  const overlap = hi - lo;
  const union = Math.max(ba.hi, bb.hi) - Math.min(ba.lo, bb.lo);
  return union > 0 ? overlap / union : 0;
}

/** Deteksi semua pasangan drawing dengan overlap >= threshold. */
export function detectNesting(
  drawings: Drawing[],
  options: { overlapThreshold?: number; zonesOnly?: boolean } = {},
): NestingPair[] {
  const { overlapThreshold = 0.5, zonesOnly = true } = options;
  const pool = drawings.filter((d) => !d.hidden && (zonesOnly ? ZONE_TOOLS.has(d.tool) : true));
  const out: NestingPair[] = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      if (a.symbol !== b.symbol) continue;
      const ov = priceOverlap(a, b);
      if (ov < overlapThreshold) continue;
      const ba = priceBounds(a);
      const bb = priceBounds(b);
      const innerOuter =
        !!ba && !!bb && ((ba.lo <= bb.lo && ba.hi >= bb.hi) || (bb.lo <= ba.lo && bb.hi >= ba.hi));
      out.push({ drawingA: a, drawingB: b, overlapPct: ov, innerOuter });
    }
  }
  return out;
}
