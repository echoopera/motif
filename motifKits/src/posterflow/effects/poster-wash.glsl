// Poster Wash: the same band + vein treatment for any layer or the finished frame. Keeps the input alpha.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec2 asp = M_asp();
  float k = safeCycles(float(p_turns));
  vec2 d = pf_flow(uv * p_scale, k) * p_warp * 0.08 / asp;
  vec4 s = g_inputAt(q + d);
  vec3 rgb = s.a > 0.001 ? s.rgb / s.a : vec3(0.0);
  vec3 col = pf_poster(rgb, float(p_bands), p_soft, p_hue, p_mode, p_palMix, p_veins, p_veinW, c_vein());
  return vec4(col * s.a, s.a);
}
