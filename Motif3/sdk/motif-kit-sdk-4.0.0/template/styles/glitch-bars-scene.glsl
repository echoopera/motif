// Glitch Bars, pass 1 (half resolution): the clean image. Output goes to u_buf0 for pass 2.
vec4 motif(vec2 uv, vec2 fc) {
  float x = (uv.x / M_asp().x + 0.5) * float(p_bars);
  float id = floor(x);
  float h = 0.15 + 0.3 * (0.5 + 0.5 * lsin(1.0, h11(id)));
  float bar = step(abs(uv.y), h) * step(0.12, fract(x));
  return vec4(accent(id) * bar + u_bg * (1.0 - bar), 1.0);
}
