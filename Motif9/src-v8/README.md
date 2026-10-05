# src-v8: how Motif 8.0 is built

Motif 8.0 is the Motif 7.1.1 single-file build plus a reproducible patch set. No other source of the app is needed.

```
python3 src-v8/build/patch_v8.py src-v8/Motif-7.1.1.html Motif.html     # 68 anchored patches, fails loudly if the base changes
python3 src-v8/build/sdk_sync.py Motif.html sdk/motif-kit-sdk/lib/kit-gl.js   # regenerate the SDK engine from the build
python3 src-v8/build/gen_schemas.py schemas                              # regenerate motif-kit-4 and the project schema's Sequencer data
node tests/v8/regression.mjs                                             # 7.1.1 vs 8: kit validation and pixels of every style
```

- `Motif-7.1.1.html` is the unmodified 7.1.1 build.
- `modules/04a0-kit-v4.js` is the new engine module (prelude, generated controls, svg baker, playhead, sequences); `modules/shell-sequencer.js` is the Sequencer inspector.
- `build/patch_engine.py` (kit-gl, kit-sandbox, kits), `patch_ui.py` (style library, timeline, compositor, media playhead, inspector), `patch_meta.py` (version strings, bundled kit catalog).
- `kits-src/` are the three reference kits that are bundled into the app and shipped as `.motifkit` files.
