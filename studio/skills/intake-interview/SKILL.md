---
name: intake-interview
description: Turn a client request into a validated brief.json using one-at-a-time multiple-choice questions. Used by engagement-lead.
---
# Intake Interview
1. Draft `brief.json` from what the client already said. Fill everything you can. Mark guesses.
2. Reflect: one paragraph — user, moment, pain, win, done. Send it. Wait for the nod.
3. For each required field still missing *and* material to the work: one MCQ per turn (`harness/protocols/mcq-protocol.md`). Order: platforms → domain → primary journey → acceptance → constraints → tone.
4. For non-material gaps: decide, note `[assumed]` in the DDM, move on.
5. `node harness/scripts/validate.js brief brief.json` → fix → hand off.
Stop condition: schema valid and the client has nodded at the reflection.
