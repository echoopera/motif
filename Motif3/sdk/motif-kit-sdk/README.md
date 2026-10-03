# Motif Kit SDK 1.2.5 (`motif-kit@1`)

A kit is a set of shader styles packaged as a single `.motifkit` file. When you drop one on Motif 3.2, its styles show up in the library alongside the 25 built-ins and work the same way: layers, blend modes and masks, keyframes on any parameter, Mutate, Evolve, Randomize, audio-band mapping, the finishing stack, and every export format.

The app is one build. A kit is data (a manifest plus GLSL) that is checked, test-compiled and registered when it is loaded.

```
motif-kit new my-kit --id my-kit       # copy the starter template (3 example styles, one with a media input)
motif-kit preview my-kit               # contact sheet + compile errors, loop seam, blank-frame check, timing
motif-kit preview my-kit --media a.jpg # feed an image to styles with media inputs
motif-kit validate my-kit              # schema and static checks
motif-kit pack my-kit --out dist       # writes dist/my-kit-0.1.0.motifkit
motif-kit prelude                      # prints the GLSL prelude every pass is compiled with
motif-kit new my-kit --example stack   # start from a 1.2.5 reference: stack, vector or sequence
motif-kit seq my-kit                   # validate sequences and print which cues play when
npm test                               # SDK test suite (validator, playhead, sequencer, shader/JS parity)
```

Setup: `npm i` in this folder. For `preview`, also run `npm i -D playwright && npx playwright install chromium`, or point `MOTIF_CHROMIUM` at an existing Chromium.

**New in 1.2.5:** four things, all opt-in with `"sdk": "1.2.5"` in the manifest. Kits without it compile byte-for-byte as before.

| | |
| --- | --- |
| [Vector graphics and typography](#vector-graphics-and-typography) | SDF shape library in GLSL, plus `svg` and `text` inputs the host bakes to distance fields: crisp at any scale, outline/glow/echo for free, bundled fonts |
| [Layer stacks](#layer-stacks) | `"stack": { "layers": 3 }`: up to three images or clips inside one shader, each with a blend mode, opacity, offset, scale, rotation and its own motion |
| [Speed and direction](#speed-and-direction) | Per-layer cycles per loop and forward / backward / ping-pong / random, loop-exact, with a JS twin so the host can drive video the same way |
| [Sequencer](#sequencer) | `motif-seq@1`: cues that invoke styles from a library at points of the loop, past the 4-layer limit, with fades, blends and a hard cap on simultaneous shaders |

**New in 1.2:** custom parameters. Up to 32 per style, colour pickers, XY pads, grouped sections, hints, controls that show only when another control has a given value, and log sliders. See [Parameters](#parameters). Existing kits are unchanged.

**New in 1.1:** media inputs. A style can declare an image or video input; the user attaches a file to the layer in Motif and the shader samples it. See [Media inputs](#media-inputs). Kits without `inputs` are unchanged.

## Vector graphics and typography

Two layers, so a kit can use whichever fits.

### Shapes in GLSL (no host support needed)

Every function returns a **signed distance in uv units** (negative inside). Combine distances, then paint once.

| Helper | |
| --- | --- |
| `sdCircle sdRoundBox sdRing(p, r, w) sdNgon(p, r, n) sdTriangle sdStar(p, r, n, m) sdArc sdBezier(p, A, B, C)` | Primitives. `sdBezier` is unsigned: stroke it with `d - w/2`. `sdSeg`, `sdBox` already exist |
| `opUnion opSub opInter opRound opOnion smin smax` | Combine, round, hollow out |
| `vfill(d)`, `vstroke(d, w)`, `vglow(d, w)` | Anti-aliased (1.5 px) coverage, outline and glow |
| `vpaint(d, fill, line, lineW, glowColour, glowW)` | Fill + outline + glow in one call, premultiplied linear |

```glsl
float d = opSub(sdRoundBox(uv, vec2(0.3, 0.12), 0.04), sdCircle(uv, 0.08));
return vpaint(d, u_a0, u_ink, 0.008, u_a1, 0.05);
```

### SVG and text inputs

Declare them in `inputs` (kit-level or per style). The host bakes each into a distance-field texture; the shader reads it with `vec_<id>(uv)`.

```json
"inputs": [
  { "id": "mark",  "type": "svg",  "src": "assets/mark.svg", "margin": 0.12 },
  { "id": "title", "type": "text", "def": "MOTIF", "font": "sans", "size": 0.16, "weight": 800 }
]
```

| Field | Rules |
| --- | --- |
| `id` | camelCase, up to 16 characters. At most 2 svg and 2 text inputs per style |
| `svg.src` | Optional default file in the kit (up to 64 KB). The user can replace it with their own `.svg`. Supported: `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `g`, `transform`, `fill`, `stroke`, `fill-rule="evenodd"` (use it for holes). Colours are ignored (a shape is a mask). `<text>`, `<use>`, gradients, masks, filters, scripts and external references are not allowed or ignored |
| `svg.margin` | 0–0.4, fraction of the frame kept clear (default 0.08) |
| `text.def`, `size`, `weight`, `font` | Default string (up to 120 characters, `\\n` breaks lines), cap height as a fraction of frame height, weight 100–900, and `sans`, `serif`, `mono`, `rounded` or the id of a bundled font |
| `spread` | 8–64 px of distance stored around the edge (default 24). Raise it for wide glows |
| `controls` | `false` to skip the generated controls and drive everything yourself |

In GLSL, for input `title`:

| Name | Meaning |
| --- | --- |
| `vec_title(uv)` | Signed distance in uv units with the Title section's offset, scale, rotation, speed and direction applied. `1e3` when empty |
| `vecA_title(uv)` | `vfill(vec_title(uv)) * opacity` |
| `u_titleOn`, `u_titleSpread`, `u_titleSize` | Attached flag, stored spread in uv units, baked size |
| `m_title(q)` | The raw texture (`.r` = distance encoded as `0.5 + d / (2 * spread)`, `.g` = coverage) |

Outlines, echoes, glows and masks are all distance arithmetic, so they stay exact when you scale type up 10×:

```glsl
float d = vec_title(uv);
c = over(vpaint(d, u_ink, u_a2, 0.006, u_a0, 0.04), c);
c = over(solid(u_a1, vstroke(vec_title(uv - vec2(0.03, -0.02)), 0.004)), c);   // an echo
```

**Generated controls** (not counted against the 32-param limit): for text, `Text`, `Font`, `Size`, `Weight`, `Tracking`, `Line height`, `Align`; for svg, `Margin`; for both, `Opacity`, `Offset`, `Scale`, `Rotate`, `Cycles / loop`, `Direction`, `Travel`. The ones that change the baked texture are marked `bake: true`: the host rebakes when they change and does not keyframe them (animate with Scale, Offset and Rotate instead).

**Bundled fonts** make type identical on every machine. Add up to 2 (woff2, woff, ttf or otf, 1.5 MB each, subset them) and name them in the manifest; use fonts whose licence allows embedding.

```json
"fonts": [{ "id": "display", "file": "fonts/Display-Bold.woff2", "weight": 700, "license": "OFL" }]
```

Without bundled fonts, `sans`/`serif`/`mono`/`rounded` resolve to the system's fonts, so glyph shapes differ between machines and exports are not byte-identical across them.

## Layer stacks

```json
"stack": { "layers": 3, "labels": ["Back", "Middle", "Front"], "fit": "fill",
           "defaults": [{ "blend": "normal" }, { "blend": "screen" }, { "blend": "overlay" }] }
```

The runtime adds inputs `layer1`…`layer3` and a block of controls for each (generated, so no limit cost): **Opacity**, **Blend** (normal, multiply, screen, overlay, soft light, hard light, add, darken, lighten, difference, exclusion, colour dodge), **Offset** (XY pad), **Scale**, **Rotate**, **Edges** (clip, repeat, mirror, extend), **Cycles / loop**, **Direction**, **Travel**. Every control is an ordinary channel: keyframes, locks, Mutate, audio mapping and presets work.

| GLSL | |
| --- | --- |
| `L_stack(base, uv)` | Composite all layers over `base` (layer 3 on top), each with its own blend and opacity |
| `L_over(uv)` | The stack over transparent |
| `L_get1(uv)`…, `L_get(i, uv)` | One transformed layer, premultiplied linear, transparent when nothing is attached |
| `L_opacity(i)`, `u_layer1On` | Control values for custom treatment |
| `blendOver(mode, base, src, opacity)`, `BM_*` | The blend used internally, for your own compositing |

Blend maths follows the W3C compositing spec on display-referred colour (so Overlay and Soft light look like they do elsewhere); Add works in linear light. A layer with nothing attached is transparent, so always give the style a procedural base. See `examples/stack-lab`.

## Speed and direction

Every generated block (layer, svg, text) has **Cycles / loop** (a whole number, 0 holds still) and **Direction**:

| Direction | Playhead (cycles) |
| --- | --- |
| Forward / Backward | `±k·phase`. With Travel in whole tiles the image scrolls and wraps, so the loop closes |
| Ping-pong | `0 → 1 → 0`, `k` round trips per loop |
| Random | Like ping-pong, but each round trip goes out the forward or the backward way, chosen by a seeded hash |

Because every kind returns to where it started (or advances by whole tiles), the loop always closes. Forward and backward travel snaps to whole tiles; ping-pong and random use any distance.

For your own motion: `M_playhead(k, mode, salt)`, `M_playheadAt(phase, k, mode, salt)`, `M_clip(pos)`, with `PM_FORWARD`/`PM_BACKWARD`/`PM_PINGPONG`/`PM_RANDOM`. The JS twin `KG.playhead(k, mode, salt, phase, seed)` returns the same value (tested against the shader), and `KG.stackPlayheads(style, params, p, seed)` gives each layer's clip position, so the host seeks a video layer to `clipPos * duration` and forwards, backwards and random playback stay frame-exact on export.

**Why whole cycles?** A loop is only seamless if time enters as a periodic function with integer frequency. A free fractional speed would break the seam, so speed is "cycles per loop" and slower motion comes from a longer loop or lower tempo.

## Sequencer

A sequence is a list of **cues**. Each cue invokes a style from the user's library for part of the loop, then ends. Layers are cheap to describe and expensive to run, so the sequencer lets a clip use dozens of styles while never running more than `maxActive` (default and maximum 4) at once. Build it in the app's Sequencer layer, or ship ready-made ones in a kit.

```json
{ "format": "motif-seq@1", "id": "showcase", "name": "Showcase", "loop": 12, "bpm": 120, "maxActive": 3,
  "cues": [
    { "id": "bed",   "style": "swirl", "at": 0,    "len": "6s", "lane": 0, "cycles": 1 },
    { "id": "rings", "style": "rings", "at": "1s", "len": "3s", "lane": 1, "cycles": 2, "blend": "screen" },
    { "id": "scan",  "style": "scan",  "at": "2s", "len": "1.5s", "lane": 2, "repeat": { "every": "5s", "count": 2 } }
  ] }
```

| Cue field | Rules |
| --- | --- |
| `style` | `"kit/style"`, or a style id from the same kit |
| `at`, `len` | A fraction of the loop, or `"3/16"`, `"25%"`, `"1.5s"`, `"2b"` (seconds and beats use the sequence's `loop` and `bpm`). A cue past the end wraps to the start |
| `lane` | 0–7. Higher lanes draw on top |
| `cycles` | Whole number 1–8. The style loops this many times during the cue, so it closes on itself |
| `dir` | `forward`, `backward`, `pingpong`, `random` (the same playhead as above) |
| `fadeIn`, `fadeOut` | 0–0.5 of the cue (default 0.1). Cues start and end invisible, so there are no pops |
| `blend`, `opacity` | Blend mode (as for layers) and 0–1 |
| `params`, `palette`, `seed` | Overrides for the style's controls, palette and seed |
| `chance` | 0–1. Whether the cue plays is decided by the seed, so a render is still deterministic. Evolve and Randomize can vary it |
| `repeat` | `{ "every": time, "count": 2–16 }` expands to several cues |
| `mute` | Skip the cue |

Rules checked on validate: at most 64 cues, 8 lanes, `maxActive` overlapping at any point of the loop, known style ids, and sequences list gaps where nothing plays.

In code: `KG.planSequence(seq, phase, { L, seed })` returns the active cues with their inner phase, the loop length to give the photosensitive limiter, and fade alpha. `KG.createSequencer(rt, resolve)` renders a plan: it calls `resolve(styleRef, cue)` for `{ key, def, spec, defaults, media }`, draws each active cue with the GL runtime and composites it with its blend mode. `warm(seq)` starts compiling every style the sequence uses so cues never stall. `motif-kit seq` prints a plan and `motif-kit preview` renders each sequence and loop-tests it.

Kits list sequences in the manifest (`"sequences": [{ "id": "showcase", "file": "sequences/showcase.json" }]`, up to 8) and the app shows them as library items. A sequence may call styles from other kits; the kit's `requires` list names them.

**In-shader cues.** To sequence inside a single style, `cueP(at, len)` returns the local phase of a window (or -1) and `cueEnv(at, len, fadeIn, fadeOut)` the envelope.

**Photosensitive safety.** A cue's inner loop is shorter than the sequence's loop, and ping-pong and random move twice as fast. The planner hands the style the true inner loop length (`innerL`), so `tslot`, `strobe` and the limiter see the real rate.

## Host integration (for the Motif app)

`docs/HOST-INTEGRATION-1.2.5.md` in the Motif repository lists what the host does: pass `sdk` to `compile`, bake svg and text inputs with `createInputBaker`, drive video layers from `stackPlayheads`, render sequences with `createSequencer`, and show generated blocks and the Sequencer layer in the UI.

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
| `sdk` | Minimum SDK the kit needs, e.g. `"1.2.5"`. Required for layer stacks, svg/text inputs, fonts and sequences. Kits without it get the 1.2.0 prelude exactly |
| `inputs[]` | Optional, SDK 1.1. Media inputs every style inherits unless it declares its own (1.2.5: also `svg` and `text`). See [Media inputs](#media-inputs) |
| `fonts[]` | Optional, 1.2.5. Up to 2 bundled fonts for text inputs |
| `sequences[]` | Optional, 1.2.5. Up to 8 `motif-seq@1` sequences, inline or `{ id, file }` |
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
| `stack` | Optional, 1.2.5. `{ layers: 1–3, id, labels, fit, defaults }`. See [Layer stacks](#layer-stacks) |
| `params` | Up to 32 declared parameters (SDK 1.2; was 16). Generated block controls (1.2.5) are extra, and up to 128 uniforms in total. Use 4 or more, or Mutate and Evolve have little to work with. |

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
- SDK 1.2.5: `sdk` is declared when 1.2.5 features are used and is not newer than the runtime; generated controls do not clash with yours; svg files are safe (no script, image, foreignObject or external reference); fonts exist and look like fonts; at most 9 textures per style; sequences are valid, reference known styles and never exceed `maxActive`
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
