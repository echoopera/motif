// Posterflow shared helpers (pf_ prefix). Compiled into every pass of every entry.
// Field class: all warps here are plain displacement fields (no distance semantics, no marching).

#define PF_SRC 0
#define PF_PAL 1
#define PF_MIX 2

// Two-level looping domain warp. k = whole cycles per loop. Returns a displacement in uv units (about -1.5..1.5).
vec2 pf_flow(vec2 p, float k) {
  vec2 a = vec2(ln2(p, k, 0.55), ln2(p + 17.3, k, 0.55));
  vec2 b = vec2(ln2(p * 2.1 + a * 1.3 + 5.1, k, 0.5), ln2(p * 2.1 + a * 1.3 + 31.7, k, 0.5));
  return a + 0.5 * b;
}

// Single-level flow for streamline integration (cheap).
vec2 pf_flow1(vec2 p, float k) { return vec2(ln2(p, k, 0.5), ln2(p + 17.3, k, 0.5)); }

// Staircase with soft shoulders: n bands, soft 0..1 (0 = hard). Anti-aliased by the screen derivative.
// Returns the banded value in 0..1 and the distance (in pixels) to the nearest band edge via `edge`.
float pf_band(float x, float n, float soft, out float edge) {
  float y = clamp(x, 0.0, 1.0) * n;
  float fw = max(fwidth(y), 1e-4);
  float s = clamp(max(soft * 0.5, fw * 0.75), 0.002, 0.5);
  float f = fract(y);
  edge = abs(f - 0.5) / fw;
  return (floor(y) + smoothstep(0.5 - s, 0.5 + s, f)) / n;
}

// The poster treatment. c is premultiplied-free linear RGB. Returns linear RGB.
//   n      band count          soft   shoulder softness (0 hard)
//   hue    0 = luma bands only, 1 = per-channel bands (hue steps)
//   mode   PF_SRC source colours, PF_PAL palette ramp, PF_MIX blend of both
//   vein   vein line strength, veinW vein width in pixels, veinC vein colour (linear)
vec3 pf_poster(vec3 c, float n, float soft, float hue, int mode, float pal, float vein, float veinW, vec3 veinC) {
  c = max(c, 0.0);
  float L = sqrt(max(luma(c), 0.0));
  float e;
  float Lq = pf_band(L, n, soft, e);
  float ec;
  vec3 s3 = sqrt(c);
  vec3 cq = vec3(pf_band(s3.r, n, soft, ec), pf_band(s3.g, n, soft, ec), pf_band(s3.b, n, soft, ec));
  vec3 keep = c * ((Lq * Lq) / max(L * L, 0.015));              // keep hue, snap luminance
  vec3 src = mix(keep, cq * cq, hue);
  vec3 rp = ramp(Lq);
  vec3 col = mode == PF_SRC ? src : mode == PF_PAL ? rp : mix(src, rp, pal);
  float v = 1.0 - smoothstep(veinW * 0.5, veinW * 0.5 + 1.2, e);
  return mix(col, veinC, v * vein);
}

// Edge-preserving sweep used for smears: weights fall off along the sweep.
float pf_tw(float i, float n) { float t = i / max(n, 1.0); return 1.0 - t * t; }

vec3 pf_vignette(vec3 c, vec2 uv, float amt) { return c * (1.0 - amt * smoothstep(0.2, 0.95, length(uv))); }

// Cosine rainbow (thin-film iridescence), returned as approximately linear RGB.
vec3 pf_spectrum(float t) { vec3 c = 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67))); return c * c; }

// Shared finish: vignette, exposure, static film grain (loop-safe: no time).
vec3 pf_finish(vec3 c, vec2 uv, vec2 fc, float vig, float expo, float grain) {
  c = pf_vignette(c, uv, vig) * expo;
  return c + (h21(fc) - 0.5) * grain * 0.05;
}
