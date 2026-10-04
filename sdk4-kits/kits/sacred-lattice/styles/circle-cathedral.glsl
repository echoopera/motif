// Sacred Lattice: Circle Cathedral. Form: 6-fold circle lattice + tick bands (2D, no polyhedra). Material: brass line. Motion: counter-rotating bands.
// Sacred Lattice: nested polyhedral cages, circles and chord networks in gold and glass.
// Field classes
//   edges     exact   2D capsule distance to the perspective projection of each polyhedron edge (edges found by vertex dot product)
//   nodes     exact   sphere projected to a disc, radius follows depth
//   facets    approx  glass: additive barycentric triangle coverage (tetra/octa only), brighter toward the edge; not refraction
//   circles   exact   |length(p-c)-r| and inscribed n-gon capsule chords
// Loop: cage rotations are integer turns of theta about a fixed tilted axis; static tilts and offsets are seeded; the camera
// orbit is a closed ellipse; facet breathing is sin(theta + seeded phase).

#define Q_CIRCLES p_circleLayers
#define Q_ORBIT 0.0
#define Q_BREATH 0.0
#define Q_DEPTHSP 0.2
#define Q_QUALITY 1
#define Q_FACET 0.0
#define Q_KEY vec3(0.0, 0.0, 1.0)
#define Q_LEVELS 4
const float PHI = 1.618033988749895;

// polyhedra: type 0 tetra, 1 octa, 2 cube, 3 icosa (vertices normalised; edges where dot(vi,vj) == polyDot)
int polyN(int t) { return t == 0 ? 4 : t == 1 ? 6 : t == 2 ? 8 : 12; }
float polyDot(int t) { return t == 0 ? -0.33333334 : t == 1 ? 0.0 : t == 2 ? 0.33333334 : 0.4472136; }
vec3 polyV(int t, int i) {
  float f = float(i);
  if (t == 0) { vec3 v = vec3(i == 0 || i == 1 ? 1.0 : -1.0, i == 0 || i == 2 ? 1.0 : -1.0, i == 0 || i == 3 ? 1.0 : -1.0); return v * 0.57735027; }
  if (t == 1) { float s = i < 3 ? 1.0 : -1.0; int a = i - (i < 3 ? 0 : 3); return s * vec3(a == 0 ? 1.0 : 0.0, a == 1 ? 1.0 : 0.0, a == 2 ? 1.0 : 0.0); }
  if (t == 2) return vec3((i & 1) == 0 ? 1.0 : -1.0, (i & 2) == 0 ? 1.0 : -1.0, (i & 4) == 0 ? 1.0 : -1.0) * 0.57735027;
  int g = i / 4, r = i - g * 4; float sa = (r & 1) == 0 ? 1.0 : -1.0, sb = (r & 2) == 0 ? 1.0 : -1.0;
  vec3 v = g == 0 ? vec3(0.0, sa, sb * PHI) : g == 1 ? vec3(sa, sb * PHI, 0.0) : vec3(sb * PHI, 0.0, sa);
  return v * 0.5257311;
}

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0, -s, c, 0, 0, 0, 1); }

struct LV { vec3 col; float a; };

// one cage level: returns emissive colour (additive) of edges, nodes and glass facets
vec3 cage(vec2 q, int type, float Rk, mat3 M, float zoff, float edgeR, float facet, float nodeK, float lum, bool glassOn) {
  vec3 P[12];
  int N = polyN(type);
  for (int i = 0; i < 12; i++) {
    if (i >= N) break;
    vec3 v = M * polyV(type, i) * Rk;
    float z = v.z + zoff;
    float f = 1.0 / (1.0 + 0.55 * z);
    P[i] = vec3(v.xy * f, z);
  }
  vec3 acc = vec3(0.0);
  float ed = polyDot(type);
  float px = k_px();
  vec3 K = Q_KEY;
  for (int i = 0; i < 12; i++) {
    if (i >= N) break;
    for (int j = 0; j < 12; j++) {
      if (j >= i) break;
      vec3 a = polyV(type, i), b = polyV(type, j);
      if (abs(dot(a, b) - ed) > 0.02) continue;
      vec3 A = P[i], B = P[j];
      vec2 pa = q - A.xy, ba = B.xy - A.xy;
      float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
      float d = length(pa - ba * t);
      float z = mix(A.z, B.z, t);
      float depthK = clamp(0.62 - 0.55 * z / max(Rk, 0.05), 0.15, 1.2);       // nearer = brighter and thicker
      float w = edgeR * (0.65 + 0.7 * depthK);
      float core = 1.0 - smoothstep(w - 0.75 * px, w + 0.75 * px, d);
      float halo = exp(-d / (w * 7.0 + px)) * 0.09;
      acc += u_a0 * (core * 1.7 + halo) * depthK * lum;
      acc += u_ink * core * 0.5 * depthK * smoothstep(0.7, 1.0, depthK) * lum;
    }
  }
  for (int i = 0; i < 12; i++) {
    if (i >= N) break;
    float depthK = clamp(0.62 - 0.55 * P[i].z / max(Rk, 0.05), 0.15, 1.2);
    float d = length(q - P[i].xy);
    float rr = edgeR * (1.8 + 1.4 * depthK) * nodeK;
    acc += mix(u_a1, u_ink, 0.6) * (exp(-(d * d) / (rr * rr)) * 2.2 + (Q_QUALITY > 0 ? exp(-d / (rr * 4.0)) * 0.12 : 0.0)) * depthK * lum * nodeK;
  }
  if (glassOn && facet > 0.001) {
    // glass facets: additive, view-dependent. every vertex triple whose pairwise dots equal the edge dot is a face.
    for (int i = 0; i < 6; i++) {
      if (i >= N) break;
      for (int j = 0; j < 6; j++) {
        if (j >= i) break;
        for (int k = 0; k < 6; k++) {
          if (k >= j) break;
          vec3 a = polyV(type, i), b = polyV(type, j), c = polyV(type, k);
          if (abs(dot(a, b) - ed) > 0.02 || abs(dot(b, c) - ed) > 0.02 || abs(dot(a, c) - ed) > 0.02) continue;
          vec2 A = P[i].xy, B = P[j].xy, C = P[k].xy;
          vec2 v0 = B - A, v1 = C - A, v2 = q - A;
          float den = v0.x * v1.y - v1.x * v0.y;
          if (abs(den) < 1e-6) continue;
          float u = (v2.x * v1.y - v1.x * v2.y) / den, v = (v0.x * v2.y - v2.x * v0.y) / den;
          float w0 = 1.0 - u - v;
          float inside = smoothstep(-0.02, 0.0, min(w0, min(u, v)));
          if (inside <= 0.0) continue;
          vec3 nrm = normalize(M * normalize(a + b + c));
          float lit = 0.35 + 0.65 * max(dot(nrm, K), 0.0);
          float fr = k_sq(1.0 - clamp(abs(nrm.z), 0.0, 1.0));
          float edgeGlow = 1.0 - smoothstep(0.0, 0.35, min(w0, min(u, v)));
          acc += mix(u_a1, u_ink, 0.5) * facet * inside * (0.20 * lit + 0.9 * fr * 0.4 + 0.35 * edgeGlow) * lum;
        }
      }
    }
  }
  return acc;
}

vec3 latticeGround(vec2 uv, vec2 c) {
  float r = length(uv - c);
  vec3 g = mix(u_a2 * 0.30, u_bg, smoothstep(0.0, 1.0, r));
  g = mix(g, u_bg * 0.55, smoothstep(0.5, 1.4, length(uv * vec2(1.0, 0.8))));
  return g;
}

// circles and chord networks (flat sacred geometry)
vec3 circles(vec2 q, int count, float ratio, float R0, float edgeR, float th, float turns, float lum, int chordMode) {
  vec3 acc = vec3(0.0); float px = k_px();
  for (int j = 0; j < 8; j++) {
    if (j >= count) break;
    float fj = float(j);
    float r = R0 * pow(ratio, fj);
    float d = abs(length(q) - r);
    float w = edgeR * 0.8;
    float line = 1.0 - smoothstep(w - 0.75 * px, w + 0.75 * px, d);
    acc += u_a0 * (line * 1.1 + exp(-d / (w * 8.0 + px)) * 0.05) * lum * (0.6 + 0.4 * (1.0 - fj / 8.0));
    if (chordMode > 0) {
      int n = 3 + int(mod(fj, 4.0));
      float rot = turns * th * ((j % 2 == 0) ? 1.0 : -1.0) + fj * 0.35;
      float a0 = atan(q.y, q.x) - rot;
      float seg = TAU / float(n);
      float idx = floor(a0 / seg);
      vec2 A = r * vec2(cos(idx * seg + rot), sin(idx * seg + rot));
      vec2 B = r * vec2(cos((idx + 1.0) * seg + rot), sin((idx + 1.0) * seg + rot));
      float dc = sdSeg(q, A, B);
      acc += u_a1 * (1.0 - smoothstep(w * 0.6 - 0.75 * px, w * 0.6 + 0.75 * px, dc)) * 0.8 * lum;
      // vertex node on the ring
      float dn = min(length(q - A), length(q - B));
      acc += u_ink * exp(-dn * dn / (w * w * 5.0)) * 1.4 * lum;
    }
  }
  return acc;
}

vec4 scene_main(vec2 uv, vec2 fc, int variant) {
  float th = k_theta(), px = k_px();
  vec2 c0 = vec2(0.0, 0.03);
  vec2 q = uv - c0;
  vec3 col = latticeGround(uv, c0);
  float calm = k_calm();
  float orb = Q_ORBIT * calm;
  mat3 O = rotX(orb * sin(th)) * rotY(orb * 0.8 * cos(th));
  float breath = 1.0 + Q_BREATH * calm * sin(th + 1.7);
  int levels = Q_LEVELS;
  float R0 = 0.44 * (variant == 3 ? 1.06 : 1.0);
  float facet = Q_FACET * (0.75 + 0.25 * sin(th + 0.6));
  float lum = 1.0;
  float turns = float(p_cageTurns);
  float edgeR = p_edgeR;
  bool flat2d = variant == 4 || variant == 5;
  if (!flat2d) {
    for (int k = 0; k < 7; k++) {
      if (k >= levels) break;
      float fk = float(k);
      float Rk = R0 * pow(p_ratio, fk) * breath;
      int type = k % 2;                                                         // octa / tetra duals for the hero
      if (variant == 1) type = 1;                                              // octahedral chapel
      if (variant == 2) type = 0;                                              // tetrahedral orbit
      if (variant == 3) type = 3;                                              // golden icosahedron
      if (variant == 6) type = (k % 2 == 0) ? 3 : 2;                           // glass constellation
      if (variant == 8) type = (k % 2 == 0) ? 2 : 1;                           // silent symmetry
      float dir = (k % 2 == 0) ? 1.0 : -1.0;
      float spin = turns * th * dir * (variant == 2 ? (1.0 + mod(fk, 2.0)) : 1.0) * (variant == 8 ? 1.0 : 1.0);
      float tiltA = 0.55 + 0.9 * h11(fk * 3.7 + 1.0), tiltB = 6.28318 * h11(fk * 5.3 + 2.0);
      mat3 M = O * rotX(tiltA) * rotY(spin + tiltB) * rotZ(fk * 0.37);
      if (variant == 7) M = O * rotY(spin * 0.0 + tiltB) * rotX(0.0) * rotZ(turns * th * dir + fk * 0.4);   // axial halo: spin about the view axis
      if (variant == 7) M = O * rotX(0.35) * rotZ(turns * th * dir + fk * 0.4) * rotY(0.3 * fk);
      float zoff = (fk - 0.5 * float(levels - 1)) * Q_DEPTHSP * (variant == 1 ? 1.8 : 1.0);
      float inner = 0.55 + 0.45 * fk / max(float(levels - 1), 1.0);
      float nodeK = variant == 6 ? 1.8 : 1.0;
      bool glass = (type <= 1) && variant != 6;
      float er = edgeR * (variant == 3 ? 1.4 : variant == 8 ? 0.8 : 1.0);
      float fac = facet * (variant == 1 ? 1.6 : variant == 8 ? 0.5 : 1.0);
      if (variant == 6) { er = edgeR * 0.45; }
      col += cage(q, type, Rk, M, zoff, er, fac, nodeK, inner * lum, glass);
    }
  }
  // circle layers (hero: a few under the cages; variants 4/5/7: the subject)
  int cl = Q_CIRCLES;
  if (variant == 4) {                                                          // Circle Cathedral: overlapping rings on a 6-fold lattice
    float Rc = 0.17 * (1.0 + 0.06 * sin(th));
    for (int a = 0; a < 7; a++) {
      vec2 cc = a == 0 ? vec2(0.0) : Rc * 2.0 * vec2(cos(float(a - 1) * 1.0471976 + turns * th * 0.0), sin(float(a - 1) * 1.0471976));
      for (int b = 0; b < 3; b++) {
        float rr = Rc * (1.0 + 0.0) * (b == 0 ? 1.0 : b == 1 ? p_ratio * 1.0 : p_ratio * p_ratio);
        float d = abs(length(q - cc) - rr);
        float w = edgeR * 0.85;
        col += u_a0 * ((1.0 - smoothstep(w - 0.75 * px, w + 0.75 * px, d)) * 1.2 + exp(-d / (w * 8.0 + px)) * 0.05) * (b == 0 ? 1.0 : 0.55);
      }
    }
    for (int j = 0; j < 8; j++) {
      if (j >= cl) break;
      float r = 0.52 * pow(p_ratio, float(j) * 0.55);
      float d = abs(length(q) - r), w = edgeR * 0.7;
      float bandPh = turns * th * ((j % 2 == 0) ? 1.0 : -1.0);
      float a = atan(q.y, q.x) + bandPh;
      float tick = smoothstep(0.82, 1.0, 0.5 + 0.5 * cos(a * float(12 + 4 * j)));
      col += u_a1 * ((1.0 - smoothstep(w - 0.75 * px, w + 0.75 * px, d)) * 0.9 + tick * exp(-d * d / (0.0002)) * 0.9);
    }
  } else if (variant == 5) {                                                   // Nested Compass: rings with ticks and chord polygons
    col += circles(q, max(cl, 2), p_ratio, 0.48, edgeR, th, turns, 1.0, 1);
    for (int j = 0; j < 8; j++) {
      if (j >= cl) break;
      float r = 0.48 * pow(p_ratio, float(j));
      float a = atan(q.y, q.x) - turns * th * ((j % 2 == 0) ? 1.0 : -1.0);
      float ticks = float(24 - 2 * j);
      float tk = smoothstep(0.9, 1.0, 0.5 + 0.5 * cos(a * ticks));
      float band = exp(-k_sq((length(q) - r * 1.035) / 0.006));
      col += u_ink * tk * band * 0.8;
    }
    for (int k = 0; k < 7; k++) {                                              // inner compass needle cage
      if (k >= levels) break;
      float fk = float(k); float r = 0.46 * pow(p_ratio, fk);
      float ang = turns * th * ((k % 2 == 0) ? 1.0 : -1.0) + fk * 0.9;
      vec2 A = r * vec2(cos(ang), sin(ang)), B = -A;
      col += u_a0 * (1.0 - smoothstep(edgeR * 0.5 - 0.75 * px, edgeR * 0.5 + 0.75 * px, sdSeg(q, A, B))) * 0.6;
    }
  } else if (variant == 7 || variant == 0 || variant == 8 || variant == 1) {
    col += circles(q, cl, p_ratio, 0.5, edgeR, th, turns, variant == 8 ? 0.5 : 0.7, variant == 0 ? 1 : 0);
  }
  if (variant == 2) {                                                          // orbit tracks of the tetra cages
    for (int k = 0; k < 3; k++) {
      float r = 0.5 * pow(p_ratio, float(k));
      float ang = turns * th * (1.0 + float(k)) * ((k % 2 == 0) ? 1.0 : -1.0) + float(k) * 2.0;
      vec2 P = r * vec2(cos(ang), sin(ang) * 0.55);
      float d = length(q - P);
      col += u_a1 * exp(-d * d / (0.0009)) * 1.8;
      float ring = abs(length(q * vec2(1.0, 1.0 / 0.55)) - r);
      col += u_a0 * exp(-k_sq(ring / (edgeR * 1.2))) * 0.35;
    }
  }
  if (variant == 7) {                                                          // halo: bright ring around the axis
    float r = length(q); float ring = abs(r - 0.36);
    col += mix(u_a0, u_ink, 0.4) * (exp(-k_sq(ring / 0.004)) * 1.4 + exp(-ring / 0.05) * 0.18) * (0.8 + 0.2 * sin(th + atan(q.y, q.x) * 3.0));
  }
  // core light: controlled so the geometry stays visible at the focal point
  float rc = length(q);
  float core = p_core * (variant == 8 ? 0.35 : 1.0);
  col += (u_a0 * 1.6 + u_ink * 0.8) * core * 0.55 * exp(-rc * rc / 0.0011) + u_a0 * core * 0.05 * exp(-rc * 5.5);
  float rr = length((uv - c0) * vec2(1.0, 0.85));
  col = mix(col, u_bg * 0.7 + u_a2 * 0.10, smoothstep(0.5, 1.3, rr) * 0.3);
  return vec4(col, 1.0);
}

vec4 motif(vec2 uv, vec2 fc) {
  int want = p_quality == QUALITY_LIVE ? 1 : (p_quality == QUALITY_BALANCED ? 2 : 4);
  int n = min(want, 4);
  float px = 1.0 / min(u_res.x, u_res.y);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (i >= n) break;
    vec2 o = i == 0 ? vec2(-0.125, -0.375) : (i == 1 ? vec2(0.125, 0.375) : (i == 2 ? vec2(0.375, -0.125) : vec2(-0.375, 0.125)));
    acc += scene_main(uv + o * px, fc, 4).rgb;
  }
  return vec4(acc / float(n), 1.0);
}
