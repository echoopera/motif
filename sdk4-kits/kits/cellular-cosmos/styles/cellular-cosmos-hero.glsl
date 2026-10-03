// Cellular Cosmos: Cellular Cosmos Hero. Form: weighted Voronoi, two species. Material: translucent bodies, bright membranes in dark channels. Motion: division, migration, reintegration.
// Cellular Cosmos: analytic looped colony lifecycle on a weighted two-site-per-cell Voronoi field.
// Field classes
//   voronoi  exact   nearest of 18 candidate sites (3x3 grid cells x parent+child), additive weights give irregular cell sizes
//   membrane bound   (F2 - F1) is a conservative bound on the distance to the cell border (exact for equal weights)
//   organs   exact   radial filaments and organelle points in the winning cell's local polar frame
// Lifecycle (no persistent simulation exists in the SDK): each grid cell hosts a parent site and a child site. The child leaves the parent
// (division), migrates, and rejoins (reintegration) on a closed schedule k * theta + seeded phase. IDs come from the grid cell, never from time;
// the child's territory weight reaches zero before it coincides with the parent, so appearance and disappearance are smooth.

struct Site { vec2 pos; float w; float id; float sib; float sc; float ph; };

float cellSize() { return 0.86 * sqrt(1.78 / float(p_count)); }

Site getSite(vec2 cid, int s, float cs, float th) {
  Site o;
  vec2 hh = h22(cid), h2 = h22(cid + 17.3);
  float idh = h21(cid + 3.1);
  vec2 home = (cid + 0.5 + 0.70 * (hh - 0.5)) * cs;
  float ph = TAU * h2.x;
  float calm = k_calm();
  float tide = (0 == 8) ? (home.x * 5.0 + home.y * 3.0) : 0.0;
  vec2 mig = min(p_migrate, 0.5 * cs) * calm * vec2(cos(th + ph + tide), sin(th + ph * 1.3 + tide)) * (0 == 8 ? 1.4 : 1.0);
  vec2 par = home + mig;
  float lc = float(p_cycles);
  float sc = 0.5 - 0.5 * cos(lc * th + TAU * h2.y);                          // 0..1 closed schedule per cell
  sc = sc * sc * (3.0 - 2.0 * sc);
  sc *= smoothstep(0.08, 0.2, idh);                                          // a few cells never divide
  o.id = idh; o.sc = sc; o.ph = ph;
  if (s == 0) { o.pos = par; o.w = (hh.x - 0.5) * 0.30 * cs - 0.10 * cs * sc; o.sib = 0.0; }
  else {
    float a = TAU * hh.y;
    vec2 dir = vec2(cos(a), sin(a));
    o.pos = par + dir * min(p_divAmp * 2.4 * cs, 0.75 * cs) * sc;
    o.w = (sc - 1.0) * 0.55 * cs + (h2.x - 0.5) * 0.12 * cs; o.sib = 1.0;
  }
  return o;
}

vec3 cellBody(vec2 l, float F1, float F2, Site S, float species, float th, float edgeD, float depthIn, float cs) {
  float r = length(l);
  float ang = atan(l.y, l.x);
  float calm = k_calm();
  vec3 emerald = u_a0, coral = u_a1;
  vec3 mem = mix(emerald, coral, species);
  vec3 col = vec3(0.0);
  // translucent body: dark teal at the border rising to a brighter core
  float inside = clamp(depthIn, 0.0, 1.0);
  vec3 body = k_mix(u_a2 * 0.55, mem * 0.55, pow(inside, 0.7));
  col += body * (1.0 - p_translucency * 0.85) * (0.30 + 0.5 * inside);
  col += mem * 0.10 * p_translucency * inside;
  // radial organs: whole-number filament count in angle, advected by a whole harmonic of theta
  float nf = float(p_filaments) * (species > 0.5 ? 0.6 : 1.0);
  float dirA = (S.id > 0.5) ? 1.0 : -1.0;
  float fl = 0.5 + 0.5 * sin(ang * floor(nf) + 1.2 * sin(r * 26.0 + dirA * th) + dirA * th * 2.0 + S.ph);
  float fil = mix(0.30, pow(fl, species > 0.5 ? 6.0 : 10.0), calm);          // sweeping rays calm down on very short loops
  float organsOn = (0 == 3 || 0 == 4 || 0 == 5) ? 0.0 : 1.0;
  float span = smoothstep(0.02, 0.14, r / cs) * (1.0 - smoothstep(0.35, 0.95, r / max(F1 + 0.5 * (F2 - F1), 1e-3)));
  col += mem * 0.9 * fil * span * inside * organsOn * (0 == 6 ? 1.9 : 1.0);
  // coral colony: scalloped rim and polyp tips
  if (species > 0.5) {
    float sc = 0.5 + 0.5 * cos(ang * 9.0 + S.ph);
    float rim = exp(-pow((r - (0.30 + 0.06 * sc) * cs) / (0.012 * cs + 0.002), 2.0));
    col += coral * 1.0 * rim * inside * 1.2;
    float tip = pow(sc, 8.0) * exp(-pow((r - 0.36 * cs) / (0.03 * cs + 0.002), 2.0));
    col += mix(coral, u_ink, 0.5) * tip * 1.6 * inside;
  }
  // organelles: seeded points circling the nucleus (closed orbits)
  float od = 0.0;
  for (int k = 0; k < 7; k++) {
    if (float(k) >= p_organelles * 7.0) break;
    if (k_q() == 0 && k >= 3) break;                                        // live: fewer organelle points
    float fk = float(k);
    float rk = (0.07 + 0.19 * h11(fk * 3.7 + S.id * 50.0)) * cs;
    float ak = TAU * h11(fk * 5.1 + S.id * 70.0) + dirA * th * (1.0 + mod(fk, 2.0));
    vec2 P = rk * vec2(cos(ak), sin(ak));
    float d = length(l - P);
    od += exp(-d * d / (pow(0.018 * cs + 0.001, 2.0))) * (0.6 + 0.8 * h11(fk + S.id * 11.0));
  }
  col += mix(mem, u_ink, 0.55) * od * 1.5 * inside * organsOn;
  // nucleus: warm, controlled
  col += (u_ink * 0.6 + mem * 0.7) * 1.8 * exp(-r * r / pow(0.055 * cs + 0.002, 2.0)) * (0.55 + 0.45 * inside);
  col += mem * 0.15 * exp(-r / (0.2 * cs));
  return col;
}

vec4 scene_main(vec2 uv, vec2 fc, int variant) {
  float th = k_theta();
  float cs = cellSize();
  float px = k_px();
  float speciesMix = p_species;
  if (variant == 1) speciesMix = 0.0;
  if (variant == 2) speciesMix = 1.0;
  if (variant == 4) speciesMix = 0.15;
  if (variant == 4) cs *= 0.6;
  if (variant == 6) cs *= 1.35;
  if (variant == 7) cs *= 1.15;
  vec2 p = uv + vec2(0.0, 0.0);
  vec2 cell = floor(p / cs);
  float F1 = 1e3, F2 = 1e3; Site S1, S2; bool have2 = false;
  S1.pos = vec2(0.0); S1.w = 0.0; S1.id = 0.0; S1.sib = 0.0; S1.sc = 0.0; S1.ph = 0.0; S2 = S1;
  vec2 c1 = vec2(0.0), c2 = vec2(0.0);
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 cid = cell + vec2(float(i), float(j));
    for (int s = 0; s < 2; s++) {
      Site S = getSite(cid, s, cs, th);
      float d = length(p - S.pos) - S.w;
      if (d < F1) { F2 = F1; S2 = S1; c2 = c1; F1 = d; S1 = S; c1 = cid; }
      else if (d < F2) { F2 = d; S2 = S; c2 = cid; }
    }
  }
  float edge = F2 - F1;
  bool sibling = (c1 == c2) && (S1.sib != S2.sib);
  float sibK = sibling ? smoothstep(0.02, 0.25, S1.sc * p_divAmp * 4.0 + S2.sc * p_divAmp * 4.0) : 1.0;
  // membrane bending in the choir variant: border wobble follows a closed standing wave
  float wob = 0.0;
  if (variant == 3) wob = p_wobble * cs * 0.22 * sin(6.0 * atan(p.y - S1.pos.y, p.x - S1.pos.x) + th * 2.0 + S1.ph) * smoothstep(0.0, 0.04 * cs, edge) * (1.0 - smoothstep(0.08 * cs, 0.26 * cs, edge));
  float e2 = max(edge + wob, 0.0);
  float species = step(h21(c1 * 1.9 + 7.0 + S1.sib * 0.37), speciesMix);
  float depthIn = e2 / (0.55 * cs);
  vec2 l = p - S1.pos;
  vec3 col = vec3(0.0);
  vec3 ground = mix(u_a2 * 0.18, u_bg, smoothstep(0.0, 1.1, length(uv)));
  col = ground;
  if (variant == 4) {
    // Spore Drift: sparse haze with small cells; no organs. Cell bodies are faint
  }
  float childAlive = S1.sib > 0.5 ? smoothstep(0.02, 0.2, S1.sc) : 1.0;
  float aliveOwn = childAlive;
  vec3 body = cellBody(l, F1, F2, S1, species, th, e2, depthIn, cs) * aliveOwn;
  col += body * 0.30;
  col += mix(u_a0, u_a1, species) * 0.55 * exp(-e2 / (0.07 * cs)) * 0.8 * aliveOwn * (0.4 + 0.6 * sibK);   // inner rim light
  // dark channel and bright membrane
  float mw = p_membrane * (variant == 3 ? 1.6 : 1.0);
  float chan = exp(-pow(e2 / (mw * 3.2 + 1e-4), 2.0)) * sibK * aliveOwn;
  col *= 1.0 - 0.80 * chan;
  float mem = exp(-pow(e2 / max(mw * 0.55, 1e-4), 2.0)) * sibK;
  vec3 mc = mix(u_a0, u_a1, species);
  col += mix(mc, u_ink, 0.35) * mem * (variant == 3 ? 1.7 : 1.7) * (0.35 + 0.65 * smoothstep(0.0, 0.6, S1.sib > 0.5 ? S1.sc + 0.4 : 1.0));
  col += mc * 0.22 * exp(-e2 / (mw * 5.0 + 1e-4)) * (1.0 - chan * 0.6);
  // symbiotic web: filaments between neighbouring parents
  if (variant == 5) {
    float web = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 cid = cell + vec2(float(i), float(j));
      Site A = getSite(cid, 0, cs, th);
      for (int k = 0; k < 4; k++) {
        vec2 nb = k == 0 ? vec2(1.0, 0.0) : k == 1 ? vec2(0.0, 1.0) : k == 2 ? vec2(1.0, 1.0) : vec2(-1.0, 1.0);
        Site B = getSite(cid + nb, 0, cs, th);
        float lenAB = length(B.pos - A.pos);
        float d = sdSeg(p, A.pos, B.pos);
        float fade = 1.0 - smoothstep(1.0 * cs, 1.7 * cs, lenAB);
        web += exp(-pow(d / (0.0035 + 0.003 * sin(th + lenAB * 30.0 + A.ph)), 2.0)) * fade;
        web += 0.0;
      }
    }
    col += mix(u_a0, u_ink, 0.45) * web * 1.3;
  }
  float rr = length(uv * vec2(1.0, 0.85));
  col = mix(col, u_bg * 0.6 + u_a2 * 0.06, smoothstep(0.55, 1.35, rr) * 0.35);
  if (variant == 7) col *= 1.0;
  return vec4(col, 1.0);
}

vec4 motif(vec2 uv, vec2 fc) {
  return scene_main(uv, fc, 0);
}
