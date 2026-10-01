# Parallel Execution Protocol

## Goal

Maximise simultaneous work while guaranteeing zero write collisions and zero orphaned dependencies.

## The Producer's method

1. **Decompose by artifact, not by role.** List every artifact the job needs (screens, flows, modules, tokens, copy decks, motion specs). Each artifact becomes a candidate WO.
2. **Assign paths.** Every WO gets `owns` globs. `plan.js` refuses any plan where two WOs' `owns` overlap.
3. **Build the dependency graph.** Each WO lists `dependsOn`. `plan.js` topologically sorts and rejects cycles.
4. **Cut lanes.** A lane is a chain of WOs with the same owner or the same subsystem. Lanes run in parallel. WOs inside a lane run in order.
5. **Stub every cross-lane dependency.** If WO-007 (web-engineer) needs the token set from WO-003 (design-systems-engineer), the Producer writes a stub with the agreed shape *before* either lane starts. Lanes never wait on each other for shape — only for final values.
6. **Set a sync point per stage.** Stage gates in `AGENTS.md` are the only places where all lanes must be complete.

## Lane types

| Lane | Typical owners | Runs during |
|---|---|---|
| Research | UX Researcher, Information Architect | Stage 1 |
| Direction | Creative Director, Design Director, Graphic Designer | Stage 2 |
| Platform design | iOS / iPadOS / Web / SaaS / Editorial designers | Stage 4 |
| Domain design | Music / Creative Tools / Content Systems / Marketing designers | Stage 4 |
| Craft | Motion, UX Writer, Accessibility | Stage 4 (alongside), Stage 7 (review) |
| Architecture | Systems Architect | Stage 5 |
| Build | iOS Engineer, Web Engineer, Design Systems Engineer | Stage 6 |
| Quality | Critic, Accessibility, Verifier | Stage 7–8 |

## Collision classes and how each is prevented

| Class | Prevention |
|---|---|
| Two agents edit one file | Path ownership + claim lock |
| Two agents make contradictory decisions | Single DDM; decisions have one `owner` |
| Module A reaches into module B's internals | `boundary-check.js` rejects deep imports |
| A lane finishes against a stale stub | Stubs carry `version`; `gate.js` fails on stub/final version mismatch |
| Duplicate work | `plan.js` refuses WOs with identical `outputs` |

## Merge

Lanes never merge by hand. Each lane's outputs already live in disjoint paths; "merge" is just all gates passing at the sync point.
