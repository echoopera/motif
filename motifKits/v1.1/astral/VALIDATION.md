# Astral 1.2.0 validation

Run with the AgentMotif toolchain (`am qa`, `motif-kit validate`) on the SDK 4.0 runtime in headless Chromium. Timings are SwiftShader CPU numbers, not real-GPU or phone frame times.

- `motif-kit validate`: ok, 12 styles, 4 palettes, no capabilities. 2 passes per style, up to 576 loop iterations and 1 texture fetch per pixel.
- Loop seam: delta 0 on all 12. Pops: 2.0 or lower on all 12 (target below 3).
- Flash audit at the worst case (1 s loop at 4x tempo, limiter on): 11 of 12 styles have no tile above 3 flashes/s; `estuary` has one tile at 3.5/s (a warning, audit passes). Version 1.1.0 failed on `filament` and `estuary` (9 tiles each) and warned on three more.
- Quality exposure, Ray samples 32 versus 96: 0.95 to 1.00 on all 12. Version 1.1.0 measured 0.66 to 0.97, with eight styles outside the +/-15% gate.
- Cost: about 120 to 160 ms at 480x270 in the CPU renderer, down from 190 to 247 ms in 1.1.0 (scene now at 0.75 scale).

| Style | Pop x | Flashes/s |
|---|---:|---:|
| filament | 1.31 | 2.5 |
| veil | 1.2 | 1.5 |
| rootlight | 1.16 | 1.5 |
| cathedral | 1.29 | 0 |
| halo | 1.38 | 1.5 |
| chrysalis | 1.44 | 0 |
| estuary | 1.49 | 3.5 |
| synapse | 1.28 | 0 |
| aurora-fold | 1.25 | 0.5 |
| relic | 1.99 | 0 |
| threshold | 1.18 | 0 |
| stillfield | 1.07 | 0 |

Not tested: real GPU or phone performance, the Motif app itself, flash certification beyond the `am qa` audit.
