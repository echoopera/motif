// Type Poster: "title" is a text input. The runtime bakes the string with the chosen font into a distance field and gives
//   vec_title(uv)   signed distance in uv units (the Title section's offset, scale, rotation, speed and direction applied)
//   vecA_title(uv)  anti-aliased coverage times the Title opacity
// Because it is a distance, outline, glow and echoes are exact at any scale.
vec4 motif(vec2 uv, vec2 fc) {
  vec3 bg = mix(u_bg, u_a0 * 0.25, p_bgPulse * (0.5 + 0.5 * lfbm(uv * 1.4, 3, 1.0, 0.4)) * smoothstep(1.1, 0.0, length(uv)));
  vec4 c = vec4(bg, 1.0);
  for (int i = 6; i >= 1; i--) {                       // echoes, farthest first
    if (i > p_echoes) continue;
    float f = float(i);
    vec2 o = vec2(1.0, -0.6) * p_spacing * f * (0.7 + 0.3 * lsin(1.0, f * 0.13));
    float d = vec_title(uv - o);
    c = over(solid(mix(u_a0, u_a1, f / 6.0) * (1.0 - f / 8.0), vstroke(d, max(p_outline, 0.002)) * (0.8 / (1.0 + 0.2 * f))), c);
  }
  float d = vec_title(uv);
  c = over(vpaint(d, u_ink, u_a2, p_outline, u_a0, p_glow), c);
  return c;
}
