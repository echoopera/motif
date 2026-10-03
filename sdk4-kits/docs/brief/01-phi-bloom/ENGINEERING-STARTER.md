# Phi Bloom Engineering Starter

Read PRD.md and ../ENGINEERING-FOUNDATION.md before implementing. This is an algorithm and integration plan, not a verified manifest schema. Proposed controls must be adapted to confirmed SDK keys and units.

## Baseline and first implementation task

REFERENCE.png is the delivered genuine WebGL render. PROTOTYPE.frag explains its current procedural construction and is disposable starting code. Remove hardcoded palette, standalone #version/entrypoint assumptions and display gamma conversion before SDK integration. Do not assume current endpoint or performance approval. First create the smallest SDK-native hero that compiles, renders and has one visible form control and one visible periodic motion control.

## Mathematical construction

Golden-angle positions a_n=n*2.399963229728653, r_n=s*sqrt(n); logarithmic spiral r(a)=r0*exp(b*a) supplies a separate controllable scaffold. Phyllotaxis and logarithmic spirals are distinct constructions; expose them separately.

Write the scene's field class beside its function and derive any required bound. Keep static seed-derived offsets separate from loop phase. Position, normal, material and visibility calculations use the same deformed domain so highlights follow the geometry.

## Renderer and layer decomposition

Screen-space analytic petal SDFs for Live; a bounded 3D petal shell field for Hero. Cull petals by angular/radial bins before shading; compare local-neighbor evaluation with a bounded explicit petal count. Preserve depth order and avoid treating alpha blending as geometric occlusion.

Layer stack:

1. Ground: palette background with controlled depth/color separation.
2. Form: project-specific analytic geometry or field, with stable seeded identities.
3. Material: authored response matching the PRD; separate surface and emission terms.
4. Light: coherent key and restrained rim, plus justified occlusion/shadow approximation.
5. Atmosphere: only where it clarifies depth; zero density is a valid control endpoint.
6. Finish: tone map once, restrained bloom where emissive, full-resolution output edges.
7. Motion: shared bounded phase and project-specific closed trajectories.

For the hardest renderer choice, prototype two options at equal render scale and compare silhouette stability, detail and measured cost. Select on evidence rather than technique prestige.

## Loop construction

Closed azimuthal rotation of the complete field; petal breathing follows sin(theta+seedPhase), with a secondary closed camera orbit. If full rotation is used, angular speed is an integer number of turns per loop. A bounded radial unfold must return through a visually motivated fold rather than resetting growth.

Use theta=2*pi*fract(u_p). Parameterized temporal frequency is integer. A fixed fractional static angle is allowed; a fractional complete rotation over the loop is not. If a bounded excursion is intended, use a periodic oscillator instead. Make endpoint position and derivative tests for each motion path. Preserve all stable IDs through wrapping and fades. No linear unbounded time or mutable random stream.

## Proposed project controls

Values are initial look-development hypotheses, not validated final bounds. Scene distances are normalized units; px controls are explicit screen-space widths. Integer spatial counts are distinct from integer temporal cycle counts.

| Control | Type | Initial range | Hero default |
|---|---|---|---|
| Petal count | int | 48–240 | 144 |
| Spiral pitch | float | 0.08–0.35 | 0.18 |
| Blade length | float | 0.03–0.16 | 0.075 |
| Blade taper | float | 0.15–0.9 | 0.5 |
| Depth spacing | float | 0.02–0.3 | 0.12 |
| Translucency | float | 0–0.75 | 0.3 |
| Rim intensity | float | 0–2 | 0.7 |
| Breath amplitude | float | 0–0.12 | 0.035 |
| Turns per loop | int | 0–2 | 1 |

Add shared key direction, exposure, bloom and quality only where useful and within the base parameter budget. Quality/structural selectors use mutate:0. Do not add reserved host parameters. Tie every control to one named stage and render min/default/max evidence; remove any ineffective control.

## Quality and performance approach

Provide Live and Export settings with the same phase, seed and composition. Live reduces scene scale, sample count and subordinate detail before changing the primary form. Export raises resolution and sampling without changing brightness. Do not multiply emission by quality. Bound scene work and early-out rays. Record total nested iterations/fetches before validating; stay under half of playbook hard limits.

Measure on real hardware using the shared method. The supplied stills were software-rendered and are not performance evidence. If the selected algorithm misses the live target, compare a cheaper form-preserving renderer before cutting the scene's identity.

## Project-specific failure tests

Petal ordering, alpha overdraw and silhouette aliasing; detail must survive at phone render scale without turning into glitter.

Mandatory targeted checks: The golden-angle arrangement remains legible at three phases; near petals occlude far petals; width and depth controls produce distinct material and spatial changes. Also compare the hero with material/atmosphere disabled to reveal whether structure survives independently. Compare deterministic frame hashes or pixel deltas under nonsequential seeking. Cover seed and parameter extremes, especially structural thresholds that can cause discontinuities.

## Implementation sequence

1. Verify installed SDK manifest, helpers and graph contract; run its bundled example.
2. Build ground/form only and render phase 0, 0.125, 0.25, 0.5, 0.75 and 1.
3. Implement closed hero and secondary motion; test seam and velocity before adding effects.
4. Add coherent material/light/depth; calibrate exposure at min/max quality.
5. Bind proposed controls and authored palettes, then prove each control visually.
6. Complete Live/Export branches; measure device cost and run worst-case flash/pop audit.
7. Create eight derivatives with approved fingerprints; rerun QA for every entry.
8. Pack the SDK kit, build the animated product page and inspect films and stills.

## Expected source layout

Use the SDK's actual filename and manifest conventions after discovery. Organize source conceptually into kit metadata, shared field/material/motion helpers, nine style implementations, palette presets and QA evidence. Keep generated build output out of reusable source. Exact paths from the playbook are examples, not guaranteed in the recipient's repository.

## Completion evidence

Deliver the .motifkit and source with validated contract map, field-class/bound notes, pass plan, loop/pops/flash results, exposure comparisons, per-control captures, device timings and known approximations. State whether every gate passed; an unavailable check remains unverified. Include two alternative renderer/look directions only if they clarify a remaining tradeoff.
