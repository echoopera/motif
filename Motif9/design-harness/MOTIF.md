# Design Harness 3.0 in this repository

The harness (agents, skills, protocols, scripts; unchanged from the supplied Design-Harness-3.0 package) lives in `design-harness/`. Motif is a single-file build, so the harness's code-module scaffolding (`modules/`) is not used; the process, the decision model, the work orders, the gates and the review templates are.

First engagement: **MotifGraph UI pass** (`design/motifgraph-ui-pass/`):

    node design-harness/harness/scripts/validate.js brief design-harness/design/motifgraph-ui-pass/brief.json
    node design-harness/harness/scripts/plan.js design-harness/design/motifgraph-ui-pass/brief.json     # 19 work orders (written; 12 done, 7 cancelled with reasons)
    node design-harness/harness/scripts/gate.js all
    node design-harness/design/motifgraph-ui-pass/token-lint.mjs                                         # harness token-lint rules on the Graph page

Where the evidence lives: `design/motifgraph-ui-pass/` (research, direction, state matrix, interaction contract, copy, screenshots), `harness/state/reviews/` (critique, accessibility, performance, verification), `harness/state/ddm/` (decisions), `handoff/`.
Run the scripts from `design-harness/`. The harness coordinates and records; it does not replace human review, device testing or assistive-technology testing, and every report here says which of those are still owed.
