# State model

## Transport
`playing ⇄ paused`. Start `paused` when `prefers-reduced-motion: reduce`, otherwise `playing`. Scrub sets time and keeps the prior play state.

## Editing
Any committed change (slider release, select change, toggle, mutate, randomize, reset, evolve keep, style change, preset load, saved-look load) → push history, trim redo branch.
Slider drag = live preview without history entries; release = one entry.

## Evolve
`closed → open(round n) → keep(child) → closed` · `open → breed again → open(n+1)` · `open → Esc → closed` (no change).

## Export job
`idle → configuring → rendering(k/N) → encoding → offering → saved | declined | failed | cancelled → idle`.
Errors: unsupported codec (disable option with reason before start), encoder error (message + retry with fallback), too large (offer smaller tier), downloads unavailable (explain and keep the file offer disabled).

## Empty / loading / error
- Fonts loading: canvas renders with fallback fonts, rerenders thumbnails when fonts are ready.
- Saved looks empty: "Saved looks appear here. Press S to save the current look."
- Preset import invalid: inline error naming the problem; state unchanged.
