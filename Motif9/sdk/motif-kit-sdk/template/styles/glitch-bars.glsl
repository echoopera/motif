// Glitch Bars, pass 2: reads pass 1 from u_buf0 and displaces rows in time slots.
// tslot()/tfrac() go through the photosensitive limiter, so flicker never exceeds 3 changes per second.
vec4 motif(vec2 uv, vec2 fc) {
  float slot = tslot(float(p_rate));
  float row = floor(fc.y / 12.0);
  float g = step(1.0 - 0.4 * p_amount, h21(vec2(row, slot)));
  float shift = g * (h21(vec2(row, slot + 7.0)) - 0.5) * 0.2 * p_amount;
  vec2 t = fc / u_res + vec2(shift, 0.0);
  vec3 c;
  c.r = texture(u_buf0, t + vec2(0.006 * p_split * g, 0.0)).r;
  c.g = texture(u_buf0, t).g;
  c.b = texture(u_buf0, t - vec2(0.006 * p_split * g, 0.0)).b;
  return vec4(c, 1.0);
}
