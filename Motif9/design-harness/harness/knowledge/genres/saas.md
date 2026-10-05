# SaaS Products — Domain Intelligence

## Users
Admins (configure, invite, bill), operators (daily task work), viewers (reporting), and the buyer who evaluates in a trial. Multi-tenant: every screen may be seen by an org of 1 or 10,000.

## Core objects
Workspace/org, member, role, project/object-of-work, record, view, filter, automation, integration, plan/billing, audit event.

## Principles
- Time-to-value in the first session: the empty state does the onboarding.
- Density with calm: information-rich, never noisy; hierarchy through type and space, not boxes.
- Keyboard-first: command palette, shortcuts, arrow navigation in tables.
- Trust surfaces: audit log, permissions visible, status page in-app, clear billing.
- Every list is a view: filter, sort, group, save, share.

## Patterns
| Need | Pattern |
|---|---|
| Shell | Top bar + collapsible left nav + page header (title, breadcrumb, primary action) |
| Records | Table ⇄ board ⇄ calendar ⇄ timeline views over the same data |
| Detail | Side peek first, full page on demand; activity feed; related records |
| Create | Quick create (inline/modal) + full form; templates |
| Settings | Left-nav settings with search; danger zone at the bottom |
| Empty | Illustrated, one action, one example |
| Upgrade | Contextual, at the moment of value, never blocking work already in progress |

## Scale behaviours
Row counts to millions (server-side filter, virtual scroll), org sizes to thousands (role search, groups), notification volume (digest, grouping, per-object mute).

## Visual language
Neutral base, single accent, semantic status colours. Product personality in the illustrations and micro-copy, not the chrome.

## HALT
Onboarding tour that blocks · Destructive action without object-name confirm · Hidden permission gating · Upgrade prompt interrupting a task.
