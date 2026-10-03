// Shared post, pass 2 (scale 0.125): soft-knee bright pass + pre-blur of the HDR scene in u_buf0.
// Runs at 1/8 resolution, so a very wide bloom costs almost nothing.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec3 c = am_bloom(u_buf0, q, 1.6);
  return vec4(am_bright(c, p_threshold, 0.6), 1.0);
}
