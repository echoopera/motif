---
name: module-scaffold
description: Create and contract an isolated module. Used by systems-architect; read by engineers.
---
# Module Scaffold
1. Pick the layer (tokens / primitives / patterns / domain / features / shells) and name (`<platform>-<thing>` or shared).
2. `node harness/scripts/scaffold.js module <name> --kind <kind> --platform <p> --owner <engineer>`.
3. Fill `CONTRACT.md` completely before any engineer starts: exports, events, tokens consumed, invariants.
4. Set `dependsOn` (≤ 4, lower layers only, no feature→feature). Add to `modules/graph.json`.
5. `node harness/scripts/boundary-check.js` green.
6. README extension notes: how to add a platform / feature / foundation without touching this module.
