// Phi Bloom: Quiet Unfold. Form: sparse lattice, low relief. Material: matte ivory, minimal rim. Motion: a single unfold wave, no rotation.
// Phi Bloom: golden-angle botanical sculpture.
// Field classes (all exact 2D analytic coverage; nothing here is marched):
//   blade   exact   tapered-blade signed distance, distance divided by the profile slope (conservative edge)
//   lattice exact   n-th site at r = s*sqrt(n), angle = n*GA, found by inverting r(n) and scanning a bounded index window
//   spiral  bound   logarithmic scaffold distance r*dphi/sqrt(1+b^2) (distance to the nearest arm, used for a 2 px emissive line)
//   ring    exact   polar-repeat of blades, three nearest repeats evaluated
// Loop: every temporal term is an integer harmonic of theta; "flow" translates the lattice by whole indices per loop and
// every petal attribute is a smooth function of its effective index, so petal m at p=1 equals petal m+k at p=0.

#define P_PETALS p_petals
#define P_TAPER p_taper
#define P_FLOW p_flow
#define P_PITCH p_pitch
#define P_UNFOLD p_unfold
const float GA = 2.399963229728653;
const int KJ = 27;                       // half window: 55 candidate indices per layer (proven reach below)

// smooth per-identity attribute (continuous in the effective index so lattice flow loops exactly)
float nh(float n, float salt) {
  float i = floor(n), f = n - i; f = f * f * (3.0 - 2.0 * f);
  return mix(h11(i + salt * 131.7), h11(i + 1.0 + salt * 131.7), f);
}

struct Blade { vec3 col; float a; };

// profile of a tapered blade, u in -1..1 along the axis; returns half width
float bladeHW(float u, float W, float taper) {
  float t = 0.5 * u + 0.5;
  return W * pow(max(1.0 - u * u, 0.0), 0.8) * (1.0 - taper * t * 0.92) * (0.55 + 0.9 * (1.0 - abs(t - 0.34)));
}
// signed distance (uv units) to the blade outline, conservative: divided by sqrt(1+slope^2)
float bladeSD(vec2 b, float L, float W, float taper) {
  float u = clamp(b.x / L, -1.0, 1.0);
  float hw = bladeHW(u, W, taper);
  float e = 0.02; float hw2 = bladeHW(clamp(u + e, -1.0, 1.0), W, taper);
  float slope = (hw2 - hw) / (e * L);
  float d = (abs(b.y) - hw) / sqrt(1.0 + slope * slope);
  return max(d, abs(b.x) - L);
}

// material of one blade. b: blade frame (x along axis), kb: key light in blade frame
Blade shadeBlade(vec2 b, float L, float W, float taper, float soft, float id, vec3 kb, float far, vec3 tintA, vec3 tintB) {
  Blade o; o.col = vec3(0.0); o.a = 0.0;
  float d = bladeSD(b, L, W, taper);
  float cov = k_cover(d, soft);
  if (cov < 0.002) return o;
  float u = clamp(b.x / L, -1.0, 1.0), t = 0.5 * u + 0.5;
  float hw = max(bladeHW(u, W, taper), 1e-4);
  float ny = clamp(b.y / hw, -1.0, 1.0);
  // pseudo-normal: cylindrical across the width, V-fold along the midrib, lengthwise curl
  float fold = sign(ny) * (0.35 + 0.65 * abs(ny));
  vec3 n = normalize(vec3(u * 0.30, fold * 0.9, 0.5 + 0.5 * sqrt(max(1.0 - ny * ny, 0.0))));
  float ndl = dot(n, kb);
  float diff = clamp((ndl + 0.35) / 1.35, 0.0, 1.0);
  vec3 hv = normalize(kb + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, hv), 0.0), 46.0) * (0.35 + 0.65 * (1.0 - abs(ny)));
  float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.5);
  // ground: dark jade contact at the base rising to ivory, champagne toward the rim and tip
  vec3 base = k_mix(u_a2 * 0.55, u_ink, smoothstep(0.0, 0.34, t));
  float edge = 1.0 - smoothstep(0.0, 0.30, (hw - abs(b.y)) / max(hw, 1e-4));
  base = k_mix(base, tintA, 0.55 * edge + 0.25 * smoothstep(0.55, 1.0, t));
  // translucent transmission: light passing through thin edges and tips, tinted by the blade
  float thin = (1.0 - smoothstep(0.0, 0.5, 1.0 - abs(ny))) * 0.0 + edge * 0.7 + smoothstep(0.6, 1.0, t) * 0.6;
  float tr = p_translucency * thin * (0.4 + 0.6 * clamp(0.5 - 0.5 * ndl, 0.0, 1.0));
  vec3 col = base * (0.22 + 1.15 * diff);
  col += u_ink * spec * 0.55;
  col += tintA * fres * p_rim * 0.55 * (0.4 + 0.6 * diff) + tintA * edge * p_rim * 0.7;
  col += tintB * tr * 1.1;
  // copper caustic threads: thin curves that follow the blade (midrib-converging), brighter facing the key
  if (p_caustic > 0.001 && k_q() > 0) {
    float w = sin(ny * 11.0 + sin(u * 5.0 + id * 9.0) * 1.7 + id * 6.0);
    float th = pow(0.5 + 0.5 * w, 22.0) * smoothstep(0.0, 0.4, t) * (1.0 - smoothstep(0.7, 1.0, t));
    col += tintB * th * p_caustic * (0.45 + 1.6 * diff) * (1.0 - far);
  }
  // faint veins along the form
  if (k_q() > 0) {
    float vn = abs(fract(ny * 4.0 + 0.5) - 0.5);
    col *= 1.0 - 0.10 * (1.0 - smoothstep(0.0, 0.07, vn)) * smoothstep(0.0, 0.5, t) * (1.0 - far);
  }
  o.col = col; o.a = cov * (1.0 - 0.18 * p_translucency * edge);
  return o;
}

// ---------------------------------------------------------------------------------------------
// Layer: golden-angle lattice. rn = s*pow(n, e). flowPh is the whole-index translation (0..k).
// Reach proof: a blade of half length L at radius r touches indices within dn = 2 r L / (e... s^2) (for e=0.5);
// the half window KJ covers L <= KJ*s^2/(2r); L is clamped to 0.9 of that.
vec4 phiLayer(vec2 p, float N, float Rf, float lenK, float widK, float soft, float salt, float rotA, float flowPh,
              float unfold, float far, vec3 tintA, vec3 tintB, float minR, float tilt, float roundness) {
  float r = length(p);
  float s = Rf / sqrt(N);
  float r2 = (r / s) * (r / s);
  float n0 = floor(r2 - flowPh);
  vec3 acc = vec3(0.0); float cov = 0.0;
  float th = k_theta();
  vec3 K = k_key();
  float reachCap = 0.9 * float(KJ) * s * s / max(2.0 * r, 0.12);
  for (int j = -KJ; j <= KJ; j++) {
    float m = n0 + float(j);
    float ne = m + flowPh;
    if (ne < 0.0 || ne > N) continue;
    float vis = smoothstep(N, N * 0.86, ne) * smoothstep(0.0, 5.0, ne);
    float rel = ne / N;
    float wave = 0.5 - 0.5 * cos(th - TAU * 0.35 * sqrt(rel));      // unfold wave travelling out along the radius
    unfold *= k_calm();
    float rn = s * sqrt(ne) * (1.0 + unfold * wave * 0.5);
    if (rn < minR) continue;
    float an = ne * GA + rotA;
    vec2 cs = vec2(cos(an), sin(an));
    vec2 c = rn * cs;
    float ph = nh(ne, 1.0);
    float breathe = 1.0 + p_breath * k_calm() * sin(th + TAU * ph);
    float L = min(lenK * (0.45 + 1.1 * sqrt(rel)) * (0.82 + 0.4 * nh(ne, 2.0)) * breathe * (1.0 - 0.38 * unfold * wave), reachCap);
    float W = L * widK * (0.8 + 0.4 * nh(ne, 3.0));
    vec2 d = p - c;
    if (dot(d, d) > (L * 1.15 + soft * 2.0) * (L * 1.15 + soft * 2.0)) continue;
    float ang = an + tilt;
    vec2 ax = vec2(cos(ang), sin(ang));
    vec2 b = vec2(dot(d, ax), dot(d, vec2(-ax.y, ax.x)));
    vec3 kb = vec3(dot(K.xy, ax), dot(K.xy, vec2(-ax.y, ax.x)), K.z);
    Blade bl = shadeBlade(b, L, W, roundness, soft, ne * 0.173 + salt, kb, far, tintA, tintB);
    float a = bl.a * vis;
    if (a < 0.002) continue;
    // contact shadow of this blade on what lies beneath
    if (k_q() > 0) {
      vec2 off = -K.xy * L * 0.30;
      float ds = bladeSD(b + vec2(dot(off, ax), dot(off, vec2(-ax.y, ax.x))), L, W, roundness);
      float sh = (1.0 - smoothstep(-L * 0.10, L * 0.16, ds)) * 0.26 * vis;
      acc *= 1.0 - sh * (1.0 - a);
    }
    acc = mix(acc, bl.col, a);
    cov = cov + a * (1.0 - cov);
  }
  return vec4(acc, cov);
}

// ring layer (crown / orbital): polar repeat of blades, tangent or radial, three nearest repeats
vec4 ringLayer(vec2 p, float rk, int cnt, float rotA, float L, float W, float taper, float soft, float salt, float tiltR, float far,
               vec3 tintA, vec3 tintB, float tangent) {
  float r = length(p);
  if (abs(r - rk) > L * 1.3 + soft * 3.0) return vec4(0.0);
  float nn = float(cnt);
  float phi = atan(p.y, p.x) - rotA;
  float idx = floor(phi / (TAU / nn) + 0.5);
  vec3 acc = vec3(0.0); float cov = 0.0; vec3 K = k_key(); float th = k_theta();
  for (int j = -1; j <= 1; j++) {
    float i = idx + float(j);
    float an = i * (TAU / nn) + rotA;
    vec2 cs = vec2(cos(an), sin(an));
    vec2 c = rk * cs;
    float ph = h11(mod(i, nn) * 3.1 + salt);
    float breathe = 1.0 + p_breath * k_calm() * sin(th + TAU * ph);
    float Li = L * breathe * (0.85 + 0.3 * ph), Wi = W * (0.85 + 0.3 * h11(mod(i, nn) + salt + 5.0));
    vec2 d = p - c;
    vec2 ax = tangent > 0.5 ? vec2(-cs.y, cs.x) : cs; ax = vec2(ax.x * cos(tiltR) - ax.y * sin(tiltR), ax.x * sin(tiltR) + ax.y * cos(tiltR));
    vec2 b = vec2(dot(d, ax), dot(d, vec2(-ax.y, ax.x)));
    vec3 kb = vec3(dot(K.xy, ax), dot(K.xy, vec2(-ax.y, ax.x)), K.z);
    Blade bl = shadeBlade(b, Li, Wi, taper, soft, mod(i, nn) * 0.37 + salt, kb, far, tintA, tintB);
    if (bl.a < 0.002) continue;
    acc = mix(acc, bl.col, bl.a); cov = cov + bl.a * (1.0 - cov);
  }
  return vec4(acc, cov);
}

// fern: logarithmic spiral spine r = r0 exp(b a) with paired leaflets; unrolls and re-curls through a closed bell
vec4 fernLayer(vec2 p, float rot0, float curl, float Lk, float soft, float salt, float far, vec3 tintA, vec3 tintB, float mirror) {
  vec3 acc = vec3(0.0); float cov = 0.0; vec3 K = k_key(); float th = k_theta();
  if (mirror > 0.5) p.x = -p.x;
  const int M = 34;
  float bsp = P_PITCH;
  float total = (3.1 + 1.4 * curl) * TAU * 0.5;
  vec2 sp = vec2(0.0);
  for (int i = 0; i < M; i++) {
    float t = float(i) / float(M - 1);
    float amax = total * (0.74 + 0.26 * k_calm() * (0.5 - 0.5 * cos(th)));
    float a = (1.0 - t) * amax;                                   // spine angle: tip curls tighter at bell = 0
    float rr = 0.62 * exp(-bsp * 2.1 * (amax - a));
    float an = a + rot0;
    vec2 P = rr * vec2(cos(an), sin(an));
    vec2 tang = normalize(vec2(-sin(an), cos(an)) * 1.0 + vec2(cos(an), sin(an)) * bsp * 2.1);
    for (int sd = 0; sd < 2; sd++) {
      float sg = sd == 0 ? 1.0 : -1.0;
      float ph = h11(float(i) * 2.3 + salt + float(sd) * 7.0);
      float L = Lk * (1.25 - 0.95 * t) * (0.85 + 0.3 * ph) * (1.0 + p_breath * k_calm() * sin(th + TAU * ph));
      vec2 ax = vec2(tang.x * cos(sg * 1.05) - tang.y * sin(sg * 1.05), tang.x * sin(sg * 1.05) + tang.y * cos(sg * 1.05));
      vec2 c = P + ax * L * 0.9;
      vec2 d = p - c;
      if (dot(d, d) > L * L * 1.5 + soft * soft * 9.0) continue;
      vec2 b = vec2(dot(d, ax), dot(d, vec2(-ax.y, ax.x)));
      vec3 kb = vec3(dot(K.xy, ax), dot(K.xy, vec2(-ax.y, ax.x)), K.z);
      Blade bl = shadeBlade(b, L, L * 0.34, 0.7, soft, float(i) * 0.31 + salt, kb, far, tintA, tintB);
      if (bl.a < 0.002) continue;
      acc = mix(acc, bl.col, bl.a); cov = cov + bl.a * (1.0 - cov);
    }
  }
  // rachis
  float dmin = 1e3;
  for (int i = 0; i < M - 1; i++) {
    float t0 = float(i) / float(M - 1), t1 = float(i + 1) / float(M - 1);
    float am = total * (0.74 + 0.26 * k_calm() * (0.5 - 0.5 * cos(th)));
    float a0 = (1.0 - t0) * am, a1 = (1.0 - t1) * am;
    float r0 = 0.62 * exp(-bsp * 2.1 * (am - a0)), r1 = 0.62 * exp(-bsp * 2.1 * (am - a1));
    vec2 A = r0 * vec2(cos(a0 + rot0), sin(a0 + rot0)), B = r1 * vec2(cos(a1 + rot0), sin(a1 + rot0));
    dmin = min(dmin, sdSeg(p, A, B) - mix(0.0075, 0.0018, t0));
  }
  float rc = k_cover(dmin, soft);
  acc = mix(acc, mix(u_ink, tintA, 0.45) * (0.55 + 0.6 * clamp(K.z, 0.0, 1.0)), rc);
  cov = cov + rc * (1.0 - cov);
  return vec4(acc, cov);
}

vec3 phiGround(vec2 uv, vec2 c, float fogK) {
  float r = length(uv - c);
  vec3 g = mix(u_a2 * 0.30, u_bg, smoothstep(0.0, 1.05, r));
  g = mix(g, u_bg * 0.6, smoothstep(0.4, 1.3, length(uv * vec2(1.0, 0.8))) * 0.6);
  g += u_a0 * 0.030 * exp(-r * r * 6.0) * (1.0 + p_core);
  return g;
}

vec4 scene_main(vec2 uv, vec2 fc, int variant) {
  float th = k_theta();
  vec2 asp = M_asp();
  vec2 c0 = vec2(-0.05, 0.12);
  vec2 orb = p_orbit * k_calm() * vec2(cos(th), sin(th) * 0.8);                 // closed camera orbit
  float N = float(P_PETALS);
  float px = k_px();
  float turnsRot = TAU * float(p_turns) * k_phase();                  // whole field: integer turns per loop
  float flowPh = float(P_FLOW) * k_phase();
  float ds = p_depth;
  vec3 far = vec3(0.0);
  // palette roles: ink ivory, a0 champagne, a1 copper, a2 jade
  vec3 champ = u_a0, copper = u_a1;
  vec3 col = phiGround(uv, c0 + orb * 0.5, ds);
  float Rf = 0.50;
  float lenK = p_bladeLen, widK = 0.46;
  float taper = P_TAPER;
  vec4 L1, L2, L3;
  vec2 pf = uv - (c0 - orb * 0.6 * ds * 2.0);                          // far stratum: moves against the camera
  vec2 pm = uv - c0;
  vec2 pn = uv - (c0 + orb * 1.5 * ds * 4.0);                          // near stratum: moves with it, further

  if (variant == 4) {                                                   // Jade Crown: rings of upright blades
    int rings = clamp(P_PETALS / 24, 3, 9);
    float L = lenK * 2.4, W = L * 0.30;
    for (int k = 0; k < 9; k++) {
      if (k >= rings) break;
      float kk = float(k) / float(max(rings - 1, 1));
      float rk = 0.10 + 0.50 * pow(kk, 0.85);
      int cnt = 8 + k * 5;
      float dir = (k % 2 == 0) ? 1.0 : -1.0;
      float rotk = turnsRot * dir + float(k) * 0.37;
      vec2 pk = pm * (1.0 - ds * 0.9 * (1.0 - kk));
      vec4 R = ringLayer(pk, rk * (1.0 - ds * 0.9 * (1.0 - kk)), cnt, rotk, L * (0.6 + 0.6 * kk), W * (0.6 + 0.6 * kk), taper, px * 1.2, float(k) * 11.0, 0.0, 1.0 - kk, champ, copper, 0.0);
      col = mix(col, R.rgb, R.a);
    }
  } else if (variant == 7) {                                            // Orbital Petals: tilted rings of tangent petals
    int rings = clamp(P_PETALS / 30, 3, 8);
    for (int k = 0; k < 8; k++) {
      if (k >= rings) break;
      float kk = float(k) / float(max(rings - 1, 1));
      float tilt = 0.5 + 0.9 * h11(float(k) * 5.0 + 1.0);
      float sa = TAU * h11(float(k) * 9.0 + 2.0);
      mat2 sq = mat2(cos(sa), sin(sa), -sin(sa), cos(sa));
      vec2 q = sq * pm; q.y /= (0.50 + 0.45 * kk * (0.5 + 0.5 * cos(th * 1.0 + float(k)))); q = transpose(sq) * q;
      float dir = (k % 2 == 0) ? 1.0 : -1.0;
      float rk = (0.16 + 0.34 * kk) * (1.0 + (kk - 0.5) * ds * 3.0);   // depth spacing spreads the rings in depth
      vec4 R = ringLayer(q, rk, 10 + 4 * k, TAU * float(max(p_turns, 1)) * k_phase() * dir + float(k) * 0.9, lenK * 1.9, lenK * 0.62, taper, px * 1.2, float(k) * 7.0, 0.0, 0.8 - 0.8 * kk, champ, copper, 1.0);
      col = mix(col, R.rgb, R.a);
    }
  } else if (variant == 2) {                                            // Copper Fern: log-spiral spine with leaflets
    float curl = P_UNFOLD * 3.0 + 0.6;
    vec4 F2 = fernLayer(pf * 1.15 + vec2(0.05, 0.0), -0.9 - turnsRot, curl, lenK * 1.5, px * 2.5, 31.0, 0.7, champ, copper, 1.0);
    col = mix(col, F2.rgb * 0.55, F2.a);
    vec4 F1 = fernLayer(pm, 0.6 + turnsRot, curl, lenK * 1.8, px * 1.2, 7.0, 0.0, champ, copper, 0.0);
    col = mix(col, F1.rgb, F1.a);
  } else {
    // phyllotaxis variants
    float e1 = 1.0, rotA = turnsRot + 0.6;
    float lk = lenK, wk = widK, tl = 0.55, rd = taper, sN = N;
    float rotFar = -turnsRot + 1.9;
    if (variant == 1) { lk = lenK * 0.55; wk = 0.82; tl = 0.2; rd = taper * 0.4; sN = min(N * 1.5, 240.0 * 1.25); }       // Golden Seed: rounded florets
    if (variant == 3) { lk = lenK * 1.15; wk = 0.40; tl = 0.9; }                                                      // Ivory Helix: swept blades
    if (variant == 5) { lk = lenK * 1.35; wk = 0.5; tl = 0.35; }                                                      // Spiral Canopy
    if (variant == 8) { lk = lenK * 0.95; wk = 0.5; }                                                                 // Quiet Unfold
    float Rfa = Rf * (variant == 3 ? 1.05 : 1.0);
    L1 = phiLayer(pf * 1.22, sN * 0.8, Rfa, lk * 0.95, wk, px * 3.5, 21.0, rotFar, flowPh * 0.7, P_UNFOLD * 0.5, 1.0, champ, copper, 0.0, tl, rd);
    col = mix(col, L1.rgb * (u_a2 * 1.5 + 0.03) * 0.55, L1.a * 0.55);       // far stratum: jade-tinted, never a grey haze
    L2 = phiLayer(pm, sN, Rfa, lk, wk, px * 1.2, 3.0, rotA, flowPh, P_UNFOLD, 0.0, champ, copper, 0.0, tl, rd);
    if (variant == 6) {                                                 // Twin Phyllotaxis: counter-rotating second lattice
      vec4 T2 = phiLayer(pm * 1.0, sN * 0.618, Rfa * 0.96, lk * 1.2, wk, px * 1.2, 17.0, -turnsRot * 2.0 + 2.2, -flowPh, P_UNFOLD, 0.0, copper, champ, 0.0, -tl, rd);
      col = mix(col, T2.rgb * 0.8, T2.a);
    }
    col = mix(col, L2.rgb, L2.a);
    // logarithmic spiral scaffold: separate from phyllotaxis, 2 px emissive thread with a travelling pulse
    {
      float r = max(length(pm), 1e-3);
      float b = max(P_PITCH, 0.05);
      float a = log(r / 0.03) / b;
      float arms = 2.0;
      float dphi = k_wrapang((atan(pm.y, pm.x) - a - turnsRot * 0.0) * arms) / arms;
      float dd = abs(dphi) * r / sqrt(1.0 + b * b) - 0.0006;
      float pls = 0.35 + 0.65 * pulse(log(r) * 0.28, 1.0, 0.0, 0.22);
      float line = k_cover(dd, px * 1.6) * (1.0 - smoothstep(0.40, 0.66, r)) * smoothstep(0.03, 0.10, r);
      col = mix(col, champ * 3.2 * pls, line * 0.95);
      col += champ * 0.5 * pls * exp(-dd * 55.0) * 0.12 * smoothstep(0.03, 0.12, r);
    }
    // seed core: small, controlled, geometry stays visible
    float rc = length(pm);
    col += (champ * 2.2 + u_ink * 0.7) * p_core * 0.9 * exp(-rc * rc / (0.0016 + 0.0004 * p_core));
    col += champ * p_core * 0.05 * exp(-rc * 7.0);
    // near stratum: few large defocused blades that occlude the lower frame
    {
      float soft = px * 9.0 * (1.0 + 0.4 * ds / 0.12);
      L3 = phiLayer(pn * 0.92, 9.0, 1.05, lk * 4.6, 0.40, soft, 41.0, 0.7 + 0.10 * sin(th), flowPh * 0.0, 0.0, 0.0, champ, copper, 0.52, 0.4, rd);
      vec3 nc = L3.rgb * (vec3(0.11) + u_a2 * 0.55);
      col = mix(col, nc, L3.a * 0.95);
    }
  }
  // atmosphere: depth falloff to jade at the frame periphery keeps the focal area the sharpest, brightest region
  float rr = length((uv - c0) * vec2(1.0, 0.85));
  col = mix(col, u_a2 * 0.28 + u_bg, smoothstep(0.45, 1.25, rr) * 0.35);
  return vec4(col, 1.0);
}

vec4 motif(vec2 uv, vec2 fc) {
  return scene_main(uv, fc, 8);
}
