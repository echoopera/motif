// Tri-Channel: per-layer access. Each layer keeps its own transform, speed and direction; the style decides how to combine them.
vec4 motif(vec2 uv, vec2 fc) {
  vec4 a = L_get1(uv), b = L_get2(uv), c = L_get3(uv);
  float attached = max(u_layer1On, max(u_layer2On, u_layer3On));
  vec3 rgb = vec3(a.r * L_opacity(1), b.g * L_opacity(2), c.b * L_opacity(3));
  // Without media: three slow noise fields stand in so the style is never blank.
  vec3 fb = vec3(0.5 + 0.5 * ln2(uv * 2.0, 1.0, 0.5), 0.5 + 0.5 * ln2(uv * 2.0 + 5.0, 1.0, 0.5), 0.5 + 0.5 * ln2(uv * 2.0 + 11.0, 1.0, 0.5));
  rgb = mix(fb * 0.8, rgb, attached);
  vec3 grey = vec3(luma(rgb));
  vec3 col = mix(grey, rgb, p_mix) * p_gain;
  col += u_a0 * p_base * 0.15;
  col += (h21(fc) - 0.5) * 0.06 * p_grain;
  return vec4(max(col, 0.0), 1.0);
}
