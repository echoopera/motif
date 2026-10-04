# Sacred Lattice 1.0.0

Gold connections, pale glass and obsidian blue: nested polyhedral cages, circles and chord networks in exact geometry. Nine seamless infinite loops.

Format `motif-kit@4` - no capabilities declared - pass graph: scene (1) > glow A (0.25) > glow B (0.125) > output (1.0).

## Styles

1. **Sacred Lattice Hero** (`sacred-lattice-hero`): Form: nested dual cages + circle chords. Material: gold edges, pale glass. Motion: alternating whole turns, closed camera orbit.
2. **Octahedral Chapel** (`octahedral-chapel`): Form: nested octahedra, deep depth spacing. Material: glass-forward. Motion: one slow turn, steady orbit.
3. **Tetrahedral Orbit** (`tetrahedral-orbit`): Form: nested tetrahedra + orbit tracks. Material: rose gold line, bright nodes. Motion: 1x and 2x counter-rotation with orbiting beads.
4. **Golden Icosahedron** (`golden-icosahedron`): Form: nested icosahedra (golden coordinates). Material: thick gold, vertex jewels. Motion: slow alternating turns.
5. **Circle Cathedral** (`circle-cathedral`): Form: 6-fold circle lattice + tick bands (2D, no polyhedra). Material: brass line. Motion: counter-rotating bands.
6. **Nested Compass** (`nested-compass`): Form: rings, ticks, n-gon chords, needles. Material: silver line. Motion: counter-rotating rings.
7. **Glass Constellation** (`glass-constellation`): Form: icosa/cube node networks, hairline edges. Material: glowing jewel nodes. Motion: slow turns, wide orbit.
8. **Axial Halo** (`axial-halo`): Form: cages rotating about the view axis + halo ring. Material: gold and glass. Motion: axial turns, breathing halo.
9. **Silent Symmetry** (`silent-symmetry`): Form: cube/octa compound, hairlines. Material: dim silver. Motion: very slow single turn.

## Construction notes (field classes and loop rules)

```
Sacred Lattice: nested polyhedral cages, circles and chord networks in gold and glass.
Field classes
  edges     exact   2D capsule distance to the perspective projection of each polyhedron edge (edges found by vertex dot product)
  nodes     exact   sphere projected to a disc, radius follows depth
  facets    approx  glass: additive barycentric triangle coverage (tetra/octa only), brighter toward the edge; not refraction
  circles   exact   |length(p-c)-r| and inscribed n-gon capsule chords
Loop: cage rotations are integer turns of theta about a fixed tilted axis; static tilts and offsets are seeded; the camera
orbit is a closed ellipse; facet breathing is sin(theta + seeded phase).
```

## Controls

- **Form**: Nesting levels (`levels`), Nesting ratio (`ratio`), Depth spacing (`depthSp`), Circle layers (`circleLayers`)
- **Material**: Edge radius (`edgeR`), Facet opacity (`facet`)
- **Light**: Core intensity (`core`), Key direction (`keyAngle`), Exposure (`exposure`)
- **Motion**: Cage turns per loop (`cageTurns`), Camera orbit amplitude (`orbit`), Breath (`breath`)
- **Lens**: Bloom (`bloom`), Bloom radius (`bloomRadius`), Edge fringe (`lensCA`), Vignette (`vignette`)
- **Quality**: Quality (`quality`)

## Palettes

- Gold Obsidian (`gold-obsidian`): bg #02040C, ink #E4EDFF, accents #E9B24A #7FB2FF #1B2A66
- Rose Gold (`rose-gold`): bg #090409, ink #FCEAEC, accents #F0B08C #C99BE8 #3A1A4E
- Emerald Brass (`emerald-brass`): bg #010C0A, ink #E3F7EF, accents #D9B253 #5FE0B8 #0B4A3F
- Silver Ice (`silver-ice`): bg #03060C, ink #EEF4FF, accents #C4D2E6 #8FC4FF #1E3358
