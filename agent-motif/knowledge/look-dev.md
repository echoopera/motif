# Look-development rules

These are AgentMotif's defaults for anything that should feel premium. Break them on purpose, not by accident.

## Light and exposure
1. **Work in linear HDR and tone-map once**, in the final pass. Emissive cores at 2–20× diffuse are what make bloom read as light.
2. **Expose for the hero.** Use `exposure` in stops. Midtones sit around 0.18 linear before the tone map.
3. **One key light direction per scene**, and make every lit surface agree with it.
4. **Fresnel everywhere.** Even rough dielectrics get about 4% at normal incidence, rising to 100% at grazing angles.
5. **Energy honesty.** Specular plus diffuse never exceeds the incoming light. Metals have no diffuse.

## Colour
1. **Mix in OKLab** (`am_mixOk`). RGB lerps go muddy through grey; HSV lerps shift brightness.
2. **Use the palette roles**: `bg` is ground, `ink` is light and type, `a0` is the hero accent, `a1` is the secondary, `a2` is the shadow tint and depth. Aim for a 60/30/10 split by screen area.
3. **Saturation lives in the midtones.** Highlights desaturate toward white and shadows toward the shadow tint, as film does.
4. **Tone maps:** AgX is the default (hue-stable highlight roll-off); AgX Punchy for stylised work; PBR Neutral when a brand colour must come out as specified; ACES only on request (it skews saturated blues and reds).
5. **Hue shifts belong in the shadows and highlights**, via split-toning, not in the hero colour.

## Lens and film
| Control | Tasteful range | Too much |
| --- | --- | --- |
| Bloom | threshold 0.8–1.5, mix 0.3–0.8 | everything glows, contrast collapses |
| Chromatic aberration | 0.1–0.3 | rainbow edges at the frame centre |
| Grain | 0.2–0.4 | visibly crawling noise in flat areas |
| Vignette | 0.3–0.6 | a tunnel |
| Halation | 0.05–0.2 | orange halos on everything |
| Anamorphic | 0–0.3 | sci-fi cliché |

## Composition
- One focal point; let the brightest, most saturated and sharpest region coincide.
- Keep text-safe areas calm when the style is a background (lower detail and contrast in the middle third if needed).
- Break symmetry slightly unless the brief is about symmetry.

## Motion
- **One hero motion** (for example, the warp), **one secondary** (the light orbit), **ambient** life (grain, motes).
- Heavy and large things move slowly with long eases; small things react fast and settle with a spring.
- Cycle counts are integers. One per loop is a calm default for a 6–10 s loop.
- Never move everything at the same rate. Offset phases with `h11(id)`.

## Performance tiers (real GPU, 1080p, per style)
| Tier | Budget | Typical |
| --- | --- | --- |
| Live / VJ | < 4 ms | 1 pass, or a half-res scene and a cheap finish |
| Broadcast export | < 16 ms | scene at 0.5–0.75 + bloom prep + finish |
| Hero / offline | any | raise `steps` and quality params during export |

Use `am qa` to compare costs between versions, and Motif's **Deliver › Check speed** for real numbers.
