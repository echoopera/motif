// @module light — physically based shading for real-time looks: GGX, split-sum env, a procedural studio HDRI,
// thin-film iridescence, spectral dispersion, subsurface wrap and sheen. Radiance out is HDR linear: tone map it.
// @requires

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
