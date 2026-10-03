# Motif SDK 4 Engineering Foundation

Version 1.0 · 3 October 2026 · Agent implementation contract

This document governs nine independent shader projects. Build seamless infinite playback using bounded periodic phase; do not interpret infinite playback as perpetual nonrepeating state. The accompanying PRDs define appearance and motion. The engineering starters identify algorithms and risks. The supplied PLAYBOOK.md is the authoritative project guidance used for these documents. Exact manifest and graph syntax must be verified against the installed SDK before implementation.

## Source status and constraints

The nine PNGs are genuine WebGL2 renders at 1440 × 2560. They establish procedural form and composition, not finished visual quality. The earlier generated concept board is an aspirational look target; the actual renders are the implementation starting point. The standalone .frag files are prototypes: hardcoded color, standalone version/output declarations, expensive point loops and incomplete material/depth models require replacement. Do not simply wrap them into a kit.

Existing verification compiled all nine and showed phase-dependent motion. Endpoint image strings were identical for Phi Bloom, Sacred Lattice, Topological Tide, Deconstruct Field and Post-Punk Resonance. Harmonic Matter, Astral Threshold, Cellular Cosmos and After Cyber differed. That check did not measure the differences or establish that they were perceptible. Therefore no existing prototype is accepted as a fully QA-approved SDK kit; reproduce and quantify seam differences, including adjacent-frame continuity, before release.

## SDK discovery gate

1. Locate Motif Kit SDK 4.0.0 and its bundled graph/style examples. Read the actual schema, GLSL entrypoint, palette binding, parameter generation, graph pass API and flash helpers.
2. Confirm Motif 8 / motif-kit@4 target. Run a minimal bundled example with the installed validator and preview renderer before writing new manifests.
3. Build a contract map recording confirmed keys and generated uniforms. Do not infer style entrypoints, buffer names or graph keys from these standalone shaders.
4. If a required feature is absent, implement the best compatible approximation and record the loss. No runtime changes are authorized by this handoff.

## Seamless infinite playback

Normalize phase using p=fract(u_p), theta=2*pi*p. Position, normals, material, density, camera, light and visibility must all return at the boundary. Require equal value and first derivative at p=0 and p=1 for smoothly moving elements; static holds have zero endpoint velocity. Every time harmonic is an integer multiple of theta. Spatial frequencies, static rotations and fixed phase offsets may be noninteger. Never multiply theta by a fractional rotation rate and assume it loops.

Examples of valid time constructions:

```glsl
float p = fract(u_p);
float theta = 6.28318530718 * p;
float breath = sin(theta * float(cycles) + seededPhase);
vec2 temporalDomain = vec2(cos(theta), sin(theta));
float w = 0.5 - 0.5 * cos(theta); // closed excursion with zero seam velocity
```

For a return trajectory use start + displacement*w; for complete rotation use theta*integerTurns. Loopable temporal noise samples a closed domain, not a linearly moving time coordinate. Particle wrap requires a spatially periodic domain and stable wrapped IDs. Scrolling an unwrapped hash cell grid is forbidden. Birth/death visibility must reach zero smoothly before an ID changes. A symmetric return can use smoothstep envelopes or quintic segments, but must not visibly stall all layers at once.

No persistent simulation is available under the playbook contract: graph iterate resets every frame. Within-frame relaxation requires feedback capability and seeds at u_iter==0. Cellular lifecycles and reconstructing particles must be deterministic periodic choreography. Record true persistent simulation as an SDK proposal.

## Rendering and field classes

Label every scene function exact, bound, implicit, density or glow. Use AM_MARCH for exact signed distance, AM_MARCH_L with a derived conservative Lipschitz bound, AM_SEGMENT for zero sets without valid bounds, AM_VOLUME for extinction/emission and AM_GLOW only as an explicitly aesthetic heuristic. Prove bounds for transformations and combined fields. A smaller step multiplier is not proof.

Keep opaque surface shading and emissive atmosphere separate. Volumes integrate with ray-step length and transmittance; emission per iteration without step normalization is forbidden. Cull against a bounding sphere/box before marching. Normals and denominators require finite-safe inputs. No reversed smoothstep edges, unbounded pow/sqrt/log inputs, growing time, recursive shaders or data-dependent while loops.

## Color, material and output

Use u_bg, u_ink, u_a0, u_a1, u_a2 and declared color parameters. Initial palettes derive from the PRD; maximum eight per kit. Interpolate color in OKLab. Maintain coherent key/fill/rim directions. Dielectrics support diffuse plus specular; metal uses specular energy without diffuse. Glass is explicitly approximate unless the implementation supports correct transport.

Work in linear space and tone-map once at the output stage; return premultiplied linear RGBA as required by the SDK. The runtime handles sRGB conversion. Remove the standalone prototype's gamma conversion and avoid double tone mapping. Verify actual SDK helper signatures before integration.

## Graph plan and controls

For luminous projects start with scene at 0.5–0.75 scale, bright at 0.25, glow at 0.125 and output at 1.0. These are design ratios, not invented manifest syntax. Crisp graphic projects should retain full-resolution analytic edges. Bloom radius must use actual source/output texture ratios. Keep scene complexity intact before reducing aesthetic detail; first lower scene scale and sample count.

Group controls Form, Material, Light, Motion, Lens and Quality. A typical style uses 10–20 meaningful controls, up to 32 under the base contract. Proposed ranges in each starter are design targets in normalized scene units unless stated in pixels; tune from rendered evidence. Add hints, perceptually even scales and tasteful randomization bounds. Structural modes, quality and sample count use mutate:0. Never redeclare reserved palette, invert, tempo, phase, seed, zoom, rotate or loop params. Integer temporal controls use names such as Turns per loop.

## Capability and budget guardrails

Default generated styles need no media, text, vector or audio capability. Declare only what is actually used. Feedback is needed only for a genuine graph iterate buffer. No external geometry/instancing APIs are presumed available in a style.

Playbook limits: 4096 trips per loop; 32768 iterations and 2048 fetches per pixel. Stay below half of each limit, including combined nested work. Up to eight buffers, eight passes, 32 executions per frame; 96 KB per GLSL file and 3 MB per kit. One kit contains nine styles and at most eight palettes. Constant or validated parameter bounds only. The SDK validator decides admissibility.

Live goal: below 4 ms GPU cost at 1080p on a documented real device. Broadcast goal: below 16 ms under the same documented setup. These are targets, not measured claims. Report hardware, browser, render scale, resolution, warm-up, median and p95 GPU time. Software/headless timings are relative diagnostics only. Phone delivery targets a measured stable frame cadence under the full app; adjust effective resolution before promising 60 fps.

## Verification gates

- Validate schema, sandbox and compilation for every style, palette and sequence.
- Render hero and multiple alternate phases; inspect silhouette, hierarchy, material and depth before tuning numeric similarity.
- Test phase 0 versus 1 with identical seed/params. Run am qa seam gate: Delta0, failure above 1.5 per the playbook. Capture exact metric definition and raw result from the installed tool; do not invent units. Also inspect p=1-epsilon, 0, epsilon and compare seam velocity against nearby frame velocities.
- Film one complete default loop and two repeats, then worst-case one-second loop at 4x tempo. Pop ratio target below 3, failure above 6. Flash audit: fewer than four tiles above three flashes per second, with one to three tiles recorded as warnings.
- Compare exposure at minimum/maximum quality; stay within ±15%. Preserve form at min quality.
- Exercise every control at min/default/max and tasteful randomized presets. Each control visibly changes its intended property without introducing NaNs, clipping, seams or invalid topology.
- Test portrait 9:16, square and landscape 16:9, high DPR, resize, context loss/restore, background/resume and rapid style selection.
- Preview pending compilation is Preparing, never failed; poll frames with a 20-second retry deadline. Cancel stale selection jobs, cache good programs, rebuild targets on context restoration and suspend hidden-tab work. Never show a still as evidence of running animation.

## Build order and commands

Confirm local paths before running these playbook examples; they are repository-relative patterns rather than guaranteed paths in this package.

```sh
node agent-motif/tools/am.mjs new kits/<kit-id> --id <kit-id>
node agent-motif/tools/am.mjs lib build color noise light post sdf motion field --append kit.glsl --out common.glsl
node agent-motif/tools/am.mjs frame kits/<kit-id> hero --w 1080 --h 1920
node agent-motif/tools/am.mjs qa kits/<kit-id>
node Motif3/sdk/motif-kit-sdk-4.0.0/bin/motif-kit.mjs validate kits/<kit-id>
node Motif3/sdk/motif-kit-sdk-4.0.0/bin/motif-kit.mjs preview kits/<kit-id>
node Motif3/sdk/motif-kit-sdk-4.0.0/bin/motif-kit.mjs pack kits/<kit-id> --out dist
```

Ship one hero vertical slice first, with real controls, default loop and measured renderer. Then build eight structurally distinct derivatives, followed by all palettes and optional reel. Final artifacts: .motifkit, source kit, standalone one-page HTML showcase, 1440 × 2560 stills, looping films, validator/preview/QA outputs, parameter matrix, cost measurements and known limitations. Preview every finished artifact. No delivery claim may substitute compile success for aesthetic or motion QA.
