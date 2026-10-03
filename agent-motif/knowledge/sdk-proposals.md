# SDK proposals

These are features AgentMotif needs to reach the best version of a look, re-checked against **SDK 4.0.0** (`motif-kit@4`) and the Astral methodology research (Oct 2026). Each one is a decision for the Motif team; nothing here changes the runtime. Ranked by value ÷ effort for professional motion work.

## Status since the SDK 1.2 review

| ID | Proposal | Status in SDK 4.0 |
| --- | --- | --- |
| P-03 | More passes and pass groups | **Shipped** (SDK 2.0 pass graphs: 8 buffers, 8 passes, 32 executions). The AgentMotif kit now uses a 4-pass graph with a two-level bloom pyramid. Closed. |
| P-08 | Audio and pointer inputs | **Audio shipped** (`u_audio[8]`, `audio` capability; params also map to bands without it). Pointer is still open (below). |
| P-10 | Shared parameter sets | **Partly shipped**: effects (SDK 2.0) share a finishing stack at the layer and frame level, and AgentMotif ships one (`agent-motif/lens`). But an effect only sees display-referred pixels, so HDR bloom must still live inside each style, which still costs 10 of its 32 params. Still open, at a smaller scope. |
| P-05 | Kit assets | **Partly shipped**: svg inputs (vector capability) and text distance fields cover marks and type. LUTs, blue noise and small textures are still missing. |
| P-01 | Feedback buffers | **Intra-frame only** (SDK 2.0 `iterate` with ping-pong, cleared every frame). Persistent temporal state is still open, and the research agrees it needs its own contract. |

## Open proposals, ranked

| ID | Proposal | Value | Effort | Recommendation |
| --- | --- | --- | --- | --- |
| P-07 | Export motion blur and supersampling | ★★★★★ | S | **Do first** |
| P-02 | Mipmapped, float-guaranteed graph buffers + `u_hdr` | ★★★★ | S | **Do** |
| P-11 | Field-class metadata and renderer validation | ★★★★ | S | **Do** (from the research) |
| P-12 | Quality role and exposure-consistency canary | ★★★ | S | **Do** |
| P-04 | Gradient and curve parameter types | ★★★★ | M | **Do** (curve first) |
| P-10 | Style-level shared parameter sets | ★★★ | S | **Do** |
| P-05 | LUTs, blue noise, small textures | ★★★★ | M | **Do**, with a size cap |
| P-06 | Derived media inputs: depth, segmentation, flow | ★★★★★ | L | **Prototype** (depth first) |
| P-01 | Temporal-state contract | ★★★★★ | L | **Design before building** |
| P-08 | Pointer input for Live mode | ★★★ | S | Do, behind `u_live` |
| P-09 | WebGPU / WGSL compute backend | ★★★★★ | XL | Separate research track |

Template: **Need** · **Proposal** · **Pros** · **Cons and risks** (determinism, performance, compatibility, safety, authoring) · **Effort** · **Recommendation**.

---

## P-07 Export motion blur and supersampling
**Need.** Fast motion (Light Tunnel, the Tunnel transition, Monolith's rings) strobes at 24–30 fps, and thin features (caustics, twigs, Cellspace sheets) alias.
**Proposal.** Add **Shutter** (0–360°), **Samples** (1–16) and **Supersample** (1–4×) to Deliver and to exporter presets (`"shutter": 180, "samples": 8`). Each output frame averages N renders at `u_p ± shutter/2` in linear light.
**Pros.** Exact, because every frame is a pure function of `u_p`. No authoring change, and every kit improves at once. It is the biggest single quality jump for broadcast work.
**Cons and risks.** Export cost × N. The flash audit should run on the blurred result (averaging only lowers flash counts). Exporter presets need two new keys, which is a strict-schema change.
**Effort.** S. **Recommendation.** Do first.

## P-02 Mipmapped, float-guaranteed graph buffers
**Need.** Bloom pyramids spend graph passes on downsampling, because buffers are `LINEAR` with no mips (verified in SDK 4 `kit-gl.js`). On devices without renderable float, buffers fall back to RGBA8 and **silently clip HDR**, so every glow style loses its highlights. The research flags the same thing: float textures do not imply renderable float attachments.
**Proposal.** (a) Per-buffer `"mips": true` (generate after the write; `textureLod` gives a free blur pyramid). (b) `uniform float u_hdr;` set to 1 when buffers are float, so styles can encode HDR (for example `c / (1 + c)`) on RGBA8.
**Pros.** Cheaper and better bloom and DoF, one pass saved per style, and correct behaviour on low-end devices.
**Cons and risks.** Float-linear filtering needs `OES_texture_float_linear`. Mip generation costs about a third of a pass.
**Effort.** S. **Recommendation.** Do it. Ship `u_hdr` even without mips.

## P-11 Field-class metadata and renderer validation *(from the research)*
**Need.** "Sphere tracing" a field that is not a distance bound crosses surfaces. Additive glow renderers change brightness with step count. Both are invisible in review until a parameter extreme exposes them. AgentMotif now classifies every field in comments (`exact`, `bound`, `implicit`, `density`, `glow`), but nothing checks it.
**Proposal.** An optional style field: `"field": { "class": "bound", "lipschitz": "param:erode", "renderer": "sphere-trace" }`. The validator warns on incompatible pairs (`implicit` + `sphere-trace`, `glow` + a claim of physical volume), and the canary renders the style's params at their bounds to look for NaNs and crossings.
**Pros.** Makes a mathematical claim checkable. Documents intent for kit reviewers. Cheap to add, because it's metadata.
**Cons and risks.** The metadata can lie: it is a declaration, not a proof. A Lipschitz expression language needs care to stay data-only.
**Effort.** S. **Recommendation.** Do it as a warning-only check first.

## P-12 Quality role and exposure-consistency canary
**Need.** Hosts lower quality for live and phone playback. If a style's brightness depends on its step count, the live version looks different from the export. AgentMotif measured exactly this: Astral's additive renderer shifted **×2.43** between min and max steps before calibration, while the step-normalised volume renderers held within 1–4%.
**Proposal.** A parameter may declare `"role": "quality"`. The host may then lower it for live playback, and the install canary renders at min and max and records the luminance ratio. A shift over ±15% shows a badge.
**Pros.** Adaptive quality becomes safe and automatic. It catches the research's "brightness changes with sample count" failure at install.
**Cons and risks.** One more canary render. The role must never be used for anything but cost.
**Effort.** S. **Recommendation.** Do it. AgentMotif's `am qa` already implements the measurement.

## P-04 Gradient and curve parameter types
**Need.** Colourists think in gradient ramps and animators in easing curves; today ramps are faked with 3 accents and easing is hard-coded.
**Proposal.** `curve` gives a cubic bezier as 4 keyframable channels plus `float k_<key>(float t)`. `gradient` gives a 256×1 texture plus `vec3 g_<key>(float t)`. (The `g_` prefix clashes with graph samplers, so name it `gr_` instead.)
**Pros.** Big art-direction gains, and it matches After Effects and Cinema 4D. `curve` is nearly free.
**Cons and risks.** Gradient UI and keyframing are complex; Mutate needs gradient-aware rules.
**Effort.** M (`curve`: S). **Recommendation.** Ship `curve` now and `gradient` next.

## P-10 Style-level shared parameter sets
**Need.** Five AgentMotif styles repeat the same 10 Lens parameters and three post passes, because HDR bloom can't move into an effect.
**Proposal.** `"paramSets": { "lens": {…} }` and `"passGroups": { "finish": [ … ] }`, referenced by `"$use"` and `"$group"`, expanded at load. Shared sets don't count toward the per-style 32.
**Pros.** Consistent controls and more parameter budget for the look itself.
**Cons and risks.** One more manifest concept; the validator must expand it before checking limits.
**Effort.** S. **Recommendation.** Do it.

## P-05 LUTs, blue noise, small textures
**Need.** `.cube` film LUTs, spatiotemporal blue noise (cleaner raymarch jitter than IGN), and noise volumes.
**Proposal.** `assets[]`: PNG only, ≤ 1 MB total, ≤ 4 per style, decoded by the host's existing safe path. A `.cube` file converts to a 3D texture.
**Pros.** Film-accurate grades, less noise in every volume, cheaper clouds.
**Cons and risks.** PNG decoding is an attack surface (validate dimensions, PNG only). LUT licensing. Breaks "a kit is text" (svg already did).
**Effort.** M. **Recommendation.** Do it, with strict caps.

## P-06 Derived media inputs: depth, segmentation, flow
**Need.** "Any image → shader" peaks when the shader knows the image's 3D structure: parallax, relighting, depth fog, DoF, subject isolation, flow-aligned brushwork.
**Proposal.** `"derive": ["depth", "mask", "flow"]` on a media input. An on-device model (a Depth Anything v2-class model via ONNX Runtime Web/WebGPU) runs once per image (per frame for video, cached) and binds `u_<id>Depth`, `u_<id>Mask` and `u_<id>Flow`.
**Pros.** A step change for media styles. Keeps the no-upload privacy model.
**Cons and risks.** 25–100 MB model downloads (lazy, opt-in), inference cost, determinism for video (cache per frame), model licences.
**Effort.** L. **Recommendation.** Prototype depth for still images.

## P-01 Temporal-state contract
**Need.** True fluids, reaction–diffusion and accumulating trails. SDK 2's feedback resets every frame, which keeps exports deterministic but rules these out. The research is explicit: never imply the existing feedback provides this, and design the semantics before building.
**Proposal.** A capability `"state"` with declared **seed**, **fixed timestep**, **reset** (at loop start), **warm-up** (N simulated loops before frame 0), **checkpoints** (cached state every K frames, so seeks don't replay from the start), **replay** (deterministic from seed and parameters), and an **export policy** (render from the start, or from the nearest checkpoint). Loop closure comes either from simulations designed to reach a limit cycle, or from a declared crossfade window.
**Pros.** Unlocks the largest missing class of looks.
**Cons and risks.** Memory for checkpoints (1080p RGBA16F ≈ 16 MB per checkpoint). GPU float differences break bit-exactness across devices, so exports must come from one device. Mutate and Evolve need re-simulation. Scrubbing latency.
**Effort.** L. **Recommendation.** Write the spec, then prototype export-only.

## P-08 Pointer input for Live mode
**Proposal.** `u_pointer` (xy in uv units, z = pressed) and `u_live`. The validator warns if `u_pointer` is read outside an `if (u_live > 0.5)` branch.
**Cons and risks.** Breaks determinism if misused. **Effort.** S. **Recommendation.** Do it, Live only.

## P-09 WebGPU / WGSL compute backend
**Need.** One million particles, PBD cloth, grid fluids, SDF baking.
**Status.** WebGPU is supported in all major browser families (Google, 25 Nov 2025), and WGSL is a W3C Candidate Recommendation Draft (21 Sep 2026). Browser support does not guarantee every device.
**Proposal.** A separate `motif-kit@5` track with WGSL and compute stages; WebGL2 kits keep working.
**Cons and risks.** Two runtimes; a different language contract; determinism of atomics. The research's caution applies: adopt it only where the measured bottleneck really is compute or state.
**Effort.** XL. **Recommendation.** A research track, measured against target hardware.
