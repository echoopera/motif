// Rosette Split — an ornament plate cut in two. Concentric scalloped bands turn about a centre; a wedge of the plate
// is printed as a negative on a teal ground with sunburst rays and stars, and a tan chevron marks the join.
vec3 posCol(int i) {
  int k = ((i % 6) + 6) % 6;
  return k == 0 ? u_a0 : k == 1 ? mix(u_bg, vec3(1.0), 0.55) : k == 2 ? mix(u_ink, u_a0, 0.35) : k == 3 ? mix(u_a1, u_bg, 0.45) : k == 4 ? mix(u_bg, vec3(1.0), 0.55) : mix(u_bg, u_ink, 0.45);
}
vec3 negCol(int i) {
  int k = ((i % 6) + 6) % 6;
  return k == 0 ? u_ink : k == 1 ? mix(u_a1, u_ink, 0.45) : k == 2 ? u_a0 : k == 3 ? mix(u_bg, vec3(1.0), 0.45) : k == 4 ? u_ink : mix(u_a1, u_bg, 0.4);
}
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = uv - v_origin();
  float r = length(q), th = atan(q.y, q.x);
  float w0 = radians(p_dir), wa = radians(p_wedge);
  float a = atan(sin(th - w0), cos(th - w0));
  float neg = p_split ? smoothstep(wa + aa() / max(r, 0.02), wa - aa() / max(r, 0.02), abs(a)) : 0.0;
  float Rmax = 0.38 * p_size;
  vec3 posBg = u_bg * (1.0 + 0.05 * itPaper(uv)), negBg = mix(u_a1, u_ink, 0.18) * (1.0 + 0.05 * itPaper(uv));
  vec3 col = mix(posBg, negBg, neg);
  // sunburst rays and stars (negative field only)
  if (neg > 0.0) {
    float rays = float(p_rays);
    float fr = fract(th * rays / TAU + 0.5);
    float ri = floor(th * rays / TAU + 0.5);
    float len = Rmax * (1.12 + 0.75 * itH(vec2(ri, 7.0)));
    float ray = (1.0 - smoothstep(0.02, 0.05, abs(fr - 0.5))) * step(Rmax * 1.04, r) * (1.0 - smoothstep(len - 0.02, len, r));
    col = mix(col, mix(u_a2, negBg, 0.35), ray * neg * step(1.0, rays));
    if (p_stars) {
      vec2 g = (uv + vec2(0.0, 0.0)) / 0.13; vec2 gi = floor(g + vec2(0.0, 0.5 * mod(floor(g.x), 2.0))), gf = fract(g + vec2(0.0, 0.5 * mod(floor(g.x), 2.0))) - 0.5;
      float s = min(abs(gf.x), abs(gf.y)) * 4.0 + max(abs(gf.x), abs(gf.y)) * 0.0;
      vec2 gr = rot(PI * 0.25) * gf;
      float st = max(1.0 - smoothstep(0.012, 0.03, min(abs(gf.x), abs(gf.y))) , 0.0) * step(max(abs(gf.x), abs(gf.y)), 0.11) + (1.0 - smoothstep(0.01, 0.025, min(abs(gr.x), abs(gr.y)))) * step(max(abs(gr.x), abs(gr.y)), 0.075);
      col = mix(col, mix(u_a2, negBg, 0.3), sat(st) * neg * step(Rmax * 1.12, r));
    }
  }
  // scalloped rings, outermost painted first
  float N = float(p_rings);
  for (int i = 0; i < 14; i++) {
    if (i >= p_rings) break;
    float fi = float(i);
    float Ri = Rmax * (1.0 - fi / N);
    float dirn = (i % 2 == 0) ? 1.0 : -1.0;
    float ph = th * float(p_scal) - dirn * TAU * float(p_spin) * u_p + fi * 0.5;
    float sc = (Rmax / N) * 0.62 * (1.0 - 0.12 * fi / N);
    float edge = Ri + sc * abs(sin(0.5 * ph));
    float m = 1.0 - smoothstep(-aa(), aa(), r - edge);
    vec3 c = mix(posCol(i), negCol(i), neg);
    col = mix(col, c, m);
    float ol = 1.0 - smoothstep(0.0, aa() * 2.0, abs(r - edge) - 0.0007);
    col = mix(col, mix(u_ink, u_bg, neg) * 0.8, ol * 0.35 * m);
  }
  // centre cap
  col = mix(col, mix(mix(u_bg, vec3(1.0), 0.6), u_ink, neg), 1.0 - smoothstep(-aa(), aa(), r - Rmax * 0.06));
  // wedge join lines
  if (p_split) {
    float d = abs(a) < 1.5707 ? r * abs(sin(abs(a) - wa)) : 9.0;
    float jl = (1.0 - smoothstep(0.0025, 0.0025 + aa() * 1.5, d)) * step(Rmax * 0.04, r);
    col = mix(col, u_a2, jl);
  }
  return vec4(col, 1.0);
}
