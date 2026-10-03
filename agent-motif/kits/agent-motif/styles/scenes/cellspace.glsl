// Cellspace — scene pass (scale 0.5, HDR). Porous architecture: translucent gyroid chambers and laminar sheets.
// Field class: density. The gyroid is an implicit function (not a distance); exp(-|g| / thickness) turns the band
// around its zero set into extinction, rendered by the step-normalised absorption/emission renderer (AM_VOLUME),
// so exposure stays stable when Quality changes.
float cellDens(vec3 p) {
  vec3 q = p * p_cells * 8.0;
  if (p_deform > 0.001) q = am_cosFold(q, p_deform * 0.35, 1.0, 1.8, 0.5, TAU * float(p_cycles) * u_p, 2);
  float g = dot(sin(q), cos(q.yzx));
  float band = exp(-abs(g) / max(p_thick, 0.001));
  float env = 1.0 - smoothstep(0.75, 1.2, length(p));
  return band * env * p_opacity * 9.0;
}
vec3 cellSrc(vec3 p) {
  vec3 q = p * p_cells * 8.0;
  float chamber = 0.5 + 0.5 * sin(q.x * 0.5 + q.y * 0.37 - q.z * 0.29 + TAU * u_p * float(p_cycles));
  vec3 c = am_mixOk(u_a2, u_a0, chamber);
  c = am_mixOk(c, u_a1, smoothstep(0.55, 1.1, length(p)) * 0.8);                       // cooler outer shell
  float core = exp(-dot(p, p) * 3.0);
  return c * (0.35 + p_glow * 1.2) + u_ink * core * p_glow * 1.5;
}
vec4 motif(vec2 uv, vec2 fc) {
  float ca = TAU * float(p_camTurns) * u_p + 0.4;
  vec3 ro = vec3(sin(ca) * 2.4, 0.2 + 0.35 * lsin(float(p_camTurns), 0.1), cos(ca) * 2.4); // whole cycles only: half-frequency bobbing broke the loop
  vec3 rd = am_camRay(ro, vec3(0.0), uv, 1.6, 0.0);
  vec2 iv = am_sphereHit(ro, rd, 1.2);
  vec3 col = vec3(0.0); float T = 1.0;
  if (iv.y > iv.x) { AM_VOLUME(cellDens, cellSrc, ro, rd, iv.x, iv.y, p_steps, am_ign(fc), col, T); }
  vec3 bg = mix(u_bg, am_mixOk(u_bg, u_a2, 0.3), exp(-dot(uv, uv) * 2.0) * 0.6);
  return vec4(col + bg * T, 1.0);
}
