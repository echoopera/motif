# Cross-platform design-system standard

## Purpose

A design system is the product's reusable decision infrastructure, not a component gallery. It should make correct, coherent implementation easier while preserving platform-native behavior.

## Five layers

| Layer | Contains | Rule |
|---|---|---|
| Foundations | Raw color, type, spacing, radius, elevation, motion and grid values | Implementation detail; never used directly by feature code when a semantic token exists |
| Semantic tokens | Meaning such as surface, text, action, warning, focus, timing and density | Stable names; values vary by theme, platform, contrast and context |
| Components | Controls and containers with behavior, anatomy and state | Consume semantic tokens only; expose intentional variants |
| Patterns | Reusable task assemblies such as search, filter, edit, approval, upload and recovery | Defined by journey and state contract, not screenshot resemblance |
| Platform adapters | Navigation, material, input, sizing and system integration per platform | Share intent; adapt convention and ergonomics |

## Required system contract

Every system engagement defines:

- principles and intended product character;
- token taxonomy, themes, density and contrast modes;
- typography roles and content bounds;
- component inventory with owner, maturity and platform status;
- default, hover/pointer, focus, pressed, selected, disabled, loading, empty, error and success behavior as applicable;
- responsive/adaptive rules including safe areas, window resizing, zoom/reflow and text scaling;
- motion tokens plus reduced-motion behavior;
- accessibility semantics, names, order, alternatives and target sizes;
- content rules, localization expansion and RTL behavior where relevant;
- version, deprecation, migration, contribution and review policy;
- test fixtures and evidence for adoption.

## Platform relationship

Do not force identical pixels across iOS, iPadOS, macOS and web. Keep names, hierarchy, brand grammar and intent coherent while allowing platform-specific navigation, controls, density, materials, commands and input.

A shared component exists only when its conceptual contract is shared. Its native and web implementations may differ.

## Component definition of done

A component is not system-ready until it has:

1. purpose and non-goals;
2. anatomy and semantic tokens;
3. variants and content limits;
4. interaction, focus and keyboard behavior;
5. complete applicable states;
6. responsive/adaptive rules;
7. accessibility contract;
8. code and design maturity status;
9. visual/behavior fixtures;
10. owner, version and migration notes.

## Governance

- One owner accepts changes to shared tokens and components.
- New requests first attempt composition from existing primitives.
- Additions require at least two credible consumers or a documented product-critical exception.
- Breaking token or API changes require a version bump, consumer inventory, migration and regression evidence.
- Deprecation includes replacement guidance and a removal window.
- Track adoption, exceptions, defects and time-to-implement; component count alone is not success.
- Keep the system lean. Prefer a small complete set over a large inconsistent catalog.

## Design-to-code contract

For every implemented pattern, connect the design name, semantic tokens, component API, platform implementations, test fixture and documentation entry. Generated code is reviewed against public contracts and actual behavior; design metadata does not guarantee production parity.

