// @module post — the finishing stack that sells "shot on a lens": bloom, halation, anamorphic streaks,
// chromatic aberration, lens distortion, bokeh blur, painterly filters, sharpening, vignette and film grain.
// Functions take any sampler2D (u_buf0..3 or a media input) and frame-normalised q = fc / u_res.
// Intermediate passes are linear HDR (RGBA16F where available), so bloom thresholds above 1.0 work.
// @requires noise light

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
