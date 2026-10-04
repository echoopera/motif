// Bloom, pass 2 of 3: a 3×3 blur that ping-pongs on itself (iterate 4). Step 0 reads the bright pass;
// later steps read the previous step and widen the kernel, so four steps cover a large radius cheaply.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res, px = p_radius * float(u_iter + 1) / u_res;
  vec4 s = vec4(0.0); float w = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 o = vec2(float(x), float(y)) * px;
    float k = (x == 0 && y == 0) ? 4.0 : (x == 0 || y == 0) ? 2.0 : 1.0;
    s += (u_iter == 0 ? g_brightAt(q + o) : g_blurAt(q + o)) * k; w += k;
  }
  return s / w;
}
