# Review: look statements, critic scores, what is still off, alternatives

Method: the repo's studio skills (`agent-skills/skills`) were used as review lenses: **art-director** (focal point, value structure, 60/30/10, negative space), **compositor** (depth cues, glow restraint, clipping), **cinematographer** (depth planes, parallax) and **critic** (rubric 1-5, note format `[phase] [element] issue - fix`). The playbook's report format (look statement, layer stack with field classes, what is still off, two alternatives, SDK proposals) is followed per kit.
This is a self-review by the implementing agent from rendered stills, contact sheets and QA numbers; no outside reviewer or real-device test was involved. Scores are therefore a candid working assessment, not an approval.

Rubric (critic): Idea · Readability · Timing · Principles · Composition · Polish · Technical. Pass = average >= 4 with nothing below 3.

## 01 Phi Bloom
**Look:** an unfolding golden-angle sculpture of ivory translucent blades with champagne rims, copper threads and a foreground of defocused jade leaves, lit from the upper right, in slow breathing rotation.
**Layers:** ground (jade-black radial) · form: lattice *exact*, blade *exact*, log-spiral *bound* · material: ivory/champagne/copper, translucency · light: one key + contact shadows · atmosphere: jade depth fade · lens: bloom 0.55 · motion: 1 turn, breath, unfold wave, closed orbit.
**Scores:** Idea 5 · Readability 4 · Timing 4 · Principles 4 · Composition 4 · Polish 4 · Technical 4 (avg 4.1).
**Notes:** `[hero, still] far stratum read as grey haze - tint with jade, lower alpha - fixed`; `[hero] copper caustics invisible at phone scale - strengthen - fixed (0.9 default)`; `[orbital-petals] reads as beads in rings rather than petals - still off`.
**Still off:** the log-spiral thread is subtle; Orbital Petals is the weakest variant.
**Alternatives:** (a) instanced-looking 3D petal shells with true occlusion (needs a bounded 3D petal field, costlier); (b) a macro "seed head" camera that flies in and returns.

## 02 Harmonic Matter
**Look:** three stacked silver-blue membranes ringing in a standing wave, amber light collecting on the crests, fine particles riding the surface.
**Layers:** ground (navy) · form: surface *implicit* (slab march + 4 bisections; slab proven by sum of mode amplitudes) · nodal contours *bound* · particles *exact* local cells · motion: standing waves at integer harmonics.
**Scores:** 4 · 4 · 4 · 4 · 4 · 3 · 4 (avg 3.9, **below pass by 0.1**).
**Notes:** `[hero] nodal contours tangled across three sheets - draw them on the top sheet only - fixed`; `[hero] amber peaks dull - threshold relative to the real height range - fixed`; `[hero] horizon band is empty - still off`.
**Alternatives:** (a) one sheet with refractive glass shading and caustics on a floor; (b) side-on ridgeline hero (already shipped as Standing Crest).

## 03 Sacred Lattice
**Look:** gold wire cages of dual polyhedra nested at 0.618, pale glass faces catching a key, circle chords behind, a small controlled core.
**Layers:** form: edges *exact* capsules, facets *approx* additive glass, circles *exact* · motion: alternating integer turns, closed orbit.
**Scores:** 5 · 5 · 4 · 4 · 4 · 4 · 4 (avg 4.3). Strongest set for geometry.
**Notes:** `[octahedral-chapel] washed out - lower facet opacity and exposure - fixed`; flash audit warns on Chapel (large bright lines sweeping at 4x tempo).
**Alternatives:** true refraction through ray-traced faces (needs a depth buffer); a camera-through-cages dolly.

## 04 Astral Threshold
**Look:** layered violet and ice-blue membranes with holes and filaments receding to an off-centre aperture; the camera leans in and returns.
**Layers:** form: shells *density* (warped, holed by loop noise) · renderer: step-normalised volume · aperture emissive disc · motion: closed camera bell, fibre advection.
**Scores:** 4 · 3 · 4 · 4 · 3 · 3 · 5 (avg 3.7, **below pass**).
**Notes:** `[hero] first version was a flat polar neon tunnel - shells given holes, wider spacing, lower extinction - fixed`; `[hero] soft at 1440 - scene scale 0.6 -> 0.85, jitter hatch removed - fixed`; `[hero] foreground curtains and middle sheets still blur together - add a darker near stratum - still off`.
**Alternatives:** (a) ray-vs-shell analytic intersections instead of marching (much sharper sheets); (b) a graph pass that denoises the volume at half resolution.

## 05 Cellular Cosmos
**Look:** translucent emerald and coral colonies in dark channels, radial organs and orbiting organelles, daughters dividing and rejoining.
**Layers:** form: weighted two-site Voronoi *exact* in a 5x5 window · organs *exact* · motion: closed division/migration schedule on stable IDs.
**Scores:** 4 · 4 · 4 · 4 · 3 · 3 · 4 (avg 3.7, **below pass**).
**Notes:** `[hero] stained-glass flatness; bodies too bright - dim bodies, inner rim light, focal falloff - improved, not solved`; `[tidal] cells tore at large migration - search window 5x5 and clamps - fixed`.
**Still off:** value structure is mid-tone everywhere; cells read as tiles more than organisms.
**Alternatives:** (a) metaball-style soft cells with SDF smooth union; (b) macro-lens depth of field across two layers of cells.

## 06 Topological Tide
**Look:** an ivory ceramic gyroid shell with copper on one wall, cobalt shadows in the cavities, turning once per loop.
**Layers:** form: shell *bound* (L = k sqrt6 (1 + A kw)) · ball *exact* · materials: ceramic and metal as separate energy models · AO and soft shadow from the field.
**Scores:** 5 · 5 · 4 · 4 · 5 · 4 · 4 (avg 4.4). Best-looking kit.
**Notes:** `[chrome] reflections black - brighter studio environment - fixed`; `[all] silhouettes stair-stepped at scale 0.75 - scene scale 1.0 - fixed`.
**Still off:** Live vs Export exposure spread is 12-15% (AO/shadow sample count); close to the limit.
**Alternatives:** thin-film iridescent metal; a dissolve-through-iso-level sweep.

## 07 Deconstruct Field
**Look:** cream ground, black structure, a cobalt arc, vermilion accents, hairline grids and soft layer shadows on asymmetric planes that slide and return.
**Layers:** all shapes *exact* SDF · painter order · motion: staggered in-hold-out-return.
**Scores:** 4 · 4 · 4 · 4 · 4 · 4 · 4 (avg 4.0).
**Notes:** `[hero] grid ladder clutter - vertical rules only - fixed`; `[plane-argument, red-interruption] flash fail at 4x tempo - travel scaled by k_calm() - fixed`.
**Alternatives:** type-led composition (text input, SDF outlines); tighter modular grid with fewer, larger planes.

## 08 Post-Punk Resonance
**Look:** acid-yellow ground, black stripes and ring bands, a red wave cut, strong negative shapes, poses held and snapped on two beats.
**Layers:** all analytic, filtered stripes (`fwidth`) · motion: beat schedule mod B.
**Scores:** 5 · 4 · 4 · 4 · 4 · 4 · 4 (avg 4.1).
**Notes:** `[hero] wave cut too spiky - lower spatial frequencies - fixed`; `[all] beats and turns routed through safeCycles; at 4x tempo they hold the pose - fixed`.
**Alternatives:** poster-scale type riding the stripes; halftone-only variant set.

## 09 After Cyber
**Look:** a cyan hairline lattice dissolving into lime particles behind a smoky glass dodecahedron, deep black, quiet.
**Layers:** nodes/edges *exact* · polyhedron *exact* ray vs half-spaces · glass *approx* (screen-space offset) · motion: dissolve-transport-reassemble with holds.
**Scores:** 4 · 4 · 4 · 4 · 3 · 3 · 4 (avg 3.7, **below pass**).
**Notes:** `[covenant] wedge artefacts from visiting nodes twice - fixed`; `[hero] lattice looks like a bent plate with a hard rectangular edge - fade the sheet border - still off`.
**Alternatives:** a 3D node cloud rendered through a bounded volume; real refraction of the lattice through the glass.

## Summary
Five kits clear the critic pass on this self-review (Phi Bloom, Sacred Lattice, Topological Tide, Deconstruct Field, Post-Punk Resonance). Harmonic Matter, Astral Threshold, Cellular Cosmos and After Cyber are **below the pass line** and would need another art-direction round; the specific gaps are listed above. Nothing here replaces a review on a real device or by a human art director.
