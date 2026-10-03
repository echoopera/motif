# Research radar

These are the methods AgentMotif tracks, mapped to what it takes to use them in Motif. **Fit** is one of: **now** (works in SDK 4.0); **approx** (an approximation works today); or a proposal ID from [`sdk-proposals.md`](sdk-proposals.md). Update this file whenever you try something.

_Last reviewed: 3 October 2026, with the Astral methodology research (`docs/research/Astral-Shader-Methodology-Research.html`)._

## Platform
| Topic | Status | Fit |
| --- | --- | --- |
| WebGL 2 | Still the target. The spec editor's draft is dated 30 Jun 2026; GLSL ES 3.00 is rev. 6 (2016). ES 3.1 compute is **not** in WebGL 2. [1][2] | now |
| `KHR_parallel_shader_compile` | Pending means unfinished, not failed. Completion queries return true during context loss. [3] | now: handled in the showcase |
| WebGPU / WGSL | Supported in all major browser families (25 Nov 2025). WGSL is a W3C Candidate Recommendation Draft (21 Sep 2026). A separate language and runtime contract. [9][10] | P-09 |

## Fields and renderers (Astral research)
| Method | Finding | Fit |
| --- | --- | --- |
| Astral cosine fold + positive glow field + additive emission | Iterative coordinate folding with independent amplitude, frequency, bias and phase. The positive field is a **heuristic glow-step field**: not an SDF, not a proven bound. Brightness depends on sample count and spacing. | **now**: `am_cosFold`, `AM_GLOW`, style `astral-fold`. Measured ×2.43 exposure shift from min to max steps; calibrated to ×1.02 with a fitted `steps^0.62` compensation. |
| Sphere tracing (Hart 1996) | Correct only for distance bounds that never overshoot. [4] | **now**: `AM_MARCH` (exact) and `AM_MARCH_L` (Lipschitz-scaled bound) |
| Lipschitz bounds for deformations | The fold adds ≤ a per layer, so L ≤ (1 + a)^n. Twist: L = √(1 + (k·r)²). Gyroid: \|∇\| ≤ √6. | **now**: `am_cosFoldLip`, `am_twistLip`, a corrected `am_sdGyroidShell`; used in `monolith` and `liquid-chrome` |
| Implicit surfaces | Use fixed-step sign search plus bisection; the step is the thin-feature limit. | **now**: `AM_SEGMENT` |
| Step-normalised absorption / emission | Opacity `1 - exp(-σ·Δt)` keeps exposure stable across quality. Simple source model, no scattering. [5] | **now**: `AM_VOLUME`. Measured ×0.96–0.996 (astral volume, cellspace, nebula). |
| Strictly Conservative Neural Distance Fields (Ludwig & Campen, CGF, 13 Aug 2026) | Provable bounds from a constrained architecture and training method. Arbitrary networks or warps don't inherit the guarantee. [8] | Future direction; needs weights (P-05). Its design principle is adopted now: represent what is known about a field. |
| Field-class metadata | Classify `exact / bound / implicit / density / glow` and reject invalid renderer pairs. | approx (comments + AGENT.md rules); P-11 |

## Kit directions from the research
| Direction | AgentMotif status |
| --- | --- |
| A. Monolith: sculptural solids, negative space | **Built**: `monolith` (bound field, conservative march, separate halo atmosphere) |
| B. Cellspace: membranes, gyroid chambers | **Built**: `cellspace` (density field, step-normalised volume) |
| C. Lightscript: luminous type from text distance fields | **Built**: `lightscript` (neon, topographic, portal; glow kept inside the stored spread) |
| D. Resonant: audio as a field driver | approx: every param maps to audio bands in Motif with no capability. Direct `u_audio` needs the `audio` capability and a recorded timeline for repeatable export. |
| E. Reaction–diffusion, transported ink | approx: SDK 2 `iterate` gives bounded intra-frame evolution only. True persistent simulation is P-01. Classic GPU fluid methods: Harris, GPU Gems ch. 38. [6] |
| F. Fieldnotes: scientific fields with artistic mappings | Next: contours and streamlines from the `noise` and `field` modules |

## Lighting and global illumination
| Method | Fit |
| --- | --- |
| Radiance Cascades (Sannikov 2023) and Holographic Radiance Cascades (2025) for 2D GI | approx: now feasible with SDK 2 graphs (8 passes, `iterate`) at low resolution. A strong candidate kit. |
| Jump-flood SDF of media or drawn shapes | **now**: graph `iterate` ping-pong (log₂ N passes) |
| Split-sum IBL with procedural studios | **now** (`am_studio`, `am_envBRDF`) |

## Materials, sampling, image understanding
| Method | Fit |
| --- | --- |
| Thin film, spectral dispersion, sheen | **now** |
| Spatiotemporal blue noise | P-05 |
| Monocular depth, segmentation, optical flow for media | P-06 |
| Perceptual fingerprint + CMA-ES fitting to a reference | **now** (`am analyze/compare/tune`) |
| MSDF glyphs (sharper corners than single-channel SDF) [7] | Not in SDK 4; text SDF is single-channel. Keep glows inside the spread. |

## Engineering discipline (research §06–07, adopted)
- **Startup lifecycle:** pending is not failure; poll; cancel stale jobs; rebuild on context restore; show "Preparing…", never a poster pretending to run.
- **Budgets:** pixels × samples × fold layers. Reduce render scale and steps before changing form.
- **Numerics:** ordered smoothstep edges, denominator floors, finite normals, bounded phases.
- **Measurement:** GPU timer queries are optional and asynchronous; CPU timers can't isolate GPU cost. Float textures ≠ renderable float attachments. [11][12]
- **Acceptance suite:** cold start with and without the extension, delayed compile, forced context loss, all phases, portrait and landscape, finite non-black pixels, params at bounds, pause/resume, seams, sustained mobile playback.

## Sources
1. Khronos, WebGL 2.0 specification (editor's draft, 30 Jun 2026): https://registry.khronos.org/webgl/specs/latest/2.0/
2. Khronos, GLSL ES 3.00 specification (rev. 6, 29 Jan 2016): https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf
3. Khronos, KHR_parallel_shader_compile (rev. 6): https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/
4. J. C. Hart, Sphere tracing (The Visual Computer, 1996): https://experts.illinois.edu/en/publications/sphere-tracing-a-geometric-method-for-the-antialiased-ray-tracing/
5. Pharr, Jakob, Humphreys, PBRT 4e, Volume Scattering Integrators: https://www.pbr-book.org/4ed/Light_Transport_II_Volume_Rendering/Volume_Scattering_Integrators
6. M. J. Harris, GPU Gems ch. 38, Fast Fluid Dynamics Simulation on the GPU: https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu
7. V. Chlumský, msdfgen: https://github.com/Chlumsky/msdfgen
8. I. Ludwig, M. Campen, Strictly Conservative Neural Distance Fields (CGF, 2026): https://onlinelibrary.wiley.com/doi/full/10.1111/cgf.70528
9. Google, WebGPU is now supported in major browsers (25 Nov 2025): https://web.dev/blog/webgpu-supported-major-browsers
10. W3C, WGSL Candidate Recommendation Draft (21 Sep 2026): https://www.w3.org/TR/2026/CRD-WGSL-20260921/
11. Khronos, EXT_disjoint_timer_query_webgl2: https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/
12. Khronos, EXT_color_buffer_float: https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/
13. Holographic Radiance Cascades for 2D Global Illumination (2025): https://arxiv.org/abs/2505.02041
