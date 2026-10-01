# Kit format 2 (`motif-kit@2`)

`motif-kit@2` is a superset of `motif-kit@1`. Every valid @1 kit installs unchanged: the app reads it as @2 and records the migration (see [Versioning](versioning.md)). Kits are **data and GLSL only**. Nothing in a kit is ever run as JavaScript, a kit cannot make network requests, and it cannot read or change the page.

Machine-readable schema: [`schemas/motif-kit-2.schema.json`](../../../schemas/motif-kit-2.schema.json) (JSON Schema 2020-12). The schema covers structure. The app and `motif-kit validate` add the checks a schema cannot express: referenced files exist, pass-graph ordering, and static GLSL analysis ([Sandbox](sandbox.md)).

## Package layout

```
my-kit/
  manifest.json
  common.glsl            optional, compiled into every pass of every entry
  styles/*.glsl          any folder names you like
  effects/*.glsl
  transitions/*.glsl
  README.md              optional
```

A `.motifkit` file is a zip with `manifest.json` at the root (or one folder down). A JSON bundle shaped `{ "manifest": {…}, "files": { "path": "text" } }` also works. Only `.glsl`, `.json`, `.md` and `.txt` files can be in a kit.

## manifest.json

| Field | Rules |
| --- | --- |
| `format` | `"motif-kit@2"` (or `"motif-kit@1"`, read unchanged) |
| `id`, `name`, `version` | As in @1: id `^[a-z][a-z0-9-]{1,31}$` (not `core`, `motif`, `builtin` or `all`), name ≤ 32 characters, semver version |
| `author`, `description`, `license`, `accent`, `common`, `inputs`, `palettes` | As in @1 |
| `capabilities` | **New.** The access the kit needs, shown at install for the user to approve: `"media"`, `"audio"`, `"feedback"`. See below. |
| `styles[]` | Up to 40. Same as @1, plus an optional `graph` in place of `passes`. |
| `effects[]` | **New.** Up to 24 post passes over a layer or the finished frame. See [Effects](effects.md). |
| `transitions[]` | **New.** Up to 24 two-input transitions driven by `u_progress`. See [Transitions](transitions.md). |
| `exporters[]` | **New.** Up to 16 declarative export presets. These never run code. |

A kit needs at least one style, effect, transition or exporter. Ids are unique across all four lists. The app id of an entry is `<kit>/<entry>`.

### Capabilities

| Capability | What it allows | Required when |
| --- | --- | --- |
| `media` | Sample images or video the user attaches to a layer (`inputs`) | Any entry declares or inherits `inputs` |
| `audio` | Read `u_audio[8]`: loudness 0–1 per band (sub, bass, low-mid, mid, high-mid, high, level, onset) | Any GLSL in the kit mentions `u_audio` |
| `feedback` | A pass reads the buffer it writes, or uses `iterate` > 1 | Any graph pass ping-pongs or iterates |

Using a capability without declaring it is a validation error. Declaring one you don't use gives a warning. When a user installs a kit that declares capabilities, they see a review card listing each one in plain words and choose **Install and allow** or **Cancel**. The approval is stored with the kit. Bundled kits are approved by the build. `motif-kit@1` kits get inferred capabilities (`media` when they have inputs). Kits installed before approvals existed keep their access, and the kit card says so.

There is no capability for network, DOM, storage or script access. Asking for one is an error.

### Exporters

```json
"exporters": [
  { "id": "social-loop", "name": "Social loop", "blurb": "Vertical 1080p, three loops.",
    "preset": { "format": "mp4", "aspect": "9x16", "tier": 1080, "fps": 30, "loops": 3, "quality": "high" } }
]
```

`preset` accepts only `format` (webm, mp4, png, png-seq; required), `tier` (720, 1080, 1440, 2160), `fps` (24, 25, 30, 50, 60), `loops` (1–8), `quality` (standard, high, max), `aspect` (16x9, 9x16, 1x1, 4x5, 4x3, 21x9), `transparent` and `withAudio`. Any other key, or any other value, is a validation error. An exporter entry holds only `id`, `name`, `blurb`, `group`, `tags` and `preset`.

## Pass graphs

A style, effect or transition can use `passes` (the @1 linear list, where pass *n* reads earlier passes as `u_buf0..3`) or a `graph`:

```json
"graph": {
  "buffers": { "bright": { "scale": 0.5 }, "blur": { "scale": 0.25 } },
  "passes": [
    { "src": "effects/bright.glsl", "reads": ["input"],          "writes": "bright" },
    { "src": "effects/blur.glsl",   "reads": ["bright", "blur"], "writes": "blur", "iterate": 4 },
    { "src": "effects/mix.glsl",    "reads": ["input", "blur"] }
  ]
}
```

| Field | Rules |
| --- | --- |
| `buffers` | Up to 8 named render targets, camelCase (max 16 characters). `scale` is 0.125–1 of the output size (half-float when the GPU supports it). The names `input`, `from`, `to` and `output` are reserved. |
| `passes[]` | 1–8 passes, run in order |
| `passes[].reads` | Up to 6 names. A name can be an external input (`input` for effects, `from` and `to` for transitions), a buffer an earlier pass wrote, or the pass's own `writes` buffer (feedback). |
| `passes[].writes` | A declared buffer, or `"output"`. Each buffer is written by exactly one pass. Only the last pass writes `output`, and it is the default for the last pass. |
| `passes[].iterate` | 1–16. The pass runs this many times. When it reads its own buffer it ping-pongs between two targets, so each run reads the previous one. |

Limits: at most 32 pass executions per frame (the sum of `iterate`). Feedback lives **within one frame**. Every frame starts from cleared buffers: the first read of a feedback buffer returns transparent black, and nothing carries over between frames. That keeps exports deterministic and loops seamless, the same contract as `motif-kit@1`. To simulate, seed with `u_iter == 0` and evolve over the iterations.

### Runtime declarations per pass

On top of the [prelude](../README.md#writing-a-pass), params and media inputs, a graph pass gets:

```glsl
uniform sampler2D g_<name>;            // for each name in reads
vec4 g_<name>At(vec2 q);               // sample at frame-normalised q (0..1)
vec4 g_<name>Px(vec2 fc);              // sample at this pass's pixel coordinates
uniform int u_iter;                    // 0 .. u_iters-1 for iterated passes
uniform int u_iters;
uniform float u_progress;              // transitions only: 0 = from, 1 = to
uniform float u_audio[8];              // only with the "audio" capability
float audioBand(int b);
```

Buffers hold premultiplied **linear** RGBA. `input`, `from` and `to` are the host's canvases, decoded to linear premultiplied. The output pass returns premultiplied linear RGBA like any style; the runtime converts it to sRGB and dithers it.

`motif-kit prelude` prints all of these declarations.

## Reference kit

`examples/lumen-fx` has a graph style with bounded feedback (Ink Diffusion), a three-pass bloom effect, an iris transition and an export preset. Try `motif-kit validate examples/lumen-fx`, `motif-kit preview examples/lumen-fx` and `motif-kit bench examples/lumen-fx`.
