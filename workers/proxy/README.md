# Trade CORS proxy (optional Cloudflare Worker)

A tiny proxy that lets the browser reach data sources that do not send CORS
headers (Yahoo Finance, Stooq). Deploy it to Cloudflare Workers (free tier)
and paste the URL into the app's Settings dialog.

```bash
cd workers/proxy
npx wrangler deploy
```

Security properties:

- Strict allow-list of upstream hosts (no open proxy).
- 60-second cache with stale-while-revalidate to stay far below rate limits.
- Simple per-IP token bucket (30 requests/minute) to prevent abuse.

No secrets are required; the worker is entirely public infrastructure.
