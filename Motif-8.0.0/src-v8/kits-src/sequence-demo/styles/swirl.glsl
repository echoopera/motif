vec4 motif(vec2 uv, vec2 fc) {
  float r = length(uv), an = atan(uv.y, uv.x);
  float v = 0.5 + 0.5 * sin(an * float(p_arms) + r * p_twist * TAU * 0.5 - TAU * u_p * float(p_speed));
  v = pow(v, 3.0) * smoothstep(0.75, 0.05, r);
  return emit(mix(u_a2, u_a0, sat(r * 2.0)) * v * (0.5 + p_glow));
}
