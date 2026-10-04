// Marble Flow: a looping domain-warp pours the source (or a procedural ink field) through quantized colour bands,
// with thin dark veins on the band edges. Fallback with no media: a palette ink marble, so thumbnails are never blank.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec2 asp = M_asp();
  float k = float(p_turns);
  vec2 drift = p_drift * lc(k, 0.0);
  vec2 w = pf_flow(uv * p_scale + drift, k);
  // A slow vortex on top gives the pour a centre of mass (rotates by whole turns, so it loops).
  float r = length(uv);
  vec2 sw = rot(p_swirl * 2.2 * exp(-r * r * 3.0) * lsin(k, 0.0)) * uv - uv;
  vec2 d = (w * p_warp * 0.16 + sw) / asp;

  vec3 fallback;
  {
    float f = 0.5 + 0.5 * lfbm(uv * 1.6 + w * 0.9, 3, k, 0.5);
    fallback = ramp(f * 1.05 - 0.02);
  }
  vec4 s = m_source(q + d);
  vec3 col = mix(fallback, s.rgb + u_bg * (1.0 - s.a), u_sourceOn);

  float soft = p_soft;
  col = pf_poster(col, float(p_bands), soft, p_hue, p_mode, p_palMix, p_veins, p_veinW, c_vein());
  col = pf_finish(col, uv, fc, p_vignette, p_exposure, p_grain);
  return vec4(max(col, 0.0), 1.0);
}
