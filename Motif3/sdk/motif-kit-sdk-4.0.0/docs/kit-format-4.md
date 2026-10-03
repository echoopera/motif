# motif-kit@4

`motif-kit@4` is `motif-kit@3` plus four things. Everything is data and GLSL: a kit still never runs code, and kits written for `@1`, `@2` and `@3` read and render exactly as before.

| | |
| --- | --- |
| [Vector graphics](#vector-graphics) | An SDF shape library in GLSL, **svg inputs** (a vector file bundled in the kit) and **distance fields for text inputs** |
| [Layer stacks](#layer-stacks) | `"stack": { "layers": 3 }`: up to three images or clips inside one shader, each with a blend mode, opacity and independent motion |
| [Speed and direction](#speed-and-direction) | Per layer or svg, whole cycles per loop and forward / backward / ping-pong / random, loop-exact |
| [Sequences](#sequences) | `motif-seq@1`: cue lists that call styles from the library at points of the loop. The app's **Sequencer** layer plays them |

Set `"format": "motif-kit@4"`. The new GLSL names (blend modes, playhead, cues, shapes) are added only to `@4` styles, so an `@1` to `@3` kit that happens to define `sdCircle` or `blendOver` itself keeps compiling. Older apps reject the format string with a clear message; ship an `@3` build if you need them.

New capability: **`vector`** (svg inputs). Layer stacks use `media`, text distance fields use `text`, sequences need none.

## Vector graphics

### Shapes in GLSL

Every function returns a **signed distance in uv units** (negative inside). Combine distances, then paint once.

| Helper | |
| --- | --- |
| `sdCircle sdRoundBox sdRing(p, r, w) sdNgon(p, r, n) sdTriangle sdStar(p, r, n, m) sdArc sdBezier(p, A, B, C)` | Primitives. `sdBezier` is unsigned: stroke it with `d - w/2`. `sdSeg` and `sdBox` already exist |
| `opUnion opSub opInter opRound opOnion smin smax` | Combine, round, hollow out |
| `vfill(d)`, `vstroke(d, w)`, `vglow(d, w)` | Anti-aliased (1.5 px) coverage, outline and glow |
| `vpaint(d, fill, line, lineW, glowColour, glowW)` | Fill, outline and glow in one call, premultiplied linear |

```glsl
float d = opSub(sdRoundBox(uv, vec2(0.3, 0.12), 0.04), sdCircle(uv, 0.08));
return vpaint(d, u_a0, u_ink, 0.008, u_a1, 0.05);
```

### svg inputs

```json
"capabilities": ["vector"],
"inputs": [{ "id": "mark", "type": "svg", "src": "assets/mark.svg", "margin": 0.12, "spread": 24 }]
```

| Field | Rules |
| --- | --- |
| `id` | camelCase, up to 16 characters. Up to 2 svg inputs per style (and 2 media, 2 text) |
| `src` | Path of an `.svg` file in the kit, up to 64 KB. Supported: `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `g`, `transform`, `fill`, `stroke`, `fill-rule="evenodd"` (use it for holes). Colours are ignored: a shape is a mask. `<text>`, `<use>`, gradients, masks and filters are skipped; scripts, `<style>`, animation, `<image>`, `<foreignObject>`, event attributes and external references are rejected |
| `margin` | 0–0.4: fraction of the frame kept clear (default 0.08) |
| `spread` | 8–64 px of distance stored around the edge (default 24) |

The app parses the file as data (never renders it with the browser) and bakes it, at the frame's aspect and at most 1024 px high, into a distance texture. In GLSL:

| Name | Meaning |
| --- | --- |
| `vec_<id>(uv)` | Signed distance in uv units, with the input's offset, scale, rotation, speed and direction applied. `1e3` when the file could not be baked |
| `vecA_<id>(uv)` | `vfill(vec_<id>(uv)) * opacity` |
| `u_<id>On`, `u_<id>Spread`, `m_<id>(q)` | Baked flag, stored spread in uv units, the raw texture (`.r` = `0.5 + d / (2 * spread)`, `.g` = coverage) |

Generated controls (not counted against the 32-param limit): **Opacity, Offset, Scale, Rotate, Cycles / loop, Direction, Travel**. Distances are exact within `spread` of an edge and clamp beyond it, so keep glows narrower than the spread.

### Text distance fields

Add `"sdf": true` to a `motif-kit@3` style text input. The app already rasterizes the text into a glyph atlas; it now also builds a distance field of it (downsampled to at most 1024 px wide), and GLSL gets, next to `textLine_<id>(i, q)`:

```glsl
float textDist_title(int i, vec2 q);   // signed distance of line i at the same line-local q, in line units (a band is 1 wide)
```

Outlines, shadows, glows and echoes of live, editable type then stay exact at any scale: scale `q`, and multiply the returned distance by the same factor. `"sdfSpread"` (4–32, default 12) is the stored distance in pixels of the 1024-wide field; keep glows narrower than `spread / 1024` line units. The field costs one texture (up to 9 per style) and is rebuilt only when the text, a font or the atlas size changes. See `examples/vector-type` (`type-poster`).

## Layer stacks

```json
"capabilities": ["media"],
"styles": [{ "id": "image-stack", "stack": { "layers": 3, "labels": ["Back", "Middle", "Front"],
  "defaults": [{ "blend": "normal" }, { "blend": "screen" }, { "blend": "overlay" }] }, ... }]
```

The app adds inputs `layer1`…`layer3` (media inputs: the user drops images or clips on them in Layers > Media) and a block of controls for each, grouped as "Layer 1"…: **Opacity**, **Blend** (normal, multiply, screen, overlay, soft light, hard light, add, darken, lighten, difference, exclusion, colour dodge), **Offset** (XY pad), **Scale**, **Rotate**, **Edges** (clip, repeat, mirror, extend), **Cycles / loop**, **Direction**, **Travel**. Every control is an ordinary channel: keyframes, locks, Mutate, audio mapping and presets work.

| GLSL | |
| --- | --- |
| `L_stack(base, uv)` | Composite all layers over `base` (layer 3 on top), each with its own blend mode and opacity |
| `L_over(uv)` | The stack over transparent |
| `L_get1(uv)`…, `L_get(i, uv)` | One transformed layer, premultiplied linear (transparent when nothing is attached) |
| `L_opacity(i)`, `u_layer1On` | Control values, for your own treatment |
| `blendOver(mode, base, src, opacity)`, `BM_*` | The blend used internally |

Blends follow the W3C compositing formulas on display-referred colour (Overlay and Soft light look like they do elsewhere); Add works in linear light. A layer with nothing attached is transparent: always give the style a procedural base. `stack` options: `layers` 1–3, `id` (default `layer`), `fit` (fill, fit, stretch), `labels`, `defaults[].blend`. See `examples/stack-lab`.

**Video layers.** With Cycles / loop at 0 a clip plays on its own timing (Fit to loop or Real time). With 1 or more, the playhead below picks the clip position, so a video can play forward, backward, ping-pong or in random round trips, k times per loop, frame-exact in exports.

## Speed and direction

Every generated block (layer, svg) has **Cycles / loop** (a whole number; 0 holds still) and **Direction**:

| Direction | Playhead, in cycles |
| --- | --- |
| Forward, Backward | `±k·phase` (unbounded: wrap with `fract()` or scroll whole tiles) |
| Ping-pong | `0 → 1 → 0`, `k` round trips per loop |
| Random | Like ping-pong, but every round trip goes out the forward or the backward way, chosen by a seeded hash |

Each kind returns to where it started, or advances by whole tiles, so the loop always closes. Forward and backward **Travel** snaps to whole tiles (and repeats the image); ping-pong and random use any distance. Speed is a whole number because a loop is seamless only when time enters as a periodic function with integer frequency; slower motion comes from a longer loop or lower tempo.

For your own motion: `M_playhead(k, mode, salt)`, `M_playheadAt(phase, k, mode, salt)`, `M_clip(pos)` and `PM_FORWARD`/`PM_BACKWARD`/`PM_PINGPONG`/`PM_RANDOM`. `cueP(at, len)` and `cueEnv(at, len, fadeIn, fadeOut)` run something during part of the loop inside a single shader.

## Sequences

A sequence is a list of **cues**. Each cue invokes a style for part of the loop, then ends, so a clip can use dozens of looks while never running more than `maxActive` (at most 4) shaders at once. The app's **Sequencer** layer (library: Sequencer) holds one per layer; kits can ship ready-made ones.

```json
{ "format": "motif-seq@1", "id": "showcase", "name": "Showcase", "loop": 12, "bpm": 120, "maxActive": 3,
  "cues": [
    { "id": "bed",   "style": "swirl", "at": 0,    "len": "6s", "lane": 0 },
    { "id": "rings", "style": "rings", "at": "1s", "len": "3s", "lane": 1, "cycles": 2, "blend": "screen" },
    { "id": "scan",  "style": "scan",  "at": "2s", "len": "1.5s", "lane": 2, "repeat": { "every": "5s", "count": 2 } } ] }
```

In the manifest: `"sequences": [{ "id": "showcase", "file": "sequences/showcase.json" }]` (up to 8; or inline). They appear in the Sequencer layer's **Load a sequence** menu.

| Cue field | Rules |
| --- | --- |
| `style` | `"kit/style"`, or a style id from the same kit. Other kits' styles are used when installed; the kit's `requires` lists them |
| `at`, `len` | A fraction of the loop, or `"3/16"`, `"25%"`, `"1.5s"`, `"2b"` (seconds and beats use the sequence's `loop` and `bpm`). A cue past the end wraps |
| `lane` | 0–7. Higher lanes draw on top; the lowest active cue draws on the background like a base layer |
| `cycles` | Whole number 1–8: the style loops this many times during the cue, so it closes on itself |
| `dir` | `forward`, `backward`, `pingpong`, `random` (the playhead above) |
| `fadeIn`, `fadeOut` | 0–0.5 of the cue (default 0.1): cues start and end invisible, so nothing pops |
| `blend`, `opacity` | Blend mode and 0–1 |
| `params`, `palette`, `seed` | Overrides of the style's controls, palette id and seed (0: the layer's seed) |
| `chance` | 0–1. Whether the cue plays is decided by the seed, so a render stays deterministic |
| `repeat` | `{ "every": time, "count": 2–16 }` |
| `mute` | Skip the cue |

Checked on validate: at most 64 cues, 8 lanes, no point of the loop with more than `maxActive` cues, known style ids; gaps where nothing plays are warned about. Sequencer layers are rendered by the same code in the page and in the render Worker, so the preview, the render cache and exports agree.

**Photosensitive safety.** A cue's inner loop is shorter than the project loop (and ping-pong / random move twice as fast). The planner gives the style its true inner loop length (`u_L`), so `tslot`, `strobe` and the limiter see the real rate.

## Limits

| | |
| --- | --- |
| Inputs per style | 2 media, 2 svg, 2 text (earlier formats: 2 in total); stack layers are extra; at most 9 textures |
| Stack layers | 3 |
| Uniforms per style | 128 including generated controls (declared controls still 32, 48 uniforms) |
| svg file | 64 KB |
| Sequences | 8 per kit, 64 cues each, 8 lanes, 4 at once |

## Tools

```
motif-kit new my-kit --example stack|vector|sequence
motif-kit validate my-kit            # also checks sequences, svg safety, generated-control clashes
motif-kit seq my-kit --steps 16      # which cues play when
motif-kit preview my-kit             # renders svg and distance fields, per-layer test cards, a motion-seam test in all four
                                     # play modes, and every sequence (8 frames, loop-tested)
motif-kit prelude --v4               # the @4 GLSL additions
```
