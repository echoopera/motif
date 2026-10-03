// Tunnel transition: the from-picture shatters into converging speed streaks around a vanishing point, the cut
// happens at full stretch, and the to-picture settles out of the streaks. Stretch, blur and rush all scale with
// k = sin(pi * progress), which is exactly 0 at both ends, so progress 0 shows `from` and 1 shows `to` untouched.
vec4 pick(vec2 q, float w) { return mix(g_fromAt(q), g_toAt(q), w); }
vec4 motif(vec2 uv, vec2 fc) {
  float pr = sat(u_progress);
  float k = sin(PI * pr);
  float w = smoothstep(0.45, 0.55, pr);
  if (k < 1e-4) return pick(fc / u_res, w);
  vec2 vp = v_center(); vec2 d = uv - vp; float r = length(d); float th = atan(d.y, d.x);
  vec2 ang = vec2(cos(th), sin(th));
  float jag = ln2(ang * 2.2, 1.0, 0.25);
  float R = mix(1.5, p_radius, pow(k, 0.6)) * (1.0 + 0.5 * k * jag);
  float st = smoothstep(R - 0.015, R + 0.015, r);
  float rs = mix(r, R, st);
  vec2 asp = vec2(u_res.y / u_res.x, 1.0); vec2 qv = vp * asp + 0.5;
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = 0; i < 10; i++) {
    float t = (float(i) + am_ign(fc)) / 10.0;
    float rr = rs * (1.0 - p_blur * 0.12 * k * t * (0.3 + st));
    float wt = 1.0 - 0.5 * t; acc += pick(qv + ang * rr * asp, w) * wt; ws += wt;
  }
  vec4 c = acc / ws;
  float rush = pulse(log(max(r, 1e-3)) * 0.6, 3.0, 0.0, 0.07);
  c.rgb *= 1.0 + rush * p_rush * st * k;
  c.rgb += u_ink * p_core * k * k * exp(-r * 6.0);
  return c;
}
