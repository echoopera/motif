# Deconstruct Field 1.0.0

Cream ground, black structure, cobalt arcs and vermilion accents: asymmetric planes and grids that slide, rotate and return on staggered in-hold-out schedules. Nine seamless infinite loops.

Format `motif-kit@4` - no capabilities declared - single full-resolution analytic pass.

## Styles

1. **Deconstruct Field Hero** (`deconstruct-field-hero`): Form: asymmetric planes + arcs + grids. Material: flat print, soft layer shadow. Motion: staggered in-hold-out-return.
2. **Broken Axis** (`broken-axis`): Form: bars strung on a vertical axis. Material: black on bone. Motion: alternating up/down breaks.
3. **Cobalt Cut** (`cobalt-cut`): Form: cobalt-dominant planes with circular bites. Material: flat cobalt. Motion: slow slides.
4. **Offset Scaffold** (`offset-scaffold`): Form: stroked planes with offset ghost copies. Material: line only. Motion: ghost lags the plane.
5. **Plane Argument** (`plane-argument`): Form: 7 huge angled planes in two camps. Material: flat print. Motion: opposed lateral slides.
6. **Partial Circle** (`partial-circle`): Form: five concentric partial arcs, few planes. Material: sand and teal print. Motion: eased arc rotations.
7. **Red Interruption** (`red-interruption`): Form: black planes + one traversing vermilion plane. Material: flat print. Motion: wide red slide, long rests.
8. **Grid Dislocation** (`grid-dislocation`): Form: planes carrying large grids, rows slip. Material: light on dark paper. Motion: row-wise dislocation.
9. **Quiet Construct** (`quiet-construct`): Form: 6 planes, one arc, wide negative space. Material: light line weight. Motion: small offsets, long holds.

## Construction notes (field classes and loop rules)

```
Deconstruct Field: a crisp analytic composition of planes, arcs and subordinate grids.
Field classes: every shape is an exact 2D signed distance (rounded-free boxes, annuli, half-plane masks); no marching.
Layout grammar: plane i has a stable identity from hash(i + seed): anchor, size (power law: few large, many small), colour class,
travel direction and stagger. Nothing is regenerated on wrap.
Loop: each plane follows an in-hold-out-return schedule s_i = ioh(k*phase + stagger_i, hold). The quintic eases have zero velocity at
both ends of every move, and every plane is at rest at the seam. Grids lag their parent plane (a delayed schedule) so they respond to it.
Painter order = plane index; shadows are a second SDF sample offset along the shadow direction (layer separation), not a noise overlay.
```

## Controls

- **Form**: Plane count (`planes`), Arc radius (`arcR`), Grid spacing (`grid`)
- **Material**: Line width (`lineW`)
- **Light**: Layer separation (`sep`), Shadow direction (`keyAngle`), Exposure (`exposure`)
- **Motion**: Offset amplitude (`offset`), Rotation amplitude (`rot`), Hold fraction (`hold`), Recompositions per loop (`recomp`)
- **Lens**: Vignette (`vignette`)
- **Quality**: Quality (`quality`)

## Palettes

- Cream Cobalt (`cream-cobalt`): bg #E8E2D0, ink #0B0C10, accents #1B3FD6 #E4331B #8E8671
- Bone Ink (`bone-ink`): bg #EDEAE2, ink #14151A, accents #27408B #D9482B #9A9788
- Sand Teal (`sand-teal`): bg #E2D8BF, ink #10201F, accents #0E6C6C #E0552B #8C8268
- Night Paper (`night-paper`): bg #15161B, ink #ECE7D8, accents #4F73F0 #FF5A3C #6A6A72
