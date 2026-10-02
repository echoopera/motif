// DataInk — shared helpers. A tiny bitmap type system (letters + digits) so shaders can print the numbers they draw,
// a looped data generator, hairlines, sequential ramps. Time only enters through u_p with integer frequencies.

const uint IT_FONT[36] = uint[36](15269425u,32045630u,16269839u,32032318u,33061407u,33061392u,16272943u,18415153u,32641183u,7408204u,18444881u,17318431u,18732593u,18667121u,15255086u,32045584u,15255151u,32045649u,16267326u,32641156u,18400814u,18400580u,18405233u,18157905u,18157700u,32575775u,15324974u,4591758u,15243551u,31504446u,19496002u,33060926u,15235630u,32575752u,15252014u,15252526u);
const int DX_CH[189] = int[189](15,0,17,8,18,11,24,14,13,3,8,9,14,13,12,0,2,14,13,19,14,20,17,18,13,0,13,19,4,18,11,8,11,11,4,13,8,2,4,2,4,13,19,17,0,11,13,14,17,19,7,7,0,17,1,14,17,12,0,17,10,4,19,6,0,17,3,4,13,17,14,24,0,11,2,0,13,0,11,14,17,2,7,0,17,3,0,11,15,7,0,1,4,19,0,6,0,12,12,0,3,4,11,19,0,4,15,18,8,11,14,13,25,4,19,0,4,19,0,19,7,4,19,0,2,14,15,15,4,17,6,17,0,15,7,8,19,4,18,8,11,21,4,17,8,17,14,13,25,8,13,2,13,8,2,10,4,11,19,8,13,11,4,0,3,9,0,13,5,4,1,12,0,17,0,15,17,12,0,24,9,20,13,9,20,11,0,20,6);
const int DX_OFF[40] = int[40](0,5,9,14,19,24,30,35,39,46,51,57,63,69,74,79,86,91,95,100,105,112,116,119,124,130,138,144,148,152,158,161,165,168,171,174,177,180,183,186);
const int DX_LEN[40] = int[40](5,4,5,5,5,6,5,4,7,5,6,6,6,5,5,7,5,4,5,5,7,4,3,5,6,8,6,4,4,6,3,4,3,3,3,3,3,3,3,3);


float itBit(int ch, int x, int y) {
  if (ch < 0 || ch > 35 || x < 0 || x > 4 || y < 0 || y > 4) return 0.0;
  return float((IT_FONT[ch] >> uint(24 - (y * 5 + x))) & 1u);
}
float itField(int ch, vec2 p, float w) {
  vec2 q = p - 0.5; vec2 i = floor(q); vec2 f = clamp((q - i - 0.5) / w + 0.5, 0.0, 1.0);
  int ix = int(i.x), iy = int(i.y);
  float a = itBit(ch, ix, iy), b = itBit(ch, ix + 1, iy), c = itBit(ch, ix, iy + 1), d = itBit(ch, ix + 1, iy + 1);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
// g: 0..1 over the glyph box (y up). px: glyph units per screen pixel. rnd: 0 hard blocks .. 1 soft.
float itGlyph(int ch, vec2 g, float px, float rnd, float wt) {
  vec2 p = vec2(g.x, 1.0 - g.y) * 5.0;
  float f = itField(ch, p, max(mix(px, 1.0, rnd), px));
  float th = 0.5 - wt * 0.28 * rnd;
  float e = max(px * 0.75, 0.015);
  return smoothstep(th - e, th + e, f);
}
float itN(vec2 x) { return snoise(vec3(x + M_seedOff(), 3.7)); }
float itFbm(vec2 x) { return 0.55 * itN(x) + 0.28 * itN(x * 2.03 + 5.1) + 0.14 * itN(x * 4.1 + 9.7); }
float itPaper(vec2 uv) { return 0.5 * itN(uv * 190.0) + 0.3 * itN(uv * 52.0 + 3.0) + 0.2 * itN(uv * 8.0 + 1.0); }
float itLum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// ---- text: height h in uv units, baseline-left origin o. Advance is 0.9 heights; glyph box is 0.8 wide. ----
float dxChar(vec2 p, vec2 o, float h, int ch, float rnd) {
  vec2 g = (p - o) / h;
  if (g.y < -0.05 || g.y > 1.05 || g.x < -0.05 || g.x > 0.85) return 0.0;
  return itGlyph(ch, vec2(g.x / 0.8, g.y), 5.0 * aa() / h, rnd, 0.0);
}
// Integer 0..9999. Returns coverage; width via dxNumW.
float dxNumW(float v) { float a = floor(abs(v) + 0.5); return (a >= 1000.0 ? 4.0 : a >= 100.0 ? 3.0 : a >= 10.0 ? 2.0 : 1.0) * 0.9; }
float dxNum(vec2 p, vec2 o, float h, float v, float rnd) {
  float a = clamp(floor(abs(v) + 0.5), 0.0, 9999.0);
  int iv = int(a);
  int n = a >= 1000.0 ? 4 : a >= 100.0 ? 3 : a >= 10.0 ? 2 : 1;
  vec2 g = (p - o) / h;
  if (g.y < -0.05 || g.y > 1.05 || g.x < -0.05 || g.x > float(n) * 0.9) return 0.0;
  int k = clamp(int(floor(g.x / 0.9)), 0, n - 1);
  int pw = 1; for (int i = 0; i < 3; i++) { if (i >= n - 1 - k) break; pw *= 10; }
  int d = (iv / pw) % 10;
  vec2 l = vec2((g.x - float(k) * 0.9) / 0.8, g.y);
  if (l.x < -0.05 || l.x > 1.05) return 0.0;
  return itGlyph(26 + d, l, 5.0 * aa() / h, rnd, 0.0);
}
// A signed integer: minus sign as a short bar.
float dxNumS(vec2 p, vec2 o, float h, float v, float rnd) {
  if (v < -0.5) {
    vec2 g = (p - o) / h;
    float bar = (1.0 - smoothstep(0.0, aa() / h * 1.2, abs(g.y - 0.5) - 0.07)) * step(0.05, g.x) * step(g.x, 0.6);
    return max(bar, dxNum(p, o + vec2(0.9 * h, 0.0), h, v, rnd));
  }
  return dxNum(p, o, h, v, rnd);
}
int dxNameLen(int set, int i) { return DX_LEN[clamp(set, 0, 4) * 8 + (((i % 8) + 8) % 8)]; }
float dxNameW(int set, int i) { return float(dxNameLen(set, i)) * 0.9; }
float dxName(vec2 p, vec2 o, float h, int set, int i, float rnd) {
  vec2 g = (p - o) / h;
  int n = dxNameLen(set, i);
  if (g.y < -0.05 || g.y > 1.05 || g.x < -0.05 || g.x > float(n) * 0.9) return 0.0;
  int k = clamp(int(floor(g.x / 0.9)), 0, n - 1);
  int idx = clamp(set, 0, 4) * 8 + (((i % 8) + 8) % 8);
  int ch = DX_CH[DX_OFF[idx] + k];
  vec2 l = vec2((g.x - float(k) * 0.9) / 0.8, g.y);
  if (l.x < -0.05 || l.x > 1.05) return 0.0;
  return itGlyph(ch, l, 5.0 * aa() / h, rnd, 0.0);
}

// ---- drawing ----
float dxHair(float d, float w) { return 1.0 - smoothstep(w * 0.5, w * 0.5 + aa() * 1.2, d); }
float dxDot(vec2 p, vec2 c, float r) { return 1.0 - smoothstep(r - aa(), r + aa(), length(p - c)); }
vec3 dxInk(vec3 under, vec3 c, float a) { return mix(under, c, sat(a)); }
vec3 dxGrey(float t) { return mix(u_bg, u_ink, t); }

// ---- looped data ----
// Series i, position x on a circle (period 1). mode 0 peaks, 1 seasonal waves, 2 trend with swings.
// sway moves features by whole loops so everything returns to frame 0.
float dxData(float i, float x, int mode, float sway, float width) {
  float s = 0.0;
  if (mode == 0) {
    for (int j = 0; j < 3; j++) {
      float fj = float(j);
      float c = h21(vec2(i, fj + 1.0)) + 0.04 * sway * lsin(1.0, h21(vec2(i, fj + 4.0)));
      float w = (0.05 + 0.11 * h21(vec2(i, fj + 7.0))) * width;
      float a = 0.25 + 0.75 * h21(vec2(i, fj + 13.0));
      float d = abs(fract(x - c + 0.5) - 0.5);
      s += a * exp(-d * d / (w * w));
    }
  } else if (mode == 1) {
    float f1 = 1.0 + floor(h21(vec2(i, 2.0)) * 3.0), f2 = 2.0 + floor(h21(vec2(i, 3.0)) * 4.0);
    s = 0.45 + 0.28 * sin(TAU * (f1 * x + h21(vec2(i, 5.0)) + sway * 0.25 * lsin(1.0, i * 0.37))) + 0.17 * sin(TAU * (f2 * x + h21(vec2(i, 6.0))));
  } else {
    float tr = (h21(vec2(i, 9.0)) - 0.35) * 1.4;
    float xx = fract(x);
    s = 0.35 + tr * (xx - 0.5) + 0.22 * sin(TAU * (2.0 * x + h21(vec2(i, 11.0)))) * (0.5 + 0.5 * sway) + 0.1 * sin(TAU * (5.0 * x + h21(vec2(i, 12.0))));
    s *= 1.0 - 0.0;
  }
  return max(s, 0.0);
}
// Sequential ramp: paper -> a (light) -> b (mid) -> c (deep).
vec3 dxSeq(float t, vec3 a, vec3 b, vec3 c) {
  t = sat(t) * 3.0;
  if (t < 1.0) return mix(u_bg, a, t);
  if (t < 2.0) return mix(a, b, t - 1.0);
  return mix(b, c, t - 2.0);
}
