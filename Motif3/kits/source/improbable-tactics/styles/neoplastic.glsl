// Neo-Plastic — asymmetric balance. A breathing partition with heavy black rules and primary fields, or a Broadway
// Boogie-Woogie street grid of travelling blocks. Attach an image and every field is snapped to the nearest palette
// colour of what the photograph holds there.
vec3 photoCell(vec2 c, vec2 sz) {
  vec3 a = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec2 o = i == 0 ? vec2(0.0) : (i == 1 ? vec2(0.3, 0.3) : i == 2 ? vec2(-0.3, 0.3) : i == 3 ? vec2(0.3, -0.3) : vec2(-0.3, -0.3));
    vec4 s = m_sourceUV(c + o * sz); a += s.rgb + u_bg * (1.0 - s.a);
  }
  return a * 0.2;
}
vec3 pick(vec2 c, vec2 sz, vec3 hashed) {
  if (u_sourceOn < 0.5) return hashed;
  return mix(hashed, itNearestPal(photoCell(c, sz), 0.4 + p_empty * 1.4), p_photo);
}

vec4 motif(vec2 uv, vec2 fc) {
  vec3 paper = u_bg * (1.0 + 0.035 * itPaper(uv));
  vec2 p = rot(radians(p_angle)) * uv;
  float slot = tslot(float(p_recolor)), fr = tfrac(float(p_recolor)), nslot = itNext(slot, float(p_recolor));
  vec3 col = paper;
  if (p_mode == MODE_COMPOSITION) {
    vec2 ext = p_bleed ? vec2(length(M_asp()) * 1.05) : M_asp();
    vec2 lo, hi; float id;
    itKD(p, ext, p_depth, p_stop, p_drift, float(p_cycles), 0.0, lo, hi, id);
    vec2 sz = hi - lo, ctr = (lo + hi) * 0.5;
    vec3 fill = itStijlFill(id, p_empty, slot, nslot, fr, 0.0);
    fill = pick(rot(-radians(p_angle)) * ctr, sz, fill);
    col = fill == u_bg ? paper : fill;
    float e = min(min(p.x - lo.x, hi.x - p.x), min(p.y - lo.y, hi.y - p.y));
    float lw = p_line * (0.55 + 0.9 * itH(vec2(id, 66.0)));
    col = mix(col, u_ink, 1.0 - smoothstep(lw * 0.5 - aa(), lw * 0.5 + aa(), e));
    // a hairline of shadow inside a coloured field gives it body
    col *= 1.0 - 0.06 * smoothstep(0.03, 0.0, e) * step(0.001, lw);
  } else {
    // Broadway Boogie-Woogie
    float N = float(p_cells);
    vec2 g = p * N + 0.37 * N; vec2 cid = floor(g), f = fract(g);
    int cx = int(cid.x), cy = int(cid.y);
    int mx = ((cx % 3) + 3) % 3, my = ((cy % 3) + 3) % 3;
    float k = float(p_speed);
    vec3 gray = mix(u_bg, u_ink, 0.25);
    if (my == 0 && mx != 0) {
      float dir = itH(vec2(cid.y, 3.0)) < 0.5 ? 1.0 : -1.0;
      float sx = g.x - dir * k * u_p;
      float bi = floor(sx);
      float h = itH(vec2(bi, cid.y + slot * 5.0));
      vec3 c = h < 0.5 ? u_a1 : h < 0.68 ? u_a0 : h < 0.82 ? u_a2 : h < 0.92 ? gray : paper;
      vec2 bc = vec2((bi + 0.5 - 0.37 * N) / N, (cid.y + 0.5 - 0.37 * N) / N);
      c = pick(rot(-radians(p_angle)) * bc, vec2(1.0 / N), c);
      float cov = 1.0 - smoothstep(-aa(), aa(), sdBox(vec2(fract(sx) - 0.5, f.y - 0.5) / N, vec2(0.44, 0.40) / N));
      col = mix(col, c, cov);
    } else if (mx == 0 && my != 0) {
      float dir = itH(vec2(cid.x, 4.0)) < 0.5 ? 1.0 : -1.0;
      float sy = g.y - dir * k * u_p;
      float bi = floor(sy);
      float h = itH(vec2(cid.x + slot * 5.0, bi + 9.0));
      vec3 c = h < 0.5 ? u_a1 : h < 0.68 ? u_a0 : h < 0.82 ? u_a2 : h < 0.92 ? gray : paper;
      vec2 bc = vec2((cid.x + 0.5 - 0.37 * N) / N, (bi + 0.5 - 0.37 * N) / N);
      c = pick(rot(-radians(p_angle)) * bc, vec2(1.0 / N), c);
      float cov = 1.0 - smoothstep(-aa(), aa(), sdBox(vec2(f.x - 0.5, fract(sy) - 0.5) / N, vec2(0.40, 0.44) / N));
      col = mix(col, c, cov);
    } else if (mx == 0 && my == 0) {
      float h = itH(cid + 2.0 + slot);
      vec3 c1 = accent(floor(h * 9.0)), c2 = itH(cid + 8.0) < 0.5 ? paper : u_a0;
      vec2 d = (f - 0.5) / N;
      float o = 1.0 - smoothstep(-aa(), aa(), sdBox(d, vec2(0.46) / N));
      float i1 = 1.0 - smoothstep(-aa(), aa(), sdBox(d, vec2(0.26 + 0.1 * p_nest) / N));
      col = mix(col, mix(c1, c2, i1), o);
    } else {
      // the 2x2 plots between streets: sometimes a nested square
      vec2 blk = floor(vec2(cid.x - float(mx - 1), cid.y - float(my - 1)) / 3.0);
      float hb = itH(blk + 21.0 + slot);
      if (hb < p_nest) {
        vec2 u = (vec2(float(mx - 1), float(my - 1)) + f) / 2.0;
        vec2 d = u - 0.5;
        vec3 c1 = accent(floor(hb * 3.0 / max(p_nest, 1e-3) + itH(blk) * 3.0));
        float o = 1.0 - smoothstep(-0.01, 0.01, max(abs(d.x), abs(d.y)) - 0.42);
        float i1 = 1.0 - smoothstep(-0.01, 0.01, max(abs(d.x), abs(d.y)) - 0.22);
        col = mix(col, mix(c1, itH(blk + 5.0) < 0.5 ? paper : gray, i1), o);
      }
    }
  }
  return vec4(col, 1.0);
}
