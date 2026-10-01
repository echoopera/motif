// Ink Diffusion, pass 2 of 2: colour the diffused field with the palette ramp and an edge glow.
vec4 motif(vec2 uv, vec2 fc) {
  vec4 f = g_fieldPx(fc);
  vec2 px = 1.0 / u_res;
  float e = abs(g_fieldPx(fc + vec2(2.0, 0.0)).x - g_fieldPx(fc - vec2(2.0, 0.0)).x) + abs(g_fieldPx(fc + vec2(0.0, 2.0)).x - g_fieldPx(fc - vec2(0.0, 2.0)).x);
  vec3 col = ramp(f.x * 0.85 + 0.1 * f.y) + u_a0 * e * p_glow * 2.0;
  return vec4(col, 1.0);
}
