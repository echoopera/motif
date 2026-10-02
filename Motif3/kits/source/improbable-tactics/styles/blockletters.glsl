// Block Letters — Van Doesburg's alphabet. Hard-edged square letters (or slightly softened), set on a breathing
// partition of colour fields; a loose disc rolls through the scheme, letters can turn on their side.
vec3 fieldAt(vec2 p, vec2 ext, float slot, float nslot, float fr, out float e) {
  vec2 lo, hi; float id;
  itKD(p, ext, p_depth, p_stop, p_drift, 1.0, 0.0, lo, hi, id);
  vec3 f = itStijlFill(id, p_empty, slot, nslot, fr, 0.0);
  e = min(min(p.x - lo.x, hi.x - p.x), min(p.y - lo.y, hi.y - p.y));
  float lw = 0.014 * (0.6 + 0.9 * h21(vec2(id, 66.0)));
  return mix(f, u_ink, 1.0 - smoothstep(lw * 0.5 - aa(), lw * 0.5 + aa(), e));
}

vec4 motif(vec2 uv, vec2 fc) {
  vec2 ext = M_asp() * 1.04;
  float slot = tslot(float(p_recolor)), fr = tfrac(float(p_recolor)), nslot = itNext(slot, float(p_recolor));
  float e;
  vec3 paper = u_bg * (1.0 + 0.035 * itPaper(uv));
  vec3 col = fieldAt(uv, ext, slot, nslot, fr, e);
  if (col == u_bg) col = paper;
  // the disc
  if (p_disc > 0.0) {
    vec2 dc = vec2(0.12, 0.05) * M_asp() + 0.06 * lc(1.0, 0.0);
    float dr = p_disc * 0.28;
    col = mix(col, u_a0, 1.0 - smoothstep(-aa(), aa(), length(uv - dc) - dr));
  }
  // lettering
  int n = itLen(p_word);
  float W = ext.x * 0.9;
  float cell = min(W / float(n), ext.y * 0.9 / float(p_lines));
  float x0 = -0.5 * cell * float(n);
  float ytop = p_lift * ext.y * 0.28 + 0.5 * cell * float(p_lines);
  for (int r = 0; r < 3; r++) {
    if (r >= p_lines) break;
    float yb = ytop - cell * float(r + 1);
    vec2 g = (uv - vec2(x0, yb)) / cell;
    float ix = floor(g.x);
    if (ix < 0.0 || ix >= float(n)) continue;
    vec2 l = vec2(fract(g.x), g.y);
    int ch = itCh(p_word, int(ix) + r * 2);
    float h = h21(vec2(ix, float(r) + 3.0));
    l.y -= 0.06 * p_bounce * lsin(1.0, h) + 0.0;
    if (h < p_turn) l = vec2(l.y, 1.0 - l.x);
    float gap = p_gap;
    vec2 gg = (l - 0.5) / (1.0 - gap) + 0.5;
    float cov = itGlyph(ch, gg, 5.0 * aa() / (cell * (1.0 - gap)), p_round, 0.3);
    // dark ground -> light letter
    float lum = itLum(col);
    vec3 ink = lum < 0.12 ? u_bg : u_ink;
    col = mix(col, ink, cov);
  }
  return vec4(col, 1.0);
}
