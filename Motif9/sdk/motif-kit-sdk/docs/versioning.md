# Versioning, compatibility and deprecation

## Versioning policy

There are three versioned things. Each has its own number.

| Thing | Identifier | Lives in | Bumps when |
| --- | --- | --- | --- |
| Kit format | `format: "motif-kit@N"` | each manifest | A kit written for the new format could be misread by an older app (new required semantics). Additive, ignorable fields do not bump it. |
| Your kit | `version: "x.y.z"` (semver) | each manifest | You decide. Installing the same id replaces the installed version, which is kept for one-step rollback. |
| Project document | `format: "motif-style-lab/preset@N"` | saved projects and presets | The project shape changes incompatibly. [`schemas/motif-project.schema.json`](../../../schemas/motif-project.schema.json) is generated from the code. |

Rules the app follows:

1. **Read old, write current.** The app reads every format in the compatibility table and migrates on load. It never writes an older format.
2. **Migrations are recorded.** A migrated kit carries `migration: { from, to, steps[] }`, shown on its card and in `motif-kit validate`. `motif-kit migrate` rewrites a manifest in the new format with the same result.
3. **Additive first.** New optional fields (a new param option, a new capability) land in the current format. Unknown fields in a style, effect or transition are ignored, so a kit can carry fields for newer apps. Exporters are strict: an unknown key there is an error, because presets must never become a code channel.
4. **Limits can tighten only with a release note.** Sandbox limits (loop bounds, fetch budgets) are part of the contract. Every bundled kit stays at or under half of every hard limit, and tightening a limit is a breaking change for kits that sit near it.
5. **Kits are re-validated on every load.** Saved third-party kits are checked again against the running app's rules, so a kit that a later app version rejects stops loading. The browser console says why, and the user can reinstall a fixed version.

## Compatibility table

| Kit format | App | Read as | Notes |
| --- | --- | --- | --- |
| `motif-kit@1` (SDK 1.0) | Motif 3.x–5.1 | — | Styles only. `uniform sampler2D u_<name>;` declared in GLSL becomes an implicit media input. |
| `motif-kit@1` (SDK 1.1–1.2) | Motif 3.2–5.1 | — | Media `inputs`, custom params (colour, point, groups, `show`, `log`, `randMax`) |
| `motif-kit@1` (any SDK) | **Motif 5.2+** | `motif-kit@2` | Unchanged styles, params and shaders. Capabilities inferred (`media` when there are inputs). Static GLSL analysis now applies. |
| `motif-kit@2` (SDK 2.0) | **Motif 5.2+** | `motif-kit@2` | Adds `capabilities`, `effects`, `transitions`, `exporters`, pass `graph` |
| `motif-kit@2` | Motif ≤ 5.1 | rejected | Older apps reject the format string. Ship a separate @1 build if you need them. |
| `motif-kit@3` (SDK 3.0) | **Motif 7.0+** | `motif-kit@3` | `motif-kit@2` plus `text` inputs (1–3 editable lines in one host-built atlas) and the `text` capability. See [Text inputs](text-inputs.md). |
| `motif-kit@4` (SDK 4.0) | **Motif 8.0+** | `motif-kit@4` | `motif-kit@3` plus layer stacks, svg inputs, text distance fields (`"sdf": true`), the vector / playhead / cue GLSL toolkit, sequences and the `vector` capability. See [motif-kit@4](kit-format-4.md). |
| `motif-kit@4` | Motif ≤ 7.1 | rejected | They reject the format string: `format must be "motif-kit@1", "motif-kit@2" or "motif-kit@3" (got "motif-kit@4")`. Keep an @3 build for them. |
| `motif-kit@3` | Motif 5.2–7.0 before text inputs, SDK ≤ 2.0 | rejected | They reject the format string: `format must be "motif-kit@1" or "motif-kit@2" (got "motif-kit@3")`. Keep an @2 build (for example with a media plate) for them. |

| Project format | App | Migration |
| --- | --- | --- |
| `motif-style-lab/preset@1` | read by all | `timeline.fromV1()` builds a one-layer @2 project. `shared.loop`, `grain` and `vignette` move to `finish`. |
| `motif-style-lab/preset@2` | current | `sanitizeProject()` drops unknown fields, fills defaults, clamps ranges and caps lists (4 layers, 24 custom palettes, 16 audio maps). Motif 8 adds an optional `seq` (cue list) on layers whose `styleId` is `sequencer`; projects without it, and Motif 7 projects, open unchanged. Motif 7 cannot open a project that uses a Sequencer layer (it falls back to the first style). |

## Migrating to motif-kit@4

Nothing to migrate: Motif 8 reads `@1`, `@2` and `@3` exactly as before (the validator output and static-analysis report of every bundled kit are byte-identical to Motif 7.1.1, and all built-in styles render the same pixels). Move a kit to `@4` only to use stacks, svg inputs, text distance fields or sequences: set `"format": "motif-kit@4"`, add `"vector"` to `capabilities` for svg inputs, and read [motif-kit@4](kit-format-4.md). The new GLSL names exist only in `@4` styles.

## Migrating to motif-kit@3

Nothing to migrate for existing kits: Motif 7 keeps reading @1 and @2 manifests exactly as before (same normalized styles, same shaders, same pixels; the identity tests in `tests/sandbox.test.mjs` and `tests/browser/kits.browser.mjs` guard it). Move a kit to @3 only to use text inputs:

1. Set `"format": "motif-kit@3"` and add `"text"` to `capabilities` (drop `"media"` if a text input replaces the only media input).
2. Replace an image "type plate" input with `{ "id": "...", "type": "text", "lines": [...] }`.
3. Sample with `textLine_<id>(i, q)` (line-local coordinates) instead of the plate's bands, and apply each line's transform once.

FaceType 1.2.0 → 1.3.0 is the worked example (`kits/source/facetype/README.md`). Projects keep every parameter; the text is typed again, since a plate's pixels can't become text.

## Deprecation rules

- A feature is **deprecated** for at least one minor release before removal. `motif-kit validate` and the kit card show a warning that names the replacement.
- **Removal needs a migration.** The app keeps reading the old form and translating it (like implicit media inputs from SDK 1.0), or bumps the kit format so older kits are migrated, never silently misread.
- **Security fixes are the exception.** If a construct turns out to let a kit hang or crash the app, the sandbox may reject it immediately. The rejection message names the safe rewrite (see [Sandbox](sandbox.md)).
- Currently deprecated: declaring `uniform sampler2D u_<name>;` yourself (SDK 1.0 style). Declare `inputs` instead. It still works and warns.
