// Dot Quilt — Klee's mosaic. A wobbling partition of warm and cool cells, each stippled with its own dot screen that
// breathes, edged in uneven dark lines, with the odd half-sun rising from a cell wall.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 ext = M_asp() * 1.06;
  vec2 wob = p_wobble * vec2(0.011 * itN(uv * 5.0) + 0.006 * ln2(uv * 4.0, 1.0, 0.6), 0.011 * itN(uv * 5.0 + 7.0) + 0.006 * ln2(uv * 4.0 + 9.0, 1.0, 0.6));
  vec2 w = uv + wob;
  vec2 lo, hi; float id;
  itKD(w, ext, p_depth, p_stop, p_drift, float(p_cycles), 0.0, lo, hi, id);
  vec2 sz = hi - lo, ctr = (lo + hi) * 0.5;
  float h0 = h21(vec2(id, 5.0)), h1 = h21(vec2(id, 6.0)), h2 = h21(vec2(id, 7.0)), h3 = h21(vec2(id, 8.0));
  vec3 base = h0 < 0.30 ? u_a1 : h0 < 0.50 ? u_a0 : h0 < 0.68 ? u_a2 : h0 < 0.82 ? mix(u_a1, u_bg, 0.45) : h0 < 0.92 ? u_bg : mix(u_ink, u_a1, 0.3);
  vec3 col = base * (1.0 + 0.08 * itPaper(uv * 1.3));
  // dot screen, aligned to the cell
  float ds = p_dot * (0.7 + 0.6 * h1);
  vec2 g = (w - lo) / ds;
  vec2 gi = floor(g), gf = fract(g);
  float tone = (0.28 + 0.5 * h2) * (1.0 + 0.2 * lsin(1.0, h3));
  vec2 lc2 = gf - 0.5; if (mod(gi.y, 2.0) > 0.5) { lc2 = fract(g + vec2(0.5, 0.0)) - 0.5; }
  float dr = sqrt(sat(tone)) * 0.5;
  float dots = 1.0 - smoothstep(-aa() / ds, aa() / ds, length(lc2) - dr);
  vec3 dc = itLum(base) > 0.3 ? mix(base, u_ink, 0.7) : mix(base, u_bg, 0.55);
  col = mix(col, dc, dots * step(h3, p_dotty));
  // half-sun
  if (h3 > 1.0 - p_suns) {
    bool top = h1 < 0.5;
    vec2 sc = vec2(ctr.x, top ? hi.y : lo.y);
    float sr = 0.42 * min(sz.x, sz.y);
    float sd = length(w - sc);
    float sm = 1.0 - smoothstep(sr - aa(), sr + aa(), sd);
    vec3 sun = mix(u_a0, u_bg, 0.35 + 0.4 * (1.0 - sd / sr));
    col = mix(col, sun, sm * 0.9);
    col = mix(col, u_ink, (1.0 - smoothstep(0.0, aa() * 2.0, abs(sd - sr) - 0.002)) * 0.8);
  }
  // uneven outlines
  float e = min(min(w.x - lo.x, hi.x - w.x), min(w.y - lo.y, hi.y - w.y));
  float lw = p_line * (0.6 + 0.9 * h1) * (0.75 + 0.5 * itN(uv * 22.0));
  col = mix(col, u_ink, 1.0 - smoothstep(lw * 0.5 - aa(), lw * 0.5 + aa(), e));
  return vec4(col, 1.0);
}
