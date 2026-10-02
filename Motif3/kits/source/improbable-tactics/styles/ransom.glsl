// Ransom Poem — cut-out scraps, each one a different paper, size, tilt and typeface-ish attitude.
// A cell grid supplies the letters; every scrap is jittered, rotated and overlapped, with the highest z on top.

// Evaluates one scrap at point p. Returns coverage; paper colour, letter coverage and z come back through outs.
float scrapAt(vec2 id, vec2 p, float cs, float S, out vec3 paper, out float glyph, out float hz, out vec3 inkc) {
  hz = itH(id + 91.0 + S);
  vec2 hv = itH2(id + 7.0 + S);
  vec2 ctr = (id + 0.5 + (hv - 0.5) * 0.42 * p_chaos) * cs;
  ctr += 0.012 * cs * p_spin * lc(1.0, itH(id + 3.0 + S)) * 3.0;
  float ang = (itH(id + 13.0 + S) - 0.5) * 1.3 * p_chaos + p_spin * 0.08 * lsin(1.0, hz);
  vec2 hs = vec2(0.8 + 0.28 * itH(id + 21.0 + S), 0.8 + 0.3 * itH(id + 22.0 + S));
  float sc = 0.82 + 0.3 * itH(id + 5.0 + S);
  vec2 l = rot(-ang) * (p - ctr);
  vec2 hb = 0.5 * cs * sc * hs;
  float t = itTear(l * 26.0 / cs + id * 7.3) * 0.022 * cs * (0.5 + p_chaos);
  float d = sdBox(l, hb) + t;
  float cov = 1.0 - smoothstep(-aa(), aa(), d);
  float kind = itH(id + 31.0 + S);
  vec3 cream = mix(u_bg, vec3(1.0), 0.35);
  paper = kind < 0.22 ? cream : kind < 0.38 ? u_ink : kind < 0.54 ? u_a0 : kind < 0.68 ? u_a1 : kind < 0.82 ? u_a2 : cream;
  inkc = itLum(paper) < 0.12 ? u_bg : (kind > 0.38 && kind < 0.54 && itH(id + 2.0) > 0.5 ? u_bg : u_ink);
  if (kind >= 0.82 && cov > 0.0) {
    float ht = itHalf(l, 0.35 + 0.4 * itH(id + 4.0), 0.4 + itH(id) * 1.2, 0.012 * cs * 14.0 * (0.7 + p_halftone));
    paper = mix(cream, mix(u_a1, u_ink, 0.2), ht * step(0.0, p_halftone + 0.2));
  }
  paper *= 1.0 + 0.05 * p_paper * itPaper(l / cs * 0.7 + id);
  // the letter
  glyph = 0.0;
  if (cov > 0.0) {
    float hsel = itH(id + 55.0 + S);
    int ch = hsel < 0.5 ? itCh(p_word, int(id.x) + int(id.y) * 3) : itPick(p_word, itH(id + 77.0 + S));
    float hh = 2.0 * hb.y * 0.72;
    float shear = (itH(id + 61.0) - 0.5) * 0.5 * p_chaos;
    vec2 gl = l; gl.x -= shear * gl.y;
    vec2 box = vec2(hh * (0.78 + 0.35 * itH(id + 62.0)), hh);
    float rnd = itH(id + 63.0) < 0.5 ? 0.0 : 1.0;
    glyph = itGlyph(ch, gl / box + 0.5, 5.0 * aa() / hh, rnd, 0.6 * (itH(id + 64.0) - 0.4)) * cov;
  }
  return cov;
}

vec4 motif(vec2 uv, vec2 fc) {
  float cs = M_asp().x / float(p_cols) * p_scale;
  float S = tslot(float(p_shuffle)) * 13.7;
  vec2 base = floor(uv / cs);
  vec3 col = u_bg * (1.0 + 0.05 * p_paper * itPaper(uv));
  vec3 paper, inkc; float gly, hz;
  float topz = -1.0, topCov = 0.0, topGly = 0.0; vec3 topPaper = col, topInk = col;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = base + vec2(float(i), float(j));
    float cov = scrapAt(id, uv, cs, S, paper, gly, hz, inkc);
    if (cov > 0.02 && hz > topz) { topz = hz; topCov = cov; topPaper = paper; topInk = inkc; topGly = gly; }
  }
  // soft shadow of scraps lying above whatever is here
  float sh = 0.0;
  vec2 so = vec2(0.012, -0.016) * cs * 2.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = base + vec2(float(i), float(j));
    float c2 = scrapAt(id, uv - so, cs, S, paper, gly, hz, inkc);
    if (hz > topz) sh = max(sh, c2);
  }
  col *= 1.0 - p_shadow * 0.42 * sh * (1.0 - topCov * 0.0);
  vec3 sc = mix(topPaper, topInk, topGly);
  col = mix(col, sc, topCov);
  // edge shading where a scrap rim catches the light
  return vec4(col, 1.0);
}
