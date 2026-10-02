// Marey Grid — a timetable as a graphic. Stations sit at distances you set (the eight gap sliders), trains run as
// diagonals with dwell flats at each stop, on a fine grey grid. A cursor sweeps the day and pins each train it crosses.
float V(int i) { i = ((i % 8) + 8) % 8; return i == 0 ? p_v1 : i == 1 ? p_v2 : i == 2 ? p_v3 : i == 3 ? p_v4 : i == 4 ? p_v5 : i == 5 ? p_v6 : i == 6 ? p_v7 : p_v8; }
float gapAt(int i) { return 0.3 + V(i) * 1.2; }

// y of train k at normalised time tt (0..1 across the plot), or -9 when it is not running. slope in plot units.
float trainY(int k, float tt, float yTop, float yBot, float sumG, out float slope, out float W) {
  float fk = float(k);
  bool down = (k % 2) == 0;
  float T0 = h21(vec2(fk, 1.0));
  float dur = (0.22 + 0.42 * h21(vec2(fk, 3.0))) * p_pace;
  float dw = p_dwell * 0.014;
  float x = fract(tt - T0);
  float cumG = 0.0; slope = 0.0; W = 1.0;
  for (int i = 0; i < 9; i++) {
    if (i >= p_stations - 1) break;
    int a = down ? i : p_stations - 1 - i;
    int b = down ? i + 1 : p_stations - 2 - i;
    float ga = gapAt(down ? i : p_stations - 2 - i);
    float dt = ga / sumG * dur;
    float ya = yTop + (yBot - yTop) * (down ? cumG : sumG - cumG - ga) / sumG * 1.0;
    float yb = ya;
    float y0, y1;
    float f0 = down ? cumG : sumG - cumG;
    float f1 = down ? cumG + ga : sumG - cumG - ga;
    y0 = yTop + (yBot - yTop) * f0 / sumG; y1 = yTop + (yBot - yTop) * f1 / sumG;
    if (x < dt) { slope = (y1 - y0) / max(dt, 1e-4); return mix(y0, y1, x / dt); }
    x -= dt;
    if (x < dw) { slope = 0.0; return y1; }
    x -= dw;
    cumG += ga;
  }
  return -9.0;
}

vec4 motif(vec2 uv, vec2 fc) {
  vec2 A = M_asp();
  vec3 col = u_bg * (1.0 + 0.025 * itPaper(uv));
  vec2 lo = vec2(-0.5 * A.x + 0.13, -0.5 * A.y + 0.1), hi = vec2(0.5 * A.x - 0.13, 0.5 * A.y - 0.1);
  float pw = hi.x - lo.x, ph = hi.y - lo.y;
  float sumG = 0.0;
  for (int i = 0; i < 9; i++) { if (i >= p_stations - 1) break; sumG += gapAt(i); }
  // grid
  float hrs = float(p_hours);
  float gx = (uv.x - lo.x) / pw * hrs;
  bool inX = uv.x > lo.x - 0.002 && uv.x < hi.x + 0.002, inY = uv.y < hi.y + 0.002 && uv.y > lo.y - 0.002;
  if (inX && inY) {
    float fx = abs(fract(gx + 0.5) - 0.5) / hrs * pw;
    float minor = dxHair(abs(fract(gx * 4.0 + 0.5) - 0.5) / (hrs * 4.0) * pw, 0.0005) * 0.10 * p_grid;
    float hour = dxHair(fx, 0.0007) * 0.22 * p_grid;
    float major = dxHair(abs(fract(gx / 3.0 + 0.5) - 0.5) * 3.0 / hrs * pw, 0.0011) * 0.35 * p_grid;
    col = dxInk(col, u_ink, max(minor, max(hour, major)));
  }
  float yTopS = hi.y, yBotS = lo.y;
  float cumG = 0.0;
  for (int i = 0; i < 10; i++) {
    if (i >= p_stations) break;
    float ys = yTopS + (yBotS - yTopS) * cumG / sumG;
    col = dxInk(col, u_ink, dxHair(abs(uv.y - ys), 0.0012) * step(lo.x - 0.01, uv.x) * step(uv.x, hi.x + 0.01) * 0.55);
    float h = 0.017;
    float nw = dxNameW(p_names, i) * h;
    col = dxInk(col, u_ink, dxName(uv, vec2(lo.x - 0.02 - nw, ys - h * 0.5), h, p_names, i, 0.8));
    col = dxInk(col, u_ink, dxName(uv, vec2(hi.x + 0.02, ys - h * 0.5), h, p_names, i, 0.8) * 0.8);
    if (i < p_stations - 1) cumG += gapAt(i);
  }
  float cur = fract(float(p_sweep) * u_p);
  float cxp = lo.x + pw * cur;
  float tt = (uv.x - lo.x) / pw;
  float hl = tslot(float(p_trains));
  if (inX && inY) {
    for (int k = 0; k < 28; k++) {
      if (k >= p_trains) break;
    int kk = k;
      float slope, W;
      float y = trainY(kk, tt, yTopS, yBotS, sumG, slope, W);
      if (y < -8.0) continue;
      float s = slope / pw * 1.0;
      float d = abs(uv.y - y) / sqrt(1.0 + s * s * 0.0 + (slope / pw) * (slope / pw));
      float wgt = 0.0013 + 0.0011 * h21(vec2(float(kk), 5.0));
      bool sel = float(kk) == mod(hl, float(p_trains));
      float dd = fract(cur - tt + 1.0);
      float lit = 1.0 - 0.78 * smoothstep(p_trail, p_trail + 0.12, dd);
      float cv = dxHair(d, wgt * (sel ? 1.8 : 1.0));
      col = dxInk(col, sel ? u_a0 : u_ink, cv * (0.4 + 0.55 * lit));
      // pinned dot at the cursor
      if (abs(uv.x - cxp) < 0.014) {
        float sl2, W2; float yc = trainY(kk, cur, yTopS, yBotS, sumG, sl2, W2);
        if (yc > -8.0) col = dxInk(col, sel ? u_a0 : u_a1, dxDot(uv, vec2(cxp, yc), 0.0045));
      }
    }
  }
  // cursor and hour labels
  col = dxInk(col, u_a0, dxHair(abs(uv.x - cxp), 0.0014) * step(lo.y, uv.y) * step(uv.y, hi.y) * 0.5);
  for (int i = 0; i <= 24; i++) {
    if (i > p_hours) break;
    if (i % 3 != 0) continue;
    float hx = lo.x + pw * float(i) / hrs;
    float hv = float(p_t0 + i);
    col = dxInk(col, u_ink, dxNum(uv, vec2(hx - 0.0085 * dxNumW(hv), hi.y + 0.022), 0.015, mod(hv, 24.0), 0.8) * 0.85);
    col = dxInk(col, u_ink, dxNum(uv, vec2(hx - 0.0085 * dxNumW(hv), lo.y - 0.04), 0.015, mod(hv, 24.0), 0.8) * 0.85);
  }
  return vec4(col, 1.0);
}
