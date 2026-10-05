# Motif-Shadcn 1.0

Motif 9.0.1 plus a React interface layer built from audiocn. Projects, kits and presets from Motif 3 to 9 open as before; the render path is unchanged (`tests/regression.mjs`).

- **Mix tab**: waveform with a draggable loop region, BPM knob, bar toggles, tap/÷2/×2/align, master meter, spectrum, an 8-band console with live meters and mapping editors (target, Amount and Smooth knobs, band), live-input switch, play-with-transport and snap switches. Edits the same audio mappings as the classic Audio tab.
- **Pads tab**: 16 pads (12 MotifGraph presets, Mutate, Randomize, Undo, Redo); hold to audition, tap to apply, number-key hotkeys.
- **Under the hood**: React 19 islands in shadow roots; shadcn variables defined from Motif's tokens; Base UI portals redirected into the island; keyboard isolation from Motif's shortcuts; an audio bridge and two extension pages in the shell (8 anchored patches over the 9.0.1 build).
- **Tests**: 28 browser checks; 9.0.1 vs Motif-Shadcn pixel regression across every style.
