# Improbable Tactics — Motif kit 0.1.0

Dada, De Stijl, deconstruction and collage as playable shaders (`motif-kit@1`, SDK 1.2). Twelve styles, seven palettes. Every loop closes exactly; anything that re-deals (Reshuffle, Pulls, Re-colours) runs through the photosensitive limiter.

| Group | Style | Idea |
| --- | --- | --- |
| Dada | Ransom Poem | Cut-out letter scraps: torn paper, halftone, shadows, Reshuffle |
| Dada | Soirée Programme | Breathing partition; every cell a fitted, turned or inverted letter or ornament |
| Dada | Tzara's Bag **MEDIA** | Image cut into strips/tiles that swap places |
| Collage | Photomontage **MEDIA** | Höch shards, each re-pasted, duotoned or halftoned |
| Collage | Rough Sea | Looped ocean under torn paper, giant letter, red halftone window |
| De Stijl | Neo-Plastic **MEDIA** | Mondrian composition or Boogie-Woogie; image snaps to palette fields |
| De Stijl | Counter-Constructions | Axonometric floating planes with shadows and slabs |
| De Stijl | Block Letters | Square alphabet on a colour-field grid with a rolling disc |
| Deconstruction | Photocopy Type | Toner grit, misregistration, micro-text, barcode, paint splatter |
| Bauhaus & Ornament | Circles in a Circle | Subtractive pigment discs, needle lines, ring |
| Bauhaus & Ornament | Rosette Split | Scalloped ornament with a negative wedge, rays, stars |
| Bauhaus & Ornament | Dot Quilt | Klee mosaic with breathing dot screens and half-suns |

Play: **Randomize** deals new layouts (seeds drive every hash); pick a **Word** (DADA, STIJL, CARSON, COLLAGE, CHANCE, MERZ, TACTICS, IMPROBABLE, PRINT, PLAY); drop an image on MEDIA styles; stack layers with Multiply to overprint.

`common.glsl` holds a 5×5 bitmap capital font (hard blocks ↔ rounded blobs), splatter, halftone, torn-edge and partition helpers shared by all styles.
