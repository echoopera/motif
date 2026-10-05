# Motif 8 tests

| Command | What it checks |
| --- | --- |
| `node --test tests/v8/unit.test.mjs` | 12 DOM-free tests against the SDK build of the engine: stack, svg, distance-field and sequence validation, playhead closure and continuity, planner, sanitizer, svg parser (including hostile input), distance-field accuracy |
| `node tests/v8/browser.mjs` | 67 checks in headless Chromium (software GL) against `Motif.html`: boot, bundled kits, in-app validation, determinism, loop closure, Sequencer rendering and inspector, worker and main-thread parity, shader/JS playhead parity, video layers (needs `ffmpeg`) |
| `node tests/v8/regression.mjs [Motif-7.1.1.html]` | Motif 7.1.1 against 8: kit validation byte-identical, every style renders identical pixels (defaults to `src-v8/Motif-7.1.1.html`) |

Browser tests need Playwright and Chromium: `npm i playwright && npx playwright install chromium`, or set `PLAYWRIGHT_MODULE` (path to Playwright's entry point) and `MOTIF_CHROMIUM` (a Chromium binary). They run on SwiftShader, so timings are not GPU numbers.
