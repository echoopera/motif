# Text inputs (motif-kit@3)

A text input gives a style up to three lines of text the user edits in Motif's inspector. Motif rasterizes them, with fonts on the user's device, into **one** glyph atlas texture per input. Your shader never sees a string: it samples glyph coverage and does all positioning, scaling, rotation and motion itself. A kit never ships or loads a PNG, a font file or a URL for its text.

Reference kit: [`examples/type-lines`](../examples/type-lines). Production kit: `Motif3/kits/source/facetype` (FaceType 1.3.0, ten styles).

## Manifest

```json
{
  "format": "motif-kit@3",
  "capabilities": ["text"],
  "inputs": [{
    "id": "type", "type": "text", "label": "Type", "aspect": 8,
    "lines": [
      { "id": "line1", "label": "Line 1", "def": "FORM FOLLOWS" },
      { "id": "line2", "label": "Line 2", "def": "FREQUENCY", "size": 0.8 },
      { "id": "line3", "label": "Line 3", "def": "TYPE IS SIGNAL", "maxLength": 48,
        "font": { "family": "Instrument Sans", "weight": 500 }, "size": 0.5, "tracking": 0.12, "align": "center" }
    ]
  }]
}
```

| Field | Rule | Default |
| --- | --- | --- |
| `type` | `"text"` (needs `"format": "motif-kit@3"`) | — |
| `id` | camelCase, ≤ 16; becomes `u_<id>`, `textLine_<id>` | — |
| `aspect` | band width : height, 2–16 | 8 |
| `lines` | 1–3 lines, unique `id` (camelCase ≤ 16) | — |
| `lines[].def` | default text: one line, no control characters, ≤ `maxLength` | `""` |
| `lines[].maxLength` | integer 1–128 (the inspector field enforces it) | 64 |
| `lines[].font` | `{ family, weight }` only. `family`: 1–64 letters, digits, spaces, `. _ & + ( ) -` (no quotes, commas, semicolons). `weight`: 100…900 in steps of 100. Fonts are looked up on the device, never loaded from the kit. | Instrument Sans 700 |
| `lines[].size` | em size as a fraction of the band height, 0.1–1 | 0.72 |
| `lines[].tracking` | extra letter spacing in em, −0.2–0.8 | 0 |
| `lines[].align` | `left`, `center`, `right` | `center` |

`fit` and `required` do not apply to text inputs and are rejected. Text inputs belong to styles (not effects or transitions). Inputs still count toward the limit of 2 per entry. A kit with a text input must declare the `text` capability, which the user approves at install like `media`, `audio` and `feedback`. `text` permits local font rasterization of what the user types, nothing else.

## GLSL

For a text input `type` with three lines the runtime adds:

```glsl
uniform sampler2D u_type;      // the atlas
uniform float u_typeOn;        // 1.0 once the atlas is built (0.0 → transparent black)
uniform vec2 u_typeSize;       // atlas size in pixels
const int textLines_type = 3;
const float textAspect_type = 8.0;
vec4 m_type(vec2 q);           // whole atlas at q (0..1, origin bottom-left)
vec4 textLine_type(int i, vec2 q);
vec4 textLine(int i, vec2 q);  // the entry's first text input
```

`textLine(i, q)` returns line `i` (0-based, line 1 = 0) at **line-local** coordinates: centred on the line, isotropic, with the band spanning `x` −0.5…0.5 and `y` −0.5/aspect…0.5/aspect. Outside the band it returns `vec4(0)`. Map your frame coordinates into that space with the line's own transform, applied once:

```glsl
float w = u_res.x / min(u_res.x, u_res.y);               // frame width in uv units
vec2 q = rot(-angle) * (uv - linePos) / (w * lineScale); // band width = frame width × scale
float a = textLine(i, q).a;
col = over(vec4(ink * a, a), col);
```

Strings never become uniforms or `#define`s. `motif-kit prelude` prints the exact declarations.

## The atlas

- **Layout.** One band per declared line, stacked; **line 1 is the top band** of the image (in texture coordinates, origin bottom-left, it is the band nearest `t = 1`). Each band is `W / aspect` pixels tall.
- **Resolution.** `W` is the smallest of 1024, 2048 and 4096 px that covers the frame width (capped at 4096), so a 4K export gets a 4096 px atlas and a 1080p one 2048 px. Preview and export use the same rule, so they match at the same size.
- **Placement.** Each line is drawn **centred and untransformed**: horizontally per `align` (left/right keep a 3 % margin), vertically centred on its cap height, which keeps the baseline still when the text changes. A line wider than the band minus margins, or taller than the band minus 12 % top and bottom, is scaled down to fit. Nothing else is applied: position, rotation, scale and motion are the shader's.
- **Alpha.** RGBA8, **linear** (no sRGB decode), **premultiplied white**: `rgb == a == coverage`. Colour emoji and coloured glyphs are reduced to coverage too. Use `.a`.
- **Gutters and filtering.** Band edges are transparent, the texture is mipmapped and clamped, so scaled-down or rotated lines stay smooth and never bleed into neighbouring bands.
- **Fallback.** If a family isn't installed or loaded, Motif draws with its UI fonts, then the system sans (`"Instrument Sans", "Anybody", system-ui, … sans-serif`) and the inspector says **Fallback in use**. Before the host has built an atlas, `u_<id>On` is 0 and sampling returns transparent black: draw a designed placeholder, never a fake glyph.
- **Rebuilds.** The atlas is rebuilt only when the text, font, typography, font loading state or atlas size changes. Animating your params never rebuilds it.

## What users can do

Every line has text, font family (typed, picked from installed fonts where the browser offers `queryLocalFonts()`, or an imported TTF/OTF/WOFF/WOFF2 kept in the browser), weight, size, tracking and alignment. Every field can be keyed: text, font and alignment hold until the next key; size and tracking ease and can be audio-mapped. Switching between styles of the same kit keeps the text; another kit's style starts from its own defaults.

## Preview and validate

`motif-kit validate <kit>` checks the declaration (bad fonts, overlong defaults, control characters, missing capability) and the shader sandbox. `motif-kit preview <kit> [--text "A|B|C"]` renders the default strings (or yours) with the bundled fallback font (`lib/fonts/DejaVuSans-Bold.ttf`), so compile, timing and the "responds to its text" check run on real glyphs on any machine. Motif's install canary also probes text styles with their default strings, not a blank texture.

## Compatibility

`motif-kit@3` is `motif-kit@2` plus text inputs and the `text` capability. Hosts that only know @1/@2 reject an @3 kit by its format string (`format must be "motif-kit@1" or "motif-kit@2" (got "motif-kit@3")`). Motif 7 reads @1 and @2 kits exactly as before. See [versioning](versioning.md).
