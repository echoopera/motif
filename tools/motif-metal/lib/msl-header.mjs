// Hand-written Metal layer under every generated pass: GLSL-compatible scalar/vector maths, texture access with
// GL's bottom-left origin, and the per-frame uniform block shared with the Swift runtime (MotifUniforms.swift).

// GLSL lets a scalar stand in for a vector in min/max/clamp/mix/step/smoothstep/mod; Metal's overloads do not.
// Spelled out per vector type (no template N) so overload resolution never depends on Metal's internal vec<> signature.
function scalarMixing() {
  // min/max/clamp stay metal::min/max/clamp on purpose: ANGLE (Chrome, Safari's WebGL) lowers GLSL min/max to exactly these
  // when it runs on Metal, so NaN handling matches what the web build does on the same Apple GPU.
  let o = `template <typename T> inline T M_min(T a, T b) { return metal::min(a, b); }
template <typename T> inline T M_max(T a, T b) { return metal::max(a, b); }
template <typename T> inline T M_clamp(T x, T lo, T hi) { return metal::clamp(x, lo, hi); }
template <typename T> inline T M_mix(T a, T b, T t) { return metal::mix(a, b, t); }
template <typename T> inline T M_mix(T a, T b, bool t) { return t ? b : a; }
template <typename T> inline T M_step(T e, T x) { return metal::step(e, x); }
template <typename T> inline T M_mod(T x, T y) { return x - y * metal::floor(x / y); }
`;
  // A scalar may stand in for a vector argument (GLSL allows it; Metal's overloads do not).
  for (const [S, pre] of [['float', 'float'], ['int', 'int'], ['uint', 'uint']]) for (const n of [2, 3, 4]) {
    const V = pre + n, B = 'bool' + n, f = S === 'float';
    o += `inline ${V} M_min(${V} a, ${S} b) { return metal::min(a, ${V}(b)); }\n`;
    o += `inline ${V} M_max(${V} a, ${S} b) { return metal::max(a, ${V}(b)); }\n`;
    o += `inline ${V} M_clamp(${V} x, ${S} lo, ${S} hi) { return metal::clamp(x, ${V}(lo), ${V}(hi)); }\n`;
    if (f) {
      o += `inline ${V} M_mix(${V} a, ${V} b, ${S} t) { return metal::mix(a, b, ${V}(t)); }\n`;
      o += `inline ${V} M_mix(${V} a, ${V} b, ${B} t) { return select(a, b, t); }\n`;
      o += `inline ${V} M_step(${S} e, ${V} x) { return metal::step(${V}(e), x); }\n`;
      o += `inline ${V} M_mod(${V} x, ${S} y) { return x - ${V}(y) * metal::floor(x / ${V}(y)); }\n`;
    }
  }
  // smoothstep is the formula, so reversed edges give a descending ramp and equal edges a hard step; metal::smoothstep is
  // undefined for edge0 >= edge1.
  o += `template <typename T> inline T M_smoothstep(T a, T b, T x) { T t = metal::clamp((x - a) / (b - a), T(0), T(1)); return t * t * (T(3) - T(2) * t); }\n`;
  for (const n of [2, 3, 4]) { const V = 'float' + n; o += `inline ${V} M_smoothstep(float a, float b, ${V} x) { return M_smoothstep(${V}(a), ${V}(b), x); }\n`; }
  return o;
}
const SCALAR_MIXING = scalarMixing();

export const MSL_HEADER = String.raw`#include <metal_stdlib>
using namespace metal;

// ---- host uniforms (mirrors MotifUniforms.swift; 144 bytes) --------------------------------------------------
struct MotifUniforms {
  float2 res;      // pass resolution in pixels
  float  p;        // loop phase 0..1
  float  L;        // effective loop length in seconds
  float  seed;     // 1..9999
  float  safe;     // 1 = photosensitive-safe limiter
  float  encode;   // 0 = linear premultiplied RGBA, 1 = web-identical final (sRGB, dithered, premultiplied)
  float  _pad;
  float4 bg;       // palette, linear RGB in xyz
  float4 ink;
  float4 a0;
  float4 a1;
  float4 a2;
  float4 media0;   // media input 0: x = attached (0/1), y = video time, zw = pixel size
  float4 media1;
};

// ---- textures: GL samples with v = 0 at the bottom; Metal stores row 0 on top, so v is flipped here ------------
struct MTex { texture2d<float> t; };
constexpr sampler M_smp(coord::normalized, address::clamp_to_edge, filter::linear, mip_filter::linear);
inline float4 M_tex(MTex s, float2 uv) { return s.t.sample(M_smp, float2(uv.x, 1.0 - uv.y)); }
inline float4 M_texLod(MTex s, float2 uv, float lod) { return s.t.sample(M_smp, float2(uv.x, 1.0 - uv.y), level(lod)); }
inline float4 M_texelFetch(MTex s, int2 p, int lod) { return s.t.read(uint2(p.x, int(s.t.get_height(uint(lod))) - 1 - p.y), uint(lod)); }
inline int2 M_texSize(MTex s, int lod) { return int2(int(s.t.get_width(uint(lod))), int(s.t.get_height(uint(lod)))); }

// ---- GLSL maths that Metal lacks or spells differently --------------------------------------------------------
// GLSL lets scalars stand in for vectors in min/max/clamp/mix/step/smoothstep/mod; Metal's overloads do not.
${SCALAR_MIXING}
template <typename T> inline T M_radians(T d) { return d * 0.017453292519943295; }
template <typename T> inline T M_degrees(T r) { return r * 57.29577951308232; }
template <typename A, typename B> inline auto M_lessThan(A a, B b) { return a < b; }
template <typename A, typename B> inline auto M_lessThanEqual(A a, B b) { return a <= b; }
template <typename A, typename B> inline auto M_greaterThan(A a, B b) { return a > b; }
template <typename A, typename B> inline auto M_greaterThanEqual(A a, B b) { return a >= b; }
template <typename A, typename B> inline auto M_equal(A a, B b) { return a == b; }
template <typename A, typename B> inline auto M_notEqual(A a, B b) { return a != b; }
// GLSL's == and != on vectors give one bool; Metal's give a bool vector.
inline bool M_all(bool x) { return x; }
inline bool M_all(bool2 x) { return all(x); }
inline bool M_all(bool3 x) { return all(x); }
inline bool M_all(bool4 x) { return all(x); }
inline bool M_any(bool x) { return x; }
inline bool M_any(bool2 x) { return any(x); }
inline bool M_any(bool3 x) { return any(x); }
inline bool M_any(bool4 x) { return any(x); }
template <typename A, typename B> inline bool M_eq(A a, B b) { return M_all(a == b); }
template <typename A, typename B> inline bool M_ne(A a, B b) { return M_any(a != b); }
inline float2x2 M_matrixCompMult(float2x2 a, float2x2 b) { return float2x2(a[0] * b[0], a[1] * b[1]); }
inline float3x3 M_matrixCompMult(float3x3 a, float3x3 b) { return float3x3(a[0] * b[0], a[1] * b[1], a[2] * b[2]); }
inline float4x4 M_matrixCompMult(float4x4 a, float4x4 b) { return float4x4(a[0] * b[0], a[1] * b[1], a[2] * b[2], a[3] * b[3]); }
inline float2x2 M_inverse(float2x2 m) { float d = m[0][0] * m[1][1] - m[1][0] * m[0][1]; return float2x2(float2(m[1][1], -m[0][1]), float2(-m[1][0], m[0][0])) * (1.0 / d); }
inline float3x3 M_inverse(float3x3 m) {
  float3 a = m[0], b = m[1], c = m[2];
  float3 r0 = cross(b, c), r1 = cross(c, a), r2 = cross(a, b);
  float inv = 1.0 / dot(r2, c);
  return float3x3(float3(r0.x, r1.x, r2.x), float3(r0.y, r1.y, r2.y), float3(r0.z, r1.z, r2.z)) * inv;
}
// GL's window y points up and the entry point flips Metal's (fc.y = height - pos.y), so dFdy changes sign.
template <typename T> inline T M_dFdy(T v) { return -dfdy(v); }
inline uint   floatBitsToUint(float x)  { return as_type<uint>(x); }
inline uint2  floatBitsToUint(float2 x) { return as_type<uint2>(x); }
inline uint3  floatBitsToUint(float3 x) { return as_type<uint3>(x); }
inline uint4  floatBitsToUint(float4 x) { return as_type<uint4>(x); }
inline int    floatBitsToInt(float x)   { return as_type<int>(x); }
inline int2   floatBitsToInt(float2 x)  { return as_type<int2>(x); }
inline int3   floatBitsToInt(float3 x)  { return as_type<int3>(x); }
inline int4   floatBitsToInt(float4 x)  { return as_type<int4>(x); }
inline float  uintBitsToFloat(uint x)   { return as_type<float>(x); }
inline float2 uintBitsToFloat(uint2 x)  { return as_type<float2>(x); }
inline float3 uintBitsToFloat(uint3 x)  { return as_type<float3>(x); }
inline float4 uintBitsToFloat(uint4 x)  { return as_type<float4>(x); }
inline float  intBitsToFloat(int x)     { return as_type<float>(x); }
`;

// The fragment entry point wrapped around the translated pass struct.
// Texture handles are bound at construction: MSL does not promise that a default-constructed texture can be assigned later.
export function structConstructor(struct, inputs) {
  const ps = ['MTex b0', 'MTex b1', 'MTex b2', 'MTex b3', ...inputs.map((q, i) => `MTex i${i}`)];
  const is = ['u_buf0(b0)', 'u_buf1(b1)', 'u_buf2(b2)', 'u_buf3(b3)', ...inputs.map((q, i) => `u_${q.id}(i${i})`)];
  return `  ${struct}(${ps.join(', ')}) : ${is.join(', ')} {}`;
}

export function entryPoint({ fn, struct, params, inputs, passIndex }) {
  const assign = params.map(p => {
    const k = `P[${p.index}]`;
    const v = p.type === 'toggle' ? `${k} > 0.5` : p.type === 'range' ? k : `int(rint(${k}))`;
    return `  M.p_${p.key} = ${v};`;
  }).join('\n');
  const tex = inputs.map((q, i) => `, texture2d<float> in${i} [[texture(${4 + i})]]`).join('');
  const bind = inputs.map((q, i) => `  M.u_${q.id}On = U.media${i}.x;\n  M.u_${q.id}Time = U.media${i}.y;\n  M.u_${q.id}Size = U.media${i}.zw;`).join('\n');
  const ctorArgs = inputs.map((q, i) => `, MTex{in${i}}`).join('');
  return `
// ---- entry point: pass ${passIndex} ----------------------------------------------------------------------------
fragment float4 ${fn}(float4 pos [[position]],
    constant MotifUniforms& U [[buffer(0)]],
    constant float* P [[buffer(1)]],
    texture2d<float> buf0 [[texture(0)]], texture2d<float> buf1 [[texture(1)]],
    texture2d<float> buf2 [[texture(2)]], texture2d<float> buf3 [[texture(3)]]${tex})
{
  ${struct} M(MTex{buf0}, MTex{buf1}, MTex{buf2}, MTex{buf3}${ctorArgs});
  M.u_res = U.res; M.u_p = U.p; M.u_L = U.L; M.u_seed = U.seed; M.u_safe = U.safe;
  M.u_bg = U.bg.xyz; M.u_ink = U.ink.xyz; M.u_a0 = U.a0.xyz; M.u_a1 = U.a1.xyz; M.u_a2 = U.a2.xyz;
${bind}
${assign}
  float2 fc = float2(pos.x, U.res.y - pos.y);     // GL convention: origin bottom-left
  M.gl_FragCoord = float4(fc, pos.z, pos.w);
  float4 c = M.motif(M.M_uv(fc), fc);
  if (any(isnan(c))) c = float4(0.0);
  if (U.encode < 0.5) return c;
  c = max(c, float4(0.0));
  float a = clamp(max(c.a, max(c.r, max(c.g, c.b))), 0.0, 1.0);
  float3 s = a > 1e-5 ? M_clamp(c.rgb / a, 0.0, 1.0) : float3(0.0);
  s = M.M_srgb(s) + M.M_dither(fc) / 255.0;
  return float4(M_clamp(s, 0.0, 1.0) * a, a);
}
`;
}
