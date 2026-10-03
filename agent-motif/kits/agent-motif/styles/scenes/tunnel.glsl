// Light Tunnel — pass 2 (full res). A "tunnel of light" polar stretch: around the vanishing point, every pixel
// beyond a jagged radius R(θ) samples the subject at R(θ), so colour stays constant along each ray and the frame
// shatters into converging speed streaks. A short zoom blur adds motion, light pulses rush outward k times per loop,
// and the radius breathes so the stretch front travels. Mirrors Resolve's Tunnel of Light, procedurally.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 vp = v_center();
  vec2 d = uv - vp; float r = length(d); float th = atan(d.y, d.x);
  vec2 ang = vec2(cos(th), sin(th));
  // Jagged stretch front: angular noise sampled on the unit circle (seamless in θ), drifting on the loop.
  float jag = ln2(ang * p_jagFreq, 1.0, 0.25) * 0.6 + ln2(ang * p_jagFreq * 3.7 + 5.0, 1.0, 0.25) * 0.4;
  float breathe = 1.0 + p_breathe * 0.35 * lsin(1.0, 0.0);
  float R = max(0.02, p_radius * breathe * (1.0 + p_jag * jag));
  float soft = 0.015;
  float stretchT = smoothstep(R - soft, R + soft, r);
  float rs = mix(r, R + (r - R) * p_squash, stretchT);           // source radius
  vec2 asp = vec2(u_res.y / u_res.x, 1.0);
  vec2 qv = vp * asp + 0.5;
  // Zoom blur along the ray (motion), stronger in the streak region.
  vec3 acc = vec3(0.0); float wsum = 0.0;
  int N = p_blurTaps;
  for (int i = 0; i < 16; i++) {
    if (i >= N) break;
    float t = (float(i) + am_ign(fc)) / float(N);
    float rr = rs * (1.0 - p_blur * 0.08 * t * (0.3 + stretchT));
    vec2 q = qv + ang * rr * asp;
    float w = 1.0 - t * 0.5;
    acc += texture(u_buf0, q).rgb * w; wsum += w;
  }
  vec3 col = acc / wsum;
  // Light rushing outward along the streaks: pulses travel in log-radius, an integer number per loop.
  float lr = log(max(r, 1e-3));
  float rush = pulse(lr * 0.6 + h21(vec2(floor(th * 60.0), 3.0)) * 0.3, float(p_rush), 0.0, 0.07);
  col *= 1.0 + rush * p_rushGain * stretchT * 1.5;
  // Hot core at the vanishing point (overexposed sky in the reference), and edge darkening on the streaks.
  col += mix(u_bg, u_ink, 0.0) * p_core * (exp(-r * 7.0) * 0.9 + exp(-r * 2.2) * 0.25);
  col *= mix(1.0, 0.82 + 0.18 * (1.0 - stretchT * sat(r * 1.2)), p_shade);
  col = am_tonemap(col, p_exposure, 2);
  col = am_grain(col, fc, p_grain, 1.0);
  return vec4(max(col, 0.0), 1.0);
}
