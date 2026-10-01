# Motif 3.2.0

Procedural motion workspace with shader kits, a finishing stack and media-aware kit styles. One self-contained file: open `Motif3.html` in Chrome, Edge or Safari 17+.

## Folder

```
Motif3/
  Motif3.html                          the app (open this)
  kits/
    kinetic-subdivision-0.2.1.motifkit  image/video kit, also bundled in the app
    param-lab-0.1.0.motifkit             SDK 1.2 reference kit: colour, XY pad, groups, conditional controls
    cyberpunk / neuro / quantum .motifkit.json   bundled kit sources (3.0)
    source/kinetic-subdivision/, source/param-lab/   editable kit sources
  sdk/
    motif-kit-sdk/                       Motif Kit SDK 1.2 (CLI, runtime, template, examples, docs)
    motif-kit-sdk-1.2.0.zip              same, zipped
  src/                                   app build sources
    build.py                             python3 src/build.py  →  rebuilds ../Motif3.html
    motif-2.1-base.html, catalog.json, parts/
  tools/kit-audit.mjs                    headless audit of every kit style
```

## Deliver page and render queue (Motif 5)

Open the **Deliver** tab in the inspector. Pick a preset (YouTube 1080p, 4K HEVC, Social vertical, Transparent WebM, PNG sequence, Master; all editable, plus your own), press **Add to queue**, and keep working. Jobs render one at a time in the background, with progress, frames per second and an ETA; Pause / Resume, Cancel, Retry and Remove are available per job. Jobs and finished files live in IndexedDB (OPFS when the browser allows), so they survive a reload: a job that was rendering becomes **Interrupted** (Retry starts it again from frame 0) and the queue waits paused until you press Resume. The tab title shows progress and a badge counts finished renders; **Notify me** asks for system notifications (only when you press it). The viewer pauses while a job renders so the render pipeline is never shared. The quick export dialog (X) is unchanged and gained **Add to queue** and a **Codec** choice.

**Codecs.** H.264, HEVC, VP9 and AV1 go through WebCodecs where the browser reports `isConfigSupported`; hardware is requested first (`prefer-hardware`) and the exporter retries without the preference if the encoder rejects it. The Deliver page's *Encoder capabilities* table shows codec × size (720p to 4K) × alpha for this browser; the browser does not say which encoder will actually run, so *HW* means the hardware preference was accepted. Results report frames per second for the whole render + encode loop. On hardware-backed WebGL, opaque sRGB / Rec.709 frames go straight from the canvas to the encoder (`VideoFrame(canvas)`, no JS RGB to I420 loop); on software GL, with alpha, or in Display P3 the tagged I420 path is used (`frameSource: 'canvas' | 'i420'` forces one).

**Offline.** fflate, mp4-muxer and webm-muxer are vendored in `vendor/` (see `vendor/VENDOR.md`) and inlined into the single HTML by `src-v5/build.py`, so exports and ZIP need no network. Only the Google Fonts stylesheet and the optional FDK-AAC fallback for MP4 audio in browsers without an AAC encoder are external.

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
