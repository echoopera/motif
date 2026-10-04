# Motif Kit SDK 4.0 (`motif-kit@4`, reads `motif-kit@1`, `@2` and `@3`)

A kit adds shader **styles**, **effects**, **transitions** and **export presets** to Motif, packaged as a single `.motifkit` file. When you drop one on Motif, its styles show up in the library alongside the built-ins and work the same way: layers, blend modes and masks, keyframes on any parameter, Mutate, Evolve, Randomize, audio-band mapping, the finishing stack, and every export format.

The app is one build. A kit is **data and GLSL only**: a manifest plus shaders that are checked statically, compiled in the background and test-rendered before they draw. Nothing in a kit is ever run as JavaScript.

```
motif-kit new my-kit --id my-kit       # copy the starter template (3 example styles, one with a media input)
motif-kit preview my-kit               # contact sheet + compile errors, loop seam, blank-frame check, timing
motif-kit preview my-kit --media a.jpg # feed an image to styles with media inputs
motif-kit preview my-kit --text "A|B|C" # text inputs: your lines instead of the declared defaults (bundled fallback font)
motif-kit validate my-kit [--json]     # schema, static GLSL analysis (file:line diagnostics), capabilities
motif-kit pack my-kit --out dist       # writes dist/my-kit-0.1.0.motifkit
motif-kit migrate my-kit               # rewrite a motif-kit@1 manifest as motif-kit@2 (same result as the app)
motif-kit bench my-kit                 # headless benchmark through the app (tools/bench.mjs), vs. declared cost
motif-kit prelude [--v4]               # prints the GLSL prelude and runtime declarations (--v4: with the motif-kit@4 additions)
motif-kit new my-kit --example stack   # start from a motif-kit@4 reference: stack, vector or sequence
motif-kit seq my-kit --steps 16        # validate sequences and print which cues play when
```

Setup: `npm i` in this folder. For `preview` and `bench`, also run `npm i -D playwright && npx playwright install chromium`, or point `MOTIF_CHROMIUM` at an existing Chromium. `bench` runs the app's harness (`tools/bench.mjs`, or `--harness <path>`) against `Motif.html` (or `--app <path>`). On software GL it reports numbers but does not judge them.

**New in 4.0** ([motif-kit@4](docs/kit-format-4.md), `"format": "motif-kit@4"`, Motif 8):

- **Vector graphics and typography.** An SDF shape library in GLSL (`sdNgon`, `sdStar`, `sdBezier`, `vpaint`, ...), **svg inputs** (a vector file bundled in the kit, baked to a distance field, `vec_<id>(uv)`) and **distance fields for text inputs** (`"sdf": true`, `textDist_<id>(i, q)`): outlines, glows and echoes that stay exact at any scale. New capability `vector`.
- **Layer stacks.** `"stack": { "layers": 3 }`: up to three images or clips inside one shader, each with a blend mode (12), opacity, offset, scale, rotation, edge mode and its own motion; `L_stack(base, uv)`.
- **Speed and direction.** Whole cycles per loop and forward / backward / ping-pong / random on every layer and svg, loop-exact, with video layers seeked by the same playhead.
- **Sequences.** `motif-seq@1` cue lists that call styles from the library at points of the loop (lanes, fades, blends, repeats, chance; at most 4 shaders at once), played by the app's **Sequencer** layer and shipped in kits.
- Reference kits `examples/stack-lab`, `examples/vector-type`, `examples/sequence-demo`; `motif-kit seq`; `preview` renders svg and distance fields, per-layer test cards, a motion-seam test in all four play modes and every sequence.

**New in 3.0** ([Text inputs](docs/text-inputs.md)): a `text` input type for up to three separately editable lines that Motif rasterizes into **one** glyph atlas (`u_<id>`, `textLine_<id>(i, q)`), plus the `text` capability. Users edit text, font family (installed, typed or imported), weight, size, tracking and alignment per line in the inspector; strings never reach GLSL and a kit never asks for a PNG. Reference kit: `examples/type-lines`. `motif-kit@1` and `@2` kits are read exactly as before.

**New in 2.0** ([Kit format 2](docs/kit-format-2.md)):

- Effects ([docs](docs/effects.md)) and transitions ([docs](docs/transitions.md))
- Pass graphs with named buffers and bounded ping-pong feedback
- Declarative export presets
- A capability manifest (`media`, `audio`, `feedback`) that users approve at install
- The [sandbox](docs/sandbox.md): static GLSL analysis, a background compile budget, a first-frame canary and quarantine

`motif-kit@1` kits keep working unchanged ([versioning, compatibility and deprecation](docs/versioning.md)). The reference kit is `examples/lumen-fx`. JSON Schemas: `schemas/motif-kit-4.schema.json` (current), `schemas/motif-kit-3.schema.json`, `schemas/motif-kit-2.schema.json` (@1/@2 only) and `schemas/motif-project.schema.json`.

**1.2:** custom parameters ([Parameters](docs/parameters.md)). **1.1:** media inputs.

## Package layout

```
my-kit/
  manifest.json          required
  common.glsl            optional; shared helpers compiled into every pass of every style
  styles/*.glsl          one file per pass
  README.md              optional
```

A `.motifkit` file is a zip of this folder with `manifest.json` at the root. The app also accepts a zip with the folder inside it, or a JSON bundle shaped `{ "manifest": {…}, "files": { "path": "text" } }`.

## manifest.json

| Field | Rules |
| --- | --- |
| `format` | `"motif-kit@4"` for stacks, svg inputs, text distance fields and sequences ([motif-kit@4](docs/kit-format-4.md)); `"motif-kit@3"` for text inputs; `"motif-kit@2"` (or `"motif-kit@1"`, read unchanged). `capabilities`, `effects`, `transitions`, `exporters` and `graph` are @2 only: see [Kit format 2](docs/kit-format-2.md). |
| `id` | 2–32 characters: lowercase letters, digits and hyphens, starting with a letter. Unique per install. `core`, `motif`, `builtin` and `all` are reserved. Installing a kit with an id that is already installed updates it. |
| `name`, `version` | Display name (up to 32 characters) and a semver version such as `1.2.0` |
| `author`, `description`, `license`, `accent` | Optional. `accent` is a `#RRGGBB` colour used for the kit's chip and badges. |
| `common` | Optional path to shared GLSL |
| `inputs[]` | Optional, SDK 1.1. Media inputs every style inherits unless it declares its own. See [Media inputs](#media-inputs). `motif-kit@3` adds `"type": "text"`: see [Text inputs](docs/text-inputs.md). |
| `palettes[]` | Up to 8 palettes: `{ id, name, bg, ink, a: [3 accents] }`, all `#RRGGBB`. They become `<kit>.<id>` in the palette picker. |
| `styles[]` | Up to 40 styles (see below). A @2 kit may have none if it ships effects, transitions or exporters. |

### Styles

| Field | Rules |
| --- | --- |
| `id`, `name` | Same id rules as the kit. The app id is `<kit>/<style>`, so presets refer to `neuro/mitosis`. |
| `group`, `tags[]`, `blurb` | Shown in the library and matched by search |
| `palette` | Optional id of one of the kit's palettes. It is applied when a layer switches into this kit from another. |
| `flash` | Set this to `true` if the style can flash or strobe. It marks the style ⚡ in the library. |
| `passes[]` | 1–4 passes: `{ "src": "styles/x.glsl", "scale": 0.5 }`. `scale` (0.125–1) sets the render size of an intermediate pass; the last pass always renders at full size. Pass *n* can sample earlier passes as `u_buf0` … `u_buf3`. |
| `inputs[]` | Optional, SDK 1.1. Overrides the kit-level list; `[]` opts the style out. |
| `params` | Up to 32 parameters (SDK 1.2; was 16). Use 4 or more, or Mutate and Evolve have little to work with. |

### Parameters

The keys are camelCase (`glowAmount`). `palette`, `invert`, `tempo`, `phase`, `seed`, `zoom`, `rotate` and `loop` are reserved, because every layer already has them.

| type | JSON | Uniform in GLSL |
| --- | --- | --- |
| `range` | `{ "type": "range", "label": "Glow", "min": 0, "max": 2, "def": 1, "step": 0.01, "unit": "×", "mutate": 1 }` | `uniform float p_glow;` |
| `int` | `{ "type": "int", "label": "Rings", "min": 1, "max": 12, "def": 5 }` | `uniform int p_rings;` |
| `toggle` | `{ "type": "toggle", "label": "Trails", "def": true }` | `uniform bool p_trails;` |
| `select` | `{ "type": "select", "label": "Mode", "options": ["rings", "dots"], "def": "rings" }` | `uniform int p_mode;` plus `#define MODE_RINGS 0` and `#define MODE_DOTS 1` |

| `color` | `{ "type": "color", "label": "Tint", "def": "#F0A23B" }` | Three float uniforms `p_tintR/G/B` (sRGB 0–1) and helpers `vec3 c_tint()` (linear RGB, matches the palette uniforms) and `vec3 s_tint()` (sRGB) |
| `point` | `{ "type": "point", "label": "Origin", "min": -0.5, "max": 0.5, "def": [0, 0] }` | Two float uniforms `p_originX/Y` and the helper `vec2 v_origin()`. The inspector shows an XY pad; `min`/`max` default to −1…1 and use the same units as `motif()`'s `uv` |

Colour and point params are compound: Motif stores them as ordinary scalar channels (`tintR`, `tintG`, `tintB`, `originX`, `originY`), so every channel can be keyframed, locked, mutated, mapped to audio and saved in presets with no extra work. The key button on the row keys all channels together. A colour counts as one param toward the 32 limit; the total number of uniforms after expansion is capped at 48.

`mutate` (0–1) sets how strongly Mutate and Evolve move a parameter; `0` locks it. For a select option you can use `{ "v": "white-hot", "l": "White hot" }`, and its define becomes `MODE_WHITE_HOT`. A camelCase key becomes snake case in the define (`rungMode` → `RUNG_MODE_BASES`). Every parameter can be keyframed and mapped to audio bands in the app with no extra work.


### Grouping, hints and conditional controls (SDK 1.2)

Every parameter type accepts these optional fields:

| field | effect |
| --- | --- |
| `group` | A section name (max 20 characters). Params with the same group share a collapsible section in the inspector, in the order first declared. Params without one stay in the main Style section. |
| `hint` | A tooltip (max 90 characters) shown on the label. |
| `show` | Shows the control only while another control has a given value: `{ "param": "mode", "is": "ripple" }`, `"is": ["a", "b"]`, `{ "param": "mode", "not": "grid" }`, `{ "param": "count", "gt": 3 }`, `{ "param": "glowOn", "is": true }`. It can read a range, int, toggle or select of the same style. Hidden controls keep their values and still reach the shader, so branch in GLSL on the same condition. |
| `log` | `range` only, needs `min > 0`. The slider is logarithmic, which gives fine control near zero. |
| `randMax` | `range`/`int` only. Caps how high Randomize and Evolve reach, while the slider still goes to `max`. |

The reference kit in `examples/param-lab` uses every one of these: `motif-kit preview examples/param-lab`, or pack it and drop it into Motif.

## Writing a pass

Each pass defines exactly one entry point. The runtime supplies `main()`.

```glsl
vec4 motif(vec2 uv, vec2 fc) {
  // uv: centred coordinates, the short side of the frame spans -0.5..0.5
  // fc: pixel coordinates (gl_FragCoord.xy)
  return emit(aces(col));   // premultiplied linear RGBA
}
```

- **Output:** premultiplied, linear-light RGBA. The runtime converts it to sRGB, dithers it and keeps alpha consistent. Content with alpha 0 lets the palette background and lower layers show through, which is how kit styles blend with other layers. Use `emit(c)` for glowing content, `solid(c, a)` for opaque shapes, and return `vec4(col, 1.0)` for a full-frame scene.
- **Inputs:** `u_res`, `u_p` (loop phase 0–1, with tempo and phase already applied), `u_L` (effective loop length in seconds), `u_seed`, `u_safe`, palette `u_bg u_ink u_a0 u_a1 u_a2` (linear RGB), and `u_buf0..3` (earlier passes).

### The loop rule

Time enters only through `u_p`, and every periodic function of it needs an integer frequency. Follow that and frame 0 equals the frame at the loop length exactly, so every loop is seamless and every frame renders deterministically on its own (for exports, scrubbing and Evolve). Passes cannot keep state between frames. Build simulations as closed-form functions of `u_p`: travelling waves, orbits, noise that loops, or growth envelopes.

| Helper | What it gives you |
| --- | --- |
| `lc(k, ph)`, `lsin(k, ph)`, `lsaw(k, ph)` | Circle, sine and saw at *k* cycles per loop |
| `pulse(s, k, ph, w)` | A pulse train travelling along coordinate *s*, *k* pulses per loop |
| `growEnv(hold)` | An envelope that rises 0 → 1, holds, and falls back to 0 over the loop |
| `ln2(x, k, r)`, `ln3(x, k, r)` | Simplex noise that loops *k* times per loop (*r* sets how far it travels) |
| `lfbm`, `lfbm3`, `lridge` | Looping fBm and ridged fBm |
| `lvoro(x, jitter, k, amp)` | Voronoi whose sites orbit their cells; returns `(F1, F2, id)` |
| `snoise(vec3)`, `snoise(vec4)` | Raw simplex noise |
| `h11 h21 h22 h33` | Hashes, seeded by the layer seed |
| `rot sat remap smin smax luma` | Maths |
| `sdSeg sdBox sdBox3 sdTorus line aa glowd glow2 gauss1` | Shapes, anti-aliasing and glows |
| `ramp(t) accent(i) hot(t) bb(kelvin) aces(c)` | Palette ramps, blackbody colour and tone mapping |
| `emit solid over addc` | Premultiplied compositing |
| `tslot(n) tfrac(n) strobe(k, duty) safeCycles(k) flashAmt(x)` | Flicker and flashing that the limiter controls (see below) |
| `M_asp() buf(sampler, fc)` | Frame extent in uv units; sample an earlier pass by pixel |

## Media inputs

SDK 1.1 lets a style process the user's own image or video. Declare up to two inputs, at kit level (inherited by every style) or per style:

```json
"inputs": [
  { "id": "source", "type": "media", "label": "Source", "fit": "fill", "hint": "Photo or clip to treat." }
]
```

| Field | Rules |
| --- | --- |
| `id` | camelCase, up to 16 characters. Becomes the uniform name `u_<id>`. Not `res`, `p`, `seed`, `bg`, `ink`, `a0`–`a2`, `buf0`–`buf3`. |
| `type` | `image`, `video` or `media` (either). Restricts what the file picker accepts. |
| `label`, `hint` | Shown in Motif's Layer › Media panel. |
| `fit` | Default fit: `fill` (cover, crop edges), `fit` (contain, transparent letterbox) or `stretch`. The user can change it per layer. |
| `required` | Reserved; styles must still render without media (library thumbnails never have any). |

### In GLSL

For every input the runtime declares and sets:

| Name | Type | Meaning |
| --- | --- | --- |
| `u_<id>` | `sampler2D` | The media, premultiplied **linear** RGBA, already fitted to the frame's aspect ratio |
| `u_<id>On` | `float` | `1.0` when media is attached, else `0.0` (the sampler then reads transparent black) |
| `u_<id>Size` | `vec2` | The media's own pixel size |
| `u_<id>Time` | `float` | Video time in seconds (0 for images) |
| `m_<id>(q)` | `vec4` | Sample at frame-normalized `q = fc / u_res` (0–1, origin bottom-left), clamped |
| `m_<id>UV(uv)` | `vec4` | Sample at the centred `uv` that `motif()` receives |
| `m_<id>Px(fc)` | `vec4` | Sample at pixel coordinates |

Because the host bakes fit into the texture, `m_source(fc / u_res)` is always undistorted, whatever the media's and the frame's aspect. Displace by offsetting `q`:

```glsl
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec2 d = vec2(ln2(uv * 3.0, 1.0, 0.5), ln2(uv * 3.0 + 9.1, 1.0, 0.5)) * 0.03;
  vec4 src = m_source(q + d);
  vec3 fallback = mix(u_bg, u_a0, 0.5);                 // what plays with no media
  return vec4(mix(fallback, src.rgb + u_bg * (1.0 - src.a), u_sourceOn), 1.0);
}
```

Rules:

- **Always handle `u_<id>On == 0`.** Library thumbnails, the SDK preview without `--media`, and layers without a file render with no media. Mix toward a procedural fallback (as `liquid-lens` and Kinetic Subdivision do) so the style is never blank.
- **Composite transparency yourself.** PNGs with alpha and `fit` letterbox bars sample as alpha 0; `src.rgb + u_bg * (1.0 - src.a)` puts them on the palette background.
- **Video timing is the host's job.** Motif maps project time to video time (Fit to loop retimes the clip to exactly one loop; Real time plays at 1× and wraps). Frames stay deterministic: export seeks the video for every frame. Keep motion driven by `u_p` as usual.
- Any pass can sample the input; a common layout is pass 1 = procedural fallback at `scale: 0.5`, final pass = treatment reading both.
- Kits written for SDK 1.0 that declared `uniform sampler2D u_source;` themselves still work: the input is detected, the declaration is replaced, and when no media is attached the sampler falls back to `u_buf0` as before. `validate` warns so you can add `inputs` explicitly.

### Preview with media

```
motif-kit preview my-kit --media photo.jpg     # png, jpg, webp or gif; use a still from a video
motif-kit preview my-kit                       # styles with inputs get a built-in test card
```

Each media style reports `Δ`, the mean pixel change between rendering with and without media. A style whose Δ is below 0.5 is flagged `ignores media?`.

### In Motif

Styles with inputs are marked **MEDIA** in the library. Drop an image or video on the stage (or use Layer › Media) to attach it to the selected layer. Files are stored by content hash in the browser (IndexedDB) and never uploaded. Projects, autosave and saved looks keep a reference, so a project opened in another browser shows **Relink** until the file is attached there too.

## Photosensitive limiter

The **Photosensitive-safe limiter** in the Kits tab is on by default. With it on, `tslot`, `tfrac`, `strobe` and `safeCycles` cap the rate of change at 3 per second, based on the effective loop length. When even one change per loop would be too fast, the rate drops to 0 and the effect holds still. `flashAmt` also scales down full-frame flashes.

Route every glitch, flicker, strobe and flash through these helpers, and set `"flash": true` on styles that use them. The app's test suite renders every kit style at the worst case (a 1 s loop at 4× tempo) and counts flashes against WCAG 2.3.1 on a 4×4 grid of screen tiles. Every bundled style stays at 3 or fewer in any second.

## Validation

Before a kit installs, the app and `motif-kit validate` check the manifest (format, ids, semver, colours, limits, parameter types and ranges, `show` conditions, media inputs, capabilities, pass graphs, exporter presets). They also run static analysis on every pass: unbounded loops, iteration and texture-fetch budgets per pixel, recursion, huge arrays, macro bombs, and extension and pragma allowlists. Problems come back as `file:line` diagnostics. See [Sandbox](docs/sandbox.md) for every rule, every limit and the limits of the approach.

The app then compiles every pass in the background and renders small test frames. A compile error rejects the kit and reports the entry, the file and the line within that file. An entry that is valid but pathologically slow installs **quarantined**: it draws a placeholder until the user retries. A kit that fails leaves any installed version untouched. Every install keeps the previous version for one-step **rollback** from the Kits panel.

## Performance notes

- Keep loops bounded by constants (`for (int i = 0; i < 12; i++) { if (i >= p_n) break; … }`) or by an int param with a sensible `max`. The sandbox rejects loops it cannot bound.
- Cull early: skip work when the pixel is far from an object (see `neuro/neural-arbor`).
- Put expensive scenes in a pass with `"scale": 0.5` and add a cheap full-resolution post pass for bloom and grain (see `quantum/event-horizon` and `neuro/organoid`).
- Raymarchers: expose a quality parameter that sets the step count.
- Smooth layers (haze, fog, glow, fbm backdrops) belong in a `"scale": 0.5` pass that the final pass reads with `texture(u_buf0, fc / u_res)`. Calcium Wave does this for its haze with no visible change.
- With media inputs, skip work the media makes redundant: `if (u_sourceOn * p_mix > 0.999) return …;` (uniform branches are free), as Kinetic Subdivision does for its fallback pass.
- `motif-kit preview` frame times are queue times, not GPU times, and are only useful for comparing runs on the same machine. In Motif, Deliver › Check speed times real export-size frames per layer.

## Examples

`examples/stack-lab` (layer stacks), `examples/vector-type` (shapes, an svg mark, distance-field type) and `examples/sequence-demo` (six small styles and two sequences) are the motif-kit@4 references; all three are also bundled in Motif 8 (Kits).

The bundled kits (neuro, quantum, cyberpunk, kinetic-subdivision) are full-size references: 64 styles between them, including multi-pass post effects, raymarchers, analytical physics, limiter-aware glitch effects and media treatments (`kinetic-subdivision`). The template's `liquid-lens` is the minimal media example, `examples/param-lab` shows every custom-parameter feature, and `examples/type-lines` is the minimal three-line text-input kit (FaceType 1.3.0 in `kits/source/facetype` is the full one).
