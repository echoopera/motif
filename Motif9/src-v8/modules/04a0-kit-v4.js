// ---- module: kit-v4 v1.0.0 (motif-kit@4: vector toolkit, layer stacks, svg inputs, playhead, sequences)
const __m_kit_v4 = (() => {
// kit-v4 — everything motif-kit@4 adds, kept apart from kit-gl so @1–@3 kits compile byte-for-byte as before. Pure (no DOM at
// load; the svg baker draws on OffscreenCanvas, so the render Worker and the page produce the same pixels).
//   · PRELUDE_V4      GLSL appended ONLY for @4 kits: blend modes, playhead (speed + direction), cues, layer sampling, vector shapes.
//   · blockParams     generated controls for layer stacks and svg inputs (ordinary channels: keys, locks, Mutate, audio, presets).
//   · blockSource     generated GLSL: L_stack / L_get<i> for layers, vec_<id> for svg inputs.
//   · playhead        the JS twin of M_playheadAt (tested against the shader), used to drive video layers and sequences.
//   · svg baker       svg input -> signed-distance texture (path, rect, circle, ellipse, line, polyline, polygon, g, transform).
//   · sequences       motif-seq@1: validate, plan, analyze. A sequence is data; the compositor renders its plan.
const KG = __m_kit_gl;
const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'softlight', 'hardlight', 'add', 'darken', 'lighten', 'difference', 'exclusion', 'dodge'];
const BLEND_LABELS = ['Normal', 'Multiply', 'Screen', 'Overlay', 'Soft light', 'Hard light', 'Add', 'Darken', 'Lighten', 'Difference', 'Exclusion', 'Colour dodge'];
const PLAY_MODES = ['forward', 'backward', 'pingpong', 'random'];
const PLAY_LABELS = ['Forward', 'Backward', 'Ping-pong', 'Random'];
const EDGE_MODES = ['clip', 'repeat', 'mirror', 'extend'];
const EDGE_LABELS = ['Clip', 'Repeat', 'Mirror', 'Extend'];
const BLEND_CANVAS = { normal: 'source-over', multiply: 'multiply', screen: 'screen', overlay: 'overlay', softlight: 'soft-light', hardlight: 'hard-light', add: 'lighter', darken: 'darken', lighten: 'lighten', difference: 'difference', exclusion: 'exclusion', dodge: 'color-dodge' };
const LIMITS = { layers: 3, svg: 2, svgBytes: 64 * 1024, svgShapes: 2000, samplers: 9, uniforms: 128, bakeMin: 256, bakeMax: 1024 };
const SEQ = { format: 'motif-seq@1', cues: 64, active: 4, lanes: 8, repeat: 16, cycles: 8, params: 64, sequences: 8 };
const ID_RE = /^[a-z][a-z0-9-]{1,31}$/;

// ---------------------------------------------------------------------------------------------------------------
// GLSL. Only @4 kits see these names. ASCII only (the sandbox lexer and GLSL ES 3.00 accept nothing else).
const PRELUDE_V4 = `
// ================= motif-kit@4 =================
#define BM_NORMAL 0
#define BM_MULTIPLY 1
#define BM_SCREEN 2
#define BM_OVERLAY 3
#define BM_SOFTLIGHT 4
#define BM_HARDLIGHT 5
#define BM_ADD 6
#define BM_DARKEN 7
#define BM_LIGHTEN 8
#define BM_DIFFERENCE 9
#define BM_EXCLUSION 10
#define BM_DODGE 11
#define PM_FORWARD 0
#define PM_BACKWARD 1
#define PM_PINGPONG 2
#define PM_RANDOM 3
#define EM_CLIP 0
#define EM_REPEAT 1
#define EM_MIRROR 2
#define EM_EXTEND 3

vec3 M_toS(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 M_fromS(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 M_softB(vec3 cb, vec3 cs) {
  vec3 d = mix(((16.0 * cb - 12.0) * cb + 4.0) * cb, sqrt(cb), step(0.25, cb));
  return mix(cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb), cb + (2.0 * cs - 1.0) * (d - cb), step(0.5, cs));
}
vec3 M_hardB(vec3 cb, vec3 cs) { return mix(2.0 * cb * cs, 1.0 - 2.0 * (1.0 - cb) * (1.0 - cs), step(0.5, cs)); }
// W3C compositing blend functions on non-premultiplied colour in display (sRGB) space; Add works in linear light.
vec3 M_blendRGB(int m, vec3 cb, vec3 cs) {
  if (m == 1) return cb * cs;
  if (m == 2) return cb + cs - cb * cs;
  if (m == 3) return M_hardB(cs, cb);
  if (m == 4) return M_softB(cb, cs);
  if (m == 5) return M_hardB(cb, cs);
  if (m == 7) return min(cb, cs);
  if (m == 8) return max(cb, cs);
  if (m == 9) return abs(cb - cs);
  if (m == 10) return cb + cs - 2.0 * cb * cs;
  if (m == 11) return mix(min(cb / max(1.0 - cs, vec3(1e-4)), vec3(1.0)), vec3(0.0), step(cb, vec3(0.0)));
  return cs;
}
// Composite premultiplied linear src over premultiplied linear base with a blend mode and an opacity.
vec4 blendOver(int mode, vec4 base, vec4 src, float opacity) {
  src *= clamp(opacity, 0.0, 1.0);
  if (src.a <= 1e-5) return base;
  if (mode == 0 || base.a <= 1e-5) return src + base * (1.0 - src.a);
  vec3 cs = src.rgb / src.a, cb = base.rgb / base.a;
  vec3 b = mode == 6 ? min(cb + cs, vec3(1.0)) : M_fromS(M_blendRGB(mode, M_toS(cb), M_toS(cs)));
  return vec4((1.0 - src.a) * base.rgb + (1.0 - base.a) * src.rgb + src.a * base.a * b, src.a + base.a * (1.0 - src.a));
}

// ---- playhead: independent speed and direction ----
// Clip position in cycles at loop phase ph. k = cycles per loop (rounded to a whole number, so the loop closes).
//   PM_FORWARD  k*ph   PM_BACKWARD  -k*ph   (unbounded; wrap with fract() or scroll whole tiles)
//   PM_PINGPONG 0..1..0, k round trips per loop
//   PM_RANDOM   like ping-pong, but each round trip goes out the forward or the backward way (seeded hash)
// salt (a whole number) keeps two layers with the same settings from moving in lockstep.
float M_playheadAt(float ph, float k, int mode, float salt) {
  k = floor(max(k, 0.0) + 0.5); if (k < 0.5) return 0.0;
  float s = k * ph;
  if (mode == 0) return s;
  if (mode == 1) return -s;
  float i = floor(s), f = s - i, tri = 1.0 - abs(2.0 * f - 1.0);
  if (mode == 2) return tri;
  return (h11(i + salt * 97.0) < 0.5 ? -1.0 : 1.0) * tri;
}
float M_playhead(float k, int mode, float salt) { return M_playheadAt(u_p, k, mode, salt); }
float M_clip(float pos) { return pos - floor(pos); }

// ---- cues inside one shader ----
// cueP: local phase 0..1 inside the window [at, at + len) (wraps past the loop end), or -1 outside it.
float cueP(float at, float len) { float x = fract(u_p - at); return x < len ? x / max(len, 1e-5) : -1.0; }
// cueEnv: 0..1 envelope for the window with fade-in fi and fade-out fo as fractions of len.
float cueEnv(float at, float len, float fi, float fo) {
  float c = cueP(at, len); if (c < 0.0) return 0.0;
  return (fi <= 0.0 ? 1.0 : smoothstep(0.0, fi, c)) * (fo <= 0.0 ? 1.0 : 1.0 - smoothstep(1.0 - fo, 1.0, c));
}

// ---- layer / image transform and sampling ----
// uv -> frame-normalised sample coordinate: offset pos (uv units), scale, rotation in degrees, drift in tiles.
vec2 M_xf(vec2 uv, vec2 pos, float sc, float rotDeg, vec2 drift) {
  vec2 a = rot(-radians(rotDeg)) * (uv - pos) / max(sc, 1e-3);
  return a / M_asp() + 0.5 - drift;
}
// Sample a media texture at q (possibly out of range) with an edge mode; the mip level comes from the unwrapped q.
vec4 M_tex(sampler2D t, vec2 qq, int edge) {
  vec2 dx = dFdx(qq), dy = dFdy(qq), w = qq; float inside = 1.0;
  if (edge == 0) { vec2 m = min(qq, 1.0 - qq) / max(fwidth(qq), vec2(1e-6)); inside = clamp(min(m.x, m.y) + 0.5, 0.0, 1.0); w = clamp(qq, 0.0, 1.0); }
  else if (edge == 1) w = fract(qq);
  else if (edge == 2) w = 1.0 - abs(mod(qq, 2.0) - 1.0);
  else w = clamp(qq, 0.0, 1.0);
  return textureGrad(t, w, dx, dy) * inside;
}

// ---- vector shapes: signed distance in uv units, negative inside ----
float M_d2(vec2 v) { return dot(v, v); }
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float sdRing(vec2 p, float r, float w) { return abs(length(p) - r) - 0.5 * w; }
// Regular polygon, circumradius r, n sides, one vertex up.
float sdNgon(vec2 p, float r, float n) { n = max(n, 3.0); float a = mod(atan(p.x, p.y), TAU / n) - PI / n; return length(p) * cos(a) - r * cos(PI / n); }
float sdTriangle(vec2 p, float r) { return sdNgon(p, r, 3.0); }
// Star with n points, outer radius r, m in 2..n (higher = thinner arms).
float sdStar(vec2 p, float r, int n, float m) {
  float an = PI / float(n), en = PI / max(m, 2.0);
  vec2 acs = vec2(cos(an), sin(an)), ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
  p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs; p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
  return length(p) * sign(p.x);
}
// Open arc opening downwards: radius ra, half aperture ap (radians), half thickness rb.
float sdArc(vec2 p, float ra, float ap, float rb) {
  vec2 sc = vec2(sin(ap), cos(ap)); p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;
}
// Unsigned distance to a quadratic Bezier A-B-C (stroke it with  d - w/2 ).
float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C) {
  vec2 a = B - A, b = A - 2.0 * B + C, c = a * 2.0, d = A - pos;
  float bb2 = dot(b, b); if (bb2 < 1e-8) return sdSeg(pos, A, C);
  float kk = 1.0 / bb2, kx = kk * dot(a, b), ky = kk * (2.0 * dot(a, a) + dot(d, b)) / 3.0, kz = kk * dot(d, a);
  float res = 0.0, p = ky - kx * kx, p3 = p * p * p, q = kx * (2.0 * kx * kx - 3.0 * ky) + kz, h = q * q + 4.0 * p3;
  if (h >= 0.0) {
    h = sqrt(h); vec2 x = (vec2(h, -h) - q) / 2.0; vec2 w = sign(x) * pow(abs(x), vec2(1.0 / 3.0));
    float t = clamp(w.x + w.y - kx, 0.0, 1.0); res = M_d2(d + (c + b * t) * t);
  } else {
    float z = sqrt(-p), v = acos(q / (p * z * 2.0)) / 3.0, m = cos(v), n = sin(v) * 1.732050808;
    vec3 t = clamp(vec3(m + m, -n - m, n - m) * z - kx, 0.0, 1.0);
    res = min(M_d2(d + (c + b * t.x) * t.x), M_d2(d + (c + b * t.y) * t.y));
  }
  return sqrt(res);
}
float opSub(float a, float b) { return max(a, -b); }
float opInter(float a, float b) { return max(a, b); }
float opUnion(float a, float b) { return min(a, b); }
float opRound(float d, float r) { return d - r; }
float opOnion(float d, float t) { return abs(d) - t; }
// Coverage with a 1.5 px anti-aliased edge, outlines and glow. d is a signed distance in uv units.
float vfill(float d) { float w = 0.5 * aa(); return 1.0 - smoothstep(-w, w, d); }
float vstroke(float d, float wd) { return vfill(abs(d) - 0.5 * wd); }
float vglow(float d, float wd) { return exp(-max(d, 0.0) / max(wd, 1e-4)); }
// Fill + outline + glow in one call, premultiplied linear. lw / gw of 0 switch the outline / glow off.
vec4 vpaint(float d, vec3 fill, vec3 line, float lw, vec3 glowc, float gw) {
  vec4 c = vec4(glowc * (gw > 0.0 ? vglow(d, gw) * 0.6 : 0.0), 0.0); c.a = max(c.r, max(c.g, c.b));
  c = over(solid(fill, vfill(d)), c);
  return lw > 0.0 ? over(solid(line, vstroke(d, lw)), c) : c;
}
`;

// ---------------------------------------------------------------------------------------------------------------
// Generated controls. Layer stacks and svg inputs come with ready-made parameters; they are generated (not declared), so they
// do not count against the 32-param limit.
const optList = (ids, labels) => ids.map((v, i) => ({ v, l: labels[i] }));
function blockParams(q, kind, layer) {
  const id = q.id, g = (kind === 'layer' ? `Layer ${layer.i}` : q.label).slice(0, 20), P = {};
  const base = (label, extra) => ({ label: label.slice(0, 24), group: g, gen: id, ...extra });
  const add = (k, label, o) => { P[id + k] = base(label, o); };
  const point = (k, label, lo, hi, def, o) => ['X', 'Y'].forEach((c, i) => { P[id + k + c] = base(`${label} ${c}`, { type: 'range', min: lo, max: hi, def: def[i], step: +((hi - lo) / 400).toPrecision(2), mutate: 0.5, part: { of: id + k, kind: 'point', i, label }, ...o }); });
  const moving = { param: id + 'Speed', gt: 0 };
  add('Opacity', 'Opacity', { type: 'range', min: 0, max: 1, def: 1, step: 0.01, mutate: 0.3 });
  if (kind === 'layer') add('Blend', 'Blend', { type: 'select', options: optList(BLEND_MODES, BLEND_LABELS), def: layer.blend, mutate: 0, hint: 'Layer mode against everything below it.' });
  point('Pos', 'Offset', -1, 1, [0, 0], { hint: 'Position in frame units.' });
  add('Scale', 'Scale', { type: 'range', min: 0.1, max: 4, def: 1, step: 0.01, log: true, mutate: 0.4 });
  add('Rot', 'Rotate', { type: 'range', min: -180, max: 180, def: 0, step: 0.5, unit: '°', mutate: 0.3 });
  if (kind === 'layer') add('Edge', 'Edges', { type: 'select', options: optList(EDGE_MODES, EDGE_LABELS), def: 'clip', mutate: 0, hint: 'What shows beyond the image. Scrolling always repeats.' });
  add('Speed', 'Cycles / loop', { type: 'int', min: 0, max: 8, def: 0, step: 1, mutate: 0, hint: 'Whole cycles per loop, so the loop closes. 0 holds still (a video then plays on its own timing).' });
  add('Dir', 'Direction', { type: 'select', options: optList(PLAY_MODES, PLAY_LABELS), def: 'forward', mutate: 0, hint: 'Takes effect when Cycles / loop is above 0. Forward, backward, ping-pong, or every round trip goes a random way.' });
  point('Motion', 'Travel', -3, 3, [0, 0], { show: moving, hint: 'Tiles the image moves per cycle (0 keeps it still; a video still plays through the playhead). Forward and backward snap to whole tiles so the loop closes; ping-pong and random use any distance.' });
  return P;
}
// GLSL for the generated blocks. Layers: L_get<i>(uv), L_get(i, uv), L_opacity(i), L_stack(base, uv), L_over(uv).
// Svg inputs: vec_<id>(uv) signed distance in uv units (negative inside), vecA_<id>(uv) coverage times opacity.
function blockSource(inputs) {
  const layers = (inputs || []).filter(q => q.stack).sort((a, b) => a.stack - b.stack), sdf = (inputs || []).filter(q => q.type === 'svg'), tsdf = (inputs || []).filter(q => q.type === 'sdf');
  if (!layers.length && !sdf.length && !tsdf.length) return '';
  const motion = (n, salt) => `  float ph = M_playhead(float(p_${n}Speed), p_${n}Dir, ${salt}.0);
  bool sc = p_${n}Dir < 2 && p_${n}Speed > 0;
  vec2 mo = vec2(p_${n}MotionX, p_${n}MotionY); if (sc) mo = floor(mo + 0.5);
  vec2 drift = p_${n}Speed > 0 ? mo * ph : vec2(0.0);
  bool wrap = sc && (mo.x != 0.0 || mo.y != 0.0);
  vec2 tq = M_xf(uv, vec2(p_${n}PosX, p_${n}PosY), p_${n}Scale, p_${n}Rot, drift);
`;
  let s = '\n// ---- generated blocks (motif-kit@4) ----\n';
  for (const q of layers) s += `vec4 L_get${q.stack}(vec2 uv) {\n  if (u_${q.id}On < 0.5) return vec4(0.0);\n${motion(q.id, q.stack)}  return M_tex(u_${q.id}, tq, wrap ? EM_REPEAT : p_${q.id}Edge);\n}\n`;
  if (layers.length) {
    s += `vec4 L_get(int i, vec2 uv) {\n${layers.map(q => `  if (i == ${q.stack}) return L_get${q.stack}(uv);`).join('\n')}\n  return vec4(0.0);\n}\n`;
    s += `float L_opacity(int i) {\n${layers.map(q => `  if (i == ${q.stack}) return p_${q.id}Opacity;`).join('\n')}\n  return 0.0;\n}\n`;
    s += `vec4 L_stack(vec4 base, vec2 uv) {\n${layers.map(q => `  base = blendOver(p_${q.id}Blend, base, L_get${q.stack}(uv), p_${q.id}Opacity);`).join('\n')}\n  return base;\n}\nvec4 L_over(vec2 uv) { return L_stack(vec4(0.0), uv); }\n`;
  }
  sdf.forEach((q, i) => {
    const n = q.id;
    s += `float vec_${n}(vec2 uv) {\n  if (u_${n}On < 0.5) return 1e3;\n${motion(n, 20 + i)}  if (wrap) tq = fract(tq);\n  vec2 c = clamp(tq, 0.0, 1.0);\n  float d = (texture(u_${n}, c).r - 0.5) * 2.0 * u_${n}Spread;\n  d += length(max(abs(tq - 0.5) - 0.5, 0.0) * M_asp());\n  return d * max(p_${n}Scale, 1e-3);\n}\n`;
    s += `float vecA_${n}(vec2 uv) { return vfill(vec_${n}(uv)) * p_${n}Opacity; }\n`;
  });
  // Text distance fields: textDist_<id>(i, q) is the signed distance (line-local units, band width = 1; negative inside the glyphs) of
  // line i at the same line-local q as textLine_<id>(i, q). Outlines, glows and shadows of live type stay exact at any scale.
  for (const q of tsdf) {
    const n = q.from, t = (inputs || []).find(x => x.id === n && x.type === 'text'); if (!t) continue;
    const N = t.lines.length, A = Number(t.aspect).toFixed(4);
    s += `float textDist_${n}(int i, vec2 q) {\n  if (i < 0 || i >= ${N}) return 1e3;\n  vec2 b = vec2(q.x + 0.5, q.y * ${A} + 0.5);\n  vec2 t = vec2(clamp(b.x, 0.0, 1.0), (float(${N - 1} - i) + clamp(b.y, 0.0, 1.0)) / ${N}.0);\n`
      + `  float d = (texture(u_${q.id}, t).r - 0.5) * 2.0 * u_${q.id}Spread;\n  vec2 o = max(abs(b - 0.5) - 0.5, 0.0);\n  return d + length(vec2(o.x, o.y / ${A}));\n}\n`;
  }
  return s;
}
// The runtime declarations a @4 entry compiles with (appended to the entry's `extra`).
function extraFor(inputs) { return PRELUDE_V4 + blockSource(inputs); }

// ---------------------------------------------------------------------------------------------------------------
// Playhead (JS twin of M_playheadAt) and the shader's PCG hash, bit-identical.
const F32 = new Float32Array(1), U32 = new Uint32Array(F32.buffer);
function pcg(v) { const s = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0; const w = Math.imul(((s >>> ((s >>> 28) + 4)) ^ s) >>> 0, 277803737) >>> 0; return ((w >>> 22) ^ w) >>> 0; }
function seedU(seed) { return pcg(Math.imul(Math.floor(seed) >>> 0, 2654435761 | 0) >>> 0); }
function h11(x, seed) { F32[0] = x + 0; return (pcg((U32[0] ^ seedU(seed)) >>> 0) >>> 8) / 16777216; }
// k: cycles per loop (whole), mode: 0..3 or its name, ph: loop phase 0..1, salt: whole number, seed: the layer seed. Double precision here, float in
// the shader: they agree to float precision (tests/v8), and exactly at whole cycles, which is all the loop rule needs.
function playhead(k, mode, salt, ph, seed) {
  if (typeof mode === 'string') mode = PLAY_MODES.indexOf(mode);
  k = Math.floor(Math.max(k, 0) + 0.5); if (k < 1) return 0;
  const s = k * ph;
  if (mode === 0) return s; if (mode === 1) return -s;
  const i = Math.floor(s), f = s - i, tri = 1 - Math.abs(2 * f - 1);
  if (mode === 2) return tri;
  return (h11(i + salt * 97, seed == null ? 1 : seed) < 0.5 ? -1 : 1) * tri;
}
// Position inside a clip (0..1) for a playhead value. Ping-pong plays to the end and back (clamped); the other modes treat the clip as
// looping (wrapped), so a random round trip that goes the backward way wraps through the start.
const clipPos = (pos, mode) => (mode === 2 || mode === 'pingpong' ? Math.min(1, Math.max(0, pos)) : pos - Math.floor(pos));
// Clip positions (0..1) of the stack layers of an entry at loop phase p, from the params the shader reads. A video layer with
// Cycles/loop > 0 is seeked to clip * duration; with 0 it keeps its own timing (clip is null).
function stackPlayheads(inputs, params, p, seed) {
  const out = {};
  for (const q of inputs || []) {
    if (!q.stack) continue;
    const k = Math.round(+params[q.id + 'Speed'] || 0);
    const dir = params[q.id + 'Dir'] || 'forward'; out[q.id] = k < 1 ? null : clipPos(playhead(k, dir, q.stack, p, seed), dir);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// SVG -> signed-distance texture. Worker-safe: a small tag scanner (no DOMParser) feeds Path2D on an OffscreenCanvas.
function svgProblem(t) {
  if (typeof t !== 'string' || !/<svg[\s>]/i.test(t)) return 'not an SVG (no <svg> element).';
  if (t.length > LIMITS.svgBytes) return `larger than ${LIMITS.svgBytes / 1024} KB.`;
  if (/<\s*(script|foreignObject|image|iframe|animate|set|style)\b|\son\w+\s*=|javascript:|<!ENTITY/i.test(t)) return 'contains script, style, animation, image or foreignObject content, which is not allowed.';
  if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(t)) return 'has an external reference (href); inline everything.';
  if (/=\s*"[^"<>]*[<>]|=\s*'[^'<>]*[<>]/.test(cutBetween(t, '<!--', '-->'))) return 'has < or > inside an attribute value; write them as &lt; and &gt;.';
  return '';
}
const SVG_SKIP = new Set(['defs', 'mask', 'clipPath', 'symbol', 'use', 'text', 'image', 'title', 'desc', 'metadata', 'pattern', 'filter', 'linearGradient', 'radialGradient', 'marker']);
const unent = s => String(s).replace(/&(amp|lt|gt|quot|apos);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[k]));
function mulM(a, b) { return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]]; }
function parseTransform(str) {
  let m = [1, 0, 0, 1, 0, 0]; const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g; let t;
  while ((t = re.exec(str || ''))) {
    const a = t[2].split(/[\s,]+/).filter(Boolean).map(Number); let n = null;
    if (t[1] === 'matrix' && a.length === 6) n = a;
    else if (t[1] === 'translate') n = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
    else if (t[1] === 'scale') n = [a[0], 0, 0, a[1] == null ? a[0] : a[1], 0, 0];
    else if (t[1] === 'rotate') { const r = (a[0] || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), cx = a[1] || 0, cy = a[2] || 0; n = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]; }
    else if (t[1] === 'skewX') n = [1, 0, Math.tan((a[0] || 0) * Math.PI / 180), 1, 0, 0];
    else if (t[1] === 'skewY') n = [1, Math.tan((a[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
    if (n && n.every(Number.isFinite)) m = mulM(m, n);
  }
  return m;
}
function shapePath(tag, at) {
  const n = k => parseFloat(at[k]) || 0;
  if (tag === 'path') return at.d || '';
  if (tag === 'rect') { const x = n('x'), y = n('y'), w = n('width'), h = n('height'); let rx = 'rx' in at ? n('rx') : n('ry'), ry = 'ry' in at ? n('ry') : rx; rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
    return rx > 0 ? `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z` : `M${x} ${y}H${x + w}V${y + h}H${x}Z`; }
  if (tag === 'circle' || tag === 'ellipse') { const cx = n('cx'), cy = n('cy'), rx = tag === 'circle' ? n('r') : n('rx'), ry = tag === 'circle' ? n('r') : n('ry'); return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`; }
  if (tag === 'line') return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
  if (tag === 'polyline' || tag === 'polygon') { const p = String(at.points || '').split(/[\s,]+/).filter(Boolean).map(Number); let d = ''; for (let i = 0; i + 1 < p.length; i += 2) d += `${i ? 'L' : 'M'}${p[i]} ${p[i + 1]}`; return d + (tag === 'polygon' ? 'Z' : ''); }
  return null;
}
// Removes everything between open and close markers with indexOf only, so unterminated or repeated markers cost linear time.
function cutBetween(s, open, close) { let out = '', i = 0; for (;;) { const a = s.indexOf(open, i); if (a < 0) return out + s.slice(i); out += s.slice(i, a); const b = s.indexOf(close, a + open.length); if (b < 0) return out; i = b + close.length; } }
// -> { viewBox: [x, y, w, h], shapes: [{ d, m (matrix), fill, stroke, sw, rule, cap, join }] }. Linear in the size of the file: the tag
// scanner never lets a tag span another '<', and attribute values may not contain '<' or '>' (svgProblem rejects them).
function parseSvg(text) {
  let src = cutBetween(cutBetween(String(text).slice(0, LIMITS.svgBytes), '<!--', '-->'), '<?', '?>');
  src = src.replace(/<!DOCTYPE[^<>]*>/gi, '').replace(/<!\[CDATA\[[^<>]*\]\]>/g, '');
  const tagRe = /<(\/?)([A-Za-z][\w:-]*)([^<>]*)>/g, attRe = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const out = { viewBox: null, shapes: [] }, stack = []; let skip = 0, m, root = null, tags = 0;
  while ((m = tagRe.exec(src))) {
    if (++tags > 20000) break;
    const close = m[1] === '/', tag = m[2].replace(/^svg:/, ''), self = /\/\s*$/.test(m[3]);
    if (close) { const top = stack.pop(); if (top && top.skip) skip--; continue; }
    const at = {}; let a; attRe.lastIndex = 0; while ((a = attRe.exec(m[3]))) at[a[1]] = unent(a[2] != null ? a[2] : a[3]);
    const parent = stack.length ? stack[stack.length - 1] : null, st = { ...(parent ? parent.st : {}) };
    for (const k of ['fill', 'stroke', 'stroke-width', 'fill-rule', 'stroke-linecap', 'stroke-linejoin', 'display', 'visibility']) if (at[k] != null && at[k] !== '') st[k] = String(at[k]).trim();
    if (at.style) at.style.split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) st[d.slice(0, i).trim()] = d.slice(i + 1).trim(); });
    const tf = mulM(parent ? parent.m : [1, 0, 0, 1, 0, 0], parseTransform(at.transform));
    const skipHere = SVG_SKIP.has(tag) || st.display === 'none' || st.visibility === 'hidden';
    if (tag === 'svg' && !root) { root = at; const vb = String(at.viewBox || '').split(/[\s,]+/).map(Number); out.viewBox = vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0 ? vb : [0, 0, parseFloat(at.width) || 100, parseFloat(at.height) || 100]; }
    else if (!skip && !skipHere) { const d = shapePath(tag, at); if (d && out.shapes.length < LIMITS.svgShapes) out.shapes.push({ d, m: tf, fill: st.fill == null ? 'black' : st.fill, stroke: st.stroke == null ? 'none' : st.stroke, sw: parseFloat(st['stroke-width']) || 1, rule: st['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero', cap: st['stroke-linecap'] || 'butt', join: st['stroke-linejoin'] || 'miter' }); }
    if (!self) { if (stack.length < 256) stack.push({ st, m: tf, skip: skipHere }); else skip++; if (skipHere) skip++; }
  }
  if (!out.viewBox) throw new Error('The SVG has no <svg> element.');
  return out;
}
// Felzenszwalb and Huttenlocher squared distance transform (as in TinySDF, MIT).
function edt1d(g, off, stride, n, f, v, z) {
  v[0] = 0; z[0] = -1e20; z[1] = 1e20; f[0] = g[off];
  for (let q = 1, k = 0, s = 0; q < n; q++) {
    f[q] = g[off + q * stride]; const q2 = q * q;
    do { const r = v[k]; s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2; } while (s <= z[k] && --k > -1);
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  for (let q = 0, k = 0; q < n; q++) { while (z[k + 1] < q) k++; const r = v[k], qr = q - r; g[off + q * stride] = f[r] + qr * qr; }
}
function edt2d(g, w, h) {
  const m = Math.max(w, h), f = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
  for (let x = 0; x < w; x++) edt1d(g, x, w, h, f, v, z);
  for (let y = 0; y < h; y++) edt1d(g, y * w, 1, w, f, v, z);
}
// alpha: Uint8 coverage (w*h). Edge pixels place the edge with sub-pixel accuracy. -> RGBA8: R = 0.5 + d / (2 * spread) (d in px,
// negative inside), G = coverage.
function sdfFromAlpha(alpha, w, h, spread) {
  const n = w * h, INF = 1e20, outer = new Float64Array(n), inner = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = alpha[i] / 255;
    if (a >= 1) { outer[i] = 0; inner[i] = INF; } else if (a <= 0) { outer[i] = INF; inner[i] = 0; } else { const d = 0.5 - a; outer[i] = d > 0 ? d * d : 0; inner[i] = d < 0 ? d * d : 0; }
  }
  edt2d(outer, w, h); edt2d(inner, w, h);
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i]);
    out[i * 4] = Math.max(0, Math.min(255, Math.round(255 * (0.5 + d / (2 * spread))))); out[i * 4 + 1] = alpha[i]; out[i * 4 + 3] = 255;
  }
  return out;
}
const mkCanvas = (w, h) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
let REV = 0;
// Draws the parsed SVG as a white mask fitted to (w, h) with a margin, and bakes it. Fills and strokes both count as shape.
function bakeSvg(svg, w, h, o) {
  o = o || {}; const spread = o.spread || 24, margin = o.margin == null ? 0.08 : o.margin, doc = typeof svg === 'string' ? parseSvg(svg) : svg;
  const cv = mkCanvas(w, h), x = cv.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, w, h); x.fillStyle = '#fff'; x.strokeStyle = '#fff';
  const vb = doc.viewBox, m = margin * Math.min(w, h), sc = Math.min((w - 2 * m) / vb[2], (h - 2 * m) / vb[3]);
  const base = [sc, 0, 0, sc, (w - vb[2] * sc) / 2 - vb[0] * sc, (h - vb[3] * sc) / 2 - vb[1] * sc]; let drawn = 0;
  for (const s of doc.shapes) {
    let path; try { path = new Path2D(s.d); } catch (e) { continue; }
    const t = mulM(base, s.m); x.setTransform(t[0], t[1], t[2], t[3], t[4], t[5]);
    if (s.fill !== 'none') { x.fill(path, s.rule); drawn++; }
    if (s.stroke !== 'none') { x.lineWidth = s.sw; x.lineCap = s.cap; x.lineJoin = s.join; x.stroke(path); drawn++; }
  }
  x.setTransform(1, 0, 0, 1, 0, 0);
  const a = x.getImageData(0, 0, w, h).data, alpha = new Uint8Array(w * h); for (let i = 0; i < alpha.length; i++) alpha[i] = a[i * 4 + 3];
  return { data: sdfFromAlpha(alpha, w, h, spread), w, h, spread, rev: ++REV, drawn };
}
// Bakes (and caches) the svg inputs of an entry for the frame size: { <inputId>: media } for the runtime's u.media.
// Frame-normalised: the texture has the frame's aspect, so q = fc / u_res samples it undistorted.
const bakeCache = new Map();
function resolveSvg(inputs, S) {
  let out = null;
  for (const q of inputs || []) {
    if (q.type !== 'svg' || !q.svg) continue;
    const bh = Math.min(LIMITS.bakeMax, Math.max(LIMITS.bakeMin, Math.round((S.h || 576) / 64) * 64)), bw = Math.max(LIMITS.bakeMin, Math.min(2 * LIMITS.bakeMax, Math.round(bh * (S.w || 1024) / (S.h || 576))));
    const key = `${q.id}|${bw}x${bh}|${q.margin}|${q.spread}|${q.svg.length}|${q.svg.slice(0, 80)}|${q.svg.slice(-80)}`;
    let e = bakeCache.get(key);
    if (!e) { e = bakeSvg(q.svg, bw, bh, { spread: q.spread, margin: q.margin }); e.key = key; bakeCache.set(key, e); if (bakeCache.size > 12) bakeCache.delete(bakeCache.keys().next().value); }
    else { bakeCache.delete(key); bakeCache.set(key, e); }
    (out || (out = {}))[q.id] = { data: e.data, w: e.w, h: e.h, spread: e.spread, key: e.key, rev: e.rev, time: 0 };
  }
  return out;
}

// Text distance fields (text input with "sdf": true): the app's glyph atlas, downsampled to at most 1024 px wide, becomes a signed distance
// texture. spread is in px of that texture; the runtime divides by min(w, h) to get uv units, so m.spread carries the conversion to
// atlas-width units (one band width = 1) that textDist_<id> uses.
const sdfOfAtlas = new WeakMap();
function resolveTextSdf(inputs, media, S) {
  let out = null;
  for (const q of inputs || []) {
    if (q.type !== 'sdf') continue;
    const at = media && media[q.from]; if (!at || !at.canvas) continue;
    const sc = Math.min(1, 1024 / at.w), w = Math.max(16, Math.round(at.w * sc)), h = Math.max(16, Math.round(at.h * sc)), sp = q.spread || 12;
    let e = sdfOfAtlas.get(at.canvas);
    if (!e || e.rev !== at.rev || e.w !== w || e.h !== h || e.sp !== sp) {
      const cv = mkCanvas(w, h), x = cv.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, w, h); x.drawImage(at.canvas, 0, 0, at.w, at.h, 0, 0, w, h);
      const a = x.getImageData(0, 0, w, h).data, alpha = new Uint8Array(w * h); for (let i = 0; i < alpha.length; i++) alpha[i] = a[i * 4 + 3];
      e = { rev: at.rev, w, h, sp, data: sdfFromAlpha(alpha, w, h, sp), key: e ? e.key : {}, srev: ++REV }; sdfOfAtlas.set(at.canvas, e);
    }
    (out || (out = {}))[q.id] = { data: e.data, w: e.w, h: e.h, spread: sp * Math.min(e.w, e.h) / e.w, key: e.key, rev: e.srev, time: 0 };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Sequences (motif-seq@1). A cue invokes a style for part of the loop; `cycles` whole runs of the style fit inside it, so it closes on
// itself, and it fades in and out so nothing pops. At most `maxActive` shaders run at once, whatever the number of cues.
const CUE_ID_RE = /^[A-Za-z][\w-]{0,23}$/, STYLE_REF_RE = /^[A-Za-z0-9][\w.-]{0,63}(\/[A-Za-z0-9][\w.-]{0,63})?$/;
// A time is a number (fraction of the loop) or "3/16", "25%", "1.5s" (needs loop), "2b" (needs loop and bpm).
function parseTime(v, ctx) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v !== 'string') return NaN;
  const t = v.trim(); let m;
  if ((m = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(t))) return +m[2] ? +m[1] / +m[2] : NaN;
  if ((m = /^(-?\d+(?:\.\d+)?)%$/.exec(t))) return +m[1] / 100;
  if ((m = /^(-?\d+(?:\.\d+)?)s$/.exec(t))) return ctx.loop ? +m[1] / ctx.loop : NaN;
  if ((m = /^(-?\d+(?:\.\d+)?)b$/.exec(t))) return ctx.loop && ctx.bpm ? (+m[1] * 60 / ctx.bpm) / ctx.loop : NaN;
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return +t;
  return NaN;
}
const fadeEnv = (x, fi, fo) => { const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); }; return (fi > 0 ? ss(0, fi, x) : 1) * (fo > 0 ? 1 - ss(1 - fo, 1, x) : 1); };
// opt: { kitId, local: Set of this kit's style ids, library: ref => bool, maxActive }. Returns { ok, errors, warnings, seq, deps }.
function validateSequence(raw, opt) {
  opt = opt || {}; const errors = [], warnings = [], err = m => errors.push(m), warn = m => warnings.push(m);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['A sequence must be an object.'], warnings, seq: null, deps: [] };
  if (raw.format != null && raw.format !== SEQ.format) err(`format must be "${SEQ.format}".`);
  if (!ID_RE.test(raw.id || '')) err('sequence id must be 2-32 chars: lowercase letters, digits and hyphens, starting with a letter.');
  const loop = raw.loop == null ? 0 : Number(raw.loop), bpm = raw.bpm == null ? 0 : Number(raw.bpm);
  if (raw.loop != null && !(loop > 0 && loop <= 600)) err('loop must be a number of seconds (0-600).');
  if (raw.bpm != null && !(bpm >= 20 && bpm <= 400)) err('bpm must be 20-400.');
  const maxActive = raw.maxActive == null ? (opt.maxActive || SEQ.active) : raw.maxActive;
  if (!Number.isInteger(maxActive) || maxActive < 1 || maxActive > SEQ.active) err(`maxActive must be 1-${SEQ.active}.`);
  const seed = raw.seed == null ? 1 : raw.seed; if (!Number.isInteger(seed) || seed < 1 || seed > 9999) err('seed must be a whole number 1-9999.');
  const src = Array.isArray(raw.cues) ? raw.cues : []; if (!Array.isArray(raw.cues) || !src.length) err('cues must be a non-empty array.');
  if (src.length > SEQ.cues) err(`At most ${SEQ.cues} cues.`);
  const ctx = { loop, bpm }, cues = [], ids = new Set(), deps = new Set();
  src.slice(0, SEQ.cues).forEach((c, n) => {
    const base = c && c.id ? String(c.id) : `c${n + 1}`, w = `cues[${n}]${c && c.id ? ` (${c.id})` : ''}`;
    if (!c || typeof c !== 'object') return err(`${w}: must be an object.`);
    if (!CUE_ID_RE.test(base)) return err(`${w}: id must be letters, digits, - or _ (max 24).`);
    if (ids.has(base)) return err(`${w}: duplicate cue id "${base}".`); ids.add(base);
    if (typeof c.style !== 'string' || !STYLE_REF_RE.test(c.style)) return err(`${w}: style must be a style id such as "mitosis" or "neuro/mitosis".`);
    let ref = c.style;
    if (!ref.includes('/') && opt.kitId) { if (opt.local && !opt.local.has(ref)) return err(`${w}: style "${ref}" is not in this kit.`); ref = `${opt.kitId}/${ref}`; }
    else if (ref.includes('/')) { const kit = ref.split('/')[0]; if (kit !== opt.kitId) { deps.add(kit); if (opt.library && !opt.library(ref)) warn(`${w}: style "${ref}" is not installed.`); } else if (opt.local && !opt.local.has(ref.split('/')[1])) return err(`${w}: style "${ref}" is not in this kit.`); }
    const at = c.at == null ? 0 : parseTime(c.at, ctx), len = parseTime(c.len, ctx);
    if (!Number.isFinite(at)) return err(`${w}: at must be a fraction of the loop, or "3/16", "25%", "1.5s" or "2b" (seconds and beats need the sequence's loop / bpm).`);
    if (!(len > 0 && len <= 1 + 1e-9)) return err(`${w}: len must be more than 0 and at most one loop.`);
    const lane = c.lane == null ? 0 : c.lane; if (!Number.isInteger(lane) || lane < 0 || lane >= SEQ.lanes) return err(`${w}: lane must be 0-${SEQ.lanes - 1}.`);
    const fi = c.fadeIn == null ? 0.1 : Number(c.fadeIn), fo = c.fadeOut == null ? 0.1 : Number(c.fadeOut);
    if (!(fi >= 0 && fi <= 0.5 && fo >= 0 && fo <= 0.5)) return err(`${w}: fadeIn and fadeOut are fractions of the cue, 0-0.5.`);
    const cycles = c.cycles == null ? 1 : c.cycles; if (!Number.isInteger(cycles) || cycles < 1 || cycles > SEQ.cycles) return err(`${w}: cycles must be a whole number 1-${SEQ.cycles}.`);
    const dir = c.dir == null ? 'forward' : c.dir; if (!PLAY_MODES.includes(dir)) return err(`${w}: dir must be ${PLAY_MODES.join(', ')}.`);
    const blend = c.blend == null ? 'normal' : c.blend; if (!BLEND_MODES.includes(blend)) return err(`${w}: blend must be one of ${BLEND_MODES.join(', ')}.`);
    const opacity = c.opacity == null ? 1 : Number(c.opacity); if (!(opacity >= 0 && opacity <= 1)) return err(`${w}: opacity must be 0-1.`);
    const chance = c.chance == null ? 1 : Number(c.chance); if (!(chance >= 0 && chance <= 1)) return err(`${w}: chance must be 0-1.`);
    const cseed = c.seed == null ? 0 : c.seed; if (cseed !== 0 && (!Number.isInteger(cseed) || cseed < 1 || cseed > 9999)) return err(`${w}: seed must be a whole number 1-9999.`);
    const params = c.params == null ? {} : c.params;
    if (typeof params !== 'object' || Array.isArray(params) || Object.keys(params).length > SEQ.params || !Object.values(params).every(v => ['number', 'string', 'boolean'].includes(typeof v)) || Object.keys(params).some(k => k === '__proto__' || k === 'constructor' || k === 'prototype')) return err(`${w}: params must be an object of numbers, strings and booleans (max ${SEQ.params}).`);
    if (c.palette != null && typeof c.palette !== 'string') return err(`${w}: palette must be a palette id.`);
    let reps = 1, every = 0;
    if (c.repeat != null) {
      const r = c.repeat; every = r && parseTime(r.every, ctx);
      if (!r || !(every > 0 && every <= 1) || !Number.isInteger(r.count) || r.count < 2 || r.count > SEQ.repeat) return err(`${w}: repeat needs { "every": time, "count": 2-${SEQ.repeat} }.`);
      if (every < len - 1e-9) warn(`${w}: repeats overlap themselves (every < len).`);
      reps = r.count;
    }
    const wrapAt = x => x - Math.floor(x);
    for (let r = 0; r < reps; r++) cues.push({ id: r ? `${base}#${r + 1}` : base, from: base, i: cues.length, style: ref, at: wrapAt(at + r * every), len: Math.min(1, len), lane, fadeIn: fi, fadeOut: fo, cycles, dir, blend, opacity, chance, mute: !!c.mute, seed: cseed, palette: c.palette || null, params: { ...params }, label: String(c.label || '').slice(0, 32) });
  });
  if (cues.length > SEQ.cues) err(`Repeats expand to ${cues.length} cues; at most ${SEQ.cues}.`);
  const seq = { format: SEQ.format, id: raw.id, name: String(raw.name || raw.id || '').slice(0, 32), description: String(raw.description || '').slice(0, 200), loop: loop || null, bpm: bpm || null, seed, maxActive, cues };
  if (!errors.length) {
    const an = analyzeSequence(seq);
    if (an.peak > maxActive) err(`${an.peak} cues overlap at ${an.peakAt.toFixed(3)} of the loop; maxActive is ${maxActive}. Move a cue, shorten one, or give one a chance.`);
    if (an.coverage < 0.999 && an.gaps.length) warn(`Nothing plays during ${an.gaps.map(g => `${g[0].toFixed(2)}-${g[1].toFixed(2)}`).join(', ')}.`);
  }
  return { ok: !errors.length, errors, warnings, seq: errors.length ? null : seq, deps: [...deps] };
}
// Which cues are on, and how they stack, at loop phase p. Pure and deterministic.
// opt: { L: loop seconds, seed, maxActive } -> { active: [{ cue, local, innerP, innerL, env, alpha }], dropped }.
function planSequence(seq, p, opt) {
  opt = opt || {}; const L = opt.L || seq.loop || 6, seed = opt.seed != null ? opt.seed : seq.seed, maxActive = opt.maxActive || seq.maxActive || SEQ.active;
  p = p - Math.floor(p); let active = [];
  for (const c of seq.cues) {
    if (c.mute) continue;
    if (c.chance < 1 && !(h11(c.i + 1, seed) < c.chance)) continue;
    let x = p - c.at; x -= Math.floor(x); if (x >= c.len) continue;
    const local = x / c.len, mode = PLAY_MODES.indexOf(c.dir), pos = playhead(c.cycles, mode, c.i + 1, local, seed), env = fadeEnv(local, c.fadeIn, c.fadeOut);
    // Ping-pong and random move the inner phase twice as fast; the photosensitive limiter must see the faster loop.
    active.push({ cue: c, local, innerP: pos - Math.floor(pos), innerL: Math.max(0.05, (L * c.len) / (c.cycles * (mode >= 2 ? 2 : 1))), env, alpha: env * c.opacity });
  }
  let dropped = 0;
  if (active.length > maxActive) { const keep = new Set([...active].sort((a, b) => b.alpha - a.alpha || a.cue.i - b.cue.i).slice(0, maxActive)); dropped = active.length - maxActive; active = active.filter(a => keep.has(a)); }
  active.sort((a, b) => a.cue.lane - b.cue.lane || a.cue.at - b.cue.at || a.cue.i - b.cue.i);
  return { active, dropped };
}
// Static analysis over the loop (chance ignored: worst case): peak overlap, gaps, styles used.
function analyzeSequence(seq) {
  const cues = seq.cues.filter(c => !c.mute), pts = new Set([0, 1]);
  cues.forEach(c => { pts.add(c.at); pts.add((c.at + c.len) % 1 || 1); });
  const xs = [...pts].sort((a, b) => a - b); let peak = 0, peakAt = 0, covered = 0; const gaps = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i], b = xs[i + 1]; if (b - a < 1e-9) continue; const mid = (a + b) / 2;
    const n = cues.filter(c => { let x = mid - c.at; x -= Math.floor(x); return x < c.len; }).length;
    if (n > peak) { peak = n; peakAt = mid; }
    if (n) covered += b - a; else if (gaps.length && Math.abs(gaps[gaps.length - 1][1] - a) < 1e-9) gaps[gaps.length - 1][1] = b; else gaps.push([a, b]);
  }
  return { peak, peakAt, coverage: covered, gaps, styles: [...new Set(cues.map(c => c.style))], lanes: [...new Set(cues.map(c => c.lane))].sort() };
}
// A sequence kept on a layer: the same cue shape as a file, sanitised to bounded plain data (no raw times: fractions only).
function sanitizeSeq(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
  const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const cues = (Array.isArray(s.cues) ? s.cues : []).slice(0, SEQ.cues).map((c, i) => {
    if (!c || typeof c !== 'object' || typeof c.style !== 'string' || !STYLE_REF_RE.test(c.style)) return null;
    const params = {}; if (c.params && typeof c.params === 'object' && !Array.isArray(c.params)) for (const [k, v] of Object.entries(c.params).slice(0, SEQ.params)) if (/^[a-z][a-zA-Z0-9]{0,23}$/.test(k) && ['number', 'string', 'boolean'].includes(typeof v)) params[k] = typeof v === 'string' ? v.slice(0, 64) : v;
    return { id: CUE_ID_RE.test(c.id || '') ? c.id : `c${i + 1}`, i, style: c.style, at: num(c.at, 0, 0.9999, 0), len: num(c.len, 0.01, 1, 0.25), lane: Math.round(num(c.lane, 0, SEQ.lanes - 1, 0)), fadeIn: num(c.fadeIn, 0, 0.5, 0.1), fadeOut: num(c.fadeOut, 0, 0.5, 0.1),
      cycles: Math.round(num(c.cycles, 1, SEQ.cycles, 1)), dir: PLAY_MODES.includes(c.dir) ? c.dir : 'forward', blend: BLEND_MODES.includes(c.blend) ? c.blend : 'normal', opacity: num(c.opacity, 0, 1, 1), chance: num(c.chance, 0, 1, 1), mute: !!c.mute,
      seed: Math.round(num(c.seed, 0, 9999, 0)), palette: typeof c.palette === 'string' && c.palette ? c.palette.slice(0, 48) : null, params, label: String(c.label || '').slice(0, 32) };
  }).filter(Boolean);
  const ids = new Set(); cues.forEach((c, i) => { while (ids.has(c.id)) c.id = `c${i + 1}-${ids.size}`; ids.add(c.id); c.i = i; });
  return { id: typeof s.id === 'string' ? s.id.slice(0, 32) : '', name: String(s.name || '').slice(0, 32), seed: Math.round(num(s.seed, 1, 9999, 1)), maxActive: Math.round(num(s.maxActive, 1, SEQ.active, SEQ.active)), cues };
}

return {
  LIMITS, SEQ, BLEND_MODES, BLEND_LABELS, PLAY_MODES, PLAY_LABELS, EDGE_MODES, EDGE_LABELS, BLEND_CANVAS, PRELUDE_V4,
  blockParams, blockSource, extraFor, playhead, clipPos, stackPlayheads, h11, pcg,
  svgProblem, parseSvg, sdfFromAlpha, bakeSvg, resolveSvg, resolveTextSdf,
  parseTime, validateSequence, planSequence, analyzeSequence, sanitizeSeq, fadeEnv,
};

})();
