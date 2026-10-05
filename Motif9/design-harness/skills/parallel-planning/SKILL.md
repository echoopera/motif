---
name: parallel-planning
description: Decompose a plan into collision-free lanes and work orders. Used by producer and studio-director.
---
# Parallel Planning
1. `node harness/scripts/plan.js <brief> --write` for the baseline.
2. Walk each WO: is `owns` the *smallest* glob that covers the outputs? Shrink it.
3. For every cross-lane dependency, add `needs` with a stub path; write the stub (shape + `version`) now.
4. `node harness/scripts/plan.js check` — fix until clean.
5. Promote lane by lane: set `status: ready` on WOs whose `dependsOn` are done or stubbed.
6. At each stage sync: `claim.js list`, `gate.js all`, status note to client.
Stop condition: check clean, stubs written, first-stage WOs ready.
