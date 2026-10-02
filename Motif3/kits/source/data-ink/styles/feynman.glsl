// Possible Photons — a diagram assembled from your coupling values. Vertices sit on a loose ring; straight lines
// carry fermions (with arrows), wavy lines are photons whose amplitude is a slider; pulses travel the edges.
float V(int i) { i = ((i % 8) + 8) % 8; return i == 0 ? p_v1 : i == 1 ? p_v2 : i == 2 ? p_v3 : i == 3 ? p_v4 : i == 4 ? p_v5 : i == 5 ? p_v6 : i == 6 ? p_v7 : p_v8; }
vec2 node(int i) {
  float fi = float(i);
  float ang = TAU * (fi + 0.3 * h21(vec2(fi, 3.0))) / float(p_nodes) + 0.05 * p_sway * lsin(1.0, h21(vec2(fi, 4.0)));
  float rad = p_size * (0.28 + 0.34 * h21(vec2(fi, 5.0)));
  return vec2(cos(ang) * 1.15, sin(ang)) * rad + 0.02 * p_sway * lc(1.0, h21(vec2(fi, 6.0)));
}

// coverage of one edge: a -> b, photon or fermion
void edge(vec2 p, vec2 a, vec2 b, float seed, int eidx, inout vec3 col) {
  vec2 ba = b - a; float L = length(ba); if (L < 0.01) return;
  vec2 dir = ba / L, perp = vec2(-dir.y, dir.x);
  vec2 pa = p - a;
  float s = dot(pa, dir), n = dot(pa, perp);
  bool photon = h21(vec2(seed, 3.0)) < p_photons;
  vec3 wire = mix(u_ink, u_bg, 0.3);
  float d;
  float nw = floor(L * p_freq * 14.0) + 1.0;
  float amp = p_amp * 0.016 * (0.4 + V(eidx) * 1.3);
  float nc = 0.0, slope = 0.0;
  if (photon) {
    float env = smoothstep(0.0, 0.06, s / L) * smoothstep(1.0, 0.94, s / L);
    float ph = TAU * (nw * s / L - float(p_wave) * u_p);
    nc = amp * env * sin(ph);
    slope = amp * env * TAU * nw / L * cos(ph);
    d = abs(n - nc) / sqrt(1.0 + slope * slope);
    if (s < 0.0) d = length(pa); if (s > L) d = length(p - b);
  } else d = sdSeg(p, a, b);
  float core = dxHair(d, 0.0034);
  col = dxInk(col, wire, core * 0.95);
  col = dxInk(col, mix(wire, u_bg, 0.55), dxHair(d, 0.0012) * 0.8);
  // arrow on fermions
  if (!photon) {
    vec2 m = a + ba * 0.5;
    float ar = min(sdSeg(p, m - dir * 0.014 + perp * 0.011, m + dir * 0.012), sdSeg(p, m - dir * 0.014 - perp * 0.011, m + dir * 0.012));
    col = dxInk(col, u_ink, dxHair(ar, 0.0024) * 0.9);
  }
  // bubble
  if (h21(vec2(seed, 8.0)) < p_loops) {
    vec2 m = a + ba * 0.5 + perp * 0.0;
    float rr = 0.026 + 0.012 * h21(vec2(seed, 9.0));
    col = dxInk(col, wire, dxHair(abs(length(p - m) - rr), 0.003) * 0.95);
  }
  // a pulse riding the edge
  float k = floor(1.0 + 2.0 * h21(vec2(seed, 10.0)));
  float sp = L * fract(k * u_p + h21(vec2(seed, 11.0)));
  float pn = 0.0;
  if (photon) pn = amp * sin(TAU * (nw * sp / L - float(p_wave) * u_p)) * smoothstep(0.0, 0.06, sp / L) * smoothstep(1.0, 0.94, sp / L);
  vec2 pp = a + dir * sp + perp * pn;
  col = dxInk(col, h21(vec2(seed, 12.0)) < 0.35 ? u_a0 : u_a1, dxDot(p, pp, 0.0068));
}

vec4 motif(vec2 uv, vec2 fc) {
  vec2 A = M_asp();
  vec3 col = u_bg * (1.0 + 0.02 * itPaper(uv));
  int E = 0;
  for (int i = 0; i < 8; i++) {
    if (i >= p_nodes) break;
    int ii = i;
    int j = (ii + 1) % p_nodes;
    edge(uv, node(ii), node(j), float(ii) + 1.0, ii, col);
    if (h21(vec2(float(ii), 21.0)) < p_chords) edge(uv, node(ii), node((ii + 2) % p_nodes), float(ii) + 31.0, ii + 3, col);
    if (h21(vec2(float(ii), 22.0)) < p_legs) {
      vec2 n0 = node(ii); vec2 dir = normalize(n0 + vec2(0.001));
      vec2 far = n0 + dir * (0.4 + 0.2 * h21(vec2(float(ii), 23.0)));
      edge(uv, n0, far, float(ii) + 61.0, ii + 5, col);
    }
  }
  for (int i = 0; i < 8; i++) {
    if (i >= p_nodes) break;
    vec2 n0 = node(i);
    col = dxInk(col, u_ink, dxDot(uv, n0, 0.0075));
    // each vertex is labelled with the coupling that drives it
    col = dxInk(col, u_ink, dxNum(uv, n0 + vec2(0.012, 0.012), 0.013, V(i) * 100.0, 0.8) * 0.8);
  }
  return vec4(col, 1.0);
}
