// Shared post, graph pass "bright" (scale 0.25): soft-knee bright pass with a 25-tap pre-blur of the HDR scene.
// The blur radius follows the real size ratio between the scene buffer and this pass (2x for a 0.5 scene, 4x for a
// full-res one), so every scene texel is covered and small highlights never alias into blocks.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  float ratio = max(float(textureSize(g_scene, 0).x) / u_res.x, 1.0);
  return vec4(am_bright(am_bloom(g_scene, q, 0.55 * ratio), p_threshold, 0.6), 1.0);
}
