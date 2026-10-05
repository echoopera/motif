# Motif 9 tests

Set `PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs` if Playwright is not installed locally, and `MOTIF_CHROMIUM` for a specific Chromium. Browser suites use software GL.

| Command | What |
| --- | --- |
| `node --test tests/v9/unit.test.mjs` | MotifGraph engine contracts, no browser |
| `node tests/v9/browser.mjs` | MotifGraph end to end (GPU vs CPU reference, loops, scopes, channels, inspector, Worker parity, budgets, context loss) |
| `node tests/v9/regression.mjs` | Motif 8.0.0 vs 9: every style renders identical pixels; kit validation byte-identical |
| `node tests/v9/bench.mjs` | Frame times for representative graphs (software GL: relative numbers only) |
| `node tests/v9/gen-docs.mjs` | Regenerates `docs/MotifGraph-nodes.md` |
| `node design-harness/design/motifgraph-ui-pass/token-lint.mjs` | Design Harness token-lint rules on the Graph page |
