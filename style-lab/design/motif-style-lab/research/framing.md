# Framing — Motif Style Lab

**Who.** Motion designers and Echo (creative technologist) exploring treatments for Motif.
**Moment.** Early look development: "what should this title / loop / post feel like?"
**Pain.** Each variation is hand-built; comparing and exporting takes hours.
**Win.** Audition 25 foundational styles, push parameters, breed variations, export a real deliverable in minutes.
**Done.** A designer goes from blank to an exported 9:16 loop plus its preset JSON in under ten minutes.

## Journeys (step level)
| Journey | Step | Object / state change |
|---|---|---|
| Audition | Open the lab | Session starts with default style, paused if reduced motion |
| | Browse 25 styles by category | Library filter state |
| | Select a style | `current.style` changes; params reset to that style's defaults (undoable) |
| | Play, scrub, change aspect | Transport time; `aspect` |
| Evolve | Adjust parameters | `current.params` (history entry on commit) |
| | Mutate with strength and locks | Unlocked params perturbed; history entry |
| | Open Evolve, breed six | Six candidate states generated from `current` |
| | Keep a child | Candidate becomes `current`; history entry |
| | Undo or save the look | History cursor; Looks list |
| Export | Open export | Export settings |
| | Choose format, size, fps, loops | Export settings validated per format |
| | Render | Job state: idle → rendering(progress) → done / cancelled / failed |
| | Save | downloads capability confirmation |

## Riskiest unknowns
1. Seamless, deterministic loops for physics- and particle-like styles without simulation state.
2. 60 fps preview for the heaviest styles (flow field, metaballs) in Canvas 2D.
3. Browser support for WebCodecs encoders (H.264, VP9 with alpha).
4. Keeping 10+ controls per style from feeling overwhelming.
