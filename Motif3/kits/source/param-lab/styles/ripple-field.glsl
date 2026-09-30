// Custom params arrive as p_<key>. A colour param "tint" also gives you c_tint() (linear RGB) and s_tint() (sRGB);
// a point param "origin" gives you v_origin() (vec2, in the param's own units).
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = uv - v_origin();
  float w = p_warp * 0.15 * sin(q.y * 9.0 + M_PH);
  q.x += w;
  float d = length(q);
  float wave = sin(TAU * (d * float(p_count) * p_spread * 2.0 - float(p_speed) * u_p));
  float rings = smoothstep(0.85, 1.0, wave * 0.5 + 0.5);
  vec2 g = fract((q + 0.5) * float(p_cells)) - 0.5;
  float grid = smoothstep(0.46, 0.5, max(abs(g.x), abs(g.y))) * (0.6 + 0.4 * sin(TAU * (float(p_speed) * u_p) + d * 6.0));
  float m = 0.0;
  if (p_mode == MODE_RINGS) m = rings; else if (p_mode == MODE_GRID) m = grid; else m = max(rings, grid);
  vec3 base = mix(u_a0, u_a1, sat(d * 1.4));
  vec3 col = u_bg + mix(base, c_tint(), p_tintMix) * m;
  if (p_glowOn) col += c_tint() * p_glow * 0.25 * exp(-d * 4.0);
  return vec4(col, 1.0);
}
