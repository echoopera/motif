// Post 2/3: second, wider gather of the first glow buffer (0.125 scale).
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  float R = p_bloomRadius * 0.24;
  vec2 asp = M_asp();
  vec3 s = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 17; i++) {
    float r = 0.0; vec2 d = vec2(0.0);
    if (i > 0) { float k = float(i - 1); r = sqrt((k + 0.5) / 16.0) * R; float a = k * 2.399963; d = vec2(cos(a), sin(a)) * r; }
    float w = exp(-2.6 * (r * r) / max(R * R, 1e-8));
    s += g_glowAAt(q + d / asp).rgb * w; ws += w;
  }
  return vec4(s / max(ws, 1e-5), 1.0);
}
