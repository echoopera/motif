// Aura Wash: an out-of-focus, flow-drifted bloom of the source, graded through the palette with film grain.
// The soft colour fields that sit behind the sharper looks.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res, asp = M_asp();
  float k = float(p_turns);
  vec2 w = pf_flow(uv * p_scale, k);
  vec2 qq = q + w * p_warp * 0.1 / asp;
  vec3 acc = vec3(0.0); float ws = 0.0;
  for (int i = 0; i < 24; i++) {
    float t = (float(i) + 0.5) / 24.0;
    float a = float(i) * 2.399963 + h21(fc) * TAU;
    vec2 o = sqrt(t) * vec2(cos(a), sin(a)) * p_blur / asp;
    float wt = 1.0 - 0.5 * t;
    acc += sx(qq + o) * wt; ws += wt;
  }
  vec3 c = acc / ws;
  float L = sqrt(max(luma(c), 0.0));
  vec3 graded = mix(c, ramp(L), p_palMix);
  graded += u_a1 * pow(max(L - 0.5, 0.0) * 2.0, 2.0) * p_glow * 0.5;
  vec3 col = mix(vec3(luma(graded)), graded, p_chroma);
  col = pf_finish(col, uv, fc, p_vignette, p_exposure, p_grain);
  return vec4(max(col, 0.0), 1.0);
}
