# Motif 5.1 — performance foundation

Roadmap step 1: measure first, then cache. Render engine, kits, SDK, export and project format are unchanged.

- **Render cache.** Preview frames are stored on the project's frame grid and replayed on scrub, step and loop. Keyed by a hash of the whole project plus size, colour space and zebra; any edit, kit compile or audio change clears it. Bypassed for live audio and video/image media. Memory budget scales with `navigator.deviceMemory` (128–768 MB); playback keeps the first frames of a loop when full, scrubbing evicts oldest. Footer chip shows coverage; toggle from the chip or ⌘K. With the cache on, preview plays on the output fps grid (as the export will), not at display rate.
- **Proxy.** Preview quality adds Quarter (and Half is now an exact 0.5 scale). Lower proxies cache more of the loop. Exports are untouched.
- **Benchmark.** Footer **Bench** (or ⌘K: *Benchmark this scene / every style*) renders at a fixed size with a GPU readback per frame and downloads JSON: p50 / p95 / max per style, GPU renderer, software flag.
- **CI harness.** `node tools/bench.mjs [--budget] [--styles a,b] [--size 1920x1080]` runs every style headless and writes `performance-review/bench-*.json`; `--budget` fails when p95 exceeds `tools/budgets.json` (skipped on software GL). `node tools/cache-check.mjs` verifies replayed frames are pixel-identical to live renders. Set `PLAYWRIGHT_MODULE` to your Playwright `index.mjs`.

Next: record reference budgets on a real GPU, then the Worker + OffscreenCanvas render engine.
