# Content Management & Editorial Tooling — Domain Intelligence

## Users
Writers, editors, producers, publishers, marketers, translators, moderators, developers integrating content. Their day is queues, drafts, reviews and deadlines.

## Core objects
Entry/document, content type (schema), field, asset, taxonomy, workflow state, version, locale, publication target, user role.

## Principles
- Writing is the job; the tool disappears while writing.
- Structure is visible but not in the way: schema-driven fields, but the editor feels like a page.
- Preview is truth: what the editor sees is what publishes, per target.
- Workflow is a board and a status, never a hidden setting.
- Every change is attributable and reversible.

## Patterns
| Need | Pattern |
|---|---|
| Editing | Block editor with slash insert, inline formatting toolbar on selection, side-by-side or overlay preview |
| Structure | Content-type builder with field types, validation, relations; live schema preview |
| Queues | Board by workflow state + table by deadline; filters saved per role |
| Review | Comments anchored to blocks, suggestions mode, approve/request changes, diff between versions |
| Assets | Grid with focal-point crop, metadata, usage count, replace-everywhere |
| Localisation | Locale switcher per entry, translation status matrix, side-by-side source/target |
| Publishing | Schedule, targets, preview per target, rollback |

## Scale behaviours
Thousands of entries: virtual lists, saved views, bulk operations with dry-run and partial-failure report. Many roles: permission-aware UI (disabled with reason). Many locales: never duplicate UI per locale.

## Visual language
Editorial typography in the editor (real fonts, real measure); utilitarian, dense chrome around it. Calm palette; status colours reserved for workflow.

## HALT
Preview drifts from output · Unsaved work lost on navigation · Bulk action without dry-run · Permission-hidden features (should be disabled with reason).
