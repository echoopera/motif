# Handoff Protocol

A handoff is complete when an engineer who has never met us can ship it.

## Package contents (`handoff/`)

1. `00-summary.md` — what was built, for whom, why it looks the way it does (one page).
2. `01-decisions.md` — DDM export: every decision, rationale, alternatives rejected.
3. `02-screens/` — every screen at every state (default, empty, loading, error, overflow, unbounded), per platform.
4. `03-flows.md` — user journeys as numbered steps with screen references.
5. `04-tokens/` — colour, type, space, motion, elevation, per platform, with semantic names.
6. `05-modules/` — module graph + one README per module (collected from `modules/*/README.md`).
7. `06-copy.md` — full UX copy deck with tone notes.
8. `07-accessibility.md` — audit results and remediations.
9. `08-motion.md` — every transition with duration, easing, trigger, reduced-motion fallback.
10. `09-open-questions.md` — anything unresolved, with our recommendation.
11. `10-next.md` — what we would do next, prioritised.

## Gate

`gate.js handoff` fails if any file above is missing or any module lacks README + `module.json`.
