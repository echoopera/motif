// @module sdf — 2D/3D signed distance primitives, operators, and raymarch macros.
// GLSL ES has no function pointers, so the march/normal/shadow/AO helpers are macros over your scene function
// name. Your scene function must have the signature `float NAME(vec3 p)` (or return .x of a vec2 via a wrapper).
// @requires

// ---- 2D ----
float am_sdCircle(vec2 p, float r) { return length(p) - r; }
float am_sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float am_sdHex(vec2 p, float r) { const vec3 k = vec3(-0.866025404, 0.5, 0.577350269); p = abs(p); p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy; p -= vec2(clamp(p.x, -k.z * r, k.z * r), r); return length(p) * sign(p.y); }
float am_sdStar(vec2 p, float r, int n, float m) { // n points, m in 2..n inner sharpness (Quílez)
  float an = PI / float(n), en = PI / m; vec2 acs = vec2(cos(an), sin(an)), ecs = vec2(cos(en), sin(en));
  float bn = mod(atan(p.x, p.y), 2.0 * an) - an; p = length(p) * vec2(cos(bn), abs(sin(bn)));
  p -= r * acs; p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y); return length(p) * sign(p.x);
}
// Polar repeat: n copies around the origin (kaleidoscopes, mandalas, radial mograph).
vec2 am_polarRep(vec2 p, float n) { float a = TAU / n; float t = atan(p.y, p.x) + a * 0.5; t = mod(t, a) - a * 0.5; return length(p) * vec2(cos(t), sin(t)); }
vec2 am_kaleido(vec2 p, float n) { p = am_polarRep(p, n); p.y = abs(p.y); return p; }
// Hex grid: returns (local xy, cell id xy).
vec4 am_hexGrid(vec2 p) {
  const vec2 s = vec2(1.0, 1.7320508);
  vec4 c = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
  vec4 h = vec4(p - c.xy * s, p - (c.zw + 0.5) * s);
  return dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, c.xy) : vec4(h.zw, c.zw + 0.5);
}

// ---- 3D ----
float am_sdSphere(vec3 p, float r) { return length(p) - r; }
float am_sdRoundBox3(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float am_sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = sat(dot(pa, ba) / dot(ba, ba)); return length(pa - ba * h) - r; }
float am_sdOcta(vec3 p, float s) { p = abs(p); return (p.x + p.y + p.z - s) * 0.57735027; }
// Gyroid sheet as a CONSERVATIVE bound (class: bound). |grad g| <= sqrt(6) for g = sin.cos sums, so dividing by
// scale * sqrt(6) never overshoots the zero set. (The raw gyroid is only an implicit function, not a distance.)
float am_sdGyroidShell(vec3 p, float scale, float thick) { p *= scale; return (abs(dot(sin(p), cos(p.yzx))) - thick) / (scale * 2.4494897); }
// Smooth boolean with a blend factor for colour/material mixing: returns (d, h) where h = 0 -> a, 1 -> b.
vec2 am_sminH(float a, float b, float k) { float h = sat(0.5 + 0.5 * (b - a) / k); return vec2(mix(b, a, h) - k * h * (1.0 - h), 1.0 - h); }
float am_smin3(float a, float b, float k) { k *= 6.0; float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * h * k * (1.0 / 6.0); } // cubic, C2
// Twist and bend are not isometries: they stretch space by up to L = sqrt(1 + (k * r)^2) at radius r from the axis.
// Divide the deformed distance by that L (am_twistLip) or the result is no longer a bound.
float am_twistLip(float k, float rmax) { return sqrt(1.0 + k * k * rmax * rmax); }
vec3 am_twist(vec3 p, float k) { float c = cos(k * p.y), s = sin(k * p.y); return vec3(mat2(c, -s, s, c) * p.xz, p.y).xzy; }
vec3 am_bend(vec3 p, float k) { float c = cos(k * p.x), s = sin(k * p.x); return vec3(mat2(c, -s, s, c) * p.xy, p.z); }
vec3 am_repLim(vec3 p, float s, vec3 l) { return p - s * clamp(floor(p / s + 0.5), -l, l); }

// ---- camera ----
// Look-at camera: returns ray direction for uv with focal length f (≈ 1.5 normal, 2.5 tele, 0.9 wide).
vec3 am_camRay(vec3 ro, vec3 ta, vec2 uv, float f, float roll) {
  vec3 w = normalize(ta - ro), u = normalize(cross(w, vec3(sin(roll), cos(roll), 0.0))), v = cross(u, w);
  return normalize(uv.x * u + uv.y * v + f * w);
}

// ---- raymarch macros ----
// AM_MARCH(MAP, ro, rd, tmax, STEPS, t, hit): sphere tracing (Hart 1996). Correct ONLY when MAP is class `exact` or
// `bound` (see the field module). The 0.9 factor absorbs float error; it is not a fix for a field that overestimates.
#define AM_MARCH(MAP, RO, RD, TMAX, STEPS, T, HIT) { T = 0.0; HIT = false; for (int i_ = 0; i_ < 256; i_++) { if (i_ >= STEPS) break; float d_ = MAP(RO + RD * T); if (d_ < 0.0005 * T + 0.0005) { HIT = true; break; } T += d_ * 0.9; if (T > TMAX) break; } }
// Tetrahedral normal (4 taps, Quílez).
#define AM_NORMAL(MAP, P) normalize(vec3(1, -1, -1) * MAP(P + vec3(1, -1, -1) * 0.0007) + vec3(-1, -1, 1) * MAP(P + vec3(-1, -1, 1) * 0.0007) + vec3(-1, 1, -1) * MAP(P + vec3(-1, 1, -1) * 0.0007) + vec3(1, 1, 1) * MAP(P + vec3(1, 1, 1) * 0.0007))
// Soft shadow with improved penumbra (Aaltonen / Quílez). RES: result in 0..1, K: hardness (8 soft .. 64 hard).
#define AM_SHADOW(MAP, RO, RD, K, RES) { RES = 1.0; float t_ = 0.02, ph_ = 1e10; for (int i_ = 0; i_ < 40; i_++) { float h_ = MAP(RO + RD * t_); float y_ = h_ * h_ / (2.0 * ph_); float d_ = sqrt(max(h_ * h_ - y_ * y_, 0.0)); RES = min(RES, K * d_ / max(0.0, t_ - y_)); ph_ = h_; t_ += clamp(h_, 0.01, 0.3); if (RES < 0.002 || t_ > 6.0) break; } RES = sat(RES); RES = RES * RES * (3.0 - 2.0 * RES); }
// Ambient occlusion, 5 taps along the normal.
#define AM_AO(MAP, P, N, RES) { float o_ = 0.0, s_ = 1.0; for (int i_ = 0; i_ < 5; i_++) { float h_ = 0.01 + 0.11 * float(i_); o_ += (h_ - MAP(P + N * h_)) * s_; s_ *= 0.85; } RES = sat(1.0 - 2.2 * o_); }
