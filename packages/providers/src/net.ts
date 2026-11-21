/**
 * Tiny HTTP layer: JSON GET with timeout, retry + exponential backoff on
 * 429/418/5xx and network errors, request coalescing and a small TTL cache.
 * All providers go through this so rate limits are handled uniformly.
 */

const inflight = new Map<string, Promise<unknown>>();

interface CacheEntry {
  expires: number;
  value: unknown;
}
const cache = new Map<string, CacheEntry>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function jitter(base: number): number {
  return base * (0.75 + Math.random() * 0.5);
}

async function fetchOnce(
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, headers });
  } finally {
    clearTimeout(timer);
  }
}

export interface GetJsonOptions {
  timeoutMs?: number;
  retries?: number;
  cacheTtlMs?: number;
  headers?: Record<string, string>;
}

export async function getJson<T>(url: string, options: GetJsonOptions = {}): Promise<T> {
  const { timeoutMs = 12_000, retries = 3, cacheTtlMs = 0, headers } = options;

  if (cacheTtlMs > 0) {
    const hit = cache.get(url);
    if (hit && hit.expires > Date.now()) return hit.value as T;
  }

  const existing = inflight.get(url);
  if (existing) return existing as Promise<T>;

  const task = (async () => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetchOnce(url, timeoutMs, headers);
        if (res.status === 429 || res.status === 418 || res.status >= 500) {
          const retryAfter = Number.parseFloat(res.headers.get('retry-after') ?? '');
          const waitMs =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : jitter(600 * 2 ** attempt);
          if (attempt === retries) {
            throw new Error(`HTTP ${res.status} from ${new URL(url).host} (rate limited)`);
          }
          await sleep(Math.min(waitMs, 15_000));
          continue;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
        }
        const value = (await res.json()) as T;
        if (cacheTtlMs > 0) {
          cache.set(url, { value, expires: Date.now() + cacheTtlMs });
        }
        return value;
      } catch (err) {
        lastError = err;
        if (attempt === retries) break;
        await sleep(Math.min(jitter(500 * 2 ** attempt), 10_000));
      }
    }
    throw lastError instanceof Error ? lastError : new Error('request failed');
  })();

  inflight.set(url, task);
  try {
    return await task;
  } finally {
    inflight.delete(url);
  }
}

/** GET returning raw text (CSV feeds). */
export async function getText(url: string, options: GetJsonOptions = {}): Promise<string> {
  const { timeoutMs = 12_000, retries = 3, headers } = options;
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchOnce(url, timeoutMs, headers);
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      await sleep(Math.min(jitter(500 * 2 ** attempt), 10_000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('request failed');
}

export function proxied(url: string, proxyBase?: string): string {
  if (!proxyBase) return url;
  const base = proxyBase.replace(/\/$/, '');
  return `${base}/?url=${encodeURIComponent(url)}`;
}

export function clearNetCache(): void {
  cache.clear();
}
