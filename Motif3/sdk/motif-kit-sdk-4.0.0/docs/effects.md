# Effects

An effect is a post pass, or a [pass graph](kit-format-2.md#pass-graphs), over a picture the host already rendered: one layer, or the finished frame. It reads that picture as the external input `input`.

```json
"effects": [{
  "id": "bloom", "name": "Bloom", "target": "any", "cost": 1.2,
  "params": { "threshold": { "type": "range", "label": "Threshold", "min": 0, "max": 1, "def": 0.55 } },
  "graph": { "buffers": { "bright": { "scale": 0.5 } },
             "passes": [ { "src": "effects/bright.glsl", "reads": ["input"], "writes": "bright" },
                         { "src": "effects/mix.glsl",    "reads": ["input", "bright"] } ] }
}]
```

| Field | Rules |
| --- | --- |
| `target` | `layer`, `finish` or `any` (default). Where the host offers the effect. |
| `passes` or `graph` | With `passes` (up to 4, the @1 linear form), every pass reads `input` and all earlier passes. With `graph`, list `input` in `reads` where you need it. |
| `params`, `inputs`, `cost`, `flash`, `blurb`, `group`, `tags` | As for styles |

```glsl
// effects/mix.glsl
vec4 motif(vec2 uv, vec2 fc) {
  vec4 base = g_inputPx(fc);                    // premultiplied linear
  vec4 glow = g_brightAt(fc / u_res) * 0.8;
  return vec4(base.rgb + glow.rgb, max(base.a, glow.a));
}
```

Keep transparent areas transparent (return `base.a`) so an effect on a layer composites correctly. Time, palette, seed and the photosensitive helpers work exactly as in styles.

## Host API (engine side)

```js
__m_kit_host.effects()                                   // installed, enabled effects
__m_kit_host.applyEffect('lumen-fx/bloom', ctx, sourceCanvas, { w, h, p, L, seed, pal, params })
// → 'ok' | 'pending' (shader still compiling in the background) | an error string ('quarantined · …')
```

The source canvas is uploaded once per call, and the result is drawn into `ctx` at w×h. Effects go through the same background compile, canary and [quarantine](sandbox.md) as styles.

**Status in Motif 5.2:** the engine API, validation, runtime and tests are complete. Adding effects to the layer and finish stacks in the editor UI is an integration step for the timeline and renderer modules (see the programme integration notes).
