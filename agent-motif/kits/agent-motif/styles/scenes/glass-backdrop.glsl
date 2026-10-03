// Liquid Glass — pass 1 (full res): what the glass refracts. The attached media, or a slow OKLab mesh gradient
// with optional editorial stripes / grid so refraction and dispersion read clearly.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec3 g = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i); vec3 h = h33(vec3(fi, 4.0, 1.0));
    vec2 c = (h.xy - 0.5) * M_asp() * 0.9 + 0.18 * lc(1.0, h.z) * vec2(1.0, 0.7);
    float w = exp(-dot(uv - c, uv - c) * (3.0 + 4.0 * h.z));
    vec3 col = i == 0 ? u_a0 : i == 1 ? u_a1 : i == 2 ? u_a2 : i == 3 ? am_mixOk(u_a0, u_ink, 0.5) : am_mixOk(u_bg, u_a2, 0.6);
    g += am_toOklab(col) * w; ws += w;
  }
  vec3 bg = am_fromOklab(mix(am_toOklab(u_bg), g / max(ws, 1e-4), sat(ws * 1.4)));
  if (p_backdrop == BACKDROP_STRIPES) bg *= 0.75 + 0.35 * smoothstep(0.35, 0.65, abs(fract(uv.x * 18.0 + uv.y * 4.0) - 0.5) * 2.0);
  if (p_backdrop == BACKDROP_GRID) { vec2 gg = abs(fract(uv * 12.0) - 0.5); bg = mix(bg, u_ink, (1.0 - smoothstep(0.0, 0.03, min(gg.x, gg.y))) * 0.35); }
  vec4 m = m_source(q);
  vec3 src = m.rgb + bg * (1.0 - m.a);
  return vec4(mix(bg, src, u_sourceOn), 1.0);
}
