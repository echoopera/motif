// Curve Plate — a family of measured curves on fine graph paper, each tagged with the number at its head. The
// family is generated from four dials (level, spread, curvature, noise); the curves draw on and the tags climb.
float V(int i) { i = ((i % 8) + 8) % 8; return i == 0 ? p_v1 : i == 1 ? p_v2 : i == 2 ? p_v3 : i == 3 ? p_v4 : i == 4 ? p_v5 : i == 5 ? p_v6 : i == 6 ? p_v7 : p_v8; }
float warpY(float y) { return p_log > 0.01 ? log(1.0 + y * p_log * 24.0) / log(1.0 + p_log * 24.0) : y; }

float fcurve(int i, float x) {
  float fi = float(i);
  float amp = p_level * (0.18 + 0.82 * pow(h21(vec2(fi, 2.0)), 0.6)) * (0.6 + 0.8 * V(i % 8));
  float tau = (0.12 + 0.5 * h21(vec2(fi, 3.0))) * (0.5 + p_spread);
  float y;
  if (p_family == FAMILY_SATURATING) y = 1.0 - exp(-x / tau);
  else if (p_family == FAMILY_PEAKED) y = (x / tau) * exp(1.0 - x / tau);
  else y = pow(x, 0.6 + p_curve * 2.4 * (0.5 + h21(vec2(fi, 4.0))));
  y *= amp;
  y += p_noise * 0.012 * snoise(vec3(x * 14.0, fi * 3.7, 0.5)) * x;
  y += 0.012 * lsin(1.0, h21(vec2(fi, 6.0))) * sin(x * 9.0 + fi) * p_noise;
  return max(y, 0.0);
}

vec4 motif(vec2 uv, vec2 fc) {
  vec2 A = M_asp();
  vec3 col = u_bg * (1.0 + 0.03 * itPaper(uv));
  float pn = float(p_panels);
  float m = 0.07;
  float panelW = (A.x - 2.0 * m - 0.07 * (pn - 1.0)) / pn;
  float px = uv.x + 0.5 * A.x - m;
  int pi = int(floor(px / (panelW + 0.07)));
  float lx = px - float(pi) * (panelW + 0.07);
  if (pi < 0 || pi >= p_panels || lx > panelW) return vec4(col, 1.0);
  vec2 lo = vec2(0.0, -0.5 * A.y + 0.09), hi = vec2(panelW, 0.5 * A.y - 0.1);
  vec2 q = vec2(lx, uv.y);
  vec2 s = vec2((q.x - lo.x) / (hi.x - lo.x), (q.y - lo.y) / (hi.y - lo.y));
  float ph = hi.y - lo.y, pw = hi.x - lo.x;
  bool inside = s.x >= -0.002 && s.x <= 1.002 && s.y >= -0.002 && s.y <= 1.002;
  if (inside) {
    // graph paper: 1/50 minor, 1/10 major, optional log verticals follow warp
    float mn = dxHair(abs(fract(s.x * 50.0 + 0.5) - 0.5) / 50.0 * pw, 0.0004) * 0.08 + dxHair(abs(fract(s.y * 40.0 + 0.5) - 0.5) / 40.0 * ph, 0.0004) * 0.08;
    float mj = dxHair(abs(fract(s.x * 10.0 + 0.5) - 0.5) / 10.0 * pw, 0.0007) * 0.22;
    for (int i = 0; i <= 10; i++) {
      float gy = warpY(float(i) / 10.0);
      mj = max(mj, dxHair(abs(s.y - gy) * ph, 0.0007) * 0.26);
    }
    col = dxInk(col, u_ink, max(mn, mj));
    // frame
    float fr = min(min(s.x, 1.0 - s.x) * pw, min(s.y, 1.0 - s.y) * ph);
    col = dxInk(col, u_ink, dxHair(fr, 0.0016) * 0.9);
  }
  // axis numbers
  for (int i = 0; i <= 5; i++) {
    float v = float(i) * 20.0;
    float gy = warpY(float(i) / 5.0);
    col = dxInk(col, u_ink, dxNum(q, vec2(-0.012 - 0.0105 * dxNumW(v), lo.y + gy * ph - 0.006), 0.012, v, 0.8) * 0.85);
    col = dxInk(col, u_ink, dxNum(q, vec2(lo.x + float(i) / 5.0 * pw - 0.005 * dxNumW(v), lo.y - 0.026), 0.012, float(i) * 20.0, 0.8) * 0.85);
  }
  col = dxInk(col, u_ink, dxName(q, vec2(0.0, hi.y + 0.016), 0.02, p_names, pi + 3, 0.8) * 0.95);
  // curves
  float reveal = 0.15 + 0.85 * growEnv(0.35);
  int perPanel = p_count;
  for (int i = 0; i < 24; i++) {
    if (i >= perPanel) break;
    int ci = i + pi * 5;
    float x = s.x;
    float xh = reveal;
    float yv = fcurve(ci, x);
    float yw = warpY(sat(yv));
    float dy = (s.y - yw) * ph;
    float e = 0.004 * (1.0 / pw);
    float yw2 = warpY(sat(fcurve(ci, min(x + 0.01, 1.0))));
    float slope = (yw2 - yw) / 0.01 * ph / pw;
    float d = abs(dy) / sqrt(1.0 + slope * slope);
    float on = step(x, xh) * step(0.0, x);
    float hot = h21(vec2(float(ci), 17.0)) < 0.18 ? 1.0 : 0.0;
    col = dxInk(col, hot > 0.5 ? u_a0 : u_ink, dxHair(d, hot > 0.5 ? 0.0021 : 0.0013) * on * (hot > 0.5 ? 0.95 : 0.8));
    // data points along the curve
    float pt = 0.0;
    for (int j = 1; j <= 12; j++) {
      float xj = float(j) / 12.0;
      if (xj > xh) break;
      if (abs(xj - x) < 0.03) pt = max(pt, dxDot(vec2(x * pw, s.y * ph), vec2(xj * pw, warpY(sat(fcurve(ci, xj))) * ph), 0.0022));
    }
    col = dxInk(col, u_ink, pt * p_points);
    // head tag
    float yh = fcurve(ci, xh);
    vec2 hp = vec2(xh * pw, warpY(sat(yh)) * ph);
    if (abs(s.x * pw - hp.x) < 0.07) {
      col = dxInk(col, hot > 0.5 ? u_a0 : u_ink, dxDot(vec2(s.x * pw, s.y * ph), hp, 0.0036));
      if (p_tags) col = dxInk(col, u_ink, dxNum(vec2(s.x * pw, s.y * ph), hp + vec2(0.007, -0.004), 0.0105, sat(yv) * 100.0, 0.8) * 0.9);
    }
  }
  return vec4(col, 1.0);
}
