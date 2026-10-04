# Post-Punk Resonance 1.0.0

Acid yellow, red, black and warm white: stripes, ring bands and wave traces with strong negative shapes, moved on two or four clear beats with long rests. No grain, no strobe. Nine seamless infinite loops.

Format `motif-kit@4` - no capabilities declared - single full-resolution analytic pass.

## Styles

1. **Post-Punk Resonance Hero** (`post-punk-hero`): Form: stripe block + ring bands + wave cut + slabs. Material: flat acid print. Motion: two eased beats with long rests.
2. **Acid Carrier** (`acid-carrier`): Form: yellow ground with 7 wave traces. Material: black line on yellow. Motion: phase steps on beats.
3. **Red Signal** (`red-signal`): Form: red disc + triangle-wave traces. Material: red and black on bone. Motion: trace phase stepping.
4. **Broken Ring** (`broken-ring`): Form: segmented concentric rings. Material: black on bone with two accents. Motion: segment turns per beat.
5. **Blackout Geometry** (`blackout-geometry`): Form: negative-space shapes on black. Material: cut-out white, one red bar. Motion: slab slides, circle breath.
6. **Interference Cut** (`interference-cut`): Form: two filtered stripe fields + cut. Material: black stripes, pink/yellow slabs. Motion: stripe shift per beat.
7. **Stepped Oscillator** (`stepped-oscillator`): Form: 9 quantised wave traces. Material: light line on night. Motion: stepped poses on 4 beats.
8. **Graphic Feedback** (`graphic-feedback`): Form: self-similar nested frames (analytic, no feedback buffer). Material: three-colour print. Motion: one level of zoom per loop.
9. **Quiet Noise** (`quiet-noise`): Form: halftone dot field. Material: black dots on bone, one red accent. Motion: one slow ripple per loop.

## Construction notes (field classes and loop rules)

```
Post-Punk Resonance: one crisp analytic pass of stripes, ring bands, wave traces and slabs on rhythmic segments.
Field classes: stripes and bands are analytic periodic masks filtered with fwidth (box filter) so pitch changes stay alias-safe;
waves are |y - f(x)| with the slope-corrected distance; slabs are exact boxes.
Rhythm: the loop holds B beats (1..4). Within a beat the transform eases between target k and target (k+1) mod B over the moving
part of the beat and rests for the hold fraction. Closing is by construction (targets are indexed mod B). Slices displace in space only
during moves (envelope sin(pi*e)), and no form change depends on brightness: no strobing, no grain.
```

## Controls

- **Form**: Stripe pitch (`pitch`), Ring count (`rings`), Wave amplitude (`wave`)
- **Material**: Black area (`black`), Accent area (`accent`)
- **Motion**: Slice displacement (`slice`), Hold fraction (`hold`), Beats per loop (`beats`), On twos (`stepped`)
- **Light**: Exposure (`exposure`)
- **Lens**: Vignette (`vignette`)
- **Quality**: Quality (`quality`)

## Palettes

- Acid Warm (`acid-warm`): bg #EEE6AE, ink #05050A, accents #F0120A #F2E800 #8A8460
- Bone Red (`bone-red`): bg #EFEBE0, ink #0A0A0C, accents #E1180E #FFD400 #8E8A7A
- Signal Night (`signal-night`): bg #0B0B0F, ink #F4F0E4, accents #FF2A1C #E8F20A #5A5A60
- Pink Black (`pink-black`): bg #F3E2DA, ink #0C0A0C, accents #E82A6A #F6E400 #9A8A86
