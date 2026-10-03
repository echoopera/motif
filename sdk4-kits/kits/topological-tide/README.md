# Topological Tide 1.0.0

Ivory ceramic and copper metal implicit surfaces with cobalt shadows: gyroid shells, tori, Möbius ribbons and folded plates, sphere-traced with derived Lipschitz bounds. Nine seamless infinite loops.

Format `motif-kit@4` - no capabilities declared - pass graph: scene (1) > glow A (0.25) > glow B (0.125) > output (1.0).

## Styles

1. **Topological Tide Hero** (`topological-tide-hero`): Form: gyroid shell in a clipping ball. Material: ivory ceramic, copper on one wall. Motion: one object turn, breathing wall.
2. **Ivory Gyroid** (`ivory-gyroid`): Form: thick gyroid, k=3. Material: matte ceramic only. Motion: slow turn.
3. **Chrome Channels** (`chrome-channels`): Form: thin gyroid, k=4.6. Material: all polished metal. Motion: turn with sheen travelling over the walls.
4. **Cobalt Torus** (`cobalt-torus`): Form: exact torus perforated by a bound gyroid (max). Material: cobalt glaze. Motion: turn, breathing tube.
5. **Mobius Current** (`mobius-current`): Form: half-twisted box swept on a circle (Mobius). Material: porcelain with copper inlay. Motion: turn, inlay stripes travelling.
6. **Perforated Fold** (`perforated-fold`): Form: sine-folded plate with a hole grid. Material: celadon ceramic. Motion: fold amplitude breathing, turn.
7. **Ceramic Web** (`ceramic-web`): Form: very fine thin gyroid, k=6.6. Material: porcelain. Motion: slow turn, small warp.
8. **Golden Neck** (`golden-neck`): Form: gyroid with sliding iso-level (necking). Material: gold-leaning metal. Motion: iso-level oscillation, turn.
9. **Quiet Surface** (`quiet-surface`): Form: broad gyroid, k=2.2. Material: soft matte celadon. Motion: single slow turn, no morph.

## Construction notes (field classes and loop rules)

```
Topological Tide: ceramic and metal implicit surfaces sphere-traced with proven Lipschitz bounds.
Field classes (every scene function is labelled; AM_MARCH_L-style stepping d / 1 for "bound", never a guessed step multiplier)
  gyroid shell   bound     s = (|g(w) - c| - t) / (k*sqrt(6)*(1 + A*kw)),  g = sin kx cos ky + sin ky cos kz + sin kz cos kx.
                           |grad g| <= k*sqrt(6) for the plain gyroid; the domain warp w = p + A*sin(kw*p.yzx + phi) has Jacobian
                           I + A*kw*cyclic-shift*diag(cos), operator norm <= 1 + A*kw, so the quotient is 1-Lipschitz.
                           Shell offset by a constant t, iso-level c(theta) and thickness t(theta) vary in time only: still bound.
  bounding ball  exact     length(p) - R, combined by max (max of 1-Lipschitz fields is 1-Lipschitz).
  torus          exact     exact torus distance; perforated by a bound gyroid via max.
  mobius ribbon  bound     box swept along a circle and half-twisted; twist rate 1/(2R) per unit arc => L <= sqrt(1 + (rmax/(2(R-rmax)))^2), divided out.
  folded plate   bound     |y - f(x,z)| with f a sum of two sines: L <= sqrt(1 + (A k)^2).
Opaque surface only: ceramic (diffuse + dielectric specular) and metal (specular only, no diffuse) are separate energy models.
Loop: object rotation = integer turns of theta; thickness, warp and fold amplitude are periodic oscillators; camera orbit is closed.
```

## Controls

- **Form**: Spatial frequency (`freq`), Shell thickness (`shell`), Bound radius (`bound`), Warp amplitude (`warp`)
- **Material**: Ceramic ↔ metal mix (`metal`), Roughness (`rough`)
- **Light**: Cavity contrast (`cavity`), Key direction (`keyAngle`), Exposure (`exposure`)
- **Motion**: Morph amplitude (`morph`), Turns per loop (`turns`), Camera orbit (`orbit`)
- **Lens**: Bloom (`bloom`), Bloom radius (`bloomRadius`), Edge fringe (`lensCA`), Vignette (`vignette`)
- **Quality**: Quality (`quality`)

## Palettes

- Ivory Cobalt (`ivory-cobalt`): bg #03081C, ink #F2EBDD, accents #2A55D8 #D8803F #0A1A4D
- Porcelain Rose (`porcelain-rose`): bg #12070B, ink #F7EBE6, accents #9C4A66 #E8A56E #3A1020
- Celadon (`celadon`): bg #031210, ink #EEF2E2, accents #4FA38C #D9B25A #0A3A33
- Graphite Gold (`graphite-gold`): bg #08090B, ink #EDEBE6, accents #5A6470 #E3B65C #1A1E24
