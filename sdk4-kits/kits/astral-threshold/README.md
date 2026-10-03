# Astral Threshold 1.0.0

Violet and ice-blue volumetric membranes: foreground curtains, middle sheets and a distant aperture. Step-normalised volume rendering. Nine seamless infinite loops.

Format `motif-kit@4` - no capabilities declared - pass graph: scene (0.6) > glow A (0.25) > glow B (0.125) > output (1.0).

## Styles

1. **Astral Threshold Hero** (`astral-threshold-hero`): Form: offset cylindrical sheets bending to an off-centre aperture. Material: violet-to-ice emissive membranes. Motion: closed camera excursion, advecting filaments.
2. **Violet Passage** (`violet-passage`): Form: 10 narrow shells, small aperture. Material: dense violet. Motion: long camera excursion.
3. **Blue Veil** (`blue-veil`): Form: thick soft sheets, wide aperture. Material: pale ice veil. Motion: gentle excursion, slow advection.
4. **Folded Ether** (`folded-ether`): Form: creased (abs-folded) shells. Material: ember-rose emission, ridge fibres. Motion: advecting creases.
5. **Filament Gate** (`filament-gate`): Form: filament-dominated, sparse sheets. Material: aurora strands. Motion: fast advection of fibres.
6. **Luminous Expanse** (`luminous-expanse`): Form: planar wavy sheets (no tunnel). Material: aurora curtains. Motion: curtain waves, small excursion.
7. **Membrane Drift** (`membrane-drift`): Form: shells with orbiting centres. Material: violet-ice. Motion: layer orbits, nearly fixed camera.
8. **Deep Aperture** (`deep-aperture`): Form: 4 shells, tiny far aperture. Material: dark with ice core. Motion: very long closed travel.
9. **Quiet Transit** (`quiet-transit`): Form: 5 gentle shells. Material: dim violet. Motion: small excursion, one slow advection.

## Construction notes (field classes and loop rules)

```
Astral Threshold: luminous membranes seen through a passage toward a distant aperture.
Field classes
  density  density   rho(x,theta) >= 0: sum of warped shells (cylindrical sheets around an offset axis, or planes for the expanse),
                     each a Gaussian profile of the distance to its shell. Shell distance (geometry) and extinction (rho * sigma) are separate.
  renderer AM_VOLUME-style: fixed ray interval [0, zfar], step ds = interval / N, T *= exp(-sigma*rho*ds),
                     C += T * (1 - exp(-sigma*rho*ds)) * emission. No constant per-step glow, so exposure does not depend on the step count.
  aperture emissive disc at the far end, added once with the final transmittance.
Loop: warps and fibre advection use integer harmonics of theta; the camera excursion is a closed cosine bell; layer centres orbit on closed circles.
```

## Controls

- **Form**: Membrane layers (`layers`), Aperture radius (`aperture`), Filament scale (`filament`), Warp amplitude (`warp`)
- **Material**: Density (`density`), Absorption (`absorb`)
- **Light**: Emission (`emission`), Key direction (`keyAngle`), Exposure (`exposure`)
- **Motion**: Depth travel (`travel`), Advection cycles per loop (`advect`)
- **Lens**: Bloom (`bloom`), Bloom radius (`bloomRadius`), Edge fringe (`lensCA`), Vignette (`vignette`)
- **Quality**: Quality (`quality`)

## Palettes

- Violet Ice (`violet-ice`): bg #040110, ink #EAF3FF, accents #7A2CF5 #3FA5FF #2A0E6E
- Aurora (`aurora`): bg #010A0C, ink #E8FFF6, accents #2BC7A0 #6A7BFF #0B3A52
- Ember Veil (`ember-veil`): bg #0C0306, ink #FFF0E6, accents #E24C7A #FFB05C #4A1030
- Mono Ice (`mono-ice`): bg #02050A, ink #F2F7FF, accents #8FA8D6 #C9E0FF #1B2A48
