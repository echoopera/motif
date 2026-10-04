# Harmonic Matter 1.0.0

Standing-wave membranes in blue-silver with concentrated amber peaks and particles attached to the field. Nine seamless infinite loops.

Format `motif-kit@4` - no capabilities declared - pass graph: scene (1) > glow A (0.25) > glow B (0.125) > output (1.0).

## Styles

1. **Harmonic Matter Hero** (`harmonic-matter-hero`): Form: three stacked analytic sheets. Material: silver-blue thin membrane, amber peaks. Motion: one coherent standing oscillation.
2. **Nodal Sea** (`nodal-sea`): Form: single wide sheet, many modes. Material: nodal network emission. Motion: standing wave, slow.
3. **Amber Antinodes** (`amber-antinodes`): Form: two sheets, no contours. Material: amber antinode emission. Motion: particles breathe in with the crests.
4. **Crosswave Veil** (`crosswave-veil`): Form: crossing mode families (90 degrees). Material: veil, high translucency. Motion: two oscillation rates beating.
5. **Resonant Basin** (`resonant-basin`): Form: radial Bessel-like modes. Material: teal glass sheets. Motion: radial standing ring pulses.
6. **Silver Interference** (`silver-interference`): Form: two-source interference sheet, top-down. Material: silver topographic contours. Motion: standing interference.
7. **Phase Ribbons** (`phase-ribbons`): Form: 2D stacked wave traces. Material: glowing line, pearls. Motion: phase-staggered standing wave.
8. **Standing Crest** (`standing-crest`): Form: ridgeline silhouettes, painter ordered. Material: dark fill, bright rim. Motion: standing crest oscillation.
9. **Quiet Chladni** (`quiet-chladni`): Form: Chladni plate nodal lines. Material: sand on dark metal. Motion: mode morph, very slow.

## Construction notes (field classes and loop rules)

```
Harmonic Matter: standing-wave membranes with attached particles.
Field classes
  wave surface   implicit  y = yoff + h(x,z,theta); located by a bounded slab march (step count = quality) then 5 bisections.
                 |h| <= amax (sum of mode amplitudes), so the slab [yoff-amax, yoff+amax] provably contains the surface.
  nodal contour  bound     |h| / |grad h| approximates distance to the node on the surface (exact to first order).
  particles      exact     jittered 3x3 cell lookup in the surface (x,z) parameter space, displaced along grad h.
Loop: every temporal term is an integer multiple of theta (standing waves cos(k*theta + phase)); static phases are seeded.
```

## Controls

- **Form**: Wave modes (`modes`), Amplitude (`amp`), Wavelength (`wavelength`), Camera pitch (`tilt`)
- **Material**: Node width (`nodeWidth`), Membrane opacity (`opacity`), Peak warmth (`warmth`)
- **Particles**: Particle density (`density`), Particle radius (`particleR`), Particle drift (`drift`)
- **Motion**: Oscillations per loop (`osc`), Camera orbit (`orbit`)
- **Light**: Key direction (`keyAngle`), Exposure (`exposure`)
- **Lens**: Bloom (`bloom`), Bloom radius (`bloomRadius`), Edge fringe (`lensCA`), Vignette (`vignette`)
- **Quality**: Quality (`quality`)

## Palettes

- Navy Silver (`navy-silver`): bg #030818, ink #E6EEF8, accents #6FA8E8 #FFB04A #0E2A6B
- Graphite Amber (`graphite-amber`): bg #08090B, ink #EEF0F2, accents #9FB4C8 #FF9F3A #2A3138
- Teal Glass (`teal-glass`): bg #021210, ink #E4F6F2, accents #5CD1C0 #F6C766 #0C4A47
- Violet Mist (`violet-mist`): bg #07041A, ink #EEE9FB, accents #9C8DF0 #FF9CC2 #2C1E6B
