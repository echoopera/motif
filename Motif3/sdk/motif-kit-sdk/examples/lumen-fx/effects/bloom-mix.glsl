// Bloom, pass 3 of 3: add the blurred light back over the untouched input.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec4 base = g_inputAt(q), glow = g_blurAt(q) * p_amount;
  vec3 tint = p_tinted ? mix(vec3(1.0), u_a0 * 1.6, 0.6) : vec3(1.0);
  return vec4(base.rgb + glow.rgb * tint, max(base.a, min(1.0, glow.a)));
}
