# Findings

- The overlay is project-level: it replaces the project the stage draws (`getProject: () => audition || project`), so a preview shows exactly what a commit would. Cost per preview is one project clone plus one stage render.
- Leaving the menu by any route must clear it; the page clears on Escape, pointer-leave, scope change, any commit and every destructive action. A test covers hover, Escape, arrow and Enter.
- Hover audition respects the user's existing Hover-preview toggle (`api.auditionOn`).
- Not tested: audition while the render Worker is busy with a long compile (the overlay would lag one frame, not leak).
