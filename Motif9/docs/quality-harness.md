# Motif quality harness

Everything runs from `Motif3/`. Set `PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs` when Playwright is not installed locally; browser suites use `SOFTWARE_GL=1` (SwiftShader) via the npm scripts.

| Command | What it does |
| --- | --- |
| `npm run verify` | Build check, unit, cache identity, visual, a11y, soak, bench smoke, gate mechanism; prints a one-page evidence ledger mapped to AC-1..AC-7 of `studio/brief.json` (also `verify-out/evidence.md`). `-- --only visual,a11y`, `-- --fast` (shorter soak), `-- --soak-minutes 5`, `-- --real`. Measured on a 4-core container shared with other jobs (load average 10-24): 915 s in total (cache 44, visual 38, a11y 170, soak 637, bench smoke 24); the 5-minute target was NOT met there. Soak (200 style switches compile every kit shader on software GL) and a11y dominate; unloaded timing has not been measured. |
| `npm run test:visual` / `test:visual:update` | Visual regression against `tests/golden/<renderer-class>/`. |
| `npm run test:a11y` | Keyboard, ARIA, contrast, reduced motion, reflow, targets. Findings: `docs/a11y-findings.md`. |
| `npm run test:soak` | 200 style switches, 50 export open/close, timed play/resize/aspect/tab churn, WebGL context loss, hidden tab. `-- --minutes 10` for a long soak. |
| `npm run bench` / `bench:gate` | Per-style p50/p95/max, JSON + markdown in `performance-review/`; `--budget` enforces `tools/budgets.json` (never on software GL). |
| `node tools/bench-compare.mjs old.json new.json` | Exit 1 on >15% p95 regression (and >= 0.25 ms); exit 2 when the reports are not comparable (different GPU class, GPU or size). |
| `npm run bench:update-budgets` | Real GPU only: proposes `p95 x 1.25` per style (worst of 3 runs) into `performance-review/budgets-proposed.json`; add `--write` to update `tools/budgets.json`. |

## Visual regression

Scenes (293): every style at t = 0, 2, 4.1 s (96x54, grain off), 14 finish-stack combinations, a 3-layer blend stack, the demo project, 6 aspect ratios, sRGB vs Display-P3 for two styles. Rendered through the same `pipeline.renderFrame` the export uses (`__lab.renderAt`; P3 uses a display-p3 canvas context). New styles from other lanes appear automatically and fail with "no golden" until you run `npm run test:visual:update -- --only <style-id>` and review the PNG.

- Tolerance: a pixel differs when any channel moves > 6/255; fail when > 0.4% of pixels differ or mean error > 1.5 (`--channel/--fraction/--mean` override; recorded in the manifest). Failures write `tests/visual-out/diff-*.png` (expected | actual | diff) and `report.json` listing the worst scenes.
- Goldens differ per GPU. They are keyed by renderer class: `tests/golden/swiftshader` is committed; `tests/golden/real*` is gitignored. `manifest.json` records renderer string, Chromium version, font metrics, engine path per scene and the revision. If renderer, fonts or engine path differ from the manifest the run reports NOT VERIFIED and exits 0 (use `--strict` to fail). Regenerate on the target machine class with `--update` (renders twice and refuses unstable scenes; enforces a size budget, default 4096 KB).
- Size: 2.2 MB for the 293 PNGs (about 7.4 KB each).
- Cross-process determinism was observed: two separate browser launches produced 0 differing pixels on this machine. Cross-machine determinism (GitHub runner vs this container) is not yet observed; use the `update_goldens` workflow dispatch if the hosted runner reports an environment mismatch.

## Performance budgets contract

`tools/budgets.json` schema 2: `default` (placeholder, 16.7 ms), `reference` (null until measured; names the device when set), `styles[id]` = number or `{ p95, p50?, max? }`. `tools/budget-lib.mjs` is the single implementation used by bench, compare, gate and the tests. No number in the file is a measurement until `reference` is non-null.

## CI (`.github/workflows/motif-ci.yml`)

- `test` (hosted): build check, unit, browser tests (cache, a11y, soak), visual regression, software-GL bench subset uploaded as artifact `bench-swiftshader`, compared against the last successful main run's artifact (advisory: shared-runner noise), evidence artifacts.
- `update-goldens` (manual): regenerate SwiftShader goldens on the hosted runner and upload them; nothing is auto-committed.
- `gpu-gate` (manual, self-hosted, label `gpu`): all styles x3 runs on real hardware via Chrome stable, enforces budgets, compares with the previous GPU run on the same device, optionally proposes budgets. Runner prerequisites are in the workflow comments.

## Registering evidence for other acceptance criteria

`tools/verify.mjs` marks AC-2/4/5/6 NOT MET until a probe script exists and exits 0: `tests/browser/worker-engine.mjs` (AC-2), `media-pool.mjs` and `deliver-queue.mjs` (AC-4), `colour-page.mjs` (AC-5), `plugin-sandbox.mjs` (AC-6). A lane adds its probe (use `tests/browser/lib.mjs`: `launch`, `openApp`, `suite`), and the next `npm run verify` runs and reports it. AC-1 stays PARTIAL until `budgets.json.reference` is set from a real-GPU run; AC-7 stays PARTIAL until the Media/Edit/Colour/Deliver pages and their empty/loading/error states have tests.
