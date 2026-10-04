// Denoise (same scale as the scene): a small Gaussian gather removes the per-pixel jitter of the volume march without touching exposure.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec3 s = g_rawAt(q).rgb * 1.0; float ws = 1.0;
  for (int i = 1; i < 13; i++) {
    float k = float(i);
    float r = 1.0 + 0.24 * k;                                   // pixels, in this pass's own resolution
    float a = k * 2.399963;
    float w = exp(-0.20 * r * r);
    s += g_rawAt(q + vec2(cos(a), sin(a)) * r / u_res).rgb * w; ws += w;
  }
  return vec4(s / ws, 1.0);
}
