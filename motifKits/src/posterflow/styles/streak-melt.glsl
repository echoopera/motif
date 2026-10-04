// Streak Melt: where a looping mask opens, the source is dragged along a direction, split into R/G/B and cut into slabs.
// No time-slot flicker: slab offsets are stable per slab and breathe with whole-cycle sines.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec2 asp = M_asp();
  float k = float(p_turns);
  float ang = radians(p_angle);
  vec2 dir = vec2(cos(ang), sin(ang)), nrm = vec2(-dir.y, dir.x);
  // Coordinates along / across the drag direction.
  float along = dot(uv, dir), across = dot(uv, nrm);
  // Optional slabs: quantize the across axis so streaks read as sheared strips.
  float rows = float(p_slabs);
  float acr = rows > 0.5 ? (floor(across * rows) + 0.5) / rows : across;
  float jit = rows > 0.5 ? h11(floor(across * rows) + 3.0) - 0.5 : 0.0;

  float m = 0.5 + 0.5 * ln2(vec2(acr * p_scale, along * 0.35 + jit * 2.0), k, 0.6);
  float open = smoothstep(p_thresh, p_thresh + 0.28, m);
  float amt = open * (0.55 + 0.45 * lsin(k, m * 2.0 + jit));
  vec2 shift = dir * (p_length * (0.35 + 0.65 * amt) * open + jit * p_jitter * 0.3) / asp;

  vec3 fallback = ramp(0.5 + 0.5 * lfbm(vec2(acr * 1.4, along * 0.8), 3, k, 0.5));
  vec3 acc = vec3(0.0); float wsum = 0.0;
  float ca = p_split * 0.02 * (0.3 + amt);
  for (int i = 0; i < 12; i++) {
    if (i >= p_taps) break;
    float t = float(i) / max(float(p_taps - 1), 1.0);
    float wt = pf_tw(float(i), float(p_taps));
    vec2 o = -shift * (0.25 + 0.75 * t);
    vec4 sr = m_source(q + o + dir * ca / asp), sg = m_source(q + o), sb = m_source(q + o - dir * ca / asp);
    vec3 fr = fallback;
    vec3 c = vec3(sr.r + u_bg.r * (1.0 - sr.a), sg.g + u_bg.g * (1.0 - sg.a), sb.b + u_bg.b * (1.0 - sb.a));
    acc += mix(fr, c, u_sourceOn) * wt; wsum += wt;
  }
  vec3 col = acc / max(wsum, 1e-3);
  col = pf_poster(col, float(p_bands), p_soft, p_hue, p_mode, p_palMix, p_veins, p_veinW, c_vein());
  col = pf_finish(col, uv, fc, p_vignette, p_exposure, p_grain);
  return vec4(max(col, 0.0), 1.0);
}
