// Lens effect, pass "bright" (scale 0.25): bright pass over the host's picture (display-referred, so thresholds sit below 1).
vec4 motif(vec2 uv, vec2 fc) {
  float ratio = max(float(textureSize(g_input, 0).x) / u_res.x, 1.0);
  vec4 c = vec4(am_bloom(g_input, fc / u_res, 0.55 * ratio), 1.0);
  return vec4(am_bright(c.rgb, p_threshold, 0.25), 1.0);
}
