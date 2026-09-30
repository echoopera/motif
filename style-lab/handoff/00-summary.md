# Motif Style Lab — handoff summary

A browser playground of 25 procedural animation styles with parametric controls, Mutate / Evolve / Randomize, per-parameter locks, unlimited undo, saved looks, preset import/export, six aspect ratios, and frame-accurate export to MP4, WebM, PNG sequence, PNG and preset JSON.

- **Run:** open `dist/standalone.html`, or the published artifact.
- **Build:** `node build/build.js` (standard library only).
- **Evidence:** `tests/results.json` (19/19), `tests/perf.json`, reviews in `harness/state/reviews/`.
- **Known limits:** MP4 export untested here (no H.264 encoder in the test browser); no photosensitivity limiter; screen-reader walkthrough not done; styles are Canvas 2D, capped around 5,000 particles.
