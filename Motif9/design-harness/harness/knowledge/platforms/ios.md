# iOS — Platform Intelligence (iPhone)

Offline distillation of Apple's platform conventions plus studio judgment. Names are semantic; exact numeric values live in `modules/tokens`.

## What "native" feels like
- Content first, chrome recedes. Navigation bars and tab bars are translucent surfaces that reveal content moving beneath them.
- Depth through layered, blurred materials — not drop shadows. Materials: ultra-thin, thin, regular, thick, plus the current glass-style material with light refraction at edges. Use one material family per screen.
- Motion is physical: spring-based, interruptible, tied to the gesture that caused it. Nothing animates that the user didn't cause.
- Everything is reachable with one thumb. Primary actions live in the lower third.

## Structural patterns
| Need | Pattern |
|---|---|
| 2–5 top-level destinations | Tab bar (bottom). Never more than 5. Never hide it on primary screens. |
| Drill-down hierarchy | Navigation stack with large title collapsing to inline on scroll. |
| Transient task | Sheet (medium/large detents, grabber). Sheets for tasks, full-screen covers for modes. |
| Contextual actions | Context menu on long-press; swipe actions on list rows; toolbar for screen-level actions. |
| Search | Search field integrated in the nav bar; results replace content, cancel restores. |
| Settings | Grouped inset lists. Never invent controls when a toggle, picker, or stepper exists. |

## Sizing and spacing
- Minimum touch target: 44 × 44 pt. Performance/stage or one-handed contexts: 60–64 pt.
- Layout margins: standard readable margins; content never touches the safe-area edge.
- Corner radii are continuous (superellipse), scaled with element size. Concentric radii for nested containers: inner = outer − padding.
- Type: Dynamic Type is mandatory. Design at Large (default) and test at xxxLarge and xSmall. Use the platform text styles (Large Title → Caption 2) before custom sizes.

## Colour
- Semantic colours (label, secondary label, system background, grouped background, tint) adapt to light/dark/increased-contrast. Custom palette maps onto these roles.
- One accent tint per app. Tint means "tappable." Never use tint decoratively.

## Gesture grammar
- Edge swipe back is sacred. Never block it.
- Pull-to-refresh on scrolling content only where refresh is meaningful.
- Long-press = preview or context. Never hide primary actions behind long-press alone.
- Drag reorder needs a visible affordance in edit mode.

## Feedback
- Haptics: selection change (light), success (notification-success), warning, error. Never haptic on scroll or repeatedly.
- Loading: skeletons for content, progress indicators for tasks > 1 s, never spinners over the whole screen.

## Widgets, Live Activities, App Intents
- If the app has a "current state," it has a Live Activity and a lock-screen widget.
- Core verbs (capture, start, mute) should be App Intents so Siri, Shortcuts, and Spotlight can run them.

## HALT conditions
Custom tab bars that break accessibility · Blocked back gesture · Text that does not scale · Targets < 44 pt in core flows · Modal dialogs for non-destructive confirmations.
