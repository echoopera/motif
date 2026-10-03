vec4 motif(vec2 uv, vec2 fc) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 24; i++) {
    if (i >= p_count) break;
    float f = float(i), k = f / float(p_count);
    vec2 c = lc(float(p_speed), k) * p_radius * (0.35 + 0.65 * fract(k * 3.0 + 0.1));
    float d = length(uv - c);
    col += mix(u_a0, u_a1, k) * (smoothstep(0.02, 0.012, d) + 0.015 * p_glow / (d + 0.02));
  }
  return emit(col * 0.8);
}
