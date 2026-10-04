// Ink Drag: the source is carried along a looping curl field in `steps` short hops, so colour streams along streamlines
// like ink drawn through water. Each hop recomputes the flow, so the loop closes exactly (flow is a function of u_p).
vec4 motif(vec2 uv, vec2 fc) {
  vec2 asp = M_asp();
  float k = float(p_turns);
  vec2 p = uv;
  vec3 acc = vec3(0.0); float wsum = 0.0;
  float eps = 0.01;
  for (int i = 0; i < 14; i++) {
    if (i >= p_steps) break;
    vec2 pp = p * p_scale;
    // curl of a scalar noise: perpendicular gradient gives incompressible, swirling flow.
    float n1 = ln2(pp + vec2(eps, 0.0), k, 0.5), n2 = ln2(pp - vec2(eps, 0.0), k, 0.5);
    float n3 = ln2(pp + vec2(0.0, eps), k, 0.5), n4 = ln2(pp - vec2(0.0, eps), k, 0.5);
    vec2 curl = vec2(n3 - n4, -(n1 - n2)) / (2.0 * eps);
    p += normalize(curl + 1e-4) * min(length(curl), 3.0) * p_drag * 0.012;
    float wt = 1.0 - 0.6 * float(i) / float(max(p_steps, 1));
    vec4 s = m_source(p / asp + 0.5);
    vec3 fb = ramp(0.5 + 0.5 * lfbm(p * 1.5, 3, k, 0.5));
    acc += mix(fb, s.rgb + u_bg * (1.0 - s.a), u_sourceOn) * wt; wsum += wt;
  }
  vec3 col = acc / max(wsum, 1e-3);
  col = pf_poster(col, float(p_bands), p_soft, p_hue, p_mode, p_palMix, p_veins, p_veinW, c_vein());
  col = pf_vignette(col, uv, p_vignette) * p_exposure;
  return vec4(max(col, 0.0), 1.0);
}
