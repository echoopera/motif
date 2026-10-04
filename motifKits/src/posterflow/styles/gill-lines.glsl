// Source colour at frame-normalised q, or the palette ink marble when no media is attached (thumbnails never blank).
vec3 sx(vec2 q) {
  if (u_sourceOn > 0.5) { vec4 s = m_source(q); return s.rgb + u_bg * (1.0 - s.a); }
  vec2 uv = (q - 0.5) * M_asp();
  return ramp(0.5 + 0.5 * lfbm(uv * 1.5, 3, float(p_turns), 0.5));
}

// Gill Lines: engraved iso-lines of the warped source brightness, in contour, parallel or radial patterns. Line weight
// follows tone, so shadows thicken like a petal's gills.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res, asp = M_asp();
  float k = float(p_turns);
  vec2 w = pf_flow(uv * p_scale, k);
  vec2 qq = q + w * p_warp * 0.07 / asp;
  vec3 c = sx(qq);
  float L = sqrt(max(luma(c), 0.0));
  float a = radians(p_angle);
  float base;
  if (p_pattern == PATTERN_CONTOUR) base = 0.0;
  else if (p_pattern == PATTERN_PARALLEL) base = dot(uv, vec2(cos(a), sin(a))) * p_lines;
  else base = atan(uv.y, uv.x) / TAU * floor(p_lines * 2.0 + 0.5) * 1.0;
  float phi = base + L * p_lines * (p_pattern == PATTERN_CONTOUR ? 1.0 : p_follow) + 0.5 * w.x * p_follow;
  float f = fract(phi);
  float fw = max(fwidth(phi), 1e-4);
  float wd = mix(0.12, 0.7, 1.0 - L) * p_weight;
  float line = 1.0 - smoothstep(wd * 0.5, wd * 0.5 + fw * 1.2, abs(f - 0.5));
  vec3 ink = mix(c * 1.25, u_ink, p_inkMix);
  vec3 col = mix(u_bg, ink, line);
  col = mix(col, c, p_ghost);
  col = pf_finish(col, uv, fc, p_vignette, p_exposure, p_grain);
  return vec4(max(col, 0.0), 1.0);
}
