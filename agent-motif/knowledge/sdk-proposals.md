# SDK proposals

These are features AgentMotif needed, or would need, to reach the best version of a look and that `motif-kit@1` (SDK 1.2) lacks. Each one is a decision for the Motif team: nothing here is implemented in the runtime. Ranked by **value ÷ effort** for professional motion work.

| ID | Proposal | Value | Effort | Recommendation |
| --- | --- | --- | --- | --- |
| P-07 | Export-time motion blur and supersampling | ★★★★★ | S | **Do first** |
| P-02 | Mipmapped, float-guaranteed pass buffers + `u_hdr` | ★★★★ | S | **Do** |
| P-10 | Kit-level shared parameter sets and pass groups | ★★★ | S | **Do** |
| P-04 | Gradient and curve parameter types | ★★★★ | M | **Do** |
| P-03 | More passes (8) and pass groups | ★★★★ | S–M | **Do**, with a cost guard |
| P-05 | Kit assets: LUTs, blue noise, small textures | ★★★★ | M | **Do**, with a size cap |
| P-06 | Derived media inputs: depth, segmentation, flow | ★★★★★ | L | **Prototype** (depth first) |
| P-01 | Deterministic feedback buffers | ★★★★★ | L | **Prototype** behind a flag |
| P-08 | Pointer and live inputs | ★★★ | S | Do for Live mode only |
| P-09 | WebGPU backend with compute | ★★★★★ | XL | Roadmap |

Template for new entries: **Need** (which brief, what failed) · **Proposal** · **Pros** · **Cons and risks** (determinism, performance, compatibility, safety, authoring complexity) · **Effort** · **Recommendation**.

---

## P-01 Deterministic feedback buffers
**Need.** Real fluids, reaction–diffusion, trails, feedback tunnels and accumulation glow all need the previous frame. Today every frame is a pure function of `u_p`, so these can only be faked in closed form.
**Proposal.** A pass can declare `"feedback": true` and read `u_prev` (its own previous output). To keep exports deterministic and scrubbable, the host **pre-rolls** the simulation from a fixed seed for `preroll` loops and caches the last loop's frames. Seamlessness comes from crossfading the final 10–20% of the loop into the cached start, or from simulations that converge to a limit cycle.
**Pros.** Unlocks the biggest missing class of looks (Stable Fluids, Gray–Scott, feedback art). Authors write ordinary, familiar sim shaders.
**Cons and risks.** Scrubbing needs the cache, which costs memory (frames × resolution). Pre-roll delays the first frame. The crossfade can ghost. Simulation results can differ across GPUs: float precision breaks bit-exactness, so exports must come from one device. Mutate and Evolve need a re-simulation per change.
**Effort.** L (host cache, a pre-roll scheduler, an export path, UI for "simulating…").
**Recommendation.** Prototype behind a kit flag for export-only use. Measure memory at 1080p × 6 s × 60 fps, which is about 1.5 GB RGBA16F, so the cache needs downscaling or half-rate storage.

## P-02 Mipmapped and float-guaranteed pass buffers
**Need.** Bloom, blur pyramids, DoF and large-kernel effects spend passes on downsampling, because intermediate targets have no mips (`LINEAR` only). On devices without `EXT_color_buffer_float`, targets fall back to RGBA8 and **silently clip HDR**: every glow style loses its bloom.
**Proposal.** (a) A per-pass `"mips": true` that generates mipmaps after the pass, so `textureLod(u_buf0, q, lod)` gives a free blur pyramid. (b) Expose `uniform float u_hdr;` (1 when targets are float) so styles can compress HDR (for example `c / (1 + c)`) on RGBA8 and expand it on read.
**Pros.** A cheaper, better bloom (a 13-tap dual filter over mips), one pass saved per style, robust results on low-end devices.
**Cons and risks.** `generateMipmap` on RGBA16F needs the float-linear extension (very widely available). Mip generation costs about a third of a pass.
**Effort.** S.
**Recommendation.** Do it. Ship `u_hdr` even without mips.

## P-03 More passes and pass groups
**Need.** The AgentMotif lens stack uses 2 of the 4 passes, which leaves 2 for the scene. Radiance Cascades, jump-flood SDFs and separable blurs need 6–10.
**Proposal.** Raise the limit to 8 passes, behind a per-style cost estimate (passes × scale²) that the Kit Manager shows as a badge.
**Pros.** Unlocks 2D GI, SDF-from-media, proper separable blurs.
**Cons and risks.** Heavier styles, so the governor needs a per-style cost budget. Thumbnails take longer to render.
**Effort.** S–M.
**Recommendation.** Do it, together with P-10 so post stacks don't eat the budget.

## P-04 Gradient and curve parameter types
**Need.** Colourists and motion designers think in gradient ramps and easing curves. Today colour ramps are faked with 3 accents, and easing is hard-coded.
**Proposal.** `{"type":"gradient","stops":[…]}` becomes a 256×1 texture `u_g_<key>` plus `vec3 g_<key>(float t)`. `{"type":"curve","def":[x1,y1,x2,y2]}` becomes a cubic bezier `float k_<key>(float t)` (the four floats are keyframable channels, like `point`).
**Pros.** A big gain in art direction. Matches After Effects and Cinema 4D mental models. The curve type costs nothing (4 uniforms + `am_bezier`).
**Cons and risks.** Gradients need UI and texture uploads, and keyframing stops is complex (start by keyframing the whole gradient as a preset blend). Mutate needs gradient-aware rules.
**Effort.** M (curve: S).
**Recommendation.** Ship `curve` now and `gradient` next.

## P-05 Kit assets: LUTs, blue noise, small textures
**Need.** Film-emulation `.cube` LUTs, spatiotemporal blue noise (better dithering and sampling than IGN), MSDF glyph atlases for type, and noise volumes for fast clouds. Kits can only contain GLSL and JSON.
**Proposal.** `assets[]` in the manifest (PNG, or a `.cube` converted to a 3D texture, at most 1 MB total, at most 4 per style) bound as `u_asset_<id>`.
**Pros.** Film-accurate grades, cleaner raymarch noise, real typography in shaders, 3D-noise clouds at a fraction of the ALU cost.
**Cons and risks.** Kit size and validation (image decoding is an attack surface; restrict to PNG and validate dimensions). Licensing of bundled LUTs. Breaks "a kit is just text".
**Effort.** M.
**Recommendation.** Do it, with strict caps and PNG only.

## P-06 Derived media inputs: depth, segmentation, flow
**Need.** "Take any image and make it a shader" peaks when the shader knows the image's 3D structure: parallax camera moves, relighting, depth fog, DoF, subject/background separation, flow-aligned brushwork on video.
**Proposal.** An input can request derived channels, `"derive": ["depth", "mask", "flow"]`. The host runs an on-device model (a Depth Anything v2-class depth model, a SAM-class segmenter, RAFT-lite flow) via ONNX Runtime Web / WebGPU once per image (per frame for video, cached) and binds `u_<id>Depth`, `u_<id>Mask`, `u_<id>Flow`.
**Pros.** A step change for media styles. It keeps the privacy model (on-device, no upload). The agent's image intake can reuse the same depth to pick camera moves.
**Cons and risks.** Model download (25–100 MB; lazy, opt-in). Inference time on low-end devices. Video needs caching for determinism. Model licences must be checked.
**Effort.** L.
**Recommendation.** Prototype depth for still images first. It's the highest-value channel by far.

## P-07 Export-time motion blur and supersampling
**Need.** Fast motion (Light Tunnel, glitch, orbits) strobes at 24–30 fps. Thin lines (caustics, twigs) alias. Real cameras integrate over a shutter.
**Proposal.** In Deliver, add **Shutter** (0–360°) and **Samples** (1–16): render N sub-frames at `u_p ± shutter/2` and average them in linear light. Add **Supersample** (1–4×) with a downsample filter.
**Pros.** Exact, because frames are pure functions of `u_p`. No authoring changes, and it improves every kit at once. This is the single biggest quality jump for broadcast output.
**Cons and risks.** Export cost × N. The photosensitive limiter must be evaluated on the blurred result (averaging only reduces flashes, so it is safe).
**Effort.** S (host-side accumulation in a float target).
**Recommendation.** Do it first.

## P-08 Pointer and live inputs
**Need.** Live / VJ use: reactive glass, cursor-lit chrome.
**Proposal.** `u_pointer` (vec3: xy in uv units, z = pressed) and `u_live` (1 in Live mode). Styles must remain deterministic when `u_live == 0`.
**Pros.** Interactive pieces with no new param machinery.
**Cons and risks.** Breaks determinism if misused, so the validator should warn when `u_pointer` is read outside an `if (u_live > 0.5)` branch.
**Effort.** S.
**Recommendation.** Do it, for Live mode only.

## P-09 WebGPU backend with compute
**Need.** One million particles (the FX skill's budget), PBD cloth, fluid grids and SDF baking all need compute shaders and storage buffers.
**Proposal.** A `motif-kit@2` track with WGSL passes, `compute` stages and storage textures, with WebGL2 kept as the fallback for `@1` kits.
**Pros.** WebGPU now ships by default in all major browsers. It's the future of the platform.
**Cons and risks.** Two runtimes to maintain; authoring complexity; determinism of atomics.
**Effort.** XL.
**Recommendation.** Plan it on the roadmap, and start with a compute-particles prototype.

## P-10 Kit-level shared parameter sets and pass groups
**Need.** The AgentMotif kit repeats the same 10 Lens parameters and two post passes in five styles. Every style spends 10 of its 32 parameters on the lens.
**Proposal.** A manifest `"paramSets": { "lens": {…} }` and `"passGroups": { "finish": [ … ] }` that styles reference (`"params": { "$use": ["lens"], … }`, `"passes": [ {…}, { "$group": "finish" } ]`). Shared sets don't count toward the per-style limit, and they expand at load time.
**Pros.** Consistent controls across a kit. Less duplication. Frees parameter budget for style-specific controls.
**Cons and risks.** One more manifest concept. The validator must expand references before checking limits.
**Effort.** S.
**Recommendation.** Do it.
