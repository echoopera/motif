# Motif 7.0

Motif 6.1 (header, Arrange, Clips, Move tool, project save/open: unchanged) plus the engine, media, colour, delivery and extensibility work below. v3–v6 projects and kits open as-is. One self-contained file: `Motif.html`.

## Interface
- **Timeline is now Animate** (switch, panel, shortcut hints, palette). Animate and Arrange share one panel height and the switch has fixed size and position, so it no longer moves when you toggle. The default panel is taller than in 6.1 (clamp 320–460 px) to match Arrange.

## Engine
- **Render Worker.** Preview renders in a dedicated worker on a transferred OffscreenCanvas; the UI thread stays free. Automatic main-thread fallback for media layers, live audio, LUT grades, Arrange playback, unsupported browsers, worker crash or `?worker=0`. Footer reads "· Worker" when active.
- **Render cache.** Scrub, step and loop replay frames from a bounded cache (pixel-identical). Footer chip shows coverage.
- **Proxy.** Preview quality adds Quarter.
- **Bench** (footer / ⌘K): per-style p50/p95 frame time with GPU readback, downloaded as JSON. `tools/bench.mjs` runs it headless with budgets (`tools/budgets.json`) and a regression comparer.

## Media
- OPFS media pool (IndexedDB fallback, old assets migrate), WebCodecs frame-accurate decode with automatic `<video>` fallback, **Media** page with relink, delete, storage meter.

## Colour
- **Grade** page: GPU waveform, RGB parade, vectorscope, histogram; node grade (primaries, curves, hue-vs-sat, HSL qualifier, LUT, mixer); .cube/.3dl/HALD import, .cube export. Keyframable, saved in projects and presets.

## Deliver
- Muxers vendored (exports work offline). Codec choice (H.264, HEVC, VP9, AV1), hardware-first with fallback, capability matrix, persistent **render queue** with presets, **Deliver** page.

## Extensibility
- **motif-kit@2:** effects, transitions, declarative export presets, pass graphs; v1 kits migrate. Static GLSL analysis, install-time capability approval, background compile + canary, quarantine, rollback. JSON Schemas and SDK 2.0 docs.

## Quality
- Visual regression (293 scenes), accessibility and keyboard tests, soak tests, `npm run verify`.

## Known limits
- All timings so far are software GL; no real-GPU budgets yet (`tools/bench.mjs --update-budgets` on the reference Mac).
- H.264/HEVC export and decode, WebGPU in the worker and Safari/Firefox are untested.
- Effects and transitions from kits are not yet wired into the layer stack or Arrange (engine API complete).
- Media layers and live audio render on the main thread.
