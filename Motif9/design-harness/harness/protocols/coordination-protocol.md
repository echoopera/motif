# Coordination Protocol

How 27 agents work on one product without stepping on each other.

## Core idea

Ownership is a **path**, not a topic. Two agents never own the same path at the same time. Everything else follows from that.

## Objects

| Object | Where | Purpose |
|---|---|---|
| Work order | `harness/state/work-orders/WO-###.json` | A unit of work with an owner, `owns` globs, `reads` globs, inputs, outputs, acceptance |
| Claim | `harness/state/claims/WO-###.lock` | Proof that the owner has started; prevents a second owner |
| DDM | `harness/state/ddm/<project>.json` | Design Decision Model: every decision, its rationale, its alternatives, its status |
| Review | `harness/state/reviews/WO-###.md` | Critique / accessibility / verification output |
| Correction | `harness/state/corrections/*.jsonl` | Human or reviewer corrections, appended, later promoted to rules |

## Rules

1. **Claim before write.** `node harness/scripts/claim.js claim WO-012 saas-product-designer`. The script refuses if the WO is claimed by someone else or if its `owns` globs overlap an active claim.
2. **Write only inside `owns`.** Reading is unrestricted. Writing outside `owns` is a boundary violation and fails `gate.js`.
3. **Shared files are owned by exactly one agent.** `modules/*/module.json` → Systems Architect. Tokens → Design Systems Engineer. DDM decisions → the agent named in the decision's `owner` field; others append only.
4. **Interfaces are contracts.** When lane A needs something from lane B, A writes a `needs` entry in its work order; the Producer creates a stub in B's lane with the agreed interface. Both lanes proceed against the stub.
5. **Release on finish.** `claim.js release`. Unreleased claims older than the WO's `ttlMinutes` are flagged by the Producer.
6. **No side conversations.** Cross-lane decisions are DDM entries, not messages.

## Escalation

- Overlap detected at planning → Producer splits the WO.
- Overlap detected at runtime → claim refused; second agent files a `blocked` note on its WO; Producer resolves.
- Taste conflict → Design Director. Structure conflict → Systems Architect. Still unresolved → Studio Director, logged with the losing argument preserved.

## Work order lifecycle

`draft → ready → claimed → in-review → done | blocked | cancelled`

Only the Producer moves a WO into `ready`. Only the owner moves it to `in-review`. Only the Verifier moves it to `done`.
