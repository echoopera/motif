# Aether 1.1.0 — Echo Opera

Nine volumetric atmospheres with step-normalised scattering and continuous circulation.

Import aether-1.1.0.motifkit into Motif 8 / SDK 4. Each kit has nine authored field equations, four coordinated palettes, twelve meaningful controls per style and a half-resolution linear HDR scene -> quarter-resolution highlights -> eighth-resolution bloom -> full-resolution tone-mapped output graph. No inputs, media, network, audio or feedback capability is required.

Use forward playback and a 40–120 second loop for ambient motion. Primary circulation and drift continue in one direction. Time enters only through u_p; integer circuit counts keep the loop seam closed. Palette roles are bg ground, ink highlights, a0 hero, a1 secondary and a2 shadow. Colour blends in OKLab. A neutral highlight shoulder is used instead of AgX to favour palette fidelity; source reference: https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/pbrNeutral.glsl . No film grain or decorative textures.

Aether uses nonnegative density fields with step-normalised absorption/emission. It is artistic volume rendering, not a calibrated atmospheric simulation.

Quality and budgets are bounded. Physical-phone performance is not promised. HDR bloom falls back to clamped targets on drivers without half-float render targets, reducing glow fidelity. See QA.md for exact validation and local rendering evidence.

## Included

- **Cloudwake** — A vast jade cloudfront with pockets of light.
- **Pale Current** — Layered atmospheric rivers curl into endless depth.
- **Ion Rain** — Soft columns of luminous vapour descend through blue air.
- **Duskfront** — An opalescent bank of fog surrounds a warm interior glow.
- **High Tide** — Slow atmospheric swells unfold above an unseen sea.
- **Blue Hour** — Sparse cold mist with an immense quiet horizon.
- **Lightwell** — A shaft of pearl light through folded cloud cavities.
- **Cirrus Garden** — Interleaved thin cloud filaments suspended in space.
- **Ember Haze** — Amber-lit density and velvet dusk shadows.

## Layer stack and field discipline

Ground: linear palette background. Form: the entry's authored field. Material: density scattering or membrane/Fresnel or geometric glow. Light: a shared key for membrane/volume shading and palette highlights. Atmosphere: depth attenuation. Lens: highlight isolation and source-resolution-aware bloom. Motion: integer cyclic phase and seeded variation.

No sphere tracing is applied to a density or arbitrary implicit field. 2D contours use analytic coverage/glow, and volume integration uses fixed samples. The product page embeds the exact packaged GLSL and SDK runtime.

## Next directions

1. A sparse, dark installation variant with fewer hero forms and longer loop duration.
2. A pale, brighter editorial variant with restrained bloom and wide text-safe margins.

## SDK proposal

Need: an organism remembers its previous state. Proposal: optional deterministic temporal-state buffers with reset/seek/warm-up rules. Pros: real ecology, flow and reaction–diffusion. Cons: more GPU memory, export replay cost and more complex seeking. Risk: nonrepeatable loops and device divergence. Recommendation: retain this stateless collection now; design the state contract separately before adopting persistent life.

## 1.1.0 changes

- New post chain: bright (1/4) -> tight glow (1/8) + wide glow (1/8, 5x5) -> output. The Bloom spread control now visibly widens the halo.
- Output pass: adjustable vignette (new Lens control), perceptually scaled triangular dither to remove 8-bit banding in dark gradients.
- Bloom threshold range is now 0.1 to 1.5 with brighter emissive cores so bloom reads as light; every control has a real hint and Randomize is capped on light controls.
- Each kit has its own four palettes instead of sharing one set.
- Camera path no longer crosses the density sheets (the horizon flipped mid-loop in 1.0.0), and rays start past the near field. Per-pixel IGN jitter replaces the visible step stripes; the light is more directional with a focal falloff and lower overall exposure. Pop is now below 3.4 on all styles (was up to 6.9). Volume samples default 68 (range 32 to 80); exposure stays constant across the range.
