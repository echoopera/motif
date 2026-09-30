# Design-system contract (v1.0.0)

| Layer | Contents |
|---|---|
| Foundations | Graphite ramp, cobalt, amber, red; type families; 4-pt spacing scale; radii 4/8/12; durations 90/150/240 ms |
| Semantic tokens | `--surface-0..2`, `--stage`, `--text`, `--text-muted`, `--line`, `--accent`, `--accent-ink`, `--lock`, `--danger`, `--focus`, `--space-1..8`, `--radius-s/m/l`, `--text-xs/sm/md/lg/xl`, `--dur-fast/base`, `--ease-out` |
| Components | Button (primary, ghost, icon), Segmented, Slider row (label, range, readout, lock, reset on double-click), Select row, Toggle row, Text row, Group (collapsible), Style row, Chip, Dialog, Toast |
| Patterns | Parameter inspector, Mutate/Evolve loop, Export job, Saved looks |
| Platform adapter | Web immersive: canvas layer + DOM control layer; pointer, touch, keyboard |

States per component: default, hover, focus-visible, pressed, selected, disabled (with reason), locked (slider rows).
Reduced motion: chrome transitions become instant; canvas starts paused.
Contrast: text ≥ 4.5:1 on its surface in both themes; accent on surface ≥ 3:1.
Versioning: token names frozen at 1.0.0; value changes are minor; renames are major with migration notes.
