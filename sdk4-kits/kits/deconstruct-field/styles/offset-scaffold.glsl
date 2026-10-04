// Deconstruct Field: Offset Scaffold. Form: stroked planes with offset ghost copies. Material: line only. Motion: ghost lags the plane.
// Deconstruct Field: a crisp analytic composition of planes, arcs and subordinate grids.
// Field classes: every shape is an exact 2D signed distance (rounded-free boxes, annuli, half-plane masks); no marching.
// Layout grammar: plane i has a stable identity from hash(i + seed): anchor, size (power law: few large, many small), colour class,
// travel direction and stagger. Nothing is regenerated on wrap.
// Loop: each plane follows an in-hold-out-return schedule s_i = ioh(k*phase + stagger_i, hold). The quintic eases have zero velocity at
// both ends of every move, and every plane is at rest at the seam. Grids lag their parent plane (a delayed schedule) so they respond to it.
// Painter order = plane index; shadows are a second SDF sample offset along the shadow direction (layer separation), not a noise overlay.

float hash21c(float x) { return h11(x * 9.7 + 21.0); }
struct Pl { vec2 c; vec2 hs; float ang; float cls; float s; float sg; float id; };

float sched(float id, float lag) {
  float st = 0.42 * h11(id * 3.9 + 5.0);
  return k_ioh(float(p_recomp) * k_phase() + st - lag, p_hold);
}

Pl getPlane(int i, int variant) {
  Pl o; float id = float(i);
  float h0 = h11(id * 1.37 + 1.0), h1 = h11(id * 2.11 + 2.0), h2 = h11(id * 2.93 + 3.0), h3 = h11(id * 3.71 + 4.0), h4 = h11(id * 4.57 + 6.0);
  float big = h0 * h0;                                                        // power law: few large
  float w = 0.022 + 0.115 * big, hh = 0.07 + 0.42 * h1 * h1 + 0.2 * big;
  vec2 hs = vec2(w, hh);
  vec2 c = vec2((h2 - 0.5) * 0.78, (h3 - 0.5) * 1.62);
  float ang = 0.0;
  if (variant == 1) { c = vec2((h2 - 0.5) * 0.12, (id / float(max(p_planes - 1, 1)) - 0.5) * 1.7); hs = vec2(0.015 + 0.05 * big, 0.06 + 0.2 * h1); ang = 0.2 * (h4 - 0.5); }
  if (variant == 4) { hs = vec2(0.03 + 0.08 * big, 0.08 + 0.3 * h1); }
  if (variant == 5) { hs = vec2(0.07 + 0.2 * h0, 0.2 + 0.5 * h1); c = vec2((h2 - 0.5) * 0.4, (h3 - 0.5) * 1.0); ang = (h4 > 0.5 ? 0.45 : -0.45); }
  if (variant == 8) { hs *= vec2(0.8, 0.9); }
  o.c = c; o.hs = hs; o.ang = ang; o.id = id;
  // colour class: black structure dominates, cobalt secondary, vermilion rare
  float r = h4;
  o.cls = r < 0.60 ? 0.0 : r < 0.90 ? 1.0 : 2.0;
  if (variant == 2) o.cls = r < 0.28 ? 0.0 : r < 0.95 ? 1.0 : 2.0;               // cobalt cut: cobalt dominant
  if (variant == 6) o.cls = r < 0.65 ? 0.0 : r < 0.80 ? 1.0 : 2.0;
  if (i == 2 || i == 7) o.cls = 2.0 * step(variant == 6 ? 0.0 : 100.0, 1.0);
  o.s = sched(id, 0.0);
  o.sg = sched(id, 0.07);
  return o;
}

float arcBand(vec2 q, vec2 ctr, float R, float w, float a0, float a1) {
  vec2 d = q - ctr; float ring = abs(length(d) - R) - 0.5 * w;
  float a = atan(d.y, d.x);
  float m = (a1 - a0) * 0.5, mid = (a1 + a0) * 0.5;
  float da = abs(k_wrapang(a - mid)) - m;                                       // angular distance beyond the arc end, in radians
  return max(ring, da * length(d));
}

vec4 scene_main(vec2 uv, vec2 fc, int variant) {
  float px = k_px(), th = k_theta();
  float lw = p_lineW * px;
  float calm = k_calm();                                                         // very short loops (1 s at 4x tempo) shrink the travel under the limiter
  float offs = p_offset * calm, rotAm = p_rot * calm;
  vec3 cream = u_bg, black = u_ink, cobalt = u_a0, verm = u_a1, warm = u_a2;
  vec3 col = cream;
  // paper depth: faint tonal gradient only, no texture
  col *= 1.0 - 0.05 * smoothstep(0.2, 1.3, length(uv * vec2(1.0, 0.7)));
  float base = -0.27;
  vec2 q = rot(-base) * uv;
  float sepAmt = p_sep;
  vec2 sdir = vec2(cos(radians(p_keyAngle)), sin(radians(p_keyAngle)));
  float gs = max(p_grid, 0.012);

  // large cobalt arcs: they travel with the same schedule as plane 0, partial span
  {
    int arcs = (variant == 5 ? 3 : variant == 6 ? 5 : variant == 2 ? 2 : variant == 8 ? 1 : 2);
    float R0 = p_arcR;
    for (int a = 0; a < 5; a++) {
      if (a >= arcs) break;
      float fa = float(a);
      float s = sched(40.0 + fa, 0.0);
      vec2 ctr = vec2(0.12, -0.15) + (variant == 6 ? vec2(0.0) : vec2(0.05 * fa)) + vec2(0.10 * offs * (s - 0.5) * 2.0, 0.0) * (a == 0 ? 1.0 : -1.0);
      float R = R0 * (1.0 - 0.17 * fa * (variant == 6 ? 1.2 : 1.0));
      float w = (variant == 6 ? 0.03 + 0.05 * h11(fa + 1.0) : (a == 0 ? 0.05 : 0.012));
      float rotA = rotAm * 2.0 * (s - 0.5) * (mod(fa, 2.0) > 0.5 ? -1.0 : 1.0) + 0.8 * fa;
      float span = (variant == 6 ? 2.6 + 0.8 * h11(fa) : 3.2 - 0.4 * fa);
      float d = arcBand(uv, ctr, R, w, rotA - 0.5 * span, rotA + 0.5 * span);
      if (sepAmt > 0.0005 && k_q() > 0) {
        float ds = arcBand(uv + sdir * sepAmt * 0.6, ctr, R, w, rotA - 0.5 * span, rotA + 0.5 * span);
        col *= 1.0 - 0.20 * (1.0 - smoothstep(-px, px * 5.0, ds)) * smoothstep(px, px * 3.0, d);
      }
      col = mix(col, cobalt, k_cover(d, 0.0) * (variant == 4 ? 0.0 : 1.0));
      if (variant == 4) col = mix(col, cobalt, k_cover(abs(d + 0.0) - lw, 0.0));
    }
  }

  int N = p_planes;
  for (int i = 0; i < 28; i++) {
    if (i >= N) break;
    Pl P = getPlane(i, variant);
    float s = P.s;
    float dirA = TAU * h11(float(i) * 6.1 + 9.0);
    vec2 disp = vec2(cos(dirA), sin(dirA)) * offs * (0.35 + 0.65 * h11(float(i) * 7.3 + 2.0)) * s;
    if (variant == 1) disp = vec2(0.0, 1.0) * offs * 1.3 * s * (mod(float(i), 2.0) > 0.5 ? 1.0 : -1.0) * 0.5 + vec2(1.0, 0.0) * 0.02 * s;
    if (variant == 6 || variant == 2) disp *= 0.8;
    if (variant == 5) disp = vec2(P.ang > 0.0 ? 1.0 : -1.0, 0.0) * offs * 1.1 * s;
    if (variant == 7 && P.cls > 1.5) disp = vec2(1.0, 0.0) * offs * 3.0 * (s - 0.5);
    float ang = P.ang + rotAm * 2.0 * (s - 0.5 * 0.0) * (h11(float(i) * 3.3) > 0.5 ? 1.0 : -1.0) * (variant == 8 ? 0.0 : 1.0);
    vec2 pl = rot(-ang) * (q - (P.c + disp));
    float d = sdBox(pl, P.hs);
    if (variant == 2 && P.cls > 0.5 && P.cls < 1.5) d = max(d, -(length(pl - vec2(0.0, P.hs.y * 0.3)) - P.hs.x * 0.9));      // cobalt cut: circular bite
    vec3 pc = P.cls < 0.5 ? black : P.cls < 1.5 ? cobalt : verm;
    // subordinate grid: follows the parent with a lag
    vec2 gl = rot(-ang) * (q - (P.c + disp * (P.sg / max(P.s, 1e-3)) * (P.s > 1e-3 ? 1.0 : 0.0)));
    float foot = sdBox(pl, P.hs + vec2(0.05, 0.05));
    if (variant == 8) gl.x += gs * 0.5 * floor(gl.y / (gs * 4.0)) * (s * 2.0 - 1.0) * 0.0 + gs * 2.0 * sin(floor(gl.y / (gs * 3.0)) * 2.0 + 0.0) * (0.5 - 0.5 * cos(th * float(p_recomp)));
    if (variant == 7 && P.cls > 1.5) foot = 1.0;
    if (foot < 0.0 && d > 0.0 && gs > 0.0 && k_q() >= 0) {
      vec2 gd = abs(fract(gl / gs + 0.5) - 0.5) * gs;
      float line = (variant == 8 || variant == 4) ? min(gd.x, gd.y) : gd.x;
      float gla = (1.0 - smoothstep(0.35 * lw, 0.35 * lw + px, line)) * 0.38 * (1.0 - smoothstep(-0.0, 0.05, foot + 0.05) * 0.0);
      col = mix(col, black, gla * smoothstep(0.05, 0.0, d * 0.0 + 0.0));
    }
    if (sepAmt > 0.0005 && k_q() > 0) {
      vec2 off = rot(-ang) * sdir * sepAmt;
      float ds = sdBox(pl + off, P.hs);
      col *= 1.0 - 0.24 * (1.0 - smoothstep(-px, px * 6.0 * (1.0 + sepAmt * 20.0), ds)) * smoothstep(0.0, px * 2.0, d);
    }
    if (variant == 4) {                                                       // offset scaffold: outline plus a registration ghost, no fill
      float dg = sdBox(rot(-ang) * (q - (P.c + disp * 0.45 + vec2(0.012, -0.01))) , P.hs);
      col = mix(col, pc, k_cover(abs(dg) - 0.5 * lw, 0.0) * 0.55);
      col = mix(col, pc, k_cover(abs(d) - 0.5 * lw * 1.4, 0.0));
      continue;
    }
    col = mix(col, pc, k_cover(d, 0.0));
    if (P.cls > 0.5 && P.cls < 1.5 && hash21c(float(i)) > 0.5) col = mix(col, cream, k_cover(abs(d + 0.012) - 0.5 * lw, 0.0) * 0.5);
  }
  // fine rule lines: thin structural lines at fixed pixel widths
  if (variant != 8) {
    for (int k = 0; k < 3; k++) {
      float fk = float(k);
      float s = sched(80.0 + fk, 0.0);
      vec2 A = vec2(-0.45, -0.5 + 0.55 * fk) + vec2(0.1, 0.0) * offs * 2.0 * (s - 0.5);
      vec2 B = A + vec2(0.9, 0.12 * (fk - 1.0));
      col = mix(col, black, k_cover(sdSeg(uv, A, B) - 0.5 * lw, 0.0) * (variant == 9 ? 0.0 : 0.9));
    }
  }
  col *= p_exposure;
  col *= 1.0 - p_vignette * smoothstep(0.35, 1.05, length(uv * vec2(1.0, 0.8)));
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
