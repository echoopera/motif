# MotifGraph: PRD and Engineering Plan

Status: **G0 to G4 shipped in Motif 9.0** (see the staging table below for what is built) · Baseline: Motif 8.0.0 / SDK 4.0 · Decisions taken: one composite graph per project, composite placed before the finishing stack by default (switchable), layer and composite scope both in 9.0

---

## 1. Summary

**MotifGraph** is a real-time procedural motion-graphics engine inside Motif. It takes any **layer** or the **entire composite** as a live texture and turns it into geometry and instances that can be cloned, deformed, driven by effectors and fields, simulated, lit and re-composited, at interactive frame rates and with Motif's loop-exact, deterministic export guarantees.

It is the in-app answer to the MoGraph class of tools (Cinema 4D MoGraph, Cavalry, Notch, TouchDesigner, Blender Geometry Nodes) for the work Motif users actually do: type, shapes, media, particles and looping broadcast graphics.

**One-line promise:** drop a MotifGraph on a layer or the final composite, and clone, bend, scatter, ripple and drive it with sound, a pointer or a timeline, with no render wait.

### Why a module and not an SDK extension
Kits are data and GLSL fragment passes only, checked statically and sandboxed. MotifGraph needs vertices, instancing, per-instance state, fields and (later) simulation. Those belong in a first-party host component. The SDK gets a **declarative preset surface** once the engine settles (section 12), so the kit safety model is never loosened.

---

## 2. Goals and non-goals

### Goals
1. **Pro parity on the core MoGraph loop**: Cloners, Effectors, Fields, Deformers, Shader/Color driving, Time/Delay, Sound reaction, Dynamics-lite, Camera.
2. **Applies to a Layer or the Composite**, per scope (section 5.2), with the same node set.
3. **Real time and interactive**: 60 fps preview at 1080p on a mid GPU for the target scene budgets (section 10); pointer and handle interaction.
4. **Loop-exact and deterministic**: frame 0 equals frame L; scrubbing, render cache, Worker and exports agree.
5. **Modular and additive**: every capability is a registered module; Motif without MotifGraph nodes is byte- and pixel-identical to 8.0.
6. **Fast iteration**: new node = one file + one registry line; no core patch.
7. **Agent-native**: every parameter and node is reachable from the MCP bridge so Claude Code / Codex can direct it by prompt.

### Non-goals (9.0)
- A general 3D DCC (modelling, UV editing, sculpting, rigging).
- Path-traced or physically based rendering.
- Unbounded particle or fluid simulation (bounded, budgeted dynamics only).
- Running user JavaScript inside packs (stays data + GLSL).
- Replacing Motif's kit styles, effects or Sequencer. MotifGraph consumes their output.

---

## 3. Users and jobs

| User | Job |
| --- | --- |
| Motion designer | Build kinetic type and logo reveals with cloners, delays and effectors faster than in a desktop DCC |
| Broadcast / live operator | Reactive, audio-driven, pointer-driven graphics that run live and export loops |
| Prompt-directing creator | Ask an agent for "a radial array of the title that ripples to the kick" and get a clean, editable graph |
| Kit author | Ship reusable deformer and cloner presets in a `.motifkit` |

---

## 4. Competitive benchmark

| Capability | C4D MoGraph | Cavalry | Notch / TouchDesigner | **MotifGraph 9.0** |
| --- | --- | --- | --- | --- |
| Cloner modes (linear, radial, grid, honeycomb, spline, object, scatter) | Yes | Yes | Yes | Yes (G2) |
| Effectors (plain, random, step, delay, sound, time, shader, spline, target) | Yes | Partly | Node-built | Yes (G3) |
| Fields with falloff, layering, remap | Yes | Yes | Node-built | Yes (G3) |
| Mesh deformers (bend, twist, wave, noise, lattice, spherical, displace) | Yes | Limited | Yes | Yes (G4) |
| Per-instance color / material driving | Yes | Yes | Yes | Yes (G3) |
| Dynamics (springs, collisions, simple particles) | Yes | Basic | Yes | Bounded, G6 |
| Applies to any layer or the whole composite | n/a | n/a | Yes (TOP chain) | **Yes, native** |
| Loop-exact deterministic export | No | Partly | No | **Yes, guaranteed** |
| Prompt / agent directed | No | No | No | **Yes** |
| Zero install, single-file browser app | No | No | No | **Yes** |

**Where Motif wins:** loop-exactness, agent control, composite-as-input, zero install, shareable single file. **Where it will lag in 9.0:** full 3D scene tooling, heavy simulation, plugin ecosystem. Those are explicit later phases.

---

## 5. Concepts and architecture

### 5.1 Pipeline

```
 Source ──► Geometry ──► Instances ──► Modifiers ──► Shading ──► Output
 (layer      (grid mesh,   (cloner      (effectors,   (per-instance  (back to the
  or          cards,        arrays)      fields,       color, light,   compositor)
  composite)  glyph quads)               deformers,    blend)
                                         dynamics)
```

- **Source** is a texture: the rendered layer or the composited frame, sampled live.
- **Geometry** is a subdivided textured grid (default), or a card per glyph or per tile.
- **Instances** come from Generators (Cloners). Each instance carries a transform, color, opacity, UV rect, seed and id.
- **Modifiers** are an ordered stack. Each reads **Fields** and writes instance attributes or vertex positions.
- **Shading** is per-instance color, opacity, blend and simple lighting.
- **Output** is a premultiplied linear texture handed back to the compositor, exactly as an effect result is today.

### 5.2 Scope: Layer or Composite

| Scope | Input | Where it runs | Notes |
| --- | --- | --- | --- |
| **Layer** | That layer's rendered texture | In the compositor, after the layer renders and before it is blended | Layer mask and blend mode apply to the MotifGraph output |
| **Composite (pre-finish)** | Frame after all layers are blended | Before the finishing stack (grain, bloom, grade) | Default for composite scope, so finishing still polishes the result |
| **Composite (post-finish)** | Final frame | After the finishing stack | For effects that must warp the finished look |

A project holds any number of layer-scope graphs and at most one composite graph in 9.0 (cost-capped; revisit in 9.x).

### 5.3 Evaluation model (the loop guarantee)
- Every graph is a **pure function** of `(phase p, loop length L, seed, params, inputs)`. No hidden wall-clock state.
- Time-varying behavior uses **whole cycles per loop** (the 8.0 playhead rule): noise, wave and effector motion take integer cycles, so frame 0 equals frame L.
- **Stateful features (Dynamics)** are **baked**: simulated on a fixed step from `p = 0`, checkpointed every N frames for fast scrubbing, and closed to loop by a crossfade / cyclic solver (G6). Un-baked live mode is allowed in preview only and flagged "not export-exact".
- Pointer and live input are **performance inputs**: usable live, recordable to a track, and baked on export.

### 5.4 Runtime design
- **GPU first.** WebGL2: instanced draws, vertex-texture fetch for per-instance data, transform feedback or float data textures for effector evaluation. A **CPU reference evaluator** (JS) exists for tests and for the Worker fallback.
- **Own GL context and resource pool**, separate from the kit engine, so a MotifGraph fault cannot corrupt kit rendering.
- **Render Worker parity.** The same evaluator code runs in the page and the render Worker (OffscreenCanvas), as the Sequencer does today. Exports and the render cache use the Worker path.
- **Budget governor.** Each graph reports an estimated cost (instances × modifiers × vertex density). The existing GPU budget governor can degrade quality (vertex density, instance LOD) before frames drop, never after export begins.
- **Failure containment.** Compile error, NaN, GL loss or budget breach quarantines that graph (passes the source through unmodified) and shows a badge, mirroring kit quarantine.

---

## 6. Feature set (by module family)

Every item is a **node type** registered in the module registry (section 8). IDs are stable and namespaced `mg.<family>.<name>`.

### 6.1 Sources and Geometry
| Node | Purpose |
| --- | --- |
| `mg.src.layer` / `mg.src.composite` | Source texture |
| `mg.geo.grid` | Subdivided plane (N×M) with UVs, the base for mesh deformation |
| `mg.geo.cards` | One quad per tile of the source (tiles, shards) |
| `mg.geo.glyphs` | One card per glyph for text layers (needs glyph atlas, 8.1 carry-over) |
| `mg.geo.cylinder` / `sphere` / `ribbon` | Wrapping surfaces for 3D-feel mapping |
| `mg.geo.alpha-mesh` | Mesh traced from source alpha (shaped fragments) |

### 6.2 Generators (Cloners)
Linear, Radial, Grid (2D/3D), Honeycomb, Spiral, Scatter (random, Poisson, weighted by source luminance or alpha), Along Spline (SVG path from 8.0 vector stack), Object (instances on the vertices or faces of a geometry node), Fracture (Voronoi shards of the source).
Common controls: count, offset, rotation, scale, step, seed, iteration mode (iterate, random, blend), clone **Instance vs Render-instance** mode, nested clones (cloner of cloner, limit depth 2 in 9.0).

### 6.3 Fields
Spherical, Box, Cone, Linear, Radial, Torus, Random, Noise (Perlin, Simplex, Worley, curl), Shader (any Motif style or texture as a field), Sound (band energy), Spline, Group. Each has falloff curve, remap, invert, clamp. Fields **layer and combine** (add, multiply, min, max, subtract) and are reusable by any modifier. Fields are first-class draggable viewport handles.

### 6.4 Effectors (instance modifiers)
Plain, Random, Step, Delay, Time-offset, Sound, Shader, Spline, Target, Push-Apart, Inheritance, Formula (safe expression language, data not JS). Each applies **position, rotation, scale, color, opacity, UV offset and visibility** weighted by a Field and a strength. Order matters and is explicit.

### 6.5 Deformers (vertex modifiers, scope-agnostic)
Bend, Twist, Taper, Bulge, Wave, Ripple, Noise, Spherify, Shear, Squash/Stretch, Lattice (free-form deform with draggable control points), Displace (by texture or field), Swirl, Pinch, Explosion, Melt, Polygon Reduction (stylize), Smooth. Each takes a Field mask and acts on the grid or on every clone.

### 6.6 Shading and Output
Per-instance color from palette, gradient, source sample or field. Opacity, blend mode (the 12 Motif blends), simple Lambert / rim lighting with 1–3 lights, depth fog, **motion blur** (accumulation or velocity-based), edge/outline, drop shadow, depth of field (post, G7).

### 6.7 Camera and Space
Orthographic and perspective camera with orbit / pan / FOV, per-graph or shared; 2D mode (default) stays screen-aligned. Keyframable and expression-driven.

### 6.8 Dynamics (bounded)
Springs and follow-through, simple rigid collisions with planes and field volumes, attractors, flocking-lite, bounded particle emission from instances, soft-body grid jiggle. Hard caps on counts. Baked and loop-closed.

### 6.9 Control and Interaction
- **Handles** in the viewport (field gizmos, lattice points, cloner extents).
- **Pointer** as a Field (attract, repel, ripple).
- **Audio** reactive via the existing band mapping.
- **Macros**: 4–8 exposed knobs per graph, mapped to any parameters, audio-mappable (carries the 8.0 review's macro suggestion).
- **MIDI / OSC** deferred to the live module (G8).

### 6.10 Presets and Packs
Preset library of full graphs and single nodes (Radial Array, Type Wave, Glitch Shards, Lens Ripple, Grid Cascade, Fractured Reveal), searchable with tags and thumbnails. Shareable as `.motifgraph` and later inside kits.

---

## 7. UX

1. **Layer inspector, MotifGraph tab.** A node **stack view** (ordered list: Source → Cloner → Fields → Effectors → Deformers → Shading), each row with enable, solo, parameters and a mini field preview. This is the default and keeps the app simple.
2. **Node graph view** (G5). Optional, for advanced wiring: fields into multiple modifiers, branches, merges. Stack and graph are two views of the same data.
3. **Composite scope.** A "MotifGraph" entry in the Finish panel and a Composite row at the top of the layer list.
4. **Viewport handles and gizmos.** Direct manipulation, snapping, numeric entry, undo/redo per drag.
5. **Timeline.** Every parameter is a normal Motif channel: keyframes, curves, Mutate, Evolve, Randomize, audio-band mapping all work.
6. **Safety UX.** The photosensitive limiter applies. Cost meter, quality dial and a "Safe mode" that bypasses all graphs.
7. **Agent surface.** MCP tools: `graph.create`, `graph.add_node`, `graph.set_param`, `graph.connect`, `graph.describe` (returns the tree and current values), `graph.apply_preset`, `graph.bake`. Output is deterministic JSON, so prompts produce diffable graphs.

---

## 8. Modularity and extensibility

### 8.1 Layout
```
src-v9/
  modules/graph/
    core/        registry, scheduler, evaluator interface, budget, quarantine
    gl/          context, buffers, instancing, float-texture utils
    cpu/         reference evaluator (tests, Worker fallback)
    nodes/
      src/ geo/ gen/ field/ fx/ deform/ shade/ cam/ dyn/    one file per node
    ui/          inspector stack, node view, handles, preset browser
    io/          serialize, schema, presets, MCP tools
  build/patch_graph.py       anchored patches into the 8.0 build (same method as patch_v8.py)
  tests/graph/
```

### 8.2 Node contract (stable)
```js
registerNode({
  id: 'mg.deform.bend', family: 'deform', version: 1,
  params: { /* typed, ranged, keyframable, with show-conditions as in kit controls */ },
  inputs:  ['geometry', 'field?'],
  outputs: ['geometry'],
  cost: (ctx, p) => number,          // feeds the budget governor
  glsl: { vertex: '...' },           // GPU path
  cpu: (ctx, p, data) => data,       // reference path, required for tests
  loop: { cycles: ['speed'] }        // declares which params must be whole cycles
})
```
A node **must** provide a CPU reference; the test harness diffs GPU against CPU.

### 8.3 Add-a-node in one file
Adding a deformer is one file under `nodes/deform/` plus a registry line. No change to core, UI or build. The inspector and the agent API are generated from `params`.

### 8.4 Versioned data format: `motif-graph@1`
Project JSON gains an optional `graph` block on a layer and an optional top-level `composite.graph`. Unknown node ids load as disabled placeholders (never crash, round-trip preserved), as unknown kits do today. Schema ships in `schemas/`.

### 8.5 Feature flags and kill switches
`graph.enabled` (global, default on in 9.0 beta, off until G2 ships), per-family flags, per-graph enable/solo, and the Safe mode bypass.

---

## 9. Safety: not risking the app

| Risk | Guard |
| --- | --- |
| Regressions in existing output | **Zero-cost-when-absent**: no MotifGraph node means the code path is not entered. `tests/v8/regression.mjs` runs unchanged; all 101 styles stay pixel-identical |
| GPU or driver faults | Separate GL context; quarantine passes source through; canary test-render before a graph draws, like kits |
| Runaway cost | Hard caps (instances, vertices, modifier depth, dynamics steps); budget governor; estimator warns before apply |
| Loop breakage | Cycle-typed params enforced by schema; loop-closure test in CI for every node |
| Photosensitivity | Limiter hooks into effector strobe, flash and rate-of-change |
| Untrusted packs | Data + GLSL only; static analysis; capability prompt (`graph`); no JS |
| Single-file size | Lazy-load the graph module; budget on `Motif.html` growth; split dev vs shipped build |
| Format drift | `motif-graph@1` versioned; migrations tested; unknown nodes preserved |

---

## 10. Performance budgets (1080p, mid-range GPU, software-GL for CI)

| Scene | Target |
| --- | --- |
| 10k instances, 3 effectors, 2 fields | 60 fps |
| 100k instances (instanced quads), 1 effector | 30 fps, adaptive LOD to hold 60 |
| Grid mesh 256×256 with 4 deformers | 60 fps |
| Composite-scope deform, 128×128 grid + 2 deformers | 60 fps, ≤ 2.0 ms GPU |
| Dynamics, 2k bodies | 30 fps preview; baked playback 60 fps |
| Graph with nothing enabled | 0 ms, no allocations |

`tools/bench.mjs` and `budgets.json` gain MotifGraph scenes; CI fails on budget regressions.

---

## 11. Quality and testing

1. **Regression:** 8.0 vs 9.0 pixel identity for every existing style and kit with no graphs.
2. **Determinism:** same project renders byte-equal frames across runs; seed isolation per node.
3. **Loop closure:** every node and every preset: frame 0 equals frame L within 8-bit tolerance.
4. **GPU vs CPU parity:** per node, on randomized params.
5. **Worker vs page parity:** as the Sequencer test.
6. **Browser checks (Playwright):** inspector, handles, undo/redo, save/open, duplicate, missing-node round trip.
7. **Fuzz:** random graphs for crash, NaN and budget enforcement.
8. **Golden gallery:** a preset gallery with reference frames; visual diffs reviewed by a human on change.
9. **Accessibility:** keyboard operation of the stack, field gizmo nudging, reduced-motion respect.

---

## 12. SDK integration (staged, after the engine is proven)

- **Kit format `motif-kit@5`** adds an optional `graph` section: presets of graphs (data only), custom **Field** shaders and **Displacement** shaders as GLSL snippets that run in the engine's sandboxed hook points, and new Cloner layouts as parametric data.
- New capability `graph`, shown at install; same static analysis, quarantine and canary as `@4`.
- `motif-kit new --example graph`, validator rules, schema, docs, and a reference kit ("Graph Lab").
- SDK emits nothing the host would run as JS. This keeps the existing safety statement true.

---

## 13. Export and delivery

| Target | Behavior |
| --- | --- |
| Video / image sequence / GIF | Rendered through the Worker path, loop-exact |
| Web player | Graph runs live in the player runtime (module is lazy-loaded) |
| Lottie / SVG | Not representable; graph is **rasterized** with a clear notice, or exported as baked instance transforms where the target supports it |
| Live (Wallcast) | Live mode with pointer, audio and macros |
| Project file | `graph` block saved; unknown nodes preserved |

---

## 14. Staged delivery

Each stage is independently shippable behind the flag and ends with the regression suite green. Nothing later blocks anything earlier.

| Stage | Name | Scope | Exit criteria |
| --- | --- | --- | --- |
| **G0** | Foundations | Registry, `motif-graph@1` schema, separate GL context, CPU evaluator, quarantine, flag, empty inspector tab, build patch, test harness, bench scenes | Regression identical with module present; a no-op graph passes source through; CI wired |
| **G1** | Mesh deform on a layer | `mg.geo.grid`, 6 deformers (Bend, Twist, Wave, Noise, Bulge, Displace), Layer scope, stack UI, keyframing, loop-cycle enforcement | Loop closure and GPU/CPU parity per node; 60 fps on the budget scene |
| **G2** | Cloners | Linear, Radial, Grid, Scatter instanced draws; per-instance transform/color/opacity; mask and blend | 10k instances at 60 fps; save/open; Worker parity |
| **G3** | Fields and Effectors | Core field set, Plain/Random/Step/Delay/Sound/Time effectors, field layering and remap, handles | Effectors drive position/rotation/scale/color/opacity; audio mapping works; undo/redo |
| **G4** | Composite scope | Pre-finish and post-finish composite graph, composite row UI, cost cap | Composite deform within 2.0 ms; finishing stack unaffected when absent |
| **G5** | Node graph view and presets | Node view over the same data, preset browser, macros, 12 launch presets | Round trip stack ⇄ node view lossless; preset gallery with golden frames |
| **G6** | Dynamics (bounded) | Springs, attractors, simple collisions, bounded particles; bake with checkpoints and loop closure | Scrub exactness; export equals preview-bake; caps enforced |
| **G7** | Look and camera | 3D camera, lighting, motion blur, DoF, per-glyph geometry, Spline cloner (vector stack), Fracture, Lattice | Camera keyframing; motion blur exact in export |
| **G8** | SDK 5.0 and Live | `motif-kit@5` graph section, `graph` capability, Graph Lab kit, MIDI/OSC and pointer recording, web-player runtime | Kit validates and canary-passes; live mode demo; player parity |

**As built in Motif 9.0** (this PRD's original wording stays above for the roadmap):

| Stage | Status | Notes |
| --- | --- | --- |
| G0 | Shipped | Registry, `motif-graph@1` schema (generated), separate WebGL2 context, CPU reference evaluator, quarantine, anchored build patch, unit + browser + regression tests, bench. Flag: a project without a graph never enters the code. |
| G1 | Shipped, beyond plan | 13 deformers (bend, twist, swirl, taper, shear, squash, wave, ripple, noise, bulge, spherify, lens, displace) instead of 6; layer scope; keyframable; loop-exact. |
| G2 | Shipped | Grid, honeycomb, linear, radial, spiral, sunflower, scatter; tiles / whole / dots content; up to 16,384 clones in one instanced draw. |
| G3 | Shipped except handles | 9 field types with sweep / orbit / pulse and combine; plain, random, step, delay (with spring), noise and sound effectors; per-clone tint (palette slot, cycle, ramp). **Not yet:** viewport handles and the pointer field (the preview renders in the Worker; needs a protocol extension). |
| G4 | Shipped | One composite graph, before or after the finishing stack; motion blur through the shutter samples. |
| G5 | Partial | 12 presets, Vary (mutate the stack), command-palette entries, automation surface. **Not yet:** node-graph view, macros, preset thumbnails. |
| G6 | Not started | Delay's spring shape gives loop-exact follow-through; no solver yet. |
| G7 | Partial | Perspective camera with orbit/pan, lighting from the deformed surface, depth sorting. **Not yet:** depth of field, per-glyph geometry, spline cloner, fracture, lattice. |
| G8 | Not started | `motif-kit@5` graph section, `graph` capability, Live inputs. |

**Beta policy:** G1–G2 ship as "MotifGraph (beta)" behind the flag. Stable only when G0–G4 pass the full test and budget gates.

---

## 15. Milestone timeline (indicative, 1–2 engineers)

| Stage | Estimate |
| --- | --- |
| G0 | 1.5–2 weeks |
| G1 | 2 weeks |
| G2 | 2 weeks |
| G3 | 3 weeks |
| G4 | 1.5 weeks |
| G5 | 2.5 weeks |
| G6 | 3–4 weeks |
| G7 | 4 weeks |
| G8 | 3 weeks |

First useful demo (layer deform + cloner, G0–G2): about 6 weeks.

---

## 16. Success metrics

- **Parity:** 90% of a defined set of 20 canonical MoGraph looks reproducible in ≤ 5 minutes each.
- **Speed:** 95th-percentile preview frame ≤ 16.6 ms on budget scenes.
- **Safety:** 0 regressions in the existing pixel suite; 0 unhandled graph faults in fuzz runs.
- **Agent:** ≥ 80% of 50 benchmark prompts produce a valid, loop-exact graph on the first try.
- **Adoption:** share of projects with ≥ 1 graph; preset reuse rate.

---

## 17. Risks and open questions

| # | Risk / question | Mitigation / proposal |
| --- | --- | --- |
| 1 | Float-texture and transform-feedback support varies (Safari, mobile) | CPU reference path, capability probe, graceful quality tiers; Safari/Firefox testing is already an open item since 7.0 |
| 2 | Composite scope doubles GPU cost | One composite graph, cost cap, adaptive vertex density, pre-finish default |
| 3 | Dynamics vs loop exactness | Bake and cyclic closure; live mode flagged "not export-exact" |
| 4 | Single-file size growth | Lazy-loaded module, tree-shaken node set, size gate in CI |
| 5 | Per-glyph type depends on the glyph atlas (8.1 carry-over) | G7 dependency; ship card/tile modes first |
| 6 | Scope creep toward a 3D DCC | Non-goals above; 2.5D focus; revisit after G8 |
| 7 | Formula effector language safety | Small closed expression grammar, evaluated in GLSL and CPU, no loops |
| 8 | Name `MotifGraph` vs the Sequencer and the existing "graph" in `@2` pass graphs | Keep user-facing "MotifGraph"; internal id prefix `mg.`; the `@2` pass `graph` stays "pass graph" in docs |

**Decisions needed:** (a) one composite graph vs several in 9.0; (b) default composite position (pre- or post-finish); (c) whether G1 ships to all users or stays beta until G2; (d) engineer allocation.

---

## 18. Appendix: canonical looks (acceptance set)

1. Radial array of a logo with a delayed scale-in.
2. Grid of title tiles rippling to the kick.
3. Type wave bend on a headline.
4. Lens ripple on the whole composite following the pointer.
5. Fractured reveal of the final frame.
6. Honeycomb cloner with luminance-driven scatter.
7. Twist and taper of a video layer.
8. Spring-follow trail of cloned shapes.
9. Noise-displaced composite with stable loop.
10. Sound-driven bulge on the beat with the photosensitive limiter on.
(+10 more defined during G0.)
