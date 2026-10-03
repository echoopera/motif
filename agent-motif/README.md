# AgentMotif

AgentMotif is Motif's shader director agent. It turns a reference **image**, a written **description**, or both into a real-time, loopable, art-directable shader style for the **Motif Kit SDK** (`motif-kit@1`, SDK 1.2). It reads the reference, decomposes it into light, material and lens layers, writes GLSL on a purpose-built library, scores the result against the target, tunes parameters with an optimiser, and runs QA on the loop, the flash limiter and cost. When a look needs something the SDK can't do, it writes up the feature with pros and cons.

| | |
| --- | --- |
| ![](kits/agent-motif/previews/silk-aurora.jpg) **Silk Aurora** | ![](kits/agent-motif/previews/liquid-chrome.jpg) **Liquid Chrome** |
| ![](kits/agent-motif/previews/caustic-light.jpg) **Caustic Light** | ![](kits/agent-motif/previews/nebula-drift.jpg) **Nebula Drift** |
| ![](kits/agent-motif/previews/liquid-glass.jpg) **Liquid Glass** (media) | ![](kits/agent-motif/previews/painterly.jpg) **Painterly** (media) |
| ![](kits/agent-motif/previews/light-tunnel.jpg) **Light Tunnel** (media, [case study](examples/light-tunnel/README.md)) | |

## What's here

| Path | What |
| --- | --- |
| [`AGENT.md`](AGENT.md) | The agent's operating manual: the SDK contract, toolchain, the brief → ship loop, taste rules, the curiosity protocol and the SDK-proposal protocol. This is the single source of truth. |
| [`lib/glsl/`](lib/glsl) | The AgentMotif GLSL library (27 KB, loop-safe): `color` (OKLab/OKLCh, AgX, PBR Neutral, grading), `noise` (curl, domain warp, flow maps, gyroid volumes, caustics, stars, IGN), `light` (GGX, split-sum env, procedural studio HDRI, thin film, spectral, sheen, HG phase), `post` (bloom, halation, anamorphic, spectral CA, bokeh, Kuwahara, CAS, grain), `sdf` (2D/3D primitives, operators, raymarch/normal/shadow/AO macros), `motion` (bezier easing, springs, stagger, on-twos). |
| [`tools/am.mjs`](tools/am.mjs) | The look-dev CLI: `analyze`, `compare`, `tune`, `qa`, `film`, `frame`, `lib`, `new`. |
| [`tools/metrics.js`](tools/metrics.js) | The perceptual fingerprint and score: OKLab k-means palette, sliced-Wasserstein colour distance, tone stats, power-spectrum slope, structure tensor, radial streak index, symmetry, multi-scale SSIM, and a gap report written as shader moves. |
| [`knowledge/`](knowledge) | [Technique atlas](knowledge/technique-atlas.md) · [Look-dev rules](knowledge/look-dev.md) · [Research radar](knowledge/research-radar.md) · [Rubric](knowledge/rubric.md) · [SDK proposals](knowledge/sdk-proposals.md) |
| [`kits/agent-motif/`](kits/agent-motif) | The showcase kit: 7 styles, 7 palettes, a shared physically based lens stack (`styles/post/`). Packed at `dist/agent-motif-1.0.0.motifkit`. |
| [`examples/light-tunnel/`](examples/light-tunnel/README.md) | Worked case study: a reference frame rebuilt as a shader (score 26.8 → 56.2), including the optimiser trap and how the agent handled it. |

## Use it

**In Claude Code (this repo):** the agent is installed as the subagent `agent-motif` (`.claude/agents/`) and the skill `/agent-motif` (`.claude/skills/`). Ask, for example:

> Use agent-motif: make a shader from `refs/oil-slick.jpg`, a slow, viscous holographic oil film for a fashion title.

**Elsewhere:** `agent-skills/skills/agent-motif/SKILL.md` is the distributable skill (served by `motif-bridge` like the other 16 studio skills). After editing `AGENT.md`, run `node agent-motif/tools/sync-agent.mjs` to regenerate all four entry points.

## Toolchain quickstart

```bash
(cd Motif3/sdk/motif-kit-sdk && npm i)          # fflate + playwright (Chromium is auto-detected)
AM="node agent-motif/tools/am.mjs"

$AM analyze ref.jpg --out work                  # fingerprint, palette, technique hints, board PNG
$AM new kits/my-kit --id my-kit                 # kit scaffold wired to the library
$AM frame kits/my-kit hero --w 1280 --h 720     # look at it
$AM compare kits/my-kit hero --ref ref.jpg --phase 0.2,0.5,0.8
$AM tune kits/my-kit hero --ref ref.jpg --only scale,glow,exposure --apply
$AM qa kits/my-kit                              # seam, pops, WCAG flash test (Motif audit method), cost, filmstrip
$AM film kits/my-kit hero --seconds 6           # .webm for review
node Motif3/sdk/motif-kit-sdk/bin/motif-kit.mjs pack kits/my-kit --out dist
```

Flags: `--media img` feeds media styles, `--no-media` renders their procedural fallback, `--params p.json` overrides parameters, and `--mode style|layout|exact` sets how much composition and pixel structure count in scoring.

Headless renders use SwiftShader on the CPU. Timings are for comparing versions, not real frame rates (a GPU is 20–100× faster).

## Showcase kit status

All 7 styles pass `motif-kit validate` and `am qa`: seam Δ0, no mid-loop pops, and the flash test passes. Liquid Chrome has 2 tiles reaching 6 flashes/s at the worst-case 4× tempo on a 1 s loop; the audit fails at 4 tiles, so it passes. Media styles render designed fallbacks without media.

## Decisions for the team

[`knowledge/sdk-proposals.md`](knowledge/sdk-proposals.md) ranks 10 SDK extensions. The top three by value ÷ effort:

1. **Export motion blur and supersampling** (host-side, exact because frames are pure functions of `u_p`).
2. **Mipmapped, float-guaranteed pass buffers** plus `u_hdr`, because RGBA8 fallback silently clips HDR bloom today.
3. **Kit-level shared parameter sets and pass groups**: the lens stack currently costs 10 of every style's 32 parameters.
