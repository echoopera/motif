// Liquid Chrome — scene pass (scale 0.66, HDR linear).
// Metaballs on integer Lissajous orbits merge with a C2 smooth union; surface ripples travel on the loop.
// Shading is image-based from a procedural photo studio (softboxes + strip lights), prefiltered by roughness,
// with split-sum env BRDF, optional thin-film anodising, ambient occlusion and a mirror-floor reflection.
vec3 blobPos(int i) {
  float fi = float(i); vec3 h = h33(vec3(fi, 7.0, 3.0));
  float k1 = 1.0 + floor(h.x * 2.0), k2 = 1.0 + floor(h.y * 2.0);
  vec2 a = lc(k1 * float(p_orbits), h.z), b = lc(k2 * float(p_orbits), h.x + 0.25);
  return vec3(a.x * 0.85, b.y * 0.32, a.y * 0.55) * p_spread;
}
float chromeMap(vec3 p) {
  float d = 1e5;
  for (int i = 0; i < 8; i++) {
    if (i >= p_count) break;
    float r = 0.26 + 0.16 * h11(float(i) + 0.5);
    d = am_smin3(d, length(p - blobPos(i)) - r * p_size, p_blend * 0.18);
  }
  float rip = sin(9.0 * p.x + TAU * 2.0 * u_p) * sin(8.0 * p.y - TAU * u_p) * sin(7.0 * p.z + TAU * u_p);
  return d + p_ripple * 0.012 * rip;
}
// The studio spin sweeps bright softboxes across the surface: route it through the limiter (safeCycles) so it
// slows/freezes when tempo would push reflections past 3 flashes per second.
vec3 envAt(vec3 d, float rough) { return am_studio(d, TAU * safeCycles(float(p_spin)) * u_p, rough, u_ink, mix(u_ink, u_a0, 0.55)); }
vec4 motif(vec2 uv, vec2 fc) {
  float ca = TAU * float(p_camTurns) * u_p + 0.6;
  vec3 ro = vec3(sin(ca) * 4.4, 0.9, cos(ca) * 4.4), ta = vec3(0.0, -0.1, 0.0);
  vec3 rd = am_camRay(ro, ta, uv, 1.75, 0.0);
  float t; bool hit;
  AM_MARCH(chromeMap, ro, rd, 10.0, p_steps, t, hit);
  float floorY = -0.85;
  vec3 bg = mix(u_bg, u_bg * 0.4 + u_a2 * 0.05, sat(uv.y + 0.5)) + envAt(rd, 0.9) * 0.05;
  vec3 col = bg;
  vec3 f0 = mix(vec3(0.95, 0.93, 0.9), c_tint(), p_tintMix);
  float rough = p_rough;
  if (hit) {
    vec3 p = ro + rd * t; vec3 n = AM_NORMAL(chromeMap, p);
    float nv = sat(dot(n, -rd)); vec3 rf = reflect(rd, n);
    float ao; AM_AO(chromeMap, p, n, ao);
    vec3 F0 = f0;
    if (p_film > 0.001) F0 *= mix(vec3(1.0), am_thinFilm(nv, 380.0 + 320.0 * sin(TAU * u_p + p.y * 2.0), 1.45) * 1.6, p_film);
    vec3 env = envAt(rf, rough);
    // Floor bounce: what the reflected ray sees when it heads down onto the mirror floor.
    if (rf.y < 0.0) { float tf = (floorY - p.y) / rf.y; vec3 fp = p + rf * tf; env = mix(env, u_bg * 0.6 + envAt(reflect(rf, vec3(0, 1, 0)), 0.6) * 0.04, sat(1.0 - length(fp.xz) * 0.15)); }
    col = env * am_envBRDF(F0, rough, nv) * mix(0.35, 1.0, ao);
    col += F0 * envAt(n, 1.0) * 0.04 * ao; // soft fill
  } else if (rd.y < 0.0) {
    // Mirror floor: reflect the blobs once (cheap second march), fade with distance and Fresnel.
    float tf = (floorY - ro.y) / rd.y; vec3 fp = ro + rd * tf;
    vec3 rr = reflect(rd, vec3(0, 1, 0)); float t2; bool h2;
    AM_MARCH(chromeMap, fp, rr, 5.0, p_steps / 2, t2, h2);
    float fres = am_fresnelF(0.04, -rd.y) * p_floor;
    vec3 refl = envAt(rr, 0.8) * 0.06;
    if (h2) { vec3 p2 = fp + rr * t2; vec3 n2 = AM_NORMAL(chromeMap, p2); refl = envAt(reflect(rr, n2), rough) * am_envBRDF(f0, rough, sat(dot(n2, -rr))); }
    float fade = exp(-length(fp.xz) * 0.35);
    col = mix(bg, refl, sat(fres * 3.0) * fade) + bg * 0.2;
    // Contact shadow under the blobs.
    float occ = 1.0; for (int i = 0; i < 8; i++) { if (i >= p_count) break; vec3 bp = blobPos(i); occ *= 1.0 - 0.55 * exp(-length(fp.xz - bp.xz) * 2.5) * exp(-max(bp.y - floorY, 0.0) * 1.2); }
    col *= occ;
  }
  return vec4(max(col, 0.0), 1.0);
}
