// Light Tunnel — pass 1 (scale 0.5): the subject that gets stretched. The attached media, or a procedural
// trail scene (blown-out sky, scrub with flowers, a path to the vanishing point) built to have the fine angular
// detail that turns into crisp streaks.
vec3 scrub(vec2 uv, float dryness) {
  // Dry brush: bright twig lines (ridged noise) over dark gaps, with olive and grey variation.
  float tw = lridge(uv * vec2(20.0, 14.0), 4, 0.0, 0.0);
  float tw2 = lridge(rot(0.9) * uv * vec2(55.0, 30.0) + 3.0, 3, 0.0, 0.0);
  float body = lfbm(uv * 9.0 + 2.0, 3, 0.0, 0.0) * 0.5 + 0.5;
  vec3 dark = am_mixOk(u_ink, u_a2, 0.25) * 0.5;
  vec3 dry = am_mixOk(u_a2, u_bg, 0.35);
  float twig = smoothstep(0.55, 0.8, max(tw, tw2 * 0.9));
  vec3 c = mix(dark * (0.4 + 0.6 * body), dry * 1.15, twig);
  return am_mixOk(c, u_a0 * 0.7, (1.0 - dryness) * body * 0.6);
}
vec3 trail(vec2 uv) {
  vec2 vp = v_center(); vec2 d = uv - vp;
  // Sky: blown-out white with pale blue gaps (upper left), like an overexposed phone shot.
  float gaps = smoothstep(0.15, 0.55, lfbm(uv * vec2(1.6, 2.2) + vec2(1.0, 4.0), 4, 0.0, 0.0) + 0.25 * (-uv.x) + 0.2 * uv.y);
  vec3 sky = mix(u_bg * 1.08, am_mixOk(u_a1, u_bg, 0.35), gaps * 0.8);
  // Embankments rising from the vanishing point: the right bank is higher and flowered, the left lower.
  float rTop = vp.y + max(d.x, 0.0) * 0.62 + 0.03 * ln2(vec2(uv.x * 6.0, 1.0), 0.0, 0.0);
  float lTop = vp.y + max(-d.x, 0.0) * 0.18 + 0.025 * ln2(vec2(uv.x * 7.0, 2.0), 0.0, 0.0);
  float rBot = vp.y - max(d.x, 0.0) * 0.32, lBot = vp.y - max(-d.x, 0.0) * 0.55;
  float onR = step(0.0, d.x) * step(uv.y, rTop) * step(rBot, uv.y);
  float onL = step(d.x, 0.0) * step(uv.y, lTop) * step(lBot, uv.y);
  vec3 col = sky;
  vec3 bankR = scrub(uv, 0.75), bankL = scrub(uv + 11.0, 0.85);
  float fl = smoothstep(0.62, 0.72, ln2(uv * vec2(26.0, 20.0) + 7.0, 0.0, 0.0)) * (1.0 - smoothstep(rTop - 0.25, rTop - 0.02, uv.y));
  bankR = mix(bankR, vec3(1.0, 0.86, 0.04) * 0.95, fl);
  // Ground: bright grass and a pale path converging on the vanishing point.
  float gx = d.x / max(-d.y, 0.02);
  // Blades: fine angular stripes (they become crisp green streaks) over broad light/dark patches.
  float lgy = log(max(-d.y, 0.01));
  float grassN = lfbm(vec2(gx * 3.0, lgy * 6.0), 3, 0.0, 0.0) * 0.5 + 0.5;
  float blades = lridge(vec2(gx * 22.0, lgy * 2.0), 3, 0.0, 0.0);
  vec3 grass = am_mixOk(am_mixOk(u_a0, u_ink, 0.7), am_mixOk(u_a0, u_bg, 0.15), sat(grassN * 0.7 + blades * 0.6 - 0.15));
  float path = (1.0 - smoothstep(0.08, 0.16, abs(gx + 0.02)));
  vec3 ground = mix(grass, am_mixOk(u_bg, u_a2, 0.45) * (0.85 + 0.25 * grassN), path);
  col = d.y < 0.0 ? ground : col;
  col = mix(col, bankL, onL);
  col = mix(col, bankR, onR);
  return col;
}
vec4 motif(vec2 uv, vec2 fc) {
  vec4 m = m_source(fc / u_res);
  return vec4(mix(trail(uv), m.rgb + u_bg * (1.0 - m.a), u_sourceOn), 1.0);
}
