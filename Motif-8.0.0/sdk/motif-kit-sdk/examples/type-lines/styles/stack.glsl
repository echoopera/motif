// Type Lines / Stack: the motif-kit@3 text-input reference.
// The host draws each line centred and untransformed in its band; this shader positions, scales and turns each line
// exactly once. textLine(i, q) takes line-local, isotropic coordinates where the band spans x -0.5..0.5.
vec4 motif(vec2 uv, vec2 fc) {
  float w = u_res.x / min(u_res.x, u_res.y);          // frame width in uv units (uv: short side = 1)
  vec4 col = vec4(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec2 off = vec2(p_drift * sin(TAU * (float(p_cycles) * u_p + fi / 3.0)), (1.0 - fi) * p_spacing);
    float ang = radians(p_turn) * sin(TAU * (float(p_cycles) * u_p + fi * 0.25));
    vec2 q = rot(-ang) * (uv - off) / (w * p_scale);   // band width = frame width × scale
    float a = textLine(i, q).a;                        // coverage, premultiplied white: rgb == a
    vec3 ink = (i == 1 && p_accent) ? u_a0 : u_ink;
    col = over(vec4(ink * a, a), col);
  }
  return over(col, vec4(u_bg, 1.0));
}
