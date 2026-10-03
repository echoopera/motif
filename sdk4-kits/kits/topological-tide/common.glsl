// ---------------------------------------------------------------------------
// Motif SDK 4 kits: shared library (prepended to every kit's common.glsl).
// Contract: time enters only through u_p. Every temporal harmonic is an integer
// multiple of theta. Output is linear, tone-mapped once in the final pass.
// ---------------------------------------------------------------------------
float k_phase() { return fract(u_p); }
float k_theta() { return TAU * fract(u_p); }

// quintic ease: value and first/second derivative are 0 at both ends
float k_ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * x * (x * (x * 6.0 - 15.0) + 10.0); }
// closed excursion 0 -> 1 -> 0 with zero velocity at the seam (cosine bell)
float k_bell(float cycles) { return 0.5 - 0.5 * cos(k_theta() * floor(cycles + 0.5)); }
// in-hold-out-hold-return schedule: 0 .. 1 .. 0 with long rests; hold in 0..1 is the resting fraction of each half
float k_ioh(float ph, float hold) {
  float x = fract(ph); float h = clamp(hold, 0.0, 0.9) * 0.5; float mv = 0.5 - h;
  float a = k_ease(x / mv);
  float b = k_ease((x - 0.5) / mv);
  return a * (1.0 - step(0.5, x)) + (1.0 - b) * step(0.5, x);
}
// seeded per-identity phase 0..1 (static per seed, never time dependent)
float k_idph(float id) { return h11(id * 7.31 + 3.7); }

// ---- OKLab (inputs/outputs linear sRGB) ----
vec3 k_toLab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 1e-8), 1.0 / 3.0); m = pow(max(m, 1e-8), 1.0 / 3.0); s = pow(max(s, 1e-8), 1.0 / 3.0);
  return vec3(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
              1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
              0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s);
}
vec3 k_fromLab(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  return vec3(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
             -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
             -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 k_mix(vec3 a, vec3 b, float t) { return max(k_fromLab(mix(k_toLab(a), k_toLab(b), clamp(t, 0.0, 1.0))), 0.0); }

// ---- tone mapping: once, in the output pass. Hue-preserving shoulder + gentle per-channel roll-off ----
vec3 k_tone(vec3 c) {
  c = max(c, 0.0);
  float m = max(c.r, max(c.g, c.b));
  float t = m * (1.0 + m / 36.0) / (1.0 + m);          // extended Reinhard on the peak channel, white point 6
  vec3 hue = c * (t / max(m, 1e-5));
  vec3 ch = c * (1.0 + c / 36.0) / (1.0 + c);
  vec3 o = mix(hue, ch, 0.28);
  float w = clamp((m - 1.0) * 0.12, 0.0, 0.35);        // highlights drift to white
  return mix(o, vec3(luma(o)), w);
}

// ---- small geometry helpers ----
float k_px() { return 1.0 / min(u_res.x, u_res.y); }
float k_cover(float d, float soft) { float w = max(soft, 0.75 * k_px()); return 1.0 - smoothstep(-w, w, d); }
// polar helpers
vec2 k_pol(vec2 p) { return vec2(length(p), atan(p.y, p.x)); }
float k_wrapang(float a) { return a - TAU * floor((a + PI) / TAU); }

// quality: 0 live, 1 balanced, 2 export (QUALITY_* defines come from the select param). Macros, so a kit that does not declare
// the parameter never compiles a reference to it.
#define k_q() (p_quality)
// soft key direction from the Light control (degrees, 0 = from right, counter-clockwise)
#define k_key() normalize(vec3(cos(radians(p_keyAngle)) * 0.72, sin(radians(p_keyAngle)) * 0.72, 0.62))
// vignette that never touches the focal area
#define k_vig(uvv) (1.0 - p_vignette * smoothstep(0.35, 1.05, length((uvv) * vec2(1.0, 0.82))))

// photosensitive safety for high-contrast motion: under the limiter, loops shorter than ~2.5 s calm their amplitude
// (a 1 s loop at 4x tempo has u_L = 0.25 s). Never used for strobing; this only scales sweeping excursions.
float k_calm() { return u_safe > 0.5 ? 0.12 + 0.88 * smoothstep(0.35, 2.5, u_L) : 1.0; }
