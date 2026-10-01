// ---- module: colour v1.0.0
const __m_colour = (() => {
// colour — brand palettes, palette resolution (with key cross-fades), OKLab/OKLCH maths,
// per-colour locks, palette mutation, image extraction, output colour spaces and the
// broadcast-safe limiter reference implementation. Allowed to hold raw colour values.
const { PALETTES, rgbOf, alpha, mix, mixRgb, luminance } = __m_tokens;

const SLOTS = ['bg', 'ink', 'a0', 'a1', 'a2'];
const SLOT_LABELS = { bg: 'Background', ink: 'Ink', a0: 'Accent 1', a1: 'Accent 2', a2: 'Accent 3' };

// ---------- conversions ----------
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const toLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
function hexToRgb01(hex) { return rgbOf(hex).map(v => v / 255); }
function rgb01ToHex(r, g, b) { const h = v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0'); return `#${h(r)}${h(g)}${h(b)}`.toUpperCase(); }
function rgbToOklab(r, g, b) {
  r = toLin(r); g = toLin(g); b = toLin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToRgb(L, a, b) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3), s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [toGam(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), toGam(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), toGam(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}
function hexToOklch(hex) { const [L, a, b] = rgbToOklab(...hexToRgb01(hex)); return [L, Math.hypot(a, b), Math.atan2(b, a)]; }
function inGamut(r, g, b) { return r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001; }
// OKLCH → hex, reducing chroma until it fits sRGB.
function oklchToHex(L, C, h) {
  L = clamp01(L);
  for (let c = C; c >= 0; c -= 0.005) { const rgb = oklabToRgb(L, c * Math.cos(h), c * Math.sin(h)); if (inGamut(...rgb)) return rgb01ToHex(...rgb); }
  return rgb01ToHex(...oklabToRgb(L, 0, 0));
}
function contrast(hexA, hexB) { const a = luminance(hexA), b = luminance(hexB); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
const validHex = v => /^#?[0-9a-fA-F]{6}$/.test(String(v || '').trim());
const normHex = v => ('#' + String(v).trim().replace('#', '')).toUpperCase();

// ---------- palettes ----------
function builtin(id) { return PALETTES.find(p => p.id === id) || null; }
function paletteById(id, customs) { return (customs || []).find(p => p.id === id) || builtin(id) || PALETTES[0]; }
function slotsOf(p) { return { bg: p.bg, ink: p.ink, a0: p.a[0], a1: p.a[1], a2: p.a[2] }; }
function fromSlots(o, meta) { return { ...meta, bg: o.bg, ink: o.ink, a: [o.a0, o.a1, o.a2] }; }
let uid = 0;
function newId() { uid++; return `c-${Date.now().toString(36).slice(-5)}${uid.toString(36)}`; }
function customFrom(p, name) { return { id: newId(), name: name || `${p.name} brand`, bg: p.bg, ink: p.ink, a: p.a.slice(), locks: [] }; }
function sanitizeCustom(p) {
  if (!p || typeof p !== 'object') return null;
  const ok = [p.bg, p.ink, ...(p.a || [])].every(validHex) && Array.isArray(p.a) && p.a.length === 3;
  if (!ok) return null;
  return { id: /^c-[a-z0-9]+$/i.test(p.id) ? p.id : newId(), name: String(p.name || 'Brand').slice(0, 40), bg: normHex(p.bg), ink: normHex(p.ink), a: p.a.map(normHex), locks: Array.isArray(p.locks) ? p.locks.filter(s => SLOTS.includes(s)) : [] };
}

// Resolved palette handed to styles. `mixWith` + `t` cross-fade two palettes (keyframed palettes).
function resolvePalette(id, invert, customs, mixWith, t) {
  let p = paletteById(id, customs);
  if (mixWith && t > 0) {
    const q = paletteById(mixWith, customs), m = (x, y) => mixHex(x, y, t);
    p = { id: p.id, name: p.name, bg: m(p.bg, q.bg), ink: m(p.ink, q.ink), a: p.a.map((c, i) => m(c, q.a[i])) };
  }
  const bg = invert ? p.ink : p.bg, ink = invert ? p.bg : p.ink;
  const list = [ink, ...p.a];
  return {
    id: p.id, name: p.name, bg, ink, a: p.a.slice(),
    pick: i => list[((i % list.length) + list.length) % list.length],
    accent: i => p.a[((i % p.a.length) + p.a.length) % p.a.length],
    alpha, mix, mixRgb, rgbOf,
    dark: luminance(bg) < 0.3,
    shade: luminance(bg) < 0.3 ? '#000000' : ink,
    grainLight: '#FFFFFF', grainDark: '#000000',
  };
}
// Perceptual mix in OKLab, returned as hex (so styles can keep using hex helpers).
function mixHex(a, b, t) {
  const A = rgbToOklab(...hexToRgb01(a)), B = rgbToOklab(...hexToRgb01(b));
  const rgb = oklabToRgb(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  return rgb01ToHex(...rgb);
}

// Mutate unlocked colours in OKLCH. strength 0..1. Keeps bg/ink contrast ≥ 3:1.
function mutatePalette(p, locks, strength, rng) {
  const o = slotsOf(p), lk = new Set(locks || p.locks || []);
  const hueShift = (rng() - 0.5) * Math.PI * 1.2 * strength;
  for (const s of SLOTS) {
    if (lk.has(s)) continue;
    const [L, C, h] = hexToOklch(o[s]);
    const isAccent = s[0] === 'a';
    const nL = isAccent ? L + (rng() - 0.5) * 0.25 * strength : L + (rng() - 0.5) * 0.08 * strength;
    const nC = isAccent ? Math.max(0, C * (1 + (rng() - 0.4) * 0.8 * strength)) : C;
    const nh = h + hueShift + (isAccent ? (rng() - 0.5) * 0.9 * strength : 0);
    o[s] = oklchToHex(nL, nC, nh);
  }
  if (contrast(o.bg, o.ink) < 3 && !lk.has('ink')) { const [L, C, h] = hexToOklch(o.bg); o.ink = oklchToHex(L > 0.55 ? 0.18 : 0.94, Math.min(C, 0.04), h); }
  return { ...p, ...fromSlots(o, {}), id: p.id, name: p.name, locks: [...lk] };
}

// Harmonize: rebuild unlocked accents from the most saturated locked colour (or bg) as an analogous/triadic set.
function harmonize(p, locks, scheme = 'triad') {
  const o = slotsOf(p), lk = new Set(locks || p.locks || []);
  const anchors = SLOTS.filter(s => lk.has(s) && s[0] === 'a');
  const anchorHex = anchors.length ? o[anchors[0]] : o.a0;
  const [L, C, h] = hexToOklch(anchorHex);
  const offsets = scheme === 'analogous' ? [0, 0.5, -0.5] : scheme === 'complement' ? [0, Math.PI, Math.PI * 0.85] : [0, (2 * Math.PI) / 3, (-2 * Math.PI) / 3];
  ['a0', 'a1', 'a2'].forEach((s, i) => { if (!lk.has(s)) o[s] = oklchToHex(L + (i === 2 ? -0.08 : 0), Math.max(0.08, C), h + offsets[i]); });
  if (!lk.has('ink') && contrast(o.bg, o.ink) < 4.5) { const [bl] = hexToOklch(o.bg); o.ink = oklchToHex(bl > 0.55 ? 0.16 : 0.95, 0.02, h); }
  return { ...p, ...fromSlots(o, {}), id: p.id, name: p.name, locks: [...lk] };
}

// k-means in OKLab over sampled pixels → 5 slots. Locked slots keep their colour.
function extractPalette(imageData, p, locks, rng) {
  const d = imageData.data, px = [];
  const stepPx = Math.max(1, Math.floor((d.length / 4) / 6000));
  for (let i = 0; i < d.length / 4; i += stepPx) { const k = i * 4; if (d[k + 3] < 128) continue; px.push(rgbToOklab(d[k] / 255, d[k + 1] / 255, d[k + 2] / 255)); }
  if (px.length < 8) throw new Error('the image has too few opaque pixels');
  const K = 7; let cents = Array.from({ length: K }, () => px[Math.floor(rng() * px.length)].slice());
  const counts = new Array(K).fill(0);
  for (let it = 0; it < 12; it++) {
    const sum = Array.from({ length: K }, () => [0, 0, 0]); counts.fill(0);
    for (const q of px) {
      let bi = 0, bd = Infinity;
      for (let c = 0; c < K; c++) { const e = cents[c], dd = (q[0] - e[0]) ** 2 + (q[1] - e[1]) ** 2 + (q[2] - e[2]) ** 2; if (dd < bd) { bd = dd; bi = c; } }
      counts[bi]++; sum[bi][0] += q[0]; sum[bi][1] += q[1]; sum[bi][2] += q[2];
    }
    cents = cents.map((c, i) => (counts[i] ? sum[i].map(v => v / counts[i]) : px[Math.floor(rng() * px.length)].slice()));
  }
  const clusters = cents.map((c, i) => ({ lab: c, n: counts[i], chroma: Math.hypot(c[1], c[2]), hex: rgb01ToHex(...oklabToRgb(...c)) })).filter(c => c.n > 0).sort((a, b) => b.n - a.n);
  const o = slotsOf(p), lk = new Set(locks || p.locks || []);
  const used = new Set();
  const take = (score) => { let best = null; for (const c of clusters) if (!used.has(c) && (!best || score(c) > score(best))) best = c; if (best) used.add(best); return best; };
  if (!lk.has('bg')) { const c = take(c => c.n); if (c) o.bg = c.hex; }
  if (!lk.has('ink')) { const c = take(c => Math.abs(c.lab[0] - rgbToOklab(...hexToRgb01(o.bg))[0]) * 2 + c.n / px.length); if (c) o.ink = c.hex; if (contrast(o.bg, o.ink) < 3) { const [bl, , bh] = hexToOklch(o.bg); o.ink = oklchToHex(bl > 0.55 ? 0.16 : 0.95, 0.02, bh); } }
  for (const s of ['a0', 'a1', 'a2']) { if (lk.has(s)) continue; const c = take(c => c.chroma * 3 + c.n / px.length); if (c) o[s] = c.hex; }
  return { ...p, ...fromSlots(o, {}), id: p.id, name: p.name, locks: [...lk] };
}

// ---------- output colour spaces ----------
const SPACES = [
  { id: 'srgb', label: 'sRGB', canvas: 'srgb', note: 'Web and social', video: { primaries: 'bt709', transfer: 'iec61966-2-1', matrix: 'bt709', fullRange: true } },
  { id: 'p3', label: 'Display P3', canvas: 'display-p3', note: 'Apple displays, wide gamut', video: { primaries: 'smpte432', transfer: 'iec61966-2-1', matrix: 'bt709', fullRange: true } },
  { id: 'rec709', label: 'Rec.709', canvas: 'srgb', note: 'Broadcast HD, limited range', video: { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false } },
];
const spaceById = id => SPACES.find(s => s.id === id) || SPACES[0];

// Broadcast-safe reference (the GPU shader mirrors this). Inputs 0..1 sRGB-encoded.
// Soft-knee luma above 0.92 into ≤1.0 (100 IRE) and scale chroma so Y ± |C| stays in −0.10…1.10 (composite −10…110 IRE).
function legalize(r, g, b) {
  let Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  let cr = r - Y, cg = g - Y, cb = b - Y;
  const knee = 0.92;
  if (Y > knee) { const nY = knee + (1 - knee) * (1 - Math.exp(-(Y - knee) / (1 - knee))); Y = nY; }
  const amp = Math.max(Math.abs(cr), Math.abs(cg), Math.abs(cb));
  const room = Math.min(1.1 - Y, Y + 0.1);
  const k = amp > room && amp > 0 ? room / amp : 1;
  return [clamp01(Y + cr * k), clamp01(Y + cg * k), clamp01(Y + cb * k)];
}
function isIllegal(r, g, b) { const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b; const amp = Math.max(Math.abs(r - Y), Math.abs(g - Y), Math.abs(b - Y)); return Y > 0.99 || Y + amp > 1.1 || Y - amp < -0.1; }

// Gradient-map stops for the finish stack, from a resolved palette.
function gradientStops(pal, mode) {
  if (mode === 'duotone') return [pal.bg, mixHex(pal.bg, pal.a[0], 0.5), pal.a[0]];
  if (mode === 'ink') return [pal.bg, mixHex(pal.bg, pal.ink, 0.5), pal.ink];
  return [pal.bg, pal.a[0], pal.a[1]];
}

return { SLOTS, SLOT_LABELS, SPACES, spaceById, hexToOklch, oklchToHex, mixHex, contrast, validHex, normHex, paletteById, slotsOf, fromSlots, customFrom, sanitizeCustom, resolvePalette, mutatePalette, harmonize, extractPalette, legalize, isIllegal, gradientStops, hexToRgb01 };

})();

