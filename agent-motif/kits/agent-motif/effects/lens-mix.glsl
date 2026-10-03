// Lens effect, output: the AgentMotif finishing stack for any layer or the finished frame. Keeps the input's alpha
// (plus glow coverage) so a layer effect still composites over the layers beneath it.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec4 base = p_ca > 0.001 ? vec4(am_ca(g_input, q, p_ca * 0.014, 7), texture(g_input, q).a) : g_inputAt(q);
  vec3 b = am_bloom(g_bright, q, 1.0) * 0.45 + am_bloom(g_glow, q, 2.2) * 0.55;
  vec3 c = base.rgb + b * p_bloom + am_halation(b, p_halation);
  float a = max(base.a, sat(max(b.r, max(b.g, b.b)) * p_bloom));
  c *= mix(1.0, am_vignette(uv, 1.0), p_vignette);
  c = am_grain(c, fc, p_grain, 1.0);
  return vec4(c, a);
}
