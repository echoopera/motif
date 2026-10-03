// Shared post, output pass (full resolution): the lens and film stack every hero style shares.
// g_scene = HDR scene (linear), g_bright = 1/4-res bright pass, g_glow = 1/8-res wide level. Two bloom levels
// summed give a tight core plus a long tail, closer to a real lens's veiling glare than one blur.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec2 qd = am_barrel(q, p_distort * 0.12, u_res.x / u_res.y);
  vec3 c = p_ca > 0.001 ? am_ca(g_scene, qd, p_ca * 0.014, 7) : texture(g_scene, qd).rgb;
  vec3 b = am_bloom(g_bright, qd, 1.0) * 0.45 + am_bloom(g_glow, qd, 2.2) * 0.55;
  c += b * p_bloom + am_halation(b, p_halation);
  if (p_streak > 0.001) c += am_streak(g_bright, qd, 1.0, 0.0) * mix(u_ink, u_a0, 0.5) * p_streak;
  c = am_tonemap(c, p_exposure, p_tonemap);
  c *= mix(1.0, am_vignette(uv, 1.0), p_vignette);
  c = am_grain(c, fc, p_grain, 1.0 + 1.5 * step(1600.0, u_res.y));
  return vec4(c, 1.0);
}
