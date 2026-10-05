# Wallcast — Motif kit 1.0.0

Ten image shaders for on-air graphics, cyber-city screens and EDM video walls. Built to `motif-kit@1` (SDK 1.2), tested in Motif 3.2.

## Use

1. Drop `wallcast-1.0.0.motifkit` on Motif to install it.
2. Pick any Wallcast style (all ten are marked **MEDIA**).
3. Drop a still or clip on the stage, or use **Layer › Media › Source**. With nothing attached, a night-skyline test image plays.
4. Map an audio band (kick works best) to **Hit**, or set **Beats / loop** and **Beat drive** for a beat that stays locked to the loop.
5. Stack styles as layers with blend modes. Use a Motif type layer as a track matte to cut the effect out of a headline.

## Styles

| Style | Group | What it does |
| --- | --- | --- |
| Prism Split | Optics | Radial colour split and anamorphic light streaks that flare on every kick |
| Halftone Pulse | Print and pixel | Three halftone screens at three angles; light-on-dark or ink-on-paper |
| Slice Shift | Glitch and light | Row and column tears with an RGB split, cut on the beat |
| Depth Stack | Depth and data | Background, mid and foreground at three depths; foreground input keeps alpha |
| Contour Radar | Depth and data | Contour lines, radar sweep, range rings, reticle with a numeric level readout |
| LED Wall | Print and pixel | Pixel-mapped panel with sub-pixels, gaps, bloom, scan wipe and sparkle |
| Neon Trace | Glitch and light | Three-scale edge detection drawn as light with a cycling palette |
| Glyph Mosaic | Print and pixel | The image rebuilt from numerals and marks, with falling data trails |
| Shockwave | Optics | Kick-locked refractive rings with a colour split |
| Kaleido Wall | Optics | Mirror-fold kaleidoscope, spin and drift in whole cycles per loop |

## Shared controls (every style)

| Group | Control | Notes |
| --- | --- | --- |
| Beat | Beats / loop | Kick pulses per loop. Capped at 3 per second by the limiter |
| Beat | Beat drive | Strength of the internal beat |
| Beat | Hit | Audio-mapping target. 0 to 1 |
| Finish | Exposure, Vignette | |
| HUD | HUD frame, Readout | Corner brackets, four-digit readout, beat trace. Map a data channel to Readout |

Depth Stack takes two media inputs: **Background** (`source`) and **Foreground** (`fore`).

## Photosensitive safety

Beat pulses, sweeps, wipes, hue cycles, spin, drift, rain, tears and sparkle all pass through `safeCycles`, `tslot` or the limiter cap in `contour-radar` and `glyph-mosaic`. Styles that swing brightness are marked ⚡. Turn the limiter off in the Kits tab only for content that never reaches broadcast or a live wall.

## Build

```sh
python3 build/gen_manifest.py wallcast/manifest.json    # regenerates the manifest, shared params stamped on every style
motif-kit validate wallcast
motif-kit preview wallcast --media photo.jpg
motif-kit pack wallcast --out dist
node tools/wallcast-audit.mjs wallcast.bundle.json Motif3.html audit.json   # audit inside the real app
```
