# Motif 5 accessibility and resilience findings (quality lane)

Scope: the shell as built from `Motif3/src-v5` at the revision named in `Motif3/verify-out/evidence.md`. Evidence comes from `Motif3/tests/browser/a11y.mjs` (real Chromium key events, computed styles, hit-testing) and `soak.mjs`. Reproduce with `cd Motif3 && npm run test:a11y`.

## What was and was not tested

Tested (automated, desktop Chromium 141, SwiftShader): keyboard-only Tab traversal of the whole shell (97 stops) and of all six inspector tabs; focus indicator presence; accessible names of every interactive element; roving tabindex and arrow keys on the tablist and every visible radiogroup; export, shortcuts, palette and Evolve open/Esc/focus-return, modal containment; library listbox, scrub slider, transport, timeline key controls; ARIA required attributes and id references; contrast of the token palette (text 4.5, UI 3) and of 400+ rendered text styles; `prefers-reduced-motion: reduce` emulation; reflow at 720x450 @2x (200% zoom equivalent), 360 px and 320 px widths; touch-target sizes with a coarse pointer.

NOT tested: any screen reader (NVDA, JAWS, VoiceOver, TalkBack), so announced names, roles, live-region behaviour and reading order are unverified; Firefox and Safari; real touch hardware; text-only scaling and text-spacing overrides (WCAG 1.4.4 / 1.4.12; the UI is px-based); forced-colors / high-contrast; contrast of text drawn over images or gradients and of the canvas artwork itself; non-visual equivalents for canvas actions beyond the stage's `aria-label`; flashing/seizure analysis of generated animation (WCAG 2.3.1); time limits; the Media, Edit, Colour and Deliver pages (they do not exist in this shell yet); empty, loading and error states. **This document does not claim WCAG 2.2 AA conformance.** Passing automation is necessary evidence, not a conformance result.

## Fixed in this lane (additive hunks in `src-v5`)

| ID | Severity | Defect and evidence (before) | Fix | After |
| --- | --- | --- | --- | --- |
| A-1 | Major | Inspector tablist: all 6 tabs were tab stops; Home/End did nothing (`tablist:roving-tabindex`, `tablist:arrow-home-end` failed). | `14-shell.js` delegated roving-tabindex + Arrow/Home/End handler (selection follows focus, as the existing handler did for Left/Right). | pass |
| A-2 | Major | Every radiogroup (library view, aspect ratio, workspace layout, palette, colour space, bars, export formats) had all radios as tab stops and Arrow keys did not move or select (`radiogroup:*:roving-tabindex`, `radiogroup:arrow:*`). In the shell, ArrowLeft/Right on a focused radio stepped the timeline frame instead. | Same shim (MutationObserver keeps dynamically rendered groups in sync; focus is restored if a click re-renders the panel). | pass |
| A-3 | Major | Focus order: the inspector `<aside>` came after the footer in DOM order, so Tab from the last inspector tab visited 10 footer controls before reaching the panel (`kbd:tablist-leads-to-panel`). | `head.html`: footer markup moved after the inspector `<aside>`. Layout is grid-area based so visuals are unchanged. | pass |
| A-4 | Minor | Three focusable `role=separator` splitters had no `aria-valuenow/min/max` (ARIA 1.2) (`splitters:aria-values`). | `14-shell.js`: values set on focus and after arrow keys. | pass |
| A-5 | Major | Text fields, selects, switches and slider tracks were bounded by `--line-strong`, 1.5-1.6:1 on their surfaces; WCAG 1.4.11 asks 3:1 for a control's boundary (`contrast:tokens-live`, `contrast:form-control-boundaries`). | `head.html`: new `--edge: #6F6F7C` (3.4-3.9:1 on surface-0/1/2) used only for control boundaries; dividers keep `--line-strong`. This brightens control outlines: design review wanted. | pass |
| A-6 | Minor | Timeline "remove keys" glyph had inline `opacity:.8`: 3.86:1 (`contrast:rendered-text`). | `14-shell.js`: inline opacity removed. | pass |
| A-7 | Minor | Timeline clip-bar secondary text (`opacity:.68`) measured 3.9-4.1:1. | `head.html`: `.clipbar small{opacity:.85}`. | pass |
| A-8 | Major | First-run coach hint is `white-space: nowrap`-wide: at 360 px and 320 px the document scrolled horizontally (394 / 374 px) and its dismiss button was off-screen (`reflow:360px:*`, `reflow:320px:*`). | `head.html`: `.coach` wraps and is width-capped. | pass |
| A-9 | Minor | Splitter hit area 9 px wide (`targets:desktop>=24px`). | `head.html`: `::before` extends the hit area to 25 px for fine pointers. | pass |
| R-1 | Major (resilience) | Finishing-stack WebGL context had no `webglcontextlost` handler: after `WEBGL_lose_context`, rendering with glow/chroma returned a blank frame (pixel sum 0) forever (`contextloss:renders-after-restore`, `contextloss:output-matches-before` failed). | `11-finish.js`: on loss fall back to the CPU finish, ask for restore, rebuild programs and targets on `webglcontextrestored`. Output after restore equals the pre-loss pixels. | pass |

## Known open (documented, do not fail the run; owner decision needed)

| ID | Severity | Observation | Why open |
| --- | --- | --- | --- |
| K-1 | Minor | Layer rows are `role=option` containing the eye `<button>`: interactive content inside an option (`aria:no-interactive-inside-option`). Screen readers may not expose the button. | Needs a row restructure (listitem + selectable button) in the layers panel; not additive. Screen-reader behaviour not tested. |
| K-2 | Minor | 5 edge-of-track keyframe diamonds (14 px, padded hit area clipped by the track) are under 24 px effective (`targets:desktop>=24px`). Keys are keyboard operable (focus, Alt+Arrows, Delete). | Fix is a timeline geometry change. |
| K-3 | Major against the studio's 44 pt rule, Minor against WCAG 2.5.8 | With a coarse pointer 141 of 151 controls are under 44 px (tokens are 40/32 px); all are at least 24 px (`targets:touch>=24px` passes). | Raising `--target`, `--target-sm`, `--ib` for coarse pointers reflows the dense editor. The brief makes touch secondary (Chrome/Edge, keyboard-first); product owner should decide. |

## Observations (no action taken)

- `01-tokens.js` exports a second, unused light/dark token set (`uiCss`); the live palette is the dark `:root` in `head.html`. `tools/contrast.mjs` checks the live one and reports the other as unused. Delete or wire it up to avoid drift.
- All 407 sampled text styles in the shell meet 4.5:1 (or 3:1 for large text) after A-6/A-7. Text over thumbnails and gradients was not measurable.
- `prefers-reduced-motion` is honoured: no autoplay, no running CSS animations or transitions, the stage stays paused with an on-screen hint, Space still plays (control run without the preference autoplays).
- Export dialog open/close adds about 2.8 DOM nodes per cycle (2594 -> 2732 after 50 cycles); bounded in the soak (limit 1500) but worth a look when the Deliver queue lands.
- Modal containment: native `<dialog>` modals (Deliver, Shortcuts) and the command palette keep Tab inside; focus returns to the opener on Esc.

## Re-running

`npm run test:a11y` (about 1 to 3 minutes; add `-- --focus-shots` for a pixel check of every focus ring), output in `Motif3/tests/a11y-out/` (`summary.json`, `tab-order.json`, `contrast-rendered.json`). New defects found later go in the table above; a deliberately open check id goes in `KNOWN` at the top of `a11y.mjs`.
