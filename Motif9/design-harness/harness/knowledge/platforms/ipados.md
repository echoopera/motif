# iPadOS — Platform Intelligence (iPad, and macOS where noted)

iPad is not a big iPhone. It is a canvas with a keyboard, a pencil, a pointer, and a second window.

## Layout
- Sidebar + content (two-column) or sidebar + list + detail (three-column). Sidebar collapses to a tab bar in compact width. Design both.
- Size classes: regular/regular (landscape, full screen), compact/regular (split view narrow), plus Stage Manager arbitrary window sizes. Design for a minimum window of roughly one-third width; test at every breakpoint.
- Content width has a readable maximum; centre it, don't stretch it.
- Toolbars go at the top (leading: navigation, centre: document-level, trailing: actions). Bottom toolbars only for tool palettes in creative apps.

## Input
- Pointer: hover states, pointer shape morphs to buttons, trackpad gestures for zoom/rotate. Every tappable thing has a hover appearance.
- Keyboard: every primary action has a shortcut; discoverable via the shortcut overlay. Arrow-key navigation in lists and grids. Tab order is designed, not accidental.
- Apple Pencil: low-latency inking; hover preview; double-tap and squeeze mapped to tool switching, never to destructive actions. Palm rejection is assumed; design tool palettes to be reachable with the non-dominant hand.
- Touch still rules: targets ≥ 44 pt; performance surfaces ≥ 64 pt.

## Multitasking
- The app is expected to run side by side. State restores exactly. Drag and drop between windows for anything that is an object (a loop, a file, a card).
- Multiple windows: a document is a scene. "Open in new window" for anything a user might compare.

## Creative-app conventions (music, art)
- Canvas-centred layout: tools left, properties right, transport/timeline bottom, all collapsible, canvas never obstructed.
- Modal tool state must be visible at all times (which tool, which colour, which lane is armed).
- Zoom and pan are two-finger gestures, always; pinch scales around the pinch centre.
- Undo is multi-step, visible, and three-finger-swipe compatible.

## macOS notes (when the same design ships there)
- Window chrome, menu bar with full command set, sidebar with source list styling, inspector on the right, resizable panes with remembered positions. Pointer precision allows denser layouts (target ≥ 28 pt) but keep the same semantic tokens.

## HALT conditions
Phone layout stretched to fill · No keyboard path for a primary action · Pencil mapped to delete · Canvas obscured by permanent panels · State lost on split-view resize.
