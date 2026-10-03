// @module field — field taxonomy, coordinate folds and named renderers (after the Astral methodology research, Oct 2026).
// @requires
//
// Every scene function gets a declared FIELD CLASS in a comment above it, and is drawn only by a renderer that
// is valid for that class. Terminology never stands in for evidence.
//   exact     exact signed distance (spheres, boxes, their unions)       -> AM_MARCH (sphere tracing)
//   bound     conservative distance bound, |grad| <= 1 after dividing by L -> AM_MARCH_L (divide by the Lipschitz L)
//   implicit  only the zero set matters; the value is not a distance     -> AM_SEGMENT (fixed steps + bisection)
//   density   non-negative extinction per unit length                    -> AM_VOLUME (absorption / emission)
//   glow      positive heuristic step field (Astral-style)               -> AM_GLOW (named aesthetic renderer)
// Deformations change the class: a fold or twist turns `exact` into `bound` (with a known L) or into `implicit`.

// ---- deformation: the Astral cosine fold --------------------------------------------------------------------
// q <- q + a * (|cos(s * q.yzx + phase)| - b) / s, then s <- s * lac, for `layers` octaves.
// Lipschitz of the map: each layer adds at most a (|d/dq| of |cos| times s / s), so L <= (1 + a)^layers.
// Pass phase as TAU * k * u_p with integer k (loop rule). a 0.2..1.2, s0 1..4, lac 1.4..2.2, b ~0.5.
vec3 am_cosFold(vec3 q, float a, float s0, float lac, float b, float phase, int layers) {
  float s = s0;
  for (int i = 0; i < 8; i++) {
    if (i >= layers) break;
    q += a * (abs(cos(s * q.yzx + phase + float(i) * 1.7)) - b) / s;
    s *= lac;
  }
  return q;
}
float am_cosFoldLip(float a, int layers) { return pow(1.0 + a, float(layers)); }

// ---- renderers --------------------------------------------------------------------------------------------
// Sphere tracing for `bound` fields with Lipschitz constant LIP (> = 1). Same outputs as AM_MARCH.
#define AM_MARCH_L(MAP, RO, RD, TMAX, STEPS, LIP, T, HIT) { T = 0.0; HIT = false; float il_ = 1.0 / max(LIP, 1.0); for (int i_ = 0; i_ < 256; i_++) { if (i_ >= STEPS) break; float d_ = MAP(RO + RD * T) * il_; if (d_ < 0.0005 * T + 0.0005) { HIT = true; break; } T += d_; if (T > TMAX) break; } }
// Implicit surfaces (gyroids, metaball potentials, folded fields): fixed steps of DT find a sign change,
// then 6 bisection steps refine it. Thin features thinner than DT can be missed: the step is the honesty knob.
#define AM_SEGMENT(MAP, RO, RD, T0, T1, STEPS, T, HIT) { HIT = false; float dt_ = (T1 - T0) / float(STEPS); float ta_ = T0; float fa_ = MAP(RO + RD * ta_); T = T1; for (int i_ = 0; i_ < 256; i_++) { if (i_ >= STEPS) break; float tb_ = ta_ + dt_; float fb_ = MAP(RO + RD * tb_); if (sign(fa_) != sign(fb_)) { float lo_ = ta_, hi_ = tb_; for (int j_ = 0; j_ < 6; j_++) { float m_ = 0.5 * (lo_ + hi_); if (sign(MAP(RO + RD * m_)) == sign(fa_)) lo_ = m_; else hi_ = m_; } T = 0.5 * (lo_ + hi_); HIT = true; break; } ta_ = tb_; fa_ = fb_; } }
// Astral-style additive glow: march by a positive heuristic field, adding COLOR(p, t) / field at each step.
// An aesthetic renderer, not a volume integral: brightness depends on STEPS and the step spacing, so it is
// normalised by 1/STEPS and exposure must be re-checked when STEPS changes. FIELD(p) must return >= 0.
#define AM_GLOW(FIELD, COLOR, RO, RD, STEPS, MINSTEP, TMAX, OUT) { OUT = vec3(0.0); float t_ = 0.0; for (int i_ = 0; i_ < 256; i_++) { if (i_ >= STEPS) break; vec3 p_ = RO + RD * t_; float f_ = MINSTEP + max(FIELD(p_), 0.0); OUT += COLOR(p_, t_) / f_; t_ += f_; if (t_ > TMAX) break; } OUT *= 1.0 / float(STEPS); }
// Step-normalised absorption / emission (PBRT ch. 14 discretisation without scattering): exposure is stable when
// STEPS changes because opacity uses the physical step length. DENS(p) >= 0 is extinction, SRC(p) the source colour.
// JIT in 0..1 offsets the first sample (feed am_ign(fc)) to hide banding. OUT = radiance, TR = transmittance.
#define AM_VOLUME(DENS, SRC, RO, RD, T0, T1, STEPS, JIT, OUT, TR) { OUT = vec3(0.0); TR = 1.0; float dt_ = (T1 - T0) / float(STEPS); float t_ = T0 + dt_ * JIT; for (int i_ = 0; i_ < 256; i_++) { if (i_ >= STEPS || TR < 0.01) break; vec3 p_ = RO + RD * t_; float sg_ = max(DENS(p_), 0.0); if (sg_ > 1e-5) { float a_ = 1.0 - exp(-sg_ * dt_); OUT += TR * SRC(p_) * a_; TR *= 1.0 - a_; } t_ += dt_; } }
// Ray / sphere interval for bounding a renderer (returns t0, t1; t1 < t0 means a miss).
vec2 am_sphereHit(vec3 ro, vec3 rd, float r) { float b = dot(ro, rd), c = dot(ro, ro) - r * r, h = b * b - c; if (h < 0.0) return vec2(1.0, -1.0); h = sqrt(h); return vec2(max(-b - h, 0.0), -b + h); }
