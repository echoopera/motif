// Ink Diffusion, pass 1 of 2: the field buffer (half resolution), iterated 8 times per frame.
// Step 0 seeds it from looping noise; every later step reads the previous step (g_field) and diffuses it.
// Nothing carries over between frames, so the loop still closes exactly.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  if (u_iter == 0) {
    float n = ln2(uv * p_scale, float(p_turns), 0.6);
    return vec4(smoothstep(0.05, 0.45, n), 0.5 + 0.5 * n, 0.0, 1.0);
  }
  vec2 px = 1.0 / u_res;
  vec4 c = g_fieldAt(q);
  vec4 l = g_fieldAt(q - vec2(px.x, 0.0)), r = g_fieldAt(q + vec2(px.x, 0.0));
  vec4 d = g_fieldAt(q - vec2(0.0, px.y)), t = g_fieldAt(q + vec2(0.0, px.y));
  float lap = (l.x + r.x + d.x + t.x) * 0.25 - c.x;
  float grow = c.x * (1.0 - c.x) * p_growth;
  return vec4(clamp(c.x + lap * p_diffuse * 2.0 + grow * 0.25, 0.0, 1.0), c.y, 0.0, 1.0);
}
