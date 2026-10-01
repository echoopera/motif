// ---- module: engine-core v1.1.0
const __m_engine_core = (() => {
// engine-core — deterministic math for procedural styles: RNG, noise, easing,
// loop helpers, the parameter model (defaults, mutate, randomize) and text sampling.
// No DOM access except the text helpers, which accept a canvas factory.

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const fract = x => x - Math.floor(x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const local = (p, a, b) => clamp((p - a) / (b - a));
const wrap = (x, n) => ((x % n) + n) % n;

// ---------- RNG ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(...n) {
  let h = 2166136261 >>> 0;
  for (const v of n) { h ^= Math.floor(v * 1000003) | 0; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; }
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0; h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
function gauss(rng) {
  const u = Math.max(1e-9, rng()), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

// ---------- Simplex noise (3D), seeded ----------
const GRAD3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
const noiseCache = new Map();
function createNoise(seed) {
  if (noiseCache.has(seed)) return noiseCache.get(seed);
  const rng = mulberry32(seed * 9973 + 17);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
  const F3 = 1 / 3, G3 = 1 / 6;
  function n3(xin, yin, zin) {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0, tt, g;
    tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (tt > 0) { g = GRAD3[pm12[ii + perm[jj + perm[kk]]]]; tt *= tt; n += tt * tt * (g[0] * x0 + g[1] * y0 + g[2] * z0); }
    tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (tt > 0) { g = GRAD3[pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]]]; tt *= tt; n += tt * tt * (g[0] * x1 + g[1] * y1 + g[2] * z1); }
    tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (tt > 0) { g = GRAD3[pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]]]; tt *= tt; n += tt * tt * (g[0] * x2 + g[1] * y2 + g[2] * z2); }
    tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (tt > 0) { g = GRAD3[pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]]]; tt *= tt; n += tt * tt * (g[0] * x3 + g[1] * y3 + g[2] * z3); }
    return 32 * n;
  }
  // Seamless loop noise: the sample point travels a circle of radius r in noise space as phase goes 0→1.
  const loop = (x, y, phase, r = 0.6) => n3(x + Math.cos(TAU * phase) * r, y + Math.sin(TAU * phase) * r, 7.31);
  const api = { n3, loop, perm };
  noiseCache.set(seed, api);
  return api;
}

// ---------- Easing ----------
const ease = {
  linear: x => x,
  inSine: x => 1 - Math.cos((x * Math.PI) / 2),
  outSine: x => Math.sin((x * Math.PI) / 2),
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  inCubic: x => x * x * x,
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inExpo: x => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outExpo: x => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutExpo: x => (x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  smooth: x => x * x * (3 - 2 * x),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
};
// Damped spring from 0 to 1. bounce 0..1 controls overshoot; settles by x≈1.
function spring(x, bounce = 0.5) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const damp = lerp(9, 3.2, bounce), freq = lerp(5, 14, bounce);
  return 1 - Math.exp(-damp * x) * Math.cos(freq * x);
}

// ---------- Parameter model ----------
const P = {
  range: (label, min, max, def, step = 0.01, o = {}) => ({ type: 'range', label, min, max, def, step, ...o }),
  int: (label, min, max, def, o = {}) => ({ type: 'int', label, min, max, def, step: 1, ...o }),
  select: (label, options, def, o = {}) => ({ type: 'select', label, options: options.map(x => (typeof x === 'string' ? { v: x, l: x[0].toUpperCase() + x.slice(1) } : x)), def, ...o }),
  toggle: (label, def, o = {}) => ({ type: 'toggle', label, def, ...o }),
  text: (label, def, max = 40, o = {}) => ({ type: 'text', label, def, max, mutate: 0, ...o }),
};

function defaults(schema) {
  const out = {};
  for (const [k, s] of Object.entries(schema)) out[k] = s.def;
  return out;
}

function sanitize(values, schema) {
  const out = {};
  for (const [k, s] of Object.entries(schema)) {
    let v = values && k in values ? values[k] : s.def;
    if (typeof s.clean === 'function') { out[k] = s.clean(v); continue; } // structured values (text-input fonts) bring their own sanitizer
    if (s.type === 'range' || s.type === 'int') {
      v = Number(v); if (!Number.isFinite(v)) v = s.def;
      v = clamp(v, s.min, s.max); if (s.type === 'int') v = Math.round(v);
    } else if (s.type === 'select') {
      if (s.dynamic) { if (typeof v !== 'string' || !v) v = s.def; }
      else if (!s.options.some(o => o.v === v)) v = s.def;
    } else if (s.type === 'toggle') v = !!v;
    else if (s.type === 'text') v = String(v ?? '').slice(0, s.max);
    out[k] = v;
  }
  return out;
}

function quant(v, s) {
  const st = s.step || 0.01;
  const q = Math.round((v - s.min) / st) * st + s.min;
  return +clamp(q, s.min, s.max).toFixed(6);
}

// Perturb unlocked parameters. strength 0..1. Returns { values, changed }.
function mutate(values, schema, strength, locks, rng) {
  const out = { ...values }, changed = [];
  for (const [k, s] of Object.entries(schema)) {
    if (locks && locks.has(k)) continue;
    const w = s.mutate ?? 1;
    if (!w) continue;
    const st = strength * w;
    let v = values[k];
    if ((s.type === 'range' || s.type === 'int') && s.log) {
      const lo = Math.log(s.min), hi = Math.log(s.randMax || s.max);
      v = Math.exp(clamp(Math.log(Math.max(s.min, v)) + gauss(rng) * (hi - lo) * st * 0.3, lo, Math.log(s.max)));
      v = s.type === 'int' ? Math.round(v / (s.step || 1)) * (s.step || 1) : quant(v, s);
      v = clamp(v, s.min, s.max);
    } else if (s.type === 'range' || s.type === 'int') {
      const span = s.max - s.min;
      v = v + gauss(rng) * span * st * 0.45;
      v = s.type === 'int' ? Math.round(clamp(v, s.min, s.max)) : quant(v, s);
      if (s.type === 'int' && v === values[k] && rng() < st) v = clamp(values[k] + (rng() < 0.5 ? -1 : 1), s.min, s.max);
    } else if (s.type === 'select') {
      if (rng() < st * 0.5) { const opts = s.options.filter(o => o.v !== v); if (opts.length) v = opts[Math.floor(rng() * opts.length)].v; }
    } else if (s.type === 'toggle') {
      if (rng() < st * 0.33) v = !v;
    }
    if (v !== values[k]) { out[k] = v; changed.push(k); }
  }
  return { values: out, changed };
}

function randomize(values, schema, locks, rng) {
  const out = { ...values }, changed = [];
  for (const [k, s] of Object.entries(schema)) {
    if (locks && locks.has(k)) continue;
    if ((s.mutate ?? 1) === 0) continue;
    let v = values[k];
    const top = s.randMax || s.max;
    if (s.log) { v = Math.exp(Math.log(s.min) + rng() * (Math.log(top) - Math.log(s.min))); v = s.type === 'int' ? Math.round(v) : quant(v, s); }
    else if (s.type === 'range') v = quant(s.min + rng() * (top - s.min), s);
    else if (s.type === 'int') v = Math.round(s.min + rng() * (top - s.min));
    else if (s.type === 'select') v = s.options[Math.floor(rng() * s.options.length)].v;
    else if (s.type === 'toggle') v = rng() < 0.5;
    if (v !== values[k]) { out[k] = v; changed.push(k); }
  }
  return { values: out, changed };
}

// ---------- Memo + text sampling (browser) ----------
const memoStore = new Map();
function memo(key, fn) {
  if (memoStore.has(key)) return memoStore.get(key);
  const v = fn();
  memoStore.set(key, v);
  if (memoStore.size > 80) memoStore.delete(memoStore.keys().next().value);
  return v;
}
function scratch(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  return c;
}
function makeCanvas(w, h) { return scratch(Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }

// Largest font size (in canvas units) so `text` fits maxW × maxH.
function fitFont(ctx, text, fontCss, weight, maxW, maxH) {
  const lines = String(text).split('\n');
  const M = 100; ctx.font = `${weight} ${M}px ${fontCss}`;
  let wMax = 1;
  for (const l of lines) wMax = Math.max(wMax, ctx.measureText(l).width);
  const byW = (maxW / wMax) * M, byH = maxH / (lines.length * 1.05);
  return Math.max(4, Math.min(byW, byH));
}

// Sample filled glyph pixels of `text` as points in a w × h frame. Cached.
function sampleText(text, fontCss, weight, w, h, count, fill = 0.72) {
  const key = `st|${text}|${fontCss}|${weight}|${Math.round(w)}|${Math.round(h)}|${count}|${fill}`;
  return memo(key, () => {
    const S = 400 / Math.max(w, h);
    const cw = Math.max(8, Math.round(w * S)), ch = Math.max(8, Math.round(h * S));
    const c = scratch(cw, ch), x = c.getContext('2d');
    const size = fitFont(x, text, fontCss, weight, cw * fill, ch * fill * 0.9);
    x.font = `${weight} ${size}px ${fontCss}`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'white'; // token-lint-ignore (mask only)
    const lines = String(text).split('\n');
    lines.forEach((l, i) => x.fillText(l, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * size * 1.02));
    const d = x.getImageData(0, 0, cw, ch).data, pts = [];
    for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) if (d[(yy * cw + xx) * 4 + 3] > 140) pts.push([xx / S, yy / S]);
    const rng = mulberry32(pts.length + count);
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = pts[i]; pts[i] = pts[j]; pts[j] = t; }
    return pts.slice(0, count);
  });
}

return { TAU, clamp, lerp, fract, smooth, local, wrap, mulberry32, hash, gauss, createNoise, ease, spring, P, defaults, sanitize, mutate, randomize, memo, makeCanvas, fitFont, sampleText };

})();

