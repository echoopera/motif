// Petal Fold: the source is mirror-folded around a centre into N petals, then poured through the flow, so any photo
// becomes a symmetric bloom.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 asp = M_asp();
  float k = safeCycles(float(p_turns));
  vec2 p = uv - v_centre();
  float r = length(p), a = atan(p.y, p.x);
  float seg = TAU / float(p_petals);
  a = abs(mod(a + p_spin * 0.1, seg) - seg * 0.5);                  // mirror fold
  vec2 f = vec2(cos(a), sin(a)) * r;
  vec2 w = pf_flow(f * p_scale + 0.25 * lc(k, 0.0), k);
  f += w * p_warp * 0.1;
  f *= 1.0 + p_zoomIn * (0.35 - r);
  f += v_pick();
  vec3 c = sx(f / asp + 0.5);
  float vein = 1.0 - smoothstep(0.0, 0.01 + aa(), abs(a - 0.0)) ;
  vein += 1.0 - smoothstep(0.0, 0.01 + aa(), abs(a - seg * 0.5));
  vec3 col = mix(c, u_bg, vein * p_seam * 0.6);
  col = pf_finish(col, uv, fc, p_vignette, p_exposure, p_grain);
  return vec4(max(col, 0.0), 1.0);
}
