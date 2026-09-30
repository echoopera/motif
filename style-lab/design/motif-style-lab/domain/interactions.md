# Domain interaction model — creative tool

## Canvas contract
Always visible, letterboxed at the chosen aspect on a mid-grey surround. Guides overlay (title-safe 90%, action-safe 93%, centre cross) toggles with G. The preview equals the export: same render function, same time sampling.

## Tool state always visible
Style name, aspect, loop length, time, play state, seed and quality are always on screen.

## Parameter model
Each style exposes 4–7 style params; every style shares Colour (palette, invert), Motion (loop length, tempo, phase, seed) and Finish (zoom, rotate, grain, vignette).

## Mutate / Evolve / Alter
- **Mutate (M):** perturbs every unlocked param by strength s (0–1): ranges move by ±s × span (Gaussian), ints round, selects switch with probability s/2, toggles flip with probability s/3; text never mutates; seed always re-rolls unless locked.
- **Evolve (E):** six children of the current look at the current strength, rendered live side by side; keep one (click or 1–6), or breed again. Option: include colour (palette may change).
- **Randomize (R):** fresh values across the full range for unlocked params.
- **Reset:** style defaults; shared groups untouched.
- **Lock:** per-param lock excluded from mutate, evolve and randomize.
- **Non-destructive:** all of the above are single undo steps.

## Export
Presets by destination via aspect + size tier; preview equals output; seamless loop frame count = round(loop × fps × loops) with frame N omitted.
