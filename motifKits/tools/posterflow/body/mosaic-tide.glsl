// Mosaic Tide: the flow-warped source is sampled per block and stepped through dithered colour bands, so water and
// fabric turn into stair-stepped poster pixels.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 asp = M_asp();
  float k = safeCycles(float(p_turns));
  float cells = float(p_cells);
  vec2 cuv = (floor(uv * cells) + 0.5) / cells;
  vec2 w = pf_flow(cuv * p_scale, k);
  vec2 qq = (cuv + w * p_warp * 0.1) / asp + 0.5;
  vec3 c = sx(qq);
  vec2 f = fract(uv * cells);
  float dither = (h21(floor(uv * cells)) - 0.5) * p_dither;
  float ec;
  vec3 s3 = sqrt(max(c, 0.0)) + dither / float(p_bands);
  vec3 cq = vec3(pf_band(s3.r, float(p_bands), p_soft, ec), pf_band(s3.g, float(p_bands), p_soft, ec), pf_band(s3.b, float(p_bands), p_soft, ec));
  vec3 col = mix(c, cq * cq, p_amount);
  vec2 g = smoothstep(vec2(0.0), vec2(p_gap + 0.001), min(f, 1.0 - f));
  col = mix(u_bg, col, mix(1.0, g.x * g.y, step(0.001, p_gap)));
  col = pf_finish(col, uv, fc, p_vignette, p_exposure, p_grain);
  return vec4(max(col, 0.0), 1.0);
}
