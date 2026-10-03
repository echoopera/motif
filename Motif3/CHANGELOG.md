# Changelog

## SDK 1.2.5 — vector + type, layer stacks, speed/direction, sequencer
- Opt-in with `"sdk": "1.2.5"`; kits without it compile exactly as before (all shipped kits verified).
- Vector graphics and typography: SDF shape library and `vpaint` in GLSL; `svg` and `text` inputs baked to distance fields (`vec_<id>(uv)`), bundled fonts, generated controls.
- Layer stacks: `"stack": { "layers": 3 }` gives three media layers with 12 blend modes, opacity, offset, scale, rotation, edge mode and motion each.
- Speed and direction: whole cycles per loop plus forward / backward / ping-pong / random, loop-exact; shader and JS playheads match; `stackPlayheads` drives video layers.
- Sequencer: `motif-seq@1` cues invoke library styles at points of the loop (lanes, fades, blends, cycles, direction, repeat, chance, up to 64 cues, 4 concurrent); planner, analyzer, compositor, kit-shipped sequences.
- SDK: `new --example`, `seq`, richer `preview` (stack/vector/type inputs, motion-seam test in all four play modes, sequence rendering), test suite, reference kits `stack-lab`, `vector-type`, `sequence-demo`.
- App UI for the new controls and the Sequencer layer is the next step: see `docs/HOST-INTEGRATION-1.2.5.md`.

## 3.2.1 — MP4 audio + viewer fit
- Audio encoder errors are no longer swallowed: a failed AAC encode now stops the export with a clear message instead of writing a silent MP4.
- AAC is requested as raw frames; ADTS output (Safari) is unwrapped and a missing decoder description is supplied, so the track muxes into H.264 MP4.
- Browsers without a WebCodecs AAC encoder now get real AAC in MP4 via a WebAssembly FDK-AAC fallback (previously Opus, which QuickTime and most editors ignore). The export status reports the audio codec.
- Viewer canvas now fits inside the stage padding and shrinks with the window instead of overlapping the side panels.

## 3.2.0 — custom kit parameters (SDK 1.2)
- Up to 32 parameters per style (was 16). New types: `color` (picker, GLSL `c_<key>()` linear / `s_<key>()` sRGB) and `point` (XY pad, GLSL `v_<key>()`). Both expand to ordinary channels, so keyframes, locks, Mutate, audio mapping and presets work unchanged.
- Optional on every param: `group` (collapsible inspector sections), `hint` (tooltip), `show` (only visible while another control has a given value), plus `log` and `randMax` on ranges.
- Validation for all of the above, with clear errors; existing kits are unchanged.
- SDK 1.2: docs, `examples/param-lab` reference kit, kit-gl runtime regenerated. Motif ships `param-lab-0.1.0.motifkit` in `kits/`.

## 3.1.2 — Safari export fixes
- Fixed exports stalling (frame 8, frame 44) in Safari: its H.264 encoder never hands frames back in quality mode. Safari now uses realtime mode, and the wait for the encoder is time-limited, with a clear error if it stops responding.
- New **Video quality** setting in Deliver (Standard / High / Maximum) for MP4 and WebM. Default High is about 1.8x the previous bitrate.
- The export status line shows live draw / read / convert / encode times per frame.
- Check speed also times the real export path (draw, full readback, colour convert).

## 3.1.1 — export speed diagnostics
- Deliver › **Check speed**: times one export-size frame per layer plus the finish stack and projects the whole render.
- The GPU renderer is shown in Deliver, and the status bar shows **Software GL** in red when WebGL is running on the CPU (SwiftShader, llvmpipe), which makes kit shaders and exports 50–100× slower.
- ETA appears after the first frame instead of the eighth.
- Calcium Wave: neuropil haze renders in a half-resolution pass, dendrite work is culled where it cannot reach (output unchanged, ~20% faster).
- Kinetic Subdivision 0.2.1: skips the procedural fallback pass and its texture fetches when media fully replaces it.

## 3.1 — media inputs
- Kit format: optional `inputs` (image / video / media, up to 2 per style), kit-level or per style. Backward compatible with `motif-kit@1`.
- Runtime: media baked to the frame's aspect (fill / fit / stretch), uploaded as sRGB textures on units 4–5 with mipmaps; `u_<id>`, `u_<id>On`, `u_<id>Size`, `u_<id>Time`, `m_<id>()` helpers.
- SDK 1.1: validation, `preview --media` (built-in test card otherwise, plus an "ignores media?" check), `liquid-lens` template, docs.
- SDK 1.0 kits that declared `uniform sampler2D u_source` themselves are detected and work unchanged (kinetic-subdivision 0.1.0 included).
- App: Layer › Media panel (drop, replace, remove, fit, video timing, relink), MEDIA badge in the library, drag-and-drop onto the stage, IndexedDB asset store, video preview sync, frame-exact video seeking on export.
- Kinetic Subdivision 0.2.0: declares its input, composites transparent media on the palette background, falls back to the procedural source; bundled in the app.

## 3.0.1
- Export renders in short slices: Stop render / Esc cancel within about a second, elapsed and ETA readout.
- Autosave and restore of the project; New button.

## 3.0
- Resolve-style workspace, GPU budget governor, context-loss recovery, kit clean-up (black-frame fixes in Quantum and Neuro).
