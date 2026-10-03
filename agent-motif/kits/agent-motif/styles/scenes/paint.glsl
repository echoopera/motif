// Painterly — pass 2 (full res). Generalised Kuwahara on the subject flattens it into paint patches with crisp
// edges; strokes follow the image's own structure (bristle streaks run perpendicular to the luminance gradient),
// then pigment darkening at patch borders, a canvas/paper tooth and a subtle palette harmonisation.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec3 c = am_kuwahara(u_buf0, q, p_brush * min(u_res.x, u_res.y) / 540.0 * 0.5 + 1.0);
  // Stroke direction from the subject's gradient (sampled wide so strokes are smooth).
  vec2 g = am_sobel(u_buf0, q, 2.5);
  vec2 dir = length(g) > 1e-4 ? normalize(mix(vec2(1.0, 0.0) * 1e-3, normalize(vec2(-g.y, g.x)), sat(length(g) * 30.0)) + vec2(1e-5, 0.0)) : vec2(1.0, 0.0); // flat areas: horizontal strokes
  float ang = atan(dir.y, dir.x);
  vec2 sp = rot(-ang) * (uv * 260.0 / max(p_brush, 0.5));
  float ft = am_onTwos(24.0);
  float bristle = ln2(vec2(sp.x * 0.08, sp.y * 1.2) + ft * 3.1 * p_boil, 0.0, 0.0);
  c *= 1.0 + bristle * 0.16 * p_texture;
  // Pigment pooling at patch edges (watercolour / gouache darkening).
  vec3 e1 = am_kuwahara(u_buf0, q + vec2(1.5, 0.0) / u_res, 2.0);
  float edge = sat(length(c - e1) * 6.0);
  c *= 1.0 - edge * 0.35 * p_edges;
  // Paper / canvas tooth.
  float tooth = ln2(fc * 0.35, 0.0, 0.0) * 0.5 + ln2(fc * 0.9 + 3.0, 0.0, 0.0) * 0.5;
  float weave = (sin(fc.x * 1.7) * sin(fc.y * 1.7)) * 0.5;
  c *= 1.0 + (tooth * 0.6 + weave * 0.4) * 0.08 * p_texture;
  // Harmonise toward the palette (keeps a series of painted shots consistent).
  vec3 o = am_toOklab(max(c, 0.0)); vec3 pk = am_toOklab(am_rampOk(sat(o.x * 1.1)));
  o.yz = mix(o.yz, pk.yz, p_harmony * 0.6);
  c = am_fromOklab(o);
  c = am_tonemap(c, p_exposure, 2);
  c *= mix(1.0, am_vignette(uv, 1.0), 0.35);
  return vec4(max(c, 0.0), 1.0);
}
