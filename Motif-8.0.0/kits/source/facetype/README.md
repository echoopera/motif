# FaceType 1.3.0 · motif-kit@3

Ten procedural typography treatments for three lines of editable text. `motif-kit@3`, with the `text` capability: Motif draws the type you enter, with fonts on your device, into one glyph atlas the shaders read. There is no image plate and nothing to export from another page.

## Editing the type

Select a FaceType style, then open **Layers › Type · text**. Each line has:

- **Text** (up to 48 characters, edits show live)
- **Font**: type any installed family, pick one from the list (**Installed fonts…** lists them where the browser allows), or **Import font file…** (TTF, OTF, WOFF, WOFF2; kept in this browser, never uploaded). If a family isn't available, the hint says **Fallback in use** and names the face drawing instead.
- **Weight**, **Size** (em as a fraction of the line's band), **Tracking** (em) and **Align**

Every field can be keyed. Text, font and alignment hold until the next key; size and tracking ease. Switching between FaceType styles keeps the text; switching to another kit's style drops it.

The style parameters work as before: three XY pads plus separate scale, angle, opacity and ink per line, and motion, loop cycles, density, edge, contrast, construction grid, field, accent and transparent backdrop. All scalar channels can be keyframed and audio-mapped.

## How it draws

Motif rasterizes each line centred and untransformed into its own band of the atlas (input `type`, band aspect 12:1). `common.glsl` reads a line with `textLine_type(i, q)` and applies that line's XY, scale and angle exactly once. At scale 1 a line's band spans the frame width; long lines shrink to fit it. Rotation and scale now work in square pixels, so an angled line is no longer sheared by the frame aspect (1.2 rotated in stretched frame coordinates).

## Upgrading from 1.2

1.2 needed a three-band PNG plate from a companion page, attached as media. 1.3 replaces the plate: the `typePlate` media input and the `media` capability are gone, the `type` text input and `text` capability replace them, and every parameter, palette, style name and treatment is unchanged. Projects saved with 1.2 keep their parameter values; type the three lines again (the plate's pixels can't be turned back into text). Hosts older than Motif 7.0 with text input support reject `motif-kit@3` by its format string; keep 1.2 for them.

## Build / verify

`motif-kit validate kits/source/facetype` checks the format, the text input and the shader sandbox. `motif-kit preview kits/source/facetype` renders the default lines with the SDK's bundled fallback font. `motif-kit pack kits/source/facetype` writes `facetype-1.3.0.motifkit`.
