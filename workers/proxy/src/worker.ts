/**
 * Trade data CORS proxy.
 *
 * Forwards GET requests to an allow-listed set of public market-data hosts
 * and adds CORS headers, so the browser can read feeds that normally block
 * cross-origin requests. Responses are cached briefly and each client IP is
 * rate limited.
 */

const ALLOWED_HOSTS = new Set([
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'stooq.com',
  'www.stooq.com',
]);

const CACHE_SECONDS = 60;
const RATE_LIMIT = 30; // requests per minute per IP

const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'User-Agent',
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'GET') {
      return new Response('method not allowed', { status: 405, headers: corsHeaders });
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    if (rateLimited(ip)) {
      return new Response('rate limited', { status: 429, headers: corsHeaders });
    }

    const target = new URL(request.url).searchParams.get('url');
    if (!target) {
      return new Response('missing ?url= parameter', { status: 400, headers: corsHeaders });
    }
    let targetUrl: URL;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('invalid url', { status: 400, headers: corsHeaders });
    }
    if (targetUrl.protocol !== 'https:' || !ALLOWED_HOSTS.has(targetUrl.hostname)) {
      return new Response('host not allowed', { status: 403, headers: corsHeaders });
    }

    const cache = caches.default;
    const cacheKey = new Request(targetUrl.toString(), { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) {
      return new Response(cached.body, cached);
    }

    const upstream = await fetch(targetUrl.toString(), {
      headers: { 'User-Agent': request.headers.get('User-Agent') ?? 'Trade-Proxy/1.0' },
    });
    const body = await upstream.arrayBuffer();
    const response = new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type': upstream.headers.get('Content-Type') ?? 'text/plain',
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
      },
    });
    if (upstream.ok) {
      await cache.put(cacheKey, response.clone());
    }
    return response;
  },
};
