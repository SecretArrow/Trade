# Internal study notes: reference trading methodology

> Neutralized developer notes distilled from two Indonesian-language reference documents on
> XAUUSD (gold spot) trading. All terminology has been translated into standard
> industry vocabulary. Provenance details are intentionally omitted.

## 1. Overview

The reference methodology is a **manual, top-down, multi-timeframe price-action system for
XAUUSD (gold spot vs USD)**. It combines classic support/resistance mapping with parallel
channel projection, supply/demand zone timing, and a strict break-and-retest entry model.

- **Instrument focus:** XAUUSD exclusively. The primary method states it was backtested over
  2 years on XAUUSD only; using it on other instruments requires an independent backtest first.
- **Timeframe stack (primary method):** H4 → M30 → M5 → M1.
  - H4: map support/resistance and draw the bounding parallel channel.
  - M30: refine the channel; the projected 4th pivot is the entry area.
  - M5: refine again and locate the supply/demand zone at the channel midline.
  - M1: find the nested zone and require it to have been retested already.
- **Timeframe stack (companion method, education-oriented):** Daily → H4 → H1 (entry timing),
  with M15–M5 mentioned for scalping-style execution and Daily–Weekly for swing views.
- **Overall workflow:** (1) establish directional bias from structure and key levels on higher
  timeframes, (2) wait for a validated break of a level, (3) wait for price to return
  (retest) into a zone, (4) enter passively with a limit order inside the zone,
  (5) manage the trade with a fixed minimum risk-reward plus a breakeven/trailing rule.
- **Philosophy:** levels and zones are decision areas, not lines; candle **body closes**
  validate or invalidate levels; patience ("no setup, no trade") and strict money management
  (1–2% risk per trade) are treated as core components of the edge, not extras.

## 2. Concept inventory

| Feature id | Concept | Definition | Key parameters | Notes |
|---|---|---|---|---|
| sr-auto | Support/resistance mapping (H4) | Horizontal levels identified on H4 at "steep move" areas (sharp vertical price drops/rallies, i.e., impulse/climax origins). Used for directional bias only — never as entry triggers. | Timeframe H4; anchored at steep/climax areas; validity lifecycle rules below | A level is only considered valid **after** it has already been broken out once. Invalidated only by a **candle body** passing through it; **wick touches do not invalidate**. |
| sr-auto | S/R zone strength vs. test count | The more often a zone is tested, the stronger it is considered — but if tested *too often* it weakens. | "Too often" threshold unspecified | Candidate for a configurable test-count decay heuristic. |
| sr-auto | Zones over lines | Support/resistance must be drawn as **areas (zones)**, not thin lines; reactions come from areas, not exact points. | Higher timeframe (H4/Daily) for major zones; H1/M30 for entry planning | Directly affects zone rectangle rendering and hit-testing in the app. |
| break-retest | Breakout validation | A breakout is valid only on a **candle close outside the S/R zone** (body close, not a wick pierce). | Close-based confirmation | Universal rule across the material; the single most repeated validation criterion. |
| break-retest | False breakout | Price pierces a zone temporarily (wick beyond the level) and then closes back inside. | Identified by absence of a body close outside | Explicit "don't enter on first break / no FOMO" warning tied to this. |
| break-retest | Role reversal (SBR/RBS) | After a validated break, support becomes resistance and resistance becomes support ("support become resistance" / "resistance become support"). | Requires close-based break first | The flipped zone becomes the retest target for entries. |
| break-retest | Retest entry model | After a validated breakout, wait for price to return and test the broken zone, then enter on the reaction with a confirmation candle. | Confirmation candles: pin bar, engulfing | Entering *before* the retest is explicitly listed as the most common mistake. |
| break-retest | Broken-level confluence filter | If the preceding M30 support has already been broken, the case for a short is considered "very strong" (mirror logic for longs). | Timeframe M30 | Acts as an optional but heavily emphasized confluence gate. |
| market-structure | Trend structure (HH/HL/LH/LL) | Market structure is defined by the sequence of higher highs, higher lows, lower highs, lower lows. Uptrend = HH+HL; downtrend = LH+LL; sideways = flat. | Visual pivot labeling | "Don't trade against the structure" is stated as a hard rule. |
| market-structure | Zigzag pivot precondition | A 3-pivot zigzag — LH→LL→LH (downtrend) or LL→LH→LL (uptrend) — **must already exist** before any channel may be drawn. If absent, the trader must wait. | Exactly 3 alternating pivots | This is a deterministic state machine and is directly automatable. |
| market-structure | 4th-pivot projection | On the M30 channel, after the 3 pivots form, the *next* expected pivot (4th LH in a down-channel, 4th LL in an up-channel) marks the open-position area. | Timeframe M30 | Anchors the entry-zone prediction of the whole method. |
| channel-auto | Parallel channel (multi-timeframe) | A channel built on the 3-pivot zigzag: upper line through swing highs, lower line through swing lows, plus a **midline**. Drawn on H4 (price boundaries), refined ("tidied") on M30, refined again on M5. | H4 and M30 stated as the highest-probability drawing timeframes; 2 boundary lines + midline | Chart examples render channels as 2 parallel lines with a dotted midline; anchor pivots circled and labeled LH/LL with arrows. |
| supply-demand | SND zone at channel midline | After refining the channel on M5, a supply/demand zone is expected to appear **in the area of the channel's middle line**. | Timeframe M5; "strong" zones appear on M5 | Ties zone detection to channel geometry rather than freeform box drawing. |
| supply-demand | Three-candle SND pattern | The zone is identified by a strict 3-candle color sequence: **green–red–green = demand (buy)**, **red–green–red = supply (sell)**. | Exactly 3 candles, body colors in order | Deterministic pattern rule; implementable as a candle-color state machine. |
| supply-demand | Nested M1 zone | After finding the M5 zone, drop to M1; if a second zone appears there, mark it. In the (short) example the M1 zone sits **above** the M5 zone, forming layered nested zones. | Timeframes M5 + M1 | Adds a second, finer entry layer on top of the M5 zone. |
| supply-demand | Zone retest validity (M1) | An M1 zone is considered *highly valid* only if it has **already been retested** on M1. | Timeframe M1; prior retest required | "Fresh vs. retested" inverse of usual SMC freshness; here a prior retest is a *positive* validity signal. |
| supply-demand | Entry placement inside zone | Entry order placed at the **50% level of the SND candle** or at the **close of the SND candle** — whichever keeps floating drawdown smallest. | 50% or close; limit order (sell limit / buy limit) | Chart examples show the zone as a rectangle with a solid top line and dotted mid/bottom lines, labeled with an arrow. |
| patterns | Confirmation chart patterns | Classic patterns used as extra confirmation at zones: **double top**, **head & shoulders**, **engulfing**. | Pattern list fixed as stated | Shown as image examples for multi-timeframe confirmation. |
| patterns | Confirmation candlestick signals | **Pin bar** and **engulfing** candles are the named confirmation triggers for zone reactions. | — | Used by all three entry types in the companion method. |
| ma-family | Dynamic support/resistance via moving averages | MA 50 and MA 200 act as dynamic S/R; combining a static zone with a dynamic level (MA or trendline) is called a strong setup. | MA 50, MA 200; type (SMA/EMA) unspecified | Only indicator usage in either document. |
| trendline-auto | Trendlines as dynamic S/R | Trendlines (and channels) are listed alongside MAs as dynamic support/resistance. | — | Overlaps with channel-auto; kept as its own drawing primitive. |
| rr-tool | Minimum risk-reward gates | Primary method: minimum **1:3** R:R per trade. Companion method: minimum **1:2** R:R. | 1:3 (primary), 1:2 (companion) | A configurable per-strategy minimum-R gate in the app. |
| rr-tool | Extended target at M30 wick extreme | Maximum take-profit extends to the **tip of the M30 candle's wick** when the first 3-pivot structure has formed. | Timeframe M30; wick extreme of the swing candle | Creates a two-tier TP: guaranteed 1:3 minimum + optional extended TP. |
| rr-tool | Breakeven-after-run rule ("SL+") | When the target is set at the extended (wick) level, the stop must be moved to breakeven-or-better **immediately once the trade is running**. | Trigger timing approximate ("after running") | Semantics (breakeven vs. trailing distance) not quantified — open question. |
| rr-tool | Trailing stop | Trailing stops are used to lock in profit on the way to the target. | — | Companion method, general guidance. |
| mtf-workflow | Top-down analysis | Always analyze from the largest timeframe downward: Daily = main trend, H4 = major S/R areas, H1 = entry timing (variant: direction Daily → confirm H4 → enter M15). | Daily/H4/H1 or H4/M30/M5/M1 | Both methods mandate top-down ordering; skipping it is listed as a common mistake ("blind spot"). |
| mtf-workflow | Timeframe-role model | Daily–Weekly = swing trader (big direction); H4–H1 = intraday (momentum entry); M15–M5 = scalper (fast execution/detail). | 3 tier buckets | Useful as a UI hint / profile preset in the app. |
| risk-manager | Per-trade risk cap | Maximum risk **1–2% of account per trade**; position size must be scaled to capital. | 1–2% | Repeated in both methods; treated as non-negotiable. |
| risk-manager | Structural stop placement | Stops must be "logical" (structure-based), not arbitrary. | — | No numeric distance given; ties to zone-boundary stops in chart examples. |
| trade-journal | Journaling incl. emotional state | Keep a trading journal that records entries **and the emotion felt at the time**, then review regularly to expose repeated mistakes. | Example entries: "entered too fast, fear of missing out", "exited too fast, fear of loss" | Maps to a journal feature with a mandatory emotion field. |
| trade-journal | Discipline checklist / trading plan | Pre-trade plan must answer: when to enter, where SL & TP, what if price does not behave. "No plan, no trade." / "No setup, no trade." | Checklist form | Direct candidate for an in-app pre-trade checklist gate. |
| trade-journal | Psychology rules | Accept 40–50% loss rate as professional normal; never revenge-trade (close charts, rest, evaluate, resume next day); don't trade tired/emotional; think in probabilities (60% win-rate example still yields profit with good R:R); expect 3–5% monthly consistency rather than outsized returns. | 40–50% loss expectation; 3–5%/month realism; 60% win-rate math example | Soft rules; surface as coaching/checklist UI, not trading logic. |

## 3. Setup rules

### Setup 1 — Channel + nested supply/demand limit entry (primary method)

Instrument filter: XAUUSD only (2-year backtest basis; other instruments require prior
backtest). Direction derived from the H4 structure.

1. **H4 — map support/resistance.** Locate "steep move" areas (sharp vertical impulse
   origin areas) on H4 and mark levels. A level counts as valid only **after** it has
   already been broken out once. Purpose: bias only — where price is likely to head —
   never an entry trigger.
2. **H4 — wait for the zigzag precondition.** Require 3 alternating pivots:
   LH→LL→LH (bearish) or LL→LH→LL (bullish). If they have not formed, do nothing and wait.
3. **H4 — draw the bounding channel.** Upper boundary through swing highs, lower boundary
   through swing lows, midline between them. This channel defines the expected upper and
   lower limits of price.
4. **M30 — refine the channel.** Re-anchor/adjust the channel on M30 (same 3-pivot rule).
   The projected **4th pivot** (next LH in a down-channel / next LL in an up-channel) is
   the open-position area.
5. **M5 — refine again and find the zone.** After tidying on M5, locate the supply/demand
   zone forming at/near the **channel midline**. Zone pattern is the strict 3-candle color
   sequence: demand = green–red–green, supply = red–green–red. Strong zones appear on M5.
6. **M1 — find the nested zone.** Drop to M1; if another zone appears, mark it. In the
   bearish example the M1 zone sits **above** the M5 zone (nested layering). The M1 zone
   must **already have been retested on M1** to be considered highly valid.
7. **Entry (limit order).** Place a **sell limit** in the zone at the **50% level of the
   SND candle** or at the **close of the SND candle** — choose the placement that keeps
   the initial floating drawdown small. Mirror with a buy limit for bullish setups.
8. **Stop loss.** Beyond the zone boundary (chart examples show a stop line past the outer
   edge of the zone box). Exact distance is not quantified in the text — see open questions.
9. **Take profit.** Minimum **1:3 risk-reward**, guaranteed tier. Optional extended tier:
   target the **tip of the M30 swing candle's wick**, valid when the first 3-pivot
   structure has just formed.
10. **Trade management.** If the extended (wick) target is used, move the stop to
    breakeven-or-better ("SL+") **as soon as the trade is running**.
11. **Confluence gate (strongly recommended).** Only take the short if the preceding
    **M30 support has already been broken**; mirror for longs. This is described as making
    the short case "very strong".
12. **Invalidation.** Any of: zigzag precondition never forms (stay flat); zone violated by
    a candle **body close** before entry fills; M1 zone has not been retested; structure
    flips (new opposite 3-pivot pattern forming) before the 4th pivot plays out.

### Setup 2 — Rejection entry at a zone (companion method)

1. Identify the S/R **zone** (not a line) on H4 or Daily.
2. Wait for price to pull back into the zone and show rejection.
3. Confirmation candle required: **pin bar** or **engulfing** at the zone.
4. Enter on the confirmation; stop beyond the far side of the zone; target the next S/R zone.
5. Minimum risk-reward **1:2**; use a trailing stop to lock profit.
6. Common mistake flagged: entering without confirmation.

### Setup 3 — Breakout entry (companion method)

1. Identify the S/R zone on the higher timeframe.
2. Breakout is valid **only on a candle close outside the zone** — wick pierces do not count.
3. Enter after the closing candle confirms; stop back inside the broken zone.
4. Target the next S/R zone; minimum risk-reward **1:2**.
5. Common mistake flagged: FOMO entry on the first break attempt (false-breakout risk).

### Setup 4 — Retest entry after role reversal (companion method)

1. A validated breakout (body close outside the zone) must occur first.
2. The broken zone flips role: resistance broken becomes support; support broken becomes
   resistance (SBR/RBS role reversal).
3. Wait for price to **return and retest** the flipped zone.
4. Enter on the retest reaction with a **pin bar or engulfing** confirmation candle.
5. Stop beyond the zone; target the next S/R zone; minimum risk-reward **1:2**.
6. Common mistake flagged: entering before the retest completes.

### Setup 5 — Multi-timeframe confirmation routine (companion method)

1. **Daily:** establish the main trend direction (never trade against it).
2. **H4:** mark the major S/R zones.
3. **H1 (or M15):** time the entry using Setups 2–4.
4. Optional confirmation: a classic pattern (**double top**, **head & shoulders**,
   **engulfing**) completing at the zone.
5. Strength filter: confluence of a **static zone** with a **dynamic level** (MA 50 / MA 200,
   or a trendline/channel line) at the same price area = "strong setup".

## 4. Additional concepts

- **Money management (hard rules).** Max 1–2% account risk per trade; lot size derived
  from capital and stop distance; stops must be structurally logical; no emotional entries.
- **Expectation management.** Professionals are said to lose 40–50% of their trades; a 60%
  win-rate system with good R:R stays profitable (4 losers out of 10 is normal). Realistic
  goal: consistent 3–5% monthly returns, not fast riches.
- **Behavioral rules (checklist candidates).**
  - No revenge trading: after a big loss — close the chart, rest, evaluate objectively,
    resume the next day.
  - Don't trade while emotional, tired, stressed, or angry.
  - Over-sizing positions induces panic exits; size is a risk-management output.
  - Follow the written plan exactly: entry condition, SL, TP, and the "what if wrong" branch.
  - "No setup, no trade" and "No plan, no trade" as hard gates.
  - Journal every trade *and* the emotion at decision time; review periodically.
- **Overtrading warnings.** Overtrading without trend understanding and chasing the first
  breakout are both named as the primary failure modes.
- **Level hygiene.** Too many drawn lines cause confusion — keep the chart minimal
  (relevant to drawing-tool UX and object capping).
- **Market context (informational).** Gold behaves as a safe-haven asset: it tends to rise
  on economic instability/geopolitical stress and fall when the dollar strengthens or
  economies stabilize. Market participants (central banks, institutions, retail) frame why
  structure matters ("follow the smart money via structure"). No fundamental-data feature
  is specified; treat as background only.

## 5. Implementation mapping

| Concept | Delivering app feature | Notes / open questions |
|---|---|---|
| H4 S/R lifecycle (post-breakout validity, body vs. wick, steep-area anchoring) | `sr-auto` | Needs a level state machine: `candidate → broken(validated) → invalid(body close through)`. "Steep area" detection needs a configurable impulse threshold (none given). |
| Zone strength by test count | `sr-auto` | Threshold for "too many tests" is not quantified; expose as a tunable parameter. |
| Zones-not-lines rendering & hit-testing | `sr-auto` + drawing tools | Render levels as rectangles with configurable width; example style: solid outer line, dotted midline, semi-transparent fill. |
| Body-close breakout validation & false-breakout detection | `break-retest` | Rule is fully deterministic: body close outside zone = valid; wick pierce + close back inside = false breakout. |
| SBR/RBS role flip tracking | `break-retest` + `bos-choch` | The material expresses break-of-structure as role reversal; map flip events to structure-break events in the engine. |
| Broken-M30-support confluence gate | `break-retest` / `market-structure` | Implement as a boolean filter on setup scoring; direction-specific (short needs prior support break). |
| HH/HL/LH/LL labeling, trend classification | `market-structure` | Straightforward pivot detection + labeling UI. |
| 3-pivot zigzag precondition + 4th-pivot projection | `market-structure` + `channel-auto` | Deterministic wait-state; ideal for an automated "setup forming" state and alerts. |
| Parallel channel with midline, H4→M30→M5 refinement | `channel-auto` | Needs multi-timeframe object linkage (one logical channel refined per timeframe) — not merely per-chart drawings. |
| SND 3-candle pattern at channel midline | `supply-demand` | Candle-color sequence machine (green-red-green / red-green-red) gated by midline proximity. Tolerance for "near the midline" is unspecified. |
| Nested M5/M1 zones + M1-retest validity | `supply-demand` | Requires cross-timeframe zone nesting (M1 zone above M5 zone in the short example) and a retest flag per zone. |
| Entry at 50% of SND candle or its close | `supply-demand` + order ticket | Ambiguity: "50% of the SND candle" likely means the mid-price of the pattern candle (or zone); confirm with product; default to zone midpoint. |
| Min R:R 1:3 / 1:2 gates, wick-extreme TP, SL+ breakeven rule | `rr-tool` | Two-tier TP (guaranteed 1:3 + extended to M30 wick tip) plus auto-breakeven when extended tier used. "SL+" trigger timing and distance not quantified. |
| Initial stop placement | `rr-tool` / order ticket | Only inferred from charts (beyond zone edge); distance not specified. |
| Double top, head & shoulders, engulfing, pin bar | `patterns` | Standard pattern library; used only as confirmation, not standalone signals. |
| MA 50 / MA 200 dynamic S/R + static/dynamic confluence | `ma-family` | MA type (SMA vs. EMA) unspecified; default SMA-50/SMA-200 and make configurable. |
| Trendline / channel as dynamic S/R | `trendline-auto` | Merge rendering with `channel-auto` primitives. |
| Top-down workflow (H4→M30→M5→M1 and Daily→H4→H1) | `mtf-workflow` (new) | Guided checklist UI per timeframe step; enforce order in the workflow state machine. |
| Timeframe-role presets (swing / intraday / scalper) | `mtf-workflow` (new) | Simple preset mapping Daily–Weekly / H4–H1 / M15–M5. |
| 1–2% risk cap + position sizing | `risk-manager` (new) | Position-size calculator wired to stop distance and account equity. |
| Journal with emotion field, discipline checklists, coaching rules | `trade-journal` (new) | Pre-trade checklist gate ("no setup, no trade"), post-trade emotion logging, periodic review view. |
| Waiting states ("wait for 3 pivots", "wait for retest") | `alerts` (inferred) | The material never mentions alerts or notifications, but its wait-heavy workflow strongly implies them; treat as an inferred requirement, not a sourced one. |
| XAUUSD-only instrument scope | instrument filter | Expose scope guard with per-instrument backtest disclaimer if extended. |

**Open questions (source is ambiguous or silent):**

1. Exact initial stop-loss distance for Setup 1 (charts show a line beyond the zone; text
   gives no pip/ATR distance).
2. Semantics of "SL+": breakeven only, or trailing with a step? Trigger is "once running"
   — no profit threshold given.
3. Quantitative definition of a "steep move area" for H4 level anchoring.
4. Threshold where repeated zone tests flip from "stronger" to "weaker".
5. Whether "50% of the SND candle" means the mid of the pattern candle body, the zone
   midpoint, or the middle of the 3-candle range.
6. Whether the 3-pivot channel rule must be strictly alternating (no equal highs/lows
   tolerance) — examples imply strict alternation.
7. MA type and source (SMA vs. EMA, close price assumed) for MA 50/200.
8. No session/time filters are specified anywhere (no trading-hours rules) — the M1
   execution layer implies at least a liquidity-session discussion is missing.
9. Long-side mirror of the M1-above-M5 nesting rule (only the short example is given;
   mirrored as M1-below-M5 for longs by inference).
