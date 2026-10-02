// Parallel Tracks — Tufte's multi-track chronology. Each row is a track of events; a sun-curve rides above, vertical
// dates cut across, and a playhead lights the events it crosses. Weights, overlap and length are yours.
float V(int i) { i = ((i % 8) + 8) % 8; return i == 0 ? p_v1 : i == 1 ? p_v2 : i == 2 ? p_v3 : i == 3 ? p_v4 : i == 4 ? p_v5 : i == 5 ? p_v6 : i == 6 ? p_v7 : p_v8; }
vec4 motif(vec2 uv, vec2 fc) {
  vec2 A = M_asp();
  vec3 col = u_bg * (1.0 + 0.03 * itPaper(uv));
  vec2 lo = vec2(-0.5 * A.x + 0.25, -0.5 * A.y + 0.07), hi = vec2(0.5 * A.x - 0.06, 0.5 * A.y - 0.19);
  float pw = hi.x - lo.x, ph = hi.y - lo.y;
  float xs = (uv.x - lo.x) / pw;
  float cur = fract(float(p_sweep) * u_p);
  float rows = float(p_tracks);
  // sun curve and day ticks
  float sy0 = hi.y + 0.03, sh = 0.1;
  if (xs >= 0.0 && xs <= 1.0) {
    float wv = 0.5 + 0.5 * sin(TAU * (xs * float(p_waves) - u_p));
    float top = sy0 + 0.02 + 0.07 * wv * p_amp;
    if (uv.y > sy0 && uv.y < top) col = mix(col, mix(u_a1, u_bg, 0.55 + 0.4 * (top - uv.y) / 0.09), 0.9);
    col = dxInk(col, u_ink, dxHair(abs(uv.y - top), 0.0012) * 0.8);
    float tk = dxHair(abs(fract(xs * float(p_units) * 4.0 + 0.5) - 0.5) / (float(p_units) * 4.0) * pw, 0.0005);
    col = dxInk(col, u_ink, tk * step(sy0 - 0.012, uv.y) * step(uv.y, sy0) * 0.6);
    col = dxInk(col, u_ink, dxHair(abs(uv.y - sy0), 0.0010) * 0.7);
  }
  // dated verticals + numbers
  for (int i = 0; i <= 24; i++) {
    if (i > p_units) break;
    float dx = lo.x + pw * float(i) / float(p_units);
    col = dxInk(col, u_ink, dxHair(abs(uv.x - dx), 0.0006) * step(lo.y - 0.02, uv.y) * step(uv.y, hi.y + 0.01) * (mod(float(i), 5.0) < 0.5 ? 0.3 : 0.14));
    float vv = p_from + float(i) * p_step;
    if (i % 2 == 0) col = dxInk(col, u_ink, dxNum(uv, vec2(dx - 0.0085 * dxNumW(vv) * 0.9, lo.y - 0.04), 0.014, vv, 0.8) * 0.85);
  }
  // tracks
  float rh = ph / rows;
  float ry = (hi.y - uv.y) / rh;
  int r = int(floor(ry));
  if (r >= 0 && r < p_tracks) {
    float fr = float(r);
    float yc = hi.y - (fr + 0.5) * rh;
    float h = min(rh * 0.66, 0.026);
    col = dxInk(col, u_ink, dxHair(abs(uv.y - yc), 0.0008) * step(lo.x, uv.x) * 0.3);
    col = dxInk(col, u_ink, dxName(uv, vec2(lo.x - 0.015 - dxNameW(p_names, r) * h, yc - h * 0.5), h, p_names, r, 0.8));
    vec3 tc = accent(fr);
    for (int e = 0; e < 7; e++) {
      float fe = float(e);
      float st = (fe + (h21(vec2(fr, fe + 3.0)) - 0.5) * p_overlap * 1.6 + 0.4) / 7.4;
      float dur = (0.35 + 0.8 * h21(vec2(fr, fe + 11.0))) * p_length * (0.45 + V(r) * 1.1) / 7.0;
      float x0 = st, x1 = st + dur;
      float bh = rh * 0.34 * (0.7 + 0.5 * h21(vec2(fr, fe + 20.0)));
      float dd = fract(cur - st + 1.0);
      float lit = 1.0 - smoothstep(p_trail, p_trail + 0.1, dd);
      float inB = (1.0 - smoothstep(-aa(), aa(), sdBox(vec2((xs - 0.5 * (x0 + x1)) * pw, uv.y - yc), vec2(0.5 * (x1 - x0) * pw, bh))));
      float isOn = step(x0, cur) * step(cur, x1);
      if (inB > 0.0) {
        vec3 c = mix(mix(u_bg, tc, 0.35), tc, lit);
        col = mix(col, c, inB * (0.65 + 0.35 * lit));
        col = dxInk(col, u_ink, (1.0 - smoothstep(0.0, aa() * 1.6, abs(sdBox(vec2((xs - 0.5 * (x0 + x1)) * pw, uv.y - yc), vec2(0.5 * (x1 - x0) * pw, bh))))) * 0.7);
      }
      // length of the event, printed above its start
      float du = dur * float(p_units) * p_step;
      col = dxInk(col, u_ink, dxNum(uv, vec2(lo.x + x0 * pw, yc + bh + 0.004), h * 0.45, du, 0.8) * 0.8 * lit);
    }
  }
  // playhead
  float cx = lo.x + cur * pw;
  col = dxInk(col, u_a0, dxHair(abs(uv.x - cx), 0.0016) * step(lo.y - 0.02, uv.y) * step(uv.y, hi.y + 0.12) * 0.9);
  col = dxInk(col, u_a0, dxNum(uv, vec2(cx - 0.012, hi.y + 0.135), 0.015, p_from + cur * float(p_units) * p_step, 0.8));
  return vec4(col, 1.0);
}
