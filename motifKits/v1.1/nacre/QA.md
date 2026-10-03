# Validation evidence — Nacre 1.0.0

SDK 4 schema and static shader validation passed for all nine entries. All 36 actual SDK-expanded GLES 3 shader passes compiled and linked in local Mesa EGL. The four-pass graph was rendered into RGBA16F scene/bloom targets.

At 256×144, all nine default renders were nonblank and changed across phases 0, .25, .5 and .75. Phase 0 versus phase 1 had exact zero RGB pixel difference for every entry. Each art control was checked at its min/max at phase .25 and 128×72; all affected the output. Aether quality samples intentionally preserve brightness rather than changing the look. These discrete checks are not a proof of every intermediate phase or parameter combination.

The default first entry was also rendered across 40 phases at 360×202 for the fallback preview film and at 390×520 for portrait inspection. Product pages embed the actual packaged GLSL and unmodified SDK runtime. Their rendered fallback film is accelerated to a 12-second cycle; live view defaults to a 60-second cycle.

Browser automation was unavailable because the local Chromium binary is absent. No real phone performance, browser integration, flash certification or exhaustive frame-by-frame seam-neighbour derivative testing is claimed. Pending compilation is polled with a 20-second retry affordance; WebGL context restoration is handled in the page.

SDK 4 buffers reset every frame. Nacre/Oriel life-like detail is a stateless procedural cyclic approximation, not a persistent Game of Life simulation. The fast-loop safe-mode contrast treatment is implemented but is not certified by a flash-analysis tool.

## Measurements

| Style | Endpoint RGB difference | Four-phase motion RGB difference |
|---|---:|---:|

Near-seam samples at phases .999 and .001 were also rendered for all entries at 128×72. Changes were small or comparable to same-width mid-cycle samples (.499/.501), consistent with continuous loop closure. The page script passed a mocked-DOM smoke check using the real SDK validator: all nine selections, parameter creation, palette data, pause/reset and graphics context restoration. This checks integration logic, not real browser rendering.

| cellsea | 0.000 | 31.766 |
| symbiosis | 0.000 | 32.135 |
| colony-bloom | 0.000 | 28.354 |
| membrane-choir | 0.000 | 32.552 |
| tide-organism | 0.000 | 30.361 |
| biolume | 0.000 | 32.900 |
| mitosis | 0.000 | 26.195 |
| polyp-garden | 0.000 | 21.065 |
| hollow-moon | 0.000 | 26.616 |
