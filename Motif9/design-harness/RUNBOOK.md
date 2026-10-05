# Runbook — one engagement from brief to handoff

## 0. Intake

The Engagement Lead creates `brief.json` from the local template or example. Label inferred constraints and ask one focused question only when a material decision cannot be inferred.

    node harness/scripts/validate.js brief brief.json
    node harness/scripts/ddm.js init <project-slug>

## 1. Direction and evidence

UX Researcher and Information Architect frame the critical journey, objects, states and risks. Creative Director provides alternatives only when real creative uncertainty exists. Record the selected direction:

    node harness/scripts/ddm.js add <project-slug> creative-director 2 "Direction: <name>" "<rationale>" "<alternative-a>|<alternative-b>" "<sacrifice>"

## 2. Plan the work

Preview before writing:

    node harness/scripts/plan.js brief.json

The Studio Director removes unjustified roles. The Producer confirms every output has one owner, then writes work orders:

    node harness/scripts/plan.js brief.json --write
    node harness/scripts/plan.js check

Do not regenerate over active work orders. Archive or use a clean project state first.

## 3. Stabilize shared seams

Before parallel work, publish versioned stubs for tokens, object models, commands, events and other shared interfaces. A stub fixes shape, not implementation. Breaking changes pause affected consumers and require a recorded decision.

## 4. Execute lanes

Use isolated worktrees or nonoverlapping outputs where available. File claims are advisory local coordination, not a distributed lock:

    node harness/scripts/claim.js claim WO-006 ios-designer
    node harness/scripts/claim.js check ios-designer design/<project>/screens/ios/index.md
    node harness/scripts/claim.js renew WO-006 ios-designer
    node harness/scripts/claim.js release WO-006 ios-designer

Sequential execution uses the same work orders without pretending it was parallel.

## 5. Prototype the riskiest behavior

If the brief requests a prototype or marks a novel interaction risk, build the smallest runnable proof. Include deterministic fixtures, reset, loading/error/recovery and a visible list of simulations. Do not let prototype polish imply production readiness.

## 6. Systemize and build

Define the design system using `docs/design-system-standard.md`. Scaffold isolated code modules when implementation is requested:

    node harness/scripts/scaffold.js module tokens --kind tokens --owner design-systems-engineer
    node harness/scripts/scaffold.js module web-shell --kind shell --platform web --owner web-engineer
    node harness/scripts/boundary-check.js
    node harness/scripts/token-lint.js

## 7. Review and verify

Review rendered artifacts and actual behaviors, not filenames. Run risk reviews proportionally. Attach revision, environment, scenario, method and observed result.

    node harness/scripts/gate.js all

A mechanical pass does not prove accessibility, usability, visual quality, performance, security or client approval. The Verifier maps each acceptance criterion to evidence and marks unsupported claims not met.

## 8. Integrate and hand off

Integration Engineer assembles accepted outputs against a known baseline and reruns affected journeys. Export decisions:

    node harness/scripts/ddm.js export <project-slug>

Build the handoff defined by `harness/protocols/handoff-protocol.md`, including editable/source artifacts, run instructions, known limitations, migrations, rollback and bounded aftercare.

## Recovery

On failure, preserve evidence, record the cause and try at most two materially different recovery steps. Log stage loopbacks:

    node harness/scripts/ddm.js loopback <project-slug> 7 4 "<reason>"

Do not lower the acceptance bar silently or reassign a claim until the previous writer is known to have stopped.

