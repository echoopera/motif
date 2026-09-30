# Motif3 performance and quality review

Completed 2026-09-28. Combined with the incoming Motif 3.2.0 / SDK 1.2 changes. Implementation and verification by Codex; self-review, not independent review.

## GPU answer

**Yes: this Mac used hardware GPU rendering.** Local Chrome reported `ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Pro, Unspecified Version)`, software=false. WebGPU became ready after initialization. The shader kit and finishing stack use WebGL2; four particle/generative styles use WebGPU. Canvas 2D compositing can also be accelerated by the browser, but JavaScript geometry/layout and several pixel-processing paths remain CPU work. No claim is made that the entire pipeline or video codec is GPU-only.

## Changes delivered

- Reuse decoded video frames instead of repainting/uploading every change of playback time. A seek invalidates immediately, preserving paused/export frame accuracy. Browsers without video-frame callbacks retain the prior time-based fallback.
- Allocate media texture storage once per size, refresh its pixels with `texSubImage2D`, retain sRGB/alpha handling and mipmaps, and upload before shader passes. Cache eviction now follows actual recent use.
- Adapt toward 60 Hz instead of waiting for sustained frame intervals above 50 ms. Adjust once per 20 frames, using average and p95 intervals to reduce oscillation. Exports remain full resolution.
- Restore full internal shader resolution while paused, including photosensitive low-pass rendering. This remains bounded by the selected preview canvas size; it does not turn a small preview into an export-sized canvas.
- Show measured recent FPS and distinguish WebGL/WebGPU/software GL in the existing preview readout. Main-thread submission time is explicitly labeled in its tooltip.
- Pause decoders for removed/unused hidden layers and hidden tabs, while preserving hidden or animated track-matte dependencies.

## Evidence on this Mac

Browser: 154.0.8037.58. Headless local Chrome with actual Apple GPU, no forced software renderer. Synthetic 1920×1080 VP8 source at about 24 fps. Timings are bounded test samples, not a promise for arbitrary scenes.

| Check | Result |
|---|---|
| Normal app preview, one media kit layer | 60.0 fps; p95 16.8 ms; shader scale 100% |
| Full-HD render loop, one media layer and finishing | 60.0 fps; p95 16.7 ms |
| Full-HD render loop, two media layers, 180° shutter / four samples | 60.0 fps; p95 16.7 ms |
| Video bake work over 109 display callbacks / ~1.8 s | 94 → 42 bakes, 55% fewer |
| Ten forced media updates after warm-up | Ten sub-image updates, zero new media storage allocations; mipmaps retained |
| Full-resolution video frame and four-sample blur image | Updated image exactly matches repeat original-build control |
| Style coverage | Ten Kinetic Subdivision styles and four WebGPU styles rendered; correct API labels |
| Fallback and lifecycle | Time-based video fallback, removed/hidden decoder pause, hidden/animated matte retention passed |
| Export | MP4 export completed, 100,007 bytes; expected color tags retained |
| Integrated build | Rebuild byte-identical; all inline JavaScript syntax checks passed; no page errors in tests |

The Full-HD measurements use a controlled requestAnimationFrame render loop at 1920×1080, full shader resolution, live video and existing finishing. They do not measure a maximized editor UI, every available shader or GPU utilization percentage. The two layers share the synthetic media asset. The existing app preview was already ~60 fps for this fixture; the improvement is lower repeated video work and better load/quality behavior, not an invented doubling of FPS.

The first original-vs-updated pixel comparison differed by at most one 8-bit code value. A second original-build run reproduced exactly the same difference; the updated frame and blurred frame matched that repeat control byte-for-byte. This distinguishes browser/context rounding from a change introduced by the optimization. Original comparison data remains in results.json.

## Remaining constraints

- CPU-based styles, Canvas 2D layer composition, luminance-mask pixel readback, cross-API synchronization and export RGB-to-I420 conversion still cost time. Export processing is not an end-to-end GPU-resident pipeline.
- Video decoding and WebCodecs encoding are selected by the browser; hardware codec use was not separately measured.
- Many heavy ray-marched layers, higher shutter sample counts, 4K/8K output or difficult codecs may exceed real-time budgets. Adaptive playback trades internal preview resolution for cadence; exported sampling is unchanged.
- No Safari/Edge, long-duration memory soak, arbitrary user-media or HDR/color-reference validation was performed. Existing browser media fitting/bake limits and export temporal sampling semantics were preserved.
- A GPU timer extension is available here. The displayed frame interval is observed browser cadence; the submission ms is not GPU execution time.

## Reproducibility and recovery

Artifact SHA-256: `824d2fd4cb4ff1f7e0d4571aefc5c2ab10793569b055d2144fd34c66a469936a`. Raw evidence: results.json, regression.json, test-output.txt, RGBA controls and verified-app.png in this folder. Checks: tools/performance-check.mjs and tools/performance-regression.mjs. External dependencies may be required for the app's export muxers/fonts.

A concurrent incoming source update was detected and preserved in incoming/. All parameter controls/build steps from that update remain integrated. To revert only this performance work to that 3.2.0 snapshot, restore the incoming/src directory and incoming/Motif3.html; the initial 3.1.2 touched-file backup is separately in baseline/. Preserve any subsequent edits before restoration.

## Technical references

The video callback strategy follows [MDN: requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback). Texture storage reuse and moving DOM uploads before drawing follow [MDN: WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices). Measured app claims above come from the local tests, not these references.
