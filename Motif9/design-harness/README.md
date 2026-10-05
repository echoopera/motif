# Design Harness 3.0

A self-contained operating system for high-quality product design and implementation across iPhone, iPad, macOS, immersive web, SaaS, editorial/internal tools, music software, creative tools, content platforms, brand and marketing.

This edition synthesizes the strongest parts of both Design Harness 2.0 packages:

- the first package's broad specialist coverage, modular architecture, client partnership, quality gates and evidence discipline;
- the second package's executable work orders, path claims, decision model, stage gates, module scaffolding and local knowledge sheets.

The result is smaller in operation than in capability: the Studio Director selects only the roles a project needs. It can be run by one agent sequentially or by multiple agents in isolated lanes.

## What makes it usable

1. **A brief becomes work orders.** The local planner produces owners, dependencies, outputs and acceptance criteria.
2. **Design intent becomes a system.** Foundations, semantic tokens, components, patterns and platform adapters have explicit ownership and versioning.
3. **Platforms adapt without fragmenting.** Shared intent is preserved while navigation, density, input and system conventions remain native.
4. **Rich software is treated as behavior, not screens.** State, input, latency, recovery, undo, permissions and accessibility are specified.
5. **Parallel work has boundaries.** Work orders claim disjoint files and shared resources; interface stubs stabilize seams.
6. **Quality is evidence-based.** Mechanical gates support — but never replace — design review, accessibility checks, scenario testing and client decisions.
7. **No remote harness dependency.** Agent profiles, knowledge, templates, schemas and utilities are local. The scripts use only the Node.js standard library.

## Start in five minutes

1. Read `AGENTS.md` and `RUNBOOK.md`.
2. Copy `examples/golden-brief.json` to `brief.json` and edit it.
3. Validate and preview the plan:

       node harness/scripts/validate.js brief brief.json
       node harness/scripts/plan.js brief.json

4. Generate work orders when the plan is right:

       node harness/scripts/plan.js brief.json --write
       node harness/scripts/plan.js check

5. Execute lanes sequentially or in isolated worktrees, then run:

       node harness/scripts/gate.js all

No package installation is required. Node.js 18 or later is recommended.

Run the bundled self-check with:

       node --test tests/*.test.js

## Primary files

| File or folder | Purpose |
|---|---|
| `AGENTS.md` | Runtime-neutral studio constitution and routing rules |
| `ROSTER.md` | Specialist catalog and activation guide |
| `RUNBOOK.md` | End-to-end operating procedure |
| `COMPARISON.md` | Source-package comparison and synthesis decisions |
| `agents/` | Canonical local agent profiles |
| `harness/knowledge/` | Platform, domain and principle sheets |
| `harness/protocols/` | Coordination, client care, handoff and parallel-work rules |
| `harness/schemas/` | Brief, work-order, decision, claim and module contracts |
| `harness/scripts/` | Dependency-free validation and planning utilities |
| `harness/templates/` | Reusable design, evidence, review and handoff artifacts |
| `docs/design-system-standard.md` | Cross-platform design-system model and governance |
| `docs/quality-gates.md` | Human and mechanical acceptance model |
| `skills/` | Optional reusable local procedures |

## Recommended kickoff prompt

> Use Design Harness 3.0. Read AGENTS.md, RUNBOOK.md and the relevant local agent and knowledge files. Act as Studio Director. Inspect the supplied project and brief. Select the smallest qualified team, identify the riskiest journey, define observable acceptance, separate facts from assumptions, and create work orders with exclusive ownership. Use platform-native patterns, a shared semantic design system and state-complete interaction contracts. Execute only within available tools and authorization. Deliver the requested design or software plus evidence, decisions, limitations and a clean handoff.

## Honest boundaries

The harness coordinates work; it does not start models, enforce operating-system locks, perform device tests, certify accessibility, publish software or replace professional legal/security review. Claims require evidence from the actual revision and environment. Native delivery still needs the appropriate Apple toolchain. Rich browser behavior still needs browser and device testing.
