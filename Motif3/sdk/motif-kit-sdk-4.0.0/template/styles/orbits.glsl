// Orbits — the minimal Motif kit style.
// Inputs: uv (centred, short side = 1), fc (pixel coords). Params arrive as p_<key> uniforms.
// Loop rule: time enters only through u_p (0..1) with integer frequencies — lc(), lsin(), pulse().
vec4 motif(vec2 uv, vec2 fc) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    if (i >= p_rings) break;
    float fi = float(i);
    float r = p_radius * (0.3 + 0.7 * (fi + 1.0) / float(p_rings));
    vec2 c = lc(float(p_speed) * (i % 2 == 0 ? 1.0 : -1.0), h11(fi)) * r;   // exact loop
    if (p_mode == MODE_RINGS) col += accent(fi) * ring(length(uv) - r, 0.004) * 0.6;
    float d = length(uv - c);
    col += accent(fi) * (ring(d, 0.012) * 1.5 + glow2(d, 0.03) * 0.3 * p_glow);
    if (p_trails) col += accent(fi) * 0.25 * ring(length(uv) - r, 0.003) * pulse(atan(uv.y, uv.x) / TAU, float(p_speed), h11(fi), 0.08);
  }
  return emit(aces(col));   // premultiplied, alpha = brightness
}
