# SDK proposals raised by this work

The runtime was not changed. Each item is what the briefs wanted, what shipped instead, and a proposal for the owner to decide.

| # | Need | Shipped approximation | Proposal | Pros | Cons / risk | Effort | Recommendation |
|---|---|---|---|---|---|---|---|
| P-A | Persistent state (cell life, particle systems, true reaction-diffusion) | Deterministic closed choreography from stable seed IDs | Temporal-state contract: an opt-in ping-pong buffer that survives frames with a declared reset phase | Real ecosystems; fewer analytic hacks | Breaks per-frame determinism and seek-order independence unless a replay cache is required | High | Decide only with a replay-cache design |
| P-B | `validate` that compiles | `motif-kit validate` is static; a reserved identifier (`gl_*`) passed it and failed in the runtime | Run the real compile (headless) inside `validate`, or ship a `--compile` flag | Catches errors before packing | Needs WebGL in CI | Low | Do it |
| P-C | Conditional compilation per style | A build step specialises one shader source into nine style files so the static loop analyser sees only the code a style runs | Allow `#if` on a per-style `defines` map in the manifest | One core file per kit, fewer duplicated sources | Weakens "kits are data and GLSL only" if abused | Medium | Worth considering |
| P-D | Worst-case loop analysis that understands constant branches | Specialisation as above | Constant-fold `if (const == n)` before counting | Honest budgets | Analyser complexity | Medium | Nice to have |
| P-E | Graph pass `scale` per quality tier | Quality changes sample counts only | Let a style pick pass scales from a select param | True Live/Export render scale | Buffer reallocation at runtime | Medium | Playbook proposal 1/2 |
| P-F | Field-class metadata | Comments and per-kit README | Manifest `fieldClass` tags checked against the renderer used | Machine-checked claims | Needs a vocabulary | Low | Playbook proposal 3 |
| P-G | Dead-control detector | `tools/qa.mjs controls` renders min/default/max and reports no-effect controls | Ship it in the SDK | Parameters are the product | None | Low | Do it |
