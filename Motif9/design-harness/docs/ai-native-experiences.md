# AI-native experience standard

Use this guidance when software recommends, generates, transforms, ranks, summarizes or takes actions for a user.

## Core contract

For every AI-enabled action define:

- user intent and permitted scope;
- inputs used and sensitive-data boundaries;
- what the system will produce or change;
- confidence or uncertainty communication appropriate to the decision;
- preview and approval threshold;
- cancellation, undo and recovery;
- provenance/history needed for review;
- fallback when the model, tool or network is unavailable;
- evaluation criteria and prohibited outcomes.

## Interaction rules

1. Show the system state: waiting, working, needs input, ready for review, partially complete, failed or cancelled.
2. Distinguish suggestions from committed changes.
3. Let users inspect affected objects before high-impact or bulk actions.
4. Preserve user edits; regeneration must not silently overwrite them.
5. Make scope visible: current selection, document, project, account or external system.
6. Explain limitations in the moment they matter, not in distant policy copy.
7. Provide deterministic controls for exact tasks; natural language is an additional route, not the only route.
8. Avoid false personhood, emotional pressure and invented certainty.
9. Keep an audit trail for consequential operations.
10. Evaluate output quality with representative scenarios, edge cases and human review.

## Autonomy levels

| Level | Behavior | Default safeguard |
|---|---|---|
| Suggest | Proposes content or next steps | User explicitly chooses |
| Draft | Creates a reversible artifact | Preview and edit |
| Prepare | Stages changes across objects | Diff, validation and confirmation |
| Act | Commits a bounded action | Clear scope, approval policy, undo/audit |
| Monitor | Watches for a condition | Visible rule, cadence, pause and notification controls |

Higher autonomy requires stronger permission, observability, reversibility and evidence.

## Evaluation

Measure task success, correction burden, harmful error rate, time to recovery, user understanding of scope, and appropriate trust. Engagement alone is not proof of value.

