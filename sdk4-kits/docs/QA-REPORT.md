# QA report

Generated from `qa/<kit>/qa.json` (written by `tools/qa.mjs qa`). Renderer: headless Chromium, SwiftShader software GL, 180x320. Metrics are defined in `tools/qa.mjs`:

- **Delta0**: mean absolute 8-bit difference between phase 0 and phase 1 (identical seed and parameters). `0` means bit-identical.
- **Seam x**: the larger of the two one-frame steps straddling the wrap (60 fps, 12 s loop), divided by the median one-frame step of the loop. About 1 means the seam is as smooth as any other frame; the playbook fails at Delta0 > 1.5 on its own metric, which is not available outside AgentMotif, so this is reported as defined here.
- **Pop x**: maximum one-frame step divided by the median step among moving frames (holds excluded). Target < 3, fail > 6.
- **Flash tiles**: tiles of a 4x4 grid exceeding 3 flash pairs per second in the worst case (1 s loop at 4x tempo, limiter on), WCAG-style 0.1 relative-luminance swing. < 4 passes, 1-3 is a warning.
- **Exposure spread**: max/min mean luminance across Live/Balanced/Export at one phase; target within 15%.

## Phi Bloom

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 558 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| phi-bloom-hero | 0 | 1.04 | 1.05 | 0 | 1.9% | pass |
| golden-seed | 0 | 1.3 | 1.3 | 0 | 1.9% | pass |
| copper-fern | 0 | 0.02 | 1.19 | 0 | 2.1% | pass |
| ivory-helix | 0 | 1.16 | 1.09 | 0 | 0.0% | pass |
| jade-crown | 0 | 1.01 | 1.03 | 0 | 2.8% | pass |
| spiral-canopy | 0 | 1.06 | 1.11 | 0 | 2.2% | pass |
| twin-phyllotaxis | 0 | 0.95 | 1.07 | 0 | 2.2% | pass |
| orbital-petals | 0 | 0.94 | 1.14 | 0 | 4.0% | pass |
| quiet-unfold | 0 | 1.38 | 1.42 | 0 | 0.2% | pass |

## Harmonic Matter

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 12219 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| harmonic-matter-hero | 0 | 1.08 | 1.39 | 0 | 0.0% | pass |
| nodal-sea | 0 | 1.14 | 1.64 | 0 | 0.0% | pass |
| amber-antinodes | 0 | 1.06 | 1.21 | 1 | 0.0% | flash warn |
| crosswave-veil | 0 | 0.99 | 1.24 | 0 | 0.0% | pass |
| resonant-basin | 0 | 1.05 | 2.14 | 0 | 0.0% | pass |
| silver-interference | 0 | 0.72 | 1.34 | 0 | 0.0% | pass |
| phase-ribbons | 0 | 0.96 | 1.51 | 0 | n/a (no quality-dependent pass) | pass |
| standing-crest | 0 | 0.83 | 1.68 | 0 | n/a (no quality-dependent pass) | pass |
| quiet-chladni | 0 | 0.69 | 1.59 | 0 | n/a (no quality-dependent pass) | pass |

## Sacred Lattice

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 3143 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| sacred-lattice-hero | 0 | 0.86 | 1.12 | 0 | 2.7% | pass |
| octahedral-chapel | 0 | 1.19 | 1.51 | 1 | 1.1% | flash warn |
| tetrahedral-orbit | 0 | 1.08 | 1.17 | 0 | 2.9% | pass |
| golden-icosahedron | 0 | 1.06 | 1.12 | 0 | 9.0% | pass |
| circle-cathedral | 0 | 1.03 | 1.03 | 0 | n/a (no quality-dependent pass) | pass |
| nested-compass | 0 | 1.02 | 1.03 | 0 | n/a (no quality-dependent pass) | pass |
| glass-constellation | 0 | 1.11 | 1.1 | 0 | 10.4% | pass |
| axial-halo | 0 | 1.14 | 1.21 | 0 | 2.5% | pass |
| silent-symmetry | 0 | 0.96 | 1.07 | 0 | 1.9% | pass |

## Astral Threshold

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 728 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| astral-threshold-hero | 0 | 0.99 | 1.12 | 0 | 1.1% | pass |
| violet-passage | 0 | 0.62 | 1.39 | 0 | 0.4% | pass |
| blue-veil | 0 | 1.05 | 1.27 | 0 | 0.3% | pass |
| folded-ether | 0 | 1.1 | 1.21 | 0 | 1.6% | pass |
| filament-gate | 0 | 1.01 | 1.1 | 0 | 0.6% | pass |
| luminous-expanse | 0 | 1.39 | 1.33 | 0 | 0.8% | pass |
| membrane-drift | 0 | 1.04 | 1.14 | 0 | 1.3% | pass |
| deep-aperture | 0 | 1.05 | 1.31 | 0 | 0.3% | pass |
| quiet-transit | 0 | 0.93 | 1.23 | 0 | 1.2% | pass |

## Cellular Cosmos

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 135 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| cellular-cosmos-hero | 0 | 0.98 | 1.11 | 0 | 0.2% | pass |
| emerald-colonies | 0 | 1.07 | 1.27 | 1 | 0.2% | flash warn |
| coral-division | 0 | 0.88 | 1.15 | 0 | 0.3% | pass |
| membrane-choir | 0 | 0.97 | 1.14 | 1 | n/a (no quality-dependent pass) | flash warn |
| spore-drift | 0 | 1.01 | 1.08 | 0 | n/a (no quality-dependent pass) | pass |
| symbiotic-web | 0 | 0.94 | 1.13 | 0 | n/a (no quality-dependent pass) | pass |
| radial-organs | 0 | 1.17 | 1.77 | 2 | 0.4% | flash warn |
| quiet-mitosis | 0 | 0.83 | 1.57 | 0 | n/a (no quality-dependent pass) | pass |
| tidal-habitat | 0 | 1.07 | 1.3 | 0 | 0.2% | pass |

## Topological Tide

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 123 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| topological-tide-hero | 0 | 0.86 | 1.12 | 0 | 11.8% | pass |
| ivory-gyroid | 0 | 0.94 | 1.23 | 0 | 14.3% | pass |
| chrome-channels | 0 | 0.97 | 1.14 | 0 | 6.4% | pass |
| cobalt-torus | 0 | 0.88 | 1.25 | 0 | 0.7% | pass |
| mobius-current | 0 | 1.01 | 1.2 | 2 | 0.0% | flash warn |
| perforated-fold | 0 | 0.86 | 1.26 | 0 | 3.8% | pass |
| ceramic-web | 0 | 0.98 | 1.08 | 0 | 14.4% | pass |
| golden-neck | 0 | 0.96 | 1.26 | 0 | 10.8% | pass |
| quiet-surface | 0 | 1.14 | 1.21 | 0 | 7.3% | pass |

## Deconstruct Field

Pass graph: single full-resolution analytic pass. Worst-case static budget: 36 loop iterations/px, 0 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| deconstruct-field-hero | 0 | 1.49 | 1.73 | 0 | 3.2% | pass |
| broken-axis | 0 | 1.54 | 1.64 | 0 | 1.9% | pass |
| cobalt-cut | 0 | 1.78 | 1.72 | 0 | 3.3% | pass |
| offset-scaffold | 0 | 1.45 | 1.46 | 0 | 0.0% | pass |
| plane-argument | 0 | 2.98 | 1.59 | 0 | 1.7% | pass |
| partial-circle | 0 | 1.57 | 1.74 | 0 | 2.7% | pass |
| red-interruption | 0 | 1.4 | 1.5 | 0 | 3.2% | pass |
| grid-dislocation | 0 | 1.12 | 1.19 | 0 | 2.8% | pass |
| quiet-construct | 0 | 1.19 | 1.84 | 0 | 1.3% | pass |

## Post-Punk Resonance

Pass graph: single full-resolution analytic pass. Worst-case static budget: 21 loop iterations/px, 0 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| post-punk-hero | 0 | 0 | 1.46 | 0 | n/a (no quality-dependent pass) | pass |
| acid-carrier | 0 | 0 | 1.18 | 0 | n/a (no quality-dependent pass) | pass |
| red-signal | 0 | 0 | 1.16 | 0 | n/a (no quality-dependent pass) | pass |
| broken-ring | 0 | 0 | 1.31 | 0 | n/a (no quality-dependent pass) | pass |
| blackout-geometry | 0 | 0 | 1.52 | 0 | n/a (no quality-dependent pass) | pass |
| interference-cut | 0 | 0 | 1.68 | 0 | n/a (no quality-dependent pass) | pass |
| stepped-oscillator | 0 | 0 | 0 | 0 | n/a (no quality-dependent pass) | pass |
| graphic-feedback | 0 | 0 | 1.68 | 0 | n/a (no quality-dependent pass) | pass |
| quiet-noise | 0 | 0 | 1.44 | 0 | n/a (no quality-dependent pass) | pass |

## After Cyber

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 1256 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| after-cyber-hero | 0 | 0.82 | 1.45 | 0 | n/a (no quality-dependent pass) | pass |
| cyan-scaffold | 0 | 0.96 | 1.99 | 0 | n/a (no quality-dependent pass) | pass |
| glass-drift | 0 | 1 | 1.5 | 0 | n/a (no quality-dependent pass) | pass |
| lime-assembly | 0 | 0.27 | 1.47 | 0 | n/a (no quality-dependent pass) | pass |
| particle-covenant | 0 | 0.37 | 1.87 | 0 | n/a (no quality-dependent pass) | pass |
| broken-polyhedron | 0 | 1.26 | 1.37 | 0 | n/a (no quality-dependent pass) | pass |
| organic-circuit | 0 | 0.83 | 1.85 | 0 | n/a (no quality-dependent pass) | pass |
| smoky-network | 0 | 1.04 | 1.64 | 0 | n/a (no quality-dependent pass) | pass |
| quiet-reconstruction | 0 | 1.19 | 1.46 | 0 | n/a (no quality-dependent pass) | pass |

