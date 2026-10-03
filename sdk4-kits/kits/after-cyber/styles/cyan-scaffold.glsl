// After Cyber: Cyan Scaffold. Form: lattice with diagonal struts, no glass. Material: cyan hairline. Motion: lattice relaxes and returns.
// After Cyber: smoky glass, cyan hairlines, selective acid-lime particles.
// Field classes
//   nodes     exact   stable lattice sites (grid / ring / jittered) found by inverting the sheet projection to its plane and scanning a (2W+1)^2 window;
//                     the dispersal offset is clamped to 0.85*W*cell so every node that can reach a pixel is inside the window (bound).
//   edges     exact   2D capsule distance between projected neighbours; weight = min(attachment weights) so a connection fades smoothly as nodes leave.
//   polyhedron exact  analytic ray vs convex half-space intersection (slab method), facet normal from the entering plane.
//   glass     approx  inexpensive local refraction: the lattice layer is re-evaluated at a screen offset along the facet normal; no depth-correct transport.
// Loop: one dissolve - transport - reassemble schedule per cycle with zero-velocity holds (k_ioh), staggered by a smooth function of position.
// Particles follow closed circles at integer harmonics with fixed seeded phases; every node and the facet displacement return exactly at the seam.

const float KPH = 1.618033988749895;

vec3 ndPos(vec2 cid, float cs, int variant, float th, out float s, out float wgt, out float id, out float lime, out float zq) {
  vec2 hh = h22(cid + 11.0);
  id = h21(cid + 3.3);
  vec2 hp = cid * cs;
  float jit = (variant == 6 ? 0.55 : variant == 7 ? 0.45 : 0.0);
  hp += (hh - 0.5) * cs * jit;
  if (variant == 4) {                                                           // covenant: concentric rings of nodes, cid = (index on ring, ring)
    float ring = cid.y; float nk = 6.0 + 3.0 * ring;
    float a = cid.x / nk * TAU + ring * 0.7;
    hp = (0.07 + 0.048 * ring) * vec2(cos(a), sin(a));
  }
  float und = 0.17 * sin(hp.x * 5.3 + 0.8) * cos(hp.y * 4.1 - 0.5);
  if (variant == 2 || variant == 5) und = 0.22 * sin(hp.x * 3.0 + hp.y * 2.0) + 0.2 * cos(hp.y * 4.0);
  zq = und;
  float stag = smoothstep(-0.25, 0.55, hp.x * 1.0 + hp.y * 0.25);
  float ph = float(p_cycles) * k_phase() - 0.28 * stag;
  s = k_ioh(ph, 0.34);                                                         // dissolve 0 -> 1 -> 0 with zero-velocity holds
  s = s * s * (3.0 - 2.0 * s);
  float calm = k_calm();
  s *= calm;
  wgt = 1.0 - smoothstep(0.02, 0.5, s);
  lime = step(h21(cid * 1.7 + 8.0), p_lime * (variant == 3 ? 2.6 : 1.0));
  float cap = 0.55 * 5.0 * cs;                                                   // keeps every node that can reach a pixel inside the +/-5 cell window
  float dr = min(p_disperse * (variant == 3 ? 1.8 : 1.0), variant == 4 ? 0.10 : cap);
  vec3 dir = normalize(vec3(hh.x - 0.2, hh.y - 0.5, h21(cid + 2.0) - 0.5) + vec3(0.0001));
  float ang = TAU * h21(cid * 2.3 + 5.0);
  float m = 1.0 + floor(h21(cid + 9.0) * 2.0);
  vec3 orb = vec3(cos(ang + m * th), sin(ang + m * th), 0.5 * sin(ang * 2.0 + th)) * (0.35 * dr);
  return vec3(hp, und) + (dir * dr * 0.8 + orb) * s;
}

// project a sheet point through the pose matrix and perspective
const vec2 AOFF = vec2(0.0, -0.02);                                            // centres the tilted sheet under the glass
vec2 ndProj(vec3 p, mat3 M, out float z) { vec3 w = M * p; z = w.z; return w.xy / (1.0 + 0.45 * w.z) * 0.86 + AOFF; }

vec3 afterLattice(vec2 q, mat3 M, int variant, float th) {
  float px = k_px();
  float cs = 1.05 / float(p_res);
  // invert the projection to the sheet plane to find the central lattice cell
  vec3 ro = vec3(0.0, 0.0, -1.0 / 0.45);                                       // matches ndProj: w.xy/(1+0.45 z)*1.12 -> camera at z = -1/0.45
  // plane z' = 0 in sheet space: n = M*(0,0,1), through the origin
  vec3 n = M * vec3(0.0, 0.0, 1.0);
  vec3 d3 = vec3((q - AOFF) * 0.45 / 0.86, 1.0);                                          // ray through the pixel for ndProj's camera
  float den = dot(n, d3);
  float tt = dot(n, -ro) / max(abs(den), 1e-3) * sign(den + 1e-6);
  vec3 P = ro + d3 * tt;
  vec2 pu = (transpose(M) * P).xy;
  if (variant == 4) pu = vec2(0.0);
  vec2 cell = floor(pu / cs + 0.5);
  vec3 col = vec3(0.0);
  float partR = p_particleR;
  float edgeR = p_edgeR;
  int W = 4;
  vec3 hair = u_a0;
  float halfN = float(p_res) * 0.5;
  for (int j = -5; j <= 5; j++) for (int i = -5; i <= 5; i++) {
    vec2 cid = cell + vec2(float(i), float(j));
    if (variant == 4) {
      if (abs(i) > 3 || j > 4 || j < -4) continue;
      float kr = float(j + 4); float nk = 6.0 + 3.0 * kr;
      if (float(abs(i)) > floor(0.5 * (nk - 1.0))) continue;                    // never visit the same node twice on a small ring
      float idxk = floor(atan(q.y, q.x) / TAU * nk + 0.5);
      cid = vec2(mod(idxk + float(i) + nk, nk), kr);
    } else if (abs(cid.x) > halfN || abs(cid.y) > halfN) continue;
    float s, w, id, lime, zq;
    vec3 P0 = ndPos(cid, cs, variant, th, s, w, id, lime, zq);
    float z0; vec2 A = ndProj(P0, M, z0);
    float depthK = clamp(1.0 - 0.8 * z0, 0.25, 1.4);
    // connections to forward neighbours (right, down; scaffold adds diagonals; organic circuit routes Manhattan)
    if (variant != 4 && variant != 3) {
      for (int k = 0; k < 4; k++) {
        if (k >= 2 && variant != 1 && variant != 6) break;
        vec2 dn = k == 0 ? vec2(1.0, 0.0) : k == 1 ? vec2(0.0, 1.0) : k == 2 ? vec2(1.0, 1.0) : vec2(1.0, -1.0);
        if (variant == 6 && k >= 2) { if (h21(cid + dn * 7.0) > 0.35) continue; }
        vec2 cb = cid + dn;
        if (abs(cb.x) > halfN || abs(cb.y) > halfN) continue;
        float s2, w2, id2, lm2, zq2;
        vec3 P1 = ndPos(cb, cs, variant, th, s2, w2, id2, lm2, zq2);
        float z1; vec2 B = ndProj(P1, M, z1);
        float len = length(B - A);
        float fadeLen = 1.0 - smoothstep(p_connect * 1.15, p_connect * 2.6, len);
        float we = min(w, w2) * fadeLen;
        if (we < 0.01) continue;
        float d;
        if (variant == 7) {                                                       // organic circuit: horizontal run then vertical, rounded
          vec2 Cc = vec2(B.x, A.y);
          d = min(sdSeg(q, A, Cc), sdSeg(q, Cc, B));
        } else d = sdSeg(q, A, B);
        float zk = clamp(1.0 - 0.8 * mix(z0, z1, 0.5), 0.25, 1.3);
        float wd = edgeR * (0.8 + 0.5 * zk);
        float core = 1.0 - smoothstep(wd - 0.75 * px, wd + 0.75 * px, d);
        col += hair * (core * 1.2 + exp(-d / (wd * 7.0 + px)) * 0.05) * we * zk;
      }
    }
    // node / particle: cyan when attached, lime when selected, grows slightly while dispersed
    float d = length(q - A);
    float r = partR * (1.0 + 0.7 * s) * (0.8 + 0.4 * depthK);
    vec3 nc = lime > 0.5 ? u_a1 : mix(u_a0, u_ink, 0.5);
    float bright = (lime > 0.5 ? 1.0 : 0.55) * (0.6 + 1.6 * s) * depthK;
    if (variant == 4) bright *= 1.4;
    col += nc * (exp(-d * d / (r * r)) * 2.2 + exp(-d / (r * 5.0)) * 0.11) * bright;
    // lime particles leave a short closed trail while in transport
    if (lime > 0.5 && s > 0.05) {
      float s3, w3, i3, l3, z3;
      float th2 = th - 0.18;
      vec3 Pp = ndPos(cid, cs, variant, th2, s3, w3, i3, l3, z3);
      float zz; vec2 Bp = ndProj(Pp, M, zz);
      float dt = sdSeg(q, A, Bp);
      col += u_a1 * exp(-dt * dt / (r * r * 0.5)) * 0.5 * s;
    }
  }
  return col;
}

// convex polyhedron: dodecahedron planes (icosa vertices) or an octahedron, h = inradius; per-face displacement for the broken variant
vec3 polyN(int i, int kind) {
  if (kind == 1) { return normalize(vec3((i & 1) == 0 ? 1.0 : -1.0, (i & 2) == 0 ? 1.0 : -1.0, (i & 4) == 0 ? 1.0 : -1.0)); }
  int g = i / 4, r = i - g * 4; float sa = (r & 1) == 0 ? 1.0 : -1.0, sb = (r & 2) == 0 ? 1.0 : -1.0;
  vec3 v = g == 0 ? vec3(0.0, sa, sb * KPH) : g == 1 ? vec3(sa, sb * KPH, 0.0) : vec3(sb * KPH, 0.0, sa);
  return normalize(v);
}

vec4 scene_main(vec2 uv, vec2 fc, int variant) {
  float th = k_theta(), px = k_px(), calm = k_calm();
  vec2 q = uv + vec2(0.0, 0.0);
  mat3 Mi = mat3(1.0);
  mat3 M = mat3(cos(0.55 + 0.2 * calm * sin(th)), 0.0, -sin(0.55 + 0.2 * calm * sin(th)), 0.0, 1.0, 0.0, sin(0.55 + 0.2 * calm * sin(th)), 0.0, cos(0.55 + 0.2 * calm * sin(th)));
  { float a = -0.30 + 0.05 * calm * cos(th); mat3 X = mat3(1.0, 0.0, 0.0, 0.0, cos(a), sin(a), 0.0, -sin(a), cos(a)); M = X * M; }
  // smoke ground: loop noise, very low amplitude, tinted
  float sm = 0.5 + 0.5 * ln3(vec3(uv * 1.3, 0.0), 1.0, 0.5);
  float sm2 = 0.5 + 0.5 * ln3(vec3(uv * 3.1 + 5.0, 1.0), 1.0, 0.4);
  vec3 smoke = u_a2 * (0.10 + 0.55 * sm * sm2) * exp(-dot(uv * vec2(1.0, 0.7), uv * vec2(1.0, 0.7)) * 1.6);
  vec3 col = u_bg + smoke * (variant == 7 ? 0.7 : variant == 7 ? 1.0 : 1.0) * (variant == 6 ? 1.6 : 1.0) * 0.8;
  vec3 lat = afterLattice(q, M, variant, th);
  col += lat;
  return vec4(col, 1.0);
}

vec4 motif(vec2 uv, vec2 fc) {
  return scene_main(uv, fc, 1);
}
