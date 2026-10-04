// Harmonic Matter: Quiet Chladni. Form: Chladni plate nodal lines. Material: sand on dark metal. Motion: mode morph, very slow.
// Harmonic Matter: standing-wave membranes with attached particles.
// Field classes
//   wave surface   implicit  y = yoff + h(x,z,theta); located by a bounded slab march (step count = quality) then 5 bisections.
//                  |h| <= amax (sum of mode amplitudes), so the slab [yoff-amax, yoff+amax] provably contains the surface.
//   nodal contour  bound     |h| / |grad h| approximates distance to the node on the surface (exact to first order).
//   particles      exact     jittered 3x3 cell lookup in the surface (x,z) parameter space, displaced along grad h.
// Loop: every temporal term is an integer multiple of theta (standing waves cos(k*theta + phase)); static phases are seeded.

const int KMODES = 6;
const int MAXS = 30;

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
float hField(vec2 xz, int kind, float th, float amp, out vec2 g) { return hMode(xz, kind, th, amp, g); }
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

vec3 hmSky(vec2 uv) {
  float g = smoothstep(-0.9, 0.7, uv.y);
  vec3 c = mix(u_a2 * 0.28, u_bg, g);
  c += u_a0 * 0.035 * exp(-k_sq(uv.y - 0.05) * 6.0);
  return c;
}

mat3 camBasis(vec3 ro, vec3 target) {
  vec3 f = normalize(target - ro), r = normalize(cross(vec3(0.0, 1.0, 0.0), f)), u = cross(f, r);
  return mat3(r, u, f);
}

// ribbon / ridge / chladni families draw directly in the picture plane
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
  float line = exp(-k_sq(distNode / (p_nodeWidth * 1.4)));
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
    float near = exp(-k_sq(pv * 2.4));                                   // grains settle near nodes, smoothly
    if (hh.x > p_density * (0.15 + 0.85 * near)) continue;
    vec2 d = uv - c;
    col += mix(u_ink, u_a1, p_warmth * 0.6) * (0.8 + 0.8 * hh.y) * exp(-dot(d, d) / (p_particleR * p_particleR * 0.9)) * plate * (0.3 + near);
  }
  return col;
}

vec4 scene_main(vec2 uv, vec2 fc, int variant) {
  return vec4(hmChladni(uv, variant), 1.0);
}

vec4 motif(vec2 uv, vec2 fc) {
  int want = p_quality == QUALITY_LIVE ? 1 : (p_quality == QUALITY_BALANCED ? 2 : 4);
  int n = min(want, 4);
  float px = 1.0 / min(u_res.x, u_res.y);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    vec2 o = i == 0 ? vec2(-0.125, -0.375) : (i == 1 ? vec2(0.125, 0.375) : (i == 2 ? vec2(0.375, -0.125) : vec2(-0.375, 0.125)));
    acc += scene_main(uv + o * px, fc, 8).rgb;
  }
  return vec4(acc / float(n), 1.0);
}
