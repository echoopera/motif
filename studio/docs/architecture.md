# Modular engineering
Organize capabilities such as library, canvas, sequencer and schedule separately from shells and foundations. Start with a modular monolith if one deployable suffices. Split services for measured needs; directories alone do not prevent coupling.

| Layer | Owns | Dependencies | Excludes |
| --- | --- | --- | --- |
| Contracts | Shapes, commands, errors, versions | Neutral types | Frameworks, storage |
| Domain | Transitions, validation, rules | Contracts | DOM, native views, I/O |
| Capability | Use cases and local state | Domain, injected ports | Other capability internals |
| UI | Controls/views | Public APIs, tokens | Database and authorization truth |
| Adapters | Storage, network, audio, GPU, files | Ports/contracts | Product layout |
| Shell | Routing, wiring, lifecycle | Public exports | Copied feature internals |

Every module has owner, public entry, state authority, dependencies, fixtures, errors and isolation/consumer tests. Enforce private-import/cycle rules with stack-appropriate tooling. Avoid global-store or utils dumping grounds.

## Contract lifecycle
Define commands, queries, ordered events, errors, loading, cancellation, retries, persistence, schema version and migration. Document wire formats and stale-version behavior. Reconcile optimistic UI with authoritative state. Define collaboration conflicts before adding presence.

Prefer additive changes. Breaking APIs require ADR, consumer inventory and migration tests. Validate untrusted boundaries. Version documents and provide migration fixtures plus recovery for destructive changes.

## Design system
Primitive → semantic → component tokens; include appearance, focus, disabled/error and reduced motion. Share intent and names while adapting native navigation/materials. Components need deliberate variants, specimen states, content bounds, layout behavior and implementation status. Token changes require consumer review. CSS/native exports do not guarantee pixel parity.

## Platforms and domains
Native: choose SwiftUI/UIKit integration from requirements, record minimum OS/fallback, isolate document/services logic from views, and verify in an Apple environment. Shared schemas do not make JavaScript portable Swift.

Web: use semantic controls. Canvas/GPU work requires accessible control alternatives, cleanup, pointer cancellation, touch/keyboard routes and offline limits. Move measured heavy work away from interaction paths.

Music: separate engine timing from UI refresh; use bounded commands with units/ranges. Measure latency/dropouts on hardware. AudioWorklet/WASM/native choices need evidence. UI design does not prove DSP correctness.

Art: separate document, viewport, selection and render caches. Define undo, asset lifetime, color/export and autosave recovery.

SaaS/editorial: isolate identity, tenant context, authorization, rights and billing from presentation. Hidden controls do not enforce server authorization. Define audit and partial-failure behavior.

## Scaling
Set budgets for the specific journey/device. Measure latency, layout stability, long-session memory, network and startup. Budgets remain hypotheses until validated. Bound data/GPU resources; test repeated open/close and teardown.

The scaffold demonstrates public contracts, pure selection rules, injected in-memory storage and composition. It is not a designed UI, backend, native app or audio engine. Choose a real framework after the brief. Extension path: contract → domain → adapter → view composition → isolated tests → integration journey. Consumers use public exports; remove features through composition.
