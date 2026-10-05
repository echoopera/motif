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

- **Text input / motif-kit@3.** Kits can declare a `text` input: 1–3 separately editable lines that Motif rasterizes, centred and untransformed, into ONE glyph atlas per input (`u_<id>`, `textLine_<id>(i, q)`); strings never become GLSL uniforms and a kit never asks for a PNG. New `text` capability, approved at install. The Layers inspector gets a Text section: live text fields (maxlength enforced) with per-line font family (typed, installed fonts via `queryLocalFonts()` where allowed, or imported TTF/OTF/WOFF/WOFF2 kept in IndexedDB by content hash, with Relink), weight, size, tracking and alignment, plus a visible "Fallback in use" hint. Text and fonts are keyable with hold keys; size and tracking ease and can be audio-mapped. Text lives on the layer (undo, autosave, project files, presets, duplicate; kept across styles of one kit). The atlas is built engine-side (`04b-text-atlas.js`, OffscreenCanvas) in the render worker and on the main thread with identical pixels, rebuilt only when text, fonts or atlas size change; the render cache keys on the font epoch so a late font replaces cached frames; exports wait for fonts and rebuild the atlas at export resolution. The install canary probes text styles with their default strings. **FaceType 1.3.0** (`kits/facetype-1.3.0.motifkit`, source in `kits/source/facetype/`) replaces the image plate with a three-line `type` input. SDK 3.0: validator, `schemas/motif-kit-3.schema.json`, `docs/text-inputs.md`, `examples/type-lines`, and `motif-kit preview` renders default strings with a bundled fallback font. @1/@2 kits read and render exactly as before; older hosts reject @3 by its format string.

## Kit shader safety
- The shader prelude defines `smoothstep` (reversed edges ease downwards, equal edges step), `sqrt`, `log`, `inversesqrt`, `acos`, `asin` and `normalize` for out-of-range inputs, so every kit behaves the same on every GPU (Apple, AMD and NVIDIA differ on undefined cases, which shows as black bands and blocks). Well-defined inputs are unchanged: all 89 built-in styles render within 0.002/255 of before.
- **Check every style on this GPU** (⌘K) renders each style and reports blank, black, quarantined or errored ones with a thumbnail of each. Bench reports now include the same look check.
- Known: about 26 styles are flagged as flashing; with the photosensitive-safe limiter on (default) they are blended over ~0.7 s, which looks like smear. Toggle it in Kits.

## Quality
- Visual regression (293 scenes), accessibility and keyboard tests, soak tests, `npm run verify`.

## Known limits
- Text inputs: Safari/Firefox untested (`letterSpacing` falls back to per-glyph placement where missing; `queryLocalFonts()` is Chromium-only, others type the family). Imported fonts are per browser (Relink elsewhere). Text in effects/transitions is not supported.
- All timings so far are software GL; no real-GPU budgets yet (`tools/bench.mjs --update-budgets` on the reference Mac).
- H.264/HEVC export and decode, WebGPU in the worker and Safari/Firefox are untested.
- Effects and transitions from kits are not yet wired into the layer stack or Arrange (engine API complete).
- Media layers and live audio render on the main thread.
