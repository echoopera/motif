# Data Ink — Motif kit 0.1.0

Information graphics in the spirit of Edward Tufte, as playable shaders (`motif-kit@1`, SDK 1.2). Eight styles, six palettes. The dataset *is* the parameter panel: eight value sliders per style (plus a pattern generator and a seed), and the shaders print the numbers they draw with a built-in 5×5 bitmap type system. Type a value, keyframe it, map it to audio, or hit Randomize for a new dataset. Every loop closes exactly.

| Group | Style | What moves |
| --- | --- | --- |
| Time & Flow | Stream | Stacked flow scrolls; labels carry name + your value |
| Time & Flow | Heat Ledger (MEDIA) | A cursor sweeps the years; right-hand figures read the value under it. Attach an image and its brightness becomes the data |
| Time & Flow | Flow Map | A Minard band advances (width = your waypoints), retreats with losses, temperature chart fills |
| Grids & Plates | Marey Grid | Timetable diagonals on fine grey grid; a cursor pins each train; station gaps are your sliders |
| Grids & Plates | Curve Plate | Families of measured curves draw on, head tags climb |
| Grids & Plates | Parallel Tracks | Multi-track chronology with sun-curve; playhead lights events and prints their lengths |
| Small Multiples | Sparkline Table | Windows slide through each series; min, max and end value tracked live |
| Diagrams | Possible Photons | Feynman-style graph: wavy photons, arrowed fermions, riding pulses; couplings are sliders |

Tips: the *Data values* group holds the numbers; *Labels* switches Cities / Stations / Greek / Metals / Months. Night Plate is a dark palette for any style. `common.glsl` holds the type system (`dxNum`, `dxName`), looped data generator (`dxData`) and drawing helpers.
