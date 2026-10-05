// Image Stack: the manifest declares  "stack": { "layers": 3 }, so the runtime generates inputs layer1..layer3, a block of
// controls for each (opacity, blend, offset, scale, rotate, edges, cycles/loop, direction, travel) and these helpers:
//   L_stack(base, uv)  composite every layer over base, each with its own blend mode and opacity
//   L_get1(uv)..       one transformed layer, premultiplied linear (alpha 0 when nothing is attached)
//   L_get(i, uv)       the same by index
vec4 motif(vec2 uv, vec2 fc) {
  // Procedural base so the style is never blank (library thumbnails and layers with no media attached).
  float n = lfbm(uv * 1.6, 4, 1.0, 0.5);
  vec3 base = mix(u_bg, mix(u_a2, u_a0, 0.5 + 0.5 * n), 0.18 + 0.5 * p_haze * (0.5 + 0.5 * n));
  base = mix(base, c_tint() , p_tintMix * 0.35);
  vec4 c = vec4(base, 1.0);
  c = L_stack(c, uv);
  c.rgb *= 1.0 - p_vignette * smoothstep(0.3, 0.95, length(uv / M_asp()) * 1.6);
  return c;
}
