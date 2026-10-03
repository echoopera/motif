// Nebula Drift — scene pass (scale 0.5, HDR linear).
// Emission–absorption volume rendering through a cheap looping gyroid-fBm density (10x cheaper than simplex),
// lit by an embedded star with Henyey–Greenstein forward scattering. Colour is temperature-mapped through the
// palette in OKLab; a parallax star field sits behind. Step count is the Quality control; IGN jitter hides banding.
float nebDensity(vec3 p, out float dust) {
  float k = float(p_flow);
  float n = am_sinFbm3(p * p_scale * 2.2, 5, k, 0.6 * p_turb);
  float shell = length(p * vec3(1.0, 1.4, 1.0)) - 0.9 + n * 0.55;    // envelope, eroded by the noise
  float env = smoothstep(0.25, -0.6, shell);
  float fil = pow(sat(1.0 - abs(n) * 1.6), 5.0);                     // ridged: thin glowing filaments
  float soft = sat(n * 0.9 + 0.25);                                  // broad diffuse glow
  dust = sat(am_sinFbm3(p * p_scale * 3.4 + 7.1, 3, k, 0.4 * p_turb) * 1.6 - 0.15) * env;
  return (fil + soft * soft * soft * 0.25) * env * (0.3 + p_fill * 1.4);
}
vec4 motif(vec2 uv, vec2 fc) {
  float ca = TAU * float(p_camTurns) * u_p;
  vec3 ro = vec3(sin(ca) * 2.6, 0.25, cos(ca) * 2.6);
  vec3 rd = am_camRay(ro, vec3(0.0), uv, 1.35, 0.08);
  vec3 col = vec3(0.0); float T = 1.0;
  // Bound the march to the cloud's sphere.
  float b = dot(ro, rd), c = dot(ro, ro) - 1.7 * 1.7, disc = b * b - c;
  vec3 star = mix(u_ink, bb(6500.0), 0.5) * 1.0;
  if (disc > 0.0) {
    float t0 = max(-b - sqrt(disc), 0.0), t1 = -b + sqrt(disc);
    int N = p_steps; float dt = (t1 - t0) / float(N);
    float t = t0 + dt * am_ign(fc);
    for (int i = 0; i < 128; i++) {
      if (i >= N || T < 0.01) break;
      vec3 p = ro + rd * t;
      float dust; float d = nebDensity(p, dust);
      if (d + dust > 0.001) {
        float r = length(p);
        float temp = sat(d * 1.2 + (1.0 - r) * 0.7);
        vec3 hue = am_mixOk(am_mixOk(u_a1, u_a0, smoothstep(0.2, 0.75, r)), mix(u_a2, u_ink, 0.5), smoothstep(0.55, 1.0, temp));
        vec3 emi = hue * d * p_glow * 1.8;
        float ph = am_hg(dot(rd, -normalize(p + 1e-4)), 0.4);
        vec3 scat = star * ph * exp(-r * 2.2) * 10.0 * (d + dust * 0.5);
        float sig = (d * 0.6 + dust * 3.0) * p_absorb * 3.0;
        float a = 1.0 - exp(-sig * dt);
        col += T * (emi + scat) * (sig > 1e-4 ? a / sig : dt);
        T *= 1.0 - a;
      }
      t += dt;
    }
  }
  // Embedded star (behind/inside the gas) and the background field, both attenuated by what the ray crossed.
  vec3 sc = vec3(0.0); float bs = dot(-ro, rd); vec3 cp = ro + rd * max(bs, 0.0); float dc = length(cp);
  sc += star * (gauss1(dc, 0.02) * 14.0 + glow2(dc, 0.035) * 1.2) * p_core;
  vec2 sky = vec2(atan(rd.z, rd.x), asin(rd.y)) * 3.0;
  sc += am_stars(sky, 9.0, 1.0, 0.25) * 1.4;
  col += sc * T + u_bg * T;
  return vec4(col, 1.0);
}
