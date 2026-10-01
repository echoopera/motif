# Interaction Principles

## The user model
- People come with a goal, a context, and a budget of attention. Design for the moment in the scenario ("on a train, one hand, 20 s"), not for a desk.
- Novices need recognition; experts need recall. Every core action has a visible path and a fast path (gesture, shortcut, command palette).

## Direct manipulation
- Objects, not commands. Drag the loop; don't open a dialog to set its length.
- Continuous feedback during manipulation; commit on release; undo always.

## Affordance and feedback
- Anything tappable looks tappable; anything draggable has a grip; anything editable shows an insertion point on hover/focus.
- Feedback within 100 ms or the user retries. Progress within 1 s or the user doubts. Completion signalled with a state change, not a toast, where possible.

## Errors
- Prevent > detect > recover. Constrain inputs, validate inline, explain in human language, offer the fix.
- Never blame. Never "invalid." Say what is expected.

## Progressive disclosure
- Show what most people need most of the time; reveal the rest on intent (hover, expand, advanced).
- Never hide something the user just used.

## Consistency
- Same thing looks the same; different things look different. Positional consistency (primary action always in the same place) matters more than visual identity.

## Modes
- Avoid modes. When unavoidable (recording, editing, armed), make the mode loud and the exit obvious.

## Journey mapping (method)
For every journey in the brief: step → screen → state → action → feedback → next. Gaps in that chain are bugs in the design.
