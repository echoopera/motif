# Oriel 1.0.0 — Echo Opera

Nine living geometric fields built from sacred geometry and golden-ratio growth.

Import oriel-1.0.0.motifkit into Motif 8 / SDK 4. Each kit has nine authored field equations, four coordinated palettes, twelve meaningful controls per style and a half-resolution linear HDR scene -> quarter-resolution highlights -> eighth-resolution bloom -> full-resolution tone-mapped output graph. No inputs, media, network, audio or feedback capability is required.

Use forward playback and a 40–120 second loop for ambient motion. Primary circulation and drift continue in one direction. Time enters only through u_p; integer circuit counts keep the loop seam closed. Palette roles are bg ground, ink highlights, a0 hero, a1 secondary and a2 shadow. Colour blends in OKLab. A neutral highlight shoulder is used instead of AgX to favour palette fidelity; source reference: https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/pbrNeutral.glsl . No film grain or decorative textures.

The organisms and local life cycles are deterministic procedural approximations. They are not persistent Gray–Scott or Conway simulations. SDK 4 feedback resets every frame; adding true temporal ecology requires a runtime temporal-state contract. Nothing changes the Motif runtime.

Quality and budgets are bounded. Physical-phone performance is not promised. HDR bloom falls back to clamped targets on drivers without half-float render targets, reducing glow fidelity. See QA.md for exact validation and local rendering evidence.

## Included

- **Living Flower** — A sixfold circle lattice blooms within a golden field.
- **Phi Garden** — A living population arranged by the golden angle.
- **Fibonacci Sea** — Golden-ratio shells reveal repeated scales of space.
- **Vesica** — Overlapping lenses rotate into a quiet sacred geometry.
- **Golden Bloom** — Logarithmic spirals expand around a luminous living core.
- **Torus Choir** — Nested rosettes imply luminous toroidal movement.
- **Stellate** — A rotating star network shelters soft geometric seeds.
- **Quasicrystal** — Fivefold interference becomes an organic luminous lattice.
- **Metatron Field** — Thirteen nodes and their interwoven connections circulate.

## Layer stack and field discipline

Ground: linear palette background. Form: the entry's authored field. Material: density scattering or membrane/Fresnel or geometric glow. Light: a shared key for membrane/volume shading and palette highlights. Atmosphere: depth attenuation. Lens: highlight isolation and source-resolution-aware bloom. Motion: integer cyclic phase and seeded variation.

No sphere tracing is applied to a density or arbitrary implicit field. 2D contours use analytic coverage/glow, and volume integration uses fixed samples. The product page embeds the exact packaged GLSL and SDK runtime.

## Next directions

1. A sparse, dark installation variant with fewer hero forms and longer loop duration.
2. A pale, brighter editorial variant with restrained bloom and wide text-safe margins.

## SDK proposal

Need: an organism remembers its previous state. Proposal: optional deterministic temporal-state buffers with reset/seek/warm-up rules. Pros: real ecology, flow and reaction–diffusion. Cons: more GPU memory, export replay cost and more complex seeking. Risk: nonrepeatable loops and device divergence. Recommendation: retain this stateless collection now; design the state contract separately before adopting persistent life.
- Edge quality: the scene renders at full resolution, and every line and rim is widened to at least one pixel (derivative-based), so thin lines fade smoothly instead of breaking into dashes or beads at any zoom. Dither strength was halved.
