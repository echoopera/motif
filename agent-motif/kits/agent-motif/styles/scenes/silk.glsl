// Silk Aurora — scene pass (scale 0.5, HDR linear).
// A two-level domain-warped height field, stretched into drapes, shaded as a real material: wrapped diffuse,
// GGX-like specular along the folds, Charlie sheen at grazing angles and thin-film iridescence on the highlights.
// Emissive "veins" trace one iso-level of the field like aurora curtains. All motion is the warp drifting on a loop.
float silkField(vec2 p, float k, float r, out vec2 q) {
  q = vec2(lfbm(p, 2, k, r), lfbm(p + vec2(5.2, 1.3), 2, k, r));
  return lfbm(p + p_warp * q, 3, k, r) + 0.06 * ln2(p * 3.1 + q, k, r);
}
vec4 motif(vec2 uv, vec2 fc) {
  float k = float(p_flow), r = p_drift;
  vec2 s = rot(p_angle * PI / 180.0) * uv;
  s *= vec2(1.0, p_stretch) * p_scale;
  vec2 q, qx, qy;
  float h = silkField(s, k, r, q);
  const float e = 0.02;
  float hx = silkField(s + vec2(e, 0.0), k, r, qx), hy = silkField(s + vec2(0.0, e), k, r, qy);
  vec3 n = normalize(vec3(-(hx - h) / e * p_relief * 0.12, -(hy - h) / e * p_relief * 0.12, 1.0));
  vec3 v = vec3(0.0, 0.0, 1.0);
  vec2 la = lc(float(p_lightTurns), 0.125) * 0.75;
  vec3 l = normalize(vec3(la, 0.65));
  vec3 hv = normalize(l + v);
  float nl = dot(n, l), nv = sat(n.z), nh = sat(dot(n, hv));

  // Base colour: palette driven by the warp vectors (q) and height, mixed in OKLab.
  vec3 base = am_mixOk(u_a2, u_a0, smoothstep(-0.35, 0.35, q.x));
  base = am_mixOk(base, u_a1, smoothstep(0.05, 0.5, q.y) * 0.85);
  base = am_mixOk(u_bg * 2.0, base, sat(0.45 + h * 1.6));

  float occl = mix(0.06, 1.0, smoothstep(-0.5, 0.4, h)); // deep folds collect shadow
  vec3 diff = am_wrapDiffuse(nl, 0.45, base * 0.6 + u_a1 * 0.1) * base;
  float rough = p_mat == MAT_FOIL ? 0.18 : p_mat == MAT_VELVET ? 0.75 : 0.34;
  float a = rough * rough;
  float spec = am_ggxD(nh, a) * am_smithV(nv, sat(nl), a) * sat(nl) * 0.9;
  float sheen = am_sheen(nh, rough) * pow(1.0 - nv, 2.0);
  vec3 film = am_thinFilm(dot(n, hv) * 0.5 + nv * 0.5, 260.0 + 620.0 * sat(0.5 + 0.8 * h), 1.38);
  vec3 specCol = mix(u_ink, film * 1.6, p_irid);

  vec3 col;
  if (p_mat == MAT_FOIL) col = base * 0.04 + specCol * spec * p_spec * 2.2 * mix(base + 0.2, vec3(1.0), 0.4) + film * sheen * 0.4;
  else if (p_mat == MAT_VELVET) col = diff * 0.75 + base * sheen * 3.0 * p_spec + specCol * spec * 0.15;
  else col = diff * 0.9 + specCol * spec * p_spec + base * sheen * 1.2;
  col *= occl;

  // Aurora veins: thin emissive iso-lines of the field, pulsing along their length (integer pulses per loop).
  if (p_veins > 0.001) {
    float iso = abs(h - 0.12) / max(length(vec2(hx - h, hy - h)) / e, 0.25); // screen-even line width
    float w = 0.018;
    float travel = 0.6 + 0.4 * lsin(float(p_flow) * 2.0, q.x * 1.5 + q.y);
    col += am_accentLoop(0.15 * h + 0.35 * q.x) * (gauss1(iso, w) * 3.0 + glow2(iso, w * 4.0) * 0.35) * p_veins * travel * occl;
  }
  return vec4(max(col, 0.0), 1.0);
}
