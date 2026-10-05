// Shape Field: the SDK 4.0 vector toolkit in plain GLSL. Every shape returns a signed distance in uv units
// (negative inside); vpaint() turns it into fill + outline + glow with anti-aliased edges at any resolution.
float shape(vec2 p, float r, float t) {
  // t walks circle -> polygon -> star -> ring -> back; every step is a smooth blend so the morph is continuous.
  float circle = sdCircle(p, r);
  float poly = sdNgon(p, r, float(p_sides));
  float star = sdStar(p, r * 1.08, p_points, 2.6) ;
  float ring = sdRing(p, r * 0.8, r * 0.34);
  float s = fract(t) * 4.0;
  float a = s < 1.0 ? circle : s < 2.0 ? poly : s < 3.0 ? star : ring;
  float b = s < 1.0 ? poly : s < 2.0 ? star : s < 3.0 ? ring : circle;
  return mix(a, b, smoothstep(0.0, 1.0, fract(s)));
}
vec4 motif(vec2 uv, vec2 fc) {
  vec2 asp = M_asp(); float cols = float(p_cols), cell = asp.x / cols;
  vec2 g = uv + asp * 0.5; vec2 id = floor(g / cell); vec2 p = (fract(g / cell) - 0.5) * cell;
  float r = 0.5 * cell * p_size;
  float t = float(p_cycles) * u_p + h21(id) * 0.5 + (id.x + id.y) * 0.04;     // integer cycles keep the loop closed
  p = rot(0.25 * lsin(1.0, h21(id))) * p;
  float d = shape(p, r, t);
  vec3 fill = p_fill ? mix(u_a0, u_a1, h21(id + 3.0)) * 0.55 : vec3(0.0);
  vec3 line = mix(u_ink, u_a2, h21(id + 9.0));
  vec4 c = vpaint(d, fill, line, p_outline, mix(u_a0, u_a2, h21(id + 5.0)), p_glow);
  return over(c, vec4(u_bg, 1.0));
}
