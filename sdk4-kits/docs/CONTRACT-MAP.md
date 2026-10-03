# SDK contract map (verified against the installed SDK 4.0.0)

Everything below was confirmed by reading `sdk/lib/kit-gl.js`, `sdk/docs/*.md`, `motif-kit prelude --v4`, the bundled examples, and by running
`motif-kit validate` on the bundled `stack-lab` example before any kit was written. Nothing is inferred from the standalone prototype shaders.

| Item | Confirmed |
| --- | --- |
| Format | `"format": "motif-kit@4"`, Motif 8+. Pure data + GLSL ES 3.00. |
| Entry point | `vec4 motif(vec2 uv, vec2 fc)`; `uv` is centred, short side = -0.5..0.5; return **premultiplied linear RGBA**; runtime converts to sRGB, dithers and clamps. |
| Time | `u_p` (0..1, tempo/phase applied), `u_L` (effective loop seconds), `u_seed`, `u_safe`. Time enters only through `u_p`. |
| Palette | `u_bg u_ink u_a0 u_a1 u_a2` (linear RGB); kit `palettes[]` up to 8, `{id,name,bg,ink,a:[3]}`. |
| Params | `range int toggle select color point`; generated uniforms `p_<key>`; select options add `KEY_OPTION` defines (`QUALITY_LIVE`). Fields: `group hint show log randMax mutate`. Reserved: `palette invert tempo phase seed zoom rotate loop`. |
| Pass graph | `graph.buffers{name:{scale 0.125..1}}`, `graph.passes[{src,reads[],writes,iterate}]`, up to 8 buffers/passes, 32 executions. Pass reads arrive as `g_<name>At(q)` (q in 0..1). Final pass `writes: "output"`. |
| Capabilities | `media audio feedback text vector`. **None are used by these kits** (declared: none). |
| Safety helpers | `tslot tfrac strobe safeCycles flashAmt`; `u_safe`. These kits use `safeCycles` for beat and turn counts and a `k_calm()` amplitude scale (this repo) for sweeping motion under the limiter. |
| Sandbox | Constant-bounded `for` loops only, no `while`/recursion, no `#version/#extension/#line`, ASCII only. Static worst-case counts must stay under 32768 loop iterations and 2048 fetches per pixel (the kits stay under half). `//` comments and `#define` macros are accepted. |
| Compile check | `motif-kit validate` is static only. **A shader can validate and still fail to compile** (a variable named `gla`-prefixed `gl_*` is reserved; found and fixed during QA). The QA harness therefore compiles every style in the SDK's own runtime. |
| Limits used | 9 styles per kit, 5 palettes max, 10-21 declared params per style (limit 32), 4-pass graphs (limit 8), files well under 96 KB, kits under 70 KB (limit 3 MB). |

## Not available in the SDK (best compatible approximation shipped; nothing in the runtime was changed)

| Needed by the briefs | What shipped | Proposal |
| --- | --- | --- |
| Persistent simulation (cell life, particle systems) | Deterministic closed choreography from stable seed IDs | P-A: temporal-state contract (already listed in the playbook as open proposal 9) |
| Mipmapped / guaranteed-HDR graph buffers | Three-level gather bloom at 0.25 and 0.125 scale, half-float where the GPU provides it | playbook proposal 2 |
| Per-pixel gradient (`dFdx`) based stroke widths in graph passes | Used `fwidth` for stripe filtering in single-pass kits only | none needed |
| Instancing / external geometry | Local-neighbour lattice scans (phyllotaxis index window, 5x5 Voronoi window, 11x11 node window) | none needed |
| True refraction/transport for glass | Labelled approximations (additive facets; screen-space offset along the facet normal) | playbook proposal on field-class metadata |
