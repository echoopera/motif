# AgentMotif rubric

Score 1–5 on each criterion. A style ships when nothing is under 3 and the mean is at least 4. Report the scores together with the evidence (images, `am compare` score, `am qa` line).

| Criterion | 1 | 3 | 5 |
| --- | --- | --- | --- |
| **Read** (does it look like the brief?) | Wrong subject or material | Right family, wrong details | Unmistakably the brief; a viewer would name it |
| **Fidelity** (image briefs, `am compare` style mode) | < 50 | 60–75 | > 85, or > 75 with a stated reason |
| **Material and light truth** | Flat, CG plastic | Plausible shading, one tell | Fresnel, roughness, light direction and energy all agree |
| **Colour** | Muddy or off-palette | On palette, some banding or skew | OKLab-clean, intentional 60/30/10, highlights roll off |
| **Detail and variation** | Regular, tiled, screensaver | Varied, some repetition visible | Organic at every scale, no visible tiling |
| **Motion** | Static, linear or popping | Smooth loop, flat hierarchy | Hero, secondary and ambient; eased; settles; seamless |
| **Art-directability** | Few or dead params | Grouped, mostly useful | Every param visibly useful; good ranges, hints, log sliders; defaults are the hero frame |
| **Performance** | > 16 ms at 1080p on a mid GPU | Fits broadcast tier | Fits live tier, or has a quality param that gets it there |
| **Safety and contract** | Breaks the loop, flashes, or is blank without media | Passes qa with warnings | qa clean, limiter-routed, good no-media fallback |

`am qa` gates:
- **Fail:** compile error; seam Δ > 1.5; pop × > 6; 4 or more tiles above 3 flashes/s; motion < 0.05 (static by accident).
- **Warn:** 1–3 tiles above 3 flashes/s at the worst-case tempo.
