// Liquid Glass — pass 2 (full res). Soft-merging glass lozenges over u_buf0. A circular bevel profile turns the
// 2D SDF into a height field; its gradient bends the backdrop (Snell-like offset) with N-tap spectral dispersion,
// optional frosting (disc blur), a specular rim from a moving key light, an inner shadow and Fresnel edge light.
float glassSdf(vec2 p) {
  float d = 1e5;
  for (int i = 0; i < 7; i++) {
    if (i >= p_count) break;
    float fi = float(i); vec3 h = h33(vec3(fi, 1.0, 8.0));
    vec2 c = (h.xy - 0.5) * vec2(M_asp().x * 0.7, 0.55) + lc(float(1 + int(h.z * 2.0)) * float(p_orbits), h.z) * vec2(0.14, 0.09) * p_wander;
    vec2 sz = vec2(0.10 + 0.12 * h.x, 0.07 + 0.08 * h.y) * p_size;
    float di = p_shape == SHAPE_PILLS ? am_sdRoundBox(p - c, sz, min(sz.x, sz.y)) : p_shape == SHAPE_DROPS ? length(p - c) - (sz.x + sz.y) * 0.5 : am_sdRoundBox(p - c, sz, 0.035);
    d = am_smin3(d, di, p_merge * 0.06);
  }
  return d;
}
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  float d = glassSdf(uv);
  float px = 1.0 / u_res.y;
  vec3 back = texture(u_buf0, q).rgb;
  float sh = exp(-max(glassSdf(uv + vec2(0.0, 0.018)), 0.0) * 40.0) * 0.28 * p_shadow;
  vec3 outside = back * (1.0 - sh);
  if (d > 2.0 * px) return vec4(outside, 1.0);
  // Height from a circular bevel; gradient by central differences on the SDF.
  float bev = 0.045 * p_bevel;
  float e = 0.0015;
  vec2 gd = vec2(glassSdf(uv + vec2(e, 0)) - glassSdf(uv - vec2(e, 0)), glassSdf(uv + vec2(0, e)) - glassSdf(uv - vec2(0, e))) / (2.0 * e);
  float x = sat(1.0 + d / bev);                 // 0 at the inner edge of the bevel, 1 at the rim
  float slope = x / sqrt(max(1.0 - x * x, 1e-3)); // derivative of a quarter-circle profile
  vec3 n = normalize(vec3(gd * slope * step(d, 0.0), 1.0));
  vec2 off = -n.xy * p_refract * 0.06;
  // Spectral refraction: each wavelength bends a little differently.
  vec3 acc = vec3(0.0), wsum = vec3(0.0); int N = 7;
  for (int i = 0; i < 7; i++) {
    float t = (float(i) + 0.5) / float(N); vec3 sp = am_spectrum(t);
    vec2 o = off * (1.0 + (t - 0.5) * p_dispersion * 0.9);
    vec3 s = p_frost > 0.01 ? am_bokeh(u_buf0, q + o * vec2(u_res.y / u_res.x, 1.0), p_frost * 14.0) : texture(u_buf0, q + o * vec2(u_res.y / u_res.x, 1.0)).rgb;
    acc += s * sp; wsum += sp;
  }
  vec3 glass = acc / wsum;
  glass = mix(glass, glass * c_tint() * 1.4, p_tintMix) * 1.03 + 0.012;
  // Lighting: key light orbits (integer turns), specular on the bevel, inner shadow, Fresnel rim.
  vec3 l = normalize(vec3(lc(float(p_lightTurns), 0.375) * 0.8, 0.55));
  vec3 hv = normalize(l + vec3(0, 0, 1));
  float spec = pow(sat(dot(n, hv)), 90.0) * 2.5 + pow(sat(dot(n, hv)), 12.0) * 0.18;
  float fres = am_fresnelF(0.04, n.z);
  float rim = smoothstep(-0.006, 0.0, d) * (1.0 - smoothstep(0.0, 0.004, d));
  float inner = smoothstep(-bev * 2.2, 0.0, d) * 0.25 * (1.0 - n.z);
  vec3 col = glass * (1.0 - inner) + u_ink * (spec * p_shine + fres * 0.35 + rim * 0.45 * p_shine);
  float a = 1.0 - smoothstep(-px, px, d);
  return vec4(mix(outside, col, a), 1.0);
}
