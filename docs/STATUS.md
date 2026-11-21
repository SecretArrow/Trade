# Project status

Milestone tracker for the Trade charting terminal. Updated by the maintainers
in neutral language.

| Milestone | Scope | Status |
| --- | --- | --- |
| M1 | Monorepo scaffold, CI/CD green, "hello chart" deployed to Pages | Done |
| M2 | Providers, real candles for all pairs, provider dropdown, cross-check | Done |
| M3 | Chart types, timeframes, live updates, themes, responsive shell | Done |
| M4 | Core indicators with settings and templates | Done |
| M5 | Drawing tools, persistence, undo/redo, mobile gestures (basic touch placement) | Done |
| M6 | Structure/analysis indicators and methodology coverage checklist | Done |
| M7 | Alerts, watchlist, multi-chart layouts, export, PWA, i18n | Done |
| M8 | Hardening: performance budgets, a11y, security, docs, v1.0.0 release | In progress |

## Implemented feature map

- Data: Binance, Bybit, OKX, Kraken, Coinbase, Gate.io, Twelve Data (user
  key), Yahoo Finance and Stooq (via optional CORS proxy), plus a
  deterministic synthetic demo source. WebSocket live updates with
  exponential-backoff reconnect, REST polling fallback, gap detection,
  deduplication, server-time offset and a 30 s cross-provider price
  deviation check (0.3% crypto / 0.15% gold thresholds).
- Indicators (all pure functions in `packages/indicators`, unit-tested):
  SMA/EMA/WMA/VWMA/HMA/DEMA/TEMA, MA ribbon, envelope, Bollinger, Keltner,
  Donchian, RSI, Stochastic, Stochastic RSI, MACD, CCI, Williams %R, ROC,
  Momentum, Awesome Oscillator, Standard Deviation, ATR, ADX/DMI, Parabolic
  SAR, Supertrend, Ichimoku, VWAP (day/week/month anchor), OBV, MFI,
  Accumulation/Distribution, Chaikin Money Flow, Volume + MA, Pivot Points
  (classic/fibonacci/camarilla), MA 50/200 confluence preset.
- Structure detection: support/resistance zones with a break-validation
  lifecycle (candidate -> validated after a body-close break -> invalidated
  after too many crossings; wick tests never invalidate), higher-timeframe
  S/R, break & retest detector with false-break marking, role reversal,
  confirmation-candle logic and informational entry/stop/target suggestions
  at a configurable R multiple, strict three-candle supply/demand zones with
  retest/mitigation tracking and 50% entry level, order blocks, fair value
  gaps, market structure (HH/HL/LH/LL, BOS, CHoCH), zigzag-gated parallel
  channel with 4th-pivot projection, auto trendlines, auto Fibonacci levels
  with golden-ratio emphasis, RSI/MACD divergence (regular + hidden),
  candlestick patterns (engulfing, pin bars, doji, morning/evening star,
  inside bar, three soldiers/crows).
- Drawings: 34 tools (lines, channels, shapes, labels, all Fibonacci and
  Gann variants, pitchfork, regression trend, long/short position tool with
  R:R and size calculator, anchored VWAP, callout, flags), magnet snapping,
  per-symbol persistence with time/price anchors, undo/redo, object tree,
  lock/hide/duplicate/z-order.
- App: multi-chart layouts (1 / 2 / 2x2), dark/light/system themes, EN/ID
  UI, watchlist with live tickers, price alerts with browser notifications
  and sound, workspace export/import, PNG chart export, fullscreen,
  keyboard shortcuts, PWA with offline shell and update prompt, responsive
  desktop + mobile layouts (bottom sheets, 44px touch targets, safe-area
  insets).

## Known limitations / roadmap

- Indicator recomputation on live ticks is batched at 250 ms in a Web Worker
  (full-series recompute in the worker keeps the main thread at 60 fps; true
  incremental per-tick updates are a future optimization).
- Yahoo Finance and Stooq need the optional CORS proxy worker
  (`workers/proxy` scaffolding) to be deployed before they appear in the UI.
- Visual regression snapshots and axe accessibility audits are not yet part
  of e2e (Lighthouse a11y budgets cover the basics).
- Mobile drawing interactions cover tap placement and two-finger chart
  pan/zoom (native); long-press placement is best-effort.

## Notes

- CI must stay green on `main`; automated fixes land via the Autofix workflow.
- The internal research notes under `docs/internal/` are developer-only and
  excluded from the deployed bundle.
