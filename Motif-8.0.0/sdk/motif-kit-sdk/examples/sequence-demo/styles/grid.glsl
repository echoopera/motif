vec4 motif(vec2 uv, vec2 fc) {
  vec2 a = M_asp(); float n = float(p_cells), cell = a.x / n;
  vec2 g = uv + a * 0.5, id = floor(g / cell), p = (fract(g / cell) - 0.5) * cell;
  float r = 0.5 * cell * p_size * (0.35 + 0.65 * (0.5 + 0.5 * lsin(float(p_speed), h21(id))));
  float d = sdCircle(p, r);
  return emit(mix(u_a1, u_a0, h21(id + 4.0)) * (vfill(d) + vglow(d, 0.02 * p_glow) * 0.35));
}
