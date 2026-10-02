// Heat Ledger — rows of tenure, one cell per time step, shaded from your values. A cursor sweeps the years; rows
// and the figure at the right end read the value under it. Attach an image and its brightness becomes the data.
float V(int i) { i = ((i % 8) + 8) % 8; return i == 0 ? p_v1 : i == 1 ? p_v2 : i == 2 ? p_v3 : i == 3 ? p_v4 : i == 4 ? p_v5 : i == 5 ? p_v6 : i == 6 ? p_v7 : p_v8; }
vec4 motif(vec2 uv, vec2 fc) {
  vec2 A = M_asp();
  vec3 col = u_bg * (1.0 + 0.03 * itPaper(uv));
  vec2 lo = vec2(-0.5 * A.x + 0.24 * A.x * 0.9 + 0.04, -0.5 * A.y + 0.07), hi = vec2(0.5 * A.x - 0.1, 0.5 * A.y - 0.12);
  float rh = (hi.y - lo.y) / float(p_rows);
  float xs = (uv.x - lo.x) / (hi.x - lo.x);
  float cols = float(p_cols);
  float cur = fract(float(p_sweep) * u_p);
  vec3 deep = u_a0, mid = u_a1, lite = u_a2;
  // legend
  {
    vec2 lg = vec2(hi.x - 0.28, hi.y + 0.05);
    float lx = (uv.x - lg.x) / 0.26;
    if (lx > 0.0 && lx < 1.0 && uv.y > lg.y && uv.y < lg.y + 0.014) col = dxSeq(lx, lite, mid, deep);
    for (int i = 0; i < 3; i++) {
      float v = float(i) * 50.0;
      col = dxInk(col, u_ink, dxNum(uv, vec2(lg.x + 0.26 * float(i) * 0.5 - 0.008 * dxNumW(v), lg.y + 0.022), 0.014, v, 0.8));
    }
  }
  float ry = (hi.y - uv.y) / rh;
  int r = int(floor(ry));
  if (r >= 0 && r < p_rows) {
    float fr = float(r);
    float rowF = fract(ry);
    float h = min(rh * 0.74, 0.03);
    float s0 = p_stagger * 0.62 * h21(vec2(fr, 3.0));
    float len = 0.28 + 0.62 * h21(vec2(fr, 4.0));
    float v = V(r);
    // label and leader
    float lw = dxNameW(p_names, r) * h;
    vec2 lo2 = vec2(lo.x - 0.03 - lw, hi.y - (fr + 0.5) * rh - h * 0.5);
    col = dxInk(col, u_ink, dxName(uv, lo2, h, p_names, r, 0.8));
    if (uv.x > lo.x - 0.026 && uv.x < lo.x + s0 * (hi.x - lo.x)) col = dxInk(col, u_ink, dxHair(abs(uv.y - (hi.y - (fr + 0.5) * rh)), 0.0009) * step(0.5, fract(uv.x * 160.0)) * 0.5);
    if (xs >= 0.0 && xs <= 1.0) {
      float cx = (floor(xs * cols) + 0.5) / cols;
      bool isOn = cx >= s0 && cx <= s0 + len;
      float d = dxData(fr, cx, p_pattern, p_sway, 1.0) * (0.25 + v * 1.1) * p_gain;
      vec2 cc = vec2(lo.x + cx * (hi.x - lo.x), hi.y - (fr + 0.5) * rh);
      if (u_sourceOn > 0.5) { vec4 s = m_sourceUV(cc); d = mix(d, itLum(s.rgb + u_bg * (1.0 - s.a)) * 1.25 * (0.5 + v), p_photo); isOn = isOn || p_photo > 0.5; }
      float t = pow(sat(d), 0.75);
      float tr = fract(xs * cols);
      float inner = smoothstep(0.0, 0.08, tr) * smoothstep(1.0, 0.92, tr) * smoothstep(0.1, 0.2, rowF) * smoothstep(0.9, 0.8, rowF);
      float lit = 1.0;
      if (p_sweep > 0) { float dd = fract(cur - cx + 1.0); lit = mix(0.2, 1.0, 1.0 - smoothstep(p_trail, p_trail + 0.1, dd)); }
      if (isOn) col = mix(col, mix(u_bg, dxSeq(t, lite, mid, deep), lit), inner);
      else col = dxInk(col, u_ink, dxHair(abs(rowF - 0.5) * rh, 0.0007) * 0.12);
    }
    // value under the cursor, at the right end
    float cxx = (floor(cur * cols) + 0.5) / cols;
    float dv = dxData(fr, cxx, p_pattern, p_sway, 1.0) * (0.25 + v * 1.1) * p_gain;
    bool act = cxx >= s0 && cxx <= s0 + len;
    if (p_sweep > 0 && act) col = dxInk(col, u_ink, dxNum(uv, vec2(hi.x + 0.018, lo2.y), h, sat(dv) * 100.0, 0.8));
  }
  // cursor
  if (p_sweep > 0) {
    float cxp = lo.x + cur * (hi.x - lo.x);
    col = dxInk(col, u_a1, dxHair(abs(uv.x - cxp), 0.0016) * step(lo.y, uv.y) * step(uv.y, hi.y + 0.01) * 0.9);
    col = dxInk(col, u_ink, dxNum(uv, vec2(cxp - 0.02, lo.y - 0.04), 0.018, p_from + cur * p_span, 0.8));
  }
  return vec4(col, 1.0);
}
