# Motif Style Lab

Browser playground of 25 procedural animation styles (kinetic type, geometry, particles and physics, generative) with parametric controls, Mutate / Evolve / Randomize, per-parameter locks, undo, saved looks, preset import/export, six aspect ratios, and export to MP4, WebM, PNG sequence, PNG and preset JSON.

- **Run:** open `dist/standalone.html` in Chrome or Edge.
- **Build:** `node build/build.js` (Node standard library only). Rebuilds `dist/` from `modules/*/src/index.js` in the order set by `modules/graph.json`.
- **Tests:** `tests/e2e.js` (Playwright end-to-end suite).

## Layout

| Path | Contents |
| --- | --- |
| `modules/tokens` | UI tokens, artwork palettes, fonts, aspect ratios, colour math |
| `modules/engine-core` | Seeded RNG, simplex noise, easing, springs, parameter model (mutate, randomize) |
| `modules/style-library` | The 25 styles, each a pure function of loop phase |
| `modules/renderer` | Stage, thumbnails, frame rendering |
| `modules/exporter` | Video, PNG sequence, PNG and preset export |
| `modules/web-immersive-shell` | App shell: library, stage, inspector, Evolve, export dialog |
| `design/motif-style-lab` | Research, direction, IA, visual system, motion spec, screen spec, copy |
| `handoff` | Summary and next steps |

Built with Design Harness 3.0. The harness framework itself (scripts, agent profiles, gates) is not included; the source here rebuilds byte-for-byte to the published Style Lab.
