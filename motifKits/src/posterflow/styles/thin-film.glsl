// Source colour at frame-normalised q, or the palette ink marble when no media is attached (thumbnails never blank).
vec3 sx(vec2 q) {
  if (u_sourceOn > 0.5) { vec4 s = m_source(q); return s.rgb + u_bg * (1.0 - s.a); }
  vec2 uv = (q - 0.5) * M_asp();
  return ramp(0.5 + 0.5 * lfbm(uv * 1.5, 3, float(p_turns), 0.5));
}

// Thin Film: a liquid warp of the source with iridescent halos where luminance changes fast, like oil film on glass.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res, asp = M_asp();
  float k = float(p_turns);
  vec2 w = pf_flow(uv * p_scale, k);
  vec2 qq = q + w * p_warp * 0.09 / asp;
  vec3 c = sx(qq);
  float L0 = luma(c), acc = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = TAU * float(i) / 8.0 + 0.4;
    acc += luma(sx(qq + vec2(cos(a), sin(a)) * p_radius / asp));
  }
  float Lb = acc / 8.0;
  float edge = (Lb - L0) * p_gain;
  float film = edge * p_thick + 0.35 * L0 + p_hue + 0.15 * lsin(k, 0.0);
  vec3 irid = pf_spectrum(film);
  float m = smoothstep(0.02, 0.4, abs(edge)) * p_amount;
  vec3 col = mix(c, irid * (0.3 + 1.2 * Lb), m * 0.85) + irid * max(-edge, 0.0) * p_glow;
  col = pf_finish(col, uv, fc, p_vignette, p_exposure, p_grain);
  return vec4(max(col, 0.0), 1.0);
}
