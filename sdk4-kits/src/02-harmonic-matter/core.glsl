// Harmonic Matter: standing-wave membranes with attached particles.
// Field classes
//   wave surface   implicit  y = yoff + h(x,z,theta); located by a bounded slab march (step count = quality) then 5 bisections.
//                  |h| <= amax (sum of mode amplitudes), so the slab [yoff-amax, yoff+amax] provably contains the surface.
//   nodal contour  bound     |h| / |grad h| approximates distance to the node on the surface (exact to first order).
//   particles      exact     jittered 3x3 cell lookup in the surface (x,z) parameter space, displaced along grad h.
// Loop: every temporal term is an integer multiple of theta (standing waves cos(k*theta + phase)); static phases are seeded.

const int KMODES = 6;
//@if 4 5
const int MAXS = 34;      // FD-gradient fields cost 3 evaluations per step: smaller bound keeps work under half of the sandbox limit
//@endif
//@if 0 1 2 3 6 7 8
const int MAXS = 56;
//@endif

//@if 0 1 2 3 6 7 8
// kind 0: separable standing modes, analytic gradient.  kind 1: crossing families (odd modes rotated 90 deg), analytic.
// kind 2: radial basin (FD gradient).  kind 3: two-source interference (FD gradient).
float hMode(vec2 xz, int kind, float th, float ampTotal, out vec2 g) {
  float h = 0.0; g = vec2(0.0);
  float wl = p_wavelength; float k0 = TAU / wl;
  float osc = float(p_osc);
  float sumA = (1.0 - pow(0.66, float(p_modes))) / 0.34;
  for (int i = 0; i < KMODES; i++) {
    if (i >= p_modes) break;
    float fi = float(i);
    float A = ampTotal * pow(0.66, fi) / sumA;
    float kx = k0 * (0.75 + 0.5 * h11(fi * 1.7 + 1.0) + 0.28 * fi);
    float kz = k0 * (0.75 + 0.5 * h11(fi * 2.9 + 2.0) + 0.24 * fi);
    float ph = TAU * h11(fi * 3.3 + 3.0), ps = TAU * h11(fi * 4.1 + 4.0), tp = TAU * h11(fi * 5.3 + 5.0);
    float tf = cos(osc * (1.0 + mod(fi, 2.0)) * th + tp);
    vec2 q = xz;
    if (kind == 1 && mod(fi, 2.0) > 0.5) q = vec2(-xz.y, xz.x);
    float s = sin(kx * q.x + ph), c = cos(kz * q.y + ps);
    float hv = A * s * c * tf;
    vec2 gq = vec2(A * kx * cos(kx * q.x + ph) * c, -A * kz * s * sin(kz * q.y + ps)) * tf;
    h += hv;
    g += (kind == 1 && mod(fi, 2.0) > 0.5) ? vec2(gq.y, -gq.x) : gq;
  }
  return h;
}
//@endif
//@if 4 5
float hField(vec2 xz, int kind, float th, float amp, out vec2 g) {
    float e = 0.004; float h = 0.0;
  float osc = float(p_osc);
  float k0 = TAU / p_wavelength;
  float sumA = 0.0;
  for (int pass = 0; pass < 3; pass++) {
    vec2 q = xz + (pass == 1 ? vec2(e, 0.0) : pass == 2 ? vec2(0.0, e) : vec2(0.0));
    float v = 0.0;
//@if 4
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
//@endif
//@if 5
    {
      vec2 s1 = vec2(-0.32, 0.0), s2 = vec2(0.32, 0.0);
      for (int i = 0; i < KMODES; i++) {
        if (i >= p_modes) break;
        float fi = float(i);
        float A = amp * pow(0.72, fi) * 0.42;
        float kk = k0 * (0.8 + 0.5 * fi);
        float tf = cos(osc * (1.0 + mod(fi, 2.0)) * th + TAU * h11(fi + 12.0));
        float r1 = length(q - s1) + 1e-3, r2 = length(q - s2) + 1e-3;
        v += A * (cos(kk * r1) / sqrt(0.5 + kk * r1 * 0.3) + cos(kk * r2) / sqrt(0.5 + kk * r2 * 0.3)) * tf;
      }
    }
//@endif
    if (pass == 0) h = v; else if (pass == 1) g.x = (v - h) / e; else g.y = (v - h) / e;
  }
  return h;
}

//@endif
//@if 0 1 2 3 6 7 8
float hField(vec2 xz, int kind, float th, float amp, out vec2 g) { return hMode(xz, kind, th, amp, g); }
//@endif
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

//@if 6 7 8
// ribbon / ridge / chladni families draw directly in the picture plane
vec3 hmRibbons(vec2 uv, int variant) {
  float th = k_theta();
  vec3 col = hmSky(uv);
  float ribbons = float(6 + p_modes * 2);
  vec2 g;
  for (int j = 0; j < 20; j++) {
    if (float(j) >= ribbons) break;
    float zj = float(j) / (ribbons - 1.0);
    float depth = 1.0 + zj * 1.6;
    float xw = uv.x * depth * 1.4;                                       // world x seen at this ribbon's depth
    float yb = 0.36 - zj * 0.9 + 0.05;
    float h = hField(vec2(xw, zj * 1.4 - 0.7), 0, th + zj * 1.2 * floor(float(p_osc) + 0.5) * 0.0, p_amp * 2.6, g);
    float ph = TAU * h11(float(j) * 1.9) ;
    float y = (yb + h * (1.0 - zj * 0.5)) / depth * 1.0 - 0.18 + 0.0;
    // second harmonic travelling term with an integer harmonic of theta, offset per ribbon
    y += 0.03 * sin(xw * (TAU / p_wavelength) * 0.6 + float(p_osc) * th + ph) / depth;
    float dy = abs(uv.y - y);
    float w = p_nodeWidth * (1.5 + 2.0 * (1.0 - zj));
    float line = exp(-pow(dy / w, 2.0));
    float fillm = smoothstep(0.0, 0.5, (y - uv.y)) * p_opacity * 0.6 * exp(-(y - uv.y) * 3.0);
    vec3 c = mix(u_a0, u_ink, 0.5) * (0.5 + 1.5 * (1.0 - zj));
    float peak = smoothstep(0.4, 1.0, h / (p_amp * 2.6 + 1e-3)) * p_warmth;
    c = mix(c, u_a1 * 2.0, peak);
    col += c * line * (0.6 + 1.4 * (1.0 - zj) * (1.0 - zj)) + u_a2 * fillm * (1.0 - zj * 0.6);
    // pearls riding the ribbon
    float pr = p_particleR * 1.2;
    float cs = 0.06 + 0.1 * zj;
    float cid = floor(xw / cs + 0.0);
    for (int k = -1; k <= 1; k++) {
      float id = cid + float(k);
      if (h11(id * 5.1 + float(j)) > p_density) continue;
      float cx = (id + 0.5) * cs;
      float hy; vec2 gg; hy = hField(vec2(cx, zj * 1.4 - 0.7), 0, th, p_amp * 2.6, gg);
      float yy = (yb + hy * (1.0 - zj * 0.5)) / depth - 0.18 + 0.03 * sin(cx * (TAU / p_wavelength) * 0.6 + float(p_osc) * th + ph) / depth;
      vec2 d = vec2(uv.x - cx / (depth * 1.4), uv.y - yy);
      col += mix(u_ink, u_a1, p_warmth * smoothstep(0.2, 1.0, hy / (p_amp * 2.6))) * 2.2 * exp(-dot(d, d) / (pr * pr * 2.0)) / depth;
    }
  }
  return col;
}

vec3 hmRidges(vec2 uv, int variant) {
  float th = k_theta();
  vec3 col = hmSky(uv);
  float rows = float(10 + p_modes * 2);
  vec2 g;
  for (int j = 0; j < 22; j++) {
    float jj = rows - 1.0 - float(j);                                    // far to near
    if (jj < 0.0) break;
    float zj = jj / (rows - 1.0);
    float depth = 1.0 + zj * 2.0;
    float xw = uv.x * depth * 1.5;
    float h = hField(vec2(xw, zj * 2.0 - 1.0), 1, th, p_amp * 2.2, g);
    float ys = -0.78 + zj * 1.25 + h * (1.3 - zj * 0.7) * (1.0 - zj * 0.3);
    float below = uv.y - ys;
    float inside = smoothstep(0.0, 0.004, -below);
    vec3 body = mix(u_bg * 1.2, u_a2 * (0.5 + 0.8 * (1.0 - zj)), 0.55 + 0.4 * (-below < 0.2 ? 1.0 : 0.0));
    body *= 0.45 + 0.8 * (1.0 - zj) + p_opacity;
    col = mix(col, body, inside * (0.7 + 0.3 * p_opacity * 2.0));
    float rim = exp(-pow(below / (p_nodeWidth * (1.0 + 2.2 * (1.0 - zj))), 2.0));
    float crest = smoothstep(0.3, 1.0, h / (p_amp * 2.2));
    vec3 rc = mix(mix(u_a0, u_ink, 0.6), u_a1 * 2.0, crest * p_warmth);
    col += rc * rim * (0.35 + 1.8 * (1.0 - zj) * (1.0 - zj));
    // dust on crests
    float cs = 0.05;
    float id = floor(uv.x / cs);
    if (h11(id * 3.7 + jj) < p_density * 0.5) {
      vec2 d = vec2(uv.x - (id + 0.5) * cs, below);
      col += u_ink * 1.5 * exp(-dot(d, d) / (p_particleR * p_particleR * 2.0)) * (1.0 - zj * 0.7);
    }
  }
  return col;
}

vec3 hmChladni(vec2 uv, int variant) {
  float th = k_theta();
  vec3 col = hmSky(uv) * 0.7;
  vec2 q = uv * vec2(1.0, 1.0) * (1.0 / 0.46);
  float L = 0.50;
  // plate is a rounded square; mode mixes cos(a x)cos(b z) - cos(b x)cos(a z), weights close on theta
  float pm = 0.0; vec2 grad = vec2(0.0);
  float sumw = 0.0;
  for (int i = 0; i < KMODES; i++) {
    if (i >= p_modes) break;
    float fi = float(i);
    float a = 2.0 + fi, b = 3.0 + fi + mod(fi, 2.0);
    float w = (0.5 + 0.5 * cos(float(p_osc) * th + TAU * h11(fi + 20.0))) * pow(0.78, fi);
    vec2 p = q * (TAU * 0.5 / p_wavelength * 0.55);
    pm += w * (cos(a * p.x) * cos(b * p.y) - cos(b * p.x) * cos(a * p.y));
    grad += w * vec2(-a * sin(a * p.x) * cos(b * p.y) + b * sin(b * p.x) * cos(a * p.y), -b * cos(a * p.x) * sin(b * p.y) + a * cos(b * p.x) * sin(a * p.y));
    sumw += w;
  }
  pm /= max(sumw, 1e-3); grad /= max(sumw, 1e-3);
  float distNode = abs(pm) / max(length(grad) * 0.8, 0.25) * 0.46 * 0.55;
  float plate = k_cover(sdRoundBox(uv, vec2(0.44, 0.78), 0.04), k_px());
  vec3 pc = mix(u_bg * 1.6, u_a2 * 0.5, 0.5);
  col = mix(col, pc + u_a0 * 0.035 * (0.5 + 0.5 * pm), plate);
  // sand grains gather on the node lines: bright with a narrow core, glow follows the field
  float line = exp(-pow(distNode / (p_nodeWidth * 1.4), 2.0));
  col += mix(u_a0, u_ink, 0.55) * line * plate * 1.5;
  col += u_a0 * exp(-distNode / (p_nodeWidth * 5.0)) * 0.2 * plate;
  float cs = 0.014;
  vec2 cell = floor(uv / cs);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 cid = cell + vec2(float(i), float(j));
    vec2 hh = h22(cid);
    vec2 c = (cid + 0.5 + 0.5 * (h22(cid + 5.0) - 0.5)) * cs;
    vec2 pq = c / 0.46 * (TAU * 0.5 / p_wavelength * 0.55);
    float pv = 0.0; float sw = 0.0;
    for (int m = 0; m < KMODES; m++) {
      if (m >= p_modes) break;
      float fm = float(m); float a = 2.0 + fm, b = 3.0 + fm + mod(fm, 2.0);
      float w = (0.5 + 0.5 * cos(float(p_osc) * th + TAU * h11(fm + 20.0))) * pow(0.78, fm);
      pv += w * (cos(a * pq.x) * cos(b * pq.y) - cos(b * pq.x) * cos(a * pq.y)); sw += w;
    }
    pv /= max(sw, 1e-3);
    float near = exp(-pow(pv * 2.4, 2.0));                                   // grains settle near nodes, smoothly
    if (hh.x > p_density * (0.15 + 0.85 * near)) continue;
    vec2 d = uv - c;
    col += mix(u_ink, u_a1, p_warmth * 0.6) * (0.8 + 0.8 * hh.y) * exp(-dot(d, d) / (p_particleR * p_particleR * 0.9)) * plate * (0.3 + near);
  }
  return col;
}

//@endif
vec4 scene_main(vec2 uv, vec2 fc, int variant) {
//@if 6
  return vec4(hmRibbons(uv, variant), 1.0);
//@endif
//@if 7
  return vec4(hmRidges(uv, variant), 1.0);
//@endif
//@if 8
  return vec4(hmChladni(uv, variant), 1.0);
//@endif
//@if 0 1 2 3 4 5
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
    float peak = smoothstep(0.45, 1.0, hg.x / (amax + 1e-3));
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
    vec3 em = mix(u_a0, u_ink, 0.6) * node * 0.75;
    vec3 pcl = particles(xz, hg, t, float(kind), float(s));
    float pw = variant == 2 ? (0.3 + 1.6 * peak) : 1.0;
    vec3 pcol = mix(u_a0 * 1.3, u_a1 * 1.6, clamp(warm + peak * 0.3, 0.0, 1.0));
    em += pcol * pcl.x * 2.2 * pw + pcol * pcl.y * 0.16 * pw;
    float alpha = clamp(p_opacity * (0.55 + 0.9 * fres) * (1.0 + (variant == 3 ? 0.5 : 0.0)), 0.0, 0.95) * edge;
    col += T * (surf * alpha + em * edge) * fadeD;
    T *= (1.0 - alpha);
  }
  return vec4(col, 1.0);
//@endif
}
