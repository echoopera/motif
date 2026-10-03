// Post 3/3 (full resolution): scene + glow, spectral edge fringe, vignette, one tone map. Returns linear.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec2 ca = uv * (p_lensCA * 0.012);
  vec3 sc = vec3(g_sceneAt(q + ca / M_asp()).r, g_sceneAt(q).g, g_sceneAt(q - ca / M_asp()).b);
  vec3 gl = g_glowAAt(q).rgb * 0.62 + g_glowBAt(q).rgb * 0.55;
  vec3 hdr = sc * p_exposure + gl * p_bloom;   // glow buffers are already exposed
  hdr *= k_vig(uv);
  return vec4(k_tone(hdr), 1.0);
}
