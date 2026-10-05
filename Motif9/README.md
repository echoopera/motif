# Motif 9.0

Procedural motion workspace with shader kits, a finishing stack, media and text styles, a colour page, a render queue, a Sequencer, layer stacks, vector graphics and type, and (new in 9) **MotifGraph**: real-time cloning, effectors, fields and mesh deformers on any layer or on the whole composite. One self-contained file: `Motif.html`.

## New in 9: MotifGraph

Open the **Graph** tab, pick **Layer** or **Composite**, start from a preset or add nodes. 30 node types (Cloner, 9 fields, 6 effectors, 13 deformers, Stage with camera, lighting and edge handling), 12 presets, every parameter a normal channel (keyframes, audio, undo), loop-exact, deterministic, zero cost when unused. Guide: [docs/MOTIFGRAPH.md](docs/MOTIFGRAPH.md) · nodes: [docs/MotifGraph-nodes.md](docs/MotifGraph-nodes.md) · roadmap: [docs/MotifGraph-PRD.md](docs/MotifGraph-PRD.md) · details: [CHANGELOG-9.0.md](CHANGELOG-9.0.md).

Motif 9 is the 8.0.0 build plus MotifGraph; everything from 8 (below) works as before, and `node tests/v9/regression.mjs` proves every existing style renders identical pixels.

---

Procedural motion workspace with shader kits, a finishing stack, media and text styles, a colour page, a render queue, and (new in 8) a **Sequencer**, layer stacks, and vector graphics and type. One self-contained file: open `Motif.html` in Chrome or Edge (Safari 17+ works with WebGL2 only). No install, no server, no network.

## Folder

```
Motif-9.0.0/
  Motif.html                  the app (open this); index.html redirects to it
  START-HERE.txt  CHANGELOG-9.0.md  CHANGELOG-8.0.md  CHANGELOG-7.0.md  CHANGELOG-5.1.md  SHA256SUMS
  kits/                       installable .motifkit files: stack-lab, vector-type, sequence-demo (new, also bundled in the app),
                              facetype, wallcast, param-lab, Motif-Kits-1.0.1/; kits/source/ holds editable sources
  sdk/
    motif-kit-sdk/            Motif Kit SDK 4.0: CLI, runtime, templates, examples, docs
    motif-kit-sdk-4.0.0.zip   the same, zipped
  schemas/                    JSON Schemas: motif-kit-2/3/4, motif-graph-1, motif-project
  docs/                       MOTIFGRAPH.md, MotifGraph-nodes.md, MotifGraph-PRD.md (9); MOTIF8-VECTOR-STACK-SEQUENCER.md (user guide), MOTIF-SDK-4.0-REVIEW.md, PRD and spec, audits, quality harness
  tests/v9/                   Motif 9 tests: unit, browser, regression vs 8.0.0, schema, bench
  tests/v8/                   Motif 8 tests (unit + browser)
  tools/                      bench and budgets (unchanged from 7.1.1)
  src-v9/                     rebuilds Motif.html from the 8.0.0 build: python3 src-v9/build/patch_v9.py src-v9/Motif-8.0.0.html Motif.html
  src-v8/                     rebuilds Motif.html from the Motif 7.1.1 build: python3 src-v8/build/patch_v8.py <7.1.1.html> Motif.html
```

## New in 8: Sequencer, layer stacks, vector graphics and type

See [docs/MOTIF8-VECTOR-STACK-SEQUENCER.md](docs/MOTIF8-VECTOR-STACK-SEQUENCER.md) for the user guide and [CHANGELOG-8.0.md](CHANGELOG-8.0.md) for the details.

- **Sequencer layer.** Pick Sequencer in the library. A lane timeline of cues, each calling a style from your library (kit styles too) for part of the loop, with fades, blend modes, direction, repeats and seeded chance. More looks than four layers, never more than four shaders at once. Kits can ship sequences; **Load a sequence** brings them in.
- **Layer stacks.** Kit styles can hold up to three image or video layers inside one shader, each with its own blend mode (12), opacity, offset, scale, rotation, edges and motion; videos play forward, backward, ping-pong or in random round trips by whole cycles per loop, frame-exact in exports.
- **Vector graphics and type.** Kits get a distance-shape library, SVG inputs baked to distance fields, and distance fields for live text, so outlines, glows and echoes stay exact at any scale (kits: Shape Field, Logo Reveal, Type Poster).
- **Kit format `motif-kit@4` / SDK 4.0.** `motif-kit@1` to `@3` kits and Motif 3 to 7 projects open as before. See `sdk/motif-kit-sdk/docs/kit-format-4.md`.

Tests: `node --test tests/v8/unit.test.mjs` and `node tests/v8/browser.mjs` (Playwright; set `PLAYWRIGHT_MODULE` and `MOTIF_CHROMIUM` if needed).

## Deliver page and render queue (Motif 5)

Open the **Deliver** tab in the inspector. Pick a preset (YouTube 1080p, 4K HEVC, Social vertical, Transparent WebM, PNG sequence, Master; all editable, plus your own), press **Add to queue**, and keep working. Jobs render one at a time in the background, with progress, frames per second and an ETA; Pause / Resume, Cancel, Retry and Remove are available per job. Jobs and finished files live in IndexedDB (OPFS when the browser allows), so they survive a reload: a job that was rendering becomes **Interrupted** (Retry starts it again from frame 0) and the queue waits paused until you press Resume. The tab title shows progress and a badge counts finished renders; **Notify me** asks for system notifications (only when you press it). The viewer pauses while a job renders so the render pipeline is never shared. The quick export dialog (X) is unchanged and gained **Add to queue** and a **Codec** choice.

**Codecs.** H.264, HEVC, VP9 and AV1 go through WebCodecs where the browser reports `isConfigSupported`; hardware is requested first (`prefer-hardware`) and the exporter retries without the preference if the encoder rejects it. The Deliver page's *Encoder capabilities* table shows codec × size (720p to 4K) × alpha for this browser; the browser does not say which encoder will actually run, so *HW* means the hardware preference was accepted. Results report frames per second for the whole render + encode loop. On hardware-backed WebGL, opaque sRGB / Rec.709 frames go straight from the canvas to the encoder (`VideoFrame(canvas)`, no JS RGB to I420 loop); on software GL, with alpha, or in Display P3 the tagged I420 path is used (`frameSource: 'canvas' | 'i420'` forces one).

**Offline.** fflate, mp4-muxer and webm-muxer are vendored in `vendor/` (see `vendor/VENDOR.md`) and inlined into the single HTML by `src-v5/build.py`, so exports and ZIP need no network. The kit and UI fonts (Instrument Sans, Anybody, Fraunces, JetBrains Mono, IBM Plex Sans, IBM Plex Mono; Latin subsets from Fontsource, SIL Open Font License 1.1) are embedded as WOFF2 in a `<style data-motif-fonts>` block and posted to the render worker, so text styles draw the same in every browser, Safari included. Only the optional FDK-AAC fallback for MP4 audio in browsers without an AAC encoder is external.

Tests: `npm test` (unit, including vendor and queue logic) and `npm run test:export` (browser: offline MP4/WebM/ZIP, queue order, reload recovery, Deliver page).

## Slow exports

Open **Deliver** and press **Check speed**. It shows the GPU in use and what each layer costs per frame at the export size. If it says *Software rendering*, the browser is drawing WebGL on the CPU; turn on hardware acceleration (Chrome: Settings › System › Use graphics acceleration) and reload. Frame cost depends on the style, resolution, layer count and motion-blur samples; use the measured result for your scene.

## Using images and video

1. Pick a style marked **MEDIA** in the library (all ten Kinetic Subdivision styles; the kit is bundled).
2. Drop a photo or video on the stage, or use **Layers › Media › Source**.
3. **Fit**: Fill (crop), Fit (letterbox), Stretch. Video **Timing**: *Fit to loop* retimes the clip to one Motif loop (seamless); *Real time* plays at 1×.
4. **Media mix** in the Style group blends between your media and the procedural source, and can be keyframed.

Files stay in this browser and are never uploaded. They live in the media pool: the Origin Private File System (keyed by content hash; large footage is read back lazily from disk, so it survives reloads without re-selecting and without sitting in memory), with IndexedDB as the fallback and as the read-through source for files stored by earlier versions (migrated the first time they are used). Projects, autosave and saved looks keep a reference; in another browser the slot shows **Relink**. The **Media** page (inspector tab) lists the pool with thumbnails, resolution, duration, codec, size and in-use badges, a storage meter, drag-and-drop import, relink for files a project references but this browser lacks, delete, and a "remove unused clips, oldest first" recovery when storage is full. Keyboard: arrows move, Enter uses the clip on the active layer, Delete removes it.

MP4 and MOV clips are also decoded with WebCodecs (demuxed by the vendored mediabunny, see below) for paused scrubbing and export seeks: the exact frame for a time, from a bounded ring of decoded frames, hardware-accelerated where the browser allows. Playback still uses the `<video>` element. If WebCodecs, the container or the codec is unavailable, or the decoded frame does not match what `<video>` shows (typically an untagged BT.601 clip), Motif silently keeps the `<video>` path. WebM always uses `<video>`. Exports seek frame by frame either way, so renders are deterministic.

Vendored: `src-v5/vendor/mediabunny-lite.js` (mediabunny 1.61.0, MPL-2.0, MP4/MOV demux and video decode only; about 190 KB, which is what it adds to `motif5.html`). Rebuild it with `sh src-v5/vendor/build-mediabunny.sh`. Media checks: `SOFTWARE_GL=1 node tests/browser/media-check.mjs` (needs Playwright, Chromium and ffmpeg).

## Using text (motif-kit@3)

Styles marked **TEXT** in the library (FaceType 1.3.0: install `kits/facetype-1.3.0.motifkit` from the Kits tab and approve **text**) draw lines you type. **Layers › Type · text** has, per line: the text (live), font (type a family, pick from **Installed fonts…** where the browser allows, or **Import font file…**: TTF, OTF, WOFF, WOFF2, kept in this browser by content hash), weight, size, tracking and alignment. A family the browser can't draw shows **Fallback in use** and the face used instead; an imported file missing in another browser shows **Relink**. Every field can be keyed (text, font and alignment hold; size and tracking ease). Motif rasterizes the lines into one atlas the kit's shader samples (`textLine_<id>(i, q)`): spec in `sdk/motif-kit-sdk/docs/text-inputs.md`. Tests: `node --test tests/text.test.mjs` and `SOFTWARE_GL=1 node tests/browser/text.browser.mjs`.

## Building kits with media

```
cd sdk/motif-kit-sdk && npm i
node bin/motif-kit.mjs new my-kit --id my-kit            # template includes liquid-lens, a media example
node bin/motif-kit.mjs preview my-kit --media photo.jpg
node bin/motif-kit.mjs pack my-kit --out dist
```

Declare `"inputs": [{ "id": "source", "type": "media" }]` in the manifest; shaders get `u_source`, `u_sourceOn` and `m_source(q)`. Full spec: `sdk/motif-kit-sdk/README.md` → *Media inputs*.

## Custom parameters (SDK 1.2)

Kits can declare up to 32 parameters per style: sliders (`range`, `int`, `toggle`, `select`) plus `color` pickers and `point` XY pads. Add `group` for inspector sections, `hint` for tooltips, `show` to reveal a control only when another has a given value, and `log` for logarithmic sliders. Every channel is keyframable, lockable, mutable, audio-mappable and saved in presets. In GLSL a colour `tint` gives `c_tint()` (linear) and a point `origin` gives `v_origin()`. Try `kits/param-lab-0.1.0.motifkit`; the full spec is in `sdk/motif-kit-sdk/README.md` → *Parameters*.

## Exporting from Safari

Safari's H.264 encoder never returns frames in quality mode, so exports use realtime mode there. Deliver › **Video quality** (Standard / High / Maximum) raises the bitrate; use Maximum, or WebM / PNG sequence, when you want a clean master.

## Real-time performance

Shader kits and finishing effects use WebGL2. Particle Form, Flow Field, Orbital Swarm and Metaballs use WebGPU when available, with Canvas 2D fallbacks. Other styles, luminance masks and export RGB-to-YUV conversion still involve the CPU. Hardware video decoding/encoding is browser-controlled.

The preview readout now shows recent frame rate and the layer rendering API; hover for average and 95th-percentile frame intervals. Its millisecond value measures main-thread submission, not total GPU execution. **Shaders 100%** means full internal shader resolution; lower values mean playback is adapting to load. Pausing restores full internal shader resolution at the selected preview size. Exports retain their chosen resolution and motion-blur sampling.

Video media is refreshed when a decoded frame changes, GPU texture storage is reused, and inactive video decoders are paused. Playback adapts toward 60 Hz with hysteresis.

See [performance-review/REPORT.md](performance-review/REPORT.md) for hardware measurements, quality checks, limits and rollback. Run the checks with a locally installed Playwright and Chrome: `node tools/performance-check.mjs` and `node tools/performance-regression.mjs` (or set `PLAYWRIGHT_MODULE` to your Playwright entry point). These tests create an isolated browser profile and synthetic media.
