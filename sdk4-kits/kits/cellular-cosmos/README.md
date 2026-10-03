# Cellular Cosmos 1.0.0

Translucent emerald membranes, coral colonies, radial organs and dark channels. A deterministic periodic lifecycle of division, migration and reintegration. Nine seamless infinite loops.

Format `motif-kit@4` - no capabilities declared - pass graph: scene (0.75) > glow A (0.25) > glow B (0.125) > output (1.0).

## Styles

1. **Cellular Cosmos Hero** (`cellular-cosmos-hero`): Form: weighted Voronoi, two species. Material: translucent bodies, bright membranes in dark channels. Motion: division, migration, reintegration.
2. **Emerald Colonies** (`emerald-colonies`): Form: fewer, larger cells, one species. Material: glassy emerald. Motion: slow migration, gentle division.
3. **Coral Division** (`coral-division`): Form: coral-only scalloped colonies with polyp tips. Material: coral membrane, warm nuclei. Motion: wide division swing.
4. **Membrane Choir** (`membrane-choir`): Form: wobbling membrane borders, no organs. Material: thick luminous border. Motion: standing wave along every membrane.
5. **Spore Drift** (`spore-drift`): Form: many tiny cells. Material: pale bodies, fine membranes. Motion: tight orbits, tiny divisions.
6. **Symbiotic Web** (`symbiotic-web`): Form: cells + neighbour filament web. Material: pink-teal filaments. Motion: migration pulls the web.
7. **Radial Organs** (`radial-organs`): Form: 10 large cells, dense radial filaments. Material: amber-lime organs. Motion: counter-turning filaments.
8. **Quiet Mitosis** (`quiet-mitosis`): Form: sparse cells. Material: dim translucent. Motion: single slow cycle, small migration.
9. **Tidal Habitat** (`tidal-habitat`): Form: standard colonies. Material: lagoon pink-teal. Motion: phase-gradient tidal migration.

## Construction notes (field classes and loop rules)

```
Cellular Cosmos: analytic looped colony lifecycle on a weighted two-site-per-cell Voronoi field.
Field classes
  voronoi  exact   nearest of 18 candidate sites (3x3 grid cells x parent+child), additive weights give irregular cell sizes
  membrane bound   (F2 - F1) is a conservative bound on the distance to the cell border (exact for equal weights)
  organs   exact   radial filaments and organelle points in the winning cell's local polar frame
Lifecycle (no persistent simulation exists in the SDK): each grid cell hosts a parent site and a child site. The child leaves the parent
(division), migrates, and rejoins (reintegration) on a closed schedule k * theta + seeded phase. IDs come from the grid cell, never from time;
the child's territory weight reaches zero before it coincides with the parent, so appearance and disappearance are smooth.
```

## Controls

- **Form**: Colony count (`count`), Species mix (`species`)
- **Material**: Membrane width (`membrane`), Translucency (`translucency`), Organelle density (`organelles`), Filament count (`filaments`)
- **Motion**: Division amplitude (`divAmp`), Migration radius (`migrate`), Lifecycles per loop (`cycles`)
- **Light**: Exposure (`exposure`)
- **Lens**: Bloom (`bloom`), Bloom radius (`bloomRadius`), Edge fringe (`lensCA`), Vignette (`vignette`)
- **Quality**: Quality (`quality`)

## Palettes

- Emerald Coral (`emerald-coral`): bg #010C09, ink #F7F0DA, accents #2FD39A #FF5C3A #0A4A3D
- Abyss (`abyss`): bg #01070D, ink #E8F6FF, accents #3DB8E8 #F2A65A #0B3050
- Lagoon Pink (`lagoon-pink`): bg #020D0C, ink #FFF0F2, accents #4FE0C8 #FF7AA8 #0E4B4A
- Bloom Amber (`bloom-amber`): bg #0B0705, ink #FFF3DC, accents #C9D94E #FF8A3A #3A3010
