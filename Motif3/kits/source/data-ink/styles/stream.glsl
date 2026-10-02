// Stream — a symmetric stacked flow. Each series is a looped curve whose weight is a slider; the stack scrolls
// whole frames per loop, labels ride the series, and the value beside each name is the slider you set.
float V(int i) { i = ((i % 8) + 8) % 8; return i == 0 ? p_v1 : i == 1 ? p_v2 : i == 2 ? p_v3 : i == 3 ? p_v4 : i == 4 ? p_v5 : i == 5 ? p_v6 : i == 6 ? p_v7 : p_v8; }
vec4 motif(vec2 uv, vec2 fc) {
  vec2 A = M_asp();
  vec3 col = u_bg * (1.0 + 0.03 * itPaper(uv));
  float xs = uv.x / A.x + 0.5 - float(p_scroll) * u_p;
  float T[8]; float tot = 0.0;
  for (int i = 0; i < 8; i++) {
    T[i] = 0.0;
    if (i >= p_layers) continue;
    T[i] = dxData(float(i), xs, p_pattern, p_sway, p_smooth) * (0.12 + V(i)) * p_height * 0.17;
    tot += T[i];
  }
  float g0 = -0.5 * tot + p_wiggle * 0.1 * sin(TAU * (xs * 2.0 + 0.2));
  float cum = g0, dmin = 9.0, y = uv.y; int layer = -1; float fr = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= p_layers) break;
    float lo = cum, hi = cum + T[i];
    if (y >= lo && y < hi) { layer = i; fr = (y - lo) / max(T[i], 1e-4); }
    dmin = min(dmin, min(abs(y - lo), abs(y - hi)));
    cum = hi;
  }
  if (layer >= 0) {
    float tc = float(layer) / max(float(p_layers - 1), 1.0);
    vec3 base = mix(u_a2, u_a0, tc);
    base = mix(base, u_bg, 0.12 * mod(float(layer), 2.0));
    base *= 0.9 + 0.16 * fr;
    col = base * (1.0 + 0.04 * itPaper(uv));
    col = mix(col, u_bg * 1.03, (1.0 - smoothstep(p_edge * 0.0035, p_edge * 0.0035 + aa() * 1.3, dmin)) * step(0.001, p_edge));
  }
  // labels: a dot on the series, its name, and the weight you set
  if (p_labels) {
    float lh = 0.024;
    for (int i = 0; i < 8; i++) {
      if (i >= p_layers) break;
      float fi = float(i);
      float c = fract(0.1 + fi * 0.618034) + 0.04 * p_sway * lsin(1.0, h21(vec2(fi, 4.0)));
      float ux = clamp((fract(c + float(p_scroll) * u_p) - 0.5) * A.x, -0.4 * A.x, 0.22 * A.x);
      float W = (dxNameW(p_names, i) + 2.9) * lh;
      if (uv.x < ux - 0.012 || uv.x > ux + 0.02 + W) continue;
      float tt = 0.0; float Tj[8];
      for (int j = 0; j < 8; j++) { Tj[j] = 0.0; if (j >= p_layers) continue; Tj[j] = dxData(float(j), c, p_pattern, p_sway, p_smooth) * (0.12 + V(j)) * p_height * 0.17; tt += Tj[j]; }
      float yy = -0.5 * tt + p_wiggle * 0.1 * sin(TAU * (c * 2.0 + 0.2));
      for (int j = 0; j < 8; j++) { if (j >= i) break; yy += Tj[j]; }
      yy += 0.5 * Tj[i];
      vec2 o = vec2(ux + 0.016, yy - lh * 0.5);
      float tx = dxName(uv, o, lh, p_names, i, 0.8);
      tx = max(tx, dxNum(uv, o + vec2((dxNameW(p_names, i) + 0.6) * lh, 0.0), lh, V(i) * 100.0, 0.8));
      col = mix(col, u_bg * 1.04, 0.0);
      col = dxInk(col, u_ink, tx);
      col = dxInk(col, u_ink, dxDot(uv, vec2(ux, yy), 0.0055));
    }
  }
  // time axis
  if (p_ticks) {
    float ay = -0.5 * A.y + 0.07;
    col = dxInk(col, u_ink, dxHair(abs(uv.y - ay), 0.0012) * 0.8);
    for (int i = 0; i < 5; i++) {
      float tx = (float(i) / 4.0 - 0.5) * (A.x - 0.12);
      col = dxInk(col, u_ink, dxHair(abs(uv.x - tx), 0.0012) * step(ay - 0.012, uv.y) * step(uv.y, ay) * 0.9);
      float yr = p_from + float(i) * p_span / 4.0;
      col = dxInk(col, u_ink, dxNum(uv, vec2(tx - 0.018 * dxNumW(yr) * 0.5 * 1.0, ay - 0.032), 0.02, yr, 0.8) * 0.9);
    }
  }
  return vec4(col, 1.0);
}
