vec4 motif(vec2 uv, vec2 fc) {
  vec2 a = M_asp(); float x = (uv.x / a.x + 0.5) * float(p_bars), id = floor(x), f = fract(x);
  float h = 0.15 + 0.7 * (0.5 + 0.5 * lsin(float(p_speed), h11(id)));
  float y = uv.y / a.y + 0.5;
  float on = smoothstep(0.0, aa() * 4.0, 0.5 * (1.0 - p_gap) - abs(f - 0.5)) * step(y, h);
  vec3 col = mix(u_a0, u_a2, sat(y / max(h, 0.01))) ;
  return emit(col * on * (0.8 + 0.4 * p_glow));
}
