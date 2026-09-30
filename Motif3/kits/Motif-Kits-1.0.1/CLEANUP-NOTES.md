# Motif kits 1.0.1 — shader cleanup

Ten drop-in MotifKit packages from the supplied 1.0.0 export. The original export was left intact.

## Changes
- Replaced 325 shader `smoothstep` invocations with an ordered easing helper. GLSL defines `smoothstep` only when its lower threshold is smaller than its upper threshold; several effects intentionally supplied reversed or equal thresholds. The helper preserves a descending transition and gives equal thresholds a hard step. This addresses driver-dependent hard black bands, blocks, and missing masks caused by undefined results.
- Clamped displaced media reads to the valid image plane in Cellula, Folio, Mosaic, and Tidal. Samples shifted beyond the frame now use the nearest edge texel rather than exposing a dark void.
- Bumped each kit to 1.0.1. Style IDs, parameters, palettes, pass order, and timing controls were retained.

## Verification
- All 10 archives and their 90 style manifests parsed; all referenced pass sources and common files exist.
- Shader delimiter checks passed and all media lookup sites were audited.
- GPU shader compilation, SDK CLI validation, and visual playback could not be performed: the MotifKit SDK and a compatible browser renderer were not present in this workspace. This package is a source-level correction and needs an SDK preview/import pass before replacing installed kits.

## Import
Unzip this outer archive and import the individual `.motifkit` files. For a visual review, compare 1.0.0 and 1.0.1 at the same seed and scrub time, particularly Folio, Mosaic, Tidal, Cellula, and transition effects in Bumper.
