# Motif 8 and SDK 4.0: requirements review

## The request
Update the SDK for: (1) vector-based graphics and typography; (2) image layer stacking inside shaders (up to 3, with layer modes, independent motion and opacity); (3) independent speed with forward, backward and random direction; (4) a sequencer control that invokes shaders from the user's library at points of the looping clip, so more than four layers of look can be used. Then: do the app and supporting files need updating, and if so build Motif 8 and package everything.

## Answer: yes
The uploaded build is Motif 7.1.1 with SDK 3.0 (`motif-kit@3`). It had no way to compile the new GLSL, bake vectors, seek video by a playhead, render a Sequencer or show those controls, and it rejects an unknown kit format. So the SDK work could not stand alone. An earlier draft of these features was written against an older SDK line (1.2.x); this release re-bases it on the real one, which already had text inputs, a sandbox with static analysis and capabilities, a render Worker, a render cache and a render queue, and fits them in rather than around them. The version numbers follow the project's own policy: new required semantics bump the kit format, so `motif-kit@4`, SDK 4.0, Motif 8.0.

## How each requirement was read and built
| # | Requirement | Reading | Built |
| --- | --- | --- | --- |
| 1 | Vector graphics and typography | Crisp, resolution-independent shapes and live type in shaders (export to Lottie/SVG already exists elsewhere) | GLSL distance-shape library; **svg inputs** (kit-bundled files baked to distance fields, worker-safe, parsed as data); **distance fields for the existing text inputs** (`textDist_<id>`), so editable type gets exact outlines, glows and echoes |
| 2 | Layer stacking, up to 3, layer modes, motion, opacity | A shader that composites up to three media layers | `"stack"`: generated layer inputs and a control block per layer (opacity, 12 blend modes, offset, scale, rotation, edges, cycles, direction, travel), `L_stack`, `L_get<i>`; layers use the existing Media slots |
| 3 | Independent speed, forward/backward/random | A per-layer playhead that never breaks the loop | Whole cycles per loop + forward / backward / ping-pong / random; shader and JS agree; **video layers are seeked by the playhead** in preview and export |
| 4 | Sequencer control | A cue timeline that plays library shaders at points of the loop | A **Sequencer layer**: lane timeline, cue editor, kit-shipped sequences, deterministic planner, same code in page and Worker, 4-shader cap |

## Decisions
1. **Speed is whole cycles.** The loop rule (frame 0 equals frame L) is the product's strongest guarantee; a free fractional speed breaks it. Slower motion comes from loop length and tempo. Random direction is built from round trips so it closes exactly; forward and backward scroll whole tiles.
2. **Stacks cap at 3 layers and the Sequencer at 4 shaders at once.** Cost scales with full-screen passes; the caps keep real-time playback and the GPU budget governor honest. A sequence holds 64 cues, so "more than 4" is about time, not simultaneity.
3. **Vectors and type are baked to distance fields**, once per change (cached by content and size), so a frame costs one texture fetch.
4. **Kits stay data.** SVG files are parsed by a small tag scanner and drawn through `Path2D`; nothing is rendered by the browser's SVG engine, scripts and external references are rejected, and a new `vector` capability is shown at install. Bundled fonts were deliberately not added: the format stays text-only and the existing font import covers type.
5. **Opt-in versioning.** The new GLSL names exist only in `@4` styles, so older kits cannot collide with them. Validator output and analysis reports of 20 bundled and sample kits are byte-identical to 7.1.1.

## Evidence
See CHANGELOG-8.0.md (Tests): 11 unit tests, 67 browser checks (software GL), the old-versus-new render comparison, and the video playhead test.

## Known limits and suggestions
- **Per-glyph kinetic type** needs a glyph atlas with per-glyph layout; best next step for typography (8.1).
- **Multi-channel distance fields** for razor corners on logos at huge magnification.
- **User-attached SVG** (drop a file on an svg input) needs the media pool to accept it.
- **Sequencer macros and triggers:** 4 to 8 sequence-level knobs mapped onto cue settings so a whole reel plays from one panel and is audio-mappable; beat/onset-triggered cues baked to the loop.
- **Per-cue media and text** (a cue carrying its own image or title).
- **Real-GPU budgets**, Safari and Firefox testing, as noted since 7.0.
