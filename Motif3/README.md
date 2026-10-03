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
    motif-kit-sdk/                       Motif Kit SDK 1.2.5 (CLI, runtime, template, examples, tests, docs)
    motif-kit-sdk-1.2.5.zip              same, zipped (1.2.0 zip kept)
  src/                                   app build sources
    build.py                             python3 src/build.py  →  rebuilds ../Motif3.html
    motif-2.1-base.html, catalog.json, parts/
  tools/kit-audit.mjs                    headless audit of every kit style
```

## Slow exports

Open **Deliver** and press **Check speed**. It shows the GPU in use and what each layer costs per frame at the export size. If it says *Software rendering*, the browser is drawing WebGL on the CPU; turn on hardware acceleration (Chrome: Settings › System › Use graphics acceleration) and reload. Frame cost depends on the style, resolution, layer count and motion-blur samples; use the measured result for your scene.

## Using images and video

1. Pick a style marked **MEDIA** in the library (all ten Kinetic Subdivision styles; the kit is bundled).
2. Drop a photo or video on the stage, or use **Layers › Media › Source**.
3. **Fit**: Fill (crop), Fit (letterbox), Stretch. Video **Timing**: *Fit to loop* retimes the clip to one Motif loop (seamless); *Real time* plays at 1×.
4. **Media mix** in the Style group blends between your media and the procedural source, and can be keyframed.

Files stay in this browser (IndexedDB, keyed by content hash) and are never uploaded. Projects, autosave and saved looks keep a reference; in another browser the slot shows **Relink**. Exports seek video frame by frame, so renders are deterministic.

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
