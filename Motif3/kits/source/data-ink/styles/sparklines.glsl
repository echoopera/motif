// Sparkline Table — small multiples with a grey range band, a blue minimum, a red maximum and the live end value.
// A window slides through each series; the eight sliders set each row's level, so the table is your dataset.
float V(int i) { i = ((i % 8) + 8) % 8; return i == 0 ? p_v1 : i == 1 ? p_v2 : i == 2 ? p_v3 : i == 3 ? p_v4 : i == 4 ? p_v5 : i == 5 ? p_v6 : i == 6 ? p_v7 : p_v8; }
float series(int r, float x) {
  return dxData(float(r), x * p_window + float(p_slide) * u_p, p_pattern, p_sway, 1.0) * (0.3 + V(r) * 1.1) * p_gain;
}
vec4 motif(vec2 uv, vec2 fc) {
  vec2 A = M_asp();
  vec3 col = u_bg * (1.0 + 0.03 * itPaper(uv));
  vec2 lo = vec2(-0.5 * A.x + 0.06, -0.5 * A.y + 0.05), hi = vec2(0.5 * A.x - 0.06, 0.5 * A.y - 0.05);
  float cw = (hi.x - lo.x) / float(p_cols), rh = (hi.y - lo.y) / float(p_rows);
  float cxi = floor((uv.x - lo.x) / cw), ryi = floor((hi.y - uv.y) / rh);
  if (cxi < 0.0 || cxi >= float(p_cols) || ryi < 0.0 || ryi >= float(p_rows)) return vec4(col, 1.0);
  int r = int(ryi) + int(cxi) * p_rows;
  vec2 c0 = vec2(lo.x + cxi * cw, hi.y - (ryi + 1.0) * rh);
  vec2 q = uv - c0;
  float h = min(rh * 0.3, 0.026);
  float labW = dxNameW(p_names, r) * h;
  float x0 = labW + 0.05, x1 = cw - 0.12;
  float pad = rh * 0.16, hh = rh - 2.0 * pad;
  float sx = (q.x - x0) / (x1 - x0);
  // row rule
  col = dxInk(col, u_ink, dxHair(q.y, 0.0007) * 0.22);
  col = dxInk(col, u_ink, dxName(q, vec2(0.01, rh * 0.5 - h * 0.5), h, p_names, r, 0.8));
  // range band
  if (sx >= 0.0 && sx <= 1.0 && q.y > pad + hh * 0.28 && q.y < pad + hh * 0.68) col = mix(col, dxGrey(0.12), 0.6);
  // the line, sampled for min / max
  float mn = 9.0, mx = -9.0, mnx = 0.0, mxx = 0.0;
  for (int i = 0; i <= 28; i++) {
    float xx = float(i) / 28.0; float v = series(r, xx);
    if (v < mn) { mn = v; mnx = xx; }
    if (v > mx) { mx = v; mxx = xx; }
  }
  float span = max(max(mx, 1.0) - 0.0, 0.5);
  float ys0 = pad, ysH = hh / span;
  if (sx >= -0.01 && sx <= 1.01) {
    float xx = clamp(sx, 0.0, 1.0);
    float y = ys0 + series(r, xx) * ysH, y2 = ys0 + series(r, min(xx + 0.01, 1.0)) * ysH;
    float slope = (y2 - y) / (0.01 * (x1 - x0));
    float d = abs(q.y - y) / sqrt(1.0 + slope * slope);
    col = dxInk(col, u_ink, dxHair(d, 0.0016) * 0.92);
    vec2 pq = q;
    col = dxInk(col, u_a1, dxDot(pq, vec2(x0 + mnx * (x1 - x0), ys0 + mn * ysH), 0.0045));
    col = dxInk(col, u_a0, dxDot(pq, vec2(x0 + mxx * (x1 - x0), ys0 + mx * ysH), 0.0045));
  }
  float ev = series(r, 1.0);
  vec2 ep = vec2(x1, ys0 + ev * ysH);
  col = dxInk(col, u_a0, dxDot(q, ep, 0.0055));
  col = dxInk(col, u_ink, dxNum(q, vec2(x1 + 0.016, rh * 0.5 - h * 0.5), h, ev / span * 100.0, 0.8));
  col = dxInk(col, u_a1, dxNum(q, vec2(x0, pad * 0.12), h * 0.55, mn / span * 100.0, 0.8) * 0.8 * step(0.0, 1.0));
  return vec4(col, 1.0);
}
