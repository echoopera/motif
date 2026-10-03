// Lens effect, pass "glow" (scale 0.125): wide bloom level.
vec4 motif(vec2 uv, vec2 fc) { return vec4(am_bloom(g_bright, fc / u_res, 1.8), 1.0); }
