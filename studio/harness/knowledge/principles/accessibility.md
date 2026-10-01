# Accessibility Standard (WCAG 2.2 AA equivalent, applied to native and web)

## Non-negotiables (HALT if violated in a core flow)
- Contrast: 4.5:1 body text, 3:1 large text and UI boundaries.
- Targets: 44 × 44 pt native, 24 × 24 CSS px minimum web (we use 44 anyway).
- Keyboard: every action reachable, focus visible, no traps, logical order.
- Screen reader: every control has a name, role and state; images have alt or are decorative; live regions for dynamic changes.
- Text scaling: layouts survive 200% (web) and xxxLarge Dynamic Type (Apple).
- Motion: reduced-motion honoured; no flashing > 3 Hz; parallax optional.
- Time: no time limits on input without extension.
- Colour: never the only carrier of meaning.

## Audit method
Per screen: navigate by keyboard only → navigate by screen reader only → scale text to maximum → switch to dark and high-contrast → enable reduced motion → try one-handed on a phone. Record failures as observation → impact → fix.

## Creative-tool specifics
Canvas apps expose a non-visual equivalent for every core action (menu commands, shortcuts, accessible object list). Audio apps caption or visualise audio state (level meters have numeric labels).
