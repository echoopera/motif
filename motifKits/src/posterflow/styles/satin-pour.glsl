// Source colour at frame-normalised q, or the palette ink marble when no media is attached (thumbnails never blank).
vec3 sx(vec2 q) {
  if (u_sourceOn > 0.5) { vec4 s = m_source(q); return s.rgb + u_bg * (1.0 - s.a); }
  vec2 uv = (q - 0.5) * M_asp();
  return ramp(0.5 + 0.5 * lfbm(uv * 1.5, 3, float(p_turns), 0.5));
}

// Satin Pour: a low-frequency height field refracts the source and is lit with a stretched sheen, like silk or liquid chrome.
float ht(vec2 p, float k) { return 0.75 * ln2(p, k, 0.5) + 0.25 * ln2(p * 2.1 + 7.0, k, 0.5); }
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res, asp = M_asp();
  float k = float(p_turns);
  vec2 p = uv * p_scale + 0.3 * lc(k, 0.0);
  float e = 0.02;
  float h = ht(p, k);
  vec2 g = vec2(ht(p + vec2(e, 0.0), k) - ht(p - vec2(e, 0.0), k), ht(p + vec2(0.0, e), k) - ht(p - vec2(0.0, e), k)) / (2.0 * e);
  vec3 n = normalize(vec3(-g * p_relief, 1.0));
  vec3 c = sx(q + g * p_refract * 0.05 / asp);
  vec3 L = normalize(vec3(vec2(cos(radians(p_light)), sin(radians(p_light))) * 0.8, 0.7));
  float diff = 0.8 + 0.3 * (dot(n, L) - 0.7);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float ta = radians(p_light) + 1.5708;
  vec3 t = vec3(cos(ta), sin(ta), 0.0);                              // anisotropic: highlight stretches along a fixed tangent
  vec2 ns = n.xy - t.xy * dot(n.xy, t.xy) * 0.8;                       // flatten the normal along the tangent: highlights stretch
  float spec = pow(sat(dot(normalize(vec3(ns, n.z)), H)), p_gloss);
  float fres = pow(1.0 - n.z, 2.0);
  vec3 col = c * diff + u_ink * spec * p_sheen * 0.35 + u_a1 * fres * 0.25 * p_sheen;
  col = pf_finish(col, uv, fc, p_vignette, p_exposure, p_grain);
  return vec4(max(col, 0.0), 1.0);
}
