// Flow Map — a band whose width is the data. The advance (tan) narrows with your eight waypoint values, the retreat
// (black) returns thinner by the loss you choose, and a temperature chart underneath prints the cold at each stop.
float V(int i) { i = ((i % 8) + 8) % 8; return i == 0 ? p_v1 : i == 1 ? p_v2 : i == 2 ? p_v3 : i == 3 ? p_v4 : i == 4 ? p_v5 : i == 5 ? p_v6 : i == 6 ? p_v7 : p_v8; }
vec2 wpA(int i) {
  float f = float(i) / 7.0;
  vec2 A = M_asp();
  float y = 0.07 + 0.06 * f + p_wander * 0.1 * sin(1.3 * float(i) + 6.0 * h11(7.0));
  return vec2(mix(-0.4, 0.4, f) * A.x, y);
}
float widthA(int i) { return 0.005 + 0.115 * V(i) * p_scale; }
float widthB(int i) {
  float j = float(7 - i) / 7.0;
  return max(0.002, widthA(7) * 0.85 * mix(1.0, 1.0 - p_loss, j) * (0.4 + 0.6 * (1.0 - j)) + 0.0);
}
float tempAt(int i) { return -p_cold * 30.0 * pow(float(i) / 7.0, 1.3); }

vec4 motif(vec2 uv, vec2 fc) {
  vec2 A = M_asp();
  vec3 col = u_bg * (1.0 + 0.035 * itPaper(uv));
  float f = fract(u_p);
  float head1 = sat(f / 0.45), head2 = sat((f - 0.5) / 0.42);
  float fade = 1.0 - smoothstep(0.9, 0.98, f);
  vec2 sepv = vec2(0.0, -(0.05 + p_sep * 0.05));
  // advance
  float bestA = 9.0, sA = 0.0, wA = 0.0;
  float bestB = 9.0, sB = 0.0, wB = 0.0;
  for (int i = 0; i < 7; i++) {
    vec2 a0 = wpA(i), a1 = wpA(i + 1);
    vec2 ba = a1 - a0; float t = sat(dot(uv - a0, ba) / dot(ba, ba));
    float d = length(uv - a0 - ba * t);
    if (d < bestA) { bestA = d; sA = (float(i) + t) / 7.0; wA = mix(widthA(i), widthA(i + 1), smoothstep(0.0, 1.0, t)); }
    vec2 b0 = wpA(i) + sepv, b1 = wpA(i + 1) + sepv;
    vec2 bb = b1 - b0; float tb = sat(dot(uv - b0, bb) / dot(bb, bb));
    float db = length(uv - b0 - bb * tb);
    if (db < bestB) { bestB = db; sB = (float(i) + tb) / 7.0; wB = mix(widthB(i), widthB(i + 1), smoothstep(0.0, 1.0, tb)); }
  }
  float covA = (1.0 - smoothstep(wA * 0.5 - aa(), wA * 0.5 + aa(), bestA)) * step(sA, head1) * step(0.002, head1) * fade;
  float covB = (1.0 - smoothstep(wB * 0.5 - aa(), wB * 0.5 + aa(), bestB)) * step(1.0 - sB, head2) * step(0.002, head2) * fade;
  col = mix(col, u_a0 * (0.96 + 0.08 * itN(uv * 40.0)), covA);
  col = dxInk(col, u_ink, dxHair(abs(bestA - wA * 0.5), 0.0010) * step(sA, head1) * step(0.002, head1) * fade * 0.35 * step(0.001, wA));
  col = mix(col, u_ink * 1.1, covB);
  // cities
  float lh = 0.019;
  for (int i = 0; i < 8; i++) {
    vec2 c = wpA(i);
    float lit = step(max(float(i) / 7.0, 0.002), head1) * fade;
    col = dxInk(col, u_ink, dxDot(uv, c, 0.0042) * (0.25 + 0.75 * lit));
    col = dxInk(col, u_ink, dxName(uv, c + vec2(-0.5 * dxNameW(p_names, i) * lh, 0.5 * widthA(i) + 0.014), lh, p_names, i, 0.8) * (0.55 + 0.4 * lit));
    // headcount beside the band
    col = dxInk(col, u_ink, dxNum(uv, c + vec2(-0.5 * dxNumW(V(i) * 100.0) * lh * 0.8, -0.5 * widthA(i) - 0.03 - 0.005), lh * 0.8, V(i) * 100.0, 0.8) * 0.8 * (0.35 + 0.65 * lit));
  }
  // temperature chart
  float cy0 = -0.5 * A.y + 0.07, cy1 = cy0 + 0.17 * A.y;
  float xl = wpA(0).x - 0.04, xr = wpA(7).x + 0.04;
  if (uv.x > xl - 0.1 && uv.x < xr) {
    for (int g = 0; g <= 3; g++) {
      float gy = mix(cy0, cy1, float(g) / 3.0);
      col = dxInk(col, u_ink, dxHair(abs(uv.y - gy), 0.0008) * 0.28 * step(xl, uv.x));
      float tv = -30.0 + 10.0 * float(g);
      col = dxInk(col, u_ink, dxNumS(uv, vec2(xl - 0.03 - 0.0105 * dxNumW(tv) - (tv < -0.5 ? 0.012 : 0.0), gy - 0.006), 0.012, tv, 0.8) * 0.8);
    }
    float bestT = 9.0;
    for (int i = 0; i < 7; i++) {
      float ya = mix(cy1, cy0, sat(-tempAt(i) / 30.0)), yb = mix(cy1, cy0, sat(-tempAt(i + 1) / 30.0));
      vec2 a = vec2(wpA(i).x, ya), b = vec2(wpA(i + 1).x, yb);
      float seg = float(7 - i) / 7.0;
      bestT = min(bestT, sdSeg(uv, a, b) + max(1.0 - step(seg - 1.0 / 7.0, head2), 1.0 - step(0.002, head2)) * 1.0);
    }
    col = dxInk(col, u_ink, dxHair(bestT, 0.0022) * fade * 0.9);
  }
  for (int i = 0; i < 8; i++) {
    vec2 a = vec2(wpA(i).x, mix(cy1, cy0, sat(-tempAt(i) / 30.0)));
    float lit = step(max(float(7 - i) / 7.0, 0.002), head2) * fade;
    // dotted guide from city to the chart
    col = dxInk(col, u_ink, dxHair(abs(uv.x - a.x), 0.0007) * step(0.5, fract(uv.y * 90.0)) * step(cy0 - 0.01, uv.y) * step(uv.y, wpA(i).y - 0.5 * widthA(i) - 0.05) * 0.25);
    col = dxInk(col, u_a1, dxDot(uv, a, 0.0046) * lit);
    float tv = tempAt(i);
    col = dxInk(col, u_ink, dxNumS(uv, a + vec2(-0.014, -0.027), 0.014, tv, 0.8) * lit);
  }
  return vec4(col, 1.0);
}
