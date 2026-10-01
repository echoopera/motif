# Parallel coordination
The coordinator plans; assigned agents execute; the integrator accepts changes. Enforcement needs isolated worktrees or scoped-write runtime support. A JSON plan is not a lock service.

## Contract
Each task has ID, agent, outcome, input versions, dependencies, write prefixes, exclusive resources, contract version, baseline, acceptance, evidence, budget and handoff.

Paths are relative directory prefixes or exact files; no globs, absolute paths, escaping symlinks or parent traversal. Named resources cover tokens, shared copy, asset catalogs, database migrations, ports and external state. Read immutable baselines. Producers/consumers overlap only against frozen interfaces and fixtures.

## Dispatch
States: queued → ready → running → review → accepted.
Running may become blocked/failed; review may become rework → ready; nonaccepted tasks can be cancelled. Dependencies are satisfied only after acceptance.

One coordinator writes the ledger. Validate graph, select ready work, check active conflicts, reserve all resources in one serialized update, then dispatch. Record run ID, owner, baseline, worktree, start and heartbeat. Use one process unless the runtime supports atomic multi-coordinator reservations.

Results list changed files/versions, decisions, observed checks, risks and requested next state. Review actual scope before acceptance, including assets/documents.

## Isolation and integration
Create one branch/worktree per implementation task at its baseline. Worktrees do not isolate databases, caches, ports, servers or third-party actions; allocate those separately. Shared manifests, lockfiles, migrations, registrations, exports, tokens and copy have one writer per phase. Other specialists submit proposals in owned files.

1. Verify scope, interface versions and evidence.
2. Compare baseline with current integration revision; replay/rebase in isolation, resolving semantic conflicts with owners.
3. Integrator applies review-approved output, checks affected modules/consumers and exercises changed journeys. Review approval is not task acceptance.
4. Record the resulting baseline/hashes, then transition the task to accepted. Only now may downstream tasks use it. Release reservations after acceptance or safe termination.

For a documentation/design-only task, acceptance follows validated artifact integration into the agreed artifact store and recorded version. A final integration task checks the assembled product; per-task integration remains necessary before dependent dispatch.

For a shared interface change: pause affected tasks, propose change, identify consumers, choose compatibility/migration, accept a version, update fixtures, then resume. No silent cross-module patching.

## Recovery
Choose bounded leases/heartbeats for the runtime. A missed heartbeat marks work suspect; it does not authorize another writer. Terminate or establish worker termination before reassigning. If uncertain, quarantine output and create an isolated replacement with no external shared mutations.

Retry only with a changed input or recovery step; cap automatic retries at two. Preserve timed-out artifacts as incomplete. Distinguish attempts by run ID and use supported idempotency for external effects. Acquire all resources together to prevent hold-and-wait deadlock. Reject cycles; extract contract/fixture tasks to break them.

Resolve review disagreement with scenario evidence and the owning decision maker. Coordinator handles priority tradeoffs and budget overruns.

## Planner limits
The supplied planner validates IDs, references, cycles, paths and concurrency; emits conservative noncolliding waves. It assumes acceptance only for planning. Live dispatch must inspect actual acceptance and active leases. It does not inspect symlinks, source imports, enforce writes, launch models, merge Git or certify isolation.

## Relationship and operational ownership
Client Partnership Lead writes only reserved client-understanding artifacts. Coordinator alone writes task and commitment ledgers. Specialists propose updates through their owned handoffs. No parallel writers to either ledger. Client-facing recommendations are not promises until feasibility and existing authorization are established. Relationship reviews never bypass task integration or acceptance rules.
