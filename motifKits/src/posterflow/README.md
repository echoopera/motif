# Posterflow 1.0.0 (`motif-kit@4`)

Fluid poster treatments for your own images and clips, built from the reel reference: quantized colour bands, liquid flow-warp, thin vein lines, streak smears with RGB split, and ink dragged along streamlines.

| Entry | What |
| --- | --- |
| Marble Flow | Looping domain-warp + vortex through colour bands and veins |
| Streak Melt | Masked directional drag, RGB split, optional sheared slabs |
| Ink Drag | Source carried along looping curl streamlines, then banded |
| Poster Wash (effect) | Same bands and veins over any layer or the finished frame |
| Liquid Cut (transition) | Flow-warped ink front between two shots; exact at 0 and 1 |
| Poster Reel (sequence) | 12 s, never more than two shaders at once |

Every style takes one media input (`Source`). With nothing attached each plays a palette ink marble, so thumbnails are never blank. Four palettes: Tidal, Ember, Rosewater, Mineral. No flashing: nothing uses time-slot flicker. All motion is whole cycles per loop (`Cycles / loop`).

Limits to know: no state across frames, so the flow is procedural rather than a fluid simulation.
