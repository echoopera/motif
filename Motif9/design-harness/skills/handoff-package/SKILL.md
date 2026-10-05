---
name: handoff-package
description: Assemble the handoff package and pass the handoff gate. Used by engagement-lead.
---
# Handoff Package
1. `node harness/scripts/ddm.js export <project> > handoff/01-decisions.md`.
2. Collect screen specs → `02-screens/<platform>/`; flows → `03-flows.md`; tokens → `04-tokens/`; module READMEs + `graph.json` → `05-modules/`; copy deck → `06-copy.md`; a11y report → `07-accessibility.md`; motion spec → `08-motion.md`.
3. Write `00-summary.md` (template `handoff-summary.md`), `09-open-questions.md` (each with our recommendation), `10-next.md` (three prioritised moves with reasons).
4. `node harness/scripts/gate.js handoff` green.
5. Walkthrough in the client's language: what changed since last review, what didn't and why, what's next.
