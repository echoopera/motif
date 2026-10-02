// Improbable Tactics — shared helpers (compiled after the Motif prelude, before every pass).
// Everything here is static-or-loop-safe: time only ever enters through u_p with integer frequencies.

// ---- 5x5 bitmap capitals, 25 bits per glyph (row-major, top row first, bit 24 = top-left) ----
const uint IT_FONT[27] = uint[27](
  15269425u, 32045630u, 16269839u, 32032318u, 33061407u, 33061392u, 16272943u, 18415153u, 32641183u, 7408204u, 18444881u, 17318431u, 18732593u, 18667121u, 15255086u, 32045584u, 15255151u, 32045649u, 16267326u, 32641156u, 18400814u, 18400580u, 18405233u, 18157905u, 18157700u, 32575775u, 0u
);
const int IT_WCH[58] = int[58](3, 0, 3, 0, 18, 19, 8, 9, 11, 2, 0, 17, 18, 14, 13, 2, 14, 11, 11, 0, 6, 4, 2, 7, 0, 13, 2, 4, 12, 4, 17, 25, 19, 0, 2, 19, 8, 2, 18, 8, 12, 15, 17, 14, 1, 0, 1, 11, 4, 15, 17, 8, 13, 19, 15, 11, 0, 24);
const int IT_WOFF[10] = int[10](0, 4, 9, 15, 22, 28, 32, 39, 49, 54);
const int IT_WLEN[10] = int[10](4, 5, 6, 7, 6, 4, 7, 10, 5, 4);


int itLen(int w) { return IT_WLEN[clamp(w, 0, 9)]; }
int itCh(int w, int i) { w = clamp(w, 0, 9); int n = IT_WLEN[w]; return IT_WCH[IT_WOFF[w] + ((i % n) + n) % n]; }
// A pseudo-random letter drawn from the chosen word, so every scrap speaks the same language.
int itPick(int w, float h) { return itCh(w, int(floor(h * 97.0))); }
// Any letter at all (micro text).
int itAny(float h) { return int(floor(h * 26.0)) % 26; }

float itBit(int ch, int x, int y) {
  if (ch < 0 || ch > 25 || x < 0 || x > 4 || y < 0 || y > 4) return 0.0;
  return float((IT_FONT[ch] >> uint(24 - (y * 5 + x))) & 1u);
}
// Bilinear field over the 5x5 bitmap; w = kernel sharpness (small = hard pixels, 1 = fully smooth).
float itField(int ch, vec2 p, float w) {
  vec2 q = p - 0.5; vec2 i = floor(q); vec2 f = clamp((q - i - 0.5) / w + 0.5, 0.0, 1.0);
  int ix = int(i.x), iy = int(i.y);
  float a = itBit(ch, ix, iy), b = itBit(ch, ix + 1, iy), c = itBit(ch, ix, iy + 1), d = itBit(ch, ix + 1, iy + 1);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// Letter coverage. g: 0..1 over the glyph box (y up). px: glyph units per screen pixel (5 * aa() / box height).
// rnd: 0 = hard bitmap blocks (De Stijl), 1 = rounded blobs (Carson). wt: -1 thin .. 1 heavy (rounded only).
float itGlyph(int ch, vec2 g, float px, float rnd, float wt) {
  vec2 p = vec2(g.x, 1.0 - g.y) * 5.0;
  float f = itField(ch, p, max(mix(px, 1.0, rnd), px));
  float th = 0.5 - wt * 0.28 * rnd;
  float e = max(px * 0.75, 0.015);
  return smoothstep(th - e, th + e, f);
}
// Outline-only letter (thin stroke along the edge).
float itGlyphLine(int ch, vec2 g, float px, float wd) {
  vec2 p = vec2(g.x, 1.0 - g.y) * 5.0;
  float f = itField(ch, p, 1.0);
  float e = max(px * 0.75, 0.015);
  return 1.0 - smoothstep(wd, wd + e * 2.0, abs(f - 0.5));
}

// ---- static noise, paper, print ----
float itN(vec2 x) { return snoise(vec3(x + M_seedOff(), 3.7)); }
float itFbm(vec2 x) { return 0.55 * itN(x) + 0.28 * itN(x * 2.03 + 5.1) + 0.14 * itN(x * 4.1 + 9.7); }
float itPaper(vec2 uv) { return 0.5 * itN(uv * 190.0) + 0.3 * itN(uv * 52.0 + 3.0) + 0.2 * itN(uv * 8.0 + 1.0); }
// Torn-edge displacement for a signed distance.
float itTear(vec2 x) { return itFbm(x) * 0.7 + 0.3 * itN(x * 9.0); }
vec3 itMul(vec3 base, vec3 pig, float a) { return base * mix(vec3(1.0), pig, sat(a)); }
// Round halftone dot screen. tone 0..1, ang radians, cell in uv units. Returns coverage of ink.
float itHalf(vec2 p, float tone, float ang, float cell) {
  vec2 g = fract(rot(ang) * p / cell) - 0.5;
  float r = sqrt(sat(tone)) * 0.72;
  float e = aa() / cell;
  return 1.0 - smoothstep(-e, e, length(g) - r);
}
vec3 itPaperCol() { return u_bg; }
vec3 itPaperDark() { return mix(u_bg, u_ink, 0.12); }
float itLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// Paint splatter: blob with a ragged edge, a drip and flying droplets. Returns coverage.
float itSplat(vec2 p, vec2 c, float r, float sd) {
  vec2 d = p - c; float L = length(d); float a = atan(d.y, d.x);
  float edge = r * (1.0 + 0.32 * snoise(vec3(cos(a) * 1.4 + sd, sin(a) * 1.4 + sd * 0.7, sd)) + 0.18 * sin(a * 7.0 + sd * 5.0));
  float core = 1.0 - smoothstep(edge - aa() * 1.5, edge + aa() * 1.5, L);
  float ang = sd * 2.3;
  vec2 dir = vec2(cos(ang), sin(ang));
  float drip = 1.0 - smoothstep(r * 0.05, r * 0.05 + aa() * 1.5, sdSeg(p, c, c + dir * r * (2.2 + 2.0 * h11(sd))));
  float dr = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float an = sd * 7.0 + fi * 1.13 + h11(sd + fi) * 1.4;
    float di = r * (1.3 + 2.4 * h11(sd * 3.1 + fi));
    float rr = r * (0.05 + 0.15 * h11(sd * 5.3 + fi));
    dr = max(dr, 1.0 - smoothstep(rr - aa(), rr + aa(), length(p - c - vec2(cos(an), sin(an)) * di)));
  }
  return max(max(core, dr), drip);
}

// ---- binary space partition (the De Stijl / Klee / typographic grid) ----
// Splits the frame ext (centred on 0) depth times; split ratios breathe k times per loop (integer k closes the loop).
void itKD(vec2 p, vec2 ext, int depth, float stopP, float wob, float k, float sd, out vec2 lo, out vec2 hi, out float id) {
  lo = -ext * 0.5; hi = ext * 0.5; id = 1.0;
  for (int i = 0; i < 10; i++) {
    if (i >= depth) break;
    vec2 sz = hi - lo;
    float h0 = h21(vec2(id, 11.0 + sd));
    if (i > 1 && h0 < stopP) break;
    float h1 = h21(vec2(id + 3.1, 17.0 + sd));
    float h2 = h21(vec2(id + 7.7, 23.0 + sd));
    bool splitX = sz.x * (0.65 + 0.7 * h1) > sz.y;
    float r = 0.27 + 0.46 * h2 + wob * 0.13 * lsin(k, h1);
    if (splitX) { float s = lo.x + sz.x * r; if (p.x < s) { hi.x = s; id = id * 2.0; } else { lo.x = s; id = id * 2.0 + 1.0; } }
    else { float s = lo.y + sz.y * r; if (p.y < s) { hi.y = s; id = id * 2.0; } else { lo.y = s; id = id * 2.0 + 1.0; } }
  }
}
// Fill colour for a cell id: mostly paper, some primaries, a little black and grey. slot/tfr give limiter-safe re-colouring.
float itNext(float slot, float n) { float r = safeCycles(n); return r < 1.0 ? 0.0 : mod(slot + 1.0, r); }
vec3 itStijlFill(float id, float empty, float slot, float nslot, float tfr, float sd) {
  vec3 cur, nxt;
  float hc = h21(vec2(id, 41.0 + sd + slot * 7.13));
  float hn = h21(vec2(id, 41.0 + sd + nslot * 7.13));
  // palette pick
  for (int j = 0; j < 2; j++) {
    float h = j == 0 ? hc : hn; vec3 c;
    if (h < empty) c = u_bg;
    else {
      float t = (h - empty) / max(1.0 - empty, 1e-3);
      c = t < 0.30 ? u_a0 : t < 0.55 ? u_a1 : t < 0.80 ? u_a2 : t < 0.90 ? u_ink : mix(u_bg, u_ink, 0.35);
    }
    if (j == 0) cur = c; else nxt = c;
  }
  return mix(cur, nxt, smoothstep(0.82, 1.0, tfr));
}
vec3 itNearestPal(vec3 c, float whiteBias) {
  vec3 pal[5]; pal[0] = u_bg; pal[1] = u_a0; pal[2] = u_a1; pal[3] = u_a2; pal[4] = u_ink;
  float best = 1e9; vec3 r = u_bg;
  for (int i = 0; i < 5; i++) {
    vec3 d = c - pal[i]; float s = dot(d, d) * (i == 0 ? 1.0 / max(whiteBias, 0.05) : 1.0);
    if (s < best) { best = s; r = pal[i]; }
  }
  return r;
}
// A stand-in "photograph" used by media styles when nothing is attached: stormy ridges, a sun and a figure-ish block.
vec3 itProc(vec2 uv) {
  float n = itFbm(uv * 1.7);
  float r = 1.0 - abs(itN(uv * 3.2 + n * 1.4));
  vec3 c = mix(u_a2, u_a0, sat(0.5 + n * 0.9));
  c = mix(c, u_a1, smoothstep(0.62, 0.9, r));
  c = mix(c, u_bg, smoothstep(0.86, 1.0, r) * 0.9);
  float disc = length(uv - vec2(0.18, 0.12));
  c = mix(c, u_a1, 1.0 - smoothstep(0.17, 0.175, disc));
  float fig = sdBox(uv - vec2(-0.2, -0.12), vec2(0.07, 0.2 + 0.05 * n));
  c = mix(c, u_ink, 1.0 - smoothstep(0.0, 0.006, fig));
  c = mix(c, u_ink, 1.0 - smoothstep(0.065, 0.068, length(uv - vec2(-0.2, 0.13))));
  return c;
}
