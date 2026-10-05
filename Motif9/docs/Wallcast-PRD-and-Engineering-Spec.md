# Wallcast — PRD & Engineering Spec

Sep 29, 2026 · @Echo · Kit version 1.0.0 · Motif 3.2 · Motif Kit SDK 1.2

Wallcast is a Motif kit of ten image shaders for on-air commercial graphics, cyber-city screens and EDM video walls. You attach a still or a clip to a layer and the style treats it. Every style is loop-locked, reacts to audio through one mapping target, reads data through plain parameters, and stays inside the photosensitive limiter.

This document is both the product brief and the build spec. The kit it describes is built: `wallcast-1.0.0.motifkit` (17.7 KB), source in `Motif3/kits/source/wallcast/`.

## 1. Product overview

**Problem.** Broadcast, live-visual and signage teams start from stills: key art, product photography, hardware shots, poster art. They need those stills to move, stay on brand and stay legible at wall scale. Today that means After Effects plugin chains that do not run live, cannot be prompted, and do not loop on their own.

**Vision.** Drop an image, pick a look, hit the kick. Every look is a real-time shader that loops exactly, exports frame-accurately, and is safe to put on a wall.

**Design principles**

1. **Image first.** Each style is a treatment of your media, never a replacement for it. With nothing attached, a built-in skyline test image plays so a style is never blank.
2. **Loop exact.** Time enters only through the loop phase, in whole cycles. Frame 0 equals the last frame, and every frame renders on its own.
3. **One beat contract.** Every style has the same three beat controls, so audio mapping, presets and prompts work the same everywhere.
4. **Safe by default.** Every travelling band, flicker, tear, sparkle and pulse passes through the limiter. Styles that swing brightness carry the ⚡ mark.
5. **Data is a parameter.** Numbers reach the shader as ordinary keyable, mappable channels. Wallcast draws them as digits, meters and density.

**Goals and success metrics (v1.0)**

| Goal | Metric | Target | Result |
| --- | --- | --- | --- |
| Ships as one installable kit | Installs in Motif 3.2 with no warnings | 10 of 10 styles compile | Met |
| Works on any still or clip | Styles respond to attached media (mean pixel change vs. no media) | Above 0.5 | Met, 51 to 66 on the SDK test card |
| Never blank | Styles render lit frames with no media | Coverage above 3% | Met, coverage 1.0 |
| Loops exactly | Seam ratio between last and first frame | At or below 3 | Met, worst 2.08 (Neon Trace) |
| Safe on a wall | Flashes per second in 25% of the frame at a 0.25 s worst-case loop | 3 or fewer | Met, worst 3.5 in 1 of 16 tiles |
| Tunable | Parameters per style | 4 or more | Met, 13 to 18 |
| Real-time | Frame cost at 1080p on M-series | 2.5 ms per style | To verify with Deliver › Check speed |

## 2. Users and use cases

| Persona | Job to be done | Key need |
| --- | --- | --- |
| Broadcast designer | Turn campaign key art into a 6-second open with live numbers | Loop-exact export, safe flash rates, a matte for the headline |
| Live visual operator | Run a festival wall from one poster and a kick drum | Kick-locked motion, one mapping target, a wall preview |
| Environmental display designer | Ship content to a city-scale screen | Panel-pitch preview, long-run stability, no strobing |
| Prompt-first motion generalist | Say “tear it on the drop and glow the edges” | Readable parameter names, sane defaults, whole-kit consistency |

**Scenarios**

- **Election-night open.** Key art on Depth Stack, a Contour Radar layer above it in Screen, and Slice Shift firing once on the stinger. The Readout parameter on the radar counts the tally.
- **Festival drop.** A poster on Kaleido Wall, Prism Split above it, Shockwave on top. The kick band maps to Hit on all three.
- **Night billboard.** A packshot on LED Wall at the panel's pitch, Neon Trace for edge light, Glyph Mosaic with its Data feed mapped to a price channel.

## 3. Scope

**In v1.0**

- Ten styles, four palettes, one kit-level `source` media input (image or clip) and a second `fore` input on Depth Stack.
- Shared beat, finish and HUD controls on every style: 7 parameters, stamped by the generator.
- A procedural fallback image for every style.
- Seven-segment numerals in the shader for data readouts.
- Photosensitive-limiter routing for every time-driven term.
- Audit tooling that runs the kit inside the real Motif 3 app.

**Out of v1.0**

- Live audio uniforms in the shader. The SDK gives no audio to GLSL; audio reaches the shader through Motif's band mapping onto parameters, which is why `hit` exists.
- A live data-channel API. The SDK has none, so data arrives as keyed or mapped parameters.
- Lottie export of shader passes. Shaders are raster; Motif bakes them to video or a PNG sequence.
- A third media input. The SDK allows two per style. A matte is a Motif layer mask, not a kit input.
- Custom fonts for Glyph Mosaic. The SDK has no texture inputs beyond media, so the glyph set is baked into the shader.

## 4. The ten styles

| ID | Style | Group | Inputs | Params | Passes | Flash | Best for |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `prism-split` | Prism Split | Optics | source | 13 | 2 | ⚡ | On-air, EDM wall |
| `halftone-pulse` | Halftone Pulse | Print and pixel | source | 13 | 2 |  | On-air, EDM wall |
| `slice-shift` | Slice Shift | Glitch and light | source | 13 | 2 | ⚡ | Cyber city, EDM wall |
| `depth-stack` | Depth Stack | Depth and data | source, fore | 18 | 2 |  | On-air, cyber city |
| `contour-radar` | Contour Radar | Depth and data | source | 16 | 2 |  | Cyber city, on-air |
| `led-wall` | LED Wall | Print and pixel | source | 14 | 2 | ⚡ | EDM wall, cyber city |
| `neon-trace` | Neon Trace | Glitch and light | source | 15 | 2 | ⚡ | Cyber city, EDM wall |
| `glyph-mosaic` | Glyph Mosaic | Print and pixel | source | 13 | 2 |  | On-air, cyber city |
| `shockwave` | Shockwave | Optics | source | 15 | 2 | ⚡ | EDM wall, on-air |
| `kaleido-wall` | Kaleido Wall | Optics | source | 16 | 2 | ⚡ | EDM wall |

Every style has two passes. Pass 0 (`styles/source.glsl`, half resolution) draws the fallback image and returns black at once when media is attached, so it costs nothing in normal use. Pass 1 is the treatment.

### 4.0 Shared controls

These seven parameters are stamped onto every style by `build/gen_manifest.py`. The shared library in `common.glsl` reads them, so it compiles in every pass.

| Key | Control | Type | Range | Default | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `beats` | Beats / loop | int | 1 to 16 | 4 | Beat | Kick pulses per loop. The limiter caps this at 3 per second. |
| `hitAmt` | Beat drive | range | 0 to 1.5 | 1.0 | Beat | How hard the internal beat drives the effect. |
| `hit` | Hit | range | 0 to 1 | 0.0 | Beat | Map a live kick band here to drive the effect from audio. |
| `exposure` | Exposure | range | 0.4 to 1.6 | 1.0 | Finish |  |
| `vignette` | Vignette | range | 0 to 1 | 0.4 | Finish |  |
| `hud` | HUD frame | toggle | on / off | off | HUD | Corner brackets, numeric readout and a beat trace. |
| `readout` | Readout | range | 0 to 9999 | 128 | HUD | Shown as four digits. Key it or map a data channel to it. |

`W_beat()` is a loop-locked kick envelope: `1.25 · smoothstep(0, 0.04, f) · exp(−5f)` with `f = fract(u_p · r)` and `r = safeCycles(beats)`. `W_drive()` is `clamp(W_beat() · hitAmt + hit, 0, 1.5)`. Every style uses `W_drive()` for its beat response.

### 4.1 Prism Split

Radial chromatic split plus anamorphic light streaks. Red and blue sample along the radius from the frame centre; an optional seven-tap spectral fringe adds a rainbow edge; a 25-tap horizontal filter over highlights above 0.25 linear becomes an amber streak with a cool counter-streak. The kick widens the split and lengthens the streak.

| Key | Control | Type | Range | Default | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `split` | Split | range | 0 to 0.08 | 0.022 | Style |  |
| `spectral` | Spectral fringe | toggle | on / off | on | Style | Adds a seven-tap rainbow fringe on top of the RGB split. |
| `streak` | Streak gain | range | 0 to 2 | 0.9 | Streaks |  |
| `streakLen` | Streak length | range | 0.05 to 0.5 | 0.22 | Streaks |  |
| `streakCool` | Cool streak | range | 0 to 1 | 0.4 | Streaks | Cyan streak mixed in opposite the amber one. |
| `sweeps` | Light sweeps / loop | int | 0 to 4 | 1 | Streaks |  |

- **Loop.** The light sweep is `lsaw(safeCycles(sweeps))` with a `sin(π·t)` envelope, so it fades at the frame edges and the seam closes.
- **Cost.** 35 media reads per pixel. The highest of the kit; the streak loop dominates.

### 4.2 Halftone Pulse

One halftone screen per colour channel at angles 0.26, 0.79 and 1.31 rad. Light mode adds RGB dots to the dark ground. Ink mode subtracts cyan, magenta and yellow from a paper ground. Dot radius follows a tone curve of the source and swells with the kick. The angle drift is `p_drift · lsin(1)`.

| Key | Control | Type | Range | Default | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `cells` | Screen cells | int | 30 to 200 | 96 | Style | Cells across the short side of the frame. |
| `inkMode` | Ink mode | select | light, print | light | Style | Light adds RGB dots to the ground. Ink subtracts CMY from paper. |
| `gain` | Dot gain | range | 0.4 to 1.0 | 0.72 | Style |  |
| `drift` | Angle drift | range | 0 to 0.15 | 0.03 | Style |  |
| `registration` | Registration | range | 0 to 1 | 0.25 | Style | Offsets the red and blue screens like a loose print run. |
| `under` | Source under-print | range | 0 to 1 | 0.05 | Style | Light mode only. Lets the original image show under the dots. |

- **Loop.** Drift is one sine cycle per loop.
- **Cost.** 3 media reads per pixel. Uses screen-space derivatives for edge anti-aliasing.

### 4.3 Slice Shift

Row displacement, column-block jumps, an RGB tear and a scanline bed. Rows and blocks re-roll at `tslot(rate)`, so the limiter caps changes at 3 per second. The kick raises both the odds of a tear and how far it reaches.

| Key | Control | Type | Range | Default | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `bands` | Bands | int | 6 to 64 | 24 | Style |  |
| `rate` | Changes / loop | int | 1 to 12 | 6 | Style | Tear pattern changes per loop. The limiter caps it at 3 per second. |
| `tear` | Tear | range | 0 to 1 | 0.55 | Style |  |
| `blocks` | Column blocks | range | 0 to 1 | 0.4 | Style |  |
| `rgb` | RGB split | range | 0 to 1 | 0.5 | Style |  |
| `scan` | Scanlines | range | 0 to 1 | 0.5 | Style |  |

- **Loop.** All randomness is hashed from the slot index and the layer seed.
- **Limiter.** With a loop shorter than one third of a second the slots freeze, and the tears hold still instead of strobing.
- **Cost.** 3 media reads per pixel.

### 4.4 Depth Stack

Background, a self-derived mid layer and a foreground input at three parallax depths. Luminance adds per-pixel depth to the background shift. The mid layer is a deeper, slightly enlarged copy of the background, screen-blended where it is bright. The foreground keeps its alpha, casts an offset shadow and can be luma-keyed when it is an opaque photo. A camera XY pad and a one-cycle orbit move all three.

| Key | Control | Type | Range | Default | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `camera` | Camera | point | -0.5 to 0.5 (XY) | 0, 0 | Camera | Parallax offset. Key or map it for a camera move. |
| `orbit` | Orbit | range | 0 to 1 | 0.5 | Camera | Loops one slow circle per loop. |
| `depthBg` | Background depth | range | 0 to 1 | 0.35 | Depth |  |
| `depthMid` | Mid depth | range | 0 to 1 | 0.6 | Depth |  |
| `depthFore` | Foreground depth | range | 0 to 1 | 1.0 | Depth |  |
| `midBlend` | Mid layer | range | 0 to 1 | 0.7 | Depth | Screen-blends a deeper copy of the background. |
| `shadow` | Shadow | range | 0 to 1 | 0.55 | Foreground |  |
| `lumaKey` | Key out dark | toggle | on / off | on | Foreground | Drops near-black pixels of an opaque foreground photo. |
| `keyLevel` | Key level | range | 0.005 to 0.2 | 0.03 | Foreground |  |
| `sweeps` | Light sweeps / loop | int | 0 to 3 | 1 | Style |  |

- **Inputs.** `source` is the background. `fore` is the foreground; transparent PNGs keep alpha. With no foreground, a procedural hardware slab plays.
- **Loop.** The orbit is `lc(1)`. The light sweep is limiter-routed.
- **Cost.** 5 media reads per pixel.

### 4.5 Contour Radar

Iso-luminance contour lines from a 3×3 blurred luminance field, drawn with derivative-based anti-aliasing. A radar sweep brightens the lines as it passes, range rings add scale, and a reticle prints the local level as two digits. Lines drift by whole major intervals per loop.

| Key | Control | Type | Range | Default | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `levels` | Contour levels | int | 4 to 40 | 18 | Style |  |
| `major` | Major interval | int | 2 to 8 | 4 | Style |  |
| `drift` | Contour drift | int | -3 to 3 | 1 | Style | Whole major intervals per loop, so the loop closes. |
| `sweeps` | Radar sweeps / loop | int | 1 to 3 | 1 | Radar |  |
| `trail` | Sweep trail | range | 1 to 12 | 5 | Radar |  |
| `rings` | Range rings | toggle | on / off | on | Radar |  |
| `showReticle` | Reticle | toggle | on / off | on | Reticle |  |
| `reticle` | Reticle position | point | -0.9 to 0.9 (XY) | 0.15, 0.1 | Reticle | Key or map it to follow a subject. |

- **Loop.** Drift is `sign · floor(min(drift·major, 3·L) / major) · major` levels per loop, so it stays a multiple of the major interval and no line crosses a pixel more than 3 times per second.
- **Cost.** 10 media reads per pixel, plus 9 in a disc around the reticle only.
- **Data.** Map the reticle position to follow a subject; map `readout` to a number.

### 4.6 LED Wall

A pixel-mapped panel. Cells high sets the pitch; each cell shows the source at its centre through square or round masks, RGB sub-pixel stripes, a gap control and eight-tap bloom. A scan wipe travels the panel and time-slotted sparkle lights single cells.

| Key | Control | Type | Range | Default | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `cells` | Cells high | int | 24 to 160 | 72 | Style | Panel pitch. Set it to match the real wall. |
| `shape` | Cell shape | select | square, round | square | Style |  |
| `gap` | Cell gap | range | 0 to 1 | 0.4 | Style |  |
| `subpixel` | Sub-pixels | range | 0 to 1 | 0.5 | Style |  |
| `bloom` | Bloom | range | 0 to 1.5 | 0.5 | Style |  |
| `sparkle` | Sparkle | range | 0 to 1 | 0.3 | Style | Time-slotted, so the limiter caps its rate. |
| `wipes` | Scan wipes / loop | int | 0 to 3 | 1 | Style |  |

- **Loop.** The wipe is limiter-routed with a `sin(π·t)` envelope. Sparkle uses `tslot(24)`.
- **Cost.** 9 media reads per pixel.
- **Use.** Set Cells high to match the real wall, then judge type and logos at that pitch before shipping.

### 4.7 Neon Trace

Sobel edge detection at three scales (line width, 4× and 10× the spread) drawn as light. The palette is a spectrum, the kit accents or mono ink, cycling a limiter-capped whole number of times per loop. A travelling gate brightens edges as it passes.

| Key | Control | Type | Range | Default | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `width` | Line width | range | 0.5 to 4 | 1.5 | Style |  |
| `glow` | Glow | range | 0 to 2 | 0.9 | Style |  |
| `spread` | Glow spread | range | 0.5 to 2 | 1.0 | Style |  |
| `gate` | Gate sweeps / loop | int | 0 to 3 | 1 | Style |  |
| `colorMode` | Colour | select | spectrum, accents, mono | spectrum | Colour |  |
| `hueCycles` | Hue cycles / loop | int | 0 to 3 | 1 | Colour |  |
| `hueSpan` | Hue span | range | 0 to 1 | 0.35 | Colour |  |
| `base` | Source under-glow | range | 0 to 0.5 | 0.12 | Colour |  |

- **Loop.** Hue cycles and gate sweeps both pass through `safeCycles`.
- **Cost.** 26 media reads per pixel. Second highest of the kit.

### 4.8 Glyph Mosaic

The image rebuilt from ten 5×5 bitmap marks ordered by density (blank, dot, colon, plus, 1, 7, 0, #, 8, block). Rain trails fall in each column at a whole number of cycles per loop, capped by the limiter. Live cells swap glyphs at `tslot(3)` and `tslot(10)`. The Data feed parameter shifts the density mapping, so a mapped number fills or thins the mosaic.

| Key | Control | Type | Range | Default | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `cols` | Columns | int | 40 to 160 | 96 | Style |  |
| `rain` | Rain speed | int | 0 to 4 | 1 | Style | Whole cycles per loop. 0 stops the rain. |
| `flicker` | Flicker | range | 0 to 1 | 0.35 | Style | Live cells swap glyphs. Rate is capped by the limiter. |
| `feed` | Data feed | range | 0 to 1 | 0.5 | Data | Map a data channel here. Density fills as it rises. |
| `contrast` | Contrast | range | 0.5 to 2 | 1.1 | Data |  |
| `tone` | Tone | select | source, amber, ink | source | Data |  |

- **Loop.** Rain speed per column is `floor(min(rain · (1 + floor(3·h)), 3L))` cycles per loop.
- **Cost.** 1 media read per pixel. The cheapest of the kit.

### 4.9 Shockwave

Each kick launches a refractive ring from the origin. Ring `i` has age `fract(u_p · r) + i`, so at a beat boundary ring `i` takes over from ring `i−1` with no jump. The ring displaces the image along the radius, splits colour, and adds an amber glow.

| Key | Control | Type | Range | Default | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `origin` | Origin | point | -0.9 to 0.9 (XY) | 0, 0 | Style | Where the rings start. Key or map it. |
| `speed` | Ring speed | range | 0.1 to 1.2 | 0.42 | Style |  |
| `refract` | Refraction | range | 0 to 1.5 | 0.8 | Style |  |
| `sharp` | Ring sharpness | range | 4 to 24 | 11 | Style |  |
| `rings` | Rings | int | 1 to 3 | 3 | Style |  |
| `chroma` | Colour split | range | 0 to 1 | 0.5 | Style |  |
| `glow` | Ring glow | range | 0 to 1 | 0.25 | Style |  |

- **Loop.** `r = safeCycles(beats)`. When the limiter freezes the rate, the rings are skipped.
- **Cost.** 3 media reads per pixel.
- **Hit.** `hit` adds ring strength on top of the internal beat.

### 4.10 Kaleido Wall

A mirror-fold kaleidoscope. The frame is rotated by whole cycles per loop, folded into `segments` mirrored wedges, scaled by pattern scale and a one-cycle breathe, then sampled through a mirrored repeat. Drift moves the source by whole mirror periods.

| Key | Control | Type | Range | Default | Group | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `segments` | Segments | int | 3 to 12 | 6 | Style |  |
| `spin` | Spin / loop | int | -2 to 2 | 1 | Style |  |
| `scale` | Pattern scale | range | 0.3 to 1.5 | 0.9 | Style |  |
| `breathe` | Breathe | range | 0 to 0.3 | 0.08 | Style |  |
| `drift` | Drift / loop | int | 0 to 2 | 0 | Style | Whole mirror periods per loop. |
| `chroma` | Colour split | range | 0 to 1 | 0.5 | Style |  |
| `center` | Centre | point | -0.5 to 0.5 (XY) | 0, 0 | Style | Moves the point the pattern folds around. |
| `seams` | Seams | range | 0 to 1 | 0.35 | Style |  |

- **Loop.** Spin and drift are limiter-routed integer cycles. Breathe is `lsin(1)`.
- **Cost.** 3 media reads per pixel.
- **Note.** The key `scale` replaces `zoom`, which the SDK reserves for the layer.

## 5. Functional requirements

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| WC-01 | Ten styles in one `motif-kit@1` package, id `wallcast`, semver 1.0.0 | P0 | Built, validated |
| WC-02 | Kit-level `source` media input (image or clip) on every style; `fore` on Depth Stack | P0 | Built |
| WC-03 | Every style renders a lit frame with no media attached | P0 | Built, audited |
| WC-04 | Shared Beat group: `beats`, `hitAmt`, `hit`, on every style | P0 | Built |
| WC-05 | `hit` is the documented audio-mapping target; internal beat is loop-locked | P0 | Built |
| WC-06 | Time enters only through `u_p` in whole cycles; frame 0 equals the loop end | P0 | Built, preview seam check |
| WC-07 | All flicker, sweep, tear, sparkle, rain, hue and spin routed through the limiter | P0 | Built, audited |
| WC-08 | Styles that swing brightness carry `flash: true` | P0 | Built (6 of 10) |
| WC-09 | Data readout: `readout` parameter drawn as four seven-segment digits in the HUD | P0 | Built |
| WC-10 | Data-driven density and position: Glyph `feed`, Contour `reticle`, Shockwave `origin` | P0 | Built |
| WC-11 | Four palettes: Amber Signal, Ice Broadcast, Festival Magenta, Steel Mono | P0 | Built |
| WC-12 | 4 or more parameters per style, groups and hints, `show` conditions where a control is conditional | P0 | Built (13 to 18) |
| WC-13 | Point parameters for camera, reticle, origin and centre | P1 | Built |
| WC-14 | Text or graphic matte through Motif layer masks | P0 | Host feature; manual test in §11 |
| WC-15 | Clip inputs work through the SDK's media pipeline with frame-exact export | P0 | Host feature; manual test in §11 |
| WC-16 | Audit tool that installs the kit in the real app and checks compile, NaN, coverage and flashes | P1 | Built |
| WC-17 | Low-cost quality tier for High-cost styles | P1 | Backlog (§14) |
| WC-18 | Optional depth-map input for Depth Stack | P2 | Backlog; needs a third input |

## 6. Kit architecture

```
wallcast/
  manifest.json          generated by build/gen_manifest.py; 10 styles, 4 palettes, 146 params
  common.glsl            shared library compiled into every pass
  styles/
    source.glsl          pass 0 (half res): fallback image, black when media is attached
    prism-split.glsl     pass 1 of each style: the treatment
    halftone-pulse.glsl  slice-shift.glsl  depth-stack.glsl  contour-radar.glsl
    led-wall.glsl        neon-trace.glsl   glyph-mosaic.glsl  shockwave.glsl  kaleido-wall.glsl
  README.md
build/gen_manifest.py    single source of truth for parameters
tools/wallcast-audit.mjs audit inside the real Motif 3 app
```

**Pass graph.** Every style: `source.glsl` (scale 0.5) → `<style>.glsl` (full size). The treatment reads the media through `m_source(q)` when attached, or `texture(u_buf0, q)` when not. The wrapper `W_src(q)` hides that choice.

**Shared library (`common.glsl`)**

| Helper | Purpose |
| --- | --- |
| `W_src(q)` | Media composited on the palette background, or the fallback buffer |
| `W_beat()` | Loop-locked kick envelope through `safeCycles(beats)` |
| `W_drive()` | Beat times Beat drive, plus Hit; clamped to 1.5 |
| `W_digit(p, d)`, `W_num(uv, o, h, value, n)` | Seven-segment digits drawn in the shader |
| `W_hud(uv)` | Corner brackets, four-digit readout, beat trace with playhead |
| `W_finish(col, uv)` | Exposure and vignette |

**Why the generator.** The SDK compiles `common.glsl` into every pass, and GLSL rejects a reference to an undeclared uniform. Stamping the seven shared parameters on all ten styles from one script keeps the kit compilable and the names identical.

**SDK constraints that shaped the kit**

| Constraint | Effect |
| --- | --- |
| Two media inputs per style | Depth Stack uses `source` and `fore`; no matte input, masks are host-side |
| Reserved param names (`zoom`, `rotate`, `phase`, `seed`, `tempo`, `loop`, `invert`, `palette`) | Kaleido uses `scale`; validation caught this |
| Limit 32 params per style, 48 uniforms | Largest style uses 18 |
| No state between frames | All motion is closed-form in `u_p`; no trails or feedback |
| No audio in GLSL | Audio is host mapping onto `hit` and any other parameter |
| Media is premultiplied linear | `W_src` adds the palette background under transparent pixels |

## 7. Audio, data and matte in Motif

**Audio.** Load a track in Motif and map its bands to parameters (amount and smoothing per map). Suggested maps:

| Style | Parameter | Band | Amount | Smoothing |
| --- | --- | --- | --- | --- |
| Any | `hit` | onset (kick) | 0.8 to 1.0 | Fast attack, 120 ms release |
| Prism Split | `streak` | high | 0.5 | 80 ms |
| LED Wall | `sparkle` | high-mid | 0.6 | 40 ms |
| Kaleido Wall | `breathe` | bass | 0.15 | 150 ms |
| Neon Trace | `glow` | level | 0.7 | 100 ms |
| Halftone Pulse | `gain` | bass | 0.2 | 100 ms |

Set `hitAmt` to 0 when the beat comes from audio only, so the internal clock does not double-hit. Set `beats` to the bar's beat count when there is no track and the loop is the clock.

**Data.** Any number that should show on screen goes to a parameter: `readout` prints digits in the HUD of every style; Glyph Mosaic `feed` fills the mosaic; Contour Radar `reticle` follows a position; Shockwave `origin` moves the source of the rings. Key them, or map a band or a saved signal to them.

**Matte.** Put a Motif type layer or a shape under the Wallcast layer and use it as a track matte (alpha or luma), with feather and invert. The effect cuts out of the headline, the headline sits on the effect, or both. This is host behaviour; see the manual tests in §11.

## 8. Loop rule and determinism

| Term | Where | Form |
| --- | --- | --- |
| Beat envelope | all | `fract(u_p · safeCycles(beats))`, integer cycles |
| Light sweep, wipe, gate | Prism, Depth, LED, Neon | `lsaw(safeCycles(k))` with `sin(π·t)` or off-screen ends |
| Radar sweep | Contour | `fract(−angle/τ − safeCycles(k) · u_p)` |
| Contour drift | Contour | whole major intervals, capped at 3 line passes per second |
| Rain | Glyph | integer cycles per column, capped |
| Orbit, breathe, angle drift | Depth, Kaleido, Halftone | `lc(1)`, `lsin(1)` |
| Spin, mirror drift | Kaleido | integer cycles through `safeCycles` |
| Hue cycles | Neon | integer cycles through `safeCycles` |
| Tears, flicker, sparkle | Slice, Glyph, LED | `tslot(n)` slot index into seeded hashes |
| Ring age | Shockwave | `fract(u_p · r) + i` |

Randomness is always a hash of position, slot and the layer seed. Nothing reads wall-clock time. Exports render each frame from `u_p` alone.

## 9. Photosensitive safety

The limiter is on by default in the Kits tab. When on, `safeCycles`, `tslot`, `tfrac` and `strobe` cap changes at 3 per second based on the effective loop length, and freeze at zero when even one change per loop would exceed that.

**Method.** The audit renders each style at a worst-case loop of 0.25 s (a 1 s loop at 4× tempo), a 1 s loop and a 6 s loop, with default parameters and four random parameter sets. It reads 64×36 frames at 24 phases, splits them into a 4×4 grid of tiles, and counts pairs of opposing relative-luminance changes of 0.1 or more (with the darker frame below 0.8) per second in each tile. A style fails when 4 or more tiles (25% of the frame) exceed 3 per second.

**Found and fixed.** The first audit measured Contour Radar at 16 flashes per second in 14 tiles at the worst-case loop. The radar sweep and the contour drift ran at full speed. Both now go through the limiter, and contour drift is capped in whole major steps. The other styles' sweeps, wipes, hue cycles, spin, drift and rain were routed the same way.

**Result.** Worst case across the kit: 3.5 per second in 1 of 16 tiles (Contour Radar). That is 6% of the frame against a 25% area rule, so it passes. It is very likely the HUD beat trace or the readout tile; if a stricter reading of the rule is needed, turn the HUD off.

The audit is an approximation of WCAG 2.3.1 and is not a Harding test. Content for broadcast still goes through the broadcaster's own check.

## 10. Performance

Cost is media reads per pixel in the treatment pass, plus one half-resolution fallback pass that exits early with media attached.

| Style | Media reads / px | Class | Note |
| --- | --- | --- | --- |
| Glyph Mosaic | 1 | Low | Table lookups only |
| Halftone Pulse | 3 | Low | Derivatives for edges |
| Slice Shift | 3 | Low | |
| Shockwave | 3 | Low | Loop of up to 3 rings |
| Kaleido Wall | 3 | Low | |
| Depth Stack | 5 | Low | Foreground read twice for the shadow |
| LED Wall | 9 | Mid | Eight-tap bloom |
| Contour Radar | 10 (+9 near the reticle) | Mid | 3×3 blur for stable lines |
| Neon Trace | 26 | High | Three Sobel scales |
| Prism Split | 35 | High | 25-tap streak plus 7-tap fringe |

**Audit timings (CPU, SwiftShader, 480×270).** Prism Split 84 ms, Halftone Pulse 23 ms, Slice Shift 19 ms, Depth Stack 28 ms, Contour Radar 44 ms, LED Wall 34 ms, Neon Trace 63 ms, Glyph Mosaic 18 ms, Shockwave 23 ms, Kaleido Wall 26 ms.

These are software-renderer numbers. They are useful for ranking styles on one machine and are not GPU times. Verify real cost in Motif with Deliver › Check speed at export size, and stay under 2.5 ms per style at 1080p on an M1.

**Levers when a style is too heavy.** Lower Neon Trace glow spread (fewer distinct fetches are not possible, but a smaller spread improves cache hits), turn Prism Split spectral fringe off (saves 7 reads), or lower the layer's shader resolution. A half-tap quality tier is in the backlog.

## 11. Testing and acceptance

**Automated (run in this drop)**

| Check | Tool | Result |
| --- | --- | --- |
| Schema and static checks | `motif-kit validate` | ok: 10 styles, 4 palettes, 146 params, 10 with media input |
| Compile, loop seam, blank-frame, media response | `motif-kit preview` on the SDK test card and on four stills | All ✓; worst seam ×2.08; media Δ 51 to 66 |
| Install in the real app, compile every pass | `__m_kits.install` in Motif3.html | ok, no warnings |
| NaN, Inf and coverage over 11 parameter sets × 4 palettes × 3 phases | `tools/wallcast-audit.mjs` | Coverage 1.0, NaN 0 for all ten |
| Flash count at worst-case loop | `tools/wallcast-audit.mjs` | Passes; see §9 |

| Style | Params | Coverage | NaN share | Worst flashes / s in any tile | Tiles over 3 / s (of 16) | ms per 480×270 frame (CPU) |
| --- | --- | --- | --- | --- | --- | --- |
| Prism Split | 13 | 1 | 0 | 0 | 0 | 84 |
| Halftone Pulse | 13 | 1 | 0 | 0 | 0 | 23 |
| Slice Shift | 13 | 1 | 0 | 0 | 0 | 19 |
| Depth Stack | 18 | 1 | 0 | 0 | 0 | 28 |
| Contour Radar | 16 | 1 | 0 | 3.5 | 1 | 44 |
| LED Wall | 14 | 1 | 0 | 0.42 | 0 | 34 |
| Neon Trace | 15 | 1 | 0 | 1 | 0 | 63 |
| Glyph Mosaic | 13 | 1 | 0 | 0.33 | 0 | 18 |
| Shockwave | 15 | 1 | 0 | 0 | 0 | 23 |
| Kaleido Wall | 16 | 1 | 0 | 0.5 | 0 | 26 |

**Manual (not yet run; needs Motif open on a GPU)**

1. Drop `wallcast-1.0.0.motifkit` on Motif. Confirm ten styles appear with the MEDIA badge and library thumbnails show the skyline.
2. Attach each of the four reference stills to each style. Confirm no black frames and no visible loop seam.
3. Attach a clip. Confirm Fit to loop gives a seamless loop and export seeks frames deterministically.
4. Map onset to `hit` on Prism Split and Shockwave with a 128 BPM track. Confirm the flare and ring land on the kick.
5. Put a type layer under Slice Shift as a luma track matte. Confirm the tear appears only inside the letters. Repeat with invert.
6. Key `readout` from 0 to 9999 over the loop on Contour Radar. Confirm the digits count and never clip.
7. Export MP4, WebM and a PNG sequence of Depth Stack at 1080p. Confirm frame 0 equals the last frame and Check speed stays under budget.
8. With the limiter off, confirm ⚡ styles can exceed 3 per second, then turn it back on.

## 12. Chains

A chain is a stack of Motif layers, each with its own style, blend mode and mask. Up to four layers.

**Election-night open (6 s loop, 25 fps)**

| Layer | Style | Blend | Key settings |
| --- | --- | --- | --- |
| 1 | Depth Stack | Normal | Background = key art, `orbit` 0.5, `depthFore` 1.0 |
| 2 | Contour Radar | Screen | `levels` 14, `major` 4, `readout` keyed to the tally, opacity 0.6 |
| 3 | Slice Shift | Normal, masked | `rate` 6, `tear` 0.7, mask animates in for the last second only |

**Festival drop (8 bars)**

| Layer | Style | Blend | Key settings |
| --- | --- | --- | --- |
| 1 | Kaleido Wall | Normal | `segments` 6, `spin` 1, poster as source |
| 2 | Prism Split | Screen | `hit` mapped to onset, `streakLen` 0.3 |
| 3 | Shockwave | Add | `hit` mapped to onset, `rings` 3, `refract` 0.6 |

**Night billboard (loop, panel pitch)**

| Layer | Style | Blend | Key settings |
| --- | --- | --- | --- |
| 1 | LED Wall | Normal | `cells` set to the panel's vertical pixel count, packshot as source |
| 2 | Neon Trace | Screen | `colorMode` accents, `glow` 0.7, opacity 0.5 |
| 3 | Glyph Mosaic | Add, masked | `tone` amber, `feed` mapped to the price channel, mask to a lower band |

## 13. Delivery and repo layout

| Path | What |
| --- | --- |
| `Motif3/kits/wallcast-1.0.0.motifkit` | The installable kit |
| `Motif/motifKits/wallcast-1.0.0.motifkit` | Copy beside the other packaged kits |
| `Motif3/kits/source/wallcast/` | Editable source: manifest, common, styles, README, `build/gen_manifest.py` |
| `Motif3/tools/wallcast-audit.mjs` | Audit inside the real app |
| `Motif/docs/Wallcast-PRD-and-Engineering-Spec.md` | This document (also `.docx`, `.pdf`) |

**Versioning.** The kit id `wallcast` and every style id and parameter key are stable, because presets and saved projects refer to them (`wallcast/prism-split`). Add parameters freely. Never rename or remove one; deprecate in the label instead. Installing a kit with the same id updates it.

**Rebuild**

```sh
python3 build/gen_manifest.py wallcast/manifest.json
node motif-kit-sdk/bin/motif-kit.mjs validate wallcast
node motif-kit-sdk/bin/motif-kit.mjs preview wallcast --media photo.jpg
node motif-kit-sdk/bin/motif-kit.mjs pack wallcast --out dist
node tools/wallcast-audit.mjs wallcast.bundle.json Motif3.html audit.json
```

## 14. Milestones and backlog

| # | Milestone | Scope | Exit | Status |
| --- | --- | --- | --- | --- |
| K0 | Contract | Shared params, common library, fallback image, generator | Kit compiles in every pass | Done |
| K1 | Ten styles | All ten treatments with limiter routing | Validate, preview and app install pass | Done |
| K2 | Audit | Real-app audit with NaN, coverage and flash counts | Contour Radar fixed; all pass | Done |
| K3 | In-app QA | The manual list in §11 on a GPU | All eight checks signed off | Next |
| K4 | Presets | Saved looks per style and the three chains in §12 | Chains reload from a look | Next |
| K5 | v1.1 | Quality tier, depth map, Field Warp, Data Bars | See below | Backlog |

**Backlog**

- **Quality tier.** A `quality` select on Prism Split and Neon Trace that halves the tap count.
- **Depth-map input.** A third media input would need an SDK change; alternatively pack depth into the foreground's alpha.
- **Field Warp.** A flow-line gravity lens after the particle-warp reference: lines bend around an origin point and a radius set by the kick. Closed-form in `u_p`, no state.
- **Data Bars.** Bar and sparkline overlays driven by a set of mapped parameters.
- **Glyph sets.** Additional baked glyph tables (katakana-style, hex, binary) as a select.
- **Label text.** Small baked letter set so the HUD can print units beside the readout.

## 15. Risks and open questions

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Software-renderer timings misread as GPU cost | Wrong optimisation work | Label them; measure with Deliver › Check speed on the target machine |
| Prism Split and Neon Trace heavy on iPad and phone | Dropped frames | Lower shader resolution; quality tier in v1.1 |
| Flash approximation misses a case | Photosensitive risk on a wall | Limiter on by default; broadcaster check before air; HUD off for strict readings |
| Sobel and contour passes amplify film grain | Line crawl | Contour uses a 3×3 blur; add a pre-blur to Neon Trace if a source is noisy |
| Two-input SDK limit | No matte or depth input | Use Motif masks; revisit with SDK 1.3 |
| Data has no live channel | Manual keying for numbers | Map a band or saved signal to `readout` and `feed`; ask for a data input in the SDK |
| WebGL 2 required | Older browsers fail to install | Same as the rest of Motif 3 |

**Open questions**

1. Does Motif's track matte support a type layer directly, or does it need a precomp?
2. Should the kit ship saved looks for the three chains, or leave that to the studio's look library?
3. Is a `quality` control acceptable as an SDK-wide convention across kits?
4. Should the HUD text set grow a baked alphabet so labels can sit beside the digits?
