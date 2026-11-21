# Coverage checklist — reference methodology concepts

Ordered by importance to the charting app. Status values: `not started` / `partial` / `shipped`.
Source confidence: **explicit** = written rule in the reference methodology; **chart-inferred** =
derived from annotated example charts; **inferred** = logical extension not literally stated.

## Core engine (setup-critical)

- [ ] break-retest — body-close breakout validation (close outside zone validates; wick pierce does not) — not started — explicit
- [ ] break-retest — false breakout detection (pierce + close back inside) — not started — explicit
- [ ] market-structure — 3-pivot zigzag precondition (LH-LL-LH / LL-LH-LL) gating all setups — not started — explicit
- [ ] supply-demand — three-candle zone pattern (green-red-green = demand, red-green-red = supply) — not started — explicit
- [ ] supply-demand — zone located at channel midline (M5) — not started — explicit
- [ ] supply-demand — nested M1 zone layering (M1 zone above M5 zone for shorts) — not started — explicit (short-side example only; long side mirrored by inference)
- [ ] supply-demand — M1 zone retest-validity flag (zone must already have been retested on M1) — not started — explicit
- [ ] supply-demand — limit entry at 50% of the pattern candle or its close (minimize floating) — not started — explicit (placement level ambiguous)
- [ ] rr-tool — minimum risk-reward gate (1:3 primary setup, 1:2 companion setups) — not started — explicit
- [ ] rr-tool — extended take-profit at M30 swing-candle wick extreme — not started — explicit
- [ ] rr-tool — breakeven-or-better stop ("SL+") once trade is running (extended tier) — not started — explicit (trigger timing unquantified)
- [ ] channel-auto — parallel channel from 3 pivots with midline, drawn H4, refined M30 then M5 — not started — explicit
- [ ] market-structure — 4th-pivot projection as the open-position area (M30) — not started — explicit

## Levels and zones

- [ ] sr-auto — H4 support/resistance anchored at steep/climax move areas — not started — explicit ("steep" unquantified)
- [ ] sr-auto — level validity lifecycle: valid only after a prior breakout; body close invalidates; wick touch does not — not started — explicit
- [ ] sr-auto — zones rendered as areas, not thin lines (H4/Daily major zones; H1/M30 entry zones) — not started — explicit
- [ ] sr-auto — test-count strength heuristic (more tests = stronger; too many = weaker) — not started — explicit (threshold missing)
- [ ] break-retest — SBR/RBS role-reversal tracking after validated break — not started — explicit
- [ ] break-retest — broken-M30-support confluence gate for shorts (mirror for longs) — not started — explicit

## Structure, trend, dynamic levels

- [ ] market-structure — HH/HL/LH/LL pivot labeling and trend classification (up/down/sideways) — not started — explicit
- [ ] ma-family — MA 50 / MA 200 as dynamic support/resistance — not started — explicit (MA type unspecified)
- [ ] trendline-auto — trendline and channel as dynamic support/resistance — not started — explicit
- [ ] ma-family — static + dynamic confluence strength filter — not started — explicit
- [ ] patterns — confirmation patterns: double top, head & shoulders — not started — explicit
- [ ] patterns — confirmation candles: pin bar, engulfing — not started — explicit

## Entry variants (companion method)

- [ ] break-retest — rejection entry at zone with confirmation candle — not started — explicit
- [ ] break-retest — breakout entry on close outside zone — not started — explicit
- [ ] break-retest — retest entry on flipped zone (SBR/RBS) — not started — explicit

## Workflow, risk, discipline

- [ ] mtf-workflow — top-down drill-down (H4→M30→M5→M1; Daily→H4→H1) — not started — explicit
- [ ] mtf-workflow — timeframe-role presets (swing Daily–Weekly, intraday H4–H1, scalper M15–M5) — not started — explicit
- [ ] risk-manager — 1–2% per-trade risk cap and position sizing — not started — explicit
- [ ] risk-manager — structural (logical) stop placement — not started — explicit (distance chart-inferred: beyond zone edge)
- [ ] rr-tool — trailing stop to lock profit — not started — explicit
- [ ] trade-journal — trading plan checklist gate ("no plan, no trade") — not started — explicit
- [ ] trade-journal — journal with emotional-state field and periodic review — not started — explicit
- [ ] trade-journal — psychology coaching rules (loss acceptance 40–50%, no revenge trading, probability mindset, 3–5%/month realism) — not started — explicit
- [ ] alerts — notify on wait-state resolution (3 pivots formed, zone retested, zone midline touched) — not started — inferred (workflow implies alerts; never stated)
- [ ] instrument-scope — XAUUSD-only guard with backtest disclaimer for other instruments — not started — explicit

## Not present in the reference methodology (no action; listed to prevent scope creep)

- order-block, fvg, fib-auto, divergence, vwap, pivot-points, bands, oscillators,
  volume-suite, ichimoku, psar, supertrend, watchlist — none of these concepts
  appear in the material.
