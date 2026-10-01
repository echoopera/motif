// Iris transition: g_from and g_to are the two shots, u_progress runs 0 → 1 over the transition.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec4 a = g_fromAt(q), b = g_toAt(q);
  float d = length(uv - v_center());
  float R = u_progress * length(M_asp()) * 0.8;
  float e = 1.0 - smoothstep(R - p_soft - 0.001, R, d);
  float live = step(0.001, u_progress) * step(u_progress, 0.999);
  vec3 rim = u_a0 * p_rim * exp(-abs(d - R) * 40.0) * live;
  vec4 c = mix(a, b, e);
  return vec4(c.rgb + rim, max(c.a, min(1.0, luma(rim))));
}
