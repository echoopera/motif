// Harmonic Matter: Phase Ribbons. Form: 2D stacked wave traces. Material: glowing line, pearls. Motion: phase-staggered standing wave.
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
    float w = (p_nodeWidth*0.01) * (1.5 + 2.0 * (1.0 - zj));
    float line = exp(-k_sq(dy / w));
    float fillm = smoothstep(0.0, 0.5, (y - uv.y)) * p_opacity * 0.6 * exp(-(y - uv.y) * 3.0);
    vec3 c = mix(u_a0, u_ink, 0.5) * (0.5 + 1.5 * (1.0 - zj));
    float peak = smoothstep(0.4, 1.0, h / (p_amp * 2.6 + 1e-3)) * p_warmth;
    c = mix(c, u_a1 * 2.0, peak);
    col += c * line * (0.6 + 1.4 * (1.0 - zj) * (1.0 - zj)) + u_a2 * fillm * (1.0 - zj * 0.6);
    // pearls riding the ribbon
    float pr = (p_particleR*0.001) * 1.2;
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

vec4 scene_main(vec2 uv, vec2 fc, int variant) {
  return vec4(hmRibbons(uv, variant), 1.0);
}

vec4 motif(vec2 uv, vec2 fc) {
  int want = p_quality == QUALITY_LIVE ? 1 : (p_quality == QUALITY_BALANCED ? 2 : 4);
  int n = min(want, 4);
  float px = 1.0 / min(u_res.x, u_res.y);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    vec2 o = i == 0 ? vec2(-0.125, -0.375) : (i == 1 ? vec2(0.125, 0.375) : (i == 2 ? vec2(0.375, -0.125) : vec2(-0.375, 0.125)));
    acc += scene_main(uv + o * px, fc, 6).rgb;
  }
  return vec4(acc / float(n), 1.0);
}
