# Technique atlas

Find the visual signature you see in the reference, then read across to the technique, the library call and the cost. **Cost** is per pixel at the pass scale: `●` is trivial (under ~20 ALU ops or 1 tap), `●●` is a few noise calls or taps, `●●●` is a loop of 30 to 100 steps, and `●●●●` is a nested loop or a raymarch with shadows. **Loop** notes how to keep the technique seamless.

## Fields and organic form

| Signature | Technique | Library / prelude | Cost | Loop |
| --- | --- | --- | --- | --- |
| Smoke, marble, silk, aurora | Two-level domain warp (Quílez) | `am_warp(x, oct, k, r, amt, q, w)` and `lfbm` | ●●● (5 fbm) | integer `k` |
| Ink in water, smoke curls | Curl-noise advection | `am_curl`, `am_curlFbm` | ●● | integer `k` |
| Texture flowing along a field | Two-phase flow map | `am_flowPhases(k)` | ● + 2 taps | crossfade hides reset |
| Ridges, lightning, veins | Ridged fbm, iso-lines of a field | `lridge`, `gauss1(abs(f - level) / |∇f|)` | ●● | — |
| Cells, cracked mud, scales | Voronoi F1/F2 with orbiting sites | `lvoro(x, jit, k, amp)` | ●● (9 taps) | integer `k` |
| Hex tiles, honeycomb | Hex grid | `am_hexGrid` | ● | — |
| Mandalas, kaleidoscope | Polar repeat and mirror | `am_polarRep`, `am_kaleido` | ● | — |
| Fluid metaballs (2D) | Smooth-min of SDFs | `am_smin3`, `am_sminH` (blend factor for colour) | ● per shape | Lissajous with integer frequencies |

## Materials and light

| Signature | Technique | Library | Cost | Notes |
| --- | --- | --- | --- | --- |
| Chrome, liquid metal | Image-based light from a procedural studio, split-sum | `am_studio`, `am_envBRDF` | ●● | The studio is what sells chrome. Spin it with integer turns, through `safeCycles`. |
| Plastic, ceramic, paint | GGX + Lambert | `am_brdf` | ● | rough 0.3–0.6 |
| Soap bubble, oil slick, holo foil, anodised titanium | Thin-film interference | `am_thinFilm(cosθ, nm, ior)` | ● | thickness 250–900 nm. Animate thickness, not hue. |
| Silk, satin | Stretched field + GGX + Charlie sheen + film | `am_sheen`, see `silk-aurora` | ●●● | anisotropy from stretching the domain |
| Velvet, peach fuzz | Sheen dominant | `am_sheen` | ● | |
| Wax, jade, skin | Wrapped diffuse with scatter tint | `am_wrapDiffuse` | ● | |
| Glass, water surface, lens | 2D SDF bevel → normal → refraction offset + spectral taps | see `liquid-glass` | ●●● (7 taps) | dispersion = per-wavelength offset scale |
| Prism and rainbow fringes | Spectral sampling | `am_spectrum(w)` with N taps | N taps | normalise by the summed weights |
| Caustics | Iterated warp (two rotated layers multiplied) | `am_caustic`, see `caustic-light` | ●●● | dispersion is a **tiny lateral** shift per channel. Scaling coordinates per channel decorrelates them into a rainbow mess. |
| Fire and plasma colour | Blackbody | `bb(kelvin)`, `hot(t)` | ● | |

## 3D

| Signature | Technique | Library | Cost | Notes |
| --- | --- | --- | --- | --- |
| Hard-surface or blobby 3D | Sphere tracing | `AM_MARCH`, `AM_NORMAL`, `am_camRay` | ●●● | `steps` param with `mutate: 0` and a bounding volume |
| Grounded objects | Soft shadows, AO, mirror floor | `AM_SHADOW`, `AM_AO` | ●●●● | contact shadow is cheaper than a shadow march |
| Clouds, nebula, fog volumes | Emission–absorption ray march | `am_sinFbm3` (gyroid fbm, about 10× cheaper than simplex), `am_hg`, IGN jitter | ●●●● | Bound by a sphere. Ridged density gives filaments. The **integration term** is `(emi + scat) * (1 - e^{-σΔt}) / σ`. |
| Gyroid lattices, sci-fi structures | Gyroid shell SDF | `am_sdGyroidShell` | ● | |
| Twisted and bent forms | Domain deformation | `am_twist`, `am_bend` | ● | scale the step by about 0.6 after deforming |

## Media treatments (image or video in)

| Signature | Technique | Library | Cost |
| --- | --- | --- | --- |
| Painting, gouache, anime backgrounds | Generalised Kuwahara + structure-aligned bristles + paper | `am_kuwahara`, `am_sobel`, see `painterly` | ●●● (49 taps) |
| Speed tunnel, zoom transitions | Polar stretch beyond a jagged radius + zoom blur | see `light-tunnel` | ●● |
| Liquid distortion | Flow / curl displacement of `q` | `am_curl`, `m_source(q + d)` | ●● |
| Glass over media | SDF refraction | see `liquid-glass` | ●●● |
| Halftone, dither, ASCII | Cell grid + luminance threshold | `am_hexGrid`, `luma` | ● |
| Pixel sorting / glitch | Limiter-aware time slots + row offsets | `tslot`, `tfrac` | ● |

## Finishing (final pass)

| Look | Technique | Library | Cost |
| --- | --- | --- | --- |
| Glow that feels like light | Soft-knee bright pass at 1/8 res, then two-radius ring bloom | `am_bright`, `am_bloom`, `styles/post/*` | ● at 1/8 + 50 taps |
| Film | Halation, luma-weighted grain at 24 fps | `am_halation`, `am_grain` | ● |
| Anamorphic | Horizontal streak | `am_streak` | 25 taps |
| Lens | 7-tap spectral CA, barrel distortion, cos⁴ vignette | `am_ca`, `am_barrel`, `am_vignette` | 7 taps |
| Depth of field / bokeh | Golden-angle disc | `am_bokeh` | 32 taps |
| Tone | AgX (default), AgX punchy, PBR Neutral (brand colour), ACES | `am_tonemap` | ● |
| Grade | Lift/gamma/gain, split tone, log contrast | `am_grade`, `am_splitTone`, `am_contrast` | ● |

## Motion

| Need | Helper |
| --- | --- |
| A move inside a window of the loop | `am_seg(a, b)` + `am_easeInOutCubic`, `am_easeOutExpo` |
| Exact After Effects / CSS curve | `am_bezier(t, x1, y1, x2, y2)` |
| Overshoot that settles | `am_spring(t, k, c)`, `am_springAt(a, k, c)` |
| Cascades | `am_stagger(i, n, spread, a, b)` |
| Title-card hold | `am_inHoldOut(in, out)` |
| Hand-made / stop-motion | `am_onTwos(24)`, boil from `h21(vec2(am_onTwos(24), …))` |
| Grain, boil and flicker at a frame rate | `am_frame(fps)`, which is exact over the loop |

## Hard-won notes

- **Loop noise radius `r`** is your speed control. Large `r` with `k=1` reads as fast change; small `r` reads as gentle breathing.
- **Finite-difference normals of a warped field** need `e` around 1–2% of the feature size. Too small gives noise; too large gives mush.
- **Silk vs. foil vs. liquid** is mostly octave count and stretch. Two or three octaves read as cloth; four or more read as crumpled foil.
- **Sub-pixel jitter without temporal accumulation is noise.** Only jitter what gets averaged (volume steps, blur taps).
- **Distance aliasing**: fade high-frequency patterns toward their mean with distance, a hand-rolled mip (see `caustic-light`).
- **Metric traps**: an optimiser will delete a defining feature if that improves the average score (`light-tunnel` lost its streaks). Lock structural parameters and let the eye overrule the number.
- **Scrolling a cell grid doesn't loop**: shifting by whole cells changes every cell's hash id, so frame L ≠ frame 0. Wrap particles in a domain instead (`mod(seed + wraps * u_p, 1.0)` with integer `wraps`), as `caustic-light` does for its motes.

## Fields and renderers (SDK 4 / Astral research)

| Signature | Field class | Renderer | Library | Measured |
| --- | --- | --- | --- | --- |
| Luminous folded tunnels, recursive-looking filaments | glow | additive glow | `am_cosFold` + `AM_GLOW`, see `astral-fold` | exposure ×2.43 min→max steps raw; ×1.02 with fitted compensation |
| The same, with stable exposure and translucent depth | density | absorption / emission | `AM_VOLUME`, `astral-fold` renderer = volume | ×0.96 |
| Carved stone, hollow artifacts, eroded columns | bound | Lipschitz-scaled sphere trace | `AM_MARCH_L`, `am_cosFoldLip`, see `monolith` | ×0.999 |
| Porous membranes, gyroid chambers | density | absorption / emission | `AM_VOLUME`, see `cellspace` | ×0.991 |
| Gyroid as a solid surface | implicit (or bound via the √6 gradient bound) | `AM_SEGMENT`, or `am_sdGyroidShell` + `AM_MARCH` | `field`, `sdf` | — |
| Neon / topographic / portal type | exact within spread | 2D coverage from `textDist_<id>` | see `lightscript` | — |
| Speed-streak cut between shots | — | transition, `k = sin(pi * progress)` | `transitions/tunnel.glsl` | endpoints Δ0 |

- **Sampled distance fields clamp beyond their spread.** A glow `exp(-d / w)` then keeps a constant floor across the whole text band and draws a box. Subtract the value at the spread and renormalise (`glowFall` in `lightscript`).
- **Bloom pre-blur must match the buffer ratio.** A 1/4-res bright pass reading a full-res scene with a 1-texel kernel skips pixels and aliases highlights into blocks. Scale the radius by `textureSize(src) / u_res`.
- **Transition endpoint checks need a GPU reference.** Canvas `drawImage` downscaling aliases thin lines differently from mipmapped texture sampling. Compare against the same graph with a pass-through shader (as `am qa` does).
