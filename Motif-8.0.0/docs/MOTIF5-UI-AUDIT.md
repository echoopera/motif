# Motif 5 — UI Audit, Patterns & Adjustments
Goal: speed, flow state, high-performance workflow. Sources: Resolve + Bitwig comps (workflow), prism / datamosh / Carson / Surfer comps (aesthetic), Design Harness 3.0 (rules).

## 1. Audit (observation → impact → fix)
| # | Motif 4 finding | Impact | Motif 5 fix | Source |
|---|---|---|---|---|
| 1 | Two header rows (actions + transport) ≈ 88px of viewer lost | Canvas is the product; cramped stage | One 48px instrument bar: transport + LCD + Explore + utilities. Two rows only <64em | Resolve page bar; Harness "canvas never obstructed" |
| 2 | No command palette | Every action = mouse travel | `Ctrl/⌘K`: fuzzy search of commands, layouts, panels, aspects, palettes, all styles; recents; live preview on arrow | Harness "command palette mandatory" |
| 3 | Fixed panel widths, no collapse | Can't trade space for focus | Draggable splitters (arrow-key + dbl-click reset), collapse-snap, remembered per user | Resolve/Bitwig panes; Harness "resizable, remembered" |
| 4 | Library click-to-apply only | Slow to judge styles | Hover-audition (260ms dwell) previews in the stage without committing; click commits. Dense/Grid/List view | Bitwig browser preview |
| 5 | Sliders need precision drag on tiny thumbs | Slow tuning | Scrub any label (Shift fine, Alt finer, dbl-click reset); filled tracks; modified/animated indicators | Instrument-grade controls |
| 6 | Modes implicit | Lost state | Loud mode surfaces: HUD tag (aspect·res·fps), audition badge, Resolve-style workspace switcher | Harness "modes loud" |
| 7 | Timeline clips one colour | Layers unreadable | Bitwig-style per-layer colour: clip, track head, layer stripe all share it | Bitwig comp |
| 8 | Time readout plain | Weak time anchor | Cyan LCD (only data colour), frame read, loop-progress prism hairline | Resolve timecode |
| 9 | No layout presets | Manual rearranging per task | Explore / Build / Time / Focus (`Alt 1–4`, `F`); Focus never persists on reload | Resolve pages |
| 10 | Flat aesthetic, no identity | Generic tool feel | Graphite surfaces; prism gradient used sparingly (header hairline, brand, LCD line, palette rule); registration-mark crosshairs + grain on stage surround (datamosh/Carson) | Visual comps |

## 2. Patterns
- **Instrument bar**: [brand · project] [transport · LCD] [Mutate · Evolve · Random · strength] [search · undo/redo · Deliver].
- **Audition, don't commit**: hover/arrow = preview through a non-history overlay; Esc/leave restores; click/Enter commits with undo.
- **Scrub labels**: label is the handle; modifiers change resolution.
- **Palette-first**: anything reachable in ≤2 keystrokes after `Ctrl K`.
- **Workspace switcher** in status bar with panel toggles left, perf right.
- **Colour discipline**: amber = action/selection, cyan = time/data only, prism = brand punctuation only, layer colours = identity.

## 3. Tokens
Graphite ramp (surface 0–4), `--text-dim #8A8A96` on dark (AA for ≥14px), `--data` cyan, `--prism` gradient, `--clip-1..4` (green, purple, blue, amber), `--bar-h/--hdr-h 48`, `--status-h 32`, `--target` 32px min hit area.

## 4. Shortcuts
Space play · M mutate · E evolve · R random · Ctrl/⌘K palette · `/` search library · L library · I inspector · K timeline · F focus · A audition toggle · D density · Alt 1–4 layouts · Alt ↑/↓ layer · `-`/`=` strength · ←/→ in library.

## 5. Responsive tiers
≥1120px single row · 1120–1360 labels drop to icons · 64–100em compact · 48–64em two-row header, library becomes a tab, viewer+timeline left / inspector right · <48em stacked, bottom tabs, timeline compact.

## 6. Acceptance checks
No header overflow at 1920/1440/1366/1280/1024/834/390 · no JS errors · palette opens <100ms · audition never enters undo history · layout persists (except Focus) · all controls ≥32px target · keyboard reachable.
