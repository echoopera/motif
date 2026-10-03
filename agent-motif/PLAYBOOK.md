# AgentMotif Playbook

This is everything AgentMotif considers when it builds a shader for you, gathered in one place. It covers how to brief it, what it checks, the rules it follows, and the lessons from building the showcase kit. The agent's operating manual is `agent-motif/AGENT.md`; this playbook is the human-readable companion and the checklist the agent works through.

Target: **Motif Kit SDK 4.0** (`motif-kit@4`, Motif 8; it reads `@1`–`@3` unchanged), WebGL2 / GLSL ES 3.00.

---

## Part 1: How to use AgentMotif

### Start it
In Claude Code, opened on this repository:

| Way | What to type |
| --- | --- |
| Skill | `/agent-motif` followed by your brief |
| Subagent | "Use agent-motif to …" |
| Plain request | "Make a Motif shader that …". Claude will pick the agent up from the description. |

Before the first run, install the SDK's dependencies once: `cd Motif3/sdk/motif-kit-sdk-4.0.0 && npm i`.

### Give it a brief
Put reference images in the repo (for example `refs/`) and point to them. A good brief answers as many of these as you can; anything you leave out, the agent decides and tells you what it chose.

```
Reference:   refs/oil-slick.jpg  (optional; one or more images)
Look:        holographic oil film, slow and viscous, luxury fashion
Use:         title-sequence background / social loop / live VJ / transition between shots / treatment for my footage
Must have:   my brand palette #0A0A0C #F4F1EA #C9A227; type "MAISON" on screen; works with my clip
Motion:      8 s loop, calm, one slow swirl per loop
Deliver as:  new kit "maison" / add to an existing kit
Avoid:       glitch, strobing, rainbow hues
Platform:    phone playback must be smooth / broadcast 1080p25
```

### What you get back
- A kit folder in `agent-motif/kits/<id>/` (or your chosen location) and a packed `dist/<id>-<version>.motifkit`.
- Frames the agent rendered and looked at, plus before/after sheets with fidelity scores when you gave an image.
- A QA report covering loop seams, pops, the flash audit, exposure across quality settings, transition endpoints and cost.
- A short critique: what's still off and why, two alternative directions, and any SDK features the look would need (with pros and cons).

### Use the result in Motif
1. Drag the `.motifkit` file onto Motif 8 (or use Kits › Install). Approve the capabilities it lists (for example *media* or *text*).
2. The styles appear in the library. Effects appear in the layer and finish stacks, transitions between shots, and sequences in the Sequencer layer's **Load a sequence** menu.
3. Every parameter can be keyframed, mapped to audio bands, Mutated and Evolved. Media styles take an image or clip dropped on the stage; text styles edit their lines in the inspector.

### Review without Motif
- Run `node agent-motif/tools/build-showcase.mjs <kit-folder>` and open `agent-motif/showcase/index.html` in Chrome: a live viewer with the full inspector, palettes, tempo, media drop and text editing.
- Run `node agent-motif/tools/am.mjs film <kit> <style> --seconds 6` for a `.webm` of one loop.

### Iterate
Reply in plain words: "warmer", "slower", "less bloom", "more like the reference's lower left", "make the type bigger", "add a variant in my palette". The agent edits, re-renders, re-measures and re-runs QA every time.

---

## Part 2: The checklist the agent works through

### 2.1 Intake
- [ ] Restate the brief as a **one-line look statement**: subject, material, light, medium, motion, mood.
- [ ] **Image given:** run `am analyze`, then study the image directly. Note the light (how many sources, hard or soft, colour temperature, direction), the material response, the camera (focal length, depth of field, motion blur, lens artefacts), the medium (air, water, fog, film), and the motion the still implies.
- [ ] **Words only:** turn them into a target fingerprint first: key, contrast, saturation, dominant hues, texture scale, directionality, symmetry, motion energy, tempo. Recall what the real thing actually looks like (caustics are thin bright networks; silk has anisotropic sheen; nebulae are filamentary).
- [ ] **Both:** the image sets the look and the words set motion and intent. State which one won any conflict.
- [ ] **Choose the entry kind:** style (generates a picture), effect (treats a layer or the frame), transition (between two shots), sequence (choreographs styles over the loop), or a combination.
- [ ] Note the platform: live or phone (tight budget), broadcast export, or web background.

### 2.2 Decompose into a layer stack (before any GLSL)

| Layer | Question it answers |
| --- | --- |
| Ground | What's behind everything? |
| Form | What are the shapes, and what **field class** are they (see 2.4)? |
| Material | How does the form respond to light? |
| Light | Where are key, fill and rim? What about environment, shadows and occlusion? |
| Atmosphere | Is there haze, absorption, god rays or depth fade? |
| Lens and film | Exposure, tone map, bloom, halation, CA, distortion, vignette, grain |
| Motion | What moves, at how many whole cycles per loop, with what easing? Where does the eye rest? |

For each layer, pick a technique from `knowledge/technique-atlas.md`, note its cost, and consider at least two options for the hardest layer.

### 2.3 The SDK contract (non-negotiable)

| Rule | In practice |
| --- | --- |
| Loop rule | Time enters only through `u_p`. Every periodic function uses a **whole-number** frequency (`lc`, `lsin`, `lsaw`, `ln2(x, k, r)`, `int` params for cycles). Frame 0 must equal frame L. Never use half frequencies of a looping angle. |
| No state across frames | Graph feedback (`iterate`, a pass reading its own buffer) resets **every frame**. It gives bounded iteration within a frame only, not persistent simulation. |
| Output | Return premultiplied linear RGBA from the output pass; the runtime converts to sRGB. Intermediate buffers are linear half-float where supported, so tone-map in the output pass. |
| Palette | Colour comes from `u_bg u_ink u_a0 u_a1 u_a2` and declared `color` params. At most 8 palettes per kit. |
| Media inputs | Must look good with nothing attached (`u_<id>On == 0`), because library thumbnails have no media. Composite alpha yourself. |
| Text inputs | Draw a designed placeholder until the atlas exists, never fake glyphs. Text distance fields clamp beyond their spread. |
| Capabilities | Declare exactly what's used: `media`, `text`, `vector`, `audio`, `feedback`. Using one undeclared is an error; declaring one unused costs user trust. |
| Effects | Read `input`, keep its alpha, and remember it's display-referred (thresholds below 1). |
| Transitions | Progress 0 shows `from` exactly and 1 shows `to` exactly. Drive every distortion by a factor that is exactly 0 at both ends, such as `sin(PI * progress)`. |
| Photosensitivity | Route every flicker, strobe, glitch or flash through `tslot / tfrac / strobe / safeCycles / flashAmt`, and set `"flash": true` if it can flash. The worst case tested is a 1 s loop at 4× tempo. |
| Sandbox | Every loop is a `for` with a constant or param bound (`for (int i = 0; i < 64; i++) { if (i >= n) break; }`). No bounds from function arguments, no `while`, no recursion, no `#extension` / `#version` / `#line`, ASCII only. |
| Budgets | ≤ 4,096 trips per loop; ≤ 32,768 iterations and ≤ 2,048 texture fetches per pixel. **Stay under half** of each, as the bundled kits do. |
| Limits | 40 styles, 24 effects, 24 transitions, 16 exporters, 8 sequences per kit. 32 params (48 uniforms; 128 with generated controls). Graphs: 8 buffers, 8 passes, 32 executions per frame. 2 media + 2 svg + 2 text inputs, 9 textures. 96 KB per GLSL file, 3 MB per kit. |
| Reserved params | `palette invert tempo phase seed zoom rotate loop` |

### 2.4 Fields and renderers (from the Astral research)
Every scene function carries a field-class comment, and only a valid renderer may draw it. **Terminology never substitutes for evidence.**

| Class | Meaning | Valid renderer | Examples |
| --- | --- | --- | --- |
| `exact` | Exact signed distance | `AM_MARCH` (sphere tracing) | spheres, boxes, unions |
| `bound` | A conservative bound after dividing by Lipschitz L | `AM_MARCH_L` | smooth booleans; folds (`L ≤ (1+a)^layers`); twist (`L = √(1+(k·r)²)`); gyroid shell (`÷√6`) |
| `implicit` | Only the zero set matters | `AM_SEGMENT` (fixed steps + bisection) | raw gyroid, potentials, arbitrary warps |
| `density` | Extinction per unit length | `AM_VOLUME` (step-normalised absorption/emission) | clouds, nebulae, membranes |
| `glow` | A positive heuristic step field | `AM_GLOW` (a named aesthetic renderer) | the Astral look |

- Derive the Lipschitz constant. **A smaller step multiplier is not a proof.**
- An additive glow's brightness depends on step count. Measured: ×2.43 from minimum to maximum quality. Either calibrate a compensation and re-measure, or offer the volume renderer too.
- Step-normalised volumes hold exposure across quality settings. Measured: ×0.96–0.999.
- Keep the opaque surface and the emissive atmosphere as separate passes or terms.

### 2.5 Graph and pass plan

| Look | Plan |
| --- | --- |
| Anything that glows | `scene (0.5–0.75) → bright (0.25) → glow (0.125) → output`: shared post with the shared Lens params |
| Media treatment | `source (0.5) → treatment (1.0)` |
| Per-frame relaxation (diffusion, jump-flood SDF) | `iterate` with a feedback buffer, `feedback` capability, seed at `u_iter == 0` |
| Several images in one shader | `"stack": { "layers": 1–3 }` and `L_stack(base, uv)` |
| Brand mark | svg input (`vector` capability) and `vec_<id>(uv)` |
| Type | text input with `"sdf": true` and `textDist_<id>(i, q)` |
| Raymarcher | a `steps` quality param (`mutate: 0`) plus a bounding volume (`am_sphereHit`) |

The bloom pre-blur radius must follow the real buffer ratio (`textureSize(src) / u_res`), or small highlights alias into blocks.

### 2.6 Look development: what "expensive" looks like
- **Light and exposure:** work in linear HDR and tone-map once. Emissive cores at 2–20× diffuse are what make bloom read as light. Use one key direction that every surface agrees with. Add Fresnel everywhere. Keep energy honest (metals have no diffuse).
- **Colour:**
  - Mix in OKLab, never RGB or HSV.
  - Palette roles: `bg` ground, `ink` light and type, `a0` hero, `a1` secondary, `a2` shadow tint. Aim for roughly a 60/30/10 split by area.
  - Saturation lives in the midtones.
  - Tone maps: AgX by default, AgX Punchy for stylised looks, PBR Neutral for brand colours, ACES only on request.
- **Lens and film (tasteful ranges):**

  | Control | Range |
  | --- | --- |
  | Bloom threshold | 0.8–1.5 |
  | Bloom mix | 0.3–0.8 |
  | Chromatic aberration | 0.1–0.3 |
  | Grain | 0.2–0.4 |
  | Vignette | 0.3–0.6 |
  | Halation | 0.05–0.2 |
  | Anamorphic | ≤ 0.3 |

  Too much of any of these reads as a filter.
- **Variation:** never regular. Use seeded ±25–30% variation, rotated noise octaves, and two layers beating against each other. Fade high-frequency detail with distance so it doesn't alias.
- **Composition:** one focal point, where the brightest, most saturated and sharpest region coincide. Keep the text-safe area calm in backgrounds, and break symmetry slightly unless symmetry is the point.

### 2.7 Motion
- One hero motion, one secondary, and ambient life. Ambient stays under about 20% of screen energy.
- Heavy things move slowly with long eases; small things react fast and settle on a spring (`am_spring`).
- Use whole cycles per loop; one per loop is a calm default for 6–10 s loops. Offset phases per element with a hash.
- Use eased segments, staggers, in-hold-out and on-twos from the `motion` module. **Avoid expo eases on large moves**, because they jump in one frame (`pop ×` goes over 3).

### 2.8 Making it a pro tool (parameters are the product)
- Group parameters as `Form · Material · Light · Motion · Lens · Quality`, with hints on anything non-obvious.
- Ranges should be perceptually even (`log` for scales and drift). Defaults are the hero frame. Use `randMax` so Randomize stays tasteful, and `mutate: 0` on quality and structural selects.
- Cycle counts are `int` params labelled "… / loop". Every parameter must visibly change the image; delete dead ones.
- Use 6 to about 24 parameters per style, and declare `cost` honestly.

### 2.9 Fidelity to a reference (image briefs)
1. **Your eye first:** composition, silhouette, material read, light direction.
2. Then work through the `am compare` gap report from the top; each gap names a shader move.
3. Run `am tune` on continuous parameters with **structural parameters locked**. The optimiser will delete a defining feature if that raises the average (it removed the streaks in the Light Tunnel case study).
4. Stop when the read is right and the score plateaus.

Score bands (style mode): under 60 means the read is wrong; 60–75 is the right family; 75–85 is a convincing facsimile; above 85 is close to a match. Photographic targets cap structure and layout scores. With your footage attached, a media style uses the real pixels.

### 2.10 Numerics and robustness
- Write `smoothstep(e0, e1, x)` with `e0 < e1` (reversed edges are undefined in GLSL ES).
- Put floors under denominators; clamp `pow`, `sqrt` and `log` inputs; keep normals finite; initialise every accumulator.
- Keep phases bounded (`fract`), use `highp` positions, and never use an ever-growing time in high-frequency trig.
- Anything that falls off with a sampled distance must reach zero **inside** the stored spread. Otherwise it draws a box (this happened in Lightscript, and is fixed with `glowFall`).
- Scrolling a cell grid doesn't loop, because hash ids change. Wrap particles in a domain with whole wraps per loop instead.

### 2.11 Performance budget

| Tier | Budget (real GPU, 1080p) | Typical shape |
| --- | --- | --- |
| Live / VJ / phone | < 4 ms | 1 pass, or a half-res scene plus a cheap finish |
| Broadcast export | < 16 ms | scene 0.5–0.75 + bloom pyramid + finish |
| Hero / offline | any | quality params raised for export |

Cost scales with pixels × samples × fold layers, so reduce render scale and step count **before** changing the form. Cull early, bound volumes, and put smooth layers in a 0.5-scale pass. Headless timings are SwiftShader (CPU) numbers: compare them between runs and never quote them as frame rates.

### 2.12 QA gates (every delivery)

| Check | Pass |
| --- | --- |
| `am lib test` | the library passes the app sandbox and compiles |
| `motif-kit validate` | ok, with budgets under half of every hard limit |
| `motif-kit preview` | every entry and every sequence ✓ |
| Loop seam (`am qa`) | Δ0 (fails above 1.5) |
| Pops | `pop ×` < 3 (fails above 6) |
| Flash audit | fewer than 4 tiles above 3 flashes/s at the worst case (1–3 tiles is a warning) |
| Quality exposure | min vs max steps within ±15% |
| Transition endpoints | Δ0 at progress 0 and 1, compared with a GPU pass-through |
| Fallbacks | media styles without media and text styles before the atlas both look designed |
| Eye | the hero phase and two others viewed, and one loop filmed and watched |

### 2.13 Startup reliability (any page or host code)
- Treat `{ok:false, pending:true}` as *pending*: poll on animation frames and show "Preparing…". After a 20 s deadline, offer **Retry**; never call it an error.
- Inspect link status only after completion. Cancel stale jobs when the selection changes, and cache good programs.
- On context loss, stop drawing and rebuild every program and target on restore. Do no work while the tab is hidden.
- Never let a poster image masquerade as a running shader.

### 2.14 When the SDK is the limit
Ship the best approximation now and say what it gives up. Then record a proposal in `knowledge/sdk-proposals.md` (need, proposal, pros, cons and risks, effort, recommendation) and bring it to you as a decision. The agent never edits the runtime itself.

Open proposals, top first:
1. Export motion blur and supersampling.
2. Mipmapped, HDR-guaranteed graph buffers + `u_hdr`.
3. Field-class metadata (P-11).
4. Quality-exposure canary (P-12).
5. Curve and gradient params.
6. Style-level shared param sets.
7. LUTs and blue noise.
8. Derived depth, mask and flow for media.
9. Temporal-state contract.
10. Pointer input for Live mode.
11. WebGPU backend.

### 2.15 The report you receive
The look statement; the layer stack with field classes; before/after images with scores; QA, validate and preview results; what's still off and why; **two alternative directions**; and any SDK proposals the brief raised.

---

## Part 3: Quick reference

### Commands
```bash
AM="node agent-motif/tools/am.mjs"; MK="node Motif3/sdk/motif-kit-sdk-4.0.0/bin/motif-kit.mjs"
$AM analyze ref.jpg --out work                       # fingerprint, palette, technique hints
$AM new kits/my-kit --id my-kit                      # @4 graph scaffold on the library
$AM lib build color noise light post sdf motion field --append kit.glsl --out common.glsl
$AM frame kits/my-kit hero --w 1280 --h 720          # look at it (--media img, --no-media, --text "A|B|C")
$AM compare kits/my-kit hero --ref ref.jpg --phase 0.2,0.5,0.8
$AM tune kits/my-kit hero --ref ref.jpg --only scale,glow,exposure --apply
$AM qa kits/my-kit                                   # seam, pops, flashes, quality exposure, endpoints, cost
$AM film kits/my-kit hero --seconds 6
$MK validate kits/my-kit && $MK preview kits/my-kit && $MK pack kits/my-kit --out dist
node agent-motif/tools/build-showcase.mjs kits/my-kit   # live viewer at agent-motif/showcase/index.html
```
In this cloud container, `motif-kit preview` needs `MOTIF_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

### Library modules (`agent-motif/lib/glsl/`)

| Module | Highlights |
| --- | --- |
| `color` | OKLab/OKLCh, `am_mixOk`, `am_rampOk`, AgX, PBR Neutral, grading |
| `noise` | curl, domain warp, flow maps, gyroid fbm, caustics, stars, IGN, `am_frame(fps)` |
| `light` | GGX, split-sum env, procedural studio HDRI, thin film, spectrum, sheen, HG phase |
| `post` | bloom, halation, anamorphic, spectral CA, barrel, bokeh, Kuwahara, Sobel, CAS, vignette, grain |
| `sdf` | 2D/3D primitives, smooth booleans, polar repeat, hex grid, camera, `AM_MARCH`/`AM_NORMAL`/`AM_SHADOW`/`AM_AO` |
| `motion` | segments, Penner and cubic-bezier eases, springs, stagger, in-hold-out, on-twos |
| `field` | field classes, Astral cosine fold + its Lipschitz bound, `AM_MARCH_L`, `AM_SEGMENT`, `AM_GLOW`, `AM_VOLUME`, `am_sphereHit` |

### Where things live

| Path | What |
| --- | --- |
| `agent-motif/AGENT.md` | the agent's manual (source of truth; `tools/sync-agent.mjs` regenerates the skill and subagent) |
| `agent-motif/knowledge/` | technique atlas, look-dev, research radar, rubric, SDK proposals |
| `agent-motif/kits/agent-motif/` | showcase kit 2.0: 11 styles, Lens effect, Tunnel Cut transition, reel sequence, exporters |
| `agent-motif/examples/light-tunnel/` | worked image-to-shader case study |
| `Motif3/sdk/motif-kit-sdk-4.0.0/` | the SDK |
| `docs/research/` | the Astral methodology research |
