// Circles in a Circle — translucent pigment discs mixed subtractively on warm paper, crossing needle lines, two broad
// diagonal bands, all held by one heavy black ring. Discs drift on integer orbits so the loop closes exactly.
vec3 pig(int i) {
  int k = ((i % 7) + 7) % 7;
  return k == 0 ? u_a0 : k == 1 ? u_a1 : k == 2 ? u_a2 : k == 3 ? mix(u_a0, u_bg, 0.55) : k == 4 ? mix(u_a0, u_a1 * 0.4, 0.55)
       : k == 5 ? mix(u_a1, u_a2, 0.5) * 0.7 : mix(u_ink, u_a1, 0.35);
}
vec4 motif(vec2 uv, vec2 fc) {
  float R = 0.43 * p_size;
  vec3 paper = u_bg * (1.0 + 0.06 * p_grain * itPaper(uv));
  vec3 col = paper;
  float r0 = length(uv);
  float brush = 0.88 + 0.12 * itN(uv * vec2(7.0, 40.0));
  // diagonal bands
  if (p_bands) {
    for (int b = 0; b < 2; b++) {
      float sgn = b == 0 ? 1.0 : -1.0;
      vec2 nrm = normalize(vec2(sgn, 1.0));
      float off = (b == 0 ? 0.18 : -0.22) * 1.0 + 0.04 * lsin(1.0, 0.25 * float(b));
      float d = abs(dot(uv, nrm) - off) - (b == 0 ? 0.19 : 0.12);
      float m = 1.0 - smoothstep(-0.004, 0.004 + 0.006 * itN(uv * 6.0), d);
      vec3 pg = b == 0 ? mix(u_a1, u_bg, 0.15) : mix(u_a2, u_bg, 0.1);
      col = mix(col, pg * brush, m * 0.92);
    }
  }
  // inner disc
  float inside = 1.0 - smoothstep(R - aa(), R + aa(), r0);
  col = mix(col, paper * 1.03, inside);
  // translucent discs
  for (int i = 0; i < 36; i++) {
    if (i >= p_count) break;
    float fi = float(i);
    vec2 h = h22(vec2(fi, 3.0)), h2 = h22(vec2(fi, 8.0));
    float ang = h.x * TAU, rad = sqrt(h.y) * R * 0.88 * p_spread;
    vec2 c = vec2(cos(ang), sin(ang)) * rad + p_orbit * 0.05 * lc(float(p_cycles) * (h2.x < 0.5 ? 1.0 : -1.0), h2.y);
    float r = R * (0.05 + 0.34 * h2.x * h2.x + 0.04 * h2.y);
    float d = length(uv - c);
    float m = (1.0 - smoothstep(r - aa(), r + aa(), d)) * inside;
    vec3 pg = pig(int(floor(h.y * 40.0 + fi)));
    col = itMul(col, mix(vec3(1.0), pg * 1.12, 1.0), m * p_alpha);
    float ol = (1.0 - smoothstep(0.0, aa() * 2.0, abs(d - r) - 0.0012)) * step(h.x, p_outline) * inside;
    col = mix(col, u_ink, ol * 0.85);
    if (r < R * 0.1 && h2.y < p_dots) {
      float dd = 1.0 - smoothstep(-aa(), aa(), d - r * 0.32);
      col = mix(col, u_ink, dd * inside);
    }
  }
  // needle lines
  for (int k = 0; k < 24; k++) {
    if (k >= p_lines) break;
    float fk = float(k);
    vec2 h = h22(vec2(fk, 33.0));
    float a = h.x * PI + 0.06 * lsin(1.0, h.y);
    vec2 dir = vec2(cos(a), sin(a)), nrm = vec2(-dir.y, dir.x);
    float o = (h.y - 0.5) * R * 1.5 + 0.03 * lsin(1.0, h.x);
    vec2 pc = nrm * o;
    float half_ = R * (0.4 + 0.55 * h21(vec2(fk, 34.0)));
    float d = sdSeg(uv, pc - dir * half_, pc + dir * half_);
    float w = 0.0012 + 0.0013 * h21(vec2(fk, 35.0));
    col = mix(col, u_ink, (1.0 - smoothstep(w, w + aa() * 1.5, d)) * 0.92 * inside);
  }
  // the ring
  float rw = p_ring * 0.5;
  float rd = abs(r0 - R) - rw + 0.003 * itN(uv * 14.0);
  col = mix(col, u_ink * 1.05, 1.0 - smoothstep(-aa(), aa(), rd));
  return vec4(col, 1.0);
}
