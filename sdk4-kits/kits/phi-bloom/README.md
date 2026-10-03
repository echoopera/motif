# Phi Bloom 1.0.0

Golden-angle botanical sculpture: layered translucent blades, a readable logarithmic spiral, ivory and champagne against jade-black depth. Nine seamless infinite loops.

Format `motif-kit@4` - no capabilities declared - pass graph: scene (0.75) > glow A (0.25) > glow B (0.125) > output (1.0).

## Styles

1. **Phi Bloom Hero** (`phi-bloom-hero`): Form: golden-angle blades, three depth strata. Material: ivory translucent, champagne rim, copper caustics. Motion: one field turn, breathing, unfold wave, camera orbit.
2. **Golden Seed** (`golden-seed`): Form: 200 rounded florets, macro scale. Material: lacquered champagne beads. Motion: radial breathing wave, no field rotation.
3. **Copper Fern** (`copper-fern`): Form: log-spiral spine with paired leaflets (not phyllotaxis). Material: copper foil on ivory rachis. Motion: unroll and re-curl.
4. **Ivory Helix** (`ivory-helix`): Form: tangent-swept blades on the lattice. Material: ivory sculpture, cool rim. Motion: index flow along the parastichy, no rotation.
5. **Jade Crown** (`jade-crown`): Form: radial polar-repeat rings (not a lattice). Material: jade-ivory lacquer. Motion: alternating ring rotation, staggered breath.
6. **Spiral Canopy** (`spiral-canopy`): Form: broad lattice leaves under a strong near stratum. Material: backlit translucent, high transmission. Motion: slow turn, deep camera orbit.
7. **Twin Phyllotaxis** (`twin-phyllotaxis`): Form: two interleaved lattices at a 1:0.618 count ratio. Material: ivory over copper. Motion: counter-rotation at 1x and 2x.
8. **Orbital Petals** (`orbital-petals`): Form: tilted elliptical orbit rings, tangent petals. Material: opal pearl. Motion: counter-rotating rings, breathing tilt.
9. **Quiet Unfold** (`quiet-unfold`): Form: sparse lattice, low relief. Material: matte ivory, minimal rim. Motion: a single unfold wave, no rotation.

## Construction notes (field classes and loop rules)

```
Phi Bloom: golden-angle botanical sculpture.
Field classes (all exact 2D analytic coverage; nothing here is marched):
  blade   exact   tapered-blade signed distance, distance divided by the profile slope (conservative edge)
  lattice exact   n-th site at r = s*sqrt(n), angle = n*GA, found by inverting r(n) and scanning a bounded index window
  spiral  bound   logarithmic scaffold distance r*dphi/sqrt(1+b^2) (distance to the nearest arm, used for a 2 px emissive line)
  ring    exact   polar-repeat of blades, three nearest repeats evaluated
Loop: every temporal term is an integer harmonic of theta; "flow" translates the lattice by whole indices per loop and
every petal attribute is a smooth function of its effective index, so petal m at p=1 equals petal m+k at p=0.
```

## Controls

- **Form**: Petal count (`petals`), Spiral pitch (`pitch`), Blade length (`bladeLen`), Blade taper (`taper`), Depth spacing (`depth`)
- **Material**: Translucency (`translucency`), Rim intensity (`rim`), Copper caustics (`caustic`)
- **Light**: Core glow (`core`), Key direction (`keyAngle`), Exposure (`exposure`)
- **Motion**: Turns per loop (`turns`), Breath amplitude (`breath`), Unfold (`unfold`), Flow steps per loop (`flow`), Camera orbit (`orbit`)
- **Lens**: Bloom (`bloom`), Bloom radius (`bloomRadius`), Edge fringe (`lensCA`), Vignette (`vignette`)
- **Quality**: Quality (`quality`)

## Palettes

- Ivory Jade (`ivory-jade`): bg #02100F, ink #F6EBD0, accents #E8CC93 #D9803F #0F5B50
- Copper Night (`copper-night`): bg #0D0604, ink #F7E3CC, accents #E9A864 #C8552B #3E1D12
- Opal Dusk (`opal-dusk`): bg #05080F, ink #EEF1F6, accents #B9D0EA #E6A3C1 #1C2F55
- Verdant (`verdant`): bg #03100A, ink #EAF3DA, accents #C9E39B #E0B24C #124F2F
- Rose Gold (`rose-gold`): bg #0F0609, ink #FBEAE4, accents #F2BFA4 #E27C86 #4B1A2A
