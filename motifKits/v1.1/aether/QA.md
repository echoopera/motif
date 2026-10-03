# Validation evidence: Aether 1.1.0

Run with the AgentMotif toolchain (`am qa`, `motif-kit validate`) against the SDK 4.0 runtime in headless Chromium. Timings are SwiftShader CPU numbers and say nothing about real GPU or phone performance. No flash certification is claimed beyond the `am qa` WCAG audit.

`motif-kit validate`: ok, 9 styles, 4 palettes, no capabilities. Per-pixel budgets are far below half of every hard limit.

| Style | Seam delta | Pop x (pass <3) | Flashes/s | Quality exposure |
|---|---:|---:|---:|---:|
| cloudwake | 0 | 1.45 | 0 | 1 |
| pale-current | 0 | 1.91 | 0 | 1 |
| ion-rain | 0 | 3.34 | 0 | 1 |
| duskfront | 0 | 1.55 | 0 | 1 |
| high-tide | 0 | 2.2 | 0 | 1 |
| blue-hour | 0 | 1.36 | 0 | 1 |
| lightwell | 0 | 1.66 | 0 | 1 |
| cirrus-garden | 0 | 1.73 | 0 | 1 |
| ember-haze | 0 | 1.71 | 0 | 1 |

## What changed from 1.0.0

See README.md. All measurements above are from the 1.1.0 build; 1.0.0 failed the pop gate on three Aether styles (6.2 to 6.9).

## Known limits

- Detail that looks alive is a stateless procedural cycle, not a persistent simulation (SDK 4 buffers reset every frame).
- Aether `ion-rain` pop is 3.3 (inside the 6 failure line, above the 3 target) and its seam step ratio is 2.97; the seam itself is exact (delta 0).
- The Aether volume uses per-pixel jitter, so very close inspection of the half-resolution scene shows fine noise instead of the earlier stripes.
