// Type Poster: "title" is a text input with "sdf": true. Besides textLine_title(i, q) (glyph coverage) the runtime provides
//   textDist_title(i, q)   signed distance of line i, in line-local units (a band is 1 wide; negative inside the letters)
// so outline, glow and echoes are exact at any scale: scale q, then multiply the distance back by the same factor.
float title(vec2 uv, vec2 off) {
  float s = p_scale, y = 0.5 * s / 6.0 * 1.15;
  float d1 = textDist_title(0, (uv - off - vec2(0.0, y)) / s) * s;
  float d2 = textDist_title(1, (uv - off + vec2(0.0, y)) / s) * s;
  return min(d1, d2);
}
vec4 motif(vec2 uv, vec2 fc) {
  vec3 bg = mix(u_bg, u_a0 * 0.25, p_bgPulse * (0.5 + 0.5 * lfbm(uv * 1.4, 3, 1.0, 0.4)) * smoothstep(1.1, 0.0, length(uv)));
  vec4 c = vec4(bg, 1.0);
  for (int i = 6; i >= 1; i--) {                       // echoes, farthest first
    if (i > p_echoes) continue;
    float f = float(i);
    vec2 o = vec2(1.0, -0.6) * p_spacing * f * (0.7 + 0.3 * lsin(1.0, f * 0.13));
    float d = title(uv, o);
    c = over(solid(mix(u_a0, u_a1, f / 6.0) * (1.0 - f / 8.0), vstroke(d, max(p_outline, 0.002)) * (0.8 / (1.0 + 0.2 * f))), c);
  }
  float d = title(uv, vec2(0.0));
  return over(vpaint(d, u_ink, u_a2, p_outline, u_a0, p_glow), c);
}
