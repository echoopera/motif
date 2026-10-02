// Photomontage — the image is cut into ragged shards; each shard is re-sampled with its own offset, tilt, zoom and flip,
// then treated: left alone, duotoned, halftoned, or swapped for a flat scrap with a letter. Paper rims and shadows glue it.
vec3 srcAt(vec2 q) { vec4 s = m_sourceUV(q); return mix(itProc(q), s.rgb + u_bg * (1.0 - s.a), u_sourceOn); }

vec4 motif(vec2 uv, vec2 fc) {
  float dens = p_cells;
  vec2 w = uv + p_rag * 0.16 * vec2(itN(uv * 2.7), itN(uv * 2.7 + 7.0)) + p_rag * 0.03 * vec2(itN(uv * 9.0 + 2.0), itN(uv * 9.0 + 5.0));
  vec2 x = w * dens, n = floor(x), f = fract(x);
  float d1 = 9.0, d2 = 9.0; vec2 site = vec2(0.0), sid = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j)), cid = n + g; vec2 h = itH2(cid);
    vec2 o = 0.5 + 0.9 * (h - 0.5) + p_drift * 0.5 * lc(1.0, h.x) * (0.4 + 0.6 * h.y);
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; site = (cid + o) / dens; sid = cid; } else if (d < d2) d2 = d;
  }
  float e = (d2 - d1) * 0.5 / dens;
  vec2 hv = itH2(sid + 3.0), hs = itH2(sid + 11.0);
  float th = (hv.x - 0.5) * p_twist * 3.0 + 0.2 * p_twist * lsin(1.0, hv.y);
  float zm = 1.0 + (hs.x - 0.5) * p_magnify;
  vec2 off = (hv - 0.5) * p_scatter * 0.8 + p_drift * 0.04 * lc(1.0, hs.y);
  float flip = hs.y < p_flip * 0.5 ? -1.0 : 1.0;
  vec2 rel = (uv - site) * vec2(flip, 1.0) / zm;
  vec2 q = site + rot(th) * rel + off;
  vec3 img = srcAt(q);
  float l = itLum(img);
  float mode = itH(sid + 19.0);
  vec3 col = img;
  vec3 acc = accent(floor(itH(sid + 23.0) * 30.0));
  vec3 paper = mix(u_bg, vec3(1.0), 0.3);
  if (mode < p_duo) {
    col = mix(u_ink, acc, smoothstep(0.02, 0.6, l));
    col = mix(col, paper, smoothstep(0.55, 1.0, l) * 0.9);
  } else if (mode < p_duo + p_half) {
    float tone = 1.0 - sat(l * 1.15);
    float ht = itHalf(rot(hv.x * 2.0) * (uv - site), tone, 0.0, 0.011);
    col = mix(paper, mix(u_ink, acc, step(0.5, hs.x)), ht);
  } else if (mode < p_duo + p_half + p_type) {
    int ch = itPick(p_word, itH(sid + 29.0));
    float hh = 0.9 / dens * 1.5;
    vec2 gl = rot(th * 0.5) * (uv - site);
    float cov = itGlyph(ch, gl / vec2(hh * 0.8, hh) + 0.5, 5.0 * aa() / hh, itH(sid + 31.0) < 0.5 ? 0.0 : 1.0, 0.4);
    vec3 bgc = itLum(acc) < 0.12 ? paper : acc;
    col = mix(bgc, itLum(bgc) < 0.25 ? u_bg : u_ink, cov);
  }
  col *= 1.0 + 0.05 * itPaper(uv);
  // glued rim and shadow
  float tear = itTear(uv * 38.0) * 0.0035;
  float rimW = p_rim * 0.011;
  float rim = 1.0 - smoothstep(rimW - aa(), rimW + aa(), e + tear);
  col = mix(col, paper * (1.0 + 0.04 * itPaper(uv * 0.8)), rim);
  col *= 1.0 - p_shadow * 0.5 * exp(-max(e - rimW, 0.0) * 55.0) * (1.0 - rim);
  return vec4(col, 1.0);
}
