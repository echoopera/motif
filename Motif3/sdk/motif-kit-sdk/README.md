# Motif Kit SDK 1.2 (`motif-kit@1`)

A kit is a set of shader styles packaged as a single `.motifkit` file. When you drop one on Motif 3.2, its styles show up in the library alongside the 25 built-ins and work the same way: layers, blend modes and masks, keyframes on any parameter, Mutate, Evolve, Randomize, audio-band mapping, the finishing stack, and every export format.

The app is one build. A kit is data (a manifest plus GLSL) that is checked, test-compiled and registered when it is loaded.

```
motif-kit new my-kit --id my-kit       # copy the starter template (3 example styles, one with a media input)
motif-kit preview my-kit               # contact sheet + compile errors, loop seam, blank-frame check, timing
motif-kit preview my-kit --media a.jpg # feed an image to styles with media inputs
motif-kit validate my-kit              # schema and static checks
motif-kit pack my-kit --out dist       # writes dist/my-kit-0.1.0.motifkit
motif-kit prelude                      # prints the GLSL prelude every pass is compiled with
```

Setup: `npm i` in this folder. For `preview`, also run `npm i -D playwright && npx playwright install chromium`, or point `MOTIF_CHROMIUM` at an existing Chromium.

**New in 1.2:** custom parameters. Up to 32 per style, colour pickers, XY pads, grouped sections, hints, controls that show only when another control has a given value, and log sliders. See [Parameters](#parameters). Existing kits are unchanged.

**New in 1.1:** media inputs. A style can declare an image or video input; the user attaches a file to the layer in Motif and the shader samples it. See [Media inputs](#media-inputs). Kits without `inputs` are unchanged.

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
| `format` | `"motif-kit@1"` |
| `id` | 2–32 characters: lowercase letters, digits and hyphens, starting with a letter. Unique per install. `core`, `motif`, `builtin` and `all` are reserved. Installing a kit with an id that is already installed updates it. |
| `name`, `version` | Display name (up to 32 characters) and a semver version such as `1.2.0` |
| `author`, `description`, `license`, `accent` | Optional. `accent` is a `#RRGGBB` colour used for the kit's chip and badges. |
| `common` | Optional path to shared GLSL |
| `inputs[]` | Optional, SDK 1.1. Media inputs every style inherits unless it declares its own. See [Media inputs](#media-inputs). |
| `palettes[]` | Up to 8 palettes: `{ id, name, bg, ink, a: [3 accents] }`, all `#RRGGBB`. They become `<kit>.<id>` in the palette picker. |
| `styles[]` | 1–40 styles (see below) |

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

Before a kit installs, the app and `motif-kit validate` check the following:

- Format, ids, semver, colours
- Unique style ids and the limits: 40 styles, 32 params (48 uniforms after colour/point expansion), 4 passes, 96 KB per GLSL file, 3 MB per kit
- Parameter types, ranges and defaults, and reserved names
- `show` conditions (SDK 1.2): the controlling param must exist in the same style and be a range, int, toggle or select
- Each pass defines `vec4 motif(vec2, vec2)` and does not define `main()`
- Media inputs (SDK 1.1): at most 2 per style, valid ids, type `image`/`video`/`media`, fit `fill`/`fit`/`stretch`

The app then compiles every pass. Any error rejects the kit and reports the style, the pass and the line number within that pass file. A kit that fails leaves any installed version untouched.

## Performance notes

- Keep loops bounded by constants (`for (int i = 0; i < 12; i++) { if (i >= p_n) break; … }`).
- Cull early: skip work when the pixel is far from an object (see `neuro/neural-arbor`).
- Put expensive scenes in a pass with `"scale": 0.5` and add a cheap full-resolution post pass for bloom and grain (see `quantum/event-horizon` and `neuro/organoid`).
- Raymarchers: expose a quality parameter that sets the step count.
- Smooth layers (haze, fog, glow, fbm backdrops) belong in a `"scale": 0.5` pass that the final pass reads with `texture(u_buf0, fc / u_res)`. Calcium Wave does this for its haze with no visible change.
- With media inputs, skip work the media makes redundant: `if (u_sourceOn * p_mix > 0.999) return …;` (uniform branches are free), as Kinetic Subdivision does for its fallback pass.
- `motif-kit preview` frame times are queue times, not GPU times, and are only useful for comparing runs on the same machine. In Motif, Deliver › Check speed times real export-size frames per layer.

## Examples

The bundled kits (neuro, quantum, cyberpunk, kinetic-subdivision) are full-size references: 64 styles between them, including multi-pass post effects, raymarchers, analytical physics, limiter-aware glitch effects and media treatments (`kinetic-subdivision`). The template's `liquid-lens` is the minimal media example, and `examples/param-lab` shows every custom-parameter feature.
