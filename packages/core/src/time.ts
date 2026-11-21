import type { Candle, Timeframe } from './types';

export const TIMEFRAMES: Timeframe[] = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '6h',
  '12h',
  '1D',
  '1W',
  '1M',
];

export function tfToSeconds(tf: Timeframe): number {
  switch (tf) {
    case '1m':
      return 60;
    case '3m':
      return 180;
    case '5m':
      return 300;
    case '15m':
      return 900;
    case '30m':
      return 1800;
    case '1h':
      return 3600;
    case '2h':
      return 7200;
    case '4h':
      return 14400;
    case '6h':
      return 21600;
    case '12h':
      return 43200;
    case '1D':
      return 86400;
    case '1W':
      return 604800;
    case '1M':
      // Approximation used for spacing math; alignment uses calendar months.
      return 2629800;
  }
}

function isCalendarTf(tf: Timeframe): boolean {
  return tf === '1D' || tf === '1W' || tf === '1M';
}

/** Align a UTC timestamp (seconds) down to the open time of its candle for `tf`. */
export function alignTime(ts: number, tf: Timeframe): number {
  if (tf === '1M') {
    const d = new Date(ts * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
  }
  if (tf === '1W') {
    const day = Math.floor(ts / 86400);
    // Epoch (1970-01-01) was a Thursday. 0 = Sunday ... 6 = Saturday.
    const dow = (day + 4) % 7;
    const daysSinceMonday = (dow + 6) % 7;
    return (day - daysSinceMonday) * 86400;
  }
  if (tf === '1D') {
    return Math.floor(ts / 86400) * 86400;
  }
  const sec = tfToSeconds(tf);
  return Math.floor(ts / sec) * sec;
}

/** Open time of the candle that follows the candle containing `ts`. */
export function nextCandleTime(ts: number, tf: Timeframe): number {
  const aligned = alignTime(ts, tf);
  if (tf === '1M') {
    const d = new Date(aligned * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000;
  }
  if (tf === '1W') {
    return aligned + 604800;
  }
  return aligned + tfToSeconds(tf);
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format UTC seconds as `YYYY-MM-DD HH:mm` (UTC). */
export function formatTime(ts: number, withDate = true): string {
  const d = new Date(ts * 1000);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return withDate ? `${date} ${time}` : time;
}

/** Format UTC seconds as `YYYY-MM-DD`. */
export function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Aggregate a lower-timeframe candle series into a higher timeframe.
 * Input must be sorted ascending and deduplicated by open time.
 */
export function resampleCandles(candles: Candle[], tf: Timeframe): Candle[] {
  const out: Candle[] = [];
  let current: Candle | null = null;
  let currentTime = -1;
  for (const c of candles) {
    const bucket = alignTime(c.time, tf);
    if (current === null || bucket !== currentTime) {
      if (current !== null) out.push(current);
      currentTime = bucket;
      current = {
        time: bucket,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      };
    } else {
      current.high = Math.max(current.high, c.high);
      current.low = Math.min(current.low, c.low);
      current.close = c.close;
      current.volume += c.volume;
    }
  }
  if (current !== null) out.push(current);
  return out;
}

/** Number of whole candles of `tf` that fit between two timestamps (approximate for 1M). */
export function candlesBetween(from: number, to: number, tf: Timeframe): number {
  if (to <= from) return 0;
  if (tf === '1M') {
    const a = new Date(from * 1000);
    const b = new Date(to * 1000);
    return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  }
  return Math.floor((to - from) / tfToSeconds(tf));
}

export function isCalendarTfExport(tf: Timeframe): boolean {
  return isCalendarTf(tf);
}
