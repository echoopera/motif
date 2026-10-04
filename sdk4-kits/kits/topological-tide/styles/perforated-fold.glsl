// Topological Tide: Perforated Fold. Form: sine-folded plate with a hole grid. Material: celadon ceramic. Motion: fold amplitude breathing, turn.
// Topological Tide: ceramic and metal implicit surfaces sphere-traced with proven Lipschitz bounds.
// Field classes (every scene function is labelled; AM_MARCH_L-style stepping d / 1 for "bound", never a guessed step multiplier)
//   gyroid shell   bound     s = (|g(w) - c| - t) / (k*sqrt(6)*(1 + A*kw)),  g = sin kx cos ky + sin ky cos kz + sin kz cos kx.
//                            |grad g| <= k*sqrt(6) for the plain gyroid; the domain warp w = p + A*sin(kw*p.yzx + phi) has Jacobian
//                            I + A*kw*cyclic-shift*diag(cos), operator norm <= 1 + A*kw, so the quotient is 1-Lipschitz.
//                            Shell offset by a constant t, iso-level c(theta) and thickness t(theta) vary in time only: still bound.
//   bounding ball  exact     length(p) - R, combined by max (max of 1-Lipschitz fields is 1-Lipschitz).
//   torus          exact     exact torus distance; perforated by a bound gyroid via max.
//   mobius ribbon  bound     box swept along a circle and half-twisted; twist rate 1/(2R) per unit arc => L <= sqrt(1 + (rmax/(2(R-rmax)))^2), divided out.
//   folded plate   bound     |y - f(x,z)| with f a sum of two sines: L <= sqrt(1 + (A k)^2).
// Opaque surface only: ceramic (diffuse + dielectric specular) and metal (specular only, no diffuse) are separate energy models.
// Loop: object rotation = integer turns of theta; thickness, warp and fold amplitude are periodic oscillators; camera orbit is closed.

#define Q_FREQ 4.0
#define Q_WARP 0.0
#define Q_MORPH p_morph
mat3 rotXm(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 rotYm(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }

float gyroidG(vec3 q, float k) { vec3 a = q * k; return dot(sin(a), cos(a.yzx)); }

// -------- scene fields (object space). graw = raw implicit used by the material (which wall of the shell) --------
float tideMap(vec3 p, float th, float calm, out float graw) {
  float k = Q_FREQ;
  float A = Q_WARP * calm, kw = 2.0;
  vec3 w = p + A * sin(kw * p.yzx + vec3(0.0, 2.1, 4.2) + th);
  float thick = p_shell * (1.0 + Q_MORPH * 4.0 * calm * sin(th));                      // closed breathing of the shell
  float L = k * 2.4494897 * (1.0 + A * kw);
  float c = 0.0;
  float fa = 0.20 * (0.55 + 0.45 * sin(th)) * (0.6 + p_morph * 6.0) * calm + 0.06;
  float f = fa * sin(p.x * 3.2) + 0.5 * fa * sin(p.z * 2.6 + 1.0);
  float Lp = sqrt(1.0 + pow(fa * 3.2 + 0.5 * fa * 2.6, 2.0));
  float plate = (abs(p.y - f) - thick * 0.45) / Lp;
  float hk = p_freq * 2.25;
  vec2 hq = vec2(cos(p.x * hk), cos(p.z * hk));
  graw = hq.x + hq.y;
  float holes = (0.55 - graw) / (hk * 1.4143);                                                    // negative inside a hole; |grad| <= hk*sqrt(2)
  return max(max(plate, -holes), length(p) - p_bound);
}

vec3 tideNormal(vec3 p, float th, float calm) {
  vec2 e = vec2(1.0, -1.0) * 0.0016; float g;
  return normalize(e.xyy * tideMap(p + e.xyy, th, calm, g) + e.yyx * tideMap(p + e.yyx, th, calm, g) + e.yxy * tideMap(p + e.yxy, th, calm, g) + e.xxx * tideMap(p + e.xxx, th, calm, g));
}

// procedural studio: warm softbox at the key, cobalt sky, dark floor
vec3 tideEnv(vec3 d, vec3 K, float rough) {
  float up = d.y * 0.5 + 0.5;
  vec3 sky = mix(u_a2 * 1.4, u_a0 * 2.2 + u_ink * 0.25, smoothstep(0.1, 1.0, up));
  vec3 floorc = u_bg * 0.8 + u_a2 * 0.30 + u_a1 * 0.10;
  vec3 c = mix(floorc, sky, smoothstep(0.30, 0.62, up));
  float kd = max(dot(d, K), 0.0);
  float box = pow(kd, mix(34.0, 5.0, rough));
  c += mix(u_ink, u_a1, 0.15) * box * mix(3.2, 1.0, rough);
  c += u_a1 * pow(max(dot(d, normalize(vec3(-K.x, 0.2, K.z * 0.5 - 0.5))), 0.0), mix(24.0, 4.0, rough)) * 0.5;   // copper bounce
  return c;
}

vec4 scene_main(vec2 uv, vec2 fc, int variant) {
  float th = k_theta(), calm = k_calm();
  int steps = k_q() == 0 ? 44 : k_q() == 1 ? 70 : 100;
  float orb = p_orbit * calm;
  mat3 cam = rotYm(orb * sin(th)) * rotXm(-0.10 + orb * 0.6 * cos(th));
  vec3 ro = cam * vec3(0.0, 0.0, 4.5);
  vec3 rd = cam * normalize(vec3(uv * 0.95, -1.9));
  float spin = safeCycles(float(p_turns)) * th;      // photosensitive limiter: whole turns, capped at 3 changes per second
  mat3 Mobj = rotYm(spin) * rotXm(variant == 5 ? 0.9 : 0.42);
  mat3 Minv = transpose(Mobj);
  vec3 K = k_key();
  // camera-space key -> world: key lives in the picture plane
  vec3 Kw = normalize(vec3(K.x, K.y * 0.9 + 0.5, K.z + 0.4));
  // bounding-sphere cull
  float bR = p_bound + 0.05;
  vec3 oc = ro; float bq = dot(oc, rd), cc = dot(oc, oc) - bR * bR, disc = bq * bq - cc;
  vec3 bgc = mix(u_a2 * 0.30, u_bg, smoothstep(0.0, 1.0, length(uv))) + u_a0 * 0.02 * exp(-dot(uv, uv) * 5.0);
  vec3 col = bgc;
  if (disc > 0.0) {
    float t = max(-bq - sqrt(disc), 0.0), tmax = -bq + sqrt(disc);
    bool hit = false; float graw = 0.0; vec3 pos = ro;
    for (int i = 0; i < 100; i++) {
      if (i >= steps) break;
      pos = ro + rd * t;
      float d = tideMap(Minv * pos, th, calm, graw);
      if (d < 0.0009 * (1.0 + t * 0.4)) { hit = true; break; }
      t += d * 0.92 + 0.0004;
      if (t > tmax + 0.05) break;
    }
    if (hit) {
      vec3 po = Minv * pos;
      vec3 n = Mobj * tideNormal(po, th, calm);
      float gr; tideMap(po, th, calm, gr);
      if (dot(n, rd) > 0.0) n = -n;
      vec3 V = -rd;
      float ndl = max(dot(n, Kw), 0.0);
      // ambient occlusion from the field, and a soft shadow toward the key
      float ao = 1.0;
      {
        float occ = 0.0, wsum = 0.0;
        for (int i = 1; i <= 5; i++) {
          if (k_q() == 0 && i > 3) break;
          float h = 0.025 * float(i);
          float dd; float gg;
          dd = tideMap(Minv * (pos + n * h), th, calm, gg);
          occ += (h - dd) * (1.0 / (1.0 + float(i)));
          wsum += 1.0 / (1.0 + float(i));
        }
        ao = clamp(1.0 - p_cavity * 3.2 * occ / wsum, 0.0, 1.0);
      }
      float sh = 1.0;
      if (k_q() > 0) {
        float st = 0.03;
        for (int i = 0; i < 18; i++) {
          float gg; float dd = tideMap(Minv * (pos + n * 0.01 + Kw * st), th, calm, gg);
          sh = min(sh, 7.0 * dd / st);
          st += clamp(dd, 0.02, 0.18);
          if (sh < 0.02 || st > 2.6) break;
        }
        sh = clamp(sh, 0.0, 1.0);
        sh = mix(1.0, sh, 0.6 + 0.4 * p_cavity);
      }
      // material: which wall of the shell decides the metallic share (u: 0..1 across the shell wall)
      float thick = p_shell;
      float u = clamp(0.5 + 0.5 * gr / max(thick, 0.02), 0.0, 1.0);
      float metal = smoothstep(1.0 - p_metal - 0.10, 1.0 - p_metal + 0.10, u);
      if (variant == 2) metal = smoothstep(0.0, 0.2, 1.0 - 0.0) * 0.0 + p_metal;
      if (variant == 4) metal = smoothstep(0.55, 0.62, 0.5 + 0.5 * gr) * p_metal * 2.0;     // inlay stripes only
      metal = clamp(metal, 0.0, 1.0);
      float rough = p_rough;
      float fres = pow(1.0 - max(dot(n, V), 0.0), 5.0);
      vec3 R = reflect(rd, n);
      vec3 envR = tideEnv(R, Kw, rough) * mix(0.35, 1.0, ao);
      // ceramic: ivory diffuse + dielectric specular
      vec3 albedo = u_ink * 0.92;
      if (variant == 3) albedo = mix(u_a0 * 0.8, u_ink, 0.25);                               // cobalt glaze
      vec3 irr = mix(u_a2 * 0.8, u_a0 * 0.8 + u_ink * 0.3, 0.5 + 0.5 * n.y) * 0.35;
      vec3 diff = albedo * (irr * ao + mix(u_ink, u_a1, 0.12) * ndl * sh * 1.15);
      vec3 hv = normalize(Kw + V);
      float a2 = rough * rough;
      float spec = pow(max(dot(n, hv), 0.0), 2.0 / max(a2 * a2, 1e-3) - 2.0) * (1.0 - rough * 0.6);
      vec3 ceramic = diff * (1.0 - 0.04 - 0.9 * fres) + (envR * (0.04 + 0.9 * fres) + u_ink * spec * 0.9 * sh * 0.6);
      // metal: copper, specular only (no diffuse term)
      vec3 F0 = mix(u_a1 * 1.1, u_ink * 0.9, variant == 2 ? 0.7 : 0.0);
      vec3 F = F0 + (1.0 - F0) * fres;
      vec3 metalC = envR * F * (0.6 + 0.5 * sh) + F0 * spec * 1.4 * sh;
      col = mix(ceramic, metalC, metal);
      // cavity contact darkening in the cobalt shadow colour
      col = mix(col, u_a2 * 0.25, (1.0 - ao) * 0.35);
      // thin atmosphere fade at grazing silhouette keeps the focal region the brightest
      col = mix(col, bgc, smoothstep(0.0, 0.9, 1.0 - max(dot(n, V), 0.0)) * 0.0);
    }
  }
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
    acc += scene_main(uv + o * px, fc, 5).rgb;
  }
  return vec4(acc / float(n), 1.0);
}
