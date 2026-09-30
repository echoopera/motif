# Object model

| Object | Fields | Notes |
|---|---|---|
| Style | id, name, category, blurb, params schema, render(ctx, frame) | 25 in the library; immutable |
| ParamSpec | type (range, int, select, toggle, text), label, min, max, step, default, options, mutate weight | Drives inspector, mutate, randomize, presets |
| Look (current state) | styleId, params (style), shared (palette, invert, loop, tempo, phase, seed, zoom, rotate, grain, vignette) | The thing being edited |
| History | array of Look snapshots + cursor | Unlimited within session |
| Locks | set of param keys per style | Excluded from mutate, evolve and randomize |
| Candidate | Look + label | Six per Evolve round; ephemeral |
| Saved look | name, Look, thumbnail | Per-viewer browser storage |
| Aspect | id, ratio | 16:9, 9:16, 1:1, 4:5, 4:3, 21:9 |
| Export job | format, tier, fps, loops, transparent, progress, state | One at a time |
| Preset | `motif-style-lab/preset@1` JSON of a Look + aspect | Importable and exportable |
