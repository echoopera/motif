// @module color — perceptual colour, tone mapping and grading. All inputs/outputs are linear sRGB unless noted.
// @requires
// OKLab (Björn Ottosson 2020). Mix and grade in OKLab: hue-stable gradients, no muddy midpoints.
vec3 am_toOklab(vec3 c) {
  vec3 l = mat3(0.4122214708, 0.2119034982, 0.0883024619, 0.5363325363, 0.6806995451, 0.2817188376, 0.0514459929, 0.1073969566, 0.6299787005) * c;
  l = sign(l) * pow(abs(l), vec3(1.0 / 3.0));
  return mat3(0.2104542553, 1.9779984951, 0.0259040371, 0.7936177850, -2.4285922050, 0.7827717662, -0.0040720468, 0.4505937099, -0.8086757660) * l;
}
vec3 am_fromOklab(vec3 c) {
  vec3 l = mat3(1.0, 1.0, 1.0, 0.3963377774, -0.1055613458, -0.0894841775, 0.2158037573, -0.0638541728, -1.2914855480) * c;
  l = l * l * l;
  return mat3(4.0767416621, -1.2684380046, -0.0041960863, -3.3077115913, 2.6097574011, -0.7034186147, 0.2309699292, -0.3413193965, 1.7076147010) * l;
}
vec3 am_mixOk(vec3 a, vec3 b, float t) { return am_fromOklab(mix(am_toOklab(a), am_toOklab(b), t)); }
// OKLCh: (L, C, h radians)
vec3 am_toOklch(vec3 c) { vec3 o = am_toOklab(c); return vec3(o.x, length(o.yz), atan(o.z, o.y)); }
vec3 am_fromOklch(vec3 c) { return am_fromOklab(vec3(c.x, c.y * cos(c.z), c.y * sin(c.z))); }
vec3 am_hueShift(vec3 c, float rad) { vec3 l = am_toOklch(max(c, 0.0)); l.z += rad; return max(am_fromOklch(l), 0.0); }
vec3 am_saturate(vec3 c, float s) { vec3 o = am_toOklab(max(c, 0.0)); o.yz *= s; return max(am_fromOklab(o), 0.0); }
// Ramp through the five palette colours in OKLab (bg -> a2 -> a0 -> a1 -> ink), the perceptual twin of ramp().
vec3 am_rampOk(float t) {
  t = sat(t) * 4.0;
  if (t < 1.0) return am_mixOk(u_bg, u_a2, t);
  if (t < 2.0) return am_mixOk(u_a2, u_a0, t - 1.0);
  if (t < 3.0) return am_mixOk(u_a0, u_a1, t - 2.0);
  return am_mixOk(u_a1, u_ink, t - 3.0);
}
// Accent-only cyclic ramp a0 -> a1 -> a2 -> a0 (for hue-cycling content that must stay on palette).
vec3 am_accentLoop(float t) { t = fract(t) * 3.0; return t < 1.0 ? am_mixOk(u_a0, u_a1, t) : t < 2.0 ? am_mixOk(u_a1, u_a2, t - 1.0) : am_mixOk(u_a2, u_a0, t - 2.0); }
// Cosine palette (Quílez). Fit a, b, c, d to a reference with the tune tool when the palette is not enough.
vec3 am_cosPal(float t, vec3 a, vec3 b, vec3 c, vec3 d) { return a + b * cos(TAU * (c * t + d)); }

// ---- tone mapping (HDR linear -> display linear 0..1) ----
// AgX (Sobotka; polynomial fit by bwrensch / three.js). Filmic, hue-preserving highlight roll-off: the default.
vec3 am_agxCurve(vec3 x) { vec3 x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
vec3 am_agx(vec3 c, float look) { // look: 0 base, 1 punchy
  const mat3 inM = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 outM = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  c = inM * max(c, 0.0);
  c = clamp((log2(max(c, 1e-10)) + 12.47393) / 16.5, 0.0, 1.0);
  c = am_agxCurve(c);
  if (look > 0.0) { vec3 p = pow(max(c, 0.0), vec3(1.35)); vec3 pl = mix(c, p, look); c = mix(vec3(luma(pl)), pl, 1.0 + 0.4 * look); }
  c = outM * c;
  return clamp(pow(max(c, 0.0), vec3(2.2)), 0.0, 1.0);
}
// Khronos PBR Neutral: keeps base colours accurate (product shots, brand colours), soft shoulder.
vec3 am_neutral(vec3 c) {
  const float s = 0.8 - 0.04, d = 0.15; float x = min(c.r, min(c.g, c.b)); float o = x < 0.08 ? x - 6.25 * x * x : 0.04; c -= o;
  float p = max(c.r, max(c.g, c.b)); if (p < s) return c;
  float d2 = 1.0 - s; float np = 1.0 - d2 * d2 / (p + d2 - s); c *= np / p; float g = 1.0 - 1.0 / (d * (p - np) + 1.0); return mix(c, vec3(np), g);
}
// Exposure in stops, then tone map. mode 0 AgX, 1 AgX punchy, 2 Neutral, 3 ACES (prelude).
vec3 am_tonemap(vec3 c, float stops, int mode) {
  c *= exp2(stops);
  if (mode == 0) return am_agx(c, 0.0);
  if (mode == 1) return am_agx(c, 1.0);
  if (mode == 2) return am_neutral(c);
  return aces(c);
}
// Lift/gamma/gain grade in linear (ASC-CDL-like), plus split-tone toward shadow/highlight tints.
vec3 am_grade(vec3 c, vec3 lift, vec3 gamma, vec3 gain) { c = max(c * gain + lift * (1.0 - c), 0.0); return pow(c, 1.0 / max(gamma, vec3(0.05))); }
vec3 am_splitTone(vec3 c, vec3 shadow, vec3 high, float amt) { float l = sat(luma(c) * 1.4); return c * mix(mix(vec3(1.0), shadow * 1.6, amt * (1.0 - l)), high * 1.6, amt * l * 0.5); }
// Display-referred contrast around 0.18 grey in log space (no clipping).
vec3 am_contrast(vec3 c, float k) { vec3 l = log2(max(c, 1e-5) / 0.18); return 0.18 * exp2(l * k); }
