// Provider availability smoke test. Runs on a schedule in CI and produces a
// markdown report. This script never fails the workflow: it is informational.
const UA = 'Trade-ProviderSmoke/1.0 (+https://github.com/SecretArrow/Trade)';

/** @typedef {{ name: string, url: string, okStatus: number[], check?: (body: unknown) => boolean, note?: string }} Check */

/** @type {Check[]} */
const checks = [
  { name: 'Binance ping', url: 'https://api.binance.com/api/v3/ping', okStatus: [200] },
  {
    name: 'Binance klines BTCUSDT',
    url: 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=2',
    okStatus: [200],
    check: (b) => Array.isArray(b) && b.length === 2,
  },
  {
    name: 'Binance XAUTUSDT listed',
    url: 'https://api.binance.com/api/v3/exchangeInfo?symbol=XAUTUSDT',
    okStatus: [200],
    check: (b) => Array.isArray(b?.symbols) && b.symbols.length > 0,
  },
  {
    name: 'Binance PAXGUSDT listed',
    url: 'https://api.binance.com/api/v3/exchangeInfo?symbol=PAXGUSDT',
    okStatus: [200],
    check: (b) => Array.isArray(b?.symbols) && b.symbols.length > 0,
  },
  {
    name: 'Bybit linear BTCUSDT',
    url: 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT',
    okStatus: [200],
    check: (b) => b?.retCode === 0,
  },
  {
    name: 'Bybit linear XAUUSDT',
    url: 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=XAUUSDT',
    okStatus: [200],
    check: (b) => b?.retCode === 0,
    note: 'gold perpetual (proxy for spot gold)',
  },
  {
    name: 'Bybit spot XAUTUSDT',
    url: 'https://api.bybit.com/v5/market/tickers?category=spot&symbol=XAUTUSDT',
    okStatus: [200],
    check: (b) => b?.retCode === 0,
  },
  {
    name: 'OKX ticker BTC-USDT',
    url: 'https://www.okx.com/api/v5/market/ticker?instId=BTC-USDT',
    okStatus: [200],
    check: (b) => b?.code === '0',
  },
  {
    name: 'OKX XAUT-USDT listed',
    url: 'https://www.okx.com/api/v5/public/instruments?instType=SPOT&instId=XAUT-USDT',
    okStatus: [200],
    check: (b) => b?.code === '0' && Array.isArray(b?.data) && b.data.length > 0,
  },
  {
    name: 'Kraken OHLC XBT/USDT',
    url: 'https://api.kraken.com/0/public/OHLC?pair=XBTUSDT&interval=15',
    okStatus: [200],
    check: (b) => Array.isArray(b?.error) && b.error.length === 0,
  },
  {
    name: 'Kraken XAUT/USD listed',
    url: 'https://api.kraken.com/0/public/AssetPairs?pair=XAUTUSD',
    okStatus: [200],
    check: (b) => Array.isArray(b?.error) && b.error.length === 0,
  },
  {
    name: 'Coinbase candles BTC-USD',
    url: 'https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=900',
    okStatus: [200],
    check: (b) => Array.isArray(b),
  },
  {
    name: 'Gate candlesticks BTC_USDT',
    url: 'https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=BTC_USDT&interval=15m&limit=2',
    okStatus: [200],
    check: (b) => Array.isArray(b),
  },
  {
    name: 'Gate XAUT_USDT listed',
    url: 'https://api.gateio.ws/api/v4/spot/currency_pairs/XAUT_USDT',
    okStatus: [200],
    check: (b) => Boolean(b?.id),
  },
  {
    name: 'Twelve Data reachable (key required)',
    url: 'https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=1day&outputsize=2',
    okStatus: [200, 401, 403],
    note: '401/403 without user API key counts as reachable',
  },
  {
    name: 'Yahoo Finance chart reachable (proxy required)',
    url: 'https://query1.finance.yahoo.com/v8/finance/chart/XAUUSD=X?interval=1d&range=5d',
    okStatus: [200, 401, 403, 429],
    note: 'browser access requires the CORS proxy; reachability only',
  },
  {
    name: 'Stooq daily CSV reachable (proxy required)',
    url: 'https://stooq.com/q/d/l/?s=xauusd&i=d',
    okStatus: [200, 403, 429],
    note: 'browser access requires the CORS proxy; reachability only',
  },
];

async function runCheck(check) {
  const started = Date.now();
  try {
    const res = await fetch(check.url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10_000),
    });
    const ms = Date.now() - started;
    let bodyOk = true;
    let detail = `HTTP ${res.status}`;
    if (check.okStatus.includes(res.status)) {
      try {
        const body = await res.json();
        if (check.check && !check.check(body)) {
          bodyOk = false;
          detail = 'HTTP ok, unexpected payload';
        }
      } catch {
        // CSV or non-JSON responses are fine when no check is defined
        if (check.check) {
          bodyOk = false;
          detail = 'HTTP ok, non-JSON payload';
        }
      }
    } else {
      bodyOk = false;
    }
    return { name: check.name, ok: bodyOk, detail, ms, note: check.note ?? '' };
  } catch (err) {
    return {
      name: check.name,
      ok: false,
      detail: `error: ${String(err).slice(0, 80)}`,
      ms: Date.now() - started,
      note: check.note ?? '',
    };
  }
}

const results = [];
for (const check of checks) {
  results.push(await runCheck(check));
}

const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
const up = results.filter((r) => r.ok).length;
console.log(`# Provider status report`);
console.log('');
console.log(`Generated: ${now} UTC — ${up}/${results.length} endpoints OK`);
console.log('');
console.log('| Endpoint | Status | Detail | Latency | Note |');
console.log('|---|---|---|---|---|');
for (const r of results) {
  console.log(`| ${r.name} | ${r.ok ? 'UP' : 'DOWN'} | ${r.detail} | ${r.ms} ms | ${r.note} |`);
}
console.log('');
console.log('This issue is updated automatically every 6 hours by CI.');
