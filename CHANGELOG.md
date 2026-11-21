# Changelog

## Unreleased


### Features

* **web,strategy:** TradingView-style drawing flyouts (5 groups, primary slot swaps to active tool, footer magnet/hide/show/lock toggles) and Bang RAN multi-timeframe trade workflow — Trade Mode selector (Swing 1W→4h→1h / Intraday 4h→30m→15m / Scalping 30m→5m→1m), Strategy tab with 3-TF quick switcher, bias toggle, pre-entry checklist and SND nesting detector.
* **web:** replace drawing tool text labels with hand-crafted SVG icons for all 34 tools.

## 1.0.0 (2026-11-21)


### Features

* **core:** shared types, timeframe math, resampling and symbol registry ([a0eb488](https://github.com/SecretArrow/Trade/commit/a0eb48849550bed20f620ed3acc94d2c1e530dac))
* **indicators,providers,drawings:** analysis library, data adapters and drawing model ([acc42b9](https://github.com/SecretArrow/Trade/commit/acc42b99af18b0550bd8af162d5552f19af33a41))
* **web:** demo chart app shell with Lightweight Charts and e2e smoke test ([cc82b51](https://github.com/SecretArrow/Trade/commit/cc82b518350f38f1055228c8d825b3bcb16e107c))
* **web:** full charting terminal with indicators, drawings, alerts and mobile UI ([0140df2](https://github.com/SecretArrow/Trade/commit/0140df22b77494f80eac79e615a2ab5e1a00e3a7))


### Bug Fixes

* **ci:** pnpm arg separator, zlib import, eslint node globals and test expectation ([a023254](https://github.com/SecretArrow/Trade/commit/a0232547f7eac2e7ab9576c90d7e0aaf9f0c9198))
* **ci:** prettier docs skip, unit test fixes and e2e stability ([789e448](https://github.com/SecretArrow/Trade/commit/789e4481d5181f34ad9030f8b4f6de7695cd4dd1))
* **ci:** repair workflow YAML heredoc and release action pin ([3f984d3](https://github.com/SecretArrow/Trade/commit/3f984d329c95b53a3e7c7532b4159c66c9f7d990))
* **drawings:** pointInRect tolerance arg and coverage for translateAnchors/groupBySymbol ([11f48b6](https://github.com/SecretArrow/Trade/commit/11f48b6cceabdcb8c13b801af03fd95b6d43d429))
* **e2e:** correct tsconfig extends path and use viewportSize API ([f10277c](https://github.com/SecretArrow/Trade/commit/f10277c21613e34a63a5781cfeaf95dc2c18662c))
* **indicators,providers,e2e:** type assignability, coverage scope and drawing test ([4c042a2](https://github.com/SecretArrow/Trade/commit/4c042a27e41165ac033fe567d7d0ee43eb86d848))
* **lint:** worker globals, hook order, const fixes and adapter closure pattern ([d11bfb7](https://github.com/SecretArrow/Trade/commit/d11bfb71045e0657d6e723b698de734ea8821afe))
* **providers:** ws ping closure narrowing and coverage scope ([27d3f60](https://github.com/SecretArrow/Trade/commit/27d3f60f362975ea9c4cee54952e526f0229eee9))
* **web,indicators:** theme types, const reassign, migrate cast, mtf-sr ctx guard, stochastic tolerance ([0d58c5e](https://github.com/SecretArrow/Trade/commit/0d58c5e0f3a2025bfc3960f1ff1b9995c41a79c4))
