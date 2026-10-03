// @module motion — animator-grade timing inside a loop: segments, easing, springs, stagger, holds.
// Everything maps the loop phase u_p (or any 0..1 t) so it stays deterministic and seamless.
// @requires

// Progress 0..1 of the loop window [a, b] (fractions of the loop). Clamped.
float am_seg(float a, float b) { return sat((fract(u_p) - a) / max(b - a, 1e-5)); }
float am_segT(float t, float a, float b) { return sat((t - a) / max(b - a, 1e-5)); }
// Easing (Penner / CSS equivalents). t 0..1.
float am_easeInOutCubic(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) * 0.5; }
float am_easeOutExpo(float t) { return t >= 1.0 ? 1.0 : 1.0 - exp2(-10.0 * t); }
float am_easeInExpo(float t) { return t <= 0.0 ? 0.0 : exp2(10.0 * t - 10.0); }
float am_easeInOutExpo(float t) { return t <= 0.0 ? 0.0 : t >= 1.0 ? 1.0 : t < 0.5 ? exp2(20.0 * t - 10.0) * 0.5 : (2.0 - exp2(-20.0 * t + 10.0)) * 0.5; }
float am_easeOutBack(float t, float s) { t -= 1.0; return 1.0 + (s + 1.0) * t * t * t + s * t * t; }
// Cubic-bezier(x1, y1, x2, y2) like CSS/After Effects, solved with 5 Newton steps. Matches the house-style eases:
// am_bezier(t, 0.16, 1.0, 0.3, 1.0) is the default entrance, am_bezier(t, 0.7, 0.0, 0.84, 0.0) the exit.
float am_bezier(float x, float x1, float y1, float x2, float y2) {
  float t = x;
  for (int i = 0; i < 5; i++) {
    float u = 1.0 - t; float bx = 3.0 * u * u * t * x1 + 3.0 * u * t * t * x2 + t * t * t;
    float dx = 3.0 * u * u * x1 + 6.0 * u * t * (x2 - x1) + 3.0 * t * t * (1.0 - x2);
    t = sat(t - (bx - x) / max(dx, 1e-4));
  }
  float u = 1.0 - t; return 3.0 * u * u * t * y1 + 3.0 * u * t * t * y2 + t * t * t;
}
// Damped spring step response (closed form, no state): 0 -> 1 with overshoot. t in seconds since release,
// stiffness k (≈ 100..600) and damping c (≈ 8..40), unit mass. Matches Motif's "snappy (300, 20)".
float am_spring(float t, float k, float c) {
  if (t <= 0.0) return 0.0;
  float w0 = sqrt(k), z = c / (2.0 * w0);
  if (z < 1.0) { float wd = w0 * sqrt(1.0 - z * z); return 1.0 - exp(-z * w0 * t) * (cos(wd * t) + z * w0 / wd * sin(wd * t)); }
  return 1.0 - exp(-w0 * t) * (1.0 + w0 * t);
}
// Spring that fires at loop fraction a and settles back by the loop end: seconds come from u_L.
float am_springAt(float a, float k, float c) { return am_spring((fract(u_p) - a) * u_L, k, c) * (1.0 - am_seg(0.92, 1.0)); }
// Stagger: element i of n starts spread * i / n later. Returns the element's local 0..1 progress for window [a,b].
float am_stagger(float i, float n, float spread, float a, float b) { float off = spread * i / max(n - 1.0, 1.0); return am_seg(a + off * (1.0 - (b - a)), b + off * (1.0 - (b - a))); }
// In / hold / out over the loop: rises over [0, inT], holds, falls over [1 - outT, 1], eased.
float am_inHoldOut(float inT, float outT) { float x = fract(u_p); return am_easeOutExpo(sat(x / inT)) * (1.0 - am_easeInExpo(sat((x - 1.0 + outT) / outT))); }
// Ping-pong 0..1..0 with smooth turnarounds (k round trips per loop).
float am_pingpong(float k) { return 0.5 - 0.5 * cos(TAU * k * u_p); }
float am_framesM(float fps) { return max(1.0, floor(u_L * fps + 0.5)); }
// Hand-drawn "on twos" phase: quantises u_p to fps/2 so motion steps like cel animation (loops exactly).
float am_onTwos(float fps) { float n = am_framesM(fps * 0.5); return floor(fract(u_p) * n) / n; }
