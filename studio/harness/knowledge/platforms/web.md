# Web — Platform Intelligence (immersive, SaaS, editorial, internal)

One platform, four dialects. The dialect is chosen by the job; the standards are shared.

## Shared standards
- Semantic HTML first; ARIA only to fill gaps. Keyboard-complete. Focus visible and designed.
- Layout: fluid with intrinsic sizing; container queries over viewport queries for components. Design at 360, 768, 1024, 1440, 1920 and at 200% zoom.
- Type: fluid scale (clamp), measure 45–75 characters, line-height by role (tight for display, loose for body).
- Colour: semantic tokens with light/dark/high-contrast themes. Contrast ≥ 4.5:1 body, ≥ 3:1 large/UI.
- Motion: transform + opacity only for animation; respect reduced-motion; page transitions under 300 ms; micro-interactions under 150 ms.
- Performance is a design property: first meaningful render under 1.5 s on a mid-range phone; no layout shift after load; images sized and lazy.
- Offline and error states designed, not defaulted.

## Dialect: Immersive
Rich, dynamic, cinematic software — instruments, canvases, playful products, storytelling.
- The canvas is the app; chrome is minimal and contextual. Pointer, touch, keyboard and gamepad-style input all considered.
- Rendering: WebGL/WebGPU or canvas for the immersive layer; DOM for text and controls overlaid. Never put text in the canvas.
- Audio: a single audio context, unlocked on first gesture; latency budget stated in the brief; visual feedback synced to audio clock, not frame clock.
- Motion carries meaning: physics, easing curves with personality, choreography between elements. Still: everything interruptible, everything reduced-motion safe.
- Progressive enhancement: the core task works without the immersive layer.

## Dialect: SaaS
Dense, multi-tenant, task-heavy products.
- App shell: top bar (org switcher, search, notifications, user), left nav (collapsible, grouped), content with page header (title, breadcrumb, primary action).
- Tables are the primary object: sticky header, resizable columns, row density switch, bulk selection, inline edit, saved views, empty/filtered-empty states distinct.
- Forms: single column, labels above, validation inline on blur, summary on submit. Destructive actions confirm with the object name.
- Permissions are visible: disabled with reason, not hidden.
- Onboarding is progressive: empty states teach; no tours.

## Dialect: Editorial
Reading and publishing surfaces — magazines, docs, longform tools.
- Typography leads. A strong vertical rhythm; a modular scale; generous measure; drop caps and pull quotes only when the content earns them.
- Grid: 12-column with editorial spans (asymmetry allowed, alignment mandatory).
- Editing tools: block-based editor, inline formatting on selection, slash-menu for insert, revision history, live preview matching output exactly.
- Media: art-directed images (different crops per breakpoint), captions and credits as first-class fields.

## Dialect: Internal tools
Tools for the people who run the business.
- Speed over polish, but never over clarity. Density high; shortcuts everywhere; command palette mandatory.
- Every screen answers "what is this record, what can I do to it, what happened to it." Audit trail visible.
- Adaptive: built on the same tokens and components as the product so it can scale into a product later.
- Forms handle the ugly: bulk edit, CSV in/out, long lists with virtual scroll, partial failure reporting.

## HALT conditions
Keyboard-inaccessible core flow · Contrast below threshold · Text inside canvas · Layout shift after load · Modal-on-load · Tours instead of empty states.
