// Harmonic Matter: Resonant Basin. Form: radial Bessel-like modes. Material: teal glass sheets. Motion: radial standing ring pulses.
// Harmonic Matter: standing-wave membranes with attached particles.
// Field classes
//   wave surface   implicit  y = yoff + h(x,z,theta); located by a bounded slab march (step count = quality) then 5 bisections.
//                  |h| <= amax (sum of mode amplitudes), so the slab [yoff-amax, yoff+amax] provably contains the surface.
//   nodal contour  bound     |h| / |grad h| approximates distance to the node on the surface (exact to first order).
//   particles      exact     jittered 3x3 cell lookup in the surface (x,z) parameter space, displaced along grad h.
// Loop: every temporal term is an integer multiple of theta (standing waves cos(k*theta + phase)); static phases are seeded.

const int KMODES = 6;
const int MAXS = 34;      // FD-gradient fields cost 3 evaluations per step: smaller bound keeps work under half of the sandbox limit

float hField(vec2 xz, int kind, float th, float amp, out vec2 g) {
    float e = 0.004; float h = 0.0;
  float osc = float(p_osc);
  float k0 = TAU / p_wavelength;
  float sumA = 0.0;
  for (int pass = 0; pass < 3; pass++) {
    vec2 q = xz + (pass == 1 ? vec2(e, 0.0) : pass == 2 ? vec2(0.0, e) : vec2(0.0));
    float v = 0.0;
    if (kind == 2) {
      float r = length(q) + 1e-3, phi = atan(q.y, q.x);
      for (int i = 0; i < KMODES; i++) {
        if (i >= p_modes) break;
        float fi = float(i);
        float A = amp * pow(0.7, fi) * 0.62;
        float kk = k0 * (0.55 + 0.42 * fi);
        float tf = cos(osc * (1.0 + mod(fi, 2.0)) * th + TAU * h11(fi + 6.0));
        v += A * cos(kk * r - 0.785) / sqrt(0.55 + kk * r * 0.32) * cos((fi + mod(fi, 3.0)) * phi + TAU * h11(fi + 8.0)) * tf;
      }
    }
    if (pass == 0) h = v; else if (pass == 1) g.x = (v - h) / e; else g.y = (v - h) / e;
  }
  return h;
}

// march one sheet; returns hit distance (or -1). hg = (h, gx, gz)
float sheetHit(vec3 ro, vec3 rd, float yoff, int kind, float amp, int steps, out vec3 hg, out vec2 xz) {
  hg = vec3(0.0); xz = vec2(0.0);
  float amax = amp * 1.05 + 1e-3;
  if (abs(rd.y) < 1e-4) return -1.0;
  float ta = (yoff + amax - ro.y) / rd.y, tb = (yoff - amax - ro.y) / rd.y;
  float t0 = max(min(ta, tb), 0.0), t1 = max(ta, tb);
  if (t1 <= 0.0) return -1.0;
  float th = k_theta();
  vec2 g; float prevT = t0, prevF = 0.0; bool have = false;
  float hit = -1.0;
  for (int i = 0; i <= MAXS; i++) {
    if (i > steps) break;
    float t = t0 + (t1 - t0) * float(i) / float(steps);
    vec3 pos = ro + rd * t;
    float f = pos.y - yoff - hField(pos.xz, kind, th, amp, g);
    if (i > 0 && f * prevF <= 0.0) {
      float a = prevT, b = t, fa = prevF;
      for (int k = 0; k < 4; k++) {
        float m = 0.5 * (a + b); vec3 pm = ro + rd * m;
        float fm = pm.y - yoff - hField(pm.xz, kind, th, amp, g);
        if (fm * fa <= 0.0) b = m; else { a = m; fa = fm; }
      }
      hit = 0.5 * (a + b); break;
    }
    prevT = t; prevF = f;
  }
  if (hit < 0.0) return -1.0;
  vec3 ph = ro + rd * hit; float hh = hField(ph.xz, kind, th, amp, g);
  hg = vec3(hh, g); xz = ph.xz;
  return hit;
}

// attached particles on the sheet: returns (core, halo, peakness)
vec3 particles(vec2 xz, vec3 hg, float tdist, float kindW, float sheetId) {
  float cs = 0.06;
  vec2 cell = floor(xz / cs);
  float th = k_theta();
  float core = 0.0, halo = 0.0;
  float rad = max(p_particleR, tdist * k_px() * 0.55);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cid = cell + vec2(float(i), float(j));
    vec2 hh = h22(cid + sheetId * 19.0);
    float keep = step(hh.x, p_density);
    if (keep < 0.5) continue;
    vec2 c = (cid + 0.25 + 0.5 * h22(cid * 1.7 + 3.0 + sheetId)) * cs;
    // displacement follows the field's own gradient with a fixed per-particle phase (closed in theta)
    float ph = TAU * h21(cid + sheetId * 7.0);
    vec2 gd; hField(c, int(kindW), th, p_amp, gd);
    c += gd * p_drift * 0.4 * cos(float(p_osc) * th + ph) ;
    vec2 d = xz - c;
    float dd = length(d);
    float bright = 0.55 + 0.9 * h21(cid * 3.1 + sheetId);
    core += bright * exp(-(dd * dd) / (rad * rad));
    halo += bright * exp(-dd / (rad * 5.0));
  }
  return vec3(core, halo, 0.0);
}

vec3 hmSky(vec2 uv) {
  float g = smoothstep(-0.9, 0.7, uv.y);
  vec3 c = mix(u_a2 * 0.28, u_bg, g);
  c += u_a0 * 0.035 * exp(-pow(uv.y - 0.05, 2.0) * 6.0);
  return c;
}

mat3 camBasis(vec3 ro, vec3 target) {
  vec3 f = normalize(target - ro), r = normalize(cross(vec3(0.0, 1.0, 0.0), f)), u = cross(f, r);
  return mat3(r, u, f);
}

vec4 scene_main(vec2 uv, vec2 fc, int variant) {
  float th = k_theta();
  int kind = 0; int sheets = 3;
  float pitch = p_tilt, dist = 2.1, fovK = 0.9, camH, amp = p_amp;
  float zoomK = 1.0;
  if (variant == 1) { kind = 0; sheets = 1; amp = p_amp * 0.85; }                 // Nodal Sea
  if (variant == 2) { kind = 0; sheets = 2; }                                      // Amber Antinodes
  if (variant == 3) { kind = 1; sheets = 2; }                                      // Crosswave Veil
  if (variant == 4) { kind = 2; sheets = 2; }                                      // Resonant Basin
  if (variant == 5) { kind = 3; sheets = 1; pitch = max(p_tilt, 0.95); }           // Silver Interference
  int steps = min(k_q() == 0 ? 24 : k_q() == 1 ? 38 : 56, MAXS);
  float yaw = p_orbit * k_calm() * sin(th);
  camH = sin(pitch) * dist;
  vec3 ro = vec3(sin(yaw) * dist * cos(pitch), camH, -cos(yaw) * dist * cos(pitch));
  vec3 target = vec3(0.0, -0.05, 0.0);
  mat3 B = camBasis(ro, target);
  vec3 rd = normalize(B * vec3(uv * fovK, 1.0));
  vec3 K = normalize(vec3(cos(radians(p_keyAngle)), 0.8, sin(radians(p_keyAngle))));
  vec3 col = hmSky(uv);
  float T = 1.0;
  float amax = amp * 1.05;
  for (int s = 0; s < 3; s++) {
    if (s >= sheets) break;
    float yoff = -float(s) * (0.16 + 0.5 * amp);
    vec3 hg; vec2 xz;
    float t = sheetHit(ro, rd, yoff, kind, amp, steps, hg, xz);
    if (t < 0.0) continue;
    float edge = 1.0 - smoothstep(1.35, 2.0, length(xz * vec2(1.0, 0.9)));      // finite plate fades out
    if (edge < 0.004) continue;
    vec3 n = normalize(vec3(-hg.y, 1.0, -hg.z));
    float ndl = max(dot(n, K), 0.0);
    float ndv = clamp(dot(n, -rd), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 3.0);
    vec3 hv = normalize(K - rd);
    float spec = pow(max(dot(n, hv), 0.0), 60.0);
    float peak = smoothstep(0.18, 0.62, hg.x / (amax + 1e-3));
    float warm = p_warmth * peak * (variant == 2 ? 2.0 : 1.6);
    float fadeD = exp(-t * 0.18);
    vec3 base = mix(u_a2 * 0.8, u_a0, 0.25 + 0.5 * ndl);
    vec3 surf = base * (0.3 + 0.8 * ndl) * 0.6 + u_ink * spec * 0.9 + u_a0 * fres * 0.55;
    surf = mix(surf, u_a1 * (1.3 + 1.2 * ndl), clamp(warm, 0.0, 1.0));
    // nodal contour: |h| / |grad h| is the distance to the node on the surface
    float gl = max(length(hg.yz), 0.06);
    float nd = abs(hg.x) / gl;
    float nodeW = p_nodeWidth * (variant == 1 ? 1.6 : variant == 2 ? 0.0 : 1.0);
    float node = nodeW > 0.0 ? exp(-pow(nd / max(nodeW, 1e-4), 2.0)) : 0.0;
    node *= 1.0 - smoothstep(0.0, 0.5, t * k_px() * 5.0 / max(nodeW, 1e-3) * 0.02);
    vec3 em = mix(u_a0, u_ink, 0.6) * node * (s == 0 ? 0.7 : 0.18);       // contours read on the top sheet; lower sheets stay quiet
    em += u_a1 * pow(smoothstep(0.25, 0.65, hg.x / (amax + 1e-3)), 1.5) * clamp(warm, 0.0, 1.0) * (variant == 2 ? 4.2 : 2.4);              // amber light concentrated at the peaks
    vec3 pcl = particles(xz, hg, t, float(kind), float(s));
    float pw = variant == 2 ? (0.3 + 1.6 * peak) : 1.0;
    vec3 pcol = mix(u_a0 * 1.3, u_a1 * 1.6, clamp(warm + peak * 0.3, 0.0, 1.0));
    em += pcol * pcl.x * 2.2 * pw + pcol * pcl.y * 0.16 * pw;
    float alpha = clamp(p_opacity * (0.55 + 0.9 * fres) * (1.0 + (variant == 3 ? 0.5 : 0.0)), 0.0, 0.95) * edge;
    col += T * (surf * alpha + em * edge) * fadeD;
    T *= (1.0 - alpha);
  }
  return vec4(col, 1.0);
}

vec4 motif(vec2 uv, vec2 fc) {
  return scene_main(uv, fc, 4);
}
