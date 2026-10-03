// AgentMotif library: color, noise, light, post, sdf, motion, field (built by am lib build; edit the kit's own code below the marker)

// ======== color ========
// OKLab (Björn Ottosson 2020). Mix and grade in OKLab: hue-stable gradients, no muddy midpoints.
vec3 am_toOklab(vec3 c) {
  vec3 l = mat3(0.4122214708, 0.2119034982, 0.0883024619, 0.5363325363, 0.6806995451, 0.2817188376, 0.0514459929, 0.1073969566, 0.6299787005) * c;
  l = sign(l) * pow(abs(l), vec3(1.0 / 3.0));
  return mat3(0.2104542553, 1.9779984951, 0.0259040371, 0.7936177850, -2.4285922050, 0.7827717662, -0.0040720468, 0.4505937099, -0.8086757660) * l;
}
vec3 am_fromOklab(vec3 c) {
  vec3 l = mat3(1.0, 1.0, 1.0, 0.3963377774, -0.1055613458, -0.0894841775, 0.2158037573, -0.0638541728, -1.2914855480) * c;
  l = l * l * l;
  return mat3(4.0767416621, -1.2684380046, -0.0041960863, -3.3077115913, 2.6097574011, -0.7034186147, 0.2309699292, -0.3413193965, 1.7076147010) * l;
}
vec3 am_mixOk(vec3 a, vec3 b, float t) { return am_fromOklab(mix(am_toOklab(a), am_toOklab(b), t)); }
// OKLCh: (L, C, h radians)
vec3 am_toOklch(vec3 c) { vec3 o = am_toOklab(c); return vec3(o.x, length(o.yz), atan(o.z, o.y)); }
vec3 am_fromOklch(vec3 c) { return am_fromOklab(vec3(c.x, c.y * cos(c.z), c.y * sin(c.z))); }
vec3 am_hueShift(vec3 c, float rad) { vec3 l = am_toOklch(max(c, 0.0)); l.z += rad; return max(am_fromOklch(l), 0.0); }
vec3 am_saturate(vec3 c, float s) { vec3 o = am_toOklab(max(c, 0.0)); o.yz *= s; return max(am_fromOklab(o), 0.0); }
// Ramp through the five palette colours in OKLab (bg -> a2 -> a0 -> a1 -> ink), the perceptual twin of ramp().
vec3 am_rampOk(float t) {
  t = sat(t) * 4.0;
  if (t < 1.0) return am_mixOk(u_bg, u_a2, t);
  if (t < 2.0) return am_mixOk(u_a2, u_a0, t - 1.0);
  if (t < 3.0) return am_mixOk(u_a0, u_a1, t - 2.0);
  return am_mixOk(u_a1, u_ink, t - 3.0);
}
// Accent-only cyclic ramp a0 -> a1 -> a2 -> a0 (for hue-cycling content that must stay on palette).
vec3 am_accentLoop(float t) { t = fract(t) * 3.0; return t < 1.0 ? am_mixOk(u_a0, u_a1, t) : t < 2.0 ? am_mixOk(u_a1, u_a2, t - 1.0) : am_mixOk(u_a2, u_a0, t - 2.0); }
// Cosine palette (Quílez). Fit a, b, c, d to a reference with the tune tool when the palette is not enough.
vec3 am_cosPal(float t, vec3 a, vec3 b, vec3 c, vec3 d) { return a + b * cos(TAU * (c * t + d)); }

// ---- tone mapping (HDR linear -> display linear 0..1) ----
// AgX (Sobotka; polynomial fit by bwrensch / three.js). Filmic, hue-preserving highlight roll-off: the default.
vec3 am_agxCurve(vec3 x) { vec3 x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; }
vec3 am_agx(vec3 c, float look) { // look: 0 base, 1 punchy
  const mat3 inM = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 outM = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  c = inM * max(c, 0.0);
  c = clamp((log2(max(c, 1e-10)) + 12.47393) / 16.5, 0.0, 1.0);
  c = am_agxCurve(c);
  if (look > 0.0) { vec3 p = pow(max(c, 0.0), vec3(1.35)); vec3 pl = mix(c, p, look); c = mix(vec3(luma(pl)), pl, 1.0 + 0.4 * look); }
  c = outM * c;
  return clamp(pow(max(c, 0.0), vec3(2.2)), 0.0, 1.0);
}
// Khronos PBR Neutral: keeps base colours accurate (product shots, brand colours), soft shoulder.
vec3 am_neutral(vec3 c) {
  const float s = 0.8 - 0.04, d = 0.15; float x = min(c.r, min(c.g, c.b)); float o = x < 0.08 ? x - 6.25 * x * x : 0.04; c -= o;
  float p = max(c.r, max(c.g, c.b)); if (p < s) return c;
  float d2 = 1.0 - s; float np = 1.0 - d2 * d2 / (p + d2 - s); c *= np / p; float g = 1.0 - 1.0 / (d * (p - np) + 1.0); return mix(c, vec3(np), g);
}
// Exposure in stops, then tone map. mode 0 AgX, 1 AgX punchy, 2 Neutral, 3 ACES (prelude).
vec3 am_tonemap(vec3 c, float stops, int mode) {
  c *= exp2(stops);
  if (mode == 0) return am_agx(c, 0.0);
  if (mode == 1) return am_agx(c, 1.0);
  if (mode == 2) return am_neutral(c);
  return aces(c);
}
// Lift/gamma/gain grade in linear (ASC-CDL-like), plus split-tone toward shadow/highlight tints.
vec3 am_grade(vec3 c, vec3 lift, vec3 gamma, vec3 gain) { c = max(c * gain + lift * (1.0 - c), 0.0); return pow(c, 1.0 / max(gamma, vec3(0.05))); }
vec3 am_splitTone(vec3 c, vec3 shadow, vec3 high, float amt) { float l = sat(luma(c) * 1.4); return c * mix(mix(vec3(1.0), shadow * 1.6, amt * (1.0 - l)), high * 1.6, amt * l * 0.5); }
// Display-referred contrast around 0.18 grey in log space (no clipping).
vec3 am_contrast(vec3 c, float k) { vec3 l = log2(max(c, 1e-5) / 0.18); return 0.18 * exp2(l * k); }

// ======== noise ========
// exactly when its cycle count k is an integer (time only enters through u_p via lc/lsaw).

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

// ======== light ========
// thin-film iridescence, spectral dispersion, subsurface wrap and sheen. Radiance out is HDR linear: tone map it.

float am_pow5(float x) { float x2 = x * x; return x2 * x2 * x; }
vec3 am_fresnel(vec3 f0, float cosT) { return f0 + (1.0 - f0) * am_pow5(1.0 - sat(cosT)); }
float am_fresnelF(float f0, float cosT) { return f0 + (1.0 - f0) * am_pow5(1.0 - sat(cosT)); }
float am_ggxD(float nh, float a) { float a2 = a * a; float d = nh * nh * (a2 - 1.0) + 1.0; return a2 / (PI * d * d); }
float am_smithV(float nv, float nl, float a) { float a2 = a * a; float gv = nl * sqrt(nv * nv * (1.0 - a2) + a2), gl = nv * sqrt(nl * nl * (1.0 - a2) + a2); return 0.5 / max(gv + gl, 1e-5); }
// Direct light: Cook-Torrance GGX + Lambert (energy split by metalness). rough is perceptual (squared inside).
vec3 am_brdf(vec3 n, vec3 v, vec3 l, vec3 albedo, float metal, float rough) {
  vec3 h = normalize(v + l); float nl = sat(dot(n, l)), nv = max(dot(n, v), 1e-4), nh = sat(dot(n, h)), vh = sat(dot(v, h));
  float a = max(rough * rough, 0.002); vec3 f0 = mix(vec3(0.04), albedo, metal); vec3 F = am_fresnel(f0, vh);
  vec3 spec = F * am_ggxD(nh, a) * am_smithV(nv, nl, a);
  vec3 diff = (1.0 - F) * (1.0 - metal) * albedo / PI;
  return (diff + spec) * nl;
}
// Split-sum environment BRDF, analytic fit (Karis / Lazarov). Multiply prefiltered env radiance by this.
vec3 am_envBRDF(vec3 f0, float rough, float nv) {
  const vec4 c0 = vec4(-1.0, -0.0275, -0.572, 0.022), c1 = vec4(1.0, 0.0425, 1.04, -0.04);
  vec4 r = rough * c0 + c1; float a004 = min(r.x * r.x, exp2(-9.28 * nv)) * r.x + r.y; vec2 ab = vec2(-1.04, 1.04) * a004 + r.zw;
  return f0 * ab.x + ab.y;
}
// Procedural photo studio (the secret of convincing chrome and glass): dark cyclorama, large overhead key,
// two vertical strip lights and a warm kicker. soft 0..1 widens every edge (use roughness to "prefilter").
// spin rotates the studio (radians) — animate it with an integer number of turns per loop for moving reflections.
float am_box(float x, float a, float b, float s) { return smoothstep(a - s, a + s, x) * (1.0 - smoothstep(b - s, b + s, x)); }
vec3 am_studio(vec3 d, float spin, float soft, vec3 keyCol, vec3 rimCol) {
  d.xz = rot(spin) * d.xz;
  float y = d.y, ph = atan(d.z, d.x); float s = 0.015 + soft * 0.35;
  vec3 c = mix(vec3(0.010, 0.010, 0.012), vec3(0.045, 0.047, 0.055), smoothstep(-0.4, 0.6, y));
  c += vec3(0.25) * exp(-abs(y) * 18.0 / (1.0 + soft * 6.0)) * 0.35;            // horizon line
  float key = am_box(d.x, -0.45, 0.45, s) * am_box(d.z, -0.3, 0.55, s) * step(0.0, y) * smoothstep(0.55 - s, 0.75 + s, y);
  c += keyCol * key * 7.0;
  float strip1 = am_box(ph, 0.35, 0.52, s * 0.7) * am_box(y, -0.25, 0.55, s);
  float strip2 = am_box(ph, 2.55, 2.68, s * 0.7) * am_box(y, -0.15, 0.45, s);
  c += rimCol * (strip1 * 5.0 + strip2 * 3.5);
  float kick = am_box(ph, -1.9, -1.2, s * 1.4) * am_box(y, -0.08, 0.18, s);
  c += vec3(1.0, 0.62, 0.32) * kick * 2.2;
  return c;
}
// Thin-film interference (soap, oil, anodised metal, holographic foil). cosT: view angle cosine,
// thick: film thickness in nm (200..900), ior: film IOR (1.2..1.6). Returns reflectance tint (0..~1.5).
vec3 am_thinFilm(float cosT, float thick, float ior) {
  float sinT2 = (1.0 - cosT * cosT) / (ior * ior); float cosF = sqrt(max(1.0 - sinT2, 0.0));
  float opd = 2.0 * ior * thick * cosF; // optical path difference, nm
  vec3 lam = vec3(650.0, 532.0, 450.0);
  vec3 ph = TAU * opd / lam;
  return 0.5 + 0.5 * cos(ph + PI); // phase flip at the top interface
}
// Spectral weight of a wavelength sample w in 0..1 (0 = violet, 1 = red); sums to roughly white over uniform w.
vec3 am_spectrum(float w) {
  vec3 c = sat(1.0 - abs((vec3(w) - vec3(0.80, 0.52, 0.22)) * vec3(2.9, 3.3, 2.7)));
  return c * c * (3.0 - 2.0 * c) * vec3(1.05, 1.0, 1.15);
}
// Wrapped diffuse for cheap subsurface (skin, wax, jade): w 0..1 wrap, tinted by scatter colour.
vec3 am_wrapDiffuse(float nl, float w, vec3 scatter) { float d = sat((nl + w) / (1.0 + w)); return mix(scatter * d, vec3(sat(nl)), sat(nl)); }
// Charlie sheen (velvet, fabric, peach fuzz).
float am_sheen(float nh, float rough) { float inv = 1.0 / max(rough, 0.05); float s = sqrt(max(1.0 - nh * nh, 0.0)); return (2.0 + inv) * pow(s, inv) / TAU; }
// Henyey-Greenstein phase for volumes (g > 0 forward scatter: god rays, fog toward the sun).
float am_hg(float cosT, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(max(1.0 + g2 - 2.0 * g * cosT, 1e-4), 1.5)); }

// ======== post ========
// chromatic aberration, lens distortion, bokeh blur, painterly filters, sharpening, vignette and film grain.
// Functions take any sampler2D (u_buf0..3 or a media input) and frame-normalised q = fc / u_res.
// Intermediate passes are linear HDR (RGBA16F where available), so bloom thresholds above 1.0 work.

// Soft-knee bright pass (threshold t, knee k): keeps bloom from outlining mid-tones.
vec3 am_bright(vec3 c, float t, float k) { float br = max(c.r, max(c.g, c.b)); float rq = clamp(br - t + k, 0.0, 2.0 * k); rq = rq * rq / (4.0 * k + 1e-5); return c * max(rq, br - t) / max(br, 1e-5); }
// Wide, smooth bloom in one pass: 3 rings x 8 taps + centre at radii r, 2.5r, 6r texels of the source buffer.
// Read a scale 0.25–0.5 buffer for a cheap, very wide glow. Returns the blurred HDR radiance.
vec3 am_bloom(sampler2D b, vec2 q, float r) {
  vec2 px = r / vec2(textureSize(b, 0)); vec3 s = texture(b, q).rgb * 0.5; float w = 0.5;
  for (int ring = 0; ring < 3; ring++) {
    float rr = ring == 0 ? 1.0 : ring == 1 ? 2.5 : 6.0; float ww = ring == 0 ? 1.0 : ring == 1 ? 0.7 : 0.45;
    for (int i = 0; i < 8; i++) { float a = (float(i) + 0.5 * float(ring)) * (TAU / 8.0); s += texture(b, q + vec2(cos(a), sin(a)) * px * rr).rgb * ww; w += ww; }
  }
  return s / w;
}
// Film halation: highlights bleed red-orange through the emulsion. Feed it the bloom result.
vec3 am_halation(vec3 bloom, float amt) { return bloom * vec3(1.0, 0.36, 0.12) * amt; }
// Anamorphic streak: long horizontal flare from highlights (tint it with a palette accent).
vec3 am_streak(sampler2D b, vec2 q, float len, float t) {
  vec2 px = vec2(1.0 / float(textureSize(b, 0).x), 0.0); vec3 s = vec3(0.0); float w = 0.0;
  for (int i = -12; i <= 12; i++) { float f = float(i) / 12.0; float ww = exp(-f * f * 3.0); s += am_bright(texture(b, q + px * f * len * 40.0).rgb, t, 0.3) * ww; w += ww; }
  return s / w;
}
// Radial chromatic aberration with N spectral taps (N 3..12; 3 = classic RGB split).
vec3 am_ca(sampler2D b, vec2 q, float amt, int n) {
  vec2 d = (q - 0.5) * amt; vec3 s = vec3(0.0), w = vec3(0.0);
  for (int i = 0; i < 12; i++) { if (i >= n) break; float t = (float(i) + 0.5) / float(n); vec3 sp = am_spectrum(t); s += texture(b, q - d * (t - 0.5)).rgb * sp; w += sp; }
  return s / max(w, 1e-4);
}
// Brown–Conrady style barrel (k > 0) / pincushion (k < 0) distortion on q.
vec2 am_barrel(vec2 q, float k, float asp) { vec2 c = (q - 0.5) * vec2(asp, 1.0); float r2 = dot(c, c); c *= 1.0 + k * r2; return c / vec2(asp, 1.0) + 0.5; }
// Golden-angle disc blur (bokeh); 32 taps, radius in pixels of the source. Highlights bloom into discs.
vec3 am_bokeh(sampler2D b, vec2 q, float radius) {
  vec2 px = radius / vec2(textureSize(b, 0)); vec3 s = vec3(0.0), w = vec3(0.0);
  for (int i = 0; i < 32; i++) { float r = sqrt((float(i) + 0.5) / 32.0); float a = float(i) * 2.39996323; vec3 c = texture(b, q + vec2(cos(a), sin(a)) * r * px).rgb; vec3 ww = 1.0 + c * c * 0.4; s += c * ww; w += ww; }
  return s / w;
}
// Contrast-adaptive sharpening (AMD FidelityFX CAS, simplified). amt 0..1.
vec3 am_cas(sampler2D b, vec2 q, float amt) {
  vec2 px = 1.0 / vec2(textureSize(b, 0));
  vec3 e = texture(b, q).rgb, n = texture(b, q + vec2(0, px.y)).rgb, s = texture(b, q - vec2(0, px.y)).rgb, w = texture(b, q - vec2(px.x, 0)).rgb, ea = texture(b, q + vec2(px.x, 0)).rgb;
  vec3 mn = min(e, min(min(n, s), min(w, ea))), mx = max(e, max(max(n, s), max(w, ea)));
  vec3 k = sqrt(sat(min(mn, 2.0 - mx) / max(mx, 1e-4))) * -mix(0.125, 0.2, amt);
  return max((e + (n + s + w + ea) * k) / (1.0 + 4.0 * k), 0.0);
}
// Generalised Kuwahara (4 sectors, Papari-style weights): turns photos into painted strokes with crisp edges.
// radius in source pixels (2..10).
vec3 am_kuwahara(sampler2D b, vec2 q, float radius) {
  vec2 px = radius / vec2(textureSize(b, 0)) / 3.0;
  vec3 m[4]; vec3 s2[4];
  for (int k = 0; k < 4; k++) { m[k] = vec3(0.0); s2[k] = vec3(0.0); }
  for (int j = -3; j <= 3; j++) for (int i = -3; i <= 3; i++) {
    vec3 c = texture(b, q + vec2(i, j) * px).rgb; vec3 c2 = c * c;
    if (i <= 0 && j <= 0) { m[0] += c; s2[0] += c2; }
    if (i >= 0 && j <= 0) { m[1] += c; s2[1] += c2; }
    if (i <= 0 && j >= 0) { m[2] += c; s2[2] += c2; }
    if (i >= 0 && j >= 0) { m[3] += c; s2[3] += c2; }
  }
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int k = 0; k < 4; k++) { m[k] /= 16.0; vec3 v = abs(s2[k] / 16.0 - m[k] * m[k]); float sg = v.r + v.g + v.b; float w = 1.0 / (1.0 + pow(sg * 600.0, 4.0)); acc += m[k] * w; wsum += w; }
  return acc / max(wsum, 1e-5);
}
// Sobel luminance gradient of any sampler (structure tensor input for flow-aligned strokes).
vec2 am_sobel(sampler2D b, vec2 q, float r) {
  vec2 px = r / vec2(textureSize(b, 0));
  float tl = luma(texture(b, q + px * vec2(-1, 1)).rgb), t = luma(texture(b, q + px * vec2(0, 1)).rgb), tr = luma(texture(b, q + px * vec2(1, 1)).rgb);
  float l = luma(texture(b, q + px * vec2(-1, 0)).rgb), rr = luma(texture(b, q + px * vec2(1, 0)).rgb);
  float bl = luma(texture(b, q + px * vec2(-1, -1)).rgb), bt = luma(texture(b, q + px * vec2(0, -1)).rgb), br = luma(texture(b, q + px * vec2(1, -1)).rgb);
  return vec2(tr + 2.0 * rr + br - tl - 2.0 * l - bl, tl + 2.0 * t + tr - bl - 2.0 * bt - br);
}
// Natural (cos^4) vignette; amt 0..1, uv as motif() receives it.
float am_vignette(vec2 uv, float amt) { float r = length(uv * vec2(0.9, 1.0)) * 1.35; float c = cos(min(r * amt, 1.5)); return c * c * c * c; }
// Film grain: luma-weighted (strongest in mid-tones, like silver halide), changes at 24 fps and loops exactly.
vec3 am_grain(vec3 c, vec2 fc, float amt, float size) {
  vec2 g = floor(fc / max(size, 1.0)); float f = am_frame(24.0);
  vec3 n = h33(vec3(g, f)) - 0.5; n = mix(vec3(n.r), n, 0.25);
  float l = sqrt(sat(luma(c))); float w = 4.0 * l * (1.0 - l) + 0.15;
  return max(c + n * amt * w * 0.12, 0.0);
}

// ======== sdf ========
// GLSL ES has no function pointers, so the march/normal/shadow/AO helpers are macros over your scene function
// name. Your scene function must have the signature `float NAME(vec3 p)` (or return .x of a vec2 via a wrapper).

// ---- 2D ----
float am_sdCircle(vec2 p, float r) { return length(p) - r; }
float am_sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float am_sdHex(vec2 p, float r) { const vec3 k = vec3(-0.866025404, 0.5, 0.577350269); p = abs(p); p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy; p -= vec2(clamp(p.x, -k.z * r, k.z * r), r); return length(p) * sign(p.y); }
float am_sdStar(vec2 p, float r, int n, float m) { // n points, m in 2..n inner sharpness (Quílez)
  float an = PI / float(n), en = PI / m; vec2 acs = vec2(cos(an), sin(an)), ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an; p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs; p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y); return length(p) * sign(p.x);
}
// Polar repeat: n copies around the origin (kaleidoscopes, mandalas, radial mograph).
vec2 am_polarRep(vec2 p, float n) { float a = TAU / n; float t = atan(p.y, p.x) + a * 0.5; t = mod(t, a) - a * 0.5; return length(p) * vec2(cos(t), sin(t)); }
vec2 am_kaleido(vec2 p, float n) { p = am_polarRep(p, n); p.y = abs(p.y); return p; }
// Hex grid: returns (local xy, cell id xy).
vec4 am_hexGrid(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy) : vec4(h.zw, c.zw + 0.5);
}

// ---- 3D ----
float am_sdSphere(vec3 p, float r) { return length(p) - r; }
float am_sdRoundBox3(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float am_sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = sat(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h) - r; }
float am_sdOcta(vec3 p, float s) { p = abs(p); return (p.x + p.y + p.z - s) * 0.57735027; }
// Gyroid sheet as a CONSERVATIVE bound (class: bound). |grad g| <= sqrt(6) for g = sin.cos sums, so dividing by
// scale * sqrt(6) never overshoots the zero set. (The raw gyroid is only an implicit function, not a distance.)
float am_sdGyroidShell(vec3 p, float scale, float thick) { p *= scale; return (abs(dot(sin(p), cos(p.yzx))) - thick) / (scale * 2.4494897); }
// Smooth boolean with a blend factor for colour/material mixing: returns (d, h) where h = 0 -> a, 1 -> b.
vec2 am_sminH(float a, float b, float k) { float h = sat(0.5 + 0.5 * (b - a) / k); return vec2(mix(b, a, h) - k * h * (1.0 - h), 1.0 - h); }
float am_smin3(float a, float b, float k) { k *= 6.0; float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * h * k * (1.0 / 6.0); } // cubic, C2
// Twist and bend are not isometries: they stretch space by up to L = sqrt(1 + (k * r)^2) at radius r from the axis.
// Divide the deformed distance by that L (am_twistLip) or the result is no longer a bound.
float am_twistLip(float k, float rmax) { return sqrt(1.0 + k * k * rmax * rmax); }
vec3 am_twist(vec3 p, float k) { float c = cos(k * p.y), s = sin(k * p.y); return vec3(mat2(c, -s, s, c) * p.xz, p.y).xzy; }
vec3 am_bend(vec3 p, float k) { float c = cos(k * p.x), s = sin(k * p.x); return vec3(mat2(c, -s, s, c) * p.xy, p.z); }
vec3 am_repLim(vec3 p, float s, vec3 l) { return p - s * clamp(floor(p / s + 0.5), -l, l); }

// ---- camera ----
// Look-at camera: returns ray direction for uv with focal length f (≈ 1.5 normal, 2.5 tele, 0.9 wide).
vec3 am_camRay(vec3 ro, vec3 ta, vec2 uv, float f, float roll) {
  vec3 w = normalize(ta - ro), u = normalize(cross(w, vec3(sin(roll), cos(roll), 0.0))), v = cross(u, w);
  return normalize(uv.x * u + uv.y * v + f * w);
}

// ---- raymarch macros ----
// AM_MARCH(MAP, ro, rd, tmax, STEPS, t, hit): sphere tracing (Hart 1996). Correct ONLY when MAP is class `exact` or
// `bound` (see the field module). The 0.9 factor absorbs float error; it is not a fix for a field that overestimates.
#define AM_MARCH(MAP, RO, RD, TMAX, STEPS, T, HIT) { T = 0.0; HIT = false; for (int i_ = 0; i_ < 256; i_++) { if (i_ >= STEPS) break; float d_ = MAP(RO + RD * T); if (d_ < 0.0005 * T + 0.0005) { HIT = true; break; } T += d_ * 0.9; if (T > TMAX) break; } }
// Tetrahedral normal (4 taps, Quílez).
#define AM_NORMAL(MAP, P) normalize(vec3(1, -1, -1) * MAP(P + vec3(1, -1, -1) * 0.0007) + vec3(-1, -1, 1) * MAP(P + vec3(-1, -1, 1) * 0.0007) + vec3(-1, 1, -1) * MAP(P + vec3(-1, 1, -1) * 0.0007) + vec3(1, 1, 1) * MAP(P + vec3(1, 1, 1) * 0.0007))
// Soft shadow with improved penumbra (Aaltonen / Quílez). RES: result in 0..1, K: hardness (8 soft .. 64 hard).
#define AM_SHADOW(MAP, RO, RD, K, RES) { RES = 1.0; float t_ = 0.02, ph_ = 1e10; for (int i_ = 0; i_ < 40; i_++) { float h_ = MAP(RO + RD * t_); float y_ = h_ * h_ / (2.0 * ph_); float d_ = sqrt(max(h_ * h_ - y_ * y_, 0.0)); RES = min(RES, K * d_ / max(0.0, t_ - y_)); ph_ = h_; t_ += clamp(h_, 0.01, 0.3); if (RES < 0.002 || t_ > 6.0) break; } RES = sat(RES); RES = RES * RES * (3.0 - 2.0 * RES); }
// Ambient occlusion, 5 taps along the normal.
#define AM_AO(MAP, P, N, RES) { float o_ = 0.0, s_ = 1.0; for (int i_ = 0; i_ < 5; i_++) { float h_ = 0.01 + 0.11 * float(i_); o_ += (h_ - MAP(P + N * h_)) * s_; s_ *= 0.85; } RES = sat(1.0 - 2.2 * o_); }

// ======== motion ========
// Everything maps the loop phase u_p (or any 0..1 t) so it stays deterministic and seamless.

// Progress 0..1 of the loop window [a, b] (fractions of the loop). Clamped.
float am_seg(float a, float b) { return sat((fract(u_p) - a) / max(b - a, 1e-5)); }
float am_segT(float t, float a, float b) { return sat((t - a) / max(b - a, 1e-5)); }
// Easing (Penner / CSS equivalents). t 0..1.
float am_easeInOutCubic(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5; }
float am_easeOutExpo(float t) { return t >= 1.0 ? 1.0 : 1.0 - exp2(-10.0 * t); }
float am_easeInExpo(float t) { return t <= 0.0 ? 0.0 : exp2(10.0 * t - 10.0); }
float am_easeInOutExpo(float t) { return t <= 0.0 ? 0.0 : t >= 1.0 ? 1.0 : t < 0.5 ? exp2(20.0 * t - 10.0) * 0.5 : (2.0 - exp2(-20.0 * t + 10.0)) * 0.5; }
float am_easeOutBack(float t, float s) { t -= 1.0; return 1.0 + (s + 1.0) * t * t * t + s * t * t; }
// Cubic-bezier(x1, y1, x2, y2) like CSS/After Effects, solved with 5 Newton steps. Matches the house-style eases:
// am_bezier(t, 0.16, 1.0, 0.3, 1.0) is the default entrance, am_bezier(t, 0.7, 0.0, 0.84, 0.0) the exit.
float am_bezier(float x, float x1, float y1, float x2, float y2) {
  float t = x;
  for (int i = 0; i < 5; i++) {
    float u = 1.0 - t; float bx = 3.0 * u * u * t * x1 + 3.0 * u * t * t * x2 + t * t * t;
    float dx = 3.0 * u * u * x1 + 6.0 * u * t * (x2 - x1) + 3.0 * t * t * (1.0 - x2);
    t = sat(t - (bx - x) / max(dx, 1e-4));
  }
  float u = 1.0 - t; return 3.0 * u * u * t * y1 + 3.0 * u * t * t * y2 + t * t * t;
}
// Damped spring step response (closed form, no state): 0 -> 1 with overshoot. t in seconds since release,
// stiffness k (≈ 100..600) and damping c (≈ 8..40), unit mass. Matches Motif's "snappy (300, 20)".
float am_spring(float t, float k, float c) {
  if (t <= 0.0) return 0.0;
  float w0 = sqrt(k), z = c / (2.0 * w0);
  if (z < 1.0) { float wd = w0 * sqrt(1.0 - z * z); return 1.0 - exp(-z * w0 * t) * (cos(wd * t) + z * w0 / wd * sin(wd * t)); }
  return 1.0 - exp(-w0 * t) * (1.0 + w0 * t);
}
// Spring that fires at loop fraction a and settles back by the loop end: seconds come from u_L.
float am_springAt(float a, float k, float c) { return am_spring((fract(u_p) - a) * u_L, k, c) * (1.0 - am_seg(0.92, 1.0)); }
// Stagger: element i of n starts spread * i / n later. Returns the element's local 0..1 progress for window [a,b].
float am_stagger(float i, float n, float spread, float a, float b) { float off = spread * i / max(n - 1.0, 1.0); return am_seg(a + off * (1.0 - (b - a)), b + off * (1.0 - (b - a))); }
// In / hold / out over the loop: rises over [0, inT], holds, falls over [1 - outT, 1], eased.
float am_inHoldOut(float inT, float outT) { float x = fract(u_p); return am_easeOutExpo(sat(x / inT)) * (1.0 - am_easeInExpo(sat((x - 1.0 + outT) / outT))); }
// Ping-pong 0..1..0 with smooth turnarounds (k round trips per loop).
float am_pingpong(float k) { return 0.5 - 0.5 * cos(TAU * k * u_p); }
float am_framesM(float fps) { return max(1.0, floor(u_L * fps + 0.5)); }
// Hand-drawn "on twos" phase: quantises u_p to fps/2 so motion steps like cel animation (loops exactly).
float am_onTwos(float fps) { float n = am_framesM(fps * 0.5); return floor(fract(u_p) * n) / n; }

// ======== field ========
//
// Every scene function gets a declared FIELD CLASS in a comment above it, and is drawn only by a renderer that
// is valid for that class. Terminology never stands in for evidence.
//   exact     exact signed distance (spheres, boxes, their unions)       -> AM_MARCH (sphere tracing)
//   bound     conservative distance bound, |grad| <= 1 after dividing by L -> AM_MARCH_L (divide by the Lipschitz L)
//   implicit  only the zero set matters; the value is not a distance     -> AM_SEGMENT (fixed steps + bisection)
//   density   non-negative extinction per unit length                    -> AM_VOLUME (absorption / emission)
//   glow      positive heuristic step field (Astral-style)               -> AM_GLOW (named aesthetic renderer)
// Deformations change the class: a fold or twist turns `exact` into `bound` (with a known L) or into `implicit`.

// ---- deformation: the Astral cosine fold --------------------------------------------------------------------
// q <- q + a * (|cos(s * q.yzx + phase)| - b) / s, then s <- s * lac, for `layers` octaves.
// Lipschitz of the map: each layer adds at most a (|d/dq| of |cos| times s / s), so L <= (1 + a)^layers.
// Pass phase as TAU * k * u_p with integer k (loop rule). a 0.2..1.2, s0 1..4, lac 1.4..2.2, b ~0.5.
vec3 am_cosFold(vec3 q, float a, float s0, float lac, float b, float phase, int layers) {
  float s = s0;
  for (int i = 0; i < 8; i++) {
    if (i >= layers) break;
    q += a * (abs(cos(s * q.yzx + phase + float(i) * 1.7)) - b) / s;
    s *= lac;
  }
  return q;
}
float am_cosFoldLip(float a, int layers) { return pow(1.0 + a, float(layers)); }

// ---- renderers --------------------------------------------------------------------------------------------
// Sphere tracing for `bound` fields with Lipschitz constant LIP (> = 1). Same outputs as AM_MARCH.
#define AM_MARCH_L(MAP, RO, RD, TMAX, STEPS, LIP, T, HIT) { T = 0.0; HIT = false; float il_ = 1.0 / max(LIP, 1.0); for (int i_ = 0; i_ < 256; i_++) { if (i_ >= STEPS) break; float d_ = MAP(RO + RD * T) * il_; if (d_ < 0.0005 * T + 0.0005) { HIT = true; break; } T += d_; if (T > TMAX) break; } }
// Implicit surfaces (gyroids, metaball potentials, folded fields): fixed steps of DT find a sign change,
// then 6 bisection steps refine it. Thin features thinner than DT can be missed: the step is the honesty knob.
#define AM_SEGMENT(MAP, RO, RD, T0, T1, STEPS, T, HIT) { HIT = false; float dt_ = (T1 - T0) / float(STEPS); float ta_ = T0; float fa_ = MAP(RO + RD * ta_); T = T1; for (int i_ = 0; i_ < 256; i_++) { if (i_ >= STEPS) break; float tb_ = ta_ + dt_; float fb_ = MAP(RO + RD * tb_); if (sign(fa_) != sign(fb_)) { float lo_ = ta_, hi_ = tb_; for (int j_ = 0; j_ < 6; j_++) { float m_ = 0.5 * (lo_ + hi_); if (sign(MAP(RO + RD * m_)) == sign(fa_)) lo_ = m_; else hi_ = m_; } T = 0.5 * (lo_ + hi_); HIT = true; break; } ta_ = tb_; fa_ = fb_; } }
// Astral-style additive glow: march by a positive heuristic field, adding COLOR(p, t) / field at each step.
// An aesthetic renderer, not a volume integral: brightness depends on STEPS and the step spacing, so it is
// normalised by 1/STEPS and exposure must be re-checked when STEPS changes. FIELD(p) must return >= 0.
#define AM_GLOW(FIELD, COLOR, RO, RD, STEPS, MINSTEP, TMAX, OUT) { OUT = vec3(0.0); float t_ = 0.0; for (int i_ = 0; i_ < 256; i_++) { if (i_ >= STEPS) break; vec3 p_ = RO + RD * t_; float f_ = MINSTEP + max(FIELD(p_), 0.0); OUT += COLOR(p_, t_) / f_; t_ += f_; if (t_ > TMAX) break; } OUT *= 1.0 / float(STEPS); }
// Step-normalised absorption / emission (PBRT ch. 14 discretisation without scattering): exposure is stable when
// STEPS changes because opacity uses the physical step length. DENS(p) >= 0 is extinction, SRC(p) the source colour.
// JIT in 0..1 offsets the first sample (feed am_ign(fc)) to hide banding. OUT = radiance, TR = transmittance.
#define AM_VOLUME(DENS, SRC, RO, RD, T0, T1, STEPS, JIT, OUT, TR) { OUT = vec3(0.0); TR = 1.0; float dt_ = (T1 - T0) / float(STEPS); float t_ = T0 + dt_ * JIT; for (int i_ = 0; i_ < 256; i_++) { if (i_ >= STEPS || TR < 0.01) break; vec3 p_ = RO + RD * t_; float sg_ = max(DENS(p_), 0.0); if (sg_ > 1e-5) { float a_ = 1.0 - exp(-sg_ * dt_); OUT += TR * SRC(p_) * a_; TR *= 1.0 - a_; } t_ += dt_; } }
// Ray / sphere interval for bounding a renderer (returns t0, t1; t1 < t0 means a miss).
vec2 am_sphereHit(vec3 ro, vec3 rd, float r) { float b = dot(ro, rd), c = dot(ro, ro) - r * r, h = b * b - c; if (h < 0.0) return vec2(1.0, -1.0); h = sqrt(h); return vec2(max(-b - h, 0.0), -b + h); }

// ======== kit ========
// Kit-specific helpers for agent-motif (appended after the AgentMotif library). Rebuild common.glsl with:
//   node ../../tools/am.mjs lib build color noise light post sdf motion --append kit.glsl --out common.glsl
