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
| phi-bloom-hero | 0 | 1.07 | 1.07 | 0 | 0.3% | pass |
| copper-fern | 0 | 0.02 | 1.16 | 0 | 0.8% | pass |
| spiral-canopy | 0 | 1.11 | 1.12 | 0 | 0.2% | pass |
| twin-phyllotaxis | 0 | 0.95 | 1.07 | 0 | 0.4% | pass |
| ivory-helix | 0 | 1.77 | 1.06 | 0 | 0.8% | pass |

## Harmonic Matter

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 12219 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| harmonic-matter-hero | 0 | 1.29 | 1.32 | 0 | 0.0% | pass |
| nodal-sea | 0 | 1.19 | 1.64 | 0 | 0.0% | pass |
| amber-antinodes | 0 | 1.12 | 1.15 | 0 | 0.0% | pass |
| crosswave-veil | 0 | 0.98 | 1.12 | 0 | 0.0% | pass |
| resonant-basin | 0 | 1.11 | 1.44 | 0 | 0.0% | pass |
| silver-interference | 0 | 1.11 | 1.22 | 0 | 0.0% | pass |
| phase-ribbons | 0 | 1.02 | 1.63 | 0 | 0.0% | pass |
| standing-crest | 0 | 0.87 | 1.61 | 0 | 0.0% | pass |
| quiet-chladni | 0 | 0.76 | 1.93 | 0 | 0.0% | pass |

## Sacred Lattice

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 3143 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| sacred-lattice-hero | 0 | 0.86 | 1.17 | 0 | 2.1% | pass |

## Astral Threshold

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 728 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| astral-threshold-hero | 0 | 0.99 | 1.12 | 0 | 2.5% | pass |
| violet-passage | 0 | 0.63 | 1.38 | 0 | 0.6% | pass |
| blue-veil | 0 | 1.04 | 1.27 | 0 | 0.5% | pass |
| folded-ether | 0 | 1.13 | 1.23 | 0 | 1.8% | pass |
| filament-gate | 0 | 1.01 | 1.1 | 0 | 0.6% | pass |
| luminous-expanse | 0 | 1.37 | 1.34 | 0 | 1.2% | pass |
| membrane-drift | 0 | 1.05 | 1.15 | 0 | 1.7% | pass |
| deep-aperture | 0 | 1.04 | 1.29 | 0 | 1.2% | pass |
| quiet-transit | 0 | 0.9 | 1.26 | 0 | 2.5% | pass |

## Cellular Cosmos

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 135 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| radial-organs | 0 | 1.25 | 1.68 | 3 | 0.4% | flash warn |
| cellular-cosmos-hero | 0 | 1.05 | 1.18 | 0 | 0.2% | pass |

## Topological Tide

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 123 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| topological-tide-hero | 0 | 0.88 | 1.17 | 0 | 12.0% | pass |
| ivory-gyroid | 0 | 1.03 | 1.34 | 0 | 14.4% | pass |
| ceramic-web | 0 | 0.94 | 1.14 | 0 | 14.6% | pass |

## Deconstruct Field

Pass graph: single full-resolution analytic pass. Worst-case static budget: 36 loop iterations/px, 0 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| plane-argument | 0 | 2.81 | 2.98 | 0 | 2.8% | pass |
| red-interruption | 0 | 1.46 | 1.93 | 0 | 5.7% | pass |
| deconstruct-field-hero | 0 | 1.64 | 1.86 | 0 | 5.9% | pass |

## Post-Punk Resonance

Pass graph: single full-resolution analytic pass. Worst-case static budget: 21 loop iterations/px, 0 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| post-punk-hero | 0 | 0 | 1.36 | 0 | n/a (no quality-dependent pass) | pass |
| acid-carrier | 0 | 0 | 1.18 | 0 | n/a (no quality-dependent pass) | pass |
| red-signal | 0 | 0 | 1.14 | 0 | n/a (no quality-dependent pass) | pass |
| broken-ring | 0 | 0 | 1.36 | 0 | n/a (no quality-dependent pass) | pass |
| blackout-geometry | 0 | 0 | 1.38 | 0 | n/a (no quality-dependent pass) | pass |
| interference-cut | 0 | 0 | 1.46 | 0 | n/a (no quality-dependent pass) | pass |
| stepped-oscillator | 0 | 0 | 0 | 0 | n/a (no quality-dependent pass) | pass |
| graphic-feedback | 0 | 0 | 1.52 | 0 | n/a (no quality-dependent pass) | pass |
| quiet-noise | 0 | 0 | 1.42 | 0 | n/a (no quality-dependent pass) | pass |

## After Cyber

Pass graph: scene → glow A (0.25) → glow B (0.125) → output (1.0). Worst-case static budget: 1256 loop iterations/px, 25 fetches/px (limits 32768 / 2048).

| Style | Delta0 | Seam x | Pop x | Flash tiles | Exposure spread | Verdict |
|---|---|---|---|---|---|---|
| after-cyber-hero | 0 | 0.63 | 1.77 | 0 | 0.1% | pass |
| cyan-scaffold | 0 | 0.58 | 2.49 | 0 | 0.0% | pass |
| glass-drift | 0 | 0.7 | 1.77 | 0 | 0.0% | pass |
| lime-assembly | 0 | 0.26 | 1.59 | 0 | 1.2% | pass |
| particle-covenant | 0 | 0.18 | 1.48 | 0 | 0.2% | pass |
| broken-polyhedron | 0 | 1.15 | 1.54 | 0 | 0.0% | pass |
| organic-circuit | 0 | 0.55 | 1.88 | 0 | 0.1% | pass |
| smoky-network | 0 | 0.66 | 1.92 | 0 | 0.1% | pass |
| quiet-reconstruction | 0 | 1.29 | 1.58 | 0 | 0.0% | pass |

