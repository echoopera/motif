// Liquid Lens: a media example. The manifest declares  "inputs": [{ "id": "source", "type": "media" }],
// so the runtime provides u_source, u_sourceOn, u_sourceSize, u_sourceTime and m_source(q) / m_sourceUV(uv).
// q = fc / u_res is frame-normalized (0..1); the host has already fitted the media to the frame.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  // Looping flow field: ln2 loops p_turns times per Motif loop, so the displacement closes exactly.
  vec2 w = vec2(ln2(uv * p_scale, float(p_turns), 0.6), ln2(uv * p_scale + 17.3, float(p_turns), 0.6));
  vec2 c = 0.22 * lc(1.0, 0.0);
  float lens = gauss1(length(uv - c), max(0.05, p_radius));
  vec2 d = (w * p_warp * 0.05 + (uv - c) * -lens * p_bulge * 0.35) / M_asp();
  vec4 src = m_source(q + d);
  // No media attached: show a soft palette gradient so the style is never blank (library thumbnails, SDK preview).
  vec3 fallback = mix(u_bg, u_a0, 0.35 + 0.35 * lfbm(uv * 3.0, 4, 1.0, 0.5));
  vec3 col = mix(fallback, src.rgb + u_bg * (1.0 - src.a), u_sourceOn);
  col += u_ink * lens * p_glint * 0.25;
  return vec4(col, 1.0);
}
