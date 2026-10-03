// Astral Fold — scene pass (scale 0.5, HDR). The Astral method as a named renderer: a camera ray, iterative
// cosine coordinate folding, a positive field that sets the march distance, and additive coloured emission.
// Field class: glow (a heuristic step field, NOT a distance; see the field module). Renderer select:
//   glow    the original additive look (AM_GLOW): brightness depends on step count and spacing, normalised by 1/STEPS
//   volume  the same field reinterpreted as density (AM_VOLUME): step-normalised, so exposure holds across Quality
vec3 astralQ(vec3 p) { return am_cosFold(p * p_freq, p_amp, 1.0, p_lac, p_bias, TAU * float(p_cycles) * u_p, p_layers); }
float astralField(vec3 p) {
  vec3 q = astralQ(p);
  float tube = abs(length(q.xy) / p_freq - p_radius);      // a folded tunnel wall
  float sheets = abs(sin(q.z * 0.5)) * 0.15 / p_freq;      // laminar folds across it
  return min(tube, tube * 0.5 + sheets) * 0.6;
}
vec3 astralColor(vec3 p, float t) {
  float h = 0.08 * p.z + 0.12 * length(p.xy) + float(p_hueCycles) * u_p;
  return am_accentLoop(h) * exp(-t * p_fade * 0.35);
}
float astralDens(vec3 p) { return exp(-astralField(p) * 40.0 * p_tight) * p_density * 18.0; }
vec3 astralSrc(vec3 p) { return astralColor(p, length(p - vec3(0.0, 0.0, -2.0))) * 3.0; }
vec4 motif(vec2 uv, vec2 fc) {
  float roll = TAU * float(p_roll) * u_p;
  vec3 ro = vec3(0.0, 0.0, -2.0);
  vec3 rd = normalize(vec3(rot(roll) * uv, 1.0 / p_fov));
  vec3 col;
  if (p_renderer == RENDERER_GLOW) {
    AM_GLOW(astralField, astralColor, ro, rd, p_steps, 0.004, 14.0, col);
    // Empirical calibration (am qa, Oct 2026): this field's glow sum scales ~ steps^-0.62 after the soft knee, so compensate around the
    // default 72 steps. A fitted correction for this field, not a physical integral: re-measure if the field changes.
    col *= p_glow * 0.012 * pow(float(p_steps) / 72.0, 0.62);
    col = col * col / (col + 0.08);                                  // keep the ground dark: filaments, not fog
  } else {
    float T;
    AM_VOLUME(astralDens, astralSrc, ro, rd, 0.0, 14.0, p_steps, am_ign(fc), col, T);
    col = col * p_glow + u_bg * T;
  }
  return vec4(max(col, 0.0), 1.0);
}
