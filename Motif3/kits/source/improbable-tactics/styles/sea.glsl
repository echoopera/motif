// Rough Sea — "a design isn't finished until somebody is using it". A boiling looped ocean under cut paper: a torn black
// corner, a giant letter, a red halftone window onto the same water, rules, label strips, and outline lettering.
float swell(vec2 p) {
  vec2 q = vec2(p.x * 0.8 + p.y * 0.35, p.y * 1.3 - p.x * 0.2) * p_scale * 1.6;
  float k = float(p_cycles);
  float a = lfbm(q, 5, k, 0.7);
  float r = lridge(q * 1.3 + a * 0.9, 5, k, 0.9);
  return 0.5 + a * 0.5 + r * 0.55 * (0.4 + p_chop);
}
vec3 water(vec2 p, out float lum) {
  float s = swell(p);
  float f = smoothstep(0.82 - 0.25 * p_foam, 1.15, s) * (0.6 + 0.6 * (0.5 + 0.5 * itN(p * 70.0)));
  vec3 deep = u_bg, mid = u_a2, lite = mix(u_a2, u_ink, 0.55);
  vec3 c = mix(deep, mid, smoothstep(0.2, 0.75, s));
  c = mix(c, lite, smoothstep(0.65, 1.0, s) * 0.8);
  c = mix(c, u_ink, sat(f) * 0.95);
  lum = itLum(c);
  return c;
}

vec4 motif(vec2 uv, vec2 fc) {
  vec2 ext = M_asp();
  float lum;
  vec3 col = water(uv, lum);
  // torn black corner
  if (p_torn > 0.0) {
    float t = uv.x / ext.x * 0.9 + uv.y / ext.y * 0.55 - (1.0 - 0.55 * p_torn);
    t += itTear(uv * 5.5) * 0.12;
    float m = smoothstep(0.0, aa() * 3.0, t);
    float fibre = smoothstep(0.012, 0.0, t) * smoothstep(0.0, aa() * 3.0, t + 0.012);
    col = mix(col, u_ink * 0.95, fibre * 0.5);
    col = mix(col, vec3(0.012), m);
  }
  // giant letter
  int lch = itCh(p_word, p_letter);
  float LH = ext.y * 0.62, LW = LH * 0.62;
  vec2 lc0 = vec2(-ext.x * 0.3, -ext.y * 0.08) + 0.012 * p_tilt * lc(1.0, 0.0);
  vec2 ll = rot(-0.05 * p_tilt) * (uv - lc0);
  vec2 lbox = vec2(LW, LH);
  // a cut window in the letter's neighbourhood: red halftone of the same water
  if (p_window) {
    vec2 wc = lc0 + vec2(LW * 0.55, LH * 0.38), wh = vec2(LW * 0.55, LH * 0.27);
    float wm = 1.0 - smoothstep(-aa(), aa(), sdBox(uv - wc, wh));
    float wl; vec3 wcol = water(uv + vec2(0.1, 0.05), wl);
    vec3 tint = c_tint();
    float ht = itHalf(uv, 1.0 - sat(wl * 1.5), 0.6, 0.007);
    vec3 red = tint * (0.45 + 0.9 * sat(wl * 1.4));
    red = mix(red, u_ink * 0.12, ht * 0.55);
    col = mix(col, red, wm);
  }
  float lcv = itGlyph(lch, ll / lbox + 0.5, 5.0 * aa() / LH, 0.0, 0.0);
  col = mix(col, vec3(0.01), lcv);
  // rules
  float rx = -ext.x * 0.18;
  col = mix(col, vec3(0.01), line(abs(uv.x - rx), 0.004) * smoothstep(ext.y * 0.28, ext.y * 0.2, uv.y));
  float hy = ext.y * 0.07;
  col = mix(col, c_tint(), line(abs(uv.y - hy), 0.011) * step(rx + 0.02, uv.x));
  // label strips
  int n = itLen(p_word);
  for (int s = 0; s < 6; s++) {
    if (s >= p_labels) break;
    float fs = float(s);
    float sy = hy - 0.065 - fs * 0.052;
    float sw = (0.2 + 0.28 * h21(vec2(fs, 5.0))) * ext.x * 0.5;
    float sh = 0.04;
    vec2 sc = vec2(rx + 0.03 + sw * 0.5, sy);
    float bm = 1.0 - smoothstep(-aa(), aa(), sdBox(uv - sc, vec2(sw * 0.5, sh * 0.5)));
    float cw = sh * 0.62;
    float gi = floor((uv.x - (sc.x - sw * 0.5 + 0.008)) / cw);
    vec2 gl = vec2(fract((uv.x - (sc.x - sw * 0.5 + 0.008)) / cw), (uv.y - (sy - sh * 0.36)) / (sh * 0.72));
    float tx = gi >= 0.0 && gi < sw / cw - 1.0 ? itGlyph(itCh(p_word, int(gi) + s * 3), gl * vec2(1.3, 1.0) - vec2(0.15, 0.0), 5.0 * aa() / (sh * 0.7), 0.0, 0.0) : 0.0;
    col = mix(col, vec3(0.01), bm);
    col = mix(col, u_a1, tx * bm);
  }
  // outline word
  if (p_outline) {
    float wd = ext.x * 0.34;
    vec2 o = vec2(ext.x * 0.1, -ext.y * 0.36);
    vec2 op = rot(0.04 * p_tilt) * (uv - o);
    float cw2 = wd / float(n);
    float ix = floor((op.x + wd * 0.5) / cw2);
    if (ix >= 0.0 && ix < float(n)) {
      float hv = h21(vec2(ix, 91.0));
      float ch = ext.y * (0.16 + 0.12 * hv);
      vec2 gl = vec2(fract((op.x + wd * 0.5) / cw2), (op.y + 0.5 * ch + 0.03 * (hv - 0.5)) / ch);
      float lv = itGlyphLine(itCh(p_word, int(ix)), gl, 5.0 * aa() / ch, 0.08);
      col = mix(col, u_a1, lv);
    }
  }
  return vec4(col, 1.0);
}
