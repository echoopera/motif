# Sandbox: what Motif checks before a kit runs

Third-party shaders must not be able to hang or crash Motif. A kit goes through four layers of checks. The first two also run in `motif-kit validate`.

| Layer | Where | Catches |
| --- | --- | --- |
| 1. Package and manifest | `kit-sandbox` (04a) | Non-JSON or non-object manifests; `__proto__`, `constructor` and `prototype` keys anywhere; nesting deeper than 16; more than 20,000 values; strings over 16 KB; manifests over 256 KB; files that are not `.glsl`, `.json`, `.md` or `.txt`; path-like or hostile file names; GLSL over 96 KB per file or 3 MB per kit; every rule in [Kit format 2](kit-format-2.md) |
| 2. Static GLSL analysis | `kit-sandbox` (04a) | See below |
| 3. Background compile | `kit-host` (05a) | Compile errors, reported with the file and line in that file. Compiles still running after 20 s are quarantined. The compile runs off the main thread when the browser supports `KHR_parallel_shader_compile`. |
| 4. Canary and watchdog | `kit-host` (05a) | Slow shaders. Test frames at 8×8, then 32×32, 64×64 and 128×128 are timed with a GPU timer query (or a fence when the browser has none), polled from timers so the page never blocks on the GPU. A size whose predicted time is over the limit is never started. Preview frames that stay far over budget, and GPU resets that keep following one entry, quarantine that entry. |

## Static analysis

Every pass is analysed as it will be compiled: prelude, generated param and runtime declarations, `common.glsl`, then the pass, with macros expanded. The analysis is an upper bound computed from the source text.

| Rule | Limit | Error code |
| --- | --- | --- |
| Every loop is a `for` with a counter, a bound in its condition and a constant step, and its body never changes the counter (including through `out`/`inout` arguments) | — | `unbounded-loop` |
| `while` and `do … while` loops | not allowed | `unbounded-loop` |
| Iterations of any single loop | 4,096 | `loop-trip` |
| Loop iterations one pixel can run (nested products, summed through function calls) | 32,768 (warning above 8,192) | `budget` |
| Texture reads one pixel can make (`texture*`, `texelFetch*`, and helpers that wrap them) | 2,048 (warning above 768) | `budget` |
| Recursion | not allowed | `recursion` |
| Array size | 1,024 elements per array; 16,384 values per pass | `array` |
| Nesting | 32 blocks, 48 brackets | `nesting` |
| Macro expansion | 60,000 tokens per pass, 32 levels deep, 128 macros | `macro` |
| `#extension` | none allowed (core WebGL2 / GLSL ES 3.00) | `extension` |
| `#pragma` | only `optimize(on\|off)` and `debug(on\|off)` | `pragma` |
| `#version`, `#line`, unknown directives | not allowed (the runtime sets them) | `directive` |
| Non-ASCII or control characters | not allowed | `syntax` |
| Capability use (`u_audio`, media inputs, text inputs, feedback) without declaring it | — | `capability` |

Loop bounds can be numbers, `const` values, macros, simple arithmetic, `min`/`max`/`clamp`/`floor`/`ceil`/`abs`/`int()`/`float()`, local variables that are never reassigned, outer loop counters (`for (int j = 0; j < i; j++)`), and declared parameters, which count at their `max`. The heaviest bundled passes reach about 6,300 iterations (`cellula/image`) and 690 fetches (`afterglow/night-drive`) per pixel.

## Quarantine

A quarantined entry stays installed, so projects that use it still open, but it draws a designed placeholder (*"Name: quarantined · reason"*) and never runs its shader. Its kit card shows the reason, the measurement and a **Retry** button, which re-runs the compile and canary. Quarantine is saved with the kit version, and installing a new version clears it.

| Code | Trigger |
| --- | --- |
| `canary-slow` | A test frame (8×8 to 64×64) takes, or is predicted to take, over 120 ms of GPU time on a hardware GPU (1.5 s on software GL), or the extrapolated 1080p frame is over 3 s (1,000 s on software GL; the heaviest bundled kit measures about 340 s under SwiftShader) |
| `compile-timeout` | The background compile has not finished after 20 s |
| `gpu-reset` | The context was lost during the compile or canary, or twice while this entry was the last one drawn |
| `slow-runtime` | Three preview frames in a row over 600 ms (15 s on software GL), even after adaptive downscaling |

## Limits, honestly

- **Static analysis is not a proof.** It bounds how much work a shader can ask for. It does not measure how expensive each operation is, and a shader can do a lot of transcendental maths inside the bounds. The canary exists for that case: `tests/lib/hostile.mjs` includes a kit that passes static analysis and is quarantined by the canary.
- **The canary measures one small frame on this device, at install time.** A shader whose cost depends heavily on its parameters can pass at its defaults and be slow at extreme values. The runtime watchdog and adaptive preview resolution cover that, but only after a few slow frames.
- **GPU drivers can still hang.** One draw call cannot be interrupted from JavaScript. If a driver hangs inside it, the browser's GPU watchdog resets the context (typically after 2–10 s). Motif recovers its GL state on `webglcontextrestored` and quarantines an entry that keeps causing resets. On some platforms a hung driver can freeze the whole browser, and nothing in a web page can prevent that.
- **Thresholds for hardware GPUs** (120 ms per 64×64 frame, 3 s per estimated 1080p frame) are engineering estimates. They have not been measured on a matrix of real GPUs. Software GL thresholds were calibrated against every bundled kit under SwiftShader.
- **Approval is consent, not isolation.** Approving `media` lets a kit's shaders sample the user's media on the GPU. The pixels never leave the page because kits have no network or script access, but the kit can display them.
