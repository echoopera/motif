# Research radar

These are the methods AgentMotif tracks, each mapped to what it would take to use in Motif. The **Fit** column says what works today: **now** means it's implementable in SDK 1.2; **approx** means an approximation is possible today; **needs SDK** links to `sdk-proposals.md`. Update this file when you try something.

_Last reviewed: October 2026._

## Platform
| Topic | Status | Fit for Motif |
| --- | --- | --- |
| **WebGPU** | On by default in Chrome/Edge (since 113), Firefox (141 on Windows, 145 on Apple Silicon macOS), and Safari on macOS/iOS/visionOS 26. WebGL2 is still the safe baseline. | needs SDK: compute passes, storage buffers, 1M-particle sims ([P-09](sdk-proposals.md#p-09-webgpu-backend-with-compute)) |
| WGSL / TSL / Slang | Shader languages that cross-compile to GLSL, WGSL and others | A future SDK could accept WGSL. For now the agent writes GLSL ES 3.0. |

## Lighting and global illumination
| Method | What it gives | Fit |
| --- | --- | --- |
| **Radiance Cascades** (Sannikov 2023; used in Path of Exile 2) and **Holographic Radiance Cascades** (2025, single-shot 2D GI close to the reference solution) | Real-time 2D global illumination: soft shadows, colour bleeding and emissive shapes that light their surroundings. A strong fit for motion graphics. | needs SDK: multi-cascade buffers and more passes ([P-03](sdk-proposals.md#p-03-more-passes-and-pass-groups), [P-02](sdk-proposals.md#p-02-mipmapped-and-float-guaranteed-pass-buffers)). approx: a 4-pass, 2-cascade SDF-traced version at low res is feasible. |
| Jump-flood SDF generation | Distance field of arbitrary drawn or media shapes in log₂(N) passes | needs SDK (more passes) |
| ReSTIR, path tracing | Many-light sampling | not real-time in fragment-only WebGL. Offline export only. |
| Split-sum IBL with procedural studios | Convincing metals at 1 tap | **now** (`am_studio`, `am_envBRDF`) |

## Materials
| Method | Fit |
| --- | --- |
| Thin-film interference (Belcour & Barla 2017 is physical; ours is a 3-wavelength approximation) | **now** (`am_thinFilm`) |
| Spectral rendering with a few wavelengths (dispersion, prisms) | **now** (`am_spectrum` taps) |
| Anisotropic GGX for brushed metal and hair | approx (stretched domain). A full tangent-frame BRDF fits easily. |
| Neural BRDFs and neural materials | needs weights as textures ([P-05](sdk-proposals.md#p-05-kit-assets-luts-blue-noise-small-textures)) |

## Simulation in a stateless loop
| Method | Fit |
| --- | --- |
| Closed-form motion (orbits, travelling waves, springs) | **now** (`motion` module) |
| Curl advection of a static texture (flow maps) | **now** |
| Stable fluids, reaction–diffusion, SPH, MPM | need persistent state: [P-01](sdk-proposals.md#p-01-deterministic-feedback-buffers) feedback buffers with a deterministic pre-roll |
| Position-based dynamics for cloth and ropes | needs SDK: WebGPU compute ([P-09](sdk-proposals.md#p-09-webgpu-backend-with-compute)) |

## Image understanding (image → shader)
| Method | What it unlocks | Fit |
| --- | --- | --- |
| Vision LLM decomposition of the reference (light, material, camera, medium) | The agent's main read. Turns a photo into a layer stack. | **now** (AgentMotif's intake) |
| Perceptual fingerprint and score (OKLab sliced-Wasserstein palette, spectrum slope, structure tensor, radial index, SSIM) | Measurable progress toward a target | **now** (`am analyze` / `am compare`) |
| Gradient-free parameter fitting (CMA-ES) | Tunes continuous parameters to a target | **now** (`am tune`) |
| Differentiable procedural materials (e.g. MATch, DiffMat) and inverse procedural modelling | Gradient-based fitting of node graphs to photos | Research direction. Would need a differentiable twin of the GLSL. CMA-ES covers most practical cases. |
| Monocular depth (Depth Anything v2, Depth Pro class models; run in the browser via ONNX Runtime Web / WebGPU) | Parallax, relighting, fog in depth, DoF on any photo | needs SDK: derived `depth` input ([P-06](sdk-proposals.md#p-06-derived-media-inputs-depth-segmentation-flow)) |
| Segmentation (SAM-class) | Treat subject and background separately | needs SDK ([P-06](sdk-proposals.md#p-06-derived-media-inputs-depth-segmentation-flow)) |
| Optical flow for video | Flow-aligned smears, temporally stable painterly | needs SDK ([P-06](sdk-proposals.md#p-06-derived-media-inputs-depth-segmentation-flow)) |
| 3D Gaussian splatting | Photoreal captured scenes | needs a non-fullscreen-quad renderer. Out of scope for kits. |

## Sampling and noise
| Method | Fit |
| --- | --- |
| Interleaved gradient noise | **now** (`am_ign`) |
| Spatiotemporal blue noise (STBN) textures | needs kit assets ([P-05](sdk-proposals.md#p-05-kit-assets-luts-blue-noise-small-textures)) |
| Gyroid / sine-fbm volumetrics (fast) | **now** (`am_sinFbm3`) |

## Image quality at export
| Method | Fit |
| --- | --- |
| Sub-frame motion blur: average N renders across the shutter. Because every frame is a pure function of `u_p`, this is exact. | needs SDK (host side, [P-07](sdk-proposals.md#p-07-export-time-motion-blur-and-supersampling)). Huge quality gain for small effort. |
| Supersampled export (2–4× SSAA) | needs SDK ([P-07](sdk-proposals.md#p-07-export-time-motion-blur-and-supersampling)) |
| CAS sharpening after upscale | **now** (`am_cas`) |

## Sources
- WebGPU implementation status: https://github.com/gpuweb/gpuweb/wiki/implementation-status
- Holographic Radiance Cascades for 2D Global Illumination (2025): https://arxiv.org/abs/2505.02041
- Exploration and Optimization of Radiance Cascades for Real-Time Applications (Chalmers): https://odr.chalmers.se/items/3ee9fb4e-1880-46c2-802a-a660e38dc9ee
- LLM-generated GLSL, practical limits (14islands, 2025): https://develop.14islands.com/journal/ai-generated-glsl-shaders
