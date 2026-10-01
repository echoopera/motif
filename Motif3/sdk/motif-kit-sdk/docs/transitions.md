# Transitions

A transition blends two pictures, `from` and `to`, as `u_progress` runs from 0 to 1.

```json
"transitions": [{
  "id": "iris", "name": "Iris", "duration": 1.2,
  "params": { "soft": { "type": "range", "label": "Softness", "min": 0, "max": 0.3, "def": 0.06 } },
  "passes": [{ "src": "transitions/iris.glsl" }]
}]
```

| Field | Rules |
| --- | --- |
| `duration` | Suggested length in seconds, 0.1–10 (default 1). The host decides the actual length. |
| `passes` or `graph` | Linear passes read `from`, `to` and all earlier passes. In a graph, list `from` and `to` in `reads`. |
| `params`, `cost`, `flash`, `blurb`, `group`, `tags` | As for styles |

```glsl
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec4 a = g_fromAt(q), b = g_toAt(q);
  float e = 1.0 - smoothstep(u_progress * 0.8 - p_soft - 0.001, u_progress * 0.8, length(uv));
  return mix(a, b, e);
}
```

Rules:

- `u_progress == 0` must show `from` and `u_progress == 1` must show `to`. The browser test suite checks this for the reference kit, and `motif-kit preview` renders progress 0, 0.25, 0.5 and 0.75.
- `smoothstep` needs `edge0 < edge1`. Reversed edges are undefined in GLSL, and some drivers draw them as hard bands.
- `u_p` still runs, so a transition can animate texture while it progresses.

## Host API (engine side)

```js
__m_kit_host.transitions()
__m_kit_host.renderTransition('lumen-fx/iris', ctx, fromCanvas, toCanvas, progress, { w, h, p, L, seed, pal, params })
// → 'ok' | 'pending' | an error string
```

**Status in Motif 5.2:** the engine API, validation, runtime and tests are complete. Placing transitions between scenes needs a scene timeline, which the editor does not have yet. That is an integration step for the timeline and renderer modules.
