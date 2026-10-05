# Motif 9.0

Motif 8.0.0 plus MotifGraph. Projects, kits and presets from Motif 3 to 8 open as before; one self-contained file, `Motif.html`.

## MotifGraph (new)
- **A real-time procedural motion-graphics engine, on a layer or on the whole composite.** Stage, Cloner, Fields, Effectors, Deformers: 30 node types, 12 presets. See [docs/MOTIFGRAPH.md](docs/MOTIFGRAPH.md) and the generated [node reference](docs/MotifGraph-nodes.md).
- **Cloner:** grid, honeycomb, linear, radial, spiral, sunflower, scatter; clones show their tile of the picture (a grid reassembles it exactly), the whole picture, or a halftone dot sampled from it. Up to 16,384 clones in one instanced draw.
- **Effectors** (plain, random, step, delay, noise, sound) move, rotate in 3D, scale, fade and tint clones, weighted by **fields** (sphere, box, linear, radial, noise, random, index, the picture's own brightness, stripes) that sweep, orbit, pulse and combine.
- **Deformers** (bend, twist, swirl, taper, shear, squash, wave, ripple, noise, bulge, spherify, lens, displace) act on the whole array or on each clone, optionally weighted by a field. Stage adds a perspective camera, lighting from the deformed surface, depth sorting and edge handling (stretch, mirror, repeat, transparent).
- **Every parameter is a project channel** (`M:<layerId|@>:<nodeId>:<key>`): keyframes, audio maps, undo, save/open, presets. Motion is whole cycles per loop: frame 0 equals frame L; hashing and noise are integer-exact.
- **Layer scope** deforms a layer before its mask and blend; **composite scope** deforms the composited frame before or after the finishing stack (one per project). Motion blur from the finishing stack's shutter samples works unchanged.
- **Safe by construction:** zero cost when no graph exists (8.0.0 and 9 render identical pixels for all styles), its own WebGL2 context, quarantine to pass-through on failure, vertex budget with mesh-detail fallback, unknown node types preserved on save.
- **Graph page** in the inspector: layer/composite switch, preset and add menus, a stack with enable, reorder, duplicate, reset and remove, field references, cost readout, keyboard-operable menus. Command-palette entries for presets and common nodes. `__lab.graph` automation surface.

## Under the hood
- `src-v9/` rebuilds `Motif.html` from the 8.0.0 build (`python3 src-v9/build/patch_v9.py src-v9/Motif-8.0.0.html Motif.html`, 34 anchored patches). New modules: `graph-engine.js` (registry, schema, CPU reference, GLSL, renderer, presets) and `shell-graph.js` (the page). Timeline, compositor and pipeline get small, additive hooks.
- Schemas: `motif-graph-1.schema.json` (generated from the registry) and `graph` on the project and layer in `motif-project.schema.json`.

## Tests (`tests/v9`)
- `node --test tests/v9/unit.test.mjs`: 13 engine contracts (registry, sanitize, unknown nodes, hash goldens, loop closure of every node, cloner geometry, fields, effectors, deformers, presets, budget, paths).
- `node tests/v9/browser.mjs` (Playwright, software GL): GPU vertex stage against the CPU reference across every node configuration, determinism, pass-through, loop closure and seam continuity of all presets in both scopes, layer/composite/mask/mix/finish-order semantics, keyframes and audio on graph channels, save/open, unknown nodes, the inspector (presets, edit, add, disable, remove, undo, scope, field refs, keyboard), render Worker versus main thread, budget cap, GPU context loss and recovery.
- `node tests/v9/regression.mjs`: Motif 8.0.0 against 9: kit validation byte-identical, every style renders identical pixels.

## Known limits
- No viewport gizmos or pointer field yet: the live preview runs in the render Worker, so pointer input needs a Worker protocol extension (planned with the node-graph view).
- No dynamics (springs, collisions, particles) and no per-glyph geometry yet; the Delay effector's spring shape gives loop-exact follow-through.
- Real-GPU budgets, Safari and Firefox remain untested, as since 7.0 (software GL only).
- Lottie and SVG export rasterize a graph.
