# Motif Kit Briefs: five flagship kits for motif-kit@4

Each brief is written as a standalone agent prompt. Paste the **Shared preamble** first, then one kit brief.

---

## Shared preamble (give this to every agent)

You are building a Motif kit with `motif-kit-sdk` 4.0 (`"format": "motif-kit@4"`). A kit is data and GLSL only. Work from `motif-kit new <id>`, and run `motif-kit validate`, `preview`, `bench` and `seq` until all are clean.

**Hard SDK rules (from the sandbox):**
- Every loop is a `for` with a constant bound (at most 4,096 iterations per loop, 32,768 per pixel, 2,048 texture reads per pixel). No `while`, no recursion, no `#extension`.
- Limits per style: 9 textures, 128 uniforms. Per kit: 64 cues, 8 sequences.
- Time enters **only** through `u_p` (0..1) with **integer** frequencies: `lc()`, `lsin()`, `lsaw()`, `pulse()`, `ln2/ln3/lfbm` with integer `k`. The loop must close exactly, and `motif-kit preview` will test the seam.
- Nothing carries over between frames. Feedback is bounded and inside one frame (`graph` with `iterate`).
- Output is premultiplied through `emit()` or `solid()`, with alpha as brightness, so styles layer and blend cleanly.
- Declare `capabilities` honestly (`feedback`, `media`, `text`, `vector`, `audio`).
- Respect `u_safe` (use `tslot`, `strobe`, `flashAmt`) and set `"flash": true` where applicable.
- Keep the declared `cost` honest (compare against `motif-kit bench`).

**Architecture conventions (apply to every kit):**
1. **Field/look split.** Field passes write a field buffer with the contract `.r` = scalar (density, height or phase), `.gb` = vector (gradient or flow), `.a` = mask or confidence. Look passes read it. Ship at least 3 interchangeable looks per field family, so a field × look matrix is explicit in the manifest through tags.
2. **Macro params on every style:** `energy` (arousal: tempo, contrast, rhythmic irregularity), `tone` (valence: curvature, palette warmth, symmetry versus its breaking), `order` (order↔chaos), `density`, `scale`. Each macro drives several raw params through a documented mapping, and the raw params stay exposed in a collapsed group. Every param must be valid across its whole range (no dead zones), because Mutate and Evolve sample it blindly. Use integers for anything that becomes a temporal frequency.
3. **Roles.** Tag each style `bed`, `accent`, `overlay`, `transform` or `mask`. Accent and overlay styles must work over transparency.
4. **Effects as treatments.** Ship at least 2 `target: any` effects per kit.
5. **Sequences.** Ship at least 1 `motif-seq@1` showcase that uses 4 styles or fewer at a time.
6. **Style card.** Next to each style write `cards/<id>.md`: concept (the math or physics), loop mechanism, affect profile (arousal, valence, what drives each), cost, references, and known-bad param regions.
7. **Palettes.** Ship 4 or more palettes, each tuned for a different affect quadrant (high or low arousal × positive or negative valence).
8. **Acceptance.** `validate` is clean, and the loop seam, blank-frame and timing checks pass at default and at 20 randomized param vectors per style. No style is blank or saturated across more than 95% of its param range. A kit README documents the field contract, the macro mappings and the previews.

---

## 1. EIGEN: the music of shapes

**Premise.** Everything vibrates in modes. Eigenmodes are closed-form, stateless and exactly periodic, so physics *is* the loop mechanism instead of fighting it. This kit makes standing waves, resonance and quantum revival a design language.

**Why it's revolutionary.** Real-looking wave and quantum behavior that scrubs, loops exactly and costs one pass. Integer approximations of real dispersion relations make the physics legible, not just decorative.

**Styles (field families, each with a mode-count and shape select):**
- **Chladni.** Sand on a plate: Σ cos(nπx)cos(mπy) ± swapped terms. Nodal lines drawn as ridges. A `drive` param morphs between mode pairs through integer-frequency crossfades.
- **Drum.** Circular membrane modes J_m(k_mn r)cos(mθ). Use asymptotic McMahon zeros, with a small lookup table for the first modes. Radial and angular mode numbers are integers, and the temporal frequencies are rounded to integers in ratio with the true zeros.
- **Quantum Carpet.** Particle-in-a-box superposition, E ∝ n², with exact revival. Draw |ψ(x,t)|² as a space–time carpet or as a 2D evolving packet. Note that the Talbot revival is a physical fact here, not a trick.
- **Orbital.** Hydrogen-like superpositions of n=2 and n=3 states. Only |ψ|² matters, so only difference frequencies matter. Scale so the beat frequency is an integer number of cycles per loop.
- **Ripple Tank.** N point sources with a quantized water-wave dispersion (ω² = g·k rounded to integer cycles per loop), producing physically convincing interference and moiré.
- **Resonator** (`capabilities: ["audio"]`). The same modes, with each audio band driving the amplitude of one mode. The loop-exact base stays; audio only modulates amplitude.

**Looks:** ridge-line, heat ramp, particle-sand (stochastic stipple that drifts toward nodal lines), engraved isocontours.

**Effects:** *Nodal Refraction* (refracts the input along a mode field), *Standing Bloom*.

**Affect:** low mode counts feel calm and sacred; high counts and near-degenerate modes feel anxious. `energy` raises mode numbers and beat rate. `tone` shifts symmetry from pure (positive) to nearly broken (tense).

**Acceptance extras:** a unit-test script that checks `|ψ(p=0)−ψ(p=1)|` is below 1e-5 for every style at 50 random seeds, and that each field's gradient is in `.gb`.

---

## 2. LUMEN: color as physics

**Premise.** Color that comes from phase, not palette lookup: thin-film iridescence, diffraction gratings, dispersion, caustics and Newton rings. The palette defines the world, and the physics defines the light.

**Why it's revolutionary.** Spectral rendering (8 wavelengths → linear RGB) inside a real-time style, with loop-exact motion via integer-cycle film thickness and angle sweeps. It makes light itself the subject, which is very rare in motion-graphics tools.

**Styles:**
- **Film.** Soap film and oil slick: thickness field from `lfbm` (loop-exact) → spectral interference → RGB. A gravity drain gradient is optional.
- **Grating.** Diffraction from curved gratings and CD-like tracks, with angle swept by integer turns.
- **Airy.** Aperture diffraction (Airy discs, star spikes from polygon apertures, defocus), driven by `sdNgon`.
- **Caustic.** Analytic caustic networks from sums of sinusoidal height fields, via a gradient-divergence approximation (no raymarch).
- **Prism.** Dispersive refraction of a vector or text input through a lens SDF, with 8 spectral taps (watch the texture-read budget: 8 samples × passes).
- **Newton.** Interference rings from a thickness profile, with a slow integer-cycle breathing.

**Looks (shared):** spectral, filmic-tonemapped spectral, palette-projected spectral (maps the spectrum into the three palette accents, so it respects the user's palette).

**Effects:** *Heightfield Refraction* (luminance as height), *Chromatic Dispersion*, *Anamorphic Flare*, *Iridescent Edge*.

**Needed prelude-level helpers (put in a `motif-color@1` module):** OKLab/OKLCH conversion and interpolation, a CIE-fit `spectrum(lambda)` → linear RGB, `thinFilm(thickness, n, cosθ)`, and selectable tone curves (ACES, filmic, none).

**Affect:** warm low-chroma films read as nostalgic; saturated high-frequency dispersion reads as euphoric or overstimulated. `tone` rotates hue in OKLCH and shifts the chroma ceiling. `energy` drives film-thickness gradient and sweep rate.

**Acceptance extras:** every style must survive `u_safe=1` with no flash and no luminance excursion above 20% per 100 ms. Provide a `--colorblind` preview contact sheet, and note which styles stay legible.

---

## 3. SYMMETRY: the grammar of pattern

**Premise.** Symmetry is a parameter. Wallpaper groups, quasicrystals and hyperbolic tilings, all as folds of space, applied to anything.

**Why it's revolutionary.** A true `transform` class: fold the layers below through a group, instead of only generating patterns. Quasicrystal and hyperbolic motion stays exactly periodic because phases and Möbius parameters close on circles.

**Styles:**
- **Wallpaper.** All 17 wallpaper groups via a `select`, drawing a seeded motif or a field inside the fundamental domain.
- **Frieze.** The 7 frieze groups, for type and line work (accepts a `text` input).
- **Quasi.** Sum of N plane waves at 5, 7, 8 or 12-fold symmetry (de Bruijn pentagrid). Phases are shifted by integer cycles.
- **Poincaré.** Hyperbolic {p,q} tilings on the disk, with a rotating Möbius transformation that closes exactly. The domain is folded with a bounded loop (max reflections as a manifest param).
- **Kaleido.** Mirror-fold kaleidoscope with an `order` param and a smooth↔faceted morph.
- **Moiré.** Two near-identical lattices rotating at integer ratios.

**The key piece:** a `Fold` effect and a `fold()` stdlib function: `vec2 fold(vec2 uv, int group, float param)`, so any other style can adopt a group from `common.glsl`.

**Looks:** line-art, flat-fill, engraved, stained-glass (cell-lit).

**Affect:** perfect symmetry reads as calm, sacred and authoritative. A controlled break reads as tension or humor. `order` blends the pure fold toward a seeded perturbation. `tone` biases to rotational (warm, organic) or reflective (cool, formal) groups.

**Acceptance extras:** each group's fold must be idempotent (`fold(fold(x)) ≈ fold(x)`). Check that a wallpaper pattern has no visible seam at the domain edge (a unit test on the contact sheet).

---

## 4. BOUBA/KIKI: forms of feeling

**Premise.** The most direct translation of emotion into form. One continuous shape space runs from round to angular, with rhythm, envelope and palette temperature working together as an *affect instrument*.

**Why it's revolutionary.** Emotion becomes a first-class, data-driven, evolvable layer: a mapping from (arousal, valence) → every parameter in the kit, validated by tooling. This is the kit that makes the macro params *the* interface.

**Styles:**
- **Superform.** Gielis superformula SDF with m, n1, n2, n3 and a round↔spiky morph. Single hero shape, or a field of them (`sdStar`, `sdNgon` for the angular end).
- **Breath.** A form that inhales and exhales with an asymmetric envelope. Slow attack and fast release reads as relief. Fast attack and slow decay reads as dread. The envelope shape is a param.
- **Heartfield.** A grid of forms whose pulse timing comes from `tslot` with a regularity param: perfect meter (calm) → syncopated → irregular (anxious). Obeys `u_safe`.
- **Tension.** Field lines between charges where `tone` sets attraction versus repulsion, and `energy` sets how close they get to touching.
- **Gesture.** Vector strokes (svg input) whose easing and overshoot encode emotion (snap, glide, tremble).
- **Weather.** A full-frame bed: calm → storm, built from `lfbm` curl and cloud-like advection.

**Affect system (the core deliverable):**
- A `affect.json` table mapping the circumplex (arousal, valence on a 5×5 grid) → named presets (serene, tender, joyful, proud, tense, dread, angry, melancholy, wonder) for every style.
- A `motif-kit` script `affect-check` that renders each grid cell for each style and reports measurable descriptors (motion energy, mean luminance, edge density, curvature, palette temperature) and flags any cell where the descriptors don't move in the expected direction.

**Effects:** *Tremor* (loop-exact micro-jitter, scaled by energy), *Warm/Cool Grade* (OKLCH).

**Palettes:** one per quadrant, plus a neutral.

**Acceptance extras:** descriptor monotonicity: raising `energy` must raise motion energy and contrast, raising `tone` must raise warmth and mean curvature, across at least 90% of seeds.

---

## 5. GENESIS: patterns that grow

**Premise.** Turing patterns, crystal growth, reaction–diffusion, flow and fracture, where the pattern is a *relaxed state* of a PDE from a looping seed. This is Tier B (iterated within a frame, still scrubbable) and the proving ground for evolution.

**Why it's revolutionary.** The pattern is a pure function of the params path, so moving the params around a closed curve gives exact loops with *living-looking* morphogenesis, no state needed. The kit also ships a machine-generated atlas of the best regions of each parameter space.

**Styles (`capabilities: ["feedback"]`):**
- **Turing.** Gray–Scott / Swift–Hohenberg relaxed from a loop-exact seed. The (F,k) pair orbits a closed curve through the parameter plane (spots → stripes → labyrinth → holes).
- **Crystal.** Johnson–Mehl and weighted-Voronoi growth with seed sites on closed orbits, plus facet shading.
- **Dendrite.** Diffusion-limited-style growth by iterated threshold diffusion from a looping seed.
- **Flow.** Curl-noise (divergence-free) with line-integral convolution across several passes, for hair, wood and fingerprint textures.
- **Fracture.** Drying-crack networks from iterated gradient thresholds, with crack width set by `energy`.
- **Lichen.** Multi-species competition (3 channels, one per palette accent).

**Budget guidance:** 8 to 16 iterations at half resolution, with buffers at `scale: 0.5`. Each iteration reads at most 5 texels. Verify with `bench` and set `cost` honestly.

**Looks:** ink, relief (lit height), thermal, risograph (2-color halftone with misregistration).

**Effects:** *Relax* (runs a few diffusion steps on the input, which turns any image into a pattern), *Bleed*.

**Evolution tooling (the key deliverable):**
- An `atlas.mjs` script: samples 2,000 param vectors per style, renders at 64×64, computes descriptors (luminance, edge density, motion energy across 4 phases, symmetry, spectral centroid), runs MAP-Elites over them, and writes `presets/<style>-atlas.json` with 16 to 64 diverse, valid presets per style.
- Rejects dead regions automatically (blank, saturated, static, seam-failing) and writes them to each style card's "known-bad param regions".
- Golden-frame hashes per `(style, seed, phase)` for regression.

**Affect:** order from chaos reads as hope or wonder. Fracture and labyrinth read as tension. `order` is literally the relaxation depth.

**Acceptance extras:** the loop seam passes for every atlas preset, and the atlas covers at least 80% of the descriptor grid cells that any random sample reaches.
