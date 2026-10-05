# Systems Thinking — how we build so things scale

## Design system layers
1. **Tokens** — semantic names for colour, type, space, radius, elevation, motion. Platform-specific values, shared names.
2. **Primitives** — button, field, list row, card, sheet — one implementation per platform, all states.
3. **Patterns** — search, filter, empty state, onboarding, destructive confirm — composed from primitives.
4. **Features** — the product's screens, composed from patterns.
5. **Shells** — navigation, windowing, theming — the container everything sits in.

Each layer imports only from layers below it.

## Module rules (enforced by `boundary-check.js`)
- One public entry per module. Everything else private.
- Declare dependencies. Maximum 4. More means the module is doing too much.
- No cycles. If A needs B and B needs A, extract C.
- A module ships with README + CONTRACT + tests. The rebuild test applies.
- Feature modules never import other feature modules. They communicate through domain modules or events.

## Adaptive by construction
- Components size from content and container, not viewport.
- Density, theme, motion, and text scale are inputs, not variants baked in.
- Platform shells are separate modules; feature modules are platform-agnostic where possible, platform-specific where the platform demands it (gesture, input).

## Naming
- Kebab-case module names: `<platform>-<thing>` for platform-specific (`ios-shell`, `web-immersive-transport`), plain for shared (`tokens`, `loop-domain`).
- Semantic token names describe role, not value: `surface.raised`, `text.secondary`, `motion.duration.fast`.

## Extension points
- New platform = new shell module + token value set. Nothing else changes.
- New feature = new feature module + IA entry + work order. Nothing else changes.
- New design system foundation = new token value set + primitive overrides. Patterns and features untouched.
