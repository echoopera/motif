// Motif kit-gl, SDK 1.2.5: DOM-free validation + WebGL2 runtime + sequencer + vector/type baker.
// 1.2.5 adds: vector graphics and typography (SDF primitives, svg/text inputs), image layer stacks with blend modes,
// independent speed and direction (playhead), and the motif-seq@1 sequencer. Kits that do not declare
// "sdk": "1.2.5" compile exactly as they did under 1.2.0.
// kit-gl/prelude — the Motif Kit GLSL prelude (API motif-kit@1). Every kit pass is compiled as:
//   PRELUDE + generated param uniforms + kit common.glsl + pass source + MAIN.
// Contract for authors: time enters ONLY through u_p (loop phase 0..1). Any periodic function
// of u_p with integer frequencies loops exactly. Use the M_ helpers; never read the clock.
const PRELUDE = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform vec2 u_res;      // pass resolution in pixels
uniform float u_p;       // loop phase 0..1 (tempo and phase already applied)
uniform float u_L;       // effective loop duration in seconds (loop / tempo)
uniform float u_seed;    // 1..9999
uniform float u_safe;    // 1 = photosensitive-safe limiter on
uniform vec3 u_bg, u_ink, u_a0, u_a1, u_a2; // palette, linear RGB
uniform sampler2D u_buf0, u_buf1, u_buf2, u_buf3; // earlier passes of this frame
out vec4 M_out;
#define TAU 6.283185307179586
#define PI 3.141592653589793
#define M_PH (u_p * TAU)

// ---- hashing (PCG, seeded) ----
uint M_pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
uint M_seedU() { return M_pcg(uint(u_seed) * 2654435761u); }
float M_u2f(uint x) { return float(x >> 8u) * (1.0 / 16777216.0); }
float h11(float x) { return M_u2f(M_pcg(floatBitsToUint(x + 0.0) ^ M_seedU())); }
float h21(vec2 p) { return M_u2f(M_pcg(M_pcg(floatBitsToUint(p.x + 0.0) ^ M_seedU()) ^ floatBitsToUint(p.y + 0.0))); }
vec2 h22(vec2 p) { uint a = M_pcg(M_pcg(floatBitsToUint(p.x + 0.0) ^ M_seedU()) ^ floatBitsToUint(p.y + 0.0)); return vec2(M_u2f(a), M_u2f(M_pcg(a))); }
vec3 h33(vec3 p) { uint a = M_pcg(M_pcg(M_pcg(floatBitsToUint(p.x + 0.0) ^ M_seedU()) ^ floatBitsToUint(p.y + 0.0)) ^ floatBitsToUint(p.z + 0.0)); uint b = M_pcg(a); return vec3(M_u2f(a), M_u2f(b), M_u2f(M_pcg(b))); }
vec2 M_seedOff() { return vec2(M_u2f(M_seedU()), M_u2f(M_pcg(M_seedU()))) * 173.0 - 86.0; }

// ---- small maths ----
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 sat(vec3 x) { return clamp(x, 0.0, 1.0); }
float remap(float x, float a, float b) { return sat((x - a) / (b - a)); }
float smin(float a, float b, float k) { float h = sat(0.5 + 0.5 * (b - a) / k); return mix(b, a, h) - k * h * (1.0 - h); }
float smax(float a, float b, float k) { return -smin(-a, -b, k); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// Loop circle: frequency k (integer to loop), phase offset ph (0..1).
vec2 lc(float k, float ph) { float a = TAU * (k * u_p + ph); return vec2(cos(a), sin(a)); }
float lsin(float k, float ph) { return sin(TAU * (k * u_p + ph)); }
float lsaw(float k, float ph) { return fract(k * u_p + ph); }

// ---- simplex noise 3D / 4D (Ashima Arts, MIT) ----
vec4 M_mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 M_mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
float M_mod289(float x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 M_perm(vec4 x) { return M_mod289(((x * 34.0) + 1.0) * x); }
float M_perm(float x) { return M_mod289(((x * 34.0) + 1.0) * x); }
vec4 M_tis(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float M_tis(float r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = M_mod289(i);
  vec4 p = M_perm(M_perm(M_perm(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = M_tis(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0); m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
vec4 M_grad4(float j, vec4 ip) {
  const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0); vec4 p, s;
  p.xyz = floor(fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0; p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
  s = vec4(lessThan(p, vec4(0.0))); p.xyz = p.xyz + (s.xyz * 2.0 - 1.0) * s.www; return p;
}
float snoise(vec4 v) {
  const vec4 C = vec4(0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);
  vec4 i = floor(v + dot(v, vec4(0.309016994374947451))); vec4 x0 = v - i + dot(i, C.xxxx);
  vec4 i0; vec3 isX = step(x0.yzw, x0.xxx); vec3 isYZ = step(x0.zww, x0.yyz);
  i0.x = isX.x + isX.y + isX.z; i0.yzw = 1.0 - isX; i0.y += isYZ.x + isYZ.y; i0.zw += 1.0 - isYZ.xy; i0.z += isYZ.z; i0.w += 1.0 - isYZ.z;
  vec4 i3 = clamp(i0, 0.0, 1.0); vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0); vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
  vec4 x1 = x0 - i1 + C.xxxx; vec4 x2 = x0 - i2 + C.yyyy; vec4 x3 = x0 - i3 + C.zzzz; vec4 x4 = x0 + C.wwww;
  i = M_mod289(i);
  float j0 = M_perm(M_perm(M_perm(M_perm(i.w) + i.z) + i.y) + i.x);
  vec4 j1 = M_perm(M_perm(M_perm(M_perm(i.w + vec4(i1.w, i2.w, i3.w, 1.0)) + i.z + vec4(i1.z, i2.z, i3.z, 1.0)) + i.y + vec4(i1.y, i2.y, i3.y, 1.0)) + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
  vec4 ip = vec4(1.0 / 294.0, 1.0 / 49.0, 1.0 / 7.0, 0.0);
  vec4 p0 = M_grad4(j0, ip); vec4 p1 = M_grad4(j1.x, ip); vec4 p2 = M_grad4(j1.y, ip); vec4 p3 = M_grad4(j1.z, ip); vec4 p4 = M_grad4(j1.w, ip);
  vec4 norm = M_tis(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w; p4 *= M_tis(dot(p4, p4));
  vec3 m0 = max(0.6 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2)), 0.0); vec2 m1 = max(0.6 - vec2(dot(x3, x3), dot(x4, x4)), 0.0);
  m0 = m0 * m0; m1 = m1 * m1;
  return 49.0 * (dot(m0 * m0, vec3(dot(p0, x0), dot(p1, x1), dot(p2, x2))) + dot(m1 * m1, vec2(dot(p3, x3), dot(p4, x4))));
}
// Loop noise: space x, travels a circle of radius r in the 4th dimension k times per loop.
float ln2(vec2 x, float k, float r) { return snoise(vec4(x + M_seedOff(), r * lc(k, 0.0))); }
float ln3(vec3 x, float k, float r) { vec2 c = r * lc(k, 0.0); return snoise(vec4(x.xy + M_seedOff(), x.z + c.x, c.y)); }
float lfbm(vec2 x, int oct, float k, float r) {
  float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * ln2(x, k, r); x = m * x + 11.7; a *= 0.5; }
  return s;
}
float lfbm3(vec3 x, int oct, float k, float r) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 8; i++) { if (i >= oct) break; s += a * ln3(x, k, r); x = x * 2.02 + vec3(7.1, 3.3, 1.9); a *= 0.5; }
  return s;
}
float lridge(vec2 x, int oct, float k, float r) {
  float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 8; i++) { if (i >= oct) break; float n = 1.0 - abs(ln2(x, k, r)); s += a * n * n; x = m * x + 5.3; a *= 0.5; }
  return s;
}
// Loop-animated Voronoi: sites orbit their cell centre (amp) k times per loop.
// Returns (F1, F2, cell id hash); .w of M_voroId gives the nearest site's cell coords.
vec3 lvoro(vec2 x, float jit, float k, float amp) {
  vec2 n = floor(x), f = fract(x); float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)); vec2 h = h22(n + g);
    vec2 o = 0.5 + jit * (h - 0.5) + amp * lc(k, h.x) * 0.5 * (0.5 + h.y);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; id = h.x; } else if (d < d2) d2 = d;
  }
  return vec3(d1, d2, id);
}

// ---- shapes ----
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = sat(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h); }
float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float sdBox3(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdTorus(vec3 p, vec2 t) { vec2 q = vec2(length(p.xz) - t.x, p.y); return length(q) - t.y; }
float glowd(float d, float w) { return w / (abs(d) + w); }
float glow2(float d, float w) { float x = d / w; return 1.0 / (1.0 + x * x); }
float gauss1(float d, float w) { return exp(-d * d / (w * w)); }
float line(float d, float w) { return 1.0 - smoothstep(w * 0.5, w * 0.5 + 1.5 / min(u_res.x, u_res.y), d); }
float aa() { return 1.5 / min(u_res.x, u_res.y); }

// ---- colour ----
vec3 ramp(float t) { // bg -> a2 -> a0 -> a1 -> ink
  t = sat(t) * 4.0;
  if (t < 1.0) return mix(u_bg, u_a2, t);
  if (t < 2.0) return mix(u_a2, u_a0, t - 1.0);
  if (t < 3.0) return mix(u_a0, u_a1, t - 2.0);
  return mix(u_a1, u_ink, t - 3.0);
}
vec3 accent(float i) { float j = mod(floor(i), 3.0); return j < 0.5 ? u_a0 : j < 1.5 ? u_a1 : u_a2; }
vec3 hot(float t) { t = max(t, 0.0); return mix(u_a2, u_a0, sat(t * 1.4)) * sat(t * 3.0) + u_ink * max(t - 0.6, 0.0) * 1.2 + u_a1 * sat(t - 1.0) * 0.5; }
vec3 aces(vec3 x) { return sat((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)); }
vec3 bb(float T) { // approx blackbody tint, T in 1000..12000 K
  T = clamp(T, 1000.0, 40000.0) / 100.0; vec3 c;
  c.r = T <= 66.0 ? 1.0 : sat(1.2929 * pow(T - 60.0, -0.1332));
  c.g = T <= 66.0 ? sat(0.3901 * log(T) - 0.6318) : sat(1.1298 * pow(T - 60.0, -0.0755));
  c.b = T >= 66.0 ? 1.0 : (T <= 19.0 ? 0.0 : sat(0.5432 * log(T - 10.0) - 1.1963));
  return c * c;
}
// Emissive content: premultiplied, alpha = brightness (reads well over any background).
vec4 emit(vec3 c) { c = max(c, 0.0); return vec4(c, max(c.r, max(c.g, c.b))); }
vec4 solid(vec3 c, float a) { return vec4(c * a, a); }
vec4 over(vec4 top, vec4 base) { return top + base * (1.0 - top.a); }
vec4 addc(vec4 a, vec4 b) { return vec4(a.rgb + b.rgb, max(a.a, b.a)); }

// ---- time slots with the photosensitive limiter ----
// n slots per loop; when u_safe is on, at most 3 changes per second (WCAG 2.3.1).
// Under the limiter a rate can drop to 0 (frozen) when even one change per loop would exceed 3 Hz.
float M_rate(float n) { n = max(0.0, floor(n + 0.5)); return u_safe > 0.5 ? min(n, floor(3.0 * u_L)) : n; }
float tslot(float n) { float r = M_rate(n); return r < 1.0 ? 0.0 : floor(fract(u_p) * r); }
float tfrac(float n) { float r = M_rate(n); return r < 1.0 ? 0.0 : fract(fract(u_p) * r); }
// Integer cycles-per-loop for anything that flashes (beams, merger flashes): capped under the limiter.
float safeCycles(float k) { return M_rate(k); }
// Periodic strobe 0..1 at k cycles per loop (capped under the limiter), duty 0..1, soft edges.
float strobe(float k, float duty) { float r = M_rate(k); if (r < 1.0) return duty; float f = fract(u_p * r); float soft = u_safe > 0.5 ? 0.18 : 0.02; return smoothstep(0.0, soft, f) * (1.0 - smoothstep(duty, duty + soft, f)); }
// Flash intensity limiter: scales large full-field luminance swings under the safe mode.
float flashAmt(float x) { return u_safe > 0.5 ? x * 0.35 : x; }

// ---- loop envelopes ----
// Travelling pulse train along a coordinate s: k pulses per loop, phase ph, width wd (in s units).
float pulse(float s, float k, float ph, float wd) { float x = fract(s - k * u_p - ph); return exp(-x * x / (wd * wd)) + exp(-(1.0 - x) * (1.0 - x) / (wd * wd)); }
// 0 -> 1 -> 0 envelope over the loop with a hold fraction h at full.
float growEnv(float h) { float x = fract(u_p); float a = (1.0 - h) * 0.5; return smoothstep(0.0, a, x) * (1.0 - smoothstep(1.0 - a * 0.6, 1.0, x)); }

// ---- coordinates ----
vec2 M_uv(vec2 fc) { return (fc - 0.5 * u_res) / min(u_res.x, u_res.y); }
vec2 M_asp() { return u_res / min(u_res.x, u_res.y); } // half-extent*2 of uv space
vec4 buf(sampler2D b, vec2 fc) { return texture(b, fc / u_res); }
`;

// kit-gl/prelude-125 — appended after PRELUDE only for kits that declare "sdk": "1.2.5" (or use a 1.2.5 input), so
// 1.2.0 kits never see these names. Everything here is deterministic and loop-safe.
const PRELUDE_125 = `
// ================= SDK 1.2.5 =================
// ---- blend modes (index = order of the "blend" select options) ----
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
// ---- play modes (index = order of the "dir" select options) and edge modes ----
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
// Clip position in cycles for a loop phase ph. k = cycles per loop (rounded to a whole number, so the loop closes).
//   PM_FORWARD  k*ph          PM_BACKWARD  -k*ph (both unbounded; use fract() or a whole-tile offset to wrap)
//   PM_PINGPONG 0..1..0, k round trips per loop
//   PM_RANDOM   like ping-pong but every round trip goes out the forward or the backward way, chosen by a seeded hash
// salt (any whole number) decorates the hash so two layers with the same settings do not move in lockstep.
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
float M_clip(float pos) { return pos - floor(pos); } // playhead -> 0..1 position inside a clip

// ---- cues inside a shader: run something during part of the loop ----
// cueP: local phase 0..1 inside the window [at, at+len) (wraps past the loop end), or -1 outside it.
float cueP(float at, float len) { float x = fract(u_p - at); return x < len ? x / max(len, 1e-5) : -1.0; }
// cueEnv: 0..1 envelope for the window, with fade-in fi and fade-out fo as fractions of len.
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
// Sample a media texture at (possibly out of range) q with an edge mode; mip selection uses the unwrapped coordinate.
vec4 M_tex(sampler2D t, vec2 qq, int edge) {
  vec2 dx = dFdx(qq), dy = dFdy(qq), w = qq; float inside = 1.0;
  if (edge == 0) { vec2 m = min(qq, 1.0 - qq) / max(fwidth(qq), vec2(1e-6)); inside = clamp(min(m.x, m.y) + 0.5, 0.0, 1.0); w = clamp(qq, 0.0, 1.0); }
  else if (edge == 1) w = fract(qq);
  else if (edge == 2) w = 1.0 - abs(mod(qq, 2.0) - 1.0);
  else w = clamp(qq, 0.0, 1.0);
  return textureGrad(t, w, dx, dy) * inside;
}

// ---- vector shapes (signed distance, uv units, negative inside) ----
float M_d2(vec2 v) { return dot(v, v); }
float sdCircle(vec2 p, float r) { return length(p) - r; }
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float sdRing(vec2 p, float r, float w) { return abs(length(p) - r) - 0.5 * w; }
// Regular polygon, circumradius r, n sides, one vertex pointing up. Exact inside, a tight bound outside.
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
// Unsigned distance to a quadratic Bezier A-B-C (stroke it with  abs(d) - w/2  or  d - w/2).
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
// Fill + outline + glow in one call. Premultiplied linear. lw / gw of 0 switch the outline / glow off.
vec4 vpaint(float d, vec3 fill, vec3 line, float lw, vec3 glowc, float gw) {
  vec4 c = vec4(glowc * (gw > 0.0 ? vglow(d, gw) * 0.6 : 0.0), 0.0); c.a = max(c.r, max(c.g, c.b));
  c = over(solid(fill, vfill(d)), c);
  return lw > 0.0 ? over(solid(line, vstroke(d, lw)), c) : c;
}
`;

const MAIN_FINAL = `
float M_dither(vec2 fc) { return M_u2f(M_pcg(uint(fc.x) * 1973u ^ M_pcg(uint(fc.y) * 9277u))) - 0.5; }
vec3 M_srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec2 fc = gl_FragCoord.xy;
  vec4 c = motif(M_uv(fc), fc);
  if (any(isnan(c))) c = vec4(0.0);
  c = max(c, vec4(0.0));
  float a = clamp(max(c.a, max(c.r, max(c.g, c.b))), 0.0, 1.0);
  vec3 s = a > 1e-5 ? clamp(c.rgb / a, 0.0, 1.0) : vec3(0.0);
  s = M_srgb(s) + M_dither(fc) / 255.0;
  M_out = vec4(clamp(s, 0.0, 1.0) * a, a);
}
`;
const MAIN_PASS = `
void main() { vec2 fc = gl_FragCoord.xy; vec4 c = motif(M_uv(fc), fc); if (any(isnan(c))) c = vec4(0.0); M_out = c; }
`;

// kit-gl/validate — manifest + file validation for .motifkit packages (motif-kit@1).
// Pure (no DOM). Shared by the app's Kit Manager and the SDK CLI.
const KIT_FORMAT = 'motif-kit@1';
const SDK_VERSION = '1.2.5';
// 1.2.5: `params` still counts only what the author declares; generated block params (layer stacks, svg/text inputs) are extra.
const KIT_LIMITS = { styles: 40, params: 32, passes: 4, fileBytes: 96 * 1024, kitBytes: 3 * 1024 * 1024, palettes: 8, inputs: 2, expanded: 128,
  svg: 2, text: 2, layers: 3, svgBytes: 64 * 1024, fonts: 2, fontBytes: 1536 * 1024, sequences: 8, textMax: 120, samplers: 9 };
// Media inputs (SDK 1.1): an image or video the user attaches to a layer, sampled in GLSL as u_<id>.
const INPUT_RE = /^[a-z][a-zA-Z0-9]{0,15}$/;
const INPUT_TYPES = ['image', 'video', 'media', 'svg', 'text'];
const MEDIA_TYPES = ['image', 'video', 'media'];
const INPUT_FITS = ['fill', 'fit', 'stretch'];
const INPUT_RESERVED = new Set(['res', 'p', 'l', 'seed', 'safe', 'bg', 'ink', 'a0', 'a1', 'a2', 'buf0', 'buf1', 'buf2', 'buf3', 'out']);
// A `show` condition hides a control unless another control has a given value.
//   { "param": "mode", "is": "ripple" }   { "param": "mode", "is": ["a","b"] }   { "param": "mode", "not": "off" }
//   { "param": "count", "gt": 3 }   { "param": "glow", "lt": 0.5 }   toggles use true / false.
function normShow(sh, raw, self) {
  if (!sh || typeof sh !== 'object' || Array.isArray(sh)) return 'must be an object like { "param": "mode", "is": "ripple" }.';
  const t = raw[sh.param];
  if (!t || sh.param === self) return `"${sh.param}" is not another param of this style.`;
  if (!['range', 'int', 'toggle', 'select'].includes(t.type)) return `"${sh.param}" is a ${t.type}; a condition can only read a range, int, toggle or select.`;
  const out = { param: sh.param };
  if ('is' in sh) out.is = Array.isArray(sh.is) ? sh.is.slice(0, 12) : sh.is;
  else if ('not' in sh) out.not = Array.isArray(sh.not) ? sh.not.slice(0, 12) : sh.not;
  else if (Number.isFinite(Number(sh.gt))) out.gt = Number(sh.gt);
  else if (Number.isFinite(Number(sh.lt))) out.lt = Number(sh.lt);
  else return 'needs one of is, not, gt or lt.';
  if (t.type === 'select' && ('is' in out || 'not' in out)) { const vals = [].concat(out.is !== undefined ? out.is : out.not); const known = (t.options || []).map(x => (typeof x === 'string' ? x : x && x.v)); if (vals.some(v => !known.includes(v))) return `value not among ${sh.param}'s options.`; }
  return out;
}
function normInputs(list, where, err) {
  if (list == null) return null;
  if (!Array.isArray(list)) { err(`${where}inputs must be an array.`); return []; }
  const out = [], seen = new Set(), n = { media: 0, svg: 0, text: 0 };
  list.forEach((x, i) => {
    const w = `${where}inputs[${i}]`;
    if (!x || !INPUT_RE.test(x.id || '')) return err(`${w}.id must be camelCase letters/digits (max 16), e.g. "source".`);
    if (INPUT_RESERVED.has(String(x.id).toLowerCase())) return err(`${w}.id "${x.id}" clashes with a built-in uniform.`);
    if (seen.has(x.id)) return err(`${w}: duplicate input id "${x.id}".`); seen.add(x.id);
    const type = x.type == null ? 'media' : x.type;
    if (!INPUT_TYPES.includes(type)) return err(`${w}.type must be image, video, media, svg or text.`);
    const cls = MEDIA_TYPES.includes(type) ? 'media' : type, cap = cls === 'media' ? KIT_LIMITS.inputs : KIT_LIMITS[cls];
    if (++n[cls] > cap) return err(`${where}inputs: at most ${cap} ${cls === 'media' ? 'media' : cls} inputs.`);
    const base = { id: x.id, type, label: String(x.label || x.id[0].toUpperCase() + x.id.slice(1)).slice(0, 20), hint: String(x.hint || '').slice(0, 120) };
    if (cls === 'media') {
      const fit = x.fit == null ? 'fill' : x.fit;
      if (!INPUT_FITS.includes(fit)) return err(`${w}.fit must be fill, fit or stretch.`);
      return out.push({ id: x.id, type, label: String(x.label || x.id[0].toUpperCase() + x.id.slice(1)).slice(0, 24), fit, required: !!x.required, hint: base.hint });
    }
    // Vector / type inputs (SDK 1.2.5): baked by the host into a signed-distance texture.
    const spread = x.spread == null ? 24 : Number(x.spread);
    if (!(spread >= 8 && spread <= 64)) return err(`${w}.spread must be 8–64 (pixels of distance stored around the edge).`);
    const o = { ...base, spread, controls: x.controls !== false };
    if (type === 'svg') {
      if (x.src != null && typeof x.src !== 'string') return err(`${w}.src must be a path to an .svg file in the kit.`);
      o.src = x.src || null; o.margin = x.margin == null ? 0.08 : Number(x.margin);
      if (!(o.margin >= 0 && o.margin <= 0.4)) return err(`${w}.margin must be 0–0.4 (fraction of the frame).`);
    } else {
      const def = x.def == null ? 'MOTIF' : String(x.def);
      if (def.length > KIT_LIMITS.textMax) return err(`${w}.def is longer than ${KIT_LIMITS.textMax} characters.`);
      const size = x.size == null ? 0.22 : Number(x.size), weight = x.weight == null ? 700 : Number(x.weight);
      if (!(size >= 0.05 && size <= 1)) return err(`${w}.size must be 0.05–1 (fraction of the frame height).`);
      if (!(weight >= 100 && weight <= 900)) return err(`${w}.weight must be 100–900.`);
      Object.assign(o, { def, font: String(x.font || 'sans'), size, weight });
    }
    out.push(o);
  });
  return out;
}
const isSdfInput = q => q.type === 'svg' || q.type === 'text';
const isMediaInput = q => !isSdfInput(q);

// ---- generated parameter blocks (SDK 1.2.5) ----
// Layer stacks, svg inputs and text inputs come with ready-made controls. They are generated, not declared, so they do not
// count against the 32-param limit, and every one is an ordinary channel (keyframes, locks, Mutate, audio mapping, presets).
// `bake: true` marks controls that change the baked texture (text, font, size...); the host rebakes on change and does not keyframe them.
const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'softlight', 'hardlight', 'add', 'darken', 'lighten', 'difference', 'exclusion', 'dodge'];
const BLEND_LABELS = ['Normal', 'Multiply', 'Screen', 'Overlay', 'Soft light', 'Hard light', 'Add', 'Darken', 'Lighten', 'Difference', 'Exclusion', 'Colour dodge'];
const PLAY_MODES = ['forward', 'backward', 'pingpong', 'random'];
const PLAY_LABELS = ['Forward', 'Backward', 'Ping-pong', 'Random'];
const EDGE_MODES = ['clip', 'repeat', 'mirror', 'extend'];
const EDGE_LABELS = ['Clip', 'Repeat', 'Mirror', 'Extend'];
const FONT_GENERIC = ['sans', 'serif', 'mono', 'rounded'];
const FONT_STACKS = {
  sans: 'ui-sans-serif, system-ui, "Helvetica Neue", Arial, sans-serif', serif: 'ui-serif, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace', rounded: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif',
};
const optList = (ids, labels) => ids.map((v, i) => ({ v, l: labels[i] }));
function blockParams(q, kind, fontIds, layer) {
  const id = q.id, g = (kind === 'layer' ? `Layer ${layer.i}` : q.label).slice(0, 20), P = {};
  const base = (label, extra) => ({ label: label.slice(0, 24), group: g, gen: id, ...extra });
  const add = (k, label, o) => { P[id + k] = base(label, o); };
  const point = (k, label, lo, hi, def, o) => ['X', 'Y'].forEach((c, i) => { P[id + k + c] = base(`${label} ${c}`, { type: 'range', min: lo, max: hi, def: def[i], step: +((hi - lo) / 400).toPrecision(2), mutate: 0.5, part: { of: id + k, kind: 'point', i, label }, ...o }); });
  const moving = { param: id + 'Speed', gt: 0 };
  if (kind === 'text') {
    add('Text', 'Text', { type: 'text', def: q.def, max: KIT_LIMITS.textMax, mutate: 0, bake: true, hint: 'Use \\n for a line break.' });
    const fonts = optList([...FONT_GENERIC, ...fontIds], [...FONT_GENERIC.map(f => f[0].toUpperCase() + f.slice(1)), ...fontIds]);
    add('Font', 'Font', { type: 'select', options: fonts, def: fonts.some(f => f.v === q.font) ? q.font : 'sans', mutate: 0, bake: true });
    add('Size', 'Size', { type: 'range', min: 0.05, max: 1, def: q.size, step: 0.005, mutate: 0, bake: true, hint: 'Cap height as a fraction of the frame; animate with Scale.' });
    add('Weight', 'Weight', { type: 'range', min: 100, max: 900, def: q.weight, step: 100, mutate: 0, bake: true });
    add('Track', 'Tracking', { type: 'range', min: -0.1, max: 0.5, def: 0, step: 0.005, mutate: 0, bake: true, unit: 'em' });
    add('Lead', 'Line height', { type: 'range', min: 0.7, max: 2, def: 1.1, step: 0.01, mutate: 0, bake: true });
    add('Align', 'Align', { type: 'select', options: optList(['left', 'center', 'right'], ['Left', 'Centre', 'Right']), def: 'center', mutate: 0, bake: true });
  }
  add('Opacity', 'Opacity', { type: 'range', min: 0, max: 1, def: 1, step: 0.01, mutate: 0.3 });
  if (kind === 'layer') add('Blend', 'Blend', { type: 'select', options: optList(BLEND_MODES, BLEND_LABELS), def: layer.blend, mutate: 0, hint: 'Layer mode against everything below it.' });
  point('Pos', 'Offset', -1, 1, [0, 0], { hint: 'Position in frame units.' });
  add('Scale', 'Scale', { type: 'range', min: 0.1, max: 4, def: 1, step: 0.01, log: true, mutate: 0.4 });
  add('Rot', 'Rotate', { type: 'range', min: -180, max: 180, def: 0, step: 0.5, unit: '°', mutate: 0.3 });
  if (kind === 'layer') add('Edge', 'Edges', { type: 'select', options: optList(EDGE_MODES, EDGE_LABELS), def: 'clip', mutate: 0, hint: 'What shows beyond the image. Scrolling always repeats.' });
  add('Speed', 'Cycles / loop', { type: 'int', min: 0, max: 8, def: 0, step: 1, mutate: 0, hint: 'Whole cycles per loop, so the loop closes. 0 holds still.' });
  add('Dir', 'Direction', { type: 'select', options: optList(PLAY_MODES, PLAY_LABELS), def: 'forward', mutate: 0, show: moving, hint: 'Forward, backward, ping-pong, or each round trip goes a random way.' });
  point('Motion', 'Travel', -3, 3, [1, 0], { show: moving, hint: 'Tiles per cycle. Forward and backward snap to whole tiles (so the loop closes); ping-pong and random use any distance.' });
  if (kind === 'svg') add('Margin', 'Margin', { type: 'range', min: 0, max: 0.4, def: q.margin, step: 0.005, mutate: 0, bake: true });
  return P;
}
// GLSL for the generated blocks. Layers: L_get<i>(uv), L_get(i, uv), L_stack(base, uv), L_over(uv).
// Svg / text: vec_<id>(uv) signed distance (uv units, negative inside), vecA_<id>(uv) coverage x opacity.
function blockSource(inputs) {
  const layers = (inputs || []).filter(q => q.stack).sort((a, b) => a.stack - b.stack), sdf = (inputs || []).filter(isSdfInput);
  if (!layers.length && !sdf.length) return '';
  const motion = (n, salt) => `  float ph = M_playhead(float(p_${n}Speed), p_${n}Dir, ${salt}.0);
  bool sc = p_${n}Dir < 2 && p_${n}Speed > 0;
  vec2 mo = vec2(p_${n}MotionX, p_${n}MotionY); if (sc) mo = floor(mo + 0.5);
  vec2 drift = p_${n}Speed > 0 ? mo * ph : vec2(0.0);
  bool wrap = sc && (mo.x != 0.0 || mo.y != 0.0);
  vec2 tq = M_xf(uv, vec2(p_${n}PosX, p_${n}PosY), p_${n}Scale, p_${n}Rot, drift);
`;
  let s = '\n// ---- generated blocks (SDK 1.2.5) ----\n';
  layers.forEach(q => {
    const n = q.id;
    s += `vec4 L_get${q.stack}(vec2 uv) {\n  if (u_${n}On < 0.5) return vec4(0.0);\n${motion(n, q.stack)}  return M_tex(u_${n}, tq, wrap ? EM_REPEAT : p_${n}Edge);\n}\n`;
  });
  if (layers.length) {
    s += `vec4 L_get(int i, vec2 uv) {\n${layers.map(q => `  if (i == ${q.stack}) return L_get${q.stack}(uv);`).join('\n')}\n  return vec4(0.0);\n}\n`;
    s += `float L_opacity(int i) {\n${layers.map(q => `  if (i == ${q.stack}) return p_${q.id}Opacity;`).join('\n')}\n  return 0.0;\n}\n`;
    s += `vec4 L_stack(vec4 base, vec2 uv) {\n${layers.map(q => `  base = blendOver(p_${q.id}Blend, base, L_get${q.stack}(uv), p_${q.id}Opacity);`).join('\n')}\n  return base;\n}\nvec4 L_over(vec2 uv) { return L_stack(vec4(0.0), uv); }\n`;
  }
  sdf.forEach((q, i) => {
    const n = q.id;
    s += `float vec_${n}(vec2 uv) {\n  if (u_${n}On < 0.5) return 1e3;\n${motion(n, 20 + i)}  if (wrap) tq = fract(tq);\n  vec2 c = clamp(tq, 0.0, 1.0);
  float d = (texture(u_${n}, c).r - 0.5) * 2.0 * u_${n}Spread;
  d += length(max(abs(tq - 0.5) - 0.5, 0.0) * M_asp());
  return d * max(p_${n}Scale, 1e-3);\n}\n`;
    s += `float vecA_${n}(vec2 uv) { return vfill(vec_${n}(uv)) * p_${n}Opacity; }\n`;
  });
  return s;
}

const ID_RE = /^[a-z][a-z0-9-]{1,31}$/;
const KEY_RE = /^[a-z][a-zA-Z0-9]{0,23}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const RESERVED_KITS = new Set(['core', 'motif', 'builtin', 'all']);

function validateKit(manifest, files, opts) {
  opts = opts || {};
  const errors = [], warnings = [];
  const err = m => errors.push(m), warn = m => warnings.push(m);
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['manifest.json is missing or not an object.'], warnings };
  const m = manifest;
  if (m.format !== KIT_FORMAT) err(`format must be "${KIT_FORMAT}" (got ${JSON.stringify(m.format)}).`);
  if (!ID_RE.test(m.id || '')) err('id must be 2–32 chars: lowercase letters, digits and hyphens, starting with a letter.');
  else if (RESERVED_KITS.has(m.id)) err(`id "${m.id}" is reserved.`);
  if (!m.name || String(m.name).length > 32) err('name is required (max 32 chars).');
  if (!SEMVER_RE.test(m.version || '')) err('version must be semver, e.g. "1.0.0".');
  if (m.accent && !HEX_RE.test(m.accent)) err('accent must be a #RRGGBB colour.');
  // "sdk" is the minimum SDK the kit was written for. 1.2.5 features need "sdk": "1.2.5"; older kits compile unchanged.
  let sdk = null;
  if (m.sdk != null) { if (!SEMVER_RE.test(m.sdk)) err('sdk must be semver, e.g. "1.2.5".'); else if (cmpVer(m.sdk, SDK_VERSION) > 0) err(`This kit needs SDK ${m.sdk}; this runtime is ${SDK_VERSION}.`); else sdk = m.sdk; }
  const is125 = !!sdk && cmpVer(sdk, '1.2.5') >= 0;
  let used125 = '';
  const need125 = what => { if (!used125) used125 = what; };
  let total = 0; for (const [k, v] of Object.entries(files || {})) { const n = typeof v === 'string' ? v.length : (v && v.byteLength) || 0; total += n; if (/\.glsl$/.test(k) && n > KIT_LIMITS.fileBytes) err(`${k} is larger than ${KIT_LIMITS.fileBytes / 1024} KB.`); }
  if (total > KIT_LIMITS.kitBytes) err(`Kit is larger than ${KIT_LIMITS.kitBytes / 1048576} MB.`);
  const fileText = p => { const v = files && files[p]; return typeof v === 'string' ? v : null; };
  const common = m.common ? fileText(m.common) : '';
  if (m.common && common == null) err(`common file "${m.common}" is not in the package.`);
  if (common && /\bvoid\s+main\s*\(/.test(common)) err('common.glsl must not define main().');
  // Fonts (SDK 1.2.5): bundled typefaces for text inputs, so type renders the same on every machine.
  const fonts = [];
  if (m.fonts != null && !Array.isArray(m.fonts)) err('fonts must be an array.');
  (Array.isArray(m.fonts) ? m.fonts : []).forEach((f, i) => {
    const w = `fonts[${i}]`; need125('fonts');
    if (!f || !INPUT_RE.test(f.id || '') || FONT_GENERIC.includes(f.id)) return err(`${w}.id must be camelCase letters/digits (max 16) and not sans, serif, mono or rounded.`);
    if (fonts.some(x => x.id === f.id)) return err(`${w}: duplicate font id "${f.id}".`);
    if (!/^fonts\/[\w.-]+\.(woff2|woff|ttf|otf)$/i.test(f.file || '')) return err(`${w}.file must be a woff2, woff, ttf or otf file under fonts/.`);
    const b = files && files[f.file]; if (b == null) return err(`${w}: file "${f.file}" is not in the package.`);
    const len = typeof b === 'string' ? b.length : b.byteLength; if (len > KIT_LIMITS.fontBytes) return err(`${w}: ${f.file} is larger than ${KIT_LIMITS.fontBytes / 1024} KB. Subset the font.`);
    if (typeof b !== 'string' && len >= 4) { const sig = String.fromCharCode(b[0], b[1], b[2], b[3]); if (!['wOF2', 'wOFF', 'OTTO', '\u0000\u0001\u0000\u0000', 'true'].includes(sig)) return err(`${w}: ${f.file} does not look like a font file.`); }
    fonts.push({ id: f.id, file: f.file, family: String(f.family || f.id).slice(0, 40), weight: Number(f.weight) || 400, license: String(f.license || '').slice(0, 48) });
  });
  if (fonts.length > KIT_LIMITS.fonts) err(`At most ${KIT_LIMITS.fonts} bundled fonts.`);
  // Palettes
  const palettes = [];
  if (m.palettes != null && !Array.isArray(m.palettes)) err('palettes must be an array.');
  (m.palettes || []).slice(0, KIT_LIMITS.palettes).forEach((p, i) => {
    const where = `palettes[${i}]`;
    if (!p || !ID_RE.test(p.id || '')) return err(`${where}.id is invalid.`);
    const cols = [p.bg, p.ink, ...(Array.isArray(p.a) ? p.a : [])];
    if (!Array.isArray(p.a) || p.a.length !== 3 || !cols.every(c => HEX_RE.test(c || ''))) return err(`${where} needs bg, ink and exactly three accents as #RRGGBB.`);
    palettes.push({ id: `${m.id}.${p.id}`, name: String(p.name || p.id).slice(0, 24), bg: p.bg.toUpperCase(), ink: p.ink.toUpperCase(), a: p.a.map(c => c.toUpperCase()), kit: m.id });
  });
  if ((m.palettes || []).length > KIT_LIMITS.palettes) warn(`Only the first ${KIT_LIMITS.palettes} palettes are used.`);
  const kitInputs = normInputs(m.inputs, '', err);
  // Styles
  const styles = [], seen = new Set();
  if (!Array.isArray(m.styles) || !m.styles.length) err('styles must be a non-empty array.');
  else if (m.styles.length > KIT_LIMITS.styles) err(`A kit can hold at most ${KIT_LIMITS.styles} styles.`);
  (Array.isArray(m.styles) ? m.styles : []).slice(0, KIT_LIMITS.styles).forEach((s, i) => {
    const where = `styles[${i}]${s && s.id ? ` (${s.id})` : ''}`;
    if (!s || !ID_RE.test(s.id || '')) return err(`${where}: id is invalid.`);
    if (seen.has(s.id)) return err(`${where}: duplicate id.`); seen.add(s.id);
    if (!s.name || String(s.name).length > 32) err(`${where}: name is required (max 32 chars).`);
    const passes = [];
    if (!Array.isArray(s.passes) || !s.passes.length || s.passes.length > KIT_LIMITS.passes) err(`${where}: passes must list 1–${KIT_LIMITS.passes} shader files.`);
    else s.passes.forEach((ps, j) => {
      const src = fileText(ps && ps.src);
      if (src == null) return err(`${where}: pass ${j + 1} file "${ps && ps.src}" is not in the package.`);
      if (!/\bvec4\s+motif\s*\(\s*vec2\s+\w+\s*,\s*vec2\s+\w+\s*\)/.test(src)) err(`${where}: ${ps.src} must define vec4 motif(vec2 uv, vec2 fc).`);
      if (/\bvoid\s+main\s*\(/.test(src)) err(`${where}: ${ps.src} must not define main(); the runtime supplies it.`);
      if (/\buniform\b/.test(src)) warn(`${where}: ${ps.src} declares its own uniforms; only params and u_ inputs are set by the runtime.`);
      const scale = ps.scale == null ? 1 : Number(ps.scale);
      if (!(scale >= 0.125 && scale <= 1)) err(`${where}: pass ${j + 1} scale must be 0.125–1.`);
      passes.push({ file: ps.src, src, scale });
    });
    const params = {};
    const raw = s.params || {};
    if (typeof raw !== 'object' || Array.isArray(raw)) err(`${where}: params must be an object.`);
    const keys = Object.keys(raw);
    if (keys.length > KIT_LIMITS.params) err(`${where}: at most ${KIT_LIMITS.params} params (a colour counts as one, a point as one).`);
    for (const k of keys.slice(0, KIT_LIMITS.params)) {
      const p = raw[k], pw = `${where}.params.${k}`;
      if (!KEY_RE.test(k)) { err(`${pw}: key must be camelCase letters/digits (max 24).`); continue; }
      if (['palette', 'invert', 'tempo', 'phase', 'seed', 'zoom', 'rotate', 'loop'].includes(k)) { err(`${pw}: "${k}" is a shared parameter name.`); continue; }
      if (!p || typeof p !== 'object') { err(`${pw}: must be an object.`); continue; }
      const label = String(p.label || k).slice(0, 24), o = { label };
      if (p.unit) o.unit = String(p.unit).slice(0, 4);
      if (p.mutate != null) o.mutate = Math.max(0, Math.min(1, Number(p.mutate) || 0));
      if (p.group != null && String(p.group).trim()) o.group = String(p.group).trim().slice(0, 20);
      if (p.hint != null && String(p.hint).trim()) o.hint = String(p.hint).trim().slice(0, 90);
      if (p.show != null) { const sh = normShow(p.show, raw, k); if (typeof sh === 'string') { err(`${pw}.show: ${sh}`); } else o.show = sh; }
      if (p.type === 'color') {
        if (!/^#[0-9a-fA-F]{6}$/.test(p.def || '')) { err(`${pw}: color needs def like "#FF8800".`); continue; }
        const rgb = [1, 3, 5].map(i => parseInt(p.def.slice(i, i + 1 + 1), 16) / 255);
        if (['R', 'G', 'B'].some(c => k.length + 1 > 24 || raw[k + c])) { err(`${pw}: "${k}R/G/B" would clash with another param or exceed 24 characters.`); continue; }
        ['R', 'G', 'B'].forEach((c, i) => { params[k + c] = { ...o, label: `${label} ${c}`.slice(0, 24), type: 'range', min: 0, max: 1, def: +rgb[i].toFixed(4), step: 0.001, mutate: o.mutate == null ? 0.5 : o.mutate, part: { of: k, kind: 'color', i, label } }; });
        continue;
      }
      if (p.type === 'point') {
        const lo = p.min == null ? -1 : Number(p.min), hi = p.max == null ? 1 : Number(p.max), d = p.def == null ? [0, 0] : p.def;
        if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(lo < hi)) { err(`${pw}: point needs numeric min < max.`); continue; }
        if (!Array.isArray(d) || d.length !== 2 || !d.every(x => Number.isFinite(Number(x)) && Number(x) >= lo && Number(x) <= hi)) { err(`${pw}: point def must be [x, y] within ${lo}–${hi}.`); continue; }
        if (['X', 'Y'].some(c => k.length + 1 > 24 || raw[k + c])) { err(`${pw}: "${k}X/Y" would clash with another param or exceed 24 characters.`); continue; }
        ['X', 'Y'].forEach((c, i) => { params[k + c] = { ...o, label: `${label} ${c}`.slice(0, 24), type: 'range', min: lo, max: hi, def: Number(d[i]), step: +((hi - lo) / 400).toPrecision(2), part: { of: k, kind: 'point', i, label } }; });
        continue;
      }
      if (p.type === 'range' || p.type === 'int') {
        const min = Number(p.min), max = Number(p.max), def = Number(p.def);
        if (![min, max, def].every(Number.isFinite) || !(min < max)) { err(`${pw}: needs numeric min < max and def.`); continue; }
        if (def < min || def > max) { err(`${pw}: def ${def} is outside ${min}–${max}.`); continue; }
        if (p.type === 'int' && ![min, max, def].every(Number.isInteger)) { err(`${pw}: int min, max and def must be integers.`); continue; }
        Object.assign(o, { type: p.type, min, max, def, step: p.type === 'int' ? 1 : Number(p.step) > 0 ? Number(p.step) : 0.01 });
        if (p.log) { if (min > 0) o.log = true; else warn(`${pw}: "log" needs min > 0; ignored.`); }
        if (p.randMax != null) { if (Number(p.randMax) > min && Number(p.randMax) <= max) o.randMax = Number(p.randMax); else warn(`${pw}: randMax must be within min–max; ignored.`); }
      } else if (p.type === 'toggle') Object.assign(o, { type: 'toggle', def: !!p.def });
      else if (p.type === 'select') {
        const opts = (Array.isArray(p.options) ? p.options : []).map(x => (typeof x === 'string' ? { v: x, l: x[0].toUpperCase() + x.slice(1) } : x && typeof x.v === 'string' ? { v: x.v, l: String(x.l || x.v) } : null)).filter(Boolean);
        if (opts.length < 2 || opts.length > 12) { err(`${pw}: select needs 2–12 options.`); continue; }
        if (!opts.every(x => /^[a-z][a-z0-9-]{0,23}$/.test(x.v))) { err(`${pw}: option values must be lowercase ids.`); continue; }
        Object.assign(o, { type: 'select', options: opts, def: opts.some(x => x.v === p.def) ? p.def : opts[0].v });
      } else { err(`${pw}: type must be range, int, toggle, select, color or point.`); continue; }
      params[k] = o;
    }
    if (Object.keys(params).length > 48) err(`${where}: colour and point params count as 3 and 2 uniforms; at most 48 declared uniforms (generated block controls are extra).`);
    if (keys.length < 4) warn(`${where}: fewer than 4 params gives Mutate and Evolve little to work with.`);
    // Media inputs: the style's own list wins, else the kit-level list. Kits written before SDK 1.1 that declare
    // \`uniform sampler2D u_<name>;\` themselves get an implicit input so they work unchanged.
    let inputs = normInputs(s.inputs, `${where}.`, err);
    if (inputs == null) inputs = kitInputs;
    if (inputs == null) {
      inputs = []; const text = [common || '', ...passes.map(x => x.src || '')].join('\n'); const re = /\buniform\s+sampler2D\s+u_([A-Za-z][A-Za-z0-9]{0,15})\s*;/g; let mm;
      while ((mm = re.exec(text)) && inputs.length < KIT_LIMITS.inputs) { const id = mm[1]; if (INPUT_RESERVED.has(id.toLowerCase()) || inputs.some(q => q.id === id)) continue; inputs.push({ id, type: 'media', label: id[0].toUpperCase() + id.slice(1), fit: 'fill', required: false, hint: '', implicit: true }); }
      if (inputs.length && !styles.some(x => x.inputs.some(q => q.implicit))) warn(`Declares ${inputs.map(q => 'u_' + q.id).join(', ')} without "inputs"; treated as media input${inputs.length > 1 ? 's' : ''}. Add "inputs": [{ "id": "${inputs[0].id}", "type": "media" }] to the manifest.`);
    }
    // Layer stack (SDK 1.2.5): up to 3 image/video layers with blend modes, opacity and independent motion.
    let stack = null;
    if (s.stack != null) {
      const st = s.stack, sw = `${where}.stack`;
      if (!st || typeof st !== 'object' || Array.isArray(st)) err(`${sw} must be an object like { "layers": 3 }.`);
      else {
        need125('stack');
        const n = st.layers == null ? 3 : st.layers, sid = st.id == null ? 'layer' : String(st.id), fit = st.fit == null ? 'fill' : st.fit;
        if (!Number.isInteger(n) || n < 1 || n > KIT_LIMITS.layers) err(`${sw}.layers must be 1–${KIT_LIMITS.layers}.`);
        else if (!/^[a-z][a-zA-Z0-9]{0,9}$/.test(sid)) err(`${sw}.id must be camelCase letters/digits (max 10).`);
        else if (!INPUT_FITS.includes(fit)) err(`${sw}.fit must be fill, fit or stretch.`);
        else {
          const defs = Array.isArray(st.defaults) ? st.defaults : [], labels = Array.isArray(st.labels) ? st.labels : [];
          stack = { id: sid, layers: n, fit, ids: [], labels: [] };
          for (let i = 1; i <= n; i++) {
            const d = defs[i - 1] || {}, id = sid + i;
            if (d.blend != null && !BLEND_MODES.includes(d.blend)) { err(`${sw}.defaults[${i - 1}].blend must be one of ${BLEND_MODES.join(', ')}.`); continue; }
            if (inputs.some(q => q.id === id)) { err(`${sw}: input "${id}" already exists.`); continue; }
            const label = String(labels[i - 1] || `Layer ${i}`).slice(0, 20);
            inputs = [...inputs, { id, type: 'media', label, hint: '', fit, required: false, stack: i, blend: d.blend || 'normal' }];
            stack.ids.push(id); stack.labels.push(label);
          }
        }
      }
    }
    // Generated parameter blocks for layers, svg and text inputs.
    const blocks = [];
    for (const q of inputs) {
      const kind = q.stack ? 'layer' : isSdfInput(q) ? q.type : null;
      if (!kind || q.controls === false) continue;
      need125(kind === 'layer' ? 'stack' : q.type);
      const gp = blockParams(q, kind, fonts.map(f => f.id), q.stack ? { i: q.stack, blend: q.blend } : null);
      let clash = false;
      for (const k of Object.keys(gp)) { if (k.length > 24) { err(`${where}: input id "${q.id}" is too long for its generated params (${k}).`); clash = true; break; } if (params[k] || raw[k]) { err(`${where}: param "${k}" clashes with the generated controls of input "${q.id}".`); clash = true; break; } }
      if (clash) continue;
      Object.assign(params, gp); blocks.push({ id: q.id, kind, label: q.label, group: Object.values(gp)[0].group });
      if (kind === 'text' && q.font && !FONT_GENERIC.includes(q.font) && !fonts.some(f => f.id === q.font)) err(`${where}: input "${q.id}" font "${q.font}" is not sans, serif, mono, rounded or a font declared in "fonts".`);
      if (kind === 'svg' && q.src) {
        const t = fileText(q.src);
        if (t == null) err(`${where}: input "${q.id}" src "${q.src}" is not in the package.`);
        else { const e = svgProblem(t); if (e) err(`${where}: ${q.src}: ${e}`); }
      }
    }
    if (Object.keys(params).length > KIT_LIMITS.expanded) err(`${where}: at most ${KIT_LIMITS.expanded} uniforms in total (generated block controls included).`);
    if (inputs.length > KIT_LIMITS.samplers) err(`${where}: at most ${KIT_LIMITS.samplers} textures (media, layers, svg and text inputs together).`);
    for (const q of inputs) if (params[q.id + 'On'] || (params[q.id] && !q.stack)) warn(`${where}: param "${q.id}" shares a name with media input "${q.id}".`);
    const pal = s.palette ? `${m.id}.${s.palette}` : null;
    if (pal && !palettes.some(p => p.id === pal)) warn(`${where}: palette "${s.palette}" is not defined by the kit.`);
    const cost = Math.max(0.25, Math.min(24, Number(s.cost) || 1));
    styles.push({ id: `${m.id}/${s.id}`, localId: s.id, cost, name: String(s.name || s.id).slice(0, 32), blurb: String(s.blurb || '').slice(0, 160), group: String(s.group || '').slice(0, 24), tags: (Array.isArray(s.tags) ? s.tags : []).map(String).slice(0, 8), palette: pal && palettes.some(p => p.id === pal) ? pal : null, flash: !!s.flash, passes, params, inputs, ...(stack ? { stack } : {}), ...(blocks.length ? { blocks } : {}), ...(is125 ? { sdk } : {}) });
  });
  // Sequences (SDK 1.2.5): ready-made cue lists that appear in the library as Sequencer items.
  const sequences = [], localIds = new Set(styles.map(x => x.localId));
  if (m.sequences != null && !Array.isArray(m.sequences)) err('sequences must be an array.');
  const sdeps = new Set();
  (Array.isArray(m.sequences) ? m.sequences : []).forEach((e, i) => {
    const w = `sequences[${i}]`; need125('sequences');
    if (sequences.length >= KIT_LIMITS.sequences) { if (i === KIT_LIMITS.sequences) err(`At most ${KIT_LIMITS.sequences} sequences per kit.`); return; }
    let raw = e;
    if (e && typeof e.file === 'string') { const t = fileText(e.file); if (t == null) return err(`${w}: file "${e.file}" is not in the package.`); try { raw = { ...JSON.parse(t), ...(e.id ? { id: e.id } : {}), ...(e.name ? { name: e.name } : {}) }; } catch (x) { return err(`${w}: ${e.file} is not valid JSON.`); } }
    const r = validateSequence(raw, { kitId: m.id, local: localIds, library: opts.library });
    r.warnings.forEach(x => warn(`${w} (${raw && raw.id}): ${x}`)); r.errors.forEach(x => err(`${w} (${raw && raw.id}): ${x}`));
    if (r.ok) { if (sequences.some(x => x.id === r.seq.id)) return err(`${w}: duplicate sequence id "${r.seq.id}".`); sequences.push(r.seq); r.deps.forEach(d => sdeps.add(d)); }
  });
  if (used125 && !is125) err(`This kit uses SDK 1.2.5 features (${used125}). Add "sdk": "1.2.5" to manifest.json.`);
  const ok = errors.length === 0;
  return { ok, errors, warnings, kit: ok ? { format: KIT_FORMAT, id: m.id, name: String(m.name), version: m.version, author: String(m.author || '').slice(0, 48), description: String(m.description || '').slice(0, 280), accent: m.accent || null, license: String(m.license || '').slice(0, 32), palettes, styles, common: common || '', sdk, fonts, sequences, requires: [...sdeps] } : null };
}

const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; };

// ---------------------------------------------------------------------------------------------------------------
// kit-gl/play — deterministic playhead and hash (JS twins of M_playheadAt / h11, bit-identical to the shader).
// The host uses these to drive video layers (seek to clipTime) and to plan sequences, so GPU and CPU always agree.
// ---------------------------------------------------------------------------------------------------------------
const PLAY_F32 = new Float32Array(1), PLAY_U32 = new Uint32Array(PLAY_F32.buffer);
function pcg(v) { const s = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0; const w = Math.imul(((s >>> ((s >>> 28) + 4)) ^ s) >>> 0, 277803737) >>> 0; return ((w >>> 22) ^ w) >>> 0; }
function seedU(seed) { return pcg(Math.imul(Math.floor(seed) >>> 0, 2654435761 | 0) >>> 0); }
function h11(x, seed) { PLAY_F32[0] = x + 0; return (pcg((PLAY_U32[0] ^ seedU(seed)) >>> 0) >>> 8) / 16777216; }
// k: cycles per loop (whole), mode: 0 forward 1 backward 2 pingpong 3 random (or the name), ph: loop phase, salt: whole number, seed: layer seed.
function playhead(k, mode, salt, ph, seed) {
  if (typeof mode === 'string') mode = PLAY_MODES.indexOf(mode);
  k = Math.floor(Math.max(k, 0) + 0.5); if (k < 1) return 0;
  const s = Math.fround(k * ph);
  if (mode === 0) return s; if (mode === 1) return -s;
  const i = Math.floor(s), f = s - i, tri = 1 - Math.abs(2 * f - 1);
  if (mode === 2) return tri;
  return (h11(i + salt * 97, seed == null ? 1 : seed) < 0.5 ? -1 : 1) * tri;
}
// Position inside a clip (0..1) for a playhead value; multiply by the duration to get the video time to seek to.
const clipPos = pos => pos - Math.floor(pos);
// Clip positions of a style's stack layers at loop phase p, from the same params the shader reads. Layers whose
// media is a video are seeked to clipPos(pos) * duration; { pos, clip } per layer id.
function stackPlayheads(style, params, p, seed) {
  const out = {}; if (!style || !style.stack) return out;
  style.stack.ids.forEach((id, i) => { const pos = playhead(params[id + 'Speed'] || 0, params[id + 'Dir'] || 'forward', i + 1, p, seed); out[id] = { pos, clip: clipPos(pos) }; });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// kit-gl/seq — the motif-seq@1 sequencer: cues that invoke styles from a library at points of the loop.
// A cue plays its style for `len` of the loop, `cycles` times (so it closes on itself), forward / backward / ping-pong /
// random, with fades, a blend mode and opacity. More than 4 layers over a loop, but never more than `maxActive` at once.
// ---------------------------------------------------------------------------------------------------------------
const SEQ_FORMAT = 'motif-seq@1';
const SEQ_LIMITS = { cues: 64, active: 4, lanes: 8, repeat: 16, cycles: 8, params: 64 };
const BLEND_CANVAS = { normal: 'source-over', multiply: 'multiply', screen: 'screen', overlay: 'overlay', softlight: 'soft-light', hardlight: 'hard-light', add: 'lighter', darken: 'darken', lighten: 'lighten', difference: 'difference', exclusion: 'exclusion', dodge: 'color-dodge' };
const CUE_ID_RE = /^[A-Za-z][\w-]{0,23}$/, STYLE_REF_RE = /^[A-Za-z0-9][\w.-]{0,63}(\/[A-Za-z0-9][\w.-]{0,63})?$/;
// A time is a number (fraction of the loop) or a string: "3/16", "25%", "1.5s" (needs loop), "2b" (needs loop and bpm).
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
// opt: { kitId, local: Set of this kit's style ids, library: ref => bool (optional), maxActive }
function validateSequence(raw, opt) {
  opt = opt || {}; const errors = [], warnings = [], err = m => errors.push(m), warn = m => warnings.push(m);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['A sequence must be an object.'], warnings, seq: null, deps: [] };
  if (raw.format != null && raw.format !== SEQ_FORMAT) err(`format must be "${SEQ_FORMAT}".`);
  if (!ID_RE.test(raw.id || '')) err('sequence id must be 2–32 chars: lowercase letters, digits and hyphens, starting with a letter.');
  const loop = raw.loop == null ? 0 : Number(raw.loop), bpm = raw.bpm == null ? 0 : Number(raw.bpm);
  if (raw.loop != null && !(loop > 0 && loop <= 600)) err('loop must be a number of seconds (0–600).');
  if (raw.bpm != null && !(bpm >= 20 && bpm <= 400)) err('bpm must be 20–400.');
  const maxActive = raw.maxActive == null ? (opt.maxActive || SEQ_LIMITS.active) : raw.maxActive;
  if (!Number.isInteger(maxActive) || maxActive < 1 || maxActive > SEQ_LIMITS.active) err(`maxActive must be 1–${SEQ_LIMITS.active}.`);
  const seed = raw.seed == null ? 1 : raw.seed; if (!Number.isInteger(seed) || seed < 1 || seed > 9999) err('seed must be a whole number 1–9999.');
  const src = Array.isArray(raw.cues) ? raw.cues : []; if (!Array.isArray(raw.cues) || !src.length) err('cues must be a non-empty array.');
  if (src.length > SEQ_LIMITS.cues) err(`At most ${SEQ_LIMITS.cues} cues.`);
  const ctx = { loop, bpm }, cues = [], ids = new Set(), deps = new Set();
  src.slice(0, SEQ_LIMITS.cues).forEach((c, n) => {
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
    const lane = c.lane == null ? 0 : c.lane; if (!Number.isInteger(lane) || lane < 0 || lane >= SEQ_LIMITS.lanes) return err(`${w}: lane must be 0–${SEQ_LIMITS.lanes - 1}.`);
    const fi = c.fadeIn == null ? 0.1 : Number(c.fadeIn), fo = c.fadeOut == null ? 0.1 : Number(c.fadeOut);
    if (!(fi >= 0 && fi <= 0.5 && fo >= 0 && fo <= 0.5)) return err(`${w}: fadeIn and fadeOut are fractions of the cue, 0–0.5.`);
    const cycles = c.cycles == null ? 1 : c.cycles; if (!Number.isInteger(cycles) || cycles < 1 || cycles > SEQ_LIMITS.cycles) return err(`${w}: cycles must be a whole number 1–${SEQ_LIMITS.cycles}.`);
    const dir = c.dir == null ? 'forward' : c.dir; if (!PLAY_MODES.includes(dir)) return err(`${w}: dir must be ${PLAY_MODES.join(', ')}.`);
    const blend = c.blend == null ? 'normal' : c.blend; if (!BLEND_MODES.includes(blend)) return err(`${w}: blend must be one of ${BLEND_MODES.join(', ')}.`);
    const opacity = c.opacity == null ? 1 : Number(c.opacity); if (!(opacity >= 0 && opacity <= 1)) return err(`${w}: opacity must be 0–1.`);
    const chance = c.chance == null ? 1 : Number(c.chance); if (!(chance >= 0 && chance <= 1)) return err(`${w}: chance must be 0–1.`);
    const cseed = c.seed == null ? 0 : c.seed; if (cseed !== 0 && (!Number.isInteger(cseed) || cseed < 1 || cseed > 9999)) return err(`${w}: seed must be a whole number 1–9999.`);
    const params = c.params == null ? {} : c.params;
    if (typeof params !== 'object' || Array.isArray(params) || Object.keys(params).length > SEQ_LIMITS.params || !Object.values(params).every(v => ['number', 'string', 'boolean'].includes(typeof v))) return err(`${w}: params must be an object of numbers, strings and booleans (max ${SEQ_LIMITS.params}).`);
    if (c.palette != null && typeof c.palette !== 'string') return err(`${w}: palette must be a palette id.`);
    let reps = 1, every = 0;
    if (c.repeat != null) {
      const r = c.repeat; every = r && parseTime(r.every, ctx);
      if (!r || !(every > 0 && every <= 1) || !Number.isInteger(r.count) || r.count < 2 || r.count > SEQ_LIMITS.repeat) return err(`${w}: repeat needs { "every": time, "count": 2–${SEQ_LIMITS.repeat} }.`);
      if (every < len - 1e-9) warn(`${w}: repeats overlap themselves (every < len).`);
      reps = r.count;
    }
    const wrapAt = x => x - Math.floor(x);
    for (let r = 0; r < reps; r++) cues.push({ id: r ? `${base}#${r + 1}` : base, from: base, i: cues.length, style: ref, at: wrapAt(at + r * every), len: Math.min(1, len), lane, fadeIn: fi, fadeOut: fo, cycles, dir, blend, opacity, chance, mute: !!c.mute, seed: cseed, palette: c.palette || null, params: { ...params }, label: String(c.label || '').slice(0, 32) });
  });
  if (cues.length > SEQ_LIMITS.cues) err(`Repeats expand to ${cues.length} cues; at most ${SEQ_LIMITS.cues}.`);
  const seq = { format: SEQ_FORMAT, id: raw.id, name: String(raw.name || raw.id || '').slice(0, 32), description: String(raw.description || '').slice(0, 200), loop: loop || null, bpm: bpm || null, seed, maxActive, cues };
  if (!errors.length) {
    const an = analyzeSequence(seq);
    if (an.peak > maxActive) err(`${an.peak} cues overlap at ${an.peakAt.toFixed(3)} of the loop; maxActive is ${maxActive}. Move a cue, shorten one, or put it on a chance.`);
    if (an.coverage < 0.999 && an.gaps.length) warn(`Nothing plays during ${an.gaps.map(g => `${g[0].toFixed(2)}–${g[1].toFixed(2)}`).join(', ')}.`);
  }
  return { ok: !errors.length, errors, warnings, seq: errors.length ? null : seq, deps: [...deps] };
}
const fadeEnv = (x, fi, fo) => { const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); }; return (fi > 0 ? ss(0, fi, x) : 1) * (fo > 0 ? 1 - ss(1 - fo, 1, x) : 1); };
// Which cues are on, and how they stack, at loop phase p. Pure and deterministic: the same (seq, p, seed) always gives the same plan.
// opt: { L: loop seconds (for the limiter), seed, maxActive }. Returns { active: [{ cue, local, innerP, innerL, env, alpha }], dropped }.
function planSequence(seq, p, opt) {
  opt = opt || {}; const L = opt.L || seq.loop || 6, seed = opt.seed != null ? opt.seed : seq.seed, maxActive = opt.maxActive || seq.maxActive || SEQ_LIMITS.active;
  p = p - Math.floor(p); let active = [];
  for (const c of seq.cues) {
    if (c.mute) continue;
    if (c.chance < 1 && !(h11(c.i + 1, seed) < c.chance)) continue;
    let x = p - c.at; x -= Math.floor(x); if (x >= c.len) continue;
    const local = x / c.len, mode = PLAY_MODES.indexOf(c.dir), pos = playhead(c.cycles, mode, c.i + 1, local, seed), env = fadeEnv(local, c.fadeIn, c.fadeOut);
    // Ping-pong and random move the inner phase twice as fast; the limiter must see the faster loop.
    active.push({ cue: c, local, innerP: pos - Math.floor(pos), innerL: Math.max(0.05, (L * c.len) / (c.cycles * (mode >= 2 ? 2 : 1))), env, alpha: env * c.opacity });
  }
  let dropped = 0;
  if (active.length > maxActive) { const keep = new Set([...active].sort((a, b) => b.alpha - a.alpha || a.cue.i - b.cue.i).slice(0, maxActive)); dropped = active.length - maxActive; active = active.filter(a => keep.has(a)); }
  active.sort((a, b) => a.cue.lane - b.cue.lane || a.cue.at - b.cue.at || a.cue.i - b.cue.i);
  return { active, dropped };
}
// Static analysis over the whole loop (chance ignored: worst case): peak overlap, gaps, styles used.
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
// Compositor: renders a plan with the GL runtime and layers each cue on a 2D context with its blend mode and alpha.
// resolve(ref, cue) -> { key, def, spec, defaults, media? } for a library style, or null when it is not installed.
function createSequencer(rt, resolve, opt) {
  opt = opt || {}; let scratch = null;
  const mk = (w, h) => { if (typeof OffscreenCanvas !== 'undefined' && !opt.dom) return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  return {
    plan: planSequence,
    // Start compiling every style the sequence uses (async where the driver allows), so cues never stall on first use.
    warm(seq) {
      const out = { ready: 0, pending: 0, missing: [], errors: {} };
      for (const ref of new Set(seq.cues.map(c => c.style))) {
        const r = resolve(ref, null); if (!r) { out.missing.push(ref); continue; }
        const c = rt.compile(r.key, r.def); if (c.ok) out.ready++; else if (c.pending) out.pending++; else if (!c.lost) out.errors[ref] = c.error;
      }
      return out;
    },
    // S: { p, L, seed, safe, pal, palettes?: id => pal }. Returns { drawn, pending, missing, dropped, lost }.
    render(ctx, w, h, seq, S, o) {
      o = o || {}; const { active, dropped } = planSequence(seq, S.p, { L: S.L, seed: S.seed, maxActive: o.maxActive });
      const res = { drawn: 0, pending: 0, missing: [], errors: {}, dropped, lost: false, active };
      if (!scratch || scratch.width !== w || scratch.height !== h) scratch = mk(w, h);
      const lx = scratch.getContext('2d');
      for (const a of active) {
        const c = a.cue, r = resolve(c.style, c); if (!r) { res.missing.push(c.style); continue; }
        const k = rt.compile(r.key, r.def); if (!k.ok) { if (k.pending) res.pending++; else if (k.lost) res.lost = true; else res.errors[c.style] = k.error; continue; }
        const pal = (c.palette && S.palettes && S.palettes(c.palette)) || S.pal;
        const u = { p: a.innerP, L: a.innerL, seed: c.seed || S.seed, safe: S.safe, pal, params: { ...(r.defaults || {}), ...c.params }, spec: r.spec, media: r.media || null };
        if (!rt.draw(r.key, w, h, u, o.draw)) { res.lost = true; continue; }
        lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'copy'; lx.globalAlpha = 1; lx.clearRect(0, 0, w, h); rt.blit(lx, w, h);
        ctx.save(); ctx.globalCompositeOperation = BLEND_CANVAS[c.blend] || 'source-over'; ctx.globalAlpha = Math.max(0, Math.min(1, a.alpha)); ctx.drawImage(scratch, 0, 0, w, h); ctx.restore();
        res.drawn++;
      }
      return res;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// kit-gl/vector — bakes svg and text inputs into signed-distance textures (browser; needs canvas).
// Bake result: { data: RGBA8 (R = 0.5 + d / (2 * spread), d in pixels, negative inside; G = coverage), w, h, spread, key, rev }.
// The shader reads it through vec_<id>(uv), which returns the distance in uv units, so edges stay sharp at any scale.
// ---------------------------------------------------------------------------------------------------------------
function svgProblem(t) {
  if (!/<svg[\s>]/i.test(t)) return 'not an SVG (no <svg> element).';
  if (t.length > KIT_LIMITS.svgBytes) return `larger than ${KIT_LIMITS.svgBytes / 1024} KB.`;
  if (/<\s*(script|foreignObject|image|iframe)\b|\son\w+\s*=|javascript:/i.test(t)) return 'contains script, image or foreignObject content, which is not allowed.';
  if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(t)) return 'has an external reference (href); inline everything.';
  return '';
}
// Felzenszwalb & Huttenlocher squared distance transform, one dimension (as used by TinySDF, MIT).
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
// alpha: Uint8 coverage (w*h). Anti-aliased edge pixels place the edge with sub-pixel accuracy.
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
function bakeCanvas(w, h) { if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; } return new OffscreenCanvas(w, h); }
function parseTransform(str) {
  let m = [1, 0, 0, 1, 0, 0]; const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g; let t;
  while ((t = re.exec(str || ''))) {
    const a = t[2].split(/[\s,]+/).filter(Boolean).map(Number); let n = null;
    if (t[1] === 'matrix' && a.length === 6) n = a;
    else if (t[1] === 'translate') n = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
    else if (t[1] === 'scale') n = [a[0], 0, 0, a[1] == null ? a[0] : a[1], 0, 0];
    else if (t[1] === 'rotate') { const r = (a[0] || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), cx = a[1] || 0, cy = a[2] || 0; n = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]; }
    else if (t[1] === 'skewX') n = [1, 0, Math.tan((a[0] || 0) * Math.PI / 180), 1, 0, 0];
    else if (t[1] === 'skewY') n = [1, Math.tan((a[0] || 0) * Math.PI / 180), 0, 1, 0, 0];
    if (n && n.every(Number.isFinite)) m = mul(m, n);
  }
  return m;
}
function svgStyle(el, inh) {
  const o = { ...inh }; const read = (k, v) => { if (v != null && v !== '') o[k] = v.trim(); };
  for (const k of ['fill', 'stroke', 'stroke-width', 'fill-rule', 'stroke-linecap', 'stroke-linejoin', 'display', 'visibility']) read(k, el.getAttribute(k));
  const st = el.getAttribute('style'); if (st) st.split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) read(d.slice(0, i).trim(), d.slice(i + 1)); });
  return o;
}
const SVG_SKIP = new Set(['defs', 'mask', 'clipPath', 'symbol', 'use', 'text', 'image', 'style', 'title', 'desc', 'metadata', 'pattern', 'filter', 'linearGradient', 'radialGradient']);
function svgShapePath(el) {
  const n = k => parseFloat(el.getAttribute(k)) || 0, tag = el.localName;
  if (tag === 'path') return el.getAttribute('d') || '';
  if (tag === 'rect') { const x = n('x'), y = n('y'), w = n('width'), h = n('height'); let rx = el.hasAttribute('rx') ? n('rx') : n('ry'), ry = el.hasAttribute('ry') ? n('ry') : rx; rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
    return rx > 0 ? `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z` : `M${x} ${y}H${x + w}V${y + h}H${x}Z`; }
  if (tag === 'circle' || tag === 'ellipse') { const cx = n('cx'), cy = n('cy'), rx = tag === 'circle' ? n('r') : n('rx'), ry = tag === 'circle' ? n('r') : n('ry'); return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`; }
  if (tag === 'line') return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
  if (tag === 'polyline' || tag === 'polygon') { const p = (el.getAttribute('points') || '').split(/[\s,]+/).filter(Boolean).map(Number); let d = ''; for (let i = 0; i + 1 < p.length; i += 2) d += `${i ? 'L' : 'M'}${p[i]} ${p[i + 1]}`; return d + (tag === 'polygon' ? 'Z' : ''); }
  return null;
}
// Draws an SVG document into a 2D context as a white coverage mask, fitted to (w, h) with a margin. Supports path, rect,
// circle, ellipse, line, polyline, polygon, g, transforms, fill / stroke / fill-rule. <text>, <use>, gradients, masks and
// filters are ignored (convert text to outlines, or use a text input).
function drawSvgMask(x, svgText, w, h, margin) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml'), root = doc.documentElement;
  if (!root || doc.querySelector('parsererror') || root.localName !== 'svg') throw new Error('The SVG could not be parsed.');
  let vb = (root.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some(v => !Number.isFinite(v)) || !(vb[2] > 0 && vb[3] > 0)) vb = [0, 0, parseFloat(root.getAttribute('width')) || 100, parseFloat(root.getAttribute('height')) || 100];
  const m = margin * Math.min(w, h), sc = Math.min((w - 2 * m) / vb[2], (h - 2 * m) / vb[3]);
  const base = [sc, 0, 0, sc, (w - vb[2] * sc) / 2 - vb[0] * sc, (h - vb[3] * sc) / 2 - vb[1] * sc];
  x.fillStyle = '#fff'; x.strokeStyle = '#fff'; let drawn = 0;
  const walk = (el, inh, tf) => {
    for (const c of el.children) {
      if (SVG_SKIP.has(c.localName)) continue;
      const st = svgStyle(c, inh); if (st.display === 'none' || st.visibility === 'hidden') continue;
      const t = parseTransform(c.getAttribute('transform')), cm = [tf[0] * t[0] + tf[2] * t[1], tf[1] * t[0] + tf[3] * t[1], tf[0] * t[2] + tf[2] * t[3], tf[1] * t[2] + tf[3] * t[3], tf[0] * t[4] + tf[2] * t[5] + tf[4], tf[1] * t[4] + tf[3] * t[5] + tf[5]];
      if (c.localName === 'g' || c.localName === 'a' || c.localName === 'svg') { walk(c, st, cm); continue; }
      const d = svgShapePath(c); if (!d) continue;
      const path = new Path2D(d); x.setTransform(cm[0], cm[1], cm[2], cm[3], cm[4], cm[5]);
      const fill = st.fill == null ? 'black' : st.fill, stroke = st.stroke == null ? 'none' : st.stroke;
      if (fill !== 'none' && c.localName !== 'line') { x.fill(path, st['fill-rule'] === 'evenodd' ? 'evenodd' : 'nonzero'); drawn++; }
      if (stroke !== 'none') { x.lineWidth = parseFloat(st['stroke-width']) || 1; x.lineCap = st['stroke-linecap'] || 'butt'; x.lineJoin = st['stroke-linejoin'] || 'miter'; x.stroke(path); drawn++; }
    }
  };
  walk(root, {}, base); x.setTransform(1, 0, 0, 1, 0, 0);
  return drawn;
}
let BAKE_REV = 0;
function bakeSvg(svgText, w, h, o) {
  o = o || {}; const spread = o.spread || 24, cv = bakeCanvas(w, h), x = cv.getContext('2d', { willReadFrequently: true });
  x.clearRect(0, 0, w, h); const drawn = drawSvgMask(x, svgText, w, h, o.margin == null ? 0.08 : o.margin);
  const a = x.getImageData(0, 0, w, h).data, alpha = new Uint8Array(w * h); for (let i = 0; i < alpha.length; i++) alpha[i] = a[i * 4 + 3];
  return { data: sdfFromAlpha(alpha, w, h, spread), w, h, spread, rev: ++BAKE_REV, drawn };
}
// spec: { text, family (CSS font-family), weight, size (cap height / frame height), track (em), lead, align }
function bakeText(spec, w, h, o) {
  o = o || {}; const spread = o.spread || 24, cv = bakeCanvas(w, h), x = cv.getContext('2d', { willReadFrequently: true });
  x.clearRect(0, 0, w, h); x.fillStyle = '#fff'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  const fam = spec.family || FONT_STACKS.sans, wt = Math.round(spec.weight || 700);
  x.font = `${wt} 100px ${fam}`; const cap100 = x.measureText('H').actualBoundingBoxAscent || 72;
  const capPx = spec.size * h, px = capPx * 100 / cap100; x.font = `${wt} ${px}px ${fam}`;
  const lines = String(spec.text == null ? '' : spec.text).replace(/\\n/g, '\n').split('\n').slice(0, 12), tr = (spec.track || 0) * px, step = (spec.lead || 1.1) * px;
  const width = s => { if (!tr) return x.measureText(s).width; let t = 0; for (const ch of s) t += x.measureText(ch).width + tr; return t - tr; };
  const ws = lines.map(width), maxW = Math.max(...ws, 1), left = (w - maxW) / 2, y0 = h / 2 - ((lines.length - 1) * step) / 2 + capPx / 2;
  lines.forEach((s, i) => {
    const lx = spec.align === 'left' ? left : spec.align === 'right' ? left + maxW - ws[i] : (w - ws[i]) / 2, ly = y0 + i * step;
    if (!tr) x.fillText(s, lx, ly); else { let cx = lx; for (const ch of s) { x.fillText(ch, cx, ly); cx += x.measureText(ch).width + tr; } }
  });
  const a = x.getImageData(0, 0, w, h).data, alpha = new Uint8Array(w * h); for (let i = 0; i < alpha.length; i++) alpha[i] = a[i * 4 + 3];
  return { data: sdfFromAlpha(alpha, w, h, spread), w, h, spread, rev: ++BAKE_REV };
}
// Loads a kit's bundled fonts (FontFace) and returns { fontId: cssFamily }. Await it before baking text that uses them.
async function loadKitFonts(kit, files) {
  const fam = {}; if (typeof FontFace === 'undefined' || typeof document === 'undefined') return fam;
  for (const f of kit.fonts || []) {
    const bytes = files && files[f.file]; if (!bytes) continue; const family = `motif-${kit.id}-${f.id}`;
    try { const face = new FontFace(family, typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes, { weight: String(f.weight) }); await face.load(); document.fonts.add(face); fam[f.id] = `"${family}"`; } catch (e) { /* the text falls back to sans */ }
  }
  return fam;
}
// Bakes (and caches) every svg / text input of a style for the current params and frame size. S: { params, w, h, files, families,
// attach: { inputId: svgText }, res: bake height scale }. Returns { [inputId]: media } for the runtime's u.media, ready to merge with image media.
function createInputBaker() {
  const cache = new Map();
  return function bake(style, S) {
    const out = {}, bh = Math.max(256, Math.min(2048, Math.round(S.h * (S.res || 1)))), bw = Math.max(256, Math.min(4096, Math.round(bh * S.w / S.h)));
    for (const q of style.inputs || []) {
      if (!isSdfInput(q)) continue;
      const P = S.params, id = q.id; let sig, run;
      if (q.type === 'svg') {
        const svg = (S.attach && S.attach[id]) || (q.src && S.files && S.files[q.src]); if (!svg) continue;
        const margin = P[id + 'Margin'] == null ? q.margin : P[id + 'Margin'];
        sig = `s|${style.id}|${id}|${bw}x${bh}|${margin}|${q.spread}|${svg.length}|${svg.slice(0, 64)}|${svg.slice(-64)}`; run = () => bakeSvg(svg, bw, bh, { spread: q.spread, margin });
      } else {
        const font = P[id + 'Font'] || q.font, family = FONT_GENERIC.includes(font) ? FONT_STACKS[font] : (S.families && S.families[font]) || FONT_STACKS.sans;
        const spec = { text: P[id + 'Text'] == null ? q.def : P[id + 'Text'], family, weight: P[id + 'Weight'] == null ? q.weight : P[id + 'Weight'], size: P[id + 'Size'] == null ? q.size : P[id + 'Size'], track: P[id + 'Track'] || 0, lead: P[id + 'Lead'] == null ? 1.1 : P[id + 'Lead'], align: P[id + 'Align'] || 'center' };
        sig = `t|${style.id}|${id}|${bw}x${bh}|${q.spread}|${JSON.stringify(spec)}`; run = () => bakeText(spec, bw, bh, { spread: q.spread });
      }
      let e = cache.get(sig); if (!e) { e = run(); e.key = sig; cache.set(sig, e); if (cache.size > 16) cache.delete(cache.keys().next().value); } else { cache.delete(sig); cache.set(sig, e); }
      out[id] = { data: e.data, w: e.w, h: e.h, spread: e.spread, key: sig, rev: e.rev, time: 0 };
    }
    return out;
  };
}

// kit-gl v2 (Motif 3) — WebGL2 runtime for Motif Kit shader styles (motif-kit@1): adaptive internal
// resolution, banded submission for heavy frames, LRU render targets and context-loss recovery.
// One shared GL canvas. Programs compile lazily per style, passes render into half-float
// targets, the final pass lands in the bottom-left w×h region of the shared canvas, and the
// caller copies it with drawImage. Stateless per frame: every frame is a pure function of
// (params, palette, seed, phase), so exports are deterministic and loops close exactly.

const MAX_PASSES = 4;
const RESERVED = /^(u_|M_|gl_)/;

function hexToLin(hex) {
  const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
}

// Uniform declarations for a style's params: range → float, int → int, toggle → bool, select → int (option index).
function paramUniforms(params) {
  let s = '', helpers = '';
  for (const [k, p] of Object.entries(params || {})) {
    if (p.type === 'text') continue;
    if (p.part && p.part.i === 0) helpers += p.part.kind === 'color'
      ? `vec3 s_${p.part.of}() { return vec3(p_${p.part.of}R, p_${p.part.of}G, p_${p.part.of}B); }\nvec3 c_${p.part.of}() { vec3 c = s_${p.part.of}(); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }\n`
      : `vec2 v_${p.part.of}() { return vec2(p_${p.part.of}X, p_${p.part.of}Y); }\n`;
    const t = p.type === 'range' ? 'float' : p.type === 'toggle' ? 'bool' : 'int';
    s += `uniform ${t} p_${k};\n`;
    if (p.type === 'select') p.options.forEach((o, i) => { s += `#define ${k.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}_${String(o.v).toUpperCase().replace(/[^A-Z0-9]/g, '_')} ${i}\n`; });
  }
  return s + helpers;
}

// Media inputs. The host bakes each attached image/video into a texture with the frame's aspect ratio (fit
// already applied), so frame-normalized q = fc / u_res samples it directly with no distortion.
//   u_<id>        sampler2D  premultiplied, linear light (texture unit 4 + input index)
//   u_<id>On      float      1.0 when media is attached, else 0.0 (sampling then returns transparent black)
//   u_<id>Size    vec2       the media's own pixel size
//   u_<id>Time    float      video time in seconds (0 for images)
//   m_<id>(q)     vec4       sample at frame-normalized q (0..1, origin bottom-left), clamped
//   m_<id>UV(uv)  vec4       sample at the centred uv that motif() receives
//   m_<id>Px(fc)  vec4       sample at pixel coordinates
function inputSource(inputs) {
  let s = '';
  for (const q of inputs || []) {
    const n = q.id;
    s += `uniform sampler2D u_${n};\nuniform float u_${n}On;\nuniform vec2 u_${n}Size;\nuniform float u_${n}Time;\n`;
    if (isSdfInput(q)) s += `uniform float u_${n}Spread; // distance stored around the edge, in uv units\n`;
    s += `vec4 m_${n}(vec2 q) { return texture(u_${n}, clamp(q, vec2(0.0), vec2(1.0))); }\n`;
    s += `vec4 m_${n}Px(vec2 fc) { return m_${n}(fc / u_res); }\n`;
    s += `vec4 m_${n}UV(vec2 uv) { return m_${n}(uv * min(u_res.x, u_res.y) / u_res + 0.5); }\n`;
  }
  return s;
}
// Kits may declare the input uniforms themselves (SDK 1.0 style); strip those so the runtime's declarations win.
// The declaration is blanked in place, so pass-local line numbers stay correct.
function stripInputDecls(text, inputs) {
  if (!text || !inputs || !inputs.length) return text || '';
  for (const q of inputs) text = text.replace(new RegExp(`\\buniform\\s+\\w+\\s+u_${q.id}(On|Size|Time)?\\s*;`, 'g'), '');
  return text;
}
// The 1.2.5 prelude is added only for kits that declare sdk >= 1.2.5 (or use a 1.2.5 input), so older kits compile unchanged.
const needs125 = (sdk, inputs) => !!(sdk && cmpVer(sdk, '1.2.5') >= 0) || (inputs || []).some(q => q.stack || isSdfInput(q));
function buildSource(passSrc, common, params, final, inputs, sdk) {
  passSrc = stripInputDecls(passSrc, inputs); common = stripInputDecls(common, inputs);
  const ext = needs125(sdk, inputs);
  const head = PRELUDE + (ext ? PRELUDE_125 : '') + '\n// ---- params ----\n' + paramUniforms(params) + (inputs && inputs.length ? '\n// ---- media inputs ----\n' + inputSource(inputs) : '') + (ext ? blockSource(inputs) : '') + '\n// ---- kit common ----\n' + (common || '') + '\n// ---- pass ----\n#line 1 1\n';
  return { src: head + passSrc + (final ? MAIN_FINAL : MAIN_PASS), headLines: head.split('\n').length - 1 };
}

function createGlRuntime() {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let gl = null, reason = '', halfFloat = false, lost = false, loseExt = null, timerExt = null, parExt = null, frameNo = 0, lostCount = 0;
  const compiling = new Map(); // key -> { def, passes:[{p, v, f, scale}] } while KHR_parallel_shader_compile works in the background
  const programs = new Map(); // key -> { passes:[{prog, uniforms, scale}], error }
  const targets = new Map();  // `${key}|${i}` -> { tex, fbo, w, h, used }
  const gpuMs = new Map();    // key -> EMA of GPU milliseconds per megapixel (when the timer extension exists)
  const pending = [];         // in-flight timer queries
  const listeners = new Set();
  let vao = null, vbo = null, last = { w: 0, h: 0 }, rendererName = '', software = false;
  // Media input textures (SDK 1.1). Keyed by the host's baked canvas; re-uploaded when its rev changes.
  let mediaTex = new Map(), blankTex = null;
  const MEDIA_UNIT = 4, SCRATCH_UNIT = 15; // units 0-3 hold earlier passes, 4-12 the style's inputs, 15 is for uploads
  const emit = ev => listeners.forEach(fn => { try { fn(ev); } catch (e) { /* listener errors never break rendering */ } });
  function setup() {
    halfFloat = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_float_linear');
    loseExt = gl.getExtension('WEBGL_lose_context');
    timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    parExt = gl.getExtension('KHR_parallel_shader_compile');
    try { const di = gl.getExtension('WEBGL_debug_renderer_info'); rendererName = String(gl.getParameter(di ? di.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); } catch (e) { rendererName = ''; }
    software = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|angle \(.*\bcpu\b/i.test(rendererName);
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    mediaTex = new Map();
    blankTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, blankTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }
  // Upload (or refresh) a baked media canvas as an sRGB texture, so shaders sample linear light.
  function mediaTexture(m) {
    const key = m.key || m.canvas; let e = mediaTex.get(key);
    if (e && e.rev === m.rev) return e.tex;
    if (!e) {
      e = { tex: gl.createTexture(), rev: -1 }; mediaTex.set(key, e);
      if (mediaTex.size > 24) { const [k0, e0] = mediaTex.entries().next().value; gl.deleteTexture(e0.tex); mediaTex.delete(k0); }
    }
    gl.activeTexture(gl.TEXTURE0 + SCRATCH_UNIT); gl.bindTexture(gl.TEXTURE_2D, e.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    if (m.data) {
      // Baked distance field (svg / text input): raw linear RGBA8, bilinear, no mipmaps, rows top-first like ImageData.
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, m.w, m.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, m.data); } finally { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
      // Upload a baked media canvas as an sRGB texture, so shaders sample linear light.
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, m.canvas); }
      finally { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); }
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    e.rev = m.rev; return e.tex;
  }
  function init() {
    if (gl || !canvas) return !!gl;
    canvas.width = 2; canvas.height = 2;
    try { gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true, depth: false, stencil: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) { reason = 'WebGL2 is not available in this browser.'; return false; }
    setup();
    // Context loss (a GPU reset, often a watchdog timeout on a long draw): keep the context object,
    // ask the browser to restore it, then rebuild programs lazily. Callers draw a placeholder meanwhile.
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault(); lost = true; lostCount++; pending.length = 0; emit({ type: 'lost', count: lostCount });
      const ext = loseExt; setTimeout(() => { if (lost && ext) { try { ext.restoreContext(); } catch (err) { /* browser restores on its own */ } } }, 1500);
    });
    canvas.addEventListener('webglcontextrestored', () => { lost = false; programs.clear(); targets.clear(); compiling.clear(); setup(); emit({ type: 'restored', count: lostCount }); });
    return true;
  }
  const VS = '#version 300 es\nin vec2 a_pos;\nvoid main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }\n';
  function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  // Maps driver log lines back to pass-local line numbers (the pass source starts at #line 1 1).
  function cleanLog(log) {
    return String(log || '').split('\n').filter(Boolean).map(l => l.replace(/^(ERROR|WARNING): 1:(\d+):/, (m, k, n) => `${k === 'ERROR' ? 'Error' : 'Warning'} line ${n}:`).replace(/^(ERROR|WARNING): 0:(\d+):/, (m, k, n) => `${k === 'ERROR' ? 'Error' : 'Warning'} in prelude/common (line ${n}):`)).slice(0, 12).join('\n');
  }
  function startPass(src, final, common, params, inputs, sdk) {
    const { src: fs } = buildSource(src, common, params, final, inputs, sdk);
    const v = shader(gl.VERTEX_SHADER, VS), f = shader(gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.bindAttribLocation(p, 0, 'a_pos'); gl.linkProgram(p);
    return { p, v, f };
  }
  function finishPass({ p, v, f }) {
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = cleanLog(gl.getShaderInfoLog(f)) || gl.getProgramInfoLog(p);
      gl.deleteProgram(p); gl.deleteShader(v); gl.deleteShader(f);
      if (gl.isContextLost()) return { error: 'lost' };
      return { error: log || 'Shader failed to compile.' };
    }
    gl.deleteShader(v); gl.deleteShader(f);
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), uniforms = {};
    for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); uniforms[u.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, u.name); }
    return { prog: p, uniforms };
  }
  function finalize(key, started) {
    const passes = [];
    for (let i = 0; i < started.length; i++) {
      const r = finishPass(started[i]);
      if (r.error) {
        passes.forEach(x => gl.deleteProgram(x.prog)); started.slice(i + 1).forEach(x => { gl.deleteProgram(x.p); gl.deleteShader(x.v); gl.deleteShader(x.f); });
        if (r.error === 'lost') return { ok: false, error: 'lost', lost: true };
        const e = { error: `Pass ${i + 1}: ${r.error}` }; programs.set(key, e); return { ok: false, error: e.error };
      }
      passes.push({ ...r, scale: started[i].scale });
    }
    programs.set(key, { passes, inputs: started.inputs || [] }); return { ok: true };
  }
  // def: { passes:[{src, scale}], common, params }. Returns { ok, error } or { ok:false, pending:true } while
  // the driver compiles in the background (KHR_parallel_shader_compile), so the UI never freezes on a big shader.
  // sync: true waits for the result (used when importing a kit, to report errors with line numbers).
  function compile(key, def, sync) {
    if (!init()) return { ok: false, error: reason };
    if (lost) return { ok: false, error: 'lost', lost: true };
    if (programs.has(key)) { const e = programs.get(key); return { ok: !e.error, error: e.error }; }
    let job = compiling.get(key);
    if (!job) {
      job = def.passes.map((ps, i) => ({ ...startPass(ps.src, i === def.passes.length - 1, def.common, def.params, def.inputs, def.sdk), scale: Math.min(1, Math.max(0.125, ps.scale || 1)) }));
      job.inputs = def.inputs || []; compiling.set(key, job);
    }
    if (!sync && parExt && !job.every(x => gl.getProgramParameter(x.p, parExt.COMPLETION_STATUS_KHR))) return { ok: false, pending: true };
    compiling.delete(key);
    return finalize(key, job);
  }
  // Finish any background compiles that are ready; returns the keys that completed.
  function poll() {
    const done = [];
    if (!gl || lost || !parExt) return done;
    for (const [key, job] of compiling) if (job.every(x => gl.getProgramParameter(x.p, parExt.COMPLETION_STATUS_KHR))) { compiling.delete(key); finalize(key, job); done.push(key); }
    return done;
  }
  function forget(prefix) {
    if (!gl) return;
    for (const [k, v] of programs) if (k.startsWith(prefix)) { (v.passes || []).forEach(x => gl.deleteProgram(x.prog)); programs.delete(k); }
    for (const [k, v] of targets) if (k.startsWith(prefix)) { gl.deleteTexture(v.tex); gl.deleteFramebuffer(v.fbo); targets.delete(k); }
  }
  function target(key, i, w, h) {
    const k = `${key}|${i}`; let t = targets.get(k);
    if (t && t.w === w && t.h === h) { t.used = frameNo; return t; }
    if (!t) { t = { tex: gl.createTexture(), fbo: gl.createFramebuffer() }; targets.set(k, t); }
    t.w = w; t.h = h; t.used = frameNo;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, halfFloat ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, halfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    // Evict least-recently-used targets (never one written this frame) beyond 24.
    if (targets.size > 24) {
      let oldK = null, oldT = null;
      for (const [kk, tt] of targets) if (tt.used !== frameNo && (!oldT || tt.used < oldT.used)) { oldK = kk; oldT = tt; }
      if (oldT) { gl.deleteTexture(oldT.tex); gl.deleteFramebuffer(oldT.fbo); targets.delete(oldK); }
    }
    return t;
  }
  // Collect finished GPU timer queries into a per-style cost estimate (ms per megapixel).
  function pollTimers() {
    if (!timerExt) return;
    const disjoint = gl.getParameter(timerExt.GPU_DISJOINT_EXT);
    for (let i = pending.length - 1; i >= 0; i--) {
      const q = pending[i];
      if (!gl.getQueryParameter(q.q, gl.QUERY_RESULT_AVAILABLE)) continue;
      const ns = gl.getQueryParameter(q.q, gl.QUERY_RESULT); gl.deleteQuery(q.q); pending.splice(i, 1);
      if (disjoint || !(ns > 0)) continue;
      const perMpx = (ns / 1e6) / Math.max(0.01, q.px / 1e6);
      const prev = gpuMs.get(q.key); gpuMs.set(q.key, prev == null ? perMpx : prev * 0.75 + perMpx * 0.25);
    }
  }
  // Render style `key` at w×h. u: { p, L, seed, safe, pal:{bg,ink,a}, params, spec, media }.
  // media: { <inputId>: { canvas, rev, w, h, time } } — baked by the host at the frame's aspect (see inputSource).
  //   svg / text inputs: { data (RGBA8 distance field), key, rev, w, h, spread (px) } from createInputBaker().
  // opt.scale renders internally at w·scale × h·scale (blit upsamples); opt.bands splits every pass into
  // horizontal bands flushed separately, so one very heavy frame never becomes one long GPU submission.
  function draw(key, w, h, u, opt = {}) {
    if (!init() || lost) return null;
    const entry = programs.get(key); if (!entry || entry.error) return null;
    frameNo++;
    const sc = Math.min(1, Math.max(0.2, opt.scale || 1));
    w = Math.max(1, Math.round(w * sc)); h = Math.max(1, Math.round(h * sc));
    const bands = Math.max(1, Math.min(32, Math.round(opt.bands || 1)));
    if (canvas.width < w || canvas.height < h) { canvas.width = Math.max(canvas.width, w); canvas.height = Math.max(canvas.height, h); }
    const pal = [hexToLin(u.pal.bg), hexToLin(u.pal.ink), ...u.pal.a.slice(0, 3).map(hexToLin)];
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    pollTimers();
    let query = null;
    if (timerExt && pending.length < 4) { query = gl.createQuery(); gl.beginQuery(timerExt.TIME_ELAPSED_EXT, query); }
    const texs = [];
    entry.passes.forEach((ps, i) => {
      const lastPass = i === entry.passes.length - 1;
      const pw = lastPass ? w : Math.max(1, Math.round(w * ps.scale)), ph = lastPass ? h : Math.max(1, Math.round(h * ps.scale));
      if (lastPass) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, pw, ph); }
      else { const t = target(key, i, pw, ph); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.viewport(0, 0, pw, ph); texs.push(t.tex); }
      gl.useProgram(ps.prog); const U = ps.uniforms;
      if (U.u_res) gl.uniform2f(U.u_res, pw, ph);
      if (U.u_p) gl.uniform1f(U.u_p, u.p);
      if (U.u_L) gl.uniform1f(U.u_L, u.L);
      if (U.u_seed) gl.uniform1f(U.u_seed, u.seed);
      if (U.u_safe) gl.uniform1f(U.u_safe, u.safe ? 1 : 0);
      ['u_bg', 'u_ink', 'u_a0', 'u_a1', 'u_a2'].forEach((n, j) => { if (U[n]) gl.uniform3fv(U[n], pal[j]); });
      for (let b = 0; b < MAX_PASSES; b++) { const n = 'u_buf' + b; if (U[n]) { gl.activeTexture(gl.TEXTURE0 + b); gl.bindTexture(gl.TEXTURE_2D, b < i ? texs[b] || null : null); gl.uniform1i(U[n], b); } }
      entry.inputs.forEach((q, j) => {
        const loc = U['u_' + q.id]; const m = u.media && u.media[q.id];
        if (U['u_' + q.id + 'On']) gl.uniform1f(U['u_' + q.id + 'On'], m ? 1 : 0);
        if (U['u_' + q.id + 'Size']) gl.uniform2f(U['u_' + q.id + 'Size'], m ? m.w : 0, m ? m.h : 0);
        if (U['u_' + q.id + 'Time']) gl.uniform1f(U['u_' + q.id + 'Time'], m ? m.time || 0 : 0);
        if (U['u_' + q.id + 'Spread']) gl.uniform1f(U['u_' + q.id + 'Spread'], m && m.spread ? m.spread / Math.max(1, Math.min(m.w, m.h)) : 0);
        if (!loc) return;
        // An SDK 1.0 kit that declared the sampler itself read u_buf0 (unit 0) when nothing was bound; keep that fallback.
        if (!m && q.implicit) { gl.uniform1i(loc, 0); return; }
        const tex = m ? mediaTexture(m) : blankTex;
        gl.activeTexture(gl.TEXTURE0 + MEDIA_UNIT + j); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, MEDIA_UNIT + j);
      });
      for (const [k, sp] of Object.entries(u.spec)) {
        const loc = U['p_' + k]; if (!loc) continue; const v = u.params[k];
        if (sp.type === 'range') gl.uniform1f(loc, +v);
        else if (sp.type === 'int') gl.uniform1i(loc, Math.round(v));
        else if (sp.type === 'toggle') gl.uniform1i(loc, v ? 1 : 0);
        else if (sp.type === 'select') gl.uniform1i(loc, Math.max(0, sp.options.findIndex(o => o.v === v)));
      }
      gl.enable(gl.SCISSOR_TEST);
      if (lastPass) { gl.scissor(0, 0, pw, ph); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      const nb = Math.min(bands, ph);
      for (let b = 0; b < nb; b++) {
        const y0 = Math.floor((b * ph) / nb), y1 = Math.floor(((b + 1) * ph) / nb);
        gl.scissor(0, y0, pw, y1 - y0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (nb > 1) gl.flush();
      }
      gl.disable(gl.SCISSOR_TEST);
    });
    if (query) { gl.endQuery(timerExt.TIME_ELAPSED_EXT); pending.push({ q: query, key, px: w * h }); }
    last = { w, h };
    return canvas;
  }
  // Copy the last draw (bottom-left of the GL canvas) into a 2D context at 0,0, scaled to w×h.
  function blit(ctx, w, h) {
    const sw = last.w || Math.round(w), sh = last.h || Math.round(h);
    const up = sw !== Math.round(w) || sh !== Math.round(h);
    if (up) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
    ctx.drawImage(canvas, 0, canvas.height - sh, sw, sh, 0, 0, w, h);
  }
  return {
    init, compile, poll, forget, draw, blit, canvas, hexToLin, programs, get pendingCompiles() { return compiling.size; },
    get ok() { return init(); }, get reason() { return reason; }, get halfFloat() { return halfFloat; },
    get lost() { return lost; }, get lostCount() { return lostCount; }, get timer() { return !!timerExt; }, get renderer() { init(); return rendererName; }, get software() { init(); return software; },
    costOf(key) { return gpuMs.get(key); }, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}

return {
  KIT_FORMAT, KIT_LIMITS, SDK_VERSION, validateKit, createGlRuntime, PRELUDE, PRELUDE_125, MAIN_FINAL, MAIN_PASS, buildSource, paramUniforms, inputSource, blockSource, blockParams, RESERVED, MAX_PASSES, hexToLin,
  BLEND_MODES, PLAY_MODES, EDGE_MODES, FONT_GENERIC, FONT_STACKS, BLEND_CANVAS,
  playhead, clipPos, stackPlayheads, h11, pcg,
  SEQ_FORMAT, SEQ_LIMITS, parseTime, validateSequence, planSequence, analyzeSequence, createSequencer,
  svgProblem, sdfFromAlpha, bakeSvg, bakeText, loadKitFonts, createInputBaker, cmpVer,
};

