// Monolith — scene pass (scale 0.66, HDR). Sculptural solids and negative space: an eroded, hollowed column with
// orbiting rings, on a ground plane under one key light.
// Field class: bound. Primitives and smooth booleans bound the true distance; the cosine-fold erosion multiplies
// the Lipschitz constant by at most (1 + a)^3, so the march divides by that L (AM_MARCH_L) and never crosses a surface.
float gL = 1.0;
float ringD(vec3 p) {
  float d = 1e5;
  for (int i = 0; i < 4; i++) {
    if (i >= p_rings) break;
    float fi = float(i);
    vec3 q = p - vec3(0.0, -0.35 + 0.42 * fi, 0.0);
    q.xz = rot(TAU * float(1 + i % 2) * float(p_orbits) * u_p * (i % 2 == 0 ? 1.0 : -1.0)) * q.xz;
    q.xy = rot(0.35 + 0.25 * fi) * q.xy;
    d = min(d, sdTorus(q, vec2(0.56 + 0.07 * fi, 0.012 + 0.006 * fi)));
  }
  return d;
}
float columnD(vec3 p) {
  vec3 q = p;
  if (p_erode > 0.001) q = am_cosFold(p * 3.0, p_erode * 0.22, 1.0, 1.9, 0.5, TAU * float(p_orbits) * u_p, 3) / 3.0;
  float body = am_sdRoundBox3(q - vec3(0.0, 0.05, 0.0), vec3(0.27, 0.9, 0.27), 0.01 + p_bevel * 0.07);
  float cav = length(q.yz - vec2(0.15, 0.0)) - p_cavity * 0.2;                  // bore through x
  cav = min(cav, length(q.xy - vec2(0.0, -0.3)) - p_cavity * 0.15);              // bore through z
  cav = min(cav, am_sdSphere(q - vec3(0.0, 0.62, 0.0), p_cavity * 0.24));        // hollow crown
  return smax(body, -cav, 0.03);
}
float monoMap(vec3 p) { return min(columnD(p) / gL, ringD(p)); }               // rings are exact: no division
float monoMapS(vec3 p) { return min(monoMap(p), p.y + 0.95); }                    // with the ground, for shadow/AO
vec4 motif(vec2 uv, vec2 fc) {
  gL = p_erode > 0.001 ? am_cosFoldLip(p_erode * 0.22, 3) : 1.0;
  float ca = TAU * float(p_camTurns) * u_p + 0.7;
  vec3 ro = vec3(sin(ca) * 3.1, 0.35, cos(ca) * 3.1), rd = am_camRay(ro, vec3(0.0, 0.05, 0.0), uv, 1.8, 0.0);
  vec3 L = normalize(vec3(0.6, 0.85, 0.35));
  vec3 bg = mix(u_bg, mix(u_bg, u_a2, 0.25), sat(uv.y + 0.6));
  float t; bool hit;
  AM_MARCH_L(monoMap, ro, rd, 9.0, p_steps, 1.0, t, hit);
  float tg = rd.y < 0.0 ? (-0.95 - ro.y) / rd.y : 1e5;
  vec3 col = bg;
  if (hit && t < tg) {
    vec3 p = ro + rd * t; vec3 n = AM_NORMAL(monoMap, p);
    bool isRing = ringD(p) < columnD(p) / gL;
    float sh; AM_SHADOW(monoMapS, p + n * 0.003, L, 14.0, sh);
    float ao; AM_AO(monoMapS, p, n, ao);
    vec3 alb = p_mat == MAT_OBSIDIAN ? vec3(0.02) : p_mat == MAT_METAL ? am_mixOk(u_ink, u_a1, 0.25) : am_mixOk(u_ink, u_a2, 0.3) * 0.7;
    float rough = p_mat == MAT_OBSIDIAN ? 0.12 : p_mat == MAT_METAL ? 0.32 : 0.75;
    float metal = p_mat == MAT_METAL ? 1.0 : 0.0;
    vec3 f0 = mix(vec3(0.04), alb, metal);
    vec3 env = am_studio(reflect(rd, n), 0.0, rough, u_ink, u_a1);
    col = am_brdf(n, -rd, L, alb, metal, rough) * u_ink * 3.2 * sh;
    col += env * am_envBRDF(f0, rough, sat(dot(n, -rd))) * ao + alb * (1.0 - metal) * u_a2 * 0.15 * ao;
    if (isRing) col = mix(u_a0, u_ink, 0.25) * p_ringGlow * 4.0;                 // emissive rings
  } else if (tg < 9.0) {
    vec3 p = ro + rd * tg;
    float sh; AM_SHADOW(monoMapS, p + vec3(0, 0.002, 0), L, 10.0, sh);
    float ao; AM_AO(monoMapS, p, vec3(0, 1, 0), ao);
    vec3 g = mix(u_bg * 1.6, am_mixOk(u_bg, u_ink, 0.12), 0.5) * (0.4 + 0.6 * sh) * ao;
    col = mix(g, bg, sat(length(p.xz) * 0.18));
    col += mix(u_a0, u_ink, 0.25) * p_ringGlow * 0.35 * exp(-max(ringD(p), 0.0) * 8.0); // ring light on the ground
  }
  // Emissive atmosphere, kept separate from the opaque surface: a cheap halo around the rings along the view ray.
  float tm = min(hit ? t : 9.0, tg); float halo = 0.0;
  for (int i = 0; i < 16; i++) { float s = tm * (float(i) + am_ign(fc)) / 16.0; halo += exp(-max(ringD(ro + rd * s), 0.0) * 14.0); }
  col += mix(u_a0, u_ink, 0.2) * halo / 16.0 * p_halo * p_ringGlow * 0.6;
  col = mix(col, bg, 1.0 - exp(-max(tm - 3.0, 0.0) * 0.08 * p_haze));
  return vec4(max(col, 0.0), 1.0);
}
