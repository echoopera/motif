# Motif 8.0

Motif 7.1.1 plus the work below. Projects, kits and presets from Motif 3 to 7 open as before; one self-contained file, `Motif.html`.

## Do the app and its supporting files need updating for the new SDK features?

Yes, and this release does it. The SDK work (vector graphics and typography, layer stacks, independent speed and direction, a sequencer) needs the host to compile new GLSL, bake vectors into textures, drive video by a playhead, render a new kind of layer and show its controls. None of that exists in 7.1.1, so a `motif-kit@4` kit would have been rejected and a Sequencer had nowhere to live. Changed: the kit engine (`kit-gl`, new `kit-v4`, `kit-sandbox`), kit registry and canary, the project model (`timeline`), the compositor, the media store (video playhead), the inspector, the JSON schemas, the SDK (now 4.0) and the docs. The patch is reproducible: `src-v8/` rebuilds `Motif.html` from the 7.1.1 build.

## Kits: motif-kit@4 (SDK 4.0)
- **Vector graphics.** GLSL shape library (`sdCircle sdRoundBox sdRing sdNgon sdTriangle sdStar sdArc sdBezier`, `opUnion opSub opInter opRound opOnion`, `vfill vstroke vglow vpaint`). **svg inputs**: a vector file bundled in the kit is parsed as data (worker-safe, no DOM, no browser rendering), baked into a signed-distance texture and read with `vec_<id>(uv)`. **Text distance fields**: `"sdf": true` on a text input adds `textDist_<id>(i, q)`, so outlines, glows and echoes of live type are exact at any scale. New capability `vector`.
- **Layer stacks.** `"stack": { "layers": 3 }` gives a style up to three media layers with 12 blend modes (W3C formulas), opacity, offset, scale, rotation, edge mode and travel each, as ordinary keyframable channels; `L_stack(base, uv)`, `L_get<i>(uv)`.
- **Speed and direction.** Cycles per loop and forward / backward / ping-pong / random on every layer and svg; always loop-exact. The JS playhead matches the shader and drives video layers: a clip plays forward, backward, ping-pong or in random round trips, frame-exact in previews and exports.
- **Sequences** (`motif-seq@1`): cue lists that call library styles at points of the loop; up to 64 cues over 8 lanes, at most 4 shaders at once; fades, blend modes, cycles, direction, repeat, seeded chance; kits ship them.
- Static analysis, capability approval, quarantine and canary treat `@4` like `@2`/`@3`; the canary bakes svg inputs and distance fields. `motif-kit@1`–`@3` kits are unchanged: validator output, warnings and analysis reports of all 20 bundled and sample kits are byte-identical to 7.1.1, and all 89 styles of 7.1.1 render identical pixels in 8 (`node tests/v8/regression.mjs`).

## App
- **Sequencer layer** (library: Sequencer). One layer holds a cue list. Inspector: a lane timeline (drag to move across the loop and lanes, drag an edge to resize, arrow keys / Shift / Delete on a focused cue, a live playhead), a cue list, a cue editor (style from the whole library, start, length, lane, plays per cue, direction, blend, opacity, fades, chance, seed, mute) with the chosen style's own settings, an overlap meter against the 4-shader cap, **Load a sequence** (Starter or any installed kit's) and **Copy JSON**. The lowest cue draws on the background like a base layer; the rest are transparent layers. Rendered by the same code in the page and in the render Worker; deterministic, so scrubbing, the render cache and exports agree. Cues whose kit is missing draw nothing, and projects that call a missing kit's styles ask for the kit.
- **Reference kits bundled** (Kits): Stack Lab (2 styles), Vector Type (3), Sequence Demo (6 styles, 2 sequences). Library: 101 styles (was 89: +1 Sequencer, +11 kit styles).
- Media: stack layers take images or video in Layers > Media like any input; svg inputs and distance fields need no attachment. Up to 6 media slots per layer.
- Duplicate layer copies the cue list; missing-kit detection looks through cues; save/open, autosave, undo/redo and saved clips carry `seq`.
- Version: title, badge, footer and reports read Motif 8.

## SDK 4.0 (`sdk/motif-kit-sdk`, regenerated from the app build)
- `motif-kit@4` validation and analysis; `new --example stack|vector|sequence`; `seq` (validate, plan); `prelude --v4`; `preview` renders svg inputs, distance fields, per-layer test cards, a motion-seam test in all four play modes and every sequence.
- Reference kits `examples/stack-lab`, `examples/vector-type`, `examples/sequence-demo`; docs [motif-kit@4](sdk/motif-kit-sdk/docs/kit-format-4.md), versioning, sandbox and text-input updates; `schemas/motif-kit-4.schema.json`; project schema gains the Sequencer layer's `seq`.

## Tests (`tests/v8`)
- `node --test tests/v8/unit.test.mjs`: 11 tests (validator rules for stacks, svg, distance fields and sequences, playhead closure and continuity, planner, sanitizer, svg parser, distance-field accuracy).
- `node tests/v8/browser.mjs` (Playwright, software GL): 67 checks: boot, bundled kits, in-app validation and rejection, determinism, loop closure, a one-cue Sequencer equals the style drawn directly (pixel-identical for kit shaders), blend modes, the 4-shader cap, worker/main-thread parity, the inspector (add, edit, keyboard, drag, undo, save/open, duplicate, load), shader-versus-JS playhead parity (8192 samples, worst error 0.12 cycles at 8-bit readback, every random direction agreeing) and, when ffmpeg is installed, video layers following the playhead (backward at t equals forward at L - t, mean error under 1/255).
- `node tests/v8/regression.mjs`: 7.1.1 against 8 (kit validation byte-identical; pixels of every style identical).
- Schemas: the three reference kits, the older sample kits and a Sequencer project validate against `motif-kit-4` and `motif-project`; a 4-layer stack and sequences in an `@3` manifest are rejected (checked with Ajv; not part of the shipped tests).

## Known limits
- svg: paths and basic shapes only (no gradients, text, masks, filters or `<use>`); colours are ignored. A user cannot attach their own svg yet (the kit's file is used).
- Distance fields are exact within `spread` of an edge and clamp beyond it; very sharp corners round slightly at extreme magnification (a multi-channel field is the fix, 8.1).
- Per-glyph kinetic type (a letter at a time) is not in 8.0; text inputs still move as lines.
- A Sequencer cue cannot carry its own media or text; styles that need them draw their defaults inside a cue. Media layers and live audio still render on the main thread.
- Random round trips treat a video as looping (they wrap through the clip start); use a seamless clip.
- Real-GPU budgets, Safari and Firefox remain untested, as in 7.0.
