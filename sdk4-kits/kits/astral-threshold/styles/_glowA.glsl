// Post 1/3: threshold + wide gather of the scene buffer (runs at 0.25 scale). Bloom supports emission.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  float R = p_bloomRadius * 0.085;               // radius in short-side units
  vec2 asp = M_asp();
  vec3 s = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 25; i++) {
    float r = 0.0; vec2 d = vec2(0.0);
    if (i > 0) { float k = float(i - 1); r = sqrt((k + 0.5) / 24.0) * R; float a = k * 2.399963; d = vec2(cos(a), sin(a)) * r; }
    float w = exp(-3.2 * (r * r) / max(R * R, 1e-8));
    vec3 c = g_sceneAt(q + d / asp).rgb * p_exposure;
    float l = max(c.r, max(c.g, c.b));
    float knee = smoothstep(0.55, 1.6, l);
    s += c * knee * w; ws += w;
  }
  return vec4(s / max(ws, 1e-5), 1.0);
}
