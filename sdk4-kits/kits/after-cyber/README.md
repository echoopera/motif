# After Cyber 1.0.0

Smoky glass, cyan hairlines, selective acid-lime particles in deep black: lattices that dissolve, travel and reassemble. Nine seamless infinite loops.

Format `motif-kit@4` - no capabilities declared - pass graph: scene (0.75) > glow A (0.25) > glow B (0.125) > output (1.0).

## Styles

1. **After Cyber Hero** (`after-cyber-hero`): Form: tilted node sheet + dodecahedral glass. Material: smoky glass, cyan hairlines, lime particles. Motion: dissolve-transport-reassemble with holds.
2. **Cyan Scaffold** (`cyan-scaffold`): Form: lattice with diagonal struts, no glass. Material: cyan hairline. Motion: lattice relaxes and returns.
3. **Glass Drift** (`glass-drift`): Form: large dodecahedral glass over a wavy lattice. Material: refractive smoke glass. Motion: slow glass tilt.
4. **Lime Assembly** (`lime-assembly`): Form: lattice with long transport. Material: lime-dominant particles. Motion: wide dispersal and assembly.
5. **Particle Covenant** (`particle-covenant`): Form: concentric rings of nodes (no edges). Material: bright particle rings. Motion: ring dissolve and gather.
6. **Broken Polyhedron** (`broken-polyhedron`): Form: octahedral glass with face-wise breathing + strut lattice. Material: steel glass. Motion: facet breathing.
7. **Organic Circuit** (`organic-circuit`): Form: jittered pads with Manhattan traces. Material: cyan trace, lime pads. Motion: pads wander, traces follow.
8. **Smoky Network** (`smoky-network`): Form: jittered nodes with sparse random struts. Material: heavy smoke. Motion: slow dispersal.
9. **Quiet Reconstruction** (`quiet-reconstruction`): Form: sparse lattice + small glass. Material: dim cyan. Motion: small slow dissolve.

## Construction notes (field classes and loop rules)

```
After Cyber: smoky glass, cyan hairlines, selective acid-lime particles.
Field classes
  nodes     exact   stable lattice sites (grid / ring / jittered) found by inverting the sheet projection to its plane and scanning a (2W+1)^2 window;
                    the dispersal offset is clamped to 0.85*W*cell so every node that can reach a pixel is inside the window (bound).
  edges     exact   2D capsule distance between projected neighbours; weight = min(attachment weights) so a connection fades smoothly as nodes leave.
  polyhedron exact  analytic ray vs convex half-space intersection (slab method), facet normal from the entering plane.
  glass     approx  inexpensive local refraction: the lattice layer is re-evaluated at a screen offset along the facet normal; no depth-correct transport.
Loop: one dissolve - transport - reassemble schedule per cycle with zero-velocity holds (k_ioh), staggered by a smooth function of position.
Particles follow closed circles at integer harmonics with fixed seeded phases; every node and the facet displacement return exactly at the seam.
```

## Controls

- **Form**: Lattice resolution (`res`), Connection radius (`connect`), Dispersal radius (`disperse`)
- **Material**: Edge radius (`edgeR`), Glass opacity (`glass`), Refraction strength (`refr`)
- **Particles**: Particle radius (`particleR`), Lime fraction (`lime`)
- **Motion**: Reconstructions per loop (`cycles`)
- **Light**: Key direction (`keyAngle`), Exposure (`exposure`)
- **Lens**: Bloom (`bloom`), Bloom radius (`bloomRadius`), Edge fringe (`lensCA`), Vignette (`vignette`)

## Palettes

- Smoke Cyan Lime (`smoke-cyan-lime`): bg #010608, ink #DDF8FF, accents #22C8E8 #C6F000 #0B2A30
- Ink Ice (`ink-ice`): bg #02040A, ink #EAF2FF, accents #7FB8FF #E8FF6A #101C36
- Dusk Magenta (`dusk-magenta`): bg #07030A, ink #F6E6FF, accents #E04AD6 #B8FF3A #2A0F3A
- Steel (`steel`): bg #040506, ink #E8EEF2, accents #9FB4C0 #D4F23A #1C262C
