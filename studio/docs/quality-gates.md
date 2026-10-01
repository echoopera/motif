# Quality gates
Scale gates to mode/risk. A sketch does not need production certification. Label simulated behavior and untested claims.

| Gate | Acceptance | Evidence | Reviewer |
| --- | --- | --- | --- |
| Problem | User, scenario, outcome, constraints | Brief and assumptions | Research/coordinator |
| Journey | Task and recovery | State/journey contract | Domain/interaction |
| Creative | Coherence and legibility | Alternatives/rationale | Brand direction |
| Platform | Input, navigation, resizing, lifecycle | Actual captures/checks | Platform |
| Inclusive | Essential task via declared alternatives | Manual assistive checks and automation | Accessibility |
| System | Independent ownership and stable APIs | Contract/dependency review | Architect |
| Implementation | Real behavior and failures | Focused/integration tests | Engineering/QA |
| Delivery | Accurate artifacts/instructions | Release review/run steps | Coordinator |

Cover first use, empty, loading, populated, selection, editing, saving, success, invalid input, service error, denied access and recovery where relevant. Add offline/conflict/partial completion/expired rights/quota/interrupted export only as the domain requires.

iPhone matrix: compact portrait/relevant landscape, safe areas, keyboard, long content, large text, VoiceOver, appearance, resumption and Files where relevant.
iPad: portrait/landscape, resizable windows, touch/keyboard/pointer, relevant Pencil, focus, document ownership/restoration.
Web: supported browser/device matrix, keyboard, screen reader, zoom/reflow, reduced motion, no-hover touch, history and network conditions. Canvas essential tasks need alternatives beyond pixels.

Default web target is WCAG 2.2 AA, subject to project requirements. This target and automated scans do not establish conformance. Evaluate applicable criteria using locally available assessment material. If the normative criteria or assessment environment are unavailable, leave conformance unverified. WAI. APG supplies interaction guidance, still requiring real behavior checks. APG.

Evidence states device/runtime, revision, scenario, method, observed result and issues. Screenshots prove appearance, not interaction; units do not establish entire journeys; mock permissions do not prove authorization.

Blocker: core task unusable, data loss, critical security failure. Major: important task/input impaired. Minor: local polish. No unresolved release blockers. Major deferrals identify impact/owner and an explicit product decision. Review risky slices early, then modules/consumers, then assembled journeys. Stop optional tests once material risks and required gates are satisfied.

## Client partnership evidence
At relevant gates check: known client goals/preferences reflected; feedback disposition clear; creative rationale and craft reviewed; significant dissent resolved by the proper owner; promises match actual delivery; handoff and aftercare scope understandable.
Use client-review, craft-review, feedback-decisions and client-aftercare templates when useful. A document's existence alone is not a pass. Inspect its evidence and actual artifact. Mark absent client feedback/walkthroughs unverified; do not fabricate approval or stall already authorized reversible work.
