# Host integration: Motif Kit SDK 1.2.5

The SDK ships the runtime, validator, baker, playhead and sequencer in `lib/kit-gl.js` (one `new Function` body, as before). The app build needs the following to expose 1.2.5. The Motif 3.2 / Motif5 app has **not** been changed yet; this is the contract.

## 1. Compile
Pass the style's `sdk` through: `rt.compile(key, { passes, common, params, inputs, sdk: st.sdk })`. Without it, 1.2.5 inputs still imply the extended prelude, but a kit that only uses the SDF helpers needs `sdk`. Reject kits when `KG.cmpVer(kit.sdk, KG.SDK_VERSION) > 0` (the validator already does).

## 2. Generated controls
`style.params` already contains the generated block controls (`gen: <inputId>`), and `style.blocks` lists them (`{ id, kind: layer|svg|text, label, group }`), `style.stack` describes a stack. Render them like any param; suggested: one collapsible card per block. Controls with `bake: true` are static: no keyframe button, rebake on change. `type: 'text'` params are text fields (the app already has one).

## 3. Textures
- svg / text inputs: `const bake = KG.createInputBaker()`; per frame `Object.assign(media, bake(style, { params, w, h, files: kit.files, families, attach: { [inputId]: userSvgText }, res }))` and pass `media` to `rt.draw`. Results are cached by content, so only edits rebake. Call `await KG.loadKitFonts(kit, files)` once per kit for bundled fonts. Bake at the export size for exports (`res` scales the bake height, 256–2048).
- Layer inputs (`layer1..3`) are ordinary media inputs: bake the attached image/video to the frame aspect as today. The runtime now supports up to 9 textures per style (units 4–12).

## 4. Video in a stack
Per frame call `KG.stackPlayheads(style, params, p, seed)` and seek each video layer to `clip * duration` (instead of the single project-time mapping). This keeps forward, backward, ping-pong and random playback frame-exact in export.

## 5. Sequencer layer
- Layer type "Sequencer" holds a `motif-seq@1` object (`KG.validateSequence` on import and edit).
- Render: `const sq = KG.createSequencer(rt, resolve)`; `sq.warm(seq)` when the layer loads; each frame `sq.render(ctx, w, h, seq, { p, L: Leff, seed, safe, pal, palettes })`. `resolve(ref, cue)` maps `"kit/style"` to `{ key, def, spec, defaults, media }` from the library (`media` for styles with inputs, baked for the cue's params).
- A Sequencer layer occupies one of the app's layer slots and runs at most `maxActive` (4) shaders at once. Budget cost with `style.cost` summed over `plan.active`.
- Photosensitive low-pass: the host's existing sub-frame blend wraps the whole sequencer render; each cue already receives its true `innerL`.
- UI: a lane timeline (0–7 lanes over one loop), drag to place and resize cues, snap to 1/16 or beats, per-cue inspector (style picker from the library, cycles, direction, fades, blend, opacity, params, chance), overlap meter against `maxActive`, and a sequence browser for kit-supplied sequences (`kit.sequences`).

## 6. Library
Show `kit.sequences` as Sequencer items; show a kit's `requires` and warn when a referenced kit is missing (`validateSequence(raw, { library })` reports unknown styles).

## Contract summary
| Host duty | API |
| --- | --- |
| Compile | `rt.compile(key, { ..., sdk })` |
| Bake vector / type | `createInputBaker()`, `loadKitFonts()` |
| Drive video layers | `stackPlayheads()`, `clipPos()` |
| Sequences | `validateSequence()`, `planSequence()`, `analyzeSequence()`, `createSequencer()` |
