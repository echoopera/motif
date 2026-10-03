# Motif Kit SDK 1.2.5: requirements review

## What was asked, and how it was read

| # | Requirement | Reading | Delivered in 1.2.5 |
| --- | --- | --- | --- |
| 1 | Vector based graphics and typography | Resolution-independent shapes and live type inside shaders (not vector *export*, which Lottie/SVG export already covers separately) | Distance-field toolkit in GLSL (`sdNgon sdStar sdArc sdBezier …`, `vpaint`), `svg` and `text` inputs baked to SDFs by the SDK, generated controls, bundled fonts |
| 2 | Image layer stacking in shaders, up to 3, layer modes, independent motion and opacity | One style compositing up to 3 media layers with its own blend maths | `"stack": { "layers": 3 }`: 12 blend modes, opacity, offset, scale, rotation, edge mode and motion per layer, all keyframable channels |
| 3 | Independent speed, forward / backward / random | Per-layer playhead that never breaks the loop | "Cycles / loop" + Direction (forward, backward, ping-pong, random) on every layer, svg and text; shader and JS twins agree (tested); drives video seeking |
| 4 | Sequencer control invoking library shaders at points of the loop, beyond 4 layers | A cue timeline layer: many styles over a loop, a few at a time | `motif-seq@1`: cues, lanes, fades, blend, cycles, direction, repeat, chance; planner, validator, analyzer, compositor, kit-shipped sequences, CLI |

## Assessment and the decisions that follow
1. **Speed must be whole cycles.** The SDK's loop rule (frame 0 equals the frame at the loop length) is the product's strongest guarantee. Free fractional speed breaks it, so speed is an integer "cycles per loop" and slower motion comes from the loop length or tempo. Random direction is built from round trips so it closes exactly, and forward/backward scrolls whole tiles.
2. **Stacking is capped at 3 and sequencing at 4 concurrent shaders.** Cost scales with the number of full-screen passes; the caps keep real-time playback and the GPU budget governor honest. Sequences can hold 64 cues, so "more than 4" is about time, not simultaneity.
3. **Type and vectors are baked, not drawn per pixel.** Glyph outlines and SVG paths are not cheap to evaluate in a fragment shader. Baking to a distance field once (cached, rebaked only on edits) makes every frame a single texture fetch and gives outline, glow and echoes at any scale.
4. **Opt-in versioning.** New names are added to the prelude only for kits that declare `"sdk": "1.2.5"`; all 24 shipped kits validate and compile exactly as before.

## Known limits (honest list)
- SDF corners round slightly at extreme magnification; a multi-channel SDF would fix this (1.3).
- SVG: paths and basic shapes only. No gradients, text, masks, filters or `<use>`; colours are ignored.
- System fonts differ per machine; bundle a font for portable exports.
- Per-glyph animation (kinetic type by letter) is not in 1.2.5: it needs a glyph atlas with per-glyph layout.
- Text and font changes rebake and cannot be keyframed; animate Scale, Offset and Rotate instead.
- The Motif app UI is not changed: see `HOST-INTEGRATION-1.2.5.md`. The SDK provides everything the app calls.

## Suggestions
1. **Per-glyph type (1.3):** bake a glyph atlas + layout so letters can stagger, scramble and fly in.
2. **MSDF** for razor corners on logos at huge sizes.
3. **Sequencer macros:** expose 4–8 sequence-level knobs mapped onto cue params so a whole reel is playable from one panel and audio-mappable.
4. **Sequencer triggers:** beat/audio-onset triggered cues (still deterministic when baked to the loop).
5. **Texture budget:** warn in the UI when a stack + text + svg style approaches 9 textures on low-end GPUs.
6. **Kit signing / font licence check** before sharing kits that bundle fonts.
