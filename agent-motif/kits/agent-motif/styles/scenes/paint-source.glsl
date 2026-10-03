// Painterly — pass 1 (scale 0.5): the subject. The attached image/video, or (with no media) a procedural
// sunset landscape so the style is never blank. A hand-made "boil" jitters the sampling on twos.
vec3 landscape(vec2 uv) {
  float y = uv.y;
  vec3 top = am_mixOk(u_bg, u_a1, 0.6), hor = am_mixOk(u_a0, u_a2, 0.45);
  vec3 sky = am_mixOk(hor, top, smoothstep(-0.05, 0.5, y));
  vec2 sun = vec2(0.18, 0.05 + 0.025 * lsin(1.0, 0.0));
  float ds = length(uv - sun);
  sky = am_mixOk(sky, am_mixOk(u_a2, u_ink, 0.5), exp(-ds * 5.0) * 0.7);
  sky += mix(u_a2, u_ink, 0.7) * (1.0 - smoothstep(0.055, 0.065, ds)) * 1.2;
  vec3 col = sky;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float h = -0.02 - fi * 0.09 + 0.07 * lfbm(vec2(uv.x * (1.4 + fi * 0.6) + fi * 7.3, fi), 4, 0.0, 0.0) + 0.04 * sin(uv.x * 2.0 + fi);
    // Atmospheric perspective: far ridges take the sky's colour, near ones go dark and cool.
    vec3 hill = am_mixOk(am_mixOk(hor, u_a1, 0.5), am_mixOk(u_bg, u_a1, 0.25), fi / 3.0) * (1.0 - 0.12 * fi);
    col = mix(col, hill, (1.0 - smoothstep(-0.004, 0.004, y - h)));
  }
  float water = (1.0 - smoothstep(-0.004, 0.004, y + 0.36));
  vec3 refl = am_mixOk(hor, top, 0.35) * (0.75 + 0.25 * sin(uv.y * 160.0 + 4.0 * ln2(uv * vec2(3.0, 30.0), 1.0, 0.3)));
  refl += mix(u_a2, u_ink, 0.6) * exp(-abs(uv.x - sun.x) * 14.0) * 0.5 * (0.5 + 0.5 * sin(uv.y * 220.0));
  return mix(col, refl * 0.8, water);
}
vec4 motif(vec2 uv, vec2 fc) {
  float ft = am_onTwos(24.0);                       // stepped time for the boil, loops exactly
  vec2 jit = vec2(h21(vec2(ft, 1.7)), h21(vec2(ft, 9.1))) - 0.5;
  vec2 bw = vec2(ln2(uv * 6.0 + jit * 3.0, 0.0, 0.0), ln2(uv * 6.0 + 4.1 + jit * 3.0, 0.0, 0.0)) * p_boil * 0.004;
  vec2 q = fc / u_res + bw;
  vec4 m = m_source(q);
  vec3 fall = landscape(uv + bw);
  vec3 src = m.rgb + u_bg * (1.0 - m.a);
  return vec4(mix(fall, src, u_sourceOn), 1.0);
}
