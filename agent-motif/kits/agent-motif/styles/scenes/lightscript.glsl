// Lightscript — scene pass (full res, HDR). Luminous editable type: fill, outline, glow and echoes all derive from
// one text distance field (textDist_title, exact within the stored spread, so glows past it come from the bloom
// pass), lit by a flowing procedural field that travels along the letters. Modes: neon, topographic, portal.
// Field class: exact (sampled distance, valid within sdfSpread).
float lineDist(int i, vec2 uv, float s, float y) {
  float w = u_res.x / min(u_res.x, u_res.y);
  float sc = w * s;
  return textDist_title(i, (uv - vec2(0.0, y)) / sc) * sc;
}
float titleDist(vec2 uv) {
  float s = p_scale, band = s * (u_res.x / min(u_res.x, u_res.y)) / textAspect_title;
  float d = 1e3;
  for (int i = 0; i < 3; i++) {
    float y = (1.0 - float(i)) * band * p_leading;
    float rv = am_stagger(float(i), 3.0, 0.5, 0.0, 0.35);                     // staggered reveal
    float out_ = am_seg(0.82 + 0.04 * float(i), 0.96);
    float edge = mix(-1.2, 1.2, am_easeInOutCubic(rv)) - mix(0.0, 2.4, am_easeInOutCubic(out_));
    float wipe = p_reveal ? (uv.x - edge) : -1.0;
    d = min(d, max(lineDist(i, uv, s, y), wipe * 0.5));
  }
  return d;
}
// Distance stored around the glyphs, in uv units: textDist clamps beyond it, so anything that should fade with
// distance must reach exactly zero by here or it leaves a visible box around each text band.
float spreadUV() { return 24.0 / 1024.0 * (u_res.x / min(u_res.x, u_res.y)) * p_scale * 0.95; }
float glowFall(float d, float w) { float dm = spreadUV(); float e0 = exp(-dm / w); return d <= 0.0 ? 1.0 : max(exp(-d / w) - e0, 0.0) / (1.0 - e0); }
vec4 motif(vec2 uv, vec2 fc) {
  vec3 bg = u_bg + am_mixOk(u_a2, u_a1, 0.5) * 0.025 * (0.5 + 0.5 * lfbm(uv * 1.3, 3, 1.0, 0.3));
  if (u_titleOn < 0.5) {                                                         // designed placeholder, never fake glyphs
    float bar = vstroke(sdRoundBox(uv, vec2(0.35, 0.03), 0.03), 0.004);
    return vec4(bg + u_a0 * bar * 2.0, 1.0);
  }
  float d = titleDist(uv);
  // Flowing light: a looping warp field sends pulses of light along the strokes.
  float f = lfbm(uv * 2.2 + vec2(0.0, 0.3 * lsin(1.0, 0.0)), 3, float(p_flow), 0.6);
  float travel = pulse(uv.x * 0.7 + 0.25 * f, float(p_flow) * 2.0, 0.0, 0.09);
  vec3 lightCol = am_accentLoop(0.25 * uv.x + 0.3 * f + float(p_flow) * u_p);
  vec3 col = bg;
  if (p_mode == MODE_TOPO) {                                                     // topographic contours of the field
    float lines = abs(fract(d * p_density * 40.0 - float(p_flow) * u_p) - 0.5);
    float w = fwidth(d * p_density * 40.0) * 1.2;
    col += lightCol * (1.0 - smoothstep(0.0, w + 0.02, lines)) * exp(-max(d, 0.0) * 6.0) * 1.4 * (1.0 - smoothstep(0.6, 1.0, d / spreadUV()));
  } else if (p_mode == MODE_PORTAL) {                                            // letters as windows onto a light field
    vec3 inside = am_mixOk(u_a2, u_a0, 0.5 + 0.5 * f) * (1.0 + travel * 3.0) * 1.6;
    col = mix(col, inside, vfill(d));
  }
  // Echoes behind the title.
  for (int i = 4; i >= 1; i--) {
    if (i > p_echoes) continue;
    float fi = float(i); vec2 o = vec2(0.7, -0.45) * p_spacing * fi;
    float de = titleDist(uv - o);
    col += mix(u_a1, u_a2, fi / 4.0) * vstroke(de, p_outline * 1.2) * (0.5 / fi);
  }
  // Neon reads as tubes: a dim tinted fill, a hot coloured outline, and a glow that dies out inside the spread.
  bool neon = p_mode == MODE_NEON;
  float fill = p_mode == MODE_PORTAL ? 0.0 : vfill(d) * p_fill;
  vec3 fillCol = neon ? lightCol * 0.22 + u_ink * 0.05 : mix(u_ink, lightCol, 0.35) * (0.6 + travel * 2.5);
  col = mix(col, fillCol * (neon ? 1.0 + travel * 2.0 : 1.0), fill);
  vec3 tube = neon ? mix(lightCol, u_ink, 0.35) * 3.0 : mix(u_ink, lightCol, 0.6) * 1.2;
  col += tube * vstroke(d, p_outline * (neon ? 1.6 : 1.0)) * (1.0 + travel * 3.0);
  col += lightCol * glowFall(max(d, 0.0), max(p_glow * spreadUV() * 0.35, 1e-5)) * p_glowAmt * (0.35 + travel * 1.6) * step(0.0, d);
  return vec4(max(col, 0.0), 1.0);
}
