// Logo Reveal: "mark" is an svg input (assets/mark.svg by default). vec_mark(uv) is its signed distance, so the outline,
// the fill and the halo all come from the same number. A wave expands from the centre k times per loop.
vec4 motif(vec2 uv, vec2 fc) {
  float d = vec_mark(uv);
  float r = length(uv);
  float k = float(p_waves);
  float wave = fract(k * u_p);                                  // 0..1 expanding reveal, whole cycles per loop
  float front = wave * 0.9;
  float revealed = 1.0 - smoothstep(front - 0.02, front + 0.02, r);       // inside the front: drawn
  float edge = exp(-pow((r - front) / 0.035, 2.0));                       // the leading ring
  float hold = smoothstep(0.0, 0.1, wave) * (1.0 - smoothstep(0.9, 1.0, wave));   // fades to nothing at both ends: the loop closes
  edge *= hold;
  vec3 bgc = u_bg + u_a0 * 0.05 * edge;
  vec4 c = vec4(bgc, 1.0);
  c = over(solid(mix(u_a0, u_a1, sat(r * 1.4)) * p_fillAmt, vfill(d) * revealed * hold), c);
  c = over(solid(u_ink, vstroke(d, p_trace) * max(revealed, edge) * hold), c);
  c.rgb += u_a0 * vglow(d, max(p_halo, 1e-3)) * 0.5 * edge * step(0.0, d);
  return c;
}
