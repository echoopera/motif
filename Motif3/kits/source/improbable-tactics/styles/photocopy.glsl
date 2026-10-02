// Photocopy Type — "print is not dead". Giant mismatched letters pushed through a tired copier: ragged edges, toner
// dropout, a second misregistered pass in blue, micro-text columns, a barcode, creases, and flung paint.
float typeCov(vec2 p, float rowOff, int rowIdx, float hgt) {
  int n = itLen(p_word);
  float W = M_asp().x * 0.94 * p_size;
  float cw = W / float(n);
  float x0 = -0.5 * W;
  int ix0 = int(floor((p.x - x0) / cw));
  float cov = 0.0;
  for (int k = -1; k <= 1; k++) {
    int ix = ix0 + k;
    if (ix < 0 || ix >= n) continue;
    float fi = float(ix) + float(rowIdx) * 11.0;
    vec2 hv = h22(vec2(fi, 4.0));
    float sx = 0.8 + 0.5 * hv.x * p_scatter + 0.2 * (1.0 - p_scatter);
    float sy = 0.65 + 0.9 * hv.y * p_scatter + 0.35 * (1.0 - p_scatter);
    float ang = (h21(vec2(fi, 8.0)) - 0.5) * 0.22 * p_scatter + 0.02 * p_jitter * lsin(1.0, hv.x);
    vec2 c = vec2(x0 + (float(ix) + 0.5) * cw, rowOff + (h21(vec2(fi, 9.0)) - 0.5) * 0.12 * p_scatter * hgt);
    c.y += 0.012 * p_jitter * lsin(1.0, hv.y);
    vec2 l = rot(-ang) * (p - c);
    vec2 box = vec2(cw * 0.96 * sx, hgt * sy);
    int ch = itCh(p_word, ix + rowIdx * 2);
    float rnd = h21(vec2(fi, 12.0)) < p_round ? 1.0 : 0.0;
    cov = max(cov, itGlyph(ch, l / box + 0.5, 5.0 * aa() / box.y, rnd, p_bold));
  }
  return cov;
}

vec4 motif(vec2 uv, vec2 fc) {
  vec2 ext = M_asp();
  vec3 col = u_bg * (1.0 + 0.045 * itPaper(uv));
  // creases and copier streak
  if (p_creases) {
    float cx = gauss1(uv.x - 0.04, 0.0025) + gauss1(uv.x + ext.x * 0.31, 0.002);
    float cy = gauss1(uv.y + 0.02, 0.0025);
    col *= 1.0 - 0.07 * (cx + cy) - 0.03 * gauss1(uv.x - ext.x * 0.4, 0.05) * (0.5 + 0.5 * itN(uv * vec2(1.0, 40.0)));
  }
  // micro-text columns
  for (int b = 0; b < 4; b++) {
    float fb = float(b);
    vec2 hc = h22(vec2(fb, 71.0)), hs = h22(vec2(fb, 72.0));
    vec2 bc = (hc - 0.5) * ext * vec2(0.95, 0.85);
    vec2 hb = vec2(0.07 + 0.14 * hs.x, 0.05 + 0.13 * hs.y);
    if (fb >= p_micro * 4.0 + 0.001) break;
    vec2 d = uv - (bc - hb);
    if (d.x < 0.0 || d.y < 0.0 || d.x > 2.0 * hb.x || d.y > 2.0 * hb.y) continue;
    float ts = 0.0105;
    vec2 gp = vec2(d.x / (ts * 0.85), (2.0 * hb.y - d.y) / (ts * 1.5));
    vec2 gi = floor(gp), gf = fract(gp);
    float len = (0.5 + 0.5 * h21(vec2(gi.y, fb + 5.0))) * 2.0 * hb.x / (ts * 0.85);
    if (gi.x > len) continue;
    float hh = h21(gi + fb * 31.0);
    if (hh < 0.14) continue;
    float cov = itGlyph(itAny(hh * 7.0), vec2(gf.x, 1.0 - gf.y) * vec2(1.25, 1.2) - vec2(0.0, 0.0), 5.0 * aa() / (ts * 1.2), 0.5, 0.2);
    col = mix(col, u_ink * 1.0, cov * 0.78);
  }
  // barcode
  if (p_barcode) {
    vec2 bo = vec2(-ext.x * 0.34, -ext.y * 0.34), bs = vec2(0.17, 0.05);
    vec2 d = uv - bo;
    if (d.x > 0.0 && d.x < bs.x && d.y > 0.0 && d.y < bs.y) {
      float i = floor(d.x / 0.0042);
      float on = step(0.42, h21(vec2(i, 77.0)));
      col = mix(col, u_ink, on * 0.9);
    }
  }
  // splatters under the type, multiplied
  for (int j = 0; j < 8; j++) {
    if (j >= p_splat) break;
    float fj = float(j);
    vec2 hc = h22(vec2(fj, 101.0));
    vec2 c = (hc - 0.5) * ext * vec2(0.85, 0.8);
    float r = 0.022 + 0.07 * h21(vec2(fj, 102.0));
    r *= 1.0 + 0.1 * p_jitter * lsin(1.0, hc.x);
    float cov = itSplat(uv, c, r, fj * 3.13 + 1.0);
    vec3 pig = accent(fj);
    col = itMul(col, mix(vec3(1.0), pig, 1.0), cov);
  }
  // type
  float hgt = ext.y * 0.4 * p_size;
  float rowY = p_lines == 1 ? 0.04 * ext.y : 0.2 * ext.y;
  vec2 pr = uv + p_grit * 0.005 * vec2(itN(uv * 40.0), itN(uv * 40.0 + 4.0));
  vec2 mo = p_misreg * 0.006 * lc(1.0, 0.0) + vec2(0.012, -0.01) * p_misreg;
  float under = typeCov(pr - mo, rowY, 0, hgt);
  float cov = typeCov(pr, rowY, 0, hgt);
  if (p_lines > 1) { under = max(under, typeCov(pr - mo, -0.22 * ext.y, 1, hgt * 0.55)); cov = max(cov, typeCov(pr, -0.22 * ext.y, 1, hgt * 0.55)); }
  float toner = 1.0 - p_grit * smoothstep(0.62, 0.95, 0.5 + 0.5 * itN(uv * 170.0)) * 0.85;
  toner *= 1.0 - p_grit * 0.45 * smoothstep(0.7, 0.95, 0.5 + 0.5 * itN(uv * 12.0));
  col = itMul(col, u_a0, under * 0.92 * step(0.0, p_misreg));
  col = mix(col, u_ink, cov * toner);
  // registration marks and crop crosses
  vec2 cm = abs(uv) - ext * 0.5 * vec2(0.96, 0.96);
  float cross = max(line(abs(cm.x), 0.0012) * step(abs(cm.y), 0.02), line(abs(cm.y), 0.0012) * step(abs(cm.x), 0.02));
  col = mix(col, u_ink, cross * 0.7);
  return vec4(col, 1.0);
}
