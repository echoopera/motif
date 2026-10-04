// Astral Threshold: Violet Passage. Form: 10 narrow shells, small aperture. Material: dense violet. Motion: long camera excursion.
// Astral Threshold: luminous membranes seen through a passage toward a distant aperture.
// Field classes
//   density  density   rho(x,theta) >= 0: sum of warped shells (cylindrical sheets around an offset axis, or planes for the expanse),
//                      each a Gaussian profile of the distance to its shell. Shell distance (geometry) and extinction (rho * sigma) are separate.
//   renderer AM_VOLUME-style: fixed ray interval [0, zfar], step ds = interval / N, T *= exp(-sigma*rho*ds),
//                      C += T * (1 - exp(-sigma*rho*ds)) * emission. No constant per-step glow, so exposure does not depend on the step count.
//   aperture emissive disc at the far end, added once with the final transmittance.
// Loop: warps and fibre advection use integer harmonics of theta; the camera excursion is a closed cosine bell; layer centres orbit on closed circles.

float apIGN(vec2 fc) { return fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715)))); }

// density and emission colour at a sample point. gtype: 0 cylindrical, 1 planar sheets
float astralRho(vec3 p, int layers, float th, float calm, out vec3 emc, int variant) {
  float rho = 0.0; emc = vec3(0.0);
  float Ra = p_aperture;
  float adv = float(p_advect);
  float zfar = 7.0;
  float zk = p.z / zfar;
  vec2 axis = vec2(0.06, 0.13) * zk;                                  // the passage bends toward the off-centre aperture
  for (int i = 0; i < 12; i++) {
    if (i >= layers) break;
    float fi = float(i);
    float hh = h11(fi * 2.17 + 4.0);
    float Ri = Ra * pow(1.52, fi);
    float ang = TAU * hh + th * (variant == 6 ? 1.0 : 0.0) * (mod(fi, 2.0) > 0.5 ? 1.0 : -1.0);
    vec2 cen = axis + 0.05 * vec2(cos(TAU * hh + th), sin(TAU * h11(fi + 9.0) + th)) * (0.4 + 0.2 * fi * 0.2);
    float dist, phi;
    vec2 q = p.xy - cen;
    float wz = p.z * (1.1 + 0.4 * hh);
    if (variant == 5) {                                                // expanse: stacked wavy planes
      phi = p.x * 6.0;
      float ph2 = TAU * h11(fi * 3.3 + 1.0);
      float wv = p_warp * calm * (sin(2.0 * p.x * 3.0 + wz * 1.3 + ph2 + adv * th) + 0.5 * sin(5.0 * p.x + wz * 2.1 + 2.0 * th));
      dist = abs(p.y - (-0.45 + fi * 0.15 * (1.0 + 0.1 * fi) + wv));
    } else {
      float r = length(q); phi = atan(q.y, q.x);
      float ph2 = TAU * h11(fi * 3.3 + 1.0);
      float w1 = sin(5.0 * phi + wz * 1.3 + ph2 + adv * th);
      float w2 = sin(11.0 * phi - wz * 1.9 + 2.0 * th + ph2 * 1.7);
      float w = p_warp * calm * (w1 + 0.5 * w2) * Ri * 2.0;
      if (variant == 3) w = p_warp * calm * Ri * 3.0 * (abs(w1) * 2.0 - 1.0 + 0.4 * w2);   // folded ether: creased sheets
      dist = abs(r - Ri - w);
      if (variant == 7) dist = abs(r - Ri * (1.0 + 0.0) - w - 0.0);
    }
    float thick = 0.075 * (0.7 + 0.8 * zk) * (0.8 + 0.6 * hh) * (variant == 2 ? 1.6 : 1.0);
    if (dist > thick * 3.2) continue;
    float prof = exp(-(dist * dist) / (thick * thick));
    // fibres on the sheet: whole-number count around the circumference, advected by whole harmonics of theta
    float Rm = max(Ri, 0.2);
    float nf = min(floor(TAU * Rm / max(p_filament, 0.01)), 30.0);
    float fib = 0.5 + 0.5 * sin(nf * phi + 6.0 * wz + float(p_advect) * th + hh * 40.0);
    float fil = pow(fib, variant == 4 ? 6.0 : 10.0);
    float cn = ln3(vec3(phi * 1.1, wz * 0.55 + fi * 1.7, dist * 3.0), 1.0, 0.6);
    float mask = smoothstep(-0.1, 0.5, cn);                    // membranes have holes: dark gaps between the sheets
    float local = prof * mask * (0.6 + 0.8 * fil * (variant == 4 ? 1.8 : 1.0));
    float layerFade = smoothstep(0.0, 2.0, fi + 1.0) * (1.0 - smoothstep(float(layers) - 2.0, float(layers) + 0.5, fi));
    local *= 0.55 + 0.45 * layerFade;
    // colour: violet in the fibres' body, ice at the cores and toward the aperture
    float mixv = clamp(0.35 + 0.5 * fil + 0.5 * (1.0 - zk) * 0.0, 0.0, 1.0);
    vec3 c = k_mix(u_a0, u_a1, clamp(0.25 + 0.7 * fil + 0.35 * sin(fi + zk * 3.0), 0.0, 1.0));
    c = mix(c, u_ink, smoothstep(0.55, 1.0, fil * prof) * 0.4);
    rho += local; emc += c * local;
  }
  emc = rho > 1e-5 ? emc / rho : vec3(0.0);
  return rho;
}

vec4 scene_main(vec2 uv, vec2 fc, int variant) {
  float th = k_theta(); float calm = k_calm();
  int layers = p_layers;
  int steps = k_q() == 0 ? 12 : k_q() == 1 ? 18 : 30;
  float zfar = 7.0;
  float travel = p_travel * (variant == 1 ? 2.2 : variant == 7 ? 0.4 : 1.0) * (variant == 8 ? 1.4 : 1.0);
  float z0 = travel * 5.0 * calm * (0.5 - 0.5 * cos(th));                     // closed camera excursion
  vec3 ro = vec3(0.03 * sin(th) * calm, 0.02 * cos(th) * calm, z0 - 1.0);
  vec3 rd = normalize(vec3(uv * 0.9 + vec2(0.0, 0.0), 1.0));
  float tend = (zfar - ro.z) / rd.z;
  float ds = tend / float(steps);
  float jit = apIGN(fc);
  vec3 C = vec3(0.0); float T = 1.0;
  float sigma = p_absorb * (variant == 3 ? 1.5 : 1.0);
  float emisK = p_emission * (variant == 8 ? 1.0 : 1.0);
  for (int i = 0; i < 30; i++) {
    if (i >= steps) break;
    float t = (float(i) + 0.5 + (jit - 0.5) * 0.9) * ds;
    vec3 pos = ro + rd * t;
    vec3 emc;
    float rho = astralRho(pos, layers, th, calm, emc, variant) * p_density;
    float ext = sigma * rho * ds * 0.35;
    float a = 1.0 - exp(-ext);
    // emission brightens toward the aperture (depth cue) and with density, scaled per unit length via a
    float depthLight = 0.6 + 0.9 * smoothstep(0.0, 1.0, pos.z / zfar);
    C += T * a * emc * emisK * depthLight * 1.1;
    T *= exp(-ext);
    if (T < 0.01) break;
  }
  // aperture: bright disc at the far end, seen through whatever transmittance is left
  vec3 pf = ro + rd * tend;
  vec2 apc = vec2(0.06, 0.13);
  float rA = length(pf.xy - apc);
  float Ra = p_aperture * (variant == 7 ? 1.0 : 1.0);
  float disc = exp(-k_sq(rA / max(Ra * 0.9, 1e-3)));
  float rim = exp(-k_sq((rA - Ra) / (0.03 + 0.05 * Ra)));
  vec3 apertureC = mix(u_a1, u_ink, 0.65) * (1.8 * disc + 0.7 * rim) * (variant == 8 ? 0.8 : 1.0) * (variant == 5 ? 0.45 : 1.0);
  vec3 bg = mix(u_a2 * 0.25, u_bg, smoothstep(0.0, 0.9, length(uv)));
  C += T * (apertureC + bg);
  return vec4(C, 1.0);
}

vec4 motif(vec2 uv, vec2 fc) {
  return scene_main(uv, fc, 1);
}
