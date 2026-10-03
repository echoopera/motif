vec4 motif(vec2 uv, vec2 fc) {
  float r = length(uv), v = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= p_count) break;
    float ph = fract(float(i) / float(max(p_count, 1)) - u_p * float(p_speed));   // whole waves per loop: closes exactly
    v += glowd(abs(r - ph * 0.85), 0.012 * p_width) * (1.0 - ph);
  }
  return emit(mix(u_a0, u_a1, sat(r * 1.4)) * v * p_glow * 0.7);
}
