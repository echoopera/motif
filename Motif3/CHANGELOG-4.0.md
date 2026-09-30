# Motif 4.0 — UI scrub

Interface only. Render engine, kits, SDK, export, autosave and project format are unchanged; v3 projects, kits and media open as-is.

## Grid
- 8px grid, 4px for tight components. Spacing 4·8·12·16·24·32·48. Control height 24 / 32 (40 on touch). Bars 40 / 48 / 24. Panel widths 256 / 304 / 328 / 376 / 400.
- Type on a 4px baseline. Slider track 4px, thumb 12px (20px on touch). Keyframes 10px (14px on touch).

## Information architecture
- Explore strip: Mutate · Evolve · Random · Strength · Reset live under one label. Mutate is the soft-accent primary; Deliver is the only solid amber button.
- New / Undo / Redo moved to the title bar with Shortcuts and Deliver.
- Inspector tabs sit directly above the inspector (they were in the bottom bar). The bottom bar is now a 24px status strip.
- Library tiles show the name and capability badges only (GPU · GLSL · MEDIA · ⚡). Description on hover. Category chips scroll in one row.
- Lock icons appear on row hover; keyframe diamonds are always visible.
- Layout breakpoints: ≥1024 three columns (iPad landscape), 768–1023 viewer + inspector with Library as a tab (iPad portrait), <768 stacked.
- Narrow inspectors (<360px) put label + value above a full-width slider.

## Copy
- Panel descriptions, info paragraphs, hints and toasts cut to a line or a tooltip.
- First-run coach: Pick a style · M Mutate · Space Play. Dismisses on first action.

## Files
- Build: `python3 src-v4/build.py` → `motif4.html`. New patch layer: `src-v4/parts/v4_patch.py`.
