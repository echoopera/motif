# Validation evidence: Oriel 1.1.0

Run with the AgentMotif toolchain (`am qa`, `motif-kit validate`) against the SDK 4.0 runtime in headless Chromium. Timings are SwiftShader CPU numbers and say nothing about real GPU or phone performance. No flash certification is claimed beyond the `am qa` WCAG audit.

`motif-kit validate`: ok, 9 styles, 4 palettes, no capabilities. Per-pixel budgets are far below half of every hard limit.

| Style | Seam delta | Pop x (pass <3) | Flashes/s | Quality exposure |
|---|---:|---:|---:|---:|
| living-flower | 0 | 1.01 | 0 | n/a |
| phi-garden | 0 | 1.06 | 0 | n/a |
| fibonacci-sea | 0 | 1.29 | 0 | n/a |
| vesica | 0 | 1.12 | 0 | n/a |
| golden-bloom | 0 | 1.15 | 0 | n/a |
| torus-choir | 0 | 1.15 | 0 | n/a |
| stellate | 0 | 1.05 | 0 | n/a |
| quasicrystal | 0 | 1.03 | 0 | n/a |
| metatron-field | 0 | 1.02 | 0 | n/a |

## What changed from 1.0.0

See README.md. All measurements above are from the 1.1.0 build; 1.0.0 failed the pop gate on three Aether styles (6.2 to 6.9).

## Known limits

- Detail that looks alive is a stateless procedural cycle, not a persistent simulation (SDK 4 buffers reset every frame).
- Aether `ion-rain` pop is 3.3 (inside the 6 failure line, above the 3 target) and its seam step ratio is 2.97; the seam itself is exact (delta 0).
- The Aether volume uses per-pixel jitter, so very close inspection of the half-resolution scene shows fine noise instead of the earlier stripes.
