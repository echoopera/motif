// @module noise — loop-safe flow, curl, domain warp and cheap volumetric noise. Every function here closes the loop
// exactly when its cycle count k is an integer (time only enters through u_p via lc/lsaw).
// @requires

// Frame index at a nominal fps that still loops: N = round(u_L * fps) frames per loop. Use for grain, boil, on-twos.
float am_frames(float fps) { return max(1.0, floor(u_L * fps + 0.5)); }
float am_frame(float fps) { float n = am_frames(fps); return mod(floor(fract(u_p) * n), n); }
// Interleaved gradient noise (Jimenez 2014): the best cheap per-pixel dither for raymarch jitter and banding.
float am_ign(vec2 fc) { return fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715)))); }
float am_ignT(vec2 fc, float fps) { return am_ign(fc + 5.588238 * am_frame(fps)); }

// Value noise from the seeded prelude hash; smooth C2 interpolation.
float am_vnoise(vec2 x) {
  vec2 i = floor(x), f = fract(x); vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y) * 2.0 - 1.0;
}

// Curl of looping simplex noise: divergence-free 2D flow (smoke, ink, silk). Magnitude ~1.
vec2 am_curl(vec2 x, float k, float r) {
  const float e = 0.03;
  float n1 = ln2(x + vec2(0.0, e), k, r), n2 = ln2(x - vec2(0.0, e), k, r);
  float n3 = ln2(x + vec2(e, 0.0), k, r), n4 = ln2(x - vec2(e, 0.0), k, r);
  return vec2(n1 - n2, n4 - n3) / (2.0 * e) * 0.25;
}
// Multi-octave curl (oct <= 4).
vec2 am_curlFbm(vec2 x, int oct, float k, float r) {
  vec2 s = vec2(0.0); float a = 1.0;
  for (int i = 0; i < 4; i++) { if (i >= oct) break; s += a * am_curl(x, k, r); x = x * 2.03 + 3.7; a *= 0.5; }
  return s;
}
// Quílez two-level domain warp on looping fBm. Returns the warped field (~-1..1); q and w expose the warp
// vectors, which make excellent colour drivers (colour by q, w and the field for silk / marble / aurora).
float am_warp(vec2 x, int oct, float k, float r, float amt, out vec2 q, out vec2 w) {
  q = vec2(lfbm(x, oct, k, r), lfbm(x + vec2(5.2, 1.3), oct, k, r));
  w = vec2(lfbm(x + amt * q + vec2(1.7, 9.2), oct, k, r), lfbm(x + amt * q + vec2(8.3, 2.8), oct, k, r));
  return lfbm(x + amt * w, oct, k, r);
}
// Flow-map advection that loops: two phases half a cycle apart, crossfaded so neither reset is visible.
// Returns (t0, t1, w0); sample at uv - flow * t0 * s and uv - flow * t1 * s, blend with w0 / 1 - w0.
vec3 am_flowPhases(float k) { float t0 = lsaw(k, 0.0), t1 = lsaw(k, 0.5); return vec3(t0 - 0.5, t1 - 0.5, abs(1.0 - 2.0 * t0)); }

// Cheap looping volumetric noise for raymarchers: rotated sine octaves (gyroid family), ~10x cheaper than simplex.
// The field drifts around a circle of radius r k times per loop.
float am_gyroid(vec3 p) { return dot(sin(p), cos(p.yzx)); }
float am_sinFbm3(vec3 p, int oct, float k, float r) {
  vec2 c = r * lc(k, 0.0); p += vec3(c.x, c.y, c.x * 0.5);
  float s = 0.0, a = 0.5;
  const mat3 m = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
  for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * am_gyroid(p); p = m * p * 2.03 + 1.3; a *= 0.5; }
  return s;
}

// Looping water caustics (iterated warp, after Dave Hoskins / joltz0r's "tileable water caustic").
// Returns ~0..1 brightness; feed it a slight per-channel offset for dispersion.
float am_caustic(vec2 uv, int iter, float k, float sharp) {
  vec2 p = mod(uv * TAU, TAU) - 250.0; vec2 i = p; float c = 1.0; const float inten = 0.005;
  for (int n = 0; n < 6; n++) {
    if (n >= iter) break;
    vec2 t = lc(k, float(n) * 0.13) * (1.0 - 0.35 * float(n) / 6.0);
    i = p + vec2(cos(t.x * 3.0 - i.x) + sin(t.y * 3.0 + i.y), sin(t.y * 3.0 - i.y) + cos(t.x * 3.0 + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t.x) / inten), p.y / (cos(i.y + t.y) / inten)));
  }
  c /= float(iter); c = 1.17 - pow(c, 1.4);
  return pow(abs(c), sharp);
}

// Hash-free star field: one candidate star per cell, loop-safe twinkle at integer rates. Returns radiance.
vec3 am_stars(vec2 uv, float density, float size, float twinkle) {
  vec3 col = vec3(0.0);
  for (int l = 0; l < 2; l++) {
    vec2 g = uv * density * (1.0 + float(l) * 1.7); vec2 id = floor(g), f = fract(g) - 0.5;
    vec3 h = h33(vec3(id, float(l) + 3.1));
    vec2 o = (h.xy - 0.5) * 0.7; float d = length(f - o);
    float m = pow(h.z, 9.0);
    float tw = 1.0 + twinkle * sin(TAU * (floor(1.0 + h.x * 3.0) * u_p + h.y));
    float s = size * (0.5 + m); // radius in cell units
    col += bb(3500.0 + 8500.0 * h.y) * (0.15 + m * 3.0) * tw * (gauss1(d, 0.035 * s) + 0.06 * glow2(d, 0.02 * s));
  }
  return col;
}
