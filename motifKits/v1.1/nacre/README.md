# Nacre 1.1.0 — Echo Opera

Nine organic habitats with cyclic life, translucent membranes and endless drift.

Import nacre-1.1.0.motifkit into Motif 8 / SDK 4. Each kit has nine authored field equations, four coordinated palettes, twelve meaningful controls per style and a half-resolution linear HDR scene -> quarter-resolution highlights -> eighth-resolution bloom -> full-resolution tone-mapped output graph. No inputs, media, network, audio or feedback capability is required.

Use forward playback and a 40–120 second loop for ambient motion. Primary circulation and drift continue in one direction. Time enters only through u_p; integer circuit counts keep the loop seam closed. Palette roles are bg ground, ink highlights, a0 hero, a1 secondary and a2 shadow. Colour blends in OKLab. A neutral highlight shoulder is used instead of AgX to favour palette fidelity; source reference: https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/pbrNeutral.glsl . No film grain or decorative textures.

The organisms and local life cycles are deterministic procedural approximations. They are not persistent Gray–Scott or Conway simulations. SDK 4 feedback resets every frame; adding true temporal ecology requires a runtime temporal-state contract. Nothing changes the Motif runtime.

Quality and budgets are bounded. Physical-phone performance is not promised. HDR bloom falls back to clamped targets on drivers without half-float render targets, reducing glow fidelity. See QA.md for exact validation and local rendering evidence.

## Included

- **Cellsea** — A deep sea of translucent drifting cellular membranes.
- **Symbiosis** — Paired organisms circulate around a shared luminous nucleus.
- **Colony Bloom** — Multi-lobed colonies unfurl in an inhabited space.
- **Membrane Choir** — Concentric soft membranes with travelling inner ripples.
- **Tide Organism** — Elongated swimmers with gently trailing cellular fins.
- **Biolume** — Small radiant spores and soft haloes in deep water.
- **Mitosis** — Twin nuclei divide within living opalescent envelopes.
- **Polyp Garden** — Tentacular rosettes and intricate folded skins.
- **Hollow Moon** — Floating hollow shells with luminous internal chambers.

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
- Every style now has its own placement seed, so the nine styles no longer share one composition. Organisms nearer the centre are lit stronger to give a focal point, and rims and cores carry HDR energy.
