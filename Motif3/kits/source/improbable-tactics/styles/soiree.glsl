// Soirée Programme — a Cabaret Voltaire handbill. A breathing binary partition; every cell holds a letter fitted to it,
// turned on its side, stretched to the edges, inverted, or swapped for a bar, a row of question marks, a ball, a hatch.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 ext = M_asp() * 1.04;
  float sd = tslot(float(p_recolor)) * 3.7;
  vec2 lo, hi; float id;
  itKD(uv, ext, p_depth, p_stop, p_drift, float(p_cycles), 0.0, lo, hi, id);
  vec2 sz = hi - lo, ctr = (lo + hi) * 0.5, q = uv - ctr;
  float h0 = itH(vec2(id, 5.0 + sd)), h1 = itH(vec2(id, 6.0 + sd)), h2 = itH(vec2(id, 7.0 + sd)), h3 = itH(vec2(id, 8.0 + sd)), h4 = itH(vec2(id, 9.0 + sd)), h5 = itH(vec2(id, 10.0 + sd));
  float m = p_margin * min(sz.x, sz.y);
  vec2 inner = max(sz * 0.5 - m, vec2(0.004));
  bool inv = h2 < p_negative;
  vec3 paper = u_bg * (1.0 + 0.05 * itPaper(uv));
  vec3 cellBg = paper;
  if (inv) cellBg = h3 < p_accent ? accent(floor(h3 / max(p_accent, 1e-3) * 3.0)) : u_ink;
  vec3 fg = itLum(cellBg) < 0.2 ? u_bg : u_ink;
  if (!inv && h3 < p_accent * 0.5) fg = accent(floor(h3 * 6.0));
  vec3 col = cellBg;
  float cov = 0.0;
  if (h4 < p_ornament) {
    float ty = floor(h4 / max(p_ornament, 1e-3) * 4.0);
    if (ty < 1.0) cov = 1.0 - smoothstep(-aa(), aa(), sdBox(q, inner * vec2(1.0, 0.45 + 0.4 * h5)));
    else if (ty < 2.0) {
      float cx = clamp(round(q.x / (inner.x * 0.4)), -2.0, 2.0);
      float r = min(inner.x * 0.16, inner.y * 0.5);
      cov = 1.0 - smoothstep(-aa(), aa(), length(vec2(q.x - cx * inner.x * 0.4, q.y)) - r);
    } else if (ty < 3.0) cov = 1.0 - smoothstep(-aa(), aa(), length(q) - min(inner.x, inner.y) * 0.95);
    else { float s = fract((q.x + q.y) / (0.03 + 0.02 * h5)); cov = step(0.5, s) * (1.0 - smoothstep(-aa(), aa(), sdBox(q, inner))); }
  } else {
    int turns = h1 < p_turn ? 1 + int(floor(h5 * 3.0)) : 0;
    vec2 qq = rot(-float(turns) * PI * 0.5) * q;
    vec2 ib = (turns % 2 == 1) ? inner.yx : inner;
    vec2 fit = vec2(min(2.0 * ib.x, 1.6 * ib.y), min(2.0 * ib.y, 2.0 * ib.x / 0.8));
    vec2 box = mix(fit, 2.0 * ib, p_stretch);
    int ch = itPick(p_word, h0);
    float rnd = h5 < p_round ? 1.0 : 0.0;
    cov = itGlyph(ch, qq / box + 0.5, 5.0 * aa() / box.y, rnd, p_bold);
  }
  col = mix(col, fg, cov * (0.94 + 0.06 * itN(uv * 330.0)));
  if (p_rules) {
    float e = min(min(uv.x - lo.x, hi.x - uv.x), min(uv.y - lo.y, hi.y - uv.y));
    col = mix(col, u_ink, (1.0 - smoothstep(0.0015, 0.0015 + aa() * 2.0, e)) * 0.9);
  }
  return vec4(col, 1.0);
}
