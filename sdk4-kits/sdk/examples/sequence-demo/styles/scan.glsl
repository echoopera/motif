vec4 motif(vec2 uv, vec2 fc) {
  float y = uv.y / M_asp().y + 0.5, v = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= p_lines) break;
    float ph = fract(u_p * float(p_speed) + float(i) / float(p_lines));
    v += glowd(abs(y - ph), 0.012 * p_width);
  }
  return emit(mix(u_a1, u_a2, y) * v * p_glow * 0.55);
}
