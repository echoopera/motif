# Motif 5.1 — performance foundation

Roadmap step 1: measure first, then cache. Render engine, kits, SDK, export and project format are unchanged.

- **Render cache.** Preview frames are stored on the project's frame grid and replayed on scrub, step and loop. Keyed by a hash of the whole project plus size, colour space and zebra; any edit, kit compile or audio change clears it. Bypassed for live audio and video/image media. Memory budget scales with `navigator.deviceMemory` (128–768 MB); playback keeps the first frames of a loop when full, scrubbing evicts oldest. Footer chip shows coverage; toggle from the chip or ⌘K. With the cache on, preview plays on the output fps grid (as the export will), not at display rate.
- **Proxy.** Preview quality adds Quarter (and Half is now an exact 0.5 scale). Lower proxies cache more of the loop. Exports are untouched.
- **Benchmark.** Footer **Bench** (or ⌘K: *Benchmark this scene / every style*) renders at a fixed size with a GPU readback per frame and downloads JSON: p50 / p95 / max per style, GPU renderer, software flag.
- **CI harness.** `node tools/bench.mjs [--budget] [--styles a,b] [--size 1920x1080]` runs every style headless and writes `performance-review/bench-*.json`; `--budget` fails when p95 exceeds `tools/budgets.json` (skipped on software GL). `node tools/cache-check.mjs` verifies replayed frames are pixel-identical to live renders. Set `PLAYWRIGHT_MODULE` to your Playwright `index.mjs`.

## Media pipeline

- **Media pool (`13a-media-pool.js`).** Imports are stored in the Origin Private File System by content hash (IndexedDB fallback; old IndexedDB assets are read through and migrated on first use). Files over 256 MB are hashed from size plus head, middle and tail samples instead of a full read, and the video limit rises from 1 GB to 4 GB because bytes no longer pass through memory. Quota and usage reporting, `persist()`, LRU eviction, interrupted-import cleanup, and a worker writer for browsers without `createWritable` (Safari).
- **WebCodecs decode (`13b-webcodecs.js` + vendored mediabunny).** Frame-accurate decode for MP4/MOV into a bounded ImageBitmap ring (12 frames / 256 MB, GOP-aware: random access decodes from the keyframe and keeps the last four frames, sequential access advances one open decoder). Used for paused scrubbing and export seeks; playback stays on `<video>`. Guards: a parity probe against `<video>` at open, a stale-frame check on every decode, and automatic fallback to `<video>` on any decoder error. Adds about 190 KB to the single file.
- **Media page (`21-media-page.js`).** New inspector tab: thumbnails, metadata, in-use badges, storage meter, import and drop, relink, delete with confirmation, empty / loading / error / quota states, keyboard and reduced-motion support.
- **Test.** `tests/browser/media-check.mjs`.
- **Not done.** Linked project folder (File System Access API), WebM/Matroska through WebCodecs, audio from video clips, a decode worker. See the lane report.

Next: record reference budgets on a real GPU, then the Worker + OffscreenCanvas render engine.
