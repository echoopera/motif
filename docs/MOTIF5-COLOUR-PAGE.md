# Motif 5 — Grade page (colour page), scopes and LUTs

Lane: colour (creative tools, data visualization, web engineering). Branch `lane/colour`.

## What it is
A Resolve-style colour page in the inspector (`Grade` tab, next to the palette `Colour` tab):
GPU scopes strip → node graph → selected-node inspector → LUT slot. The grade renders inside the existing
finish shader, so the stage, the render cache, scopes and every export show the same pixels.

## Modules
| File | Role | Environment |
|---|---|---|
| `src-v5/modules/11a-grade.js` | Grade model + sanitiser, GLSL codegen, GPU grader (owned by the finisher), `.cube` / `.3dl` / HALD parsing, `.cube` writer, LUT registry | Engine-side, no DOM / window |
| `src-v5/modules/11a-scopes.js` | Waveform, RGB parade, vectorscope, histogram on WebGL2; label layout as data | Engine-side, any canvas incl. OffscreenCanvas |
| `src-v5/modules/20-colour-page.js` | The page (`__m_shell.use({ id: 'grade' … })`), LUT persistence (IndexedDB `motif5-luts`), styles | DOM |

Hunks in shared files (all additive): `07-timeline.js` (G: paths, optional `grade` block, evaluate),
`11-finish.js` (two marker comments in `FS_FINAL`, grader hookup, `draw()` accepts 3D textures and vec4 arrays,
`needsGpu` sees an active grade), `14-shell.js` (ext `tick`/`init`/`commands`, `bindRows` on extension panels,
row helpers on the extension API, G: values in `valueFromEval`, G: rows lockable, extension pages in ⌘K).

## Project format (additive, versioned)
```
project.grade = { v: 1, on: true, nodes: [ { id: 'n1', type: 'primary', par: false, params: {…} },
                                          { id: 'n2', type: 'lut', lut: { id: 'lut_…', name, size }, params: {…} },
                                          { id: 'n3', type: 'mixer', src: 'in' | '<earlier node id>', params: {…} } ] }
```
* Absent in v3–v5 projects and never added by the sanitiser: those projects round-trip byte-identically and render
  bit-identically (tested against the base build).
* Every node parameter is a channel at `G:<nodeId>:<key>`: keyframes, auto-key, audio maps, locks, undo, presets.
* Node types: `primary` (lift / gamma / gain / offset wheels + masters, contrast, pivot, saturation, hue),
  `curves` (luma + RGB, 5 points each), `huesat` (hue vs sat, hue vs hue), `qualifier` (HSL key with softness,
  invert and key blur; correction inside the key), `lut`, `mixer` (10 blend modes over IN or an earlier node).
  Every node has `on` and `mix` (opacity). `par: true` runs a node in parallel with the one before (outputs averaged).
* Limits: 12 nodes, 4 LUT nodes, 3 blurred qualifier keys (later ones stay sharp, the UI says so).
* The existing Finish grade (black / white / gamma / gradient map) is node 0, `Levels`, shown in the graph and
  edited there; it still lives in `finish`.

## Rendering
* One pass: the graph is compiled to a `gradeAll()` GLSL function injected into `FS_FINAL` after the gradient map,
  before vignette, grain, legaliser and zebra. Parameters are a `vec4` uniform array, so value edits and keyframes
  never recompile; the program is cached by topology.
* Blurred qualifier keys add a quarter-resolution key pass + two separable blurs per key.
* LUTs: 3D as `RGB16F` 3D textures (tetrahedral via `texelFetch`, or hardware trilinear); 1D shaper as a 1×N
  texture; domain min/max honoured. A LUT node whose table isn't in this browser passes the image through and the
  page shows a designed "missing" state.
* Export `.cube`: the same compiled grade (plus Levels) is evaluated on a 33³ lattice in a float framebuffer.

## Scopes
Downsample the finished stage canvas (mipmapped) to a sample grid, scatter one point per sample with
`gl_VertexID` into float targets with additive blending, then shade. Only the 256-bin histogram (4 KB) is read
back, for the numeric readout. Live grid 320 wide at ≤ 10 Hz while playing (1 Hz under reduced motion, and never
more often than 4× the last update's cost); paused or scrubbing gets a live update immediately and the exact grid
(up to 1024 wide) after 160 ms of stillness. Rec.709 / P3 interpretation sets both the upload colour space and the
luma / chroma weights. Labels are DOM.

## Tests
* `node --test tests/*.test.mjs` — includes `tests/grade.test.mjs` (parser, writer, sanitiser, G: paths, codegen).
* `SOFTWARE_GL=1 PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tests/browser/grade-check.mjs`
  (optionally `BASE_HTML=<older motif5.html>` for the cross-build identity check). Not yet wired into
  `package.json` / CI: suggested script `"test:grade": "SOFTWARE_GL=1 node tests/browser/grade-check.mjs"`.

## Not done / known limits
* No GPU-hardware numbers: every timing so far is SwiftShader (software). Shader compile on a topology change
  measured ~0.9 s there; expect tens of ms on hardware, but it is a hitch when nodes are added.
* LUT tables live in IndexedDB per browser (like media). Preset JSON carries the reference, not the table; opening
  a preset elsewhere shows the "LUT missing — import again" state.
* No on-stage key "highlight" view, no node-graph mouse wiring (structure is edited with buttons / keys), no
  split-screen wipe (A/B is a bypass toggle, recorded in undo).
* Without WebGL2 the grade cannot render (the page says so); the CPU fallback path ignores it.
