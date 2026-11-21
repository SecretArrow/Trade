# Trade

A fast, free, TradingView-style charting terminal for **BTC/USDT**, **XAU/USD** (spot gold) and **XAUT/USDT** (tokenized gold), with a rich indicator library, drawing tools, structure detection and live data from multiple free exchanges and data providers.

For informational purposes only. Not financial advice.

## Features

- Candlestick / hollow candles / bars / line / area / Heikin-Ashi / baseline chart types
- Timeframes from 1m to 1M with per-provider capability detection
- Linear / logarithmic / percentage price scales, crosshair with OHLCV legend
- Live updates over WebSocket with automatic reconnect and REST polling fallback
- Data source dropdown: Binance, Bybit, OKX, Kraken, Coinbase, Gate.io, Twelve Data (user key), Yahoo Finance and Stooq (via CORS proxy), plus an offline synthetic demo source
- Cross-provider price accuracy check with a visible warning badge on large deviation
- 40+ indicators computed in a Web Worker (moving averages, bands, oscillators, volume tools, Ichimoku, PSAR, Supertrend, VWAP, pivot points and more)
- Structure detection: support/resistance zones with break validation, break & retest setups, supply/demand zones, fair value gaps, market structure (HH/HL/LH/LL, BOS, CHoCH), auto trendlines and channels, auto Fibonacci levels, candlestick patterns, divergence
- Drawing tools: trend lines, channels, rectangles, Fibonacci retracement, long/short position tool with risk-reward, anchored VWAP, labels and more, with magnet snapping, undo/redo and persistence
- Client-side alerts on price levels, in-app notifications and sound
- Watchlist with live prices, multi-chart layouts (1 / 2 side-by-side / 2x2)
- Dark and light themes, English and Indonesian UI, PWA install support
- Everything stored locally in your browser; export/import your workspace as JSON

## Try it

The app is deployed automatically to GitHub Pages from `main`:

https://secretarrow.github.io/Trade/

## Data sources

All built-in providers use free public APIs. Twelve Data requires a personal
free API key which you can enter in Settings; it is stored only in your
browser. Yahoo Finance and Stooq require the optional CORS proxy worker (see
`workers/proxy`); until it is deployed they are disabled in the UI.

| Pair      | Direct providers                                                                              | Notes                                                      |
| --------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| BTC/USDT  | Binance, Bybit, OKX, Kraken, Coinbase (BTC-USD), Gate.io                                      |                                                            |
| XAU/USD   | Twelve Data (key), Yahoo (proxy), Stooq (proxy), Bybit XAU perp (proxy), Binance PAXG (proxy) | spot gold vs tokenized gold are always labelled separately |
| XAUT/USDT | Binance, Bybit, OKX, Kraken (XAUT/USD), Gate.io                                               |                                                            |

Prices are normalized to UTC-second open timestamps, deduplicated, gap-checked
and never mixed across providers within one series. A background cross-check
compares the last price across providers and warns when deviation exceeds
0.3% (crypto) or 0.15% (gold).

## Development

```bash
pnpm install
pnpm dev          # start the dev server
pnpm test         # unit tests with coverage gates
pnpm build        # production build
```

Repository layout (pnpm workspaces):

```
apps/web             UI (React + Vite + Lightweight Charts)
packages/core        shared types, time math, formatting
packages/indicators  pure indicator functions (fully unit tested)
packages/providers   data provider adapters, normalizers, fixtures
packages/drawings    drawing model and hit testing
e2e/                 Playwright end-to-end tests
scripts/             CI helper scripts
```

## CI/CD

GitHub Actions runs lint (ESLint, Prettier, tsc, gitleaks), unit tests with
coverage gates, the production build with a bundle-size budget, sharded
Playwright e2e (desktop Chromium, mobile Chromium, mobile WebKit), a
non-blocking live-data smoke test, Lighthouse budgets, and deploys to GitHub
Pages on every green push to `main`. Releases are automated with
release-please and a scheduled workflow pings every provider endpoint every 6
hours and maintains a public status issue.

## License

MIT. Charting engine: [Lightweight Charts](https://github.com/tradingview/lightweight-charts)
by TradingView, Inc., licensed under Apache-2.0 (see `docs/licenses/APACHE-2.0.md`).
