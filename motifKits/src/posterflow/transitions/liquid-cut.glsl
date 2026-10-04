// Liquid Cut: a flow-warped ink front sweeps from one shot to the next; both shots are pushed through the flow by
// sin(pi * progress), so progress 0 is exactly `from` and 1 exactly `to`.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec2 asp = M_asp();
  float amt = sin(PI * u_progress);
  vec2 w = vec2(snoise(vec3(uv * p_scale, 1.7)), snoise(vec3(uv * p_scale + 9.3, 4.1)));
  vec2 d = w * p_warp * 0.12 * amt / asp;
  vec4 a = g_fromAt(q + d), b = g_toAt(q - d);
  float n01 = clamp(0.5 + 0.5 * snoise(vec3(uv * p_scale * 0.8 + 3.1, 7.7)), 0.0, 1.0);
  float soft = max(p_soft, 0.01);
  float e = u_progress * (1.0 + 2.0 * soft) - soft;
  float m = smoothstep(n01 - soft, n01 + soft, e);
  float edge = exp(-pow((e - n01) / (soft * 1.2), 2.0)) * amt;
  vec4 c = mix(a, b, m);
  vec3 rim = mix(u_a0, u_ink, 0.4) * edge * p_rim;
  return vec4(c.rgb + rim, max(c.a, min(1.0, luma(rim))));
}
