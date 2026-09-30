# Style Lab 2 — project update (2026-09-28)

New build of Motif Style Lab, on top of v1 (`style-lab/`), same design-harness methodology (brief → decisions → work orders → module contracts → build → gates → handoff).

**Built this pass (priority 1,2,4,5,7,8 of the 10 enhancements list):**
1. Keyframe any parameter — cyclic per-loop keyframes on layer/finish params, 5 eases, path grammar `L:<layer>:p|s|c:<key>` / `F:<key>`.
2. Layer styles — up to 4 layers, 11 blend modes, shape/luma masks.
4. Brand colour matching — OKLab/OKLCH palette editor, harmonize, image-based extraction (k-means), broadcast-safe legalizer.
5. Motion blur + finishing stack — WebGL2 half-float accumulation, bloom/blur, levels/gradient-map/grain/vignette, zebra overlay.
7. WebGPU engine — particle-form, flow-field, orbital-swarm, metaballs moved to GPU (WGSL, shared noise w/ CPU), automatic CPU fallback.
8. Audio/beat sync — offline FFT + 8-band envelopes, autocorrelation tempo/downbeat detection, live mic input (preview only), band→parameter mapping.

Pinned/sticky preview: canvas stays fixed on both desktop and iPhone widths while controls scroll (verified across 5 viewports).

**Deferred to backlog (per your priority call), PRD-only:** custom text/fonts (3), pro delivery formats — ProRes/DNxHR/alpha/timecode/render queue/flash limiter (6), comparison grid/A-B/Evolve family tree (9), Motif/agent-studio hooks — MCP, shared storage (10).

**Verification:** 39/39 e2e checks pass (keyframes/loops, layers/blends/masks, colour/spaces/limiter, motion blur/finish, GPU engine, audio/export, pinned preview, keyboard/a11y). Design critique 4.3/5, "pass."

**Known limits (unverified in this sandbox, not bugs):** MP4/H.264 + AAC export (no encoder in this Chromium build), real iOS Safari device, real GPU hardware perf (numbers here are SwiftShare/CPU-emulation upper bounds), live-mic hardware.

**In this folder:**
- `dist/index.html` — the built app (open directly in a browser)
- `motif-style-lab-2.zip` — full harness project (brief, decisions, work orders, module contracts, all module source, tests, reviews, handoff)

**Also updated:** the Motif PRD doc — new "Style Lab 2" section (enhancements table, requirements LAB-01–LAB-18, `preset@2` interface, build status).
