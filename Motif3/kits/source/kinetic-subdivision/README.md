# Kinetic Subdivision — Motif kit 0.2.1

Ten subdivision and image-displacement styles for `motif-kit@1`. Needs Motif 3.1 (SDK 1.1 media inputs) to treat your own images and video; older builds play the procedural source.

## Use

1. Drop `kinetic-subdivision-0.2.0.motifkit` on Motif to install it.
2. Pick any Kinetic Subdivision style (marked **MEDIA** in the library).
3. Drop a photo or video onto the stage, or use **Layer › Media › Source**.
4. **Fit** sets Fill / Fit / Stretch. For video, **Timing › Fit to loop** retimes the clip to one Motif loop so the loop is seamless.
5. **Media mix** (style parameter) blends between your media and the procedural source; it can be keyframed.

## Styles

1. Kinetic Treemap — nested shifting cells and editorial hairlines.
2. Mondrian Drift — hard black gutters and sparse accent panels.
3. Barcode Cathedral — thin vertical slices and 1D streaks.
4. Scanline Fault — horizontal slipping bands.
5. Chromatic Register — red/blue channel offsets.
6. Monolith Cut — negative-space slabs.
7. Offset Press — duotone print and gutters.
8. Signal Cascade — rhythmic horizontal breakup.
9. Survey Grid — fine cell edges and technical ticks.
10. Afterimage Atlas — layered displacement echoes.

## How it works

Three passes: procedural fallback source (half resolution), stable partition map, and the treatment. The manifest declares one media input:

```json
"inputs": [{ "id": "source", "type": "media", "label": "Source", "fit": "fill" }]
```

so every pass gets `u_source`, `u_sourceOn` and `m_source(q)`. All motion derives from loop phase `u_p`, so frames render deterministically and loops close; glitch rates go through `safeCycles` and the photosensitive limiter.

## Build

```sh
motif-kit validate kinetic-subdivision
motif-kit preview kinetic-subdivision --media photo.jpg
motif-kit pack kinetic-subdivision --out dist
```
