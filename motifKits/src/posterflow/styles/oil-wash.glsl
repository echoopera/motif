// Source colour at frame-normalised q, or the palette ink marble when no media is attached (thumbnails never blank).
vec3 sx(vec2 q) {
  if (u_sourceOn > 0.5) { vec4 s = m_source(q); return s.rgb + u_bg * (1.0 - s.a); }
  vec2 uv = (q - 0.5) * M_asp();
  return ramp(0.5 + 0.5 * lfbm(uv * 1.5, 3, safeCycles(float(p_turns)), 0.5));
}

// Oil Wash: a Kuwahara painter. The warped source is smoothed inside whichever of four quadrants is flattest, so detail
// melts into brush-like colour fields with crisp edges between them.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res, asp = M_asp();
  float k = safeCycles(float(p_turns));
  vec2 w = pf_flow(uv * p_scale, k);
  vec2 qq = q + w * p_warp * 0.06 / asp;
  vec2 px = p_stroke / u_res;
  vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
  vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);
  float n = 0.0;
  for (int j = 0; j <= 3; j++) {
    if (j > p_radius) break;
    for (int i = 0; i <= 3; i++) {
      if (i > p_radius) break;
      float fi = float(i), fj = float(j);
      vec3 a = sx(qq + vec2(-fi, -fj) * px), b = sx(qq + vec2(fi, -fj) * px), c = sx(qq + vec2(-fi, fj) * px), d = sx(qq + vec2(fi, fj) * px);
      m0 += a; s0 += a * a; m1 += b; s1 += b * b; m2 += c; s2 += c * c; m3 += d; s3 += d * d; n += 1.0;
    }
  }
  m0 /= n; m1 /= n; m2 /= n; m3 /= n;
  float v0 = dot(max(s0 / n - m0 * m0, 0.0), vec3(1.0)), v1 = dot(max(s1 / n - m1 * m1, 0.0), vec3(1.0));
  float v2 = dot(max(s2 / n - m2 * m2, 0.0), vec3(1.0)), v3 = dot(max(s3 / n - m3 * m3, 0.0), vec3(1.0));
  vec3 col = m0; float vm = v0;
  if (v1 < vm) { vm = v1; col = m1; }
  if (v2 < vm) { vm = v2; col = m2; }
  if (v3 < vm) { vm = v3; col = m3; }
  float L = luma(col);
  col = mix(vec3(L), col, p_chroma);
  col += u_ink * smoothstep(0.0, 0.3, vm * 40.0) * p_edge * 0.1;
  col = pf_finish(col, uv, fc, p_vignette, p_exposure, p_grain);
  return vec4(max(col, 0.0), 1.0);
}
