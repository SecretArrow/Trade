# Trade - User Guide

A browser-based charting terminal for BTC/USDT, XAU/USD (spot gold), and XAUT/USDT
(tokenized gold). Live at <https://secretarrow.github.io/Trade/>.

Trade is built around a fast candlestick rendering engine, a Web-Worker indicator
pipeline, a 34-tool drawing layer, and a multi-provider data feed with cross-exchange
deviation checks. Everything runs client-side: your API keys, layouts, and templates
stay in your browser's local storage.

---

## Contents

1. [Overview](#overview)
2. [Getting started](#getting-started)
3. [Data sources and API keys](#data-sources-and-api-keys)
4. [Chart basics](#chart-basics)
5. [Indicators](#indicators)
6. [Drawing tools](#drawing-tools)
7. [Alerts](#alerts)
8. [Watchlist and layouts](#watchlist-and-layouts)
9. [Themes and language](#themes-and-language)
10. [Keyboard shortcuts](#keyboard-shortcuts)
11. [PWA install](#pwa-install)
12. [Export and backup](#export-and-backup)
13. [Troubleshooting](#troubleshooting)
14. [Disclaimer](#disclaimer)

---

## Overview

Trade is a TradingView-style charting terminal focused on two asset families:

| Family         | Symbols   | Notes                                             |
| -------------- | --------- | ------------------------------------------------- |
| Crypto         | BTC/USDT  | Direct USDT pairs from crypto exchanges           |
| Spot gold      | XAU/USD   | London-spot quote via forex / aggregator feeds    |
| Tokenized gold | XAUT/USDT | Tether Gold; always labelled separately from spot |

Spot gold (XAU/USD) and tokenized gold (XAUT/USDT) are never merged or interchanged in
the UI. Some exchanges only expose a proxy instrument for gold (for example a Bybit XAU
perpetual or a Binance PAXG spot pair); those are marked **proxy** in the symbol and
source selectors so you always know what you are looking at.

Key capabilities:

- Multi-provider market data with live WebSocket streaming and REST polling fallback.
- A Live / Delayed / Offline status badge with last-update age.
- A cross-provider price deviation badge (0.30% threshold for crypto, 0.15% for gold).
- 13 intraday and macro timeframes, from 1-minute to 1-month.
- 7 chart types, 3 price scales, OHLCV crosshair legend.
- 40+ indicators grouped into 7 families, up to 20 simultaneously, computed off the main
  thread in a Web Worker.
- 34 drawing tools, including all Fibonacci variants, Gann, Andrews pitchfork, and a
  long/short position tool with risk:reward and size calculator.
- Client-side price alerts with in-app toast, browser notification, and WebAudio beep.
- Multi-chart layouts (single, 2 side-by-side, 2x2).
- Dark / light / system themes, English and Indonesian UI.
- Installable PWA with offline shell and update prompt.
- PNG export, fullscreen mode, full workspace JSON export / import.

---

## Getting started

1. Open <https://secretarrow.github.io/Trade/> in any modern browser
   (Chrome, Edge, Firefox, Safari).
2. The default symbol is BTC/USDT on a crypto exchange with a live WebSocket feed.
3. Use the symbol selector (top-left) or press `/` to open the symbol search and switch
   to XAU/USD or XAUT/USDT.
4. Pick a timeframe from the top toolbar (e.g. `15m`, `1h`, `1D`).
5. Add indicators from the right sidebar **Indicators** tab, or drawings from the left
   toolbar on desktop (bottom sheet on mobile).

No account is required. All state - selected source, indicators, drawings, templates,
theme, language - is persisted to `localStorage` per browser profile.

### Layout at a glance

Desktop:

```
+--------------------------------------------------------------+
| Top toolbar: symbol | source | timeframe | status | actions  |
+--+--------------------------------------------+-------+------+
|L |  Chart pane(s)                             |Watch- |Osc.  |
|e |                                            |list   |panes |
|f |                                            |Indic. |      |
|t |                                            |Obj.   |      |
|   | tools                                      |Tmpl.  |      |
+--+--------------------------------------------+-------+------+
| Footer disclaimer                                            |
+--------------------------------------------------------------+
```

Mobile replaces the left toolbar and right sidebar with a bottom navigation bar and
bottom sheets. Touch targets are at least 44x44 px and the layout honours notch / home
indicator safe-area insets.

---

## Data sources and API keys

Each symbol remembers its own data source. Open the **Source** dropdown in the top
toolbar to switch providers. Unsupported symbol / source combinations are hidden or
disabled.

| Source        | Symbols                    | Auth                  | Notes                          |
| ------------- | -------------------------- | --------------------- | ------------------------------ |
| Binance       | BTC/USDT, XAUT/USDT        | Public                | WebSocket + REST               |
| Bybit         | BTC/USDT, XAU (proxy perp) | Public                | Gold marked **proxy**          |
| OKX           | BTC/USDT, XAUT/USDT        | Public                | WebSocket + REST               |
| Kraken        | BTC/USDT                   | Public                | REST polling                   |
| Coinbase      | BTC-USD                    | Public                | REST polling                   |
| Gate.io       | BTC/USDT, XAUT/USDT        | Public                | WebSocket + REST               |
| Twelve Data   | BTC/USDT, XAU/USD          | Free personal API key | Forex spot for gold            |
| Yahoo Finance | XAU/USD                    | Public                | Requires CORS proxy worker     |
| Stooq         | XAU/USD                    | Public                | Requires CORS proxy worker     |
| Demo          | All                        | None                  | Deterministic synthetic stream |

### Adding a Twelve Data API key

1. Create a free key at the Twelve Data developer portal.
2. In Trade, open **Settings** (gear icon in the top toolbar).
3. Paste the key into the **Twelve Data API key** field.
4. Save. The key is stored only in your browser's `localStorage` and is never sent to
   any server other than the Twelve Data API itself.

Without a key, the Twelve Data source is unavailable and the dropdown hides it.

### CORS proxy worker

Yahoo Finance and Stooq do not send permissive CORS headers, so Trade routes those
requests through an optional proxy worker. Deploy the worker from `workers/proxy/` to
any Cloudflare / Workers-compatible runtime and enter its URL in **Settings**. If the
worker is not configured, Yahoo and Stooq sources are disabled with a tooltip explaining
why.

### Live / Delayed / Offline status

A badge next to the source selector reflects the feed state:

- **Live** - WebSocket connection healthy, ticks arriving.
- **Delayed** - WebSocket dropped; REST polling is keeping data fresh.
- **Offline** - No data for the last polling interval. The chart freezes on the last
  known bar and the badge shows the age of the last update.

Reconnection is automatic with exponential backoff.

### Cross-provider deviation

When two or more providers can quote the current symbol, Trade computes the max spread
between their latest prints. If the deviation exceeds 0.30% for crypto or 0.15% for
gold, a deviation badge appears next to the price. Use it as a quick sanity check,
especially around volatile news windows.

---

## Chart basics

### Chart types

| Type           | Description                                              |
| -------------- | -------------------------------------------------------- |
| Candlestick    | Standard OHLC candles, filled / hollow by close vs open  |
| Hollow candles | Body outline only, faster visual scan for trend          |
| Bar (OHLC)     | Classic OHLC bars                                        |
| Line           | Close-only line                                          |
| Area           | Close line with shaded area below                        |
| Heikin-Ashi    | Smoothed candles for trend reading                       |
| Baseline       | Line against a configurable baseline; above/below tinted |

Switch chart type from the top toolbar **Chart type** dropdown.

### Timeframes

Available from the timeframe selector:

```
1m  3m  5m  15m  30m  1h  2h  4h  6h  12h  1D  1W  1M
```

Each provider publishes a supported-timeframe list. Timeframes that the active provider
does not serve are disabled in the selector; hover the disabled chip to see the reason.

### Price scales

Three scale modes are available from the scale toggle:

- **Linear** - equal pixel distance per price unit.
- **Logarithmic** - equal pixel distance per percentage move; best for long-range crypto
  charts.
- **Percentage** - charts the instrument as percentage change from the leftmost visible
  bar; useful for comparing relative moves.

### Crosshair and OHLCV legend

Move the pointer (or finger) across the chart to show a crosshair. The legend at the top
of the pane reports OHLC and volume for the bar under the crosshair, plus the indicator
values at that timestamp.

### Chart engine

Every pane can pick its rendering engine from the **Chart engine** dropdown in the top
toolbar:

- **Native** (default) — the built-in Lightweight Charts engine. Works fully offline and
  keeps all local indicators, drawings, and multi-provider data feeds.
- **TradingView** — renders the genuine, free TradingView Advanced Chart widget embedded
  from tradingview.com. It requires an internet connection, and gives you TradingView's
  full native drawing toolbar plus the ability to change the symbol inside the widget.

The choice is per pane and is remembered across reloads. If the widget cannot load (for
example offline or blocked by a network policy), the pane shows a notice with a
**Switch back to native chart** button. Data subscriptions keep running in the
background either way, so the status pill and watchlist stay live.

---

## Indicators

The **Indicators** tab in the right sidebar lists 40+ studies grouped into seven
families. Up to 20 indicators may be active simultaneously. All math runs in a
dedicated Web Worker so the main render thread stays smooth even with a full stack on a
2x2 layout.

| Family               | Indicators                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Moving averages      | SMA, EMA, WMA, VWMA, HMA, DEMA, TEMA, MA ribbon, MA envelope, MA 50/200 confluence preset                                                                                                                                                                                                                                                                                                                                                                                      |
| Bands                | Bollinger Bands, Keltner Channels, Donchian Channels, Standard Deviation                                                                                                                                                                                                                                                                                                                                                                                                       |
| Oscillators          | RSI, Stochastic, Stoch RSI, MACD, CCI, Williams %R, ROC, Momentum, Awesome Oscillator                                                                                                                                                                                                                                                                                                                                                                                          |
| Trend                | ATR, ADX/DMI, Parabolic SAR, Supertrend, Ichimoku Cloud                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Volume               | Volume + MA, VWAP (session-anchored), OBV, MFI, Accumulation/Distribution, Chaikin Money Flow                                                                                                                                                                                                                                                                                                                                                                                  |
| Structure and setups | S/R zones with break-validation lifecycle, higher-TF S/R, Break & Retest detector with false-break marking and R:R suggestions, Supply/Demand zones (strict 3-candle pattern), Order blocks, Fair Value Gaps, Market structure (HH/HL/LH/LL with BOS / CHoCH), auto trendlines, zigzag-gated parallel channel with 4th-pivot projection, auto Fibonacci with golden-ratio emphasis, RSI and MACD divergence (regular + hidden), Pivot Points (classic / fibonacci / camarilla) |
| Candlestick patterns | Engulfing, pin bar / hammer / shooting star, doji, morning / evening star, inside bar, three white soldiers / three black crows                                                                                                                                                                                                                                                                                                                                                |

### Using indicators

1. Open the **Indicators** tab.
2. Expand a family and click an indicator to add it. Oscillator-type indicators land in
   the bottom oscillator panes; overlays render on the main chart.
3. Hover an active indicator row and click the gear icon to open its settings dialog.
   Each indicator exposes its own parameters (periods, bands, colours, line style).
4. Click the eye icon to toggle visibility; click the trash icon to remove.

### Templates

Indicator templates let you save a full stack and reapply it later:

- **Save template** - capture the current indicator stack (with settings) under a name.
- **Apply template** - replace the current stack with the saved one.
- Templates live in the **Templates** tab of the right sidebar and persist per browser
  profile.

### Structure and setup behaviour notes

- **Support / Resistance zones** track a break-validation lifecycle: a zone starts as
  _tested_, transitions to _broken_ when price closes through it, and then to
  _invalidated_ once the break is confirmed by a defined number of closes.
- **Break & Retest detector** marks confirmed breaks, flags suspected false breaks, and
  suggests a risk:reward ratio derived from the zone height.
- **Supply / Demand zones** use a strict 3-candle pattern (base + two-flag departure).
  Zones that fail the pattern are not drawn.
- **Parallel channel** is zigzag-gated: it only fires from a confirmed 3-pivot sequence
  and projects a 4th-pivot target.
- **Auto Fibonacci** emphasises the 0.618 / 0.786 golden-ratio levels visually.

---

## Drawing tools

The left toolbar (desktop) and a bottom sheet (mobile) expose 34 drawing tools. Tools
are grouped for quick scanning.

| Group     | Tools                                                                                         |
| --------- | --------------------------------------------------------------------------------------------- |
| Lines     | Trend line, ray, extended line, horizontal line, horizontal ray, vertical line                |
| Channels  | Parallel channel, regression trend                                                            |
| Shapes    | Rectangle, ellipse, triangle, polyline                                                        |
| Freeform  | Brush, arrow, text label, callout, flag                                                       |
| Labels    | Price label, price range, date range, date & price range, measure                             |
| Fibonacci | Retracement, extension, channel, time zones, fan, arcs                                        |
| Advanced  | Gann fan, Gann box, Andrews pitchfork, anchored VWAP, long position tool, short position tool |

### Drawing workflow

1. Click a tool. The cursor changes to a crosshair.
2. Click / tap to place anchors. Multi-anchor tools (pitchfork, fib fan, position tool)
   prompt for the required points in order.
3. Finish with a final click, double-click, or `Escape`.

### Editing and managing objects

- **Select** - click an object to select it; drag handles to move or resize.
- **Magnet snapping** - when enabled, anchors snap to the nearest O, H, L, or C of the
  bar under the cursor.
- **Lock / hide / duplicate** - available from the object's context menu and from the
  **Objects** tab in the right sidebar.
- **Per-symbol persistence** - drawings are stored with time/price anchors relative to
  the symbol, so switching timeframes or returning to a symbol restores them correctly.
- **Undo / redo** - `Ctrl+Z` and `Ctrl+Y` (or `Cmd+Z` / `Cmd+Shift+Z` on macOS).
- **Delete** - remove the selected object with the `Delete` key.
- **Clear all** - wipe every drawing on the active chart. A confirmation dialog prevents
  accidental loss.
- **Object tree** - the **Objects** tab lists every drawing on every chart in the
  current layout, grouped by pane, with visibility toggles and selection sync.

### Long / short position tool

The long and short position tools plot an entry, stop, and target, then compute:

- Risk per unit (entry - stop for longs, stop - entry for shorts).
- Reward per unit (target - entry for longs, entry - target for shorts).
- Risk:reward ratio.
- Position size for a user-supplied account risk amount.

Enter your account currency risk in the tool's settings dialog; size updates live as you
drag the handles.

---

## Alerts

Alerts are evaluated client-side on every incoming tick. Open the **Alerts** dialog from
the bell icon in the top toolbar.

### Creating an alert

1. Pick a symbol and a condition: price **above**, **below**, or **crosses** a level.
2. Enter the trigger price (or click on the chart to snap to a level).
3. Choose delivery channels:
   - **In-app toast** - always on.
   - **Browser notification** - requires notification permission.
   - **WebAudio beep** - short tone, useful when the tab is in the background.
4. Optionally enable **Repeat** so the alert re-arms after firing.

### Notification permissions

The first time you enable browser notifications, Trade requests permission. If you
decline, only in-app toasts and beeps will fire. You can re-grant permission from your
browser's site settings for the Trade origin.

### Managing alerts

The **Alerts** dialog lists active and recently fired alerts. Toggle, edit, or delete
from the list. Alerts are per-symbol and persist across reloads.

---

## Watchlist and layouts

### Watchlist

The **Watchlist** tab in the right sidebar shows live prices and 24-hour percentage
change for your tracked symbols. Click a row to load that symbol into the active chart
pane. Add or remove entries from the watchlist header.

### Multi-chart layouts

Switch layouts from the layout selector in the top toolbar:

| Layout         | Panes                 |
| -------------- | --------------------- |
| Single         | 1 chart               |
| 2 side-by-side | 2 charts, equal width |
| 2x2 grid       | 4 charts              |

Each pane has its own symbol, source, timeframe, indicators, and drawings. The active
pane (the one that last received a click) is highlighted with a focus ring; toolbar
actions and keyboard shortcuts target the active pane.

---

## Themes and language

### Themes

Three themes are available from the theme toggle:

- **Dark** - default, optimised for long sessions.
- **Light** - high contrast for daylight viewing.
- **System** - follows your OS dark-mode setting and updates instantly when the OS
  changes.

Theme choice is persisted across reloads.

### Language

Trade ships with **English** and **Bahasa Indonesia** UI translations. Switch from the
language dropdown in the top toolbar; the UI updates immediately without a reload.
Indicator names, drawing tool labels, and dialog copy are all translated.

---

## Keyboard shortcuts

Press `?` at any time to open the in-app shortcut reference.

| Shortcut | Action                                |
| -------- | ------------------------------------- |
| `/`      | Open symbol search                    |
| `Alt+T`  | Trend line tool                       |
| `Alt+H`  | Horizontal line tool                  |
| `Alt+R`  | Ray tool                              |
| `Alt+F`  | Fibonacci retracement                 |
| `Alt+P`  | Parallel channel                      |
| `Alt+V`  | Anchored VWAP                         |
| `Ctrl+Z` | Undo last drawing action              |
| `Ctrl+Y` | Redo last undone drawing action       |
| `Delete` | Remove the selected drawing           |
| `Escape` | Cancel current drawing / close dialog |
| `?`      | Open shortcut help                    |

On macOS, substitute `Cmd` for `Ctrl`.

---

## PWA install

Trade is an installable Progressive Web App.

1. Open <https://secretarrow.github.io/Trade/> in Chrome, Edge, or another PWA-capable
   browser.
2. Use the browser's **Install** action (address-bar icon or menu > Install app).
3. Launch from your start menu / dock / home screen. The app opens in a standalone
   window without browser chrome.

### Offline behaviour

- The app shell and bundled assets are cached by the service worker, so the UI loads
  even with no network.
- Market data still requires a live connection; when offline, charts display the last
  cached bars and the status badge reads **Offline** with the last-update age.
- When a new version is deployed, Trade shows an **Update available** prompt. Accept it
  to reload into the new build; defer to keep your current session.

---

## Export and backup

### PNG screenshot

Use the camera icon in the top toolbar to download a PNG of the active chart pane,
including indicators, drawings, and the crosshair legend. Filename includes the symbol,
timeframe, and timestamp.

### Fullscreen mode

The fullscreen toggle expands the active chart pane to fill the viewport - useful for
presentations or a second monitor. Press `Escape` or click the toggle again to exit.

### Workspace export / import

The workspace is the full state of your terminal: layout, per-pane symbol / source /
timeframe, indicators (with settings), drawings, watchlist, templates, theme, and
language.

- **Export workspace** - downloads a single JSON file containing the entire workspace.
- **Import workspace** - restore from a previously exported JSON file. Importing
  replaces the current workspace, so Trade prompts for confirmation.

Keep exported JSON files in your own backup location. Trade never uploads them anywhere.

---

## Troubleshooting

### The status badge reads Offline

- Check your network connection.
- Some providers block certain regions; switch to a different source from the dropdown.
- If you were using Yahoo Finance or Stooq, confirm the CORS proxy worker URL is set in
  **Settings** and the worker is reachable.

### A timeframe chip is disabled

The active provider does not publish that timeframe. Hover the chip for the reason, or
switch to a provider that supports it (for example, Binance and Bybit cover the full set
for BTC/USDT).

### The deviation badge is red

Two or more providers disagree by more than 0.30% (crypto) or 0.15% (gold). This is
usually a stale quote on one provider. Wait a few seconds for the next tick; if it
persists, switch to the more reliable source for that symbol.

### Twelve Data source is missing

Add a free Twelve Data API key in **Settings**. Without a key the source is hidden.

### Yahoo / Stooq sources are missing

Both require the optional CORS proxy worker. Deploy the worker from `workers/proxy/`
and enter its URL in **Settings**.

### Indicators are lagging

Trade computes indicators in a Web Worker, but very large symbol histories combined with
a full 20-indicator stack on a 2x2 layout can still take a moment on first load. Reduce
the visible bar count or drop one indicator to recover responsiveness.

### Drawings vanished after switching symbols

Drawings are per-symbol. Switch back to the original symbol and they return. Use the
**Objects** tab to confirm which symbol a drawing belongs to.

### Notifications do not fire

Browser notifications require permission. If you declined earlier, re-grant permission
from your browser's site settings for the Trade origin. In-app toasts and the WebAudio
beep do not require permission and will still work.

### Resetting Trade

To return Trade to a clean state: open **Settings** and choose **Reset workspace**, or
clear the site data for the Trade origin in your browser settings. This removes all
symbols, indicators, drawings, templates, and API keys.

---

## Disclaimer

For informational purposes only. Not financial advice.
