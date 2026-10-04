// Source colour at frame-normalised q, or the palette ink marble when no media is attached (thumbnails never blank).
vec3 sx(vec2 q) {
  if (u_sourceOn > 0.5) { vec4 s = m_source(q); return s.rgb + u_bg * (1.0 - s.a); }
  vec2 uv = (q - 0.5) * M_asp();
  return ramp(0.5 + 0.5 * lfbm(uv * 1.5, 3, float(p_turns), 0.5));
}

// Dot Screen: a halftone whose grid is carried by the liquid flow. Dot size follows tone; colour comes from the
// source at each dot's centre (or the palette).
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res, asp = M_asp();
  float k = float(p_turns);
  vec2 w = pf_flow(uv * p_scale, k);
  vec2 gp = rot(radians(p_angle)) * (uv + w * p_warp * 0.06);
  float cells = float(p_cells);
  vec2 id = floor(gp * cells), f = fract(gp * cells) - 0.5;
  vec2 cuv = transpose(rot(radians(p_angle))) * ((id + 0.5) / cells);
  vec3 c = sx(cuv / asp + 0.5);
  float L = sqrt(max(luma(c), 0.0));
  float r = mix(0.5, 0.0, L) * p_size + 0.04 * p_size;                // dark = big dot
  r = p_flip ? mix(0.0, 0.5, L) * p_size : r;
  float d = length(f) - r;
  float aaw = max(fwidth(d), 1e-4);
  float dot_ = 1.0 - smoothstep(-aaw, aaw, d);
  vec3 ink = mix(c * 1.3, ramp(L), p_palMix);
  vec3 col = mix(u_bg, ink, dot_);
  col = pf_finish(col, uv, fc, p_vignette, p_exposure, p_grain);
  return vec4(max(col, 0.0), 1.0);
}
