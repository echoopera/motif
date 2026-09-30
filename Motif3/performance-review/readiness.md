# Motif3 performance review — 2026-09-28
Echo Studio 1.2.0. Scope v1. Owner/author/reviewer: Codex (self-review).

## Baseline and readiness
Inspected build.py, renderer/compositor/exporter in the base HTML, GPU runtime, governor, media store, SDK audit and shell patches. Original files preserved in baseline/. No Git repository exists here.

- Intent checked: improve real-time performance without sacrificing output quality; inspect actual hardware use. No publication or visual redesign.
- Existing project checked: generated single-file browser app with reproducible Python patch build; WebGL2 kits and finishing, optional WebGPU styles, Canvas 2D compositor and CPU styles.
- Evidence checked: local Chrome reports Apple M5 Pro / ANGLE Metal, software=false, timer=true, no page errors. WebGPU unavailable in this file-based test; not all styles are GPU accelerated.
- Capabilities checked: local Python/Node and Playwright Chrome available. Builder/web and Quality/resilience/verifier applied sequentially with engineering pack.
- Architecture checked: edits confined to src/parts, build.py, generated HTML, docs and focused validation. Preserve media color space, mipmaps, exact export resolution and shutter samples.
- Verification conditional: test synthetic video, deterministic frame comparisons, stage cadence, source compile/build, short export. Actual user clips and Safari not supplied/tested; no universal FPS guarantee.

## Assignment and acceptance
Single owner. Ready with conditions above for targeted media upload, governor and paused-quality fixes. Acceptance: no page errors; hardware renderer identified; repeated decoded frame reuses media bake; changed frame uploads without texture reallocation; original/final full-resolution frame pixels match for fixtures; frame governor responds to missed 60 Hz cadence; full-quality paused rendering; short export succeeds. Record measured distribution, not just mean. Avoid claiming independent review or guaranteed 4K/60.

## Gaps
G1: arbitrary user video/complex scene workloads unknown (non-blocking; synthetic fixtures and documented limits; recheck with production clips).
G2: other browser/device behavior unknown (non-blocking for local Chrome scope; report explicitly).
G3: baseline audit hardcodes Linux Playwright and SwiftShader (resolved for this task with local Chrome validation; do not use software timings as device evidence).

Reassess if pixel parity, export or browser checks fail. Runtime optimizations are local, reversible and backed up.

## Revision 2 — incoming 3.2.0 update
Concurrent external replacement of src/ and generated HTML detected during final regression. Preserved exact incoming files in incoming/. Source diff confirms added SDK parameter support; rendering runtime baseline unchanged. Reapplied scoped performance changes, preserving new parameter files/build steps and all incoming library/UI updates. Revalidate combined artifact. Added performance_patch.py to write scope. Earlier measurements describe pre-integration artifact until the suite is rerun.
