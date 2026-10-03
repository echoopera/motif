# Motif SDK 4 kits

Nine production kits for **Motif Kit SDK 4.0** (`motif-kit@4`), built from the nine PRDs and engineering starters in `docs/brief/`.
Each kit has nine styles (a validated flagship plus eight structurally different variants), 4–5 authored palettes, and loops
seamlessly by construction. All 81 styles are pure data + GLSL: no media, text, vector, audio or feedback capability is used.

| # | Kit | Hero idea | Renderer | Passes |
|---|---|---|---|---|
| 01 | Phi Bloom | golden-angle ivory blades, log-spiral thread | analytic lattice scan, 3 strata | scene · glow · glow · out |
| 02 | Harmonic Matter | standing-wave membranes, amber peaks, attached particles | slab march + bisection (implicit) | scene · glow · glow · out |
| 03 | Sacred Lattice | nested gold cages, glass facets, circle chords | exact capsule projection | scene · glow · glow · out |
| 04 | Astral Threshold | violet / ice membranes, distant aperture | step-normalised volume (density) | scene · glow · glow · out |
| 05 | Cellular Cosmos | emerald / coral colonies, division and migration | weighted 5×5 Voronoi, periodic choreography | scene · glow · glow · out |
| 06 | Topological Tide | ivory ceramic + copper gyroid | sphere tracing with derived Lipschitz bounds | scene · glow · glow · out |
| 07 | Deconstruct Field | cream, black, cobalt, vermilion planes and arcs | single crisp SDF pass | 1 |
| 08 | Post-Punk Resonance | acid yellow stripes, rings, wave cuts on beats | single crisp analytic pass | 1 |
| 09 | After Cyber | cyan lattice dissolving into lime particles, smoky glass | node-window scan + convex polyhedron | scene · glow · glow · out |

## Layout

```
kits/<id>/            the kit source folders the SDK reads (manifest.json, common.glsl, styles/*.glsl, README.md)  (generated)
dist/<id>-1.0.0.motifkit   packed kits, drop onto Motif 8 or Kits > Install
src/<NN>-<id>/        hand-written source: kit.mjs (metadata, params, palettes, styles) and core.glsl (the shader)
src/_shared/          shared GLSL library (OKLab, tone map, loop helpers) and the three shared post passes
src/_showcase/        template of the animated one-page showcase
tools/                build, harness (SDK runtime in headless Chromium), QA, films, showcase, docs generators
sdk/                  Motif Kit SDK 4.0.0 as supplied (unchanged)
showcase/index.html   standalone animated product page (live shaders, inspector, evidence table)
deliverables/         1440x2560 stills and loop films
qa/                   contact sheets, per-control captures and JSON results
docs/                 CONTRACT-MAP.md, PARAMETERS.md, QA-REPORT.md, brief/ (the supplied PRDs and starters)
```

## Rebuild

```sh
cd sdk4-kits && (cd sdk && npm i)
node tools/build.mjs                         # src/ -> kits/
for k in kits/*/; do node sdk/bin/motif-kit.mjs validate $k; node sdk/bin/motif-kit.mjs pack $k --out dist; done
export MOTIF_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
node tools/qa.mjs sheet <kit> all            # look at every style
node tools/qa.mjs qa <kit> all               # seam, pops, flashes, exposure
node tools/qa.mjs controls <kit> <style>     # every control at min/default/max
node tools/render-all.mjs stills|films <kit> # 1440x2560 stills, loop films
node tools/build-showcase.mjs && node tools/test-showcase.mjs
```

`motif-kit validate` is static analysis only; `tools/qa.mjs` also **compiles** every style in the SDK's runtime, which caught a reserved-identifier error that
validation accepts (see `docs/CONTRACT-MAP.md`).

## How the loops close

* Time enters only through `u_p`; theta = 2π·fract(u_p). Every temporal harmonic is an integer multiple of theta. Fractional values appear only in static angles, spatial frequencies and seeded phases.
* Excursions are closed cosine bells or quintic in-hold-out-return schedules (zero velocity at each end); particle and cell lifecycles are closed choreography on stable IDs (no persistent simulation exists in the SDK contract).
* Lattice flow (Phi Bloom) translates whole indices per loop and every attribute is a smooth function of the effective index, so petal *m* at the seam equals petal *m+k* at the start.
* Beat and turn counts go through `safeCycles`, and sweeping amplitudes through `k_calm()`, so the worst case (1 s loop at 4× tempo, limiter on) holds still rather than flashing.

## Field classes and bounds

Each core states its field classes at the top of `core.glsl` (copied into each kit's README). Sphere-traced fields use a derived Lipschitz constant, never a
smaller step multiplier: gyroid `k·√6·(1 + A·kw)`, Möbius `√(1 + (rmax / 2(R − rmax))²)`, folded plate `√(1 + (A·k)²)`, torus and ball exact.
Volumes integrate with the ray-step length (`T *= exp(-σρ·ds)`), which is why Astral Threshold's exposure moves by less than 3 % between Live and Export.

## Known limitations and honesty notes

* **No device performance is claimed.** All timings and metrics were produced in headless Chromium with SwiftShader (CPU) and are relative diagnostics. The < 4 ms live / < 16 ms broadcast targets are unverified on real hardware; heavy styles (Topological Tide at scale 1.0, Astral Threshold, Harmonic Matter) will need a lower render scale on phones.
* Glass in Sacred Lattice and After Cyber is an **approximation** (additive facets; screen-space offset along the facet normal), not refraction.
* Topological Tide's Live quality drops AO and shadow samples, so its Live-versus-Export exposure spread sits close to the 15 % limit (see `docs/QA-REPORT.md`).
* The Möbius and perforated-fold fields are single sheets with exact analytic bounds but have not been reviewed on every parameter extreme; QA covers default, min and max of each control for the heroes only.
* Not measured: context loss/restore, background/resume and rapid style selection beyond the showcase page's own handling (compile polling with a 20 s retry, hidden-tab pause).
* The briefs' `REFERENCE.png` and `REFERENCE-BOARD.jpg` files were not in the supplied zip, so looks were developed from the written briefs and prototype fragments.
