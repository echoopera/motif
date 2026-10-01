// ---- module: kit-gl v1.3.0 (media inputs, custom params, motif-kit@2 pass graphs, canary probe)
const __m_kit_gl = (() => {
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

// ---- portable math ----
// The GLSL spec leaves some results undefined (smoothstep with edge0 >= edge1, pow of a negative base, sqrt/log of
// out-of-range values, normalize of a zero vector). GPUs differ: Apple, AMD and NVIDIA return zeros, NaN or garbage,
// which shows up as black blocks and hard bands. These overloads give every case one meaning on every GPU:
// smoothstep with reversed edges eases downwards, equal edges step, the rest clamp to the nearest defined value.
// pow() is deliberately left alone: its undefined inputs (negative base) are read by many shaders as sign-less, and zeroing
// them changes the picture.
// Results for well-defined inputs are unchanged.
float M_ss(float a, float b, float x) { float d = b - a; float t = d == 0.0 ? step(a, x) : clamp((x - a) / d, 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
vec2 M_ss(float a, float b, vec2 x) { return vec2(M_ss(a, b, x.x), M_ss(a, b, x.y)); }
vec3 M_ss(float a, float b, vec3 x) { return vec3(M_ss(a, b, x.x), M_ss(a, b, x.y), M_ss(a, b, x.z)); }
vec4 M_ss(float a, float b, vec4 x) { return vec4(M_ss(a, b, x.x), M_ss(a, b, x.y), M_ss(a, b, x.z), M_ss(a, b, x.w)); }
vec2 M_ss(vec2 a, vec2 b, vec2 x) { return vec2(M_ss(a.x, b.x, x.x), M_ss(a.y, b.y, x.y)); }
vec3 M_ss(vec3 a, vec3 b, vec3 x) { return vec3(M_ss(a.x, b.x, x.x), M_ss(a.y, b.y, x.y), M_ss(a.z, b.z, x.z)); }
vec4 M_ss(vec4 a, vec4 b, vec4 x) { return vec4(M_ss(a.x, b.x, x.x), M_ss(a.y, b.y, x.y), M_ss(a.z, b.z, x.z), M_ss(a.w, b.w, x.w)); }
float M_sqrt(float x) { return sqrt(max(x, 0.0)); }
vec2 M_sqrt(vec2 x) { return sqrt(max(x, 0.0)); }
vec3 M_sqrt(vec3 x) { return sqrt(max(x, 0.0)); }
vec4 M_sqrt(vec4 x) { return sqrt(max(x, 0.0)); }
float M_log(float x) { return log(max(x, 1e-30)); }
vec2 M_log(vec2 x) { return log(max(x, 1e-30)); }
vec3 M_log(vec3 x) { return log(max(x, 1e-30)); }
vec4 M_log(vec4 x) { return log(max(x, 1e-30)); }
float M_rsqrt(float x) { return inversesqrt(max(x, 1e-30)); }
vec2 M_rsqrt(vec2 x) { return inversesqrt(max(x, 1e-30)); }
vec3 M_rsqrt(vec3 x) { return inversesqrt(max(x, 1e-30)); }
vec4 M_rsqrt(vec4 x) { return inversesqrt(max(x, 1e-30)); }
float M_acos(float x) { return acos(clamp(x, -1.0, 1.0)); }
float M_asin(float x) { return asin(clamp(x, -1.0, 1.0)); }
vec2 M_norm(vec2 v) { float l = length(v); return l > 1e-20 ? v / l : vec2(0.0); }
vec3 M_norm(vec3 v) { float l = length(v); return l > 1e-20 ? v / l : vec3(0.0); }
vec4 M_norm(vec4 v) { float l = length(v); return l > 1e-20 ? v / l : vec4(0.0); }
#define smoothstep M_ss
#define sqrt M_sqrt
#define log M_log
#define inversesqrt M_rsqrt
#define acos M_acos
#define asin M_asin
#define normalize M_norm
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
const KIT_LIMITS = { styles: 40, params: 32, passes: 4, fileBytes: 96 * 1024, kitBytes: 3 * 1024 * 1024, palettes: 8, inputs: 2, expanded: 48 };
// Media inputs (SDK 1.1): an image or video the user attaches to a layer, sampled in GLSL as u_<id>.
const INPUT_RE = /^[a-z][a-zA-Z0-9]{0,15}$/;
const INPUT_TYPES = ['image', 'video', 'media'];
const INPUT_FITS = ['fill', 'fit', 'stretch'];
const INPUT_RESERVED = new Set(['res', 'p', 'l', 'seed', 'safe', 'bg', 'ink', 'a0', 'a1', 'a2', 'buf0', 'buf1', 'buf2', 'buf3', 'out']);
// Text inputs (motif-kit@3): up to three separately editable lines the host rasterizes into ONE atlas texture.
// Strings never become uniforms; the shader samples glyph coverage through textLine_<id>(i, q). See 04b-text-atlas.
const TEXT = {
  lines: 3, chars: 128, defChars: 64, family: 64, aspect: [2, 16], defAspect: 8,
  weights: [100, 200, 300, 400, 500, 600, 700, 800, 900], aligns: ['left', 'center', 'right'],
  size: [0.1, 1], defSize: 0.72, tracking: [-0.2, 0.8], defTracking: 0, defFamily: 'Instrument Sans', defWeight: 700,
};
const LINE_ID_RE = /^[a-z][a-zA-Z0-9]{0,15}$/;
// Font family names reach a CSS font shorthand: letters, digits, spaces and a few punctuation marks only (no quotes,
// commas, semicolons, backslashes or control characters), so a kit or a project can never inject a second family.
const FAMILY_RE = /^[\p{L}\p{N} _.&+()-]{1,64}$/u;
const CTRL_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u2028\u2029]/;
// One declared line → { id, label, def, maxLength, font:{ family, weight }, size, tracking, align }. Returns a string on error.
function normTextLine(x, w, i) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return `${w} must be an object like { "id": "line1", "label": "Line 1", "def": "HELLO" }.`;
  if (!LINE_ID_RE.test(x.id || '')) return `${w}.id must be camelCase letters/digits (max 16), e.g. "line1".`;
  const maxLength = x.maxLength == null ? TEXT.defChars : Number(x.maxLength);
  if (!Number.isInteger(maxLength) || maxLength < 1 || maxLength > TEXT.chars) return `${w}.maxLength must be an integer 1–${TEXT.chars}.`;
  const def = x.def == null ? '' : x.def;
  if (typeof def !== 'string') return `${w}.def must be a string.`;
  if (CTRL_RE.test(def) || /[\r\n]/.test(def)) return `${w}.def must be one line of text without control characters.`;
  if (def.length > maxLength) return `${w}.def is ${def.length} characters; maxLength is ${maxLength}.`;
  if (x.label != null && typeof x.label !== 'string') return `${w}.label must be a string.`;
  const f = x.font == null ? {} : x.font;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return `${w}.font must be an object like { "family": "Instrument Sans", "weight": 700 }.`;
  for (const k of Object.keys(f)) if (!['family', 'weight'].includes(k)) return `${w}.font.${k.slice(0, 24)}: a font declares only family and weight (fonts are never loaded from a kit).`;
  const family = f.family == null ? TEXT.defFamily : f.family;
  if (typeof family !== 'string' || !FAMILY_RE.test(family)) return `${w}.font.family must be 1–64 letters, digits, spaces or . _ & + ( ) - (no quotes, commas or semicolons).`;
  const weight = f.weight == null ? TEXT.defWeight : Number(f.weight);
  if (!TEXT.weights.includes(weight)) return `${w}.font.weight must be one of ${TEXT.weights.join(', ')}.`;
  const size = x.size == null ? TEXT.defSize : Number(x.size);
  if (!(size >= TEXT.size[0] && size <= TEXT.size[1])) return `${w}.size must be ${TEXT.size[0]}–${TEXT.size[1]} (em size as a fraction of the band height).`;
  const tracking = x.tracking == null ? TEXT.defTracking : Number(x.tracking);
  if (!(tracking >= TEXT.tracking[0] && tracking <= TEXT.tracking[1])) return `${w}.tracking must be ${TEXT.tracking[0]}–${TEXT.tracking[1]} em.`;
  const align = x.align == null ? 'center' : x.align;
  if (!TEXT.aligns.includes(align)) return `${w}.align must be left, center or right.`;
  return { id: x.id, label: String(x.label || `Line ${i + 1}`).slice(0, 24), def, maxLength, font: { family, weight }, size, tracking, align };
}
function normTextInput(x, w, err) {
  if (!Array.isArray(x.lines) || x.lines.length < 1 || x.lines.length > TEXT.lines) { err(`${w}.lines must list 1–${TEXT.lines} lines.`); return null; }
  const lines = [], ids = new Set();
  for (let i = 0; i < x.lines.length; i++) {
    const l = normTextLine(x.lines[i], `${w}.lines[${i}]`, i);
    if (typeof l === 'string') { err(l); return null; }
    if (ids.has(l.id)) { err(`${w}.lines[${i}]: duplicate line id "${l.id}".`); return null; }
    ids.add(l.id); lines.push(l);
  }
  const aspect = x.aspect == null ? TEXT.defAspect : Number(x.aspect);
  if (!(aspect >= TEXT.aspect[0] && aspect <= TEXT.aspect[1])) { err(`${w}.aspect must be ${TEXT.aspect[0]}–${TEXT.aspect[1]} (band width : height).`); return null; }
  for (const k of ['fit', 'required']) if (x[k] != null) { err(`${w}.${k} does not apply to a text input.`); return null; }
  return { id: x.id, type: 'text', label: String(x.label || x.id[0].toUpperCase() + x.id.slice(1)).slice(0, 24), hint: String(x.hint || '').slice(0, 120), aspect, lines };
}
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
// opts.text: the manifest format allows text inputs (motif-kit@3). Earlier formats reject them by name.
function normInputs(list, where, err, opts = {}) {
  if (list == null) return null;
  if (!Array.isArray(list)) { err(`${where}inputs must be an array.`); return []; }
  if (list.length > KIT_LIMITS.inputs) err(`${where}inputs: at most ${KIT_LIMITS.inputs} media inputs.`);
  const out = [], seen = new Set();
  list.slice(0, KIT_LIMITS.inputs).forEach((x, i) => {
    const w = `${where}inputs[${i}]`;
    if (!x || !INPUT_RE.test(x.id || '')) return err(`${w}.id must be camelCase letters/digits (max 16), e.g. "source".`);
    if (INPUT_RESERVED.has(String(x.id).toLowerCase())) return err(`${w}.id "${x.id}" clashes with a built-in uniform.`);
    if (seen.has(x.id)) return err(`${w}: duplicate input id "${x.id}".`); seen.add(x.id);
    const type = x.type == null ? 'media' : x.type;
    if (type === 'text') {
      if (!opts.text) return err(`${w}.type "text" needs "format": "motif-kit@3".`);
      const t = normTextInput(x, w, err); if (t) out.push(t); return;
    }
    if (!INPUT_TYPES.includes(type)) return err(`${w}.type must be image, video or media${opts.text ? ', or text' : ''}.`);
    const fit = x.fit == null ? 'fill' : x.fit;
    if (!INPUT_FITS.includes(fit)) return err(`${w}.fit must be fill, fit or stretch.`);
    out.push({ id: x.id, type, label: String(x.label || x.id[0].toUpperCase() + x.id.slice(1)).slice(0, 24), fit, required: !!x.required, hint: String(x.hint || '').slice(0, 120) });
  });
  return out;
}
const ID_RE = /^[a-z][a-z0-9-]{1,31}$/;
const KEY_RE = /^[a-z][a-zA-Z0-9]{0,23}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const RESERVED_KITS = new Set(['core', 'motif', 'builtin', 'all']);

function validateKit(manifest, files) {
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
  let total = 0; for (const [k, v] of Object.entries(files || {})) { const n = typeof v === 'string' ? v.length : (v && v.byteLength) || 0; total += n; if (/\.glsl$/.test(k) && n > KIT_LIMITS.fileBytes) err(`${k} is larger than ${KIT_LIMITS.fileBytes / 1024} KB.`); }
  if (total > KIT_LIMITS.kitBytes) err(`Kit is larger than ${KIT_LIMITS.kitBytes / 1048576} MB.`);
  const fileText = p => { const v = files && files[p]; return typeof v === 'string' ? v : null; };
  const common = m.common ? fileText(m.common) : '';
  if (m.common && common == null) err(`common file "${m.common}" is not in the package.`);
  if (common && /\bvoid\s+main\s*\(/.test(common)) err('common.glsl must not define main().');
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
    const params = normParams(s.params, where, err, warn);
    const inputs = resolveInputs(s, where, kitInputs, [common || '', ...passes.map(x => x.src || '')].join('\n'), styles, params, err, warn);
    const pal = s.palette ? `${m.id}.${s.palette}` : null;
    if (pal && !palettes.some(p => p.id === pal)) warn(`${where}: palette "${s.palette}" is not defined by the kit.`);
    const cost = Math.max(0.25, Math.min(24, Number(s.cost) || 1));
    styles.push({ id: `${m.id}/${s.id}`, localId: s.id, cost, name: String(s.name || s.id).slice(0, 32), blurb: String(s.blurb || '').slice(0, 160), group: String(s.group || '').slice(0, 24), tags: (Array.isArray(s.tags) ? s.tags : []).map(String).slice(0, 8), palette: pal && palettes.some(p => p.id === pal) ? pal : null, flash: !!s.flash, passes, params, inputs });
  });
  const ok = errors.length === 0;
  return { ok, errors, warnings, kit: ok ? { format: KIT_FORMAT, id: m.id, name: String(m.name), version: m.version, author: String(m.author || '').slice(0, 48), description: String(m.description || '').slice(0, 280), accent: m.accent || null, license: String(m.license || '').slice(0, 32), palettes, styles, common: common || '' } : null };
}
// Params of one entry (style, effect or transition): normalized specs keyed by uniform name. Shared by motif-kit@1 and @2.
function normParams(raw0, where, err, warn) {
    const params = {};
    const raw = raw0 || {};
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
    if (Object.keys(params).length > KIT_LIMITS.expanded) err(`${where}: colour and point params count as 3 and 2 uniforms; at most ${KIT_LIMITS.expanded} in total.`);
    if (keys.length < 4) warn(`${where}: fewer than 4 params gives Mutate and Evolve little to work with.`);
    return params;
}
// Media inputs: the entry's own list wins, else the kit-level list. Kits written before SDK 1.1 that declare
// `uniform sampler2D u_<name>;` themselves get an implicit input so they work unchanged.
// text: the entry's GLSL (common + passes); prior: entries already normalized (one implicit-input warning per kit).
function resolveInputs(s, where, kitInputs, text, prior, params, err, warn, opts) {
    let inputs = normInputs(s.inputs, `${where}.`, err, opts);
    if (inputs == null) inputs = kitInputs;
    if (inputs == null) {
      inputs = []; const re = /\buniform\s+sampler2D\s+u_([A-Za-z][A-Za-z0-9]{0,15})\s*;/g; let mm;
      while ((mm = re.exec(text)) && inputs.length < KIT_LIMITS.inputs) { const id = mm[1]; if (INPUT_RESERVED.has(id.toLowerCase()) || inputs.some(q => q.id === id)) continue; inputs.push({ id, type: 'media', label: id[0].toUpperCase() + id.slice(1), fit: 'fill', required: false, hint: '', implicit: true }); }
      if (inputs.length && !prior.some(x => x.inputs.some(q => q.implicit))) warn(`Declares ${inputs.map(q => 'u_' + q.id).join(', ')} without "inputs"; treated as media input${inputs.length > 1 ? 's' : ''}. Add "inputs": [{ "id": "${inputs[0].id}", "type": "media" }] to the manifest.`);
    }
    for (const q of inputs) if (params[q.id + 'On'] || params[q.id]) warn(`${where}: param "${q.id}" shares a name with media input "${q.id}".`);
    return inputs;
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
  let s = '', firstText = null;
  for (const q of inputs || []) {
    const n = q.id;
    if (q.type === 'text') { s += textSource(q); if (!firstText) firstText = n; continue; }
    s += `uniform sampler2D u_${n};\nuniform float u_${n}On;\nuniform vec2 u_${n}Size;\nuniform float u_${n}Time;\n`;
    s += `vec4 m_${n}(vec2 q) { return texture(u_${n}, clamp(q, vec2(0.0), vec2(1.0))); }\n`;
    s += `vec4 m_${n}Px(vec2 fc) { return m_${n}(fc / u_res); }\n`;
    s += `vec4 m_${n}UV(vec2 uv) { return m_${n}(uv * min(u_res.x, u_res.y) / u_res + 0.5); }\n`;
  }
  if (firstText) s += `vec4 textLine(int i, vec2 q) { return textLine_${firstText}(i, q); }\n`;
  return s;
}
// Text inputs (motif-kit@3). One atlas texture per input, built by the host (04b-text-atlas), never by the kit:
//   u_<id>            sampler2D  RGBA8, linear (no sRGB decode), PREMULTIPLIED white glyphs: rgb == a == coverage
//   u_<id>On          float      1.0 once the host has rasterized the atlas (0.0: transparent black everywhere)
//   u_<id>Size        vec2       atlas size in pixels (width × lines·width/aspect)
//   textLines_<id>    const int  number of declared lines (1–3)
//   textAspect_<id>   const float band width : height (manifest "aspect", default 8)
//   m_<id>(q)         vec4       the whole atlas at q (0..1, origin bottom-left; line 1 is the TOP band)
//   textLine_<id>(i, q) vec4     line i (0-based) at line-local q: centred, isotropic, the band spans
//                                x -0.5..0.5 and y -0.5/aspect..0.5/aspect. Outside the band: vec4(0).
//   textLine(i, q)    vec4       the same for the entry's first text input
// Each line is drawn CENTRED (vertically on its cap height) and UNTRANSFORMED in its band, so the shader applies
// position, scale, rotation and motion exactly once. Coverage is sampled with mipmaps: minified text stays smooth.
function textSource(q) {
  const n = q.id, N = q.lines.length, A = Number(q.aspect).toFixed(4);
  return `uniform sampler2D u_${n};\nuniform float u_${n}On;\nuniform vec2 u_${n}Size;\n`
    + `const int textLines_${n} = ${N};\nconst float textAspect_${n} = ${A};\n`
    + `vec4 m_${n}(vec2 q) { return texture(u_${n}, clamp(q, vec2(0.0), vec2(1.0))); }\n`
    + `vec4 textLine_${n}(int i, vec2 q) {\n  if (i < 0 || i >= ${N}) return vec4(0.0);\n  vec2 b = vec2(q.x + 0.5, q.y * ${A} + 0.5);\n`
    + `  float inside = step(0.0, b.x) * step(b.x, 1.0) * step(0.0, b.y) * step(b.y, 1.0);\n`
    + `  vec2 t = vec2(clamp(b.x, 0.0, 1.0), (float(${N - 1} - i) + clamp(b.y, 0.0, 1.0)) / ${N}.0);\n`
    + `  return texture(u_${n}, t) * inside;\n}\n`;
}
// Kits may declare the input uniforms themselves (SDK 1.0 style); strip those so the runtime's declarations win.
// The declaration is blanked in place, so pass-local line numbers stay correct.
function stripInputDecls(text, inputs) {
  if (!text || !inputs || !inputs.length) return text || '';
  for (const q of inputs) text = text.replace(new RegExp(`\\buniform\\s+\\w+\\s+u_${q.id}(On|Size|Time)?\\s*;`, 'g'), '');
  return text;
}
// extra (motif-kit@2): runtime declarations for graph buffers, transition progress and audio bands (see kit-sandbox).
function buildSource(passSrc, common, params, final, inputs, extra) {
  passSrc = stripInputDecls(passSrc, inputs); common = stripInputDecls(common, inputs);
  const pre = PRELUDE + '\n// ---- params ----\n' + paramUniforms(params) + (inputs && inputs.length ? '\n// ---- media inputs ----\n' + inputSource(inputs) : '') + (extra ? '\n// ---- runtime (motif-kit@2) ----\n' + extra : '') + '\n// ---- kit common ----\n';
  const head = pre + (common || '') + '\n// ---- pass ----\n#line 1 1\n';
  // commonLine: first line of the kit common file in the compiled source (driver logs report it as 0:<line>).
  return { src: head + passSrc + (final ? MAIN_FINAL : MAIN_PASS), headLines: head.split('\n').length - 1, commonLine: pre.split('\n').length, commonLines: common ? common.split('\n').length : 0 };
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
  const MEDIA_UNIT = 4;
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
  // Upload (or refresh) a baked media canvas as an sRGB texture, so shaders sample linear light. Text atlases
  // (m.linear, motif-kit@3) are coverage, not colour: RGBA8 without sRGB decode, so premultiplied white keeps rgb == a.
  // Storage is allocated once per (canvas, size, format); a changed rev re-uploads into it with texSubImage2D.
  let uploads = 0;
  function mediaTexture(m) {
    let e = mediaTex.get(m.canvas);
    if (e) { mediaTex.delete(m.canvas); mediaTex.set(m.canvas, e); } // true LRU, including unchanged frames
    const lin = !!m.linear;
    if (e && e.rev === m.rev && e.w === m.canvas.width && e.h === m.canvas.height && e.lin === lin) return e.tex;
    if (!e) {
      e = { tex: gl.createTexture(), rev: -1 }; mediaTex.set(m.canvas, e);
      if (mediaTex.size > 12) { const [k0, e0] = mediaTex.entries().next().value; gl.deleteTexture(e0.tex); mediaTex.delete(k0); }
    }
    const w = m.canvas.width, h = m.canvas.height;
    if (e.w != null && (e.w !== w || e.h !== h || e.lin !== lin)) { gl.deleteTexture(e.tex); e.tex = gl.createTexture(); e.w = null; }
    gl.activeTexture(gl.TEXTURE0 + MEDIA_UNIT + 3); gl.bindTexture(gl.TEXTURE_2D, e.tex);
    if (e.w == null) {
      gl.texStorage2D(gl.TEXTURE_2D, 1 + Math.floor(Math.log2(Math.max(w, h))), lin ? gl.RGBA8 : gl.SRGB8_ALPHA8, w, h);
      e.w = w; e.h = h; e.lin = lin;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    try { gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, m.canvas); }
    finally { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); }
    gl.generateMipmap(gl.TEXTURE_2D); // Preserve minification quality, including rotated/scaled media.
    e.rev = m.rev; uploads++; return e.tex;
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
  // Lines inside the kit's common file are reported as "in common line N".
  function cleanLog(log, cs, cn) {
    return String(log || '').split('\n').filter(Boolean).map(l => l.replace(/^(ERROR|WARNING): 1:(\d+):/, (m, k, n) => `${k === 'ERROR' ? 'Error' : 'Warning'} line ${n}:`).replace(/^(ERROR|WARNING): 0:(\d+):/, (m, k, n) => (cn && +n >= cs && +n < cs + cn ? `${k === 'ERROR' ? 'Error' : 'Warning'} in common line ${n - cs + 1}:` : `${k === 'ERROR' ? 'Error' : 'Warning'} in prelude/common (line ${n}):`))).slice(0, 12).join('\n');
  }
  function startPass(src, final, common, params, inputs, extra) {
    const { src: fs, commonLine, commonLines } = buildSource(src, common, params, final, inputs, extra);
    const v = shader(gl.VERTEX_SHADER, VS), f = shader(gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.bindAttribLocation(p, 0, 'a_pos'); gl.linkProgram(p);
    return { p, v, f, cs: commonLine, cn: commonLines };
  }
  function finishPass({ p, v, f, cs, cn }) {
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = cleanLog(gl.getShaderInfoLog(f), cs, cn) || gl.getProgramInfoLog(p);
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
    programs.set(key, started.graph ? { passes, inputs: started.inputs || [], graph: started.graph } : { passes, inputs: started.inputs || [] }); return { ok: true };
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
      if (def.graph) {
        // motif-kit@2 pass graph: each pass gets declarations for the buffers it reads (see kit-sandbox graphDecls).
        job = def.graph.passes.map(ps => ({ ...startPass(ps.src, ps.writes === 'output', def.common, def.params, def.inputs, ps.extra || ''), scale: 1 }));
        job.graph = def.graph;
      } else job = def.passes.map((ps, i) => ({ ...startPass(ps.src, i === def.passes.length - 1, def.common, def.params, def.inputs, def.extra), scale: Math.min(1, Math.max(0.125, ps.scale || 1)) }));
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
    // In-flight background compiles too (a cancelled or timed-out kit check must not finish later).
    for (const [k, job] of compiling) if (k.startsWith(prefix)) { job.forEach(x => { gl.deleteProgram(x.p); gl.deleteShader(x.v); gl.deleteShader(x.f); }); compiling.delete(k); }
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
    if (timerExt && pending.length < 4 && !opt.noTimer) { query = gl.createQuery(); gl.beginQuery(timerExt.TIME_ELAPSED_EXT, query); }
    if (entry.graph) runGraph(key, entry, w, h, u, pal, bands);
    // DOM uploads can flush the graphics pipeline. Finish them before submitting any shader passes.
    const inputs = entry.graph ? [] : entry.inputs.map(q => u.media && u.media[q.id] ? mediaTexture(u.media[q.id]) : blankTex);
    const texs = [];
    (entry.graph ? [] : entry.passes).forEach((ps, i) => {
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
        if (!loc) return;
        // An SDK 1.0 kit that declared the sampler itself read u_buf0 (unit 0) when nothing was bound; keep that fallback.
        if (!m && q.implicit) { gl.uniform1i(loc, 0); return; }
        const tex = inputs[j];
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
  // ---- motif-kit@2 pass graph ----
  // Buffers are named render targets (scale × output size). A pass that reads the buffer it writes ping-pongs
  // between two targets, `iterate` times (bounded by validation). External inputs (an effect's `input`, a
  // transition's `from`/`to`) arrive as host canvases ({ canvas, rev }) and upload like media. Feedback lives
  // within one frame only: nothing carries over between frames, so exports stay deterministic and loops close.
  const GRAPH_UNIT = 8, ZERO8 = new Float32Array(8);
  function stdUniforms(U, pw, ph, u, pal, entry, media) {
    if (U.u_res) gl.uniform2f(U.u_res, pw, ph);
    if (U.u_p) gl.uniform1f(U.u_p, u.p);
    if (U.u_L) gl.uniform1f(U.u_L, u.L);
    if (U.u_seed) gl.uniform1f(U.u_seed, u.seed);
    if (U.u_safe) gl.uniform1f(U.u_safe, u.safe ? 1 : 0);
    if (U.u_progress) gl.uniform1f(U.u_progress, Math.min(1, Math.max(0, +u.progress || 0)));
    if (U.u_audio) gl.uniform1fv(U.u_audio, u.audio && u.audio.length === 8 ? u.audio : ZERO8);
    ['u_bg', 'u_ink', 'u_a0', 'u_a1', 'u_a2'].forEach((n, j) => { if (U[n]) gl.uniform3fv(U[n], pal[j]); });
    entry.inputs.forEach((q, j) => {
      const loc = U['u_' + q.id]; const m = u.media && u.media[q.id];
      if (U['u_' + q.id + 'On']) gl.uniform1f(U['u_' + q.id + 'On'], m ? 1 : 0);
      if (U['u_' + q.id + 'Size']) gl.uniform2f(U['u_' + q.id + 'Size'], m ? m.w : 0, m ? m.h : 0);
      if (U['u_' + q.id + 'Time']) gl.uniform1f(U['u_' + q.id + 'Time'], m ? m.time || 0 : 0);
      if (!loc) return;
      gl.activeTexture(gl.TEXTURE0 + MEDIA_UNIT + j); gl.bindTexture(gl.TEXTURE_2D, media[j]); gl.uniform1i(loc, MEDIA_UNIT + j);
    });
    for (const [k, sp] of Object.entries(u.spec)) {
      const loc = U['p_' + k]; if (!loc) continue; const v = u.params[k];
      if (sp.type === 'range') gl.uniform1f(loc, +v);
      else if (sp.type === 'int') gl.uniform1i(loc, Math.round(v));
      else if (sp.type === 'toggle') gl.uniform1i(loc, v ? 1 : 0);
      else if (sp.type === 'select') gl.uniform1i(loc, Math.max(0, sp.options.findIndex(o => o.v === v)));
    }
  }
  function runGraph(key, entry, w, h, u, pal, bands) {
    const g = entry.graph, cur = {}, ext = {};
    for (const n of g.externals || []) ext[n] = u.ext && u.ext[n] ? mediaTexture(u.ext[n]) : blankTex;
    const media = entry.inputs.map(q => u.media && u.media[q.id] ? mediaTexture(u.media[q.id]) : blankTex);
    entry.passes.forEach((ps, i) => {
      const gp = g.passes[i], out = gp.writes === 'output';
      const sc = out ? 1 : (g.buffers[gp.writes] && g.buffers[gp.writes].scale) || 1;
      const pw = out ? w : Math.max(1, Math.round(w * sc)), ph = out ? h : Math.max(1, Math.round(h * sc));
      const self = !out && gp.reads.includes(gp.writes), n = out ? 1 : Math.max(1, Math.min(16, gp.iterate || 1));
      for (let it = 0; it < n; it++) {
        let dest = null;
        if (out) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        else { const c = cur[gp.writes], slot = self && c ? 1 - c.slot : 0; dest = target(key, `g:${gp.writes}:${slot}`, pw, ph); dest.slot = slot; gl.bindFramebuffer(gl.FRAMEBUFFER, dest.fbo); }
        gl.viewport(0, 0, pw, ph);
        gl.useProgram(ps.prog); const U = ps.uniforms;
        stdUniforms(U, pw, ph, u, pal, entry, media);
        if (U.u_iter) gl.uniform1i(U.u_iter, it);
        if (U.u_iters) gl.uniform1i(U.u_iters, n);
        // A buffer read before it is written this frame (first ping-pong step) samples transparent black, never last frame.
        gp.reads.forEach((r, j) => { const loc = U['g_' + r]; if (!loc) return; gl.activeTexture(gl.TEXTURE0 + GRAPH_UNIT + j); gl.bindTexture(gl.TEXTURE_2D, ext[r] || (cur[r] ? cur[r].tex : blankTex)); gl.uniform1i(loc, GRAPH_UNIT + j); });
        for (let b = 0; b < MAX_PASSES; b++) { const nm = 'u_buf' + b; if (!U[nm]) continue; const c = g.linear && b < i ? cur['p' + b] : null; gl.activeTexture(gl.TEXTURE0 + b); gl.bindTexture(gl.TEXTURE_2D, c ? c.tex : blankTex); gl.uniform1i(U[nm], b); }
        gl.enable(gl.SCISSOR_TEST);
        if (out) { gl.scissor(0, 0, pw, ph); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
        const nb = Math.min(bands, ph);
        for (let b = 0; b < nb; b++) {
          const y0 = Math.floor((b * ph) / nb), y1 = Math.floor(((b + 1) * ph) / nb);
          gl.scissor(0, y0, pw, y1 - y0); gl.drawArrays(gl.TRIANGLES, 0, 3);
          if (nb > 1) gl.flush();
        }
        gl.disable(gl.SCISSOR_TEST);
        if (dest) cur[gp.writes] = { tex: dest.tex, slot: dest.slot };
      }
    });
  }
  // Canary: draw once at w×h and wait for the GPU (1-pixel readback) so the wall time covers execution.
  // Returns { ms, px } or null when the style cannot draw (not compiled, context lost).
  function probe(key, w, h, u, opt) {
    if (!init() || lost) return null;
    const t0 = performance.now();
    if (!draw(key, w, h, u, opt)) return null;
    const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { ms: performance.now() - t0, px: Array.from(px), lost: gl.isContextLost() };
  }
  // Non-blocking canary: draw once, then poll from timers so the main thread never waits on the GPU.
  // With EXT_disjoint_timer_query the result is the GPU time of this draw alone (other contexts' queued work, such
  // as stage frames, does not count); otherwise a fence gives the wall time until it completes.
  // Resolves { ms, wall, done, timer } — done:false when nothing came back within timeoutMs of wall time (that
  // frame keeps running on the GPU, bounded by the static limits; nothing on the main thread waits for it).
  function probeAsync(key, w, h, u, timeoutMs, opt = {}) {
    if (!init() || lost) return Promise.resolve(null);
    const t0 = performance.now();
    const q = timerExt ? gl.createQuery() : null;
    if (q) gl.beginQuery(timerExt.TIME_ELAPSED_EXT, q);
    const ok = draw(key, w, h, u, { ...opt, noTimer: true });
    if (q) gl.endQuery(timerExt.TIME_ELAPSED_EXT);
    if (!ok) { if (q) gl.deleteQuery(q); return Promise.resolve(null); }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
    return new Promise(resolve => {
      const end = r => { if (q) gl.deleteQuery(q); if (sync) gl.deleteSync(sync); resolve(r); };
      const tick = () => {
        const wall = performance.now() - t0;
        if (lost || gl.isContextLost()) { resolve({ ms: wall, wall, done: false, lost: true }); return; }
        if (q && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
          const ns = gl.getQueryParameter(q, gl.QUERY_RESULT), disjoint = gl.getParameter(timerExt.GPU_DISJOINT_EXT);
          if (!disjoint && ns > 0) { end({ ms: ns / 1e6, wall, done: true, timer: true }); return; }
        }
        const st = sync ? gl.clientWaitSync(sync, 0, 0) : gl.WAIT_FAILED;
        if (!q && (st === gl.ALREADY_SIGNALED || st === gl.CONDITION_SATISFIED)) { end({ ms: wall, wall, done: true, timer: false }); return; }
        if (q && (st === gl.ALREADY_SIGNALED || st === gl.CONDITION_SATISFIED) && wall > 250) { end({ ms: wall, wall, done: true, timer: false }); return; } // timer result never came (disjoint): fall back to wall time
        if (st === gl.WAIT_FAILED && !q) { end({ ms: wall, wall, done: false }); return; }
        if (wall > timeoutMs) { end({ ms: wall, wall, done: false }); return; }
        setTimeout(tick, 2);
      };
      setTimeout(tick, 0);
    });
  }
  // Copy the last draw (bottom-left of the GL canvas) into a 2D context at 0,0, scaled to w×h.
  function blit(ctx, w, h) {
    const sw = last.w || Math.round(w), sh = last.h || Math.round(h);
    const up = sw !== Math.round(w) || sh !== Math.round(h);
    if (up) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
    ctx.drawImage(canvas, 0, canvas.height - sh, sw, sh, 0, 0, w, h);
  }
  return {
    init, compile, poll, forget, draw, blit, probe, probeAsync, canvas, hexToLin, programs, get pendingCompiles() { return compiling.size; }, isCompiling(key) { return compiling.has(key); },
    get ok() { return init(); }, get reason() { return reason; }, get halfFloat() { return halfFloat; },
    get lost() { return lost; }, get lostCount() { return lostCount; }, get timer() { return !!timerExt; }, get renderer() { init(); return rendererName; }, get software() { init(); return software; },
    costOf(key) { return gpuMs.get(key); }, on(fn) { listeners.add(fn); return () => listeners.delete(fn); }, get uploads() { return uploads; },
  };
}

return { KIT_FORMAT, KIT_LIMITS, SDK_VERSION: '3.0.0', validateKit, createGlRuntime, PRELUDE, MAIN_FINAL, MAIN_PASS, buildSource, paramUniforms, inputSource, textSource, RESERVED, MAX_PASSES, hexToLin, TEXT, FAMILY_RE, LINE_ID_RE, normTextLine,
  // Shared with kit-sandbox (motif-kit@2 validation); not part of the author-facing API.
  normParams, normInputs, resolveInputs, INPUT_RESERVED, ID_RE, KEY_RE, HEX_RE, SEMVER_RE, RESERVED_KITS };

})();

