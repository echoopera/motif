// Shared post, final pass (full resolution): the lens and film stack every hero style shares, so artists get
// the same "Lens" controls everywhere. u_buf0 = HDR scene, u_buf1 = bright-passed 1/8-res bloom source.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec2 qd = am_barrel(q, p_distort * 0.12, u_res.x / u_res.y);
  vec3 c = p_ca > 0.001 ? am_ca(u_buf0, qd, p_ca * 0.014, 7) : texture(u_buf0, qd).rgb;
  vec3 b = am_bloom(u_buf1, qd, 1.0) * 0.55 + am_bloom(u_buf1, qd, 3.2) * 0.45;
  c += b * p_bloom + am_halation(b, p_halation);
  if (p_streak > 0.001) c += am_streak(u_buf1, qd, 1.0, 0.0) * mix(u_ink, u_a0, 0.5) * p_streak;
  c = am_tonemap(c, p_exposure, p_tonemap);
  c *= mix(1.0, am_vignette(uv, 1.0), p_vignette);
  c = am_grain(c, fc, p_grain, 1.0 + 1.5 * step(1600.0, u_res.y));
  return vec4(c, 1.0);
}
