// Caustic Light — scene pass (scale 0.75, HDR linear; thin caustic lines need the resolution).
// A shallow sea floor seen in perspective: looping iterated-warp caustics sampled per wavelength for dispersion,
// Beer–Lambert absorption by depth, crepuscular shafts from the surface and drifting motes that loop exactly.
float causticL(vec2 p, int it, float k) {
  // Two rotated, rescaled layers multiplied: breaks the tile repeat and sharpens the network like real caustics.
  p += 0.25 * vec2(ln2(p * 0.21, 0.0, 0.0), ln2(p * 0.21 + 5.3, 0.0, 0.0));
  float a = am_caustic(p, it, k, p_sharp * 0.6);
  float b = am_caustic(rot(0.62) * p * 1.37 + 0.37, it, k, p_sharp * 0.6);
  return pow(a * b, 0.75) * 2.2;
}
vec3 causticRGB(vec2 p) {
  int it = p_detail; float k = float(p_flow);
  vec2 d = vec2(0.7, 0.45) * p_dispersion * 0.006;   // tiny lateral shift per wavelength = dispersion fringes
  return vec3(causticL(p - d, it, k), causticL(p, it, k), causticL(p + d, it, k));
}
vec4 motif(vec2 uv, vec2 fc) {
  // Perspective floor: the horizon sits at y = hz; below it, a ground plane recedes into the haze.
  float hz = 0.75 - p_tilt * 0.5;
  float y = max(hz - uv.y, 0.0); float persp = 1.0 / max(y, 0.02);
  vec2 fl = vec2(uv.x * persp, persp + 4.0) * 1.6 * p_scale;
  float dist = persp * 0.22;                               // pseudo distance through the water
  vec3 cau = causticRGB(fl * 0.9);
  cau = mix(cau, vec3(0.1), sat(dist * 0.035));            // distant caustics average out (no shimmer/aliasing)
  float sand = 0.6 + 0.22 * ln2(fl * 1.3, 0.0, 0.0) + 0.1 * ln2(fl * 5.0, 0.0, 0.0);
  vec3 floorCol = mix(u_a2 * 0.25 + u_ink * 0.03, u_ink * 0.22, sand * 0.5) * sand;
  vec3 lit = floorCol * (0.12 + cau * p_intensity * 9.0);
  // Absorption: water swallows red first; the palette's main accent tints the deep colour.
  vec3 sigma = mix(vec3(0.45, 0.10, 0.05), (1.0 - am_saturate(u_a0, 1.3)) * 0.6 + 0.05, 0.5) * p_murk;
  vec3 trans = exp(-sigma * dist * 2.0);
  vec3 deep = am_mixOk(u_bg, u_a0, 0.4) * 0.3;
  float haze = 1.0 - exp(-dist * 0.18 * (0.5 + p_murk));
  vec3 col = mix(lit * trans + deep * (1.0 - trans), deep, haze);
  col += am_mixOk(u_a0, u_ink, 0.5) * exp(-y * 9.0) * 0.12;      // bright band where light scatters at distance
  // God rays: looping noise stripes radiating from a point above frame.
  vec2 src = vec2(0.25 * sin(p_sun * PI), 0.95);
  vec2 dv = uv - src; float ang = atan(dv.x, -dv.y);
  float ray = ln2(vec2(ang * 9.0 * p_rayDensity, 0.0), float(p_flow), 0.6) * 0.5 + 0.5;
  ray = pow(ray, 3.0) * (1.0 - smoothstep(0.1, 1.6, length(dv))) * smoothstep(0.0, 0.5, length(dv));
  col += am_mixOk(u_a0, u_ink, 0.6) * ray * p_rays * 1.2 * (0.6 + 0.4 * trans.g);
  // Motes: 32 particles in a wrapped column, each rising a whole number of wraps per loop (exact loop),
  // with seeded size, speed tier and soft defocus.
  if (p_motes > 0.001) {
    vec2 ext = M_asp() * 0.5 + 0.05;
    for (int i = 0; i < 32; i++) {
      vec3 hh = h33(vec3(float(i), 2.0, 5.0));
      float wraps = float(p_flow) * (1.0 + floor(hh.z * 2.0));
      vec2 mp = vec2((hh.x * 2.0 - 1.0) * ext.x + 0.03 * lsin(1.0, hh.y), mod(hh.y + wraps * u_p, 1.0) * 2.0 * ext.y - ext.y);
      float sz = 0.002 + 0.006 * hh.x * hh.x;
      col += u_ink * gauss1(length(uv - mp), sz) * (0.25 + 0.5 * hh.z) * p_motes;
    }
  }
  return vec4(max(col, 0.0), 1.0);
}
