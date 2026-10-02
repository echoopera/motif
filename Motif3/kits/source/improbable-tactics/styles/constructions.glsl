// Counter-Constructions — Van Doesburg's floating planes, projected axonometrically. Floors and walls slide along
// their own axes, cast soft shadows on what lies beneath, and carry a dark edge-slab so they read as slabs, not paper.
const vec2 EX = vec2(0.8660254, 0.5), EZ = vec2(-0.8660254, 0.5), EY = vec2(0.0, 1.0);

float planeCov(vec2 p, vec2 c, mat2 Mi, vec2 hb) {
  vec2 st = Mi * (p - c);
  return 1.0 - smoothstep(-aa(), aa(), sdBox(st, hb));
}

vec4 motif(vec2 uv, vec2 fc) {
  vec3 col = u_bg * (1.0 + 0.04 * itPaper(uv));
  vec3 grey = mix(u_bg, u_ink, 0.22);
  vec3 white = mix(u_bg, vec3(1.0), 0.55);
  for (int i = 0; i < 28; i++) {
    if (i >= p_count) break;
    float fi = float(i);
    vec2 h = h22(vec2(fi, 3.0)), h2 = h22(vec2(fi, 9.0)), h3 = h22(vec2(fi, 15.0));
    int o = h.x < p_floor ? 0 : (h.y < 0.5 ? 1 : 2);
    vec2 e1 = o == 0 ? EX : (o == 1 ? EX : EZ);
    vec2 e2 = o == 0 ? EZ : EY;
    mat2 Mi = inverse(mat2(e1, e2));
    vec2 c = (h2 - 0.5) * M_asp() * p_spread;
    float a = p_size * (0.1 + 0.55 * h3.x * h3.x + 0.08), b = p_size * (0.05 + 0.5 * h3.y * h3.y + 0.05);
    if (o != 0) b *= 1.5;
    c += e1 * p_drift * 0.14 * lsin(float(p_cycles), h.y) + e2 * p_drift * 0.06 * lsin(float(p_cycles), h2.x);
    vec2 hb = vec2(a, b);
    vec2 so = vec2(0.045, -0.06) * p_shadow * (0.5 + h.x);
    float sh = planeCov(uv - so, c, Mi, hb);
    col *= 1.0 - 0.38 * p_shadow * sh;
    float hc = h2.y;
    vec3 fill = hc < p_neutral ? (hc < p_neutral * 0.5 ? white : (hc < p_neutral * 0.85 ? grey : u_ink)) : accent(floor((hc - p_neutral) / max(1.0 - p_neutral, 1e-3) * 3.0));
    float th = p_thick * 0.05 * (0.4 + h3.x);
    float slab = planeCov(uv + vec2(0.0, th), c, Mi, hb);
    col = mix(col, itLum(fill) < 0.12 ? fill * 0.6 : fill * 0.42, slab);
    float top = planeCov(uv, c, Mi, hb);
    col = mix(col, fill, top);
    if (p_outline) {
      float d = sdBox(Mi * (uv - c), hb) / 1.0;
      col = mix(col, u_ink, (1.0 - smoothstep(0.0, aa() * 2.2, abs(d + 0.0015))) * (0.5 + 0.5 * top) * 0.85);
    }
  }
  return vec4(col, 1.0);
}
