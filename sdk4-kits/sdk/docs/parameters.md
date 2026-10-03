# Parameters

Parameters work the same way for styles, effects and transitions. Each entry has up to 32 parameters, and at most 48 uniforms once colour and point parameters are expanded. Every parameter can be keyframed, locked, mutated and mapped to audio bands in Motif with no extra work.

Keys are camelCase (`glowAmount`, max 24 characters). `palette`, `invert`, `tempo`, `phase`, `seed`, `zoom`, `rotate` and `loop` are reserved because every layer already has them. `__proto__`, `constructor` and `prototype` are rejected anywhere in a manifest.

| type | JSON | GLSL |
| --- | --- | --- |
| `range` | `{ "type": "range", "label": "Glow", "min": 0, "max": 2, "def": 1, "step": 0.01, "unit": "×" }` | `uniform float p_glow;` |
| `int` | `{ "type": "int", "label": "Rings", "min": 1, "max": 12, "def": 5 }` | `uniform int p_rings;` |
| `toggle` | `{ "type": "toggle", "label": "Trails", "def": true }` | `uniform bool p_trails;` |
| `select` | `{ "type": "select", "label": "Mode", "options": ["rings", "dots"], "def": "rings" }` | `uniform int p_mode;` and `#define MODE_RINGS 0`, `#define MODE_DOTS 1` |
| `color` | `{ "type": "color", "label": "Tint", "def": "#F0A23B" }` | `p_tintR/G/B` (sRGB 0–1), `vec3 c_tint()` (linear), `vec3 s_tint()` (sRGB) |
| `point` | `{ "type": "point", "label": "Origin", "min": -0.5, "max": 0.5, "def": [0, 0] }` | `p_originX/Y`, `vec2 v_origin()` |

Every type also accepts these optional fields:

| Field | Effect |
| --- | --- |
| `group` | Inspector section name (max 20 characters) |
| `hint` | Tooltip (max 90 characters) |
| `show` | Show the control only when another control matches: `{ "param": "mode", "is": "ripple" }`, `"not"`, `"gt"`, `"lt"` |
| `mutate` | 0–1, how far Mutate and Evolve move the value. `0` locks it. |
| `log` | `range` with `min > 0` only: logarithmic slider |
| `randMax` | `range` and `int` only: caps Randomize below `max` |

## Parameters and loop bounds

The [sandbox](sandbox.md) uses an `int` or `range` parameter's declared `max` to bound loops. `for (int i = 0; i < p_count; i++)` is accepted when `p_count`'s `max` is within the loop limit (4096 iterations per loop), and the cost estimate uses that `max`. The host clamps every parameter value to its declared range before it reaches the shader, so the bound holds. The idiom with a constant bound and an early `break` also works:

```glsl
for (int i = 0; i < 64; i++) { if (i >= p_count) break; … }
```

Bounds that depend on a function argument (`float fbm(vec2 p, int oct) { for (int i = 0; i < oct; i++) … }`) cannot be proven and are rejected. Use a constant bound with `break`.

## Effects and transitions

Effect and transition parameters behave like style parameters. Hosts pass the values in `S.params`, and missing values take the defaults. Fewer than 4 parameters is fine here: the "fewer than 4 params" warning only applies to styles, because they feed Mutate and Evolve.
