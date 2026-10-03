# Topological Tide Product Requirements

Version 1.0 · Proposed implementation brief · Motif Kit SDK 4.0

## Product outcome

Create ceramic and reflective continuous surfaces weave through a sculptural field of perforations and curved passages. The finished output is a genuine real-time procedural animation that loops seamlessly for indefinite playback. The deliverable is a nine-style Motif kit: one flagship style matching this direction and eight differentiated treatments. Build and approve the flagship first; variants reuse proven rendering modules but change form or motion grammar, not only color.

## Users and use cases

Motion artists use the kit for ambient installations, looping album visuals, live performance layers, title backgrounds and high-resolution exports. An artist can select a strong default, change structure/material/motion through meaningful controls, and continue playback without a visible reset. Phone previews and desktop export share the same composition but use separate quality budgets.

## Visual requirements

Ivory ceramic, cobalt shadows and controlled copper reflections; expose interior cavities and contact shadows. Avoid cropping so tightly that the surface reads as a flat patch.

Use REFERENCE.png as the actual procedural baseline. Improve it toward the earlier concept direction through material, lighting, depth and fine structure; do not preserve prototype shortcuts solely because they compile. The target hero remains legible as a thumbnail and richly detailed at 1440 × 2560. Detail follows the underlying form instead of being a noise overlay. No added distress or gratuitous texture. Brightest, sharpest and most saturated regions share one focal area. Bloom supports emission rather than hiding geometry.

## Motion requirements

Closed object rotation plus bounded periodic shell thickness and warp; changes should feel like continuous material flow. Topological changes, if included, pass through smooth necking rather than discontinuous boolean switches.

Default duration: 12 seconds, configurable through Motif host loop controls. Support 6–30 second artistic loops, with 1-second/4x stress testing for compatibility and flash QA. Secondary motion remains subordinate to the hero, and ambient life stays below roughly 20% of visual energy. Every animated property and the camera are periodic. Equal initial/final value alone is insufficient: require smooth seam velocity and no abrupt lifecycle resets. A randomized preset holds its seed for the entire loop.

## Required style inventory

1. Topological Tide Hero
2. Ivory Gyroid
3. Chrome Channels
4. Cobalt Torus
5. Mobius Current
6. Perforated Fold
7. Ceramic Web
8. Golden Neck
9. Quiet Surface

Variant names are working titles. Before implementation, define a separate one-line form/material/motion fingerprint for each. At least three variants must change the underlying geometry or field construction; at least three must change the movement relationship. A mere palette swap does not count as a style.

## Artist controls and interaction

Expose the controls specified in ENGINEERING-STARTER.md plus shared lighting, lens and quality controls. Keep groups consistent across styles. Controls change immediately and visibly; hints explain scene units and perceptual effects. Quality changes must preserve exposure and composition. Randomize stays within authored tasteful bounds. Pause and seek show deterministic frames; resume preserves current phase. Default palette roles should be remappable without breaking material read.

## Scope and exclusions

Required: nine generating styles, up to eight authored palettes, live default settings, export quality settings, standalone animated product page, reference stills, loop films and QA evidence. Optional only after the core passes: a reel sequence and shared lens effect. No app runtime changes, API services, imported image textures or hidden dependencies. True persistent simulation is outside the existing SDK contract. Scientific concepts are visual foundations; no unverified physical or spiritual claims are product behavior.

## Acceptance criteria

- Cavities remain stable at min quality; silhouette has no surface holes from marching failures; material mix distinctly changes diffuse/specular behavior.
- Flagship composition, material and three alternate phases pass visual inspection with bloom disabled and enabled.
- All nine styles have distinct approved fingerprints and meaningful parameter ranges.
- Loop seam, adjacent-frame continuity, pop, flash and exposure gates in ENGINEERING-FOUNDATION.md pass at default and stress settings.
- Seek order does not affect the frame: phase A rendered after B matches A rendered after C.
- Portrait, square and landscape maintain intended framing; small displays retain the primary form.
- Kit validates and previews in the actual SDK and installs in Motif; no unverified performance claim is included.

## Risks and decisions

Missed surfaces from invalid distance estimates, noisy normals and excessive reflection cost; shrinking march steps alone is not a distance-bound proof.

If high-end material or simulation behavior cannot fit the verified SDK and measured live budget, deliver a designed approximation, explain what it gives up and propose the missing SDK feature separately. Do not silently reduce the style to a flat decorative overlay.

## Delivery review

Review milestone 1: hero frame, looping film, parameter extremes and field/graph plan. Review milestone 2: complete nine-style inventory and palettes. Review milestone 3: packed kit, HTML showcase, QA report and measured cost. Visual acceptance is a human review; quantitative tests support it but do not replace it.
