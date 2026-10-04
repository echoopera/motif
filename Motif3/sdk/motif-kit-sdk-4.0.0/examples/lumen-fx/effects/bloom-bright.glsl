// Bloom, pass 1 of 3: keep only what is brighter than the threshold (input is linear, premultiplied).
vec4 motif(vec2 uv, vec2 fc) {
  vec4 c = g_inputPx(fc);
  float k = smoothstep(p_threshold, p_threshold + 0.25, luma(c.rgb));
  return c * k;
}
