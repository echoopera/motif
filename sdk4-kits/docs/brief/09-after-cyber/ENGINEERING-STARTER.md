# After Cyber Engineering Starter

Read PRD.md and ../ENGINEERING-FOUNDATION.md before implementing. This is an algorithm and integration plan, not a verified manifest schema. Proposed controls must be adapted to confirmed SDK keys and units.

## Baseline and first implementation task

REFERENCE.png is the delivered genuine WebGL render. PROTOTYPE.frag explains its current procedural construction and is disposable starting code. Remove hardcoded palette, standalone #version/entrypoint assumptions and display gamma conversion before SDK integration. Do not assume current endpoint or performance approval. First create the smallest SDK-native hero that compiles, renders and has one visible form control and one visible periodic motion control.

## Mathematical construction

Stable lattice nodes use a closed parametric displacement field. Each node has a continuous attachment weight; neighboring connections attenuate smoothly as the node disperses. A bounded convex polyhedron provides a separate facet surface.

Write the scene's field class beside its function and derive any required bound. Keep static seed-derived offsets separate from loop phase. Position, normal, material and visibility calculations use the same deformed domain so highlights follow the geometry.

## Renderer and layer decomposition

Bounded node neighborhoods and projected or ray-intersected edge capsules; separate glass surface and emission terms. Use an inexpensive local reflection/refraction approximation initially, with explicit quality tier and depth occlusion. Avoid full-screen all-pairs connection searches.

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

One dissolve-transport-reassemble cycle with zero-velocity holds. Particles follow closed curves with fixed seeded phase offsets; object and nodes return to original positions and opacity at the seam.

Use theta=2*pi*fract(u_p). Parameterized temporal frequency is integer. A fixed fractional static angle is allowed; a fractional complete rotation over the loop is not. If a bounded excursion is intended, use a periodic oscillator instead. Make endpoint position and derivative tests for each motion path. Preserve all stable IDs through wrapping and fades. No linear unbounded time or mutable random stream.

## Proposed project controls

Values are initial look-development hypotheses, not validated final bounds. Scene distances are normalized units; px controls are explicit screen-space widths. Integer spatial counts are distinct from integer temporal cycle counts.

| Control | Type | Initial range | Hero default |
|---|---|---|---|
| Lattice resolution | int | 6–18 | 10 |
| Connection radius | float | 0.03–0.2 | 0.09 |
| Dispersal radius | float | 0–0.5 | 0.2 |
| Particle radius | float | 0.001–0.01 | 0.003 |
| Edge radius | float | 0.001–0.01 | 0.002 |
| Glass opacity | float | 0–0.55 | 0.16 |
| Refraction strength | float | 0–0.12 | 0.035 |
| Lime fraction | float | 0–0.35 | 0.12 |
| Reconstructions per loop | int | 1–3 | 1 |

Add shared key direction, exposure, bloom and quality only where useful and within the base parameter budget. Quality/structural selectors use mutate:0. Do not add reserved host parameters. Tie every control to one named stage and render min/default/max evidence; remove any ineffective control.

## Quality and performance approach

Provide Live and Export settings with the same phase, seed and composition. Live reduces scene scale, sample count and subordinate detail before changing the primary form. Export raises resolution and sampling without changing brightness. Do not multiply emission by quality. Bound scene work and early-out rays. Record total nested iterations/fetches before validating; stay under half of playbook hard limits.

Measure on real hardware using the shared method. The supplied stills were software-rendered and are not performance evidence. If the selected algorithm misses the live target, compare a cheaper form-preserving renderer before cutting the scene's identity.

## Project-specific failure tests

Particle births, changing neighbor identities and unbounded edge cost; derive adjacency from stable lattice IDs, not fluctuating nearest neighbors.

Mandatory targeted checks: Connections follow particle displacement coherently; dissolve and reconstruction are visibly different states; far particles are occluded by foreground forms where intended. Also compare the hero with material/atmosphere disabled to reveal whether structure survives independently. Compare deterministic frame hashes or pixel deltas under nonsequential seeking. Cover seed and parameter extremes, especially structural thresholds that can cause discontinuities.

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
