// Tzara's Bag — the frame is cut into strips or tiles, and each tile is re-read from somewhere else in the source,
// sliding between positions in limiter-safe slots. Cuts are torn, tiles can tilt, mirror and take a colour tint.
vec3 srcAt(vec2 q) { vec4 s = m_sourceUV(q); return mix(itProc(q), s.rgb + u_bg * (1.0 - s.a), u_sourceOn); }

vec2 srcCell(vec2 ij, vec2 n, float s) {
  vec2 h = h22(ij + s * 17.3 + 1.7);
  return vec2(floor(h.x * n.x), floor(h.y * n.y));
}

vec4 motif(vec2 uv, vec2 fc) {
  vec2 ext = M_asp();
  vec2 n = vec2(float(p_cols), float(p_rows));
  vec2 t = uv / ext + 0.5;
  t += p_jag * 0.018 * vec2(itFbm(uv * 4.0), itFbm(uv * 4.0 + 8.0)) / vec2(1.0, 1.0);
  vec2 ij = clamp(floor(t * n), vec2(0.0), n - 1.0);
  vec2 f = fract(t * n);
  float slot = tslot(float(p_cuts)), fr = tfrac(float(p_cuts));
  float ez = smoothstep(0.5, 1.0, fr);
  vec2 s0 = srcCell(ij, n, slot), s1 = srcCell(ij, n, itNext(slot, float(p_cuts)));
  vec2 sc = mix(s0, s1, ez);
  sc = mix(ij, sc, p_shuffle);
  vec2 c = ((ij + 0.5) / n - 0.5) * ext;
  vec2 off = (sc - ij) / n * ext;
  vec2 hv = h22(ij + 5.0);
  float ang = (hv.x - 0.5) * p_tilt * 0.9 + 0.03 * p_tilt * lsin(1.0, hv.y);
  vec2 rel = rot(ang) * (uv - c);
  if (hv.y < p_mirror * 0.5) rel.x = -rel.x;
  vec2 q = c + rel + off + p_drift * 0.02 * lc(1.0, hv.x) * (0.5 + hv.y);
  vec3 col = srcAt(q);
  float tintm = h21(ij + 9.0);
  if (tintm < p_tint) col = itMul(col, mix(vec3(1.0), accent(floor(tintm / max(p_tint, 1e-3) * 3.0)) * 1.25, 0.9), 1.0);
  if (tintm > 1.0 - p_inkMix) col = mix(u_ink, mix(u_bg, accent(floor(tintm * 9.0)), 0.3), smoothstep(0.1, 0.7, itLum(col)));
  // cut lines
  vec2 ed = min(f, 1.0 - f) / n * ext;
  float e = min(ed.x, ed.y);
  float gw = p_gap * 0.012;
  float rim = 1.0 - smoothstep(gw - aa(), gw + aa(), e);
  vec3 paper = mix(u_bg, vec3(1.0), 0.3) * (1.0 + 0.05 * itPaper(uv));
  col = mix(col, paper, rim);
  col *= 1.0 - p_shadow * 0.45 * exp(-max(e - gw, 0.0) * 70.0) * (1.0 - rim);
  return vec4(col, 1.0);
}
