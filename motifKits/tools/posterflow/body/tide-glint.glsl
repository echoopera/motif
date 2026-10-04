// Tide Glint: looping ripples refract the source and every highlight throws a four-way glint, like sun on water.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res, asp = M_asp();
  float k = float(p_turns);
  vec2 p = uv * p_scale;
  vec2 rip = vec2(ln2(p * 1.6, k, 0.6), ln2(p * 1.6 + 23.1, k, 0.6)) * 0.6 + vec2(ln2(p * 3.7 + 4.0, k, 0.45), ln2(p * 3.7 + 11.0, k, 0.45)) * 0.35;
  vec2 qq = q + rip * p_ripple * 0.04 / asp;
  vec3 c = sx(qq);
  vec3 glint = vec3(0.0);
  for (int d = 0; d < 4; d++) {
    float a = PI * (float(d) + 0.5) / 4.0 + radians(p_angle);
    vec2 dir = vec2(cos(a), sin(a));
    for (int j = 1; j <= 6; j++) {
      float t = float(j) / 6.0;
      vec2 o = dir * t * p_length / asp;
      vec3 s1 = sx(qq + o), s2 = sx(qq - o);
      float fall = (1.0 - t) * (1.0 - t);
      glint += (max(s1 - p_thresh, 0.0) + max(s2 - p_thresh, 0.0)) * fall;
    }
  }
  vec3 grade = mix(vec3(1.0), u_a1 * 1.6, p_tint);
  vec3 col = c * mix(vec3(1.0), u_a0 * 1.5 + 0.2, p_tint * 0.5) + glint * p_glint * 0.12 * grade;
  col = pf_finish(col, uv, fc, p_vignette, p_exposure, p_grain);
  return vec4(max(col, 0.0), 1.0);
}
