# src-v9: how Motif 9.0 is built

Motif 9.0 is the Motif 8.0.0 single-file build plus a reproducible patch set. No other source of the app is needed.

```
python3 src-v9/build/patch_v9.py src-v9/Motif-8.0.0.html Motif.html     # 34 anchored patches, fails loudly if the base changes
python3 src-v9/build/gen_schemas.py schemas                              # motif-graph-1 + graph on the project schema (needs node)
node tests/v9/gen-docs.mjs                                               # docs/MotifGraph-nodes.md from the registry
node --test tests/v9/unit.test.mjs                                       # engine contracts
node tests/v9/regression.mjs                                             # 8.0.0 vs 9: pixels and kit validation  (needs fflate: npm i in sdk/motif-kit-sdk)
node tests/v9/browser.mjs                                                # MotifGraph end to end (Playwright)
```

- `Motif-8.0.0.html` is the unmodified 8.0.0 build.
- `modules/graph-engine.js`: the engine module (node registry and schemas, sanitize, CPU reference evaluator, GLSL, renderer, presets). Engine side: no DOM beyond a canvas, runs in the render Worker.
- `modules/shell-graph.js`: the inspector page (an extension module like the Grade page).
- `build/patch_engine.py` (timeline paths, compositor layer and composite hooks, pipeline post-finish hook), `patch_ui.py` (shell rows, duplicate layer, page), `patch_meta.py` (version strings).

## Adding a node
One entry in `TYPES` in `graph-engine.js` (id, name, parameter subset from the kind's layout) and, for a new behavior, the same branch in the CPU reference and in the GLSL (`fraw`, `effectors`, `deform`). `tests/v9/browser.mjs` then checks GPU against CPU for it; add it to the case lists there. Type ids are saved in projects: never renumber, only append.
