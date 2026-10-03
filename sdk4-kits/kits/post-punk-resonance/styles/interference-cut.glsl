// Post-Punk Resonance: Interference Cut. Form: two filtered stripe fields + cut. Material: black stripes, pink/yellow slabs. Motion: stripe shift per beat.
// Post-Punk Resonance: one crisp analytic pass of stripes, ring bands, wave traces and slabs on rhythmic segments.
// Field classes: stripes and bands are analytic periodic masks filtered with fwidth (box filter) so pitch changes stay alias-safe;
// waves are |y - f(x)| with the slope-corrected distance; slabs are exact boxes.
// Rhythm: the loop holds B beats (1..4). Within a beat the transform eases between target k and target (k+1) mod B over the moving
// part of the beat and rests for the hold fraction. Closing is by construction (targets are indexed mod B). Slices displace in space only
// during moves (envelope sin(pi*e)), and no form change depends on brightness: no strobing, no grain.

struct Bt { float k; float e; float env; };

float bN() { return max(safeCycles(float(p_beats)), 1.0); }                       // photosensitive limiter: beats per loop capped at 3 changes per second

Bt beatState() {
  float B = bN();
  float x = k_phase() * B;
  float k = floor(x), l = x - k;
  float h2 = p_hold * 0.5;
  float u = clamp((l - h2) / max(1.0 - p_hold, 0.05), 0.0, 1.0);
  float e = k_ease(u);
  if (p_stepped) e = min(floor(u * 6.0), 6.0) / 6.0;                           // on-twos: six held poses per move
  Bt b; b.k = k; b.e = e; b.env = sin(PI * e);
  if (safeCycles(float(p_beats)) < 1.0) { b.k = 0.0; b.e = 0.0; b.env = 0.0; }   // too fast to be safe: hold the pose
  return b;
}
float tgt(float k, float salt) { float B = bN(); return h11(mod(k, B) * 3.17 + salt); }
float bpos(Bt b, float salt) { float B = bN(); return mix(tgt(b.k, salt), tgt(mod(b.k + 1.0, B), salt), b.e); }

float stripes(float s, float pitchPx, float duty) {                              // anti-aliased stripe mask (1 = black), s in uv
  float P = max(pitchPx, 3.0) * k_px();
  float f = fract(s / P);
  float w = max(fwidth(s / P), 1e-4);
  float a = smoothstep(0.0, w, f) * (1.0 - smoothstep(duty, duty + w, f));
  return a;
}
float band(float s, float duty) {
  float f = fract(s); float w = max(fwidth(s), 1e-4);
  return smoothstep(0.0, w, f) * (1.0 - smoothstep(duty, duty + w, f));
}

vec4 scene_main(vec2 uv, vec2 fc, int variant) {
  float px = k_px();
  Bt b = beatState();
  float calm = k_calm();
  vec3 white = u_bg, black = u_ink, red = u_a0, yel = u_a1, gry = u_a2;
  float B = bN();
  // spatial slices during moves
  float sl = floor((uv.y + 1.0) * 9.0);
  float sdisp = (h11(sl * 1.7 + b.k * 5.3) - 0.5) * 2.0 * p_slice * b.env * calm;
  vec2 q = uv + vec2(sdisp, 0.0);
  vec2 v = rot(0.2) * q;
  vec3 col = white;
  float acc = p_accent, blk = p_black;
  float lw = px;

  if (variant == 0) {                                                            // hero
    // yellow slab, top right
    vec2 yc = vec2(0.50 + 0.16 * (bpos(b, 1.0) - 0.5), 0.55 + 0.1 * (bpos(b, 2.0) - 0.5));
    float dy = sdBox(v - yc, vec2(0.14 + acc * 0.7, 0.20 + acc * 0.6));
    // ring bands (negative space bands cut a disc)
    vec2 cc = vec2(-0.07, 0.0); float r = length(q - cc);
    float off = (b.k + b.e) * 1.0 * 0.0 + (b.k + b.e) / B;
    float ringBand = band(r * float(p_rings) * 1.6 - off * float(p_rings) * 0.0 - off, 0.46 * (0.4 + blk));
    float ringMask = smoothstep(0.58 + px, 0.58 - px, r) * smoothstep(0.24 - px, 0.24 + px, r);
    // black bar
    float bx = -0.18 + 0.10 * (bpos(b, 3.0) - 0.5);
    float dbar = sdBox(v - vec2(bx, 0.0), vec2(0.095, 0.73));
    // stripe block
    float y0 = -0.24 + 0.14 * (bpos(b, 4.0) - 0.5) - (blk - 0.45) * 0.4;
    float stripeBlock = stripes(v.x + 0.07 * b.env * 0.0, p_pitch, 0.5) * smoothstep(y0 + px, y0 - px, v.y);
    // red wave trace band
    float ph = TAU * (b.k + b.e) / B;
    float wave = (0.16 * sin(q.x * 14.0 + ph * 1.0) + 0.05 * sin(q.x * 31.0 - ph * 2.0)) * (p_wave / 0.14);
    float slope = 0.16 * 14.0 * cos(q.x * 14.0 + ph) + 0.05 * 31.0 * cos(q.x * 31.0 - ph * 2.0);
    float wd = (q.y - wave - 0.27 - 0.1 * (bpos(b, 5.0) - 0.5)) / sqrt(1.0 + slope * slope * (p_wave / 0.14) * (p_wave / 0.14));
    float redBand = smoothstep(-px, px, wd + 0.09 * (0.6 + acc * 2.0)) * smoothstep(px, -px, wd);
    col = mix(col, yel, k_cover(dy, 0.0));
    col = mix(col, red, redBand);
    col = mix(col, black, ringBand * ringMask);
    col = mix(col, black, k_cover(dbar, 0.0));
    col = mix(col, black, stripeBlock);
  } else if (variant == 1) {                                                     // Acid Carrier
    col = yel;
    float ph = TAU * (b.k + b.e) / B;
    for (int j = 0; j < 7; j++) {
      float fj = float(j);
      float y = -0.62 + fj * 0.2;
      float w = p_wave * 1.8 * sin(q.x * (9.0 + fj * 2.0) + ph * (1.0 + mod(fj, 2.0)) + fj) + 0.02 * sin(q.x * 40.0 - ph);
      float d = abs(q.y - y - w) - 0.5 * lw * (1.0 + 2.0 * mod(fj, 2.0));
      col = mix(col, black, k_cover(d, 0.0));
    }
    float dsl = sdBox(v - vec2(0.2 * (bpos(b, 1.0) - 0.5) - 0.12, 0.35), vec2(0.20, 0.5));
    col = mix(col, black, stripes(v.y, p_pitch, 0.5) * k_cover(dsl, 0.0));
    col = mix(col, red, k_cover(sdBox(v - vec2(0.3 + 0.1 * (bpos(b, 2.0) - 0.5), -0.5), vec2(0.1 + acc * 0.4, 0.25)), 0.0));
  } else if (variant == 2) {                                                     // Red Signal
    col = white;
    float ph = TAU * (b.k + b.e) / B;
    float disc = length(q - vec2(0.05 * (bpos(b, 1.0) - 0.5), 0.1)) - (0.30 + acc * 0.5);
    col = mix(col, red, k_cover(disc, 0.0));
    float sq = 0.12 * p_wave / 0.14;
    for (int j = 0; j < 5; j++) {
      float fj = float(j);
      float y = -0.5 + fj * 0.25;
      float tri = (abs(fract(q.x * (1.8 + fj * 0.3) + 0.25 * fj + (b.k + b.e) / B) - 0.5) * 2.0 - 0.5) * sq;
      float d = abs(q.y - y - tri) - 0.5 * lw * 1.5;
      col = mix(col, black, k_cover(d, 0.0));
    }
    col = mix(col, black, k_cover(sdBox(v - vec2(-0.22 + 0.1 * (bpos(b, 2.0) - 0.5), 0.0), vec2(0.09, 0.7)), 0.0));
  } else if (variant == 3) {                                                     // Broken Ring
    vec2 cc = vec2(0.0, 0.0); float r = length(q - cc); float a = atan(q.y, q.x);
    float rings = float(p_rings);
    float ri = floor(r * rings * 1.7);
    float inRing = band(r * rings * 1.7, 0.55);
    float turnR = (h11(ri * 3.7) > 0.5 ? 1.0 : -1.0) * (b.k + b.e) / B;
    float seg = floor(fract(a / TAU + turnR * (1.0 + mod(ri, 3.0))) * (3.0 + mod(ri, 4.0)));
    float gap = h11(ri * 9.1 + seg * 3.3) < (0.25 + 0.35 * blk) ? 0.0 : 1.0;
    float mask = smoothstep(0.62 + px, 0.62 - px, r) * smoothstep(0.08 - px, 0.08 + px, r);
    col = mix(col, black, inRing * gap * mask);
    col = mix(col, red, k_cover(sdBox(v - vec2(0.3, -0.5 + 0.15 * (bpos(b, 1.0) - 0.5)), vec2(0.06 + acc, 0.2)), 0.0));
    col = mix(col, yel, k_cover(length(q - vec2(-0.2, 0.55 + 0.1 * (bpos(b, 2.0) - 0.5))) - (0.06 + acc * 0.4), 0.0));
  } else if (variant == 4) {                                                     // Blackout Geometry
    col = black;
    vec3 cut = white;
    float s = (b.k + b.e) / B;
    float d1 = length(q - vec2(0.0, 0.1)) - (0.28 + blk * 0.0 + 0.05 * sin(TAU * s));
    float d2 = sdBox(rot(0.785 + TAU * s * 0.0) * (q - vec2(0.18 * (bpos(b, 1.0) - 0.5), -0.5)), vec2(0.2, 0.2));
    float d3 = sdNgon(q - vec2(-0.22, 0.62 + 0.1 * (bpos(b, 2.0) - 0.5)), 0.24, 3.0);
    col = mix(col, cut, k_cover(d1, 0.0));
    col = mix(col, yel, k_cover(max(d2, -d1 + 0.0), 0.0) * (1.0 - k_cover(d1, 0.0)));
    col = mix(col, cut, k_cover(d3, 0.0));
    col = mix(col, red, k_cover(sdBox(q - vec2(0.3, 0.1 + 0.2 * (bpos(b, 3.0) - 0.5)), vec2(0.03 + acc * 0.2, 0.5)), 0.0));
  } else if (variant == 5) {                                                     // Interference Cut
    float a1 = 0.25, a2 = 0.25 + 0.06 + 0.04 * (bpos(b, 1.0));
    vec2 u1 = rot(a1) * q, u2 = rot(a2) * q;
    float m1 = stripes(u1.x + (b.k + b.e) / B * p_pitch * px * 2.0, p_pitch, 0.5);
    float m2 = stripes(u2.x, p_pitch * 1.06, 0.5);
    float cutm = smoothstep(-px, px, sin(v.y * 3.0 + 1.0 + TAU * (b.k + b.e) / B) * 0.0 + (q.x + 0.2 * (bpos(b, 2.0) - 0.5)) * 0.9 - q.y * 0.4);
    float st = mix(m1, m2, cutm);
    col = mix(white, black, st);
    col = mix(col, red, k_cover(sdBox(v - vec2(0.25, 0.3 + 0.2 * (bpos(b, 3.0) - 0.5)), vec2(0.12 + acc, 0.18)), 0.0));
    col = mix(col, yel, k_cover(sdBox(v - vec2(-0.22, -0.4), vec2(0.14, 0.1 + acc * 0.5)), 0.0) * 1.0);
  } else if (variant == 6) {                                                     // Stepped Oscillator (always on-twos)
    float s = (b.k + floor(b.e * 6.0 + 0.5) / 6.0) / B;
    for (int j = 0; j < 9; j++) {
      float fj = float(j);
      float y = -0.72 + fj * 0.18;
      float stepx = floor(q.x * 40.0) / 40.0;
      float w = p_wave * 1.2 * sin(stepx * (7.0 + fj) + TAU * s * (1.0 + mod(fj, 2.0)) + fj * 0.8);
      float d = abs(q.y - y - floor(w * 24.0 + 0.5) / 24.0) - 0.5 * lw;
      col = mix(col, (j == 3 ? red : black), k_cover(d, 0.0));
    }
    col = mix(col, yel, k_cover(sdBox(q - vec2(0.3, 0.7 - 0.2 * (bpos(b, 7.0) - 0.5)), vec2(0.08, 0.04 + acc * 0.4)), 0.0));
  } else if (variant == 7) {                                                     // Graphic Feedback: nested rectangles, one level per loop
    float lvl = 3.0 * (b.k + b.e) / B;                                              // three levels per loop: colours repeat every third ring
    float Ls = log(max(max(abs(q.x) * 1.4, abs(q.y)), 1e-3)) / log(0.618);          // nested scale coordinate
    float f = Ls - lvl;
    float ring = band(f, 0.5);
    float lvlId = floor(f);
    vec3 cc = mod(lvlId, 3.0) < 0.5 ? black : mod(lvlId, 3.0) < 1.5 ? red : yel;
    col = mix(white, cc, ring);
    col = mix(col, black, k_cover(sdBox(q, vec2(0.012 * 1.0)), 0.0));
  } else {                                                                       // 8: Quiet Noise (halftone field, structured)
    float cs = 0.035;
    vec2 g = q / cs; vec2 id = floor(g); vec2 f = fract(g) - 0.5;
    float s = TAU * (b.k + b.e) / B;
    float rad = 0.28 + 0.2 * sin(length(id * cs - vec2(0.0, 0.1)) * 7.0 - s) * 0.5 + 0.12 * (h21(id) - 0.5);
    float d = (length(f) - rad * (0.55 + 0.45 * smoothstep(0.1, 0.9, 1.0 - length(q * vec2(1.0, 0.6)))));
    col = mix(white, black, 1.0 - smoothstep(-0.02, 0.02, d * cs));
    col = mix(col, red, k_cover(sdBox(q - vec2(0.2 + 0.06 * (bpos(b, 1.0) - 0.5), -0.45), vec2(0.04 + acc * 0.3, 0.22)), 0.0) * 0.9);
  }
  col *= p_exposure;
  col *= 1.0 - p_vignette * smoothstep(0.35, 1.05, length(uv * vec2(1.0, 0.8)));
  return vec4(col, 1.0);
}

vec4 motif(vec2 uv, vec2 fc) {
  return scene_main(uv, fc, 5);
}
