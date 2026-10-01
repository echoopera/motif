---
name: screen-spec
description: The standard screen specification every platform designer writes. Used by ios-designer, ipados-designer, immersive-web-designer, saas-product-designer, editorial-internal-tools-designer.
---
# Screen Spec
For each screen, one file, sections in this order:
1. **Purpose** — one line. **The one thing** — the element a user came for.
2. **Journey steps served** — IDs.
3. **Structure** — platform pattern chosen and why; regions and what lives in each.
4. **Components** — each with semantic tokens (`surface.raised`, `text.secondary`), size, and platform control used.
5. **Input** — gestures, keyboard shortcuts, pointer/hover, Pencil (as applicable).
6. **States** — default, empty, loading, error, overflow, unbounded, offline, permission-denied. Each: what shows, what the user can do.
7. **Adaptivity** — text scaling (xSmall/xxxLarge or 200%), breakpoints/size classes, dark/high-contrast.
8. **Motion hooks** — transitions in/out, named for the Motion Designer.
9. **Copy hooks** — every string slot, named for the UX Writer.
10. **Platform surfaces** — widgets, intents, share, search (as applicable).
11. **HALT self-check** — the platform's HALT list, each ticked.
