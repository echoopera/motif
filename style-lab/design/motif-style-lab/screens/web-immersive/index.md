# Screens — web immersive

## Layers
Immersive: one stage canvas + library thumbnail canvases + Evolve canvases. Control layer: DOM. Text: DOM only (style names, labels, readouts).

## Workspace (≥ 1100 wide)
Top bar 48 · three columns (272 / fluid / 320) · stage letterboxes the canvas at the chosen aspect with 24 gutter; scrubber under the canvas.

## Tablet / narrow (720–1099)
Library collapses to a horizontal strip above the stage; inspector below the stage.

## Phone (< 720)
Single column: top bar, stage, action bar, inspector groups, library list. Evolve shows 2 columns.

## States
| Surface | States |
|---|---|
| Stage | playing, paused, reduced-motion paused with hint, fonts loading (fallback) |
| Library | all, filtered, no match ("No styles match") |
| Inspector | per style; locked rows show amber lock; disabled rows name the reason |
| Evolve | round n, rendering, keep |
| Export | configuring, unsupported option (disabled with reason), rendering k/N, encoding, offering file, saved, declined, failed, cancelled |
| Saved looks | empty, list |
| Preset import | invalid file (inline error) |

## Input
Pointer, touch and keyboard for every action (see navigation.md). Sliders: arrow keys step, Shift ×10, Home/End min/max, double-click resets.
Performance budget: stage frame ≤ 16 ms at 1440×810 CSS, DPR ≤ 1.5 in Auto quality; thumbnails render once, animate only while hovered.
