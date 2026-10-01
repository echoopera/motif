// ---- module: grade v1.0.0
const __m_grade = (() => {
// grade — the node grade: a small, versioned node graph (serial + parallel nodes, mixers) whose parameters
// are ordinary project channels (path G:<nodeId>:<key>: keyframable, lockable, audio-mappable, saved with
// projects and presets). Compiled to GLSL and evaluated inside the finish shader in one pass (plus a
// quarter-res key pass per blurred qualifier). Also: strict .cube / .3dl / HALD LUT parsing, .cube export,
// and a LUT registry. Engine-side: no DOM, no window — runs unchanged in a Worker.
const { P, sanitize, defaults, clamp } = __m_engine_core;

const VERSION = 1;
const MAX_NODES = 12, MAX_LUT_NODES = 4, MAX_BLUR_KEYS = 3;
const BLENDS = [
  { v: 'normal', l: 'Normal' }, { v: 'add', l: 'Add' }, { v: 'multiply', l: 'Multiply' }, { v: 'screen', l: 'Screen' }, { v: 'overlay', l: 'Overlay' },
  { v: 'soft', l: 'Soft light' }, { v: 'difference', l: 'Difference' }, { v: 'darken', l: 'Darken' }, { v: 'lighten', l: 'Lighten' }, { v: 'luminosity', l: 'Luminosity' },
];
const HUES = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'];
const COMMON = {
  on: P.toggle('Enabled', true, { mutate: 0 }),
  mix: P.range('Opacity', 0, 1, 1, 0.01, { mutate: 0 }),
};
const R = (label, min, max, def, step, o = {}) => P.range(label, min, max, def, step, { mutate: 0.3, ...o });
const wheel = (k, l, lo, hi, def, ylo, yhi, ydef) => ({
  [k + 'R']: R(`${l} red`, lo, hi, def, 0.001), [k + 'G']: R(`${l} green`, lo, hi, def, 0.001), [k + 'B']: R(`${l} blue`, lo, hi, def, 0.001),
  [k + 'Y']: R(l, ylo, yhi, ydef, 0.001),
});
const curve = (k, l) => Object.fromEntries([0, 1, 2, 3, 4].map(i => [k + i, R(`${l} ${i * 25}%`, 0, 1, i / 4, 0.001, { mutate: 0.15 })]));
const TYPES = {
  primary: { name: 'Primaries', short: 'PRI', hint: 'Lift, gamma, gain, offset, contrast and saturation',
    schema: { ...COMMON, ...wheel('lift', 'Lift', -0.5, 0.5, 0, -0.5, 0.5, 0), ...wheel('gamma', 'Gamma', -0.5, 0.5, 0, -1, 1, 0), ...wheel('gain', 'Gain', -0.5, 0.5, 0, 0, 4, 1), ...wheel('off', 'Offset', -0.5, 0.5, 0, -0.5, 0.5, 0),
      contrast: R('Contrast', 0, 2, 1, 0.01), pivot: R('Pivot', 0, 1, 0.5, 0.01, { mutate: 0 }), sat: R('Saturation', 0, 2, 1, 0.01), hue: R('Hue rotate', -180, 180, 0, 1, { unit: '°', mutate: 0.15 }) } },
  curves: { name: 'Curves', short: 'CRV', hint: 'Luma and RGB curves, five points each',
    schema: { ...COMMON, ...curve('y', 'Luma'), ...curve('r', 'Red'), ...curve('g', 'Green'), ...curve('b', 'Blue') } },
  huesat: { name: 'Hue curves', short: 'HUE', hint: 'Hue vs saturation and hue vs hue',
    schema: { ...COMMON, ...Object.fromEntries(HUES.map((h, i) => ['s' + i, R(`Sat · ${h}`, 0, 2, 1, 0.01)])), ...Object.fromEntries(HUES.map((h, i) => ['h' + i, R(`Hue · ${h}`, -60, 60, 0, 1, { unit: '°', mutate: 0.15 })])) } },
  qualifier: { name: 'HSL qualifier', short: 'QUAL', hint: 'Key a hue, saturation and luma range, then correct inside it',
    schema: { ...COMMON, hue: R('Key hue', 0, 360, 25, 1, { unit: '°', mutate: 0 }), width: R('Hue width', 1, 360, 60, 1, { unit: '°', mutate: 0 }),
      satLo: R('Sat low', 0, 1, 0.1, 0.01, { mutate: 0 }), satHi: R('Sat high', 0, 1, 1, 0.01, { mutate: 0 }), lumLo: R('Luma low', 0, 1, 0.05, 0.01, { mutate: 0 }), lumHi: R('Luma high', 0, 1, 1, 0.01, { mutate: 0 }),
      soft: R('Softness', 0, 0.5, 0.08, 0.01, { mutate: 0 }), blur: R('Key blur', 0, 1, 0, 0.01, { mutate: 0 }), invert: P.toggle('Invert key', false, { mutate: 0 }),
      qHue: R('Hue shift', -180, 180, 0, 1, { unit: '°' }), qSat: R('Saturation', 0, 2, 1, 0.01), qGain: R('Gain', 0, 2, 1, 0.01), qOff: R('Offset', -0.5, 0.5, 0, 0.001) } },
  lut: { name: 'LUT', short: 'LUT', hint: 'Apply an imported .cube, .3dl or HALD LUT',
    schema: { ...COMMON, interp: P.select('Interpolation', [{ v: 'tetra', l: 'Tetrahedral' }, { v: 'tri', l: 'Trilinear' }], 'tetra', { mutate: 0 }) } },
  mixer: { name: 'Mixer', short: 'MIX', hint: 'Blend the chain over an earlier node or the grade input',
    schema: { ...COMMON, blend: P.select('Blend', BLENDS, 'normal', { mutate: 0 }) } },
};
const TYPE_IDS = Object.keys(TYPES);
const schemaFor = type => (TYPES[type] ? TYPES[type].schema : null);

// ---------- model ----------
const ID_RE = /^n[a-z0-9]{1,12}$/, LUT_ID_RE = /^lut_[a-z0-9]{8,32}$/;
function freshId(used) { let i = used.size + 1, id; do { id = 'n' + (i++).toString(36); } while (used.has(id)); return id; }
function newGrade() { return { v: VERSION, on: true, nodes: [] }; }
function newNode(type, used, extra = {}) {
  if (!TYPES[type]) throw new Error('grade: unknown node type ' + type);
  const ids = used instanceof Set ? used : new Set((used || []).map(n => n.id));
  const n = { id: freshId(ids), type, par: false, params: defaults(schemaFor(type)) };
  if (type === 'mixer') n.src = 'in';
  if (type === 'lut') n.lut = null;
  return Object.assign(n, extra);
}
function sanitizeLutRef(r) {
  if (!r || typeof r !== 'object' || !LUT_ID_RE.test(String(r.id || ''))) return null;
  return { id: r.id, name: String(r.name || 'LUT').slice(0, 80), size: clamp(Math.round(Number(r.size) || 0), 0, 65536) };
}
// Additive and forward-tolerant: unknown node types and fields are dropped, unknown versions sanitize as v1.
function sanitizeGrade(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return null;
  const out = { v: VERSION, on: g.on !== false, nodes: [] }; const ids = new Set();
  let luts = 0;
  for (const n of (Array.isArray(g.nodes) ? g.nodes : [])) {
    if (out.nodes.length >= MAX_NODES) break;
    if (!n || typeof n !== 'object' || !TYPES[n.type]) continue;
    if (n.type === 'lut' && luts >= MAX_LUT_NODES) continue;
    const id = typeof n.id === 'string' && ID_RE.test(n.id) && !ids.has(n.id) ? n.id : freshId(ids); ids.add(id);
    const node = { id, type: n.type, par: !!n.par && out.nodes.length > 0 && n.type !== 'mixer', params: sanitize(n.params && typeof n.params === 'object' ? n.params : {}, schemaFor(n.type)) };
    if (typeof n.label === 'string' && n.label.trim()) node.label = n.label.trim().slice(0, 24);
    if (n.type === 'mixer') node.src = n.src === 'in' || out.nodes.some(m => m.id === n.src) ? n.src : 'in';
    if (n.type === 'lut') { node.lut = sanitizeLutRef(n.lut); luts++; }
    out.nodes.push(node);
  }
  return out;
}
function nodeById(g, id) { return g && Array.isArray(g.nodes) ? g.nodes.find(n => n.id === id) || null : null; }
function schemaAt(g, nodeId, key) { const n = nodeById(g, nodeId); const s = n && schemaFor(n.type); return (s && s[key]) || null; }
function active(g) { return !!(g && g.on !== false && Array.isArray(g.nodes) && g.nodes.length); }
// Per-frame working copy (keys and audio maps write into params).
function evalCopy(g) { return { v: g.v, on: g.on !== false, nodes: (g.nodes || []).filter(n => n && TYPES[n.type]).map(n => ({ ...n, params: sanitize(n.params, schemaFor(n.type)) })) }; }
function nodeLabel(g, n) { const i = g.nodes.indexOf(n); return n.label || `${i + 1} ${TYPES[n.type].name}`; }
function paths(g, numericOnly) {
  const out = []; if (!g) return out;
  g.nodes.forEach((n, i) => { for (const [k, s] of Object.entries(schemaFor(n.type))) if (!numericOnly || s.type === 'range' || s.type === 'int') out.push({ path: `G:${n.id}:${k}`, label: `Grade ${i + 1} ${s.label}`, group: 'Grade' }); });
  return out;
}

// ---------- LUTs ----------
const MAX_TEXT = 24 * 1048576, MAX_3D = 65, MAX_1D = 4096, MAX_ABS = 1e6;
class LutError extends Error { constructor(code, message, line) { super(message); this.name = 'LutError'; this.code = code; if (line) this.line = line; } }
const NUM_RE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
function num(tok, line) { if (!NUM_RE.test(tok)) throw new LutError('number', `Line ${line}: “${String(tok).slice(0, 24)}” isn’t a number.`, line); const v = Number(tok); if (!Number.isFinite(v) || Math.abs(v) > MAX_ABS) throw new LutError('number', `Line ${line}: value out of range.`, line); return v; }
// .cube (Resolve / Adobe): 1D, 3D, or 1D shaper + 3D. Red varies fastest. Strict: exact entry counts, finite numbers, keywords before data.
function parseCube(text, name = 'LUT') {
  if (typeof text !== 'string') throw new LutError('format', 'That file couldn’t be read as text.');
  if (text.length > MAX_TEXT) throw new LutError('too-large', 'That LUT file is larger than 24 MB.');
  if (/\u0000/.test(text.slice(0, 4096))) throw new LutError('format', 'That file is binary, not a text .cube LUT.');
  let title = '', size1 = 0, size3 = 0; let min3 = [0, 0, 0], max3 = [1, 1, 1], min1 = [0, 0, 0], max1 = [1, 1, 1];
  let vals = null, n = 0, expected = 0, dataLine = 0; const lines = text.split(/\r\n|\n|\r/);
  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1; const raw = lines[i]; const s = raw.trim();
    if (!s || s[0] === '#') continue;
    if (/^[+-]?(nan|inf)/i.test(s)) throw new LutError('number', `Line ${ln}: values must be finite numbers.`, ln);
    if (/^[A-Za-z_]/.test(s)) {
      if (vals) throw new LutError('keyword', `Line ${ln}: keywords must come before the table.`, ln);
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*(.*)$/.exec(s); const key = m[1].toUpperCase(), rest = m[2].trim(); const toks = rest ? rest.split(/\s+/) : [];
      if (key === 'TITLE') { title = rest.replace(/^"|"$/g, '').slice(0, 80); continue; }
      if (key === 'LUT_3D_SIZE' || key === 'LUT_1D_SIZE') {
        if (toks.length !== 1 || !/^\d+$/.test(toks[0])) throw new LutError('size', `Line ${ln}: ${key} needs one whole number.`, ln);
        const v = Number(toks[0]);
        if (key === 'LUT_3D_SIZE') { if (v < 2 || v > MAX_3D) throw new LutError(v > MAX_3D ? 'too-large' : 'size', `3D LUT size ${v} isn’t supported (2 to ${MAX_3D}).`, ln); size3 = v; }
        else { if (v < 2 || v > MAX_1D) throw new LutError(v > MAX_1D ? 'too-large' : 'size', `1D LUT size ${v} isn’t supported (2 to ${MAX_1D}).`, ln); size1 = v; }
        continue;
      }
      if (key === 'DOMAIN_MIN' || key === 'DOMAIN_MAX') {
        if (toks.length !== 3) throw new LutError('domain', `Line ${ln}: ${key} needs three numbers.`, ln);
        const v = toks.map(t => num(t, ln)); if (key === 'DOMAIN_MIN') { min3 = v; min1 = v.slice(); } else { max3 = v; max1 = v.slice(); } continue;
      }
      if (key === 'LUT_1D_INPUT_RANGE' || key === 'LUT_3D_INPUT_RANGE') {
        if (toks.length !== 2) throw new LutError('domain', `Line ${ln}: ${key} needs two numbers.`, ln);
        const [lo, hi] = toks.map(t => num(t, ln)); if (key === 'LUT_1D_INPUT_RANGE') { min1 = [lo, lo, lo]; max1 = [hi, hi, hi]; } else { min3 = [lo, lo, lo]; max3 = [hi, hi, hi]; } continue;
      }
      if (/^LUT_/.test(key) || /^(LUT|CUBE|VERSION|BITDEPTH|RANGE|INPUT|OUTPUT|LUT_IN|LUT_OUT)/.test(key)) continue; // tool-specific metadata (e.g. LUT_IN_VIDEO_RANGE)
      throw new LutError('keyword', `Line ${ln}: unknown keyword “${m[1].slice(0, 24)}”. Is this a .cube file?`, ln);
    }
    if (!vals) {
      if (!size1 && !size3) throw new LutError('size', 'The file has data but no LUT_3D_SIZE or LUT_1D_SIZE line.', ln);
      expected = size1 + size3 * size3 * size3; vals = new Float32Array(expected * 3); dataLine = ln;
    }
    const toks = s.split(/\s+/);
    if (toks.length !== 3) throw new LutError('row', `Line ${ln}: each row needs three numbers (found ${toks.length}).`, ln);
    if (n >= expected) throw new LutError('count', `The table has more rows than the declared size (${expected}).`, ln);
    vals[n * 3] = num(toks[0], ln); vals[n * 3 + 1] = num(toks[1], ln); vals[n * 3 + 2] = num(toks[2], ln); n++;
  }
  if (!size1 && !size3) throw new LutError('empty', 'No LUT size found. This doesn’t look like a .cube file.');
  if (!vals || n !== expected) throw new LutError('count', `The table has ${n} rows; LUT size needs ${expected || (size1 + size3 ** 3)}.`, dataLine);
  for (let c = 0; c < 3; c++) { if (!(max3[c] > min3[c]) || !(max1[c] > min1[c])) throw new LutError('domain', 'DOMAIN_MAX must be greater than DOMAIN_MIN on every channel.'); }
  const lut = { name: String(name).slice(0, 80), title, size1, size3, min1, max1, min3, max3, data1: size1 ? vals.subarray(0, size1 * 3) : null, data3: size3 ? vals.subarray(size1 * 3) : null };
  lut.id = lutId(lut); return lut;
}
// Autodesk .3dl: optional input mesh line (integers 0..max, uniform), then N³ integer triples, blue fastest.
function parse3dl(text, name = 'LUT') {
  if (typeof text !== 'string') throw new LutError('format', 'That file couldn’t be read as text.');
  if (text.length > MAX_TEXT) throw new LutError('too-large', 'That LUT file is larger than 24 MB.');
  const rows = []; let mesh = null;
  const lines = text.split(/\r\n|\n|\r/);
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim(); if (!s || s[0] === '#') continue;
    if (/^[A-Za-z]/.test(s)) { if (/^(3DMESH|Mesh|LUT8|gamma)/i.test(s)) continue; throw new LutError('keyword', `Line ${i + 1}: unexpected text in a .3dl file.`, i + 1); }
    const toks = s.split(/\s+/);
    if (!/^\d+$/.test(toks.join(''))) throw new LutError('number', `Line ${i + 1}: .3dl values must be whole numbers.`, i + 1);
    if (toks.length !== 3) { if (!mesh && !rows.length && toks.length >= 2) { mesh = toks.map(Number); continue; } throw new LutError('row', `Line ${i + 1}: each row needs three numbers.`, i + 1); }
    rows.push(toks.map(Number)); if (rows.length > MAX_3D ** 3) throw new LutError('too-large', `3D LUTs up to ${MAX_3D}³ are supported.`);
  }
  if (!mesh && rows.length > 1) { const k = Math.round(Math.cbrt(rows.length - 1)); if (k ** 3 === rows.length - 1 && k === 3 && rows[0][0] === 0) mesh = rows.shift(); } // 3-entry mesh line looks like a row
  const N = mesh ? mesh.length : Math.round(Math.cbrt(rows.length));
  if (N < 2 || N > MAX_3D) throw new LutError('size', `A ${N}-point .3dl mesh isn’t supported (2 to ${MAX_3D}).`);
  if (mesh) { const st = mesh[1] - mesh[0]; if (mesh[0] !== 0 || mesh.some((v, i) => Math.abs(v - i * st) > Math.max(1, st * 0.02))) throw new LutError('domain', 'Only uniform .3dl input meshes are supported.'); }
  if (rows.length !== N * N * N) throw new LutError('count', `The table has ${rows.length} rows; a ${N}-point mesh needs ${N ** 3}.`);
  let mx = 0; for (const r of rows) mx = Math.max(mx, r[0], r[1], r[2]);
  const depth = mx <= 1023 ? 1023 : mx <= 4095 ? 4095 : mx <= 65535 ? 65535 : 0; if (!depth) throw new LutError('number', 'Output values exceed 16 bits.');
  const data3 = new Float32Array(N * N * N * 3);
  for (let r = 0; r < N; r++) for (let g = 0; g < N; g++) for (let b = 0; b < N; b++) { const src = rows[(r * N + g) * N + b], d = ((b * N + g) * N + r) * 3; data3[d] = src[0] / depth; data3[d + 1] = src[1] / depth; data3[d + 2] = src[2] / depth; }
  const lut = { name: String(name).slice(0, 80), title: '', size1: 0, size3: N, min1: [0, 0, 0], max1: [1, 1, 1], min3: [0, 0, 0], max3: [1, 1, 1], data1: null, data3 };
  lut.id = lutId(lut); return lut;
}
// HALD CLUT image (decoded RGBA bytes): level L → L³×L³ pixels, cube size L², red fastest.
function parseHald(rgba, w, h, name = 'HALD') {
  if (w !== h) throw new LutError('size', `A HALD image is square; this one is ${w}×${h}.`);
  const L = Math.round(Math.cbrt(w)); if (L * L * L !== w || L < 2) throw new LutError('size', `${w}×${w} isn’t a HALD size (e.g. 512×512 for level 8).`);
  if (!rgba || !(rgba.length >= w * h * 4)) throw new LutError('format', 'That image couldn’t be decoded.');
  const N = L * L; if (N > MAX_3D) throw new LutError('too-large', `HALD level ${L} (${N}³) is larger than ${MAX_3D}³.`);
  const data3 = new Float32Array(N * N * N * 3);
  for (let i = 0; i < N * N * N; i++) { data3[i * 3] = rgba[i * 4] / 255; data3[i * 3 + 1] = rgba[i * 4 + 1] / 255; data3[i * 3 + 2] = rgba[i * 4 + 2] / 255; }
  const lut = { name: String(name).slice(0, 80), title: '', size1: 0, size3: N, min1: [0, 0, 0], max1: [1, 1, 1], min3: [0, 0, 0], max3: [1, 1, 1], data1: null, data3 };
  lut.id = lutId(lut); return lut;
}
function parseLut(text, name) { return /\.3dl$/i.test(name || '') ? parse3dl(text, name) : parseCube(text, name); }
// Content id: FNV-1a over sizes, domain and the quantized table (16-bit) — stable across re-imports of the same file.
function lutId(l) {
  let h1 = 0x811c9dc5 >>> 0, h2 = 0x01000193 >>> 0;
  const mixIn = v => { h1 ^= v & 0xffff; h1 = Math.imul(h1, 16777619) >>> 0; h2 ^= (v >>> 16) ^ (h1 & 0xff); h2 = Math.imul(h2 ^ (h2 >>> 13), 0x5bd1e995) >>> 0; };
  mixIn(l.size1); mixIn(l.size3); for (const a of [l.min1, l.max1, l.min3, l.max3]) for (const v of a) mixIn(Math.round(v * 65535));
  for (const d of [l.data1, l.data3]) if (d) for (let i = 0; i < d.length; i++) mixIn(Math.round(d[i] * 65535) + 0x8000);
  return 'lut_' + h1.toString(36).padStart(7, '0') + h2.toString(36).padStart(7, '0');
}
function identityLut(N = 33) {
  const d = new Float32Array(N * N * N * 3); let i = 0;
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) { d[i++] = r / (N - 1); d[i++] = g / (N - 1); d[i++] = b / (N - 1); }
  return d;
}
function serializeCube(data3, N, title = 'Motif grade') {
  if (!data3 || data3.length !== N * N * N * 3) throw new LutError('count', 'Export table has the wrong size.');
  const out = [`TITLE "${String(title).replace(/"/g, '').slice(0, 80)}"`, '# Created by Motif 7 — node grade baked to a 3D LUT (input and output 0–1, display-referred)', `LUT_3D_SIZE ${N}`, 'DOMAIN_MIN 0.0 0.0 0.0', 'DOMAIN_MAX 1.0 1.0 1.0'];
  const f = v => (Math.abs(v) < 5e-7 ? 0 : v).toFixed(6);
  for (let i = 0; i < N * N * N; i++) out.push(`${f(data3[i * 3])} ${f(data3[i * 3 + 1])} ${f(data3[i * 3 + 2])}`);
  return out.join('\n') + '\n';
}
// CPU reference sampler (tests, and the page's LUT preview swatch). Tetrahedral, domain-aware, shaper first.
function sampleLut(l, rgb) {
  let c = rgb.slice();
  if (l.data1) { const N = l.size1; for (let k = 0; k < 3; k++) { const x = clamp((c[k] - l.min1[k]) / (l.max1[k] - l.min1[k]), 0, 1) * (N - 1); const i = Math.min(N - 2, Math.floor(x)), f = x - i; c[k] = l.data1[i * 3 + k] * (1 - f) + l.data1[(i + 1) * 3 + k] * f; } }
  if (l.data3) {
    const N = l.size3, p = [0, 1, 2].map(k => clamp((c[k] - l.min3[k]) / (l.max3[k] - l.min3[k]), 0, 1) * (N - 1));
    const b = p.map(v => Math.min(N - 2, Math.floor(v))), f = p.map((v, k) => v - b[k]);
    const at = (dr, dg, db) => { const i = (((b[2] + db) * N + (b[1] + dg)) * N + (b[0] + dr)) * 3; return [l.data3[i], l.data3[i + 1], l.data3[i + 2]]; };
    // order the fractional parts; walk the tetrahedron from c000 to c111
    const ax = [0, 1, 2].sort((x, y) => f[y] - f[x]); let cur = [0, 0, 0], prev = at(0, 0, 0); const out = prev.slice();
    for (const k of ax) { cur[k] = 1; const nx = at(cur[0], cur[1], cur[2]); for (let j = 0; j < 3; j++) out[j] += f[k] * (nx[j] - prev[j]); prev = nx; }
    c = out;
  }
  return c;
}
// Registry: LUT tables by content id. The page persists bytes; render contexts only read from here.
const registry = new Map();
function registerLut(l) { if (!l || !LUT_ID_RE.test(l.id)) throw new LutError('format', 'Invalid LUT.'); registry.set(l.id, l); return l.id; }
const getLut = id => registry.get(id) || null;
const listLuts = () => [...registry.values()].map(l => ({ id: l.id, name: l.name, size1: l.size1, size3: l.size3 }));

// ---------- GLSL ----------
const LIB = `
precision highp sampler3D;
const vec3 GW = vec3(0.2126, 0.7152, 0.0722);
vec3 gRot(vec3 c, float deg){ if (deg == 0.0) return c; float a = radians(deg), s = sin(a), co = cos(a); const vec3 k = vec3(0.57735027); return c * co + cross(k, c) * s + k * dot(k, c) * (1.0 - co); }
vec3 gHsv(vec3 c){ vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (max(q.x, 0.0) + 1e-10), q.x); }
vec3 gPrimary(vec3 c, vec4 lift, vec4 gam, vec4 gain, vec4 off, vec4 cps){
  vec3 lf = lift.rgb + lift.a, gm = gam.rgb + gam.a, gn = gain.a * (1.0 + gain.rgb), of = off.rgb + off.a;
  c = c * gn + lf * (1.0 - c);
  c = sign(c) * pow(abs(c), exp2(-gm));
  c += of;
  c = (c - cps.y) * cps.x + cps.y;
  float y = dot(c, GW); c = y + gRot(c - y, cps.w) * cps.z; return c; }
float gCurve(float x, float y0, float y1, float y2, float y3, float y4){
  float d0 = y1 - y0, d1 = y2 - y1, d2 = y3 - y2, d3 = y4 - y3;
  float m0 = d0, m4 = d3, m1 = d0 * d1 <= 0.0 ? 0.0 : 0.5 * (d0 + d1), m2 = d1 * d2 <= 0.0 ? 0.0 : 0.5 * (d1 + d2), m3 = d2 * d3 <= 0.0 ? 0.0 : 0.5 * (d2 + d3);
  float t = x * 4.0; if (t <= 0.0) return y0 + m0 * t; if (t >= 4.0) return y4 + m4 * (t - 4.0);
  float i = min(floor(t), 3.0), f = t - i, ya, yb, ma, mb;
  if (i < 0.5) { ya = y0; yb = y1; ma = m0; mb = m1; } else if (i < 1.5) { ya = y1; yb = y2; ma = m1; mb = m2; } else if (i < 2.5) { ya = y2; yb = y3; ma = m2; mb = m3; } else { ya = y3; yb = y4; ma = m3; mb = m4; }
  float f2 = f * f, f3 = f2 * f; return (2.0 * f3 - 3.0 * f2 + 1.0) * ya + (f3 - 2.0 * f2 + f) * ma + (3.0 * f2 - 2.0 * f3) * yb + (f3 - f2) * mb; }
float gCyc(float h, float v0, float v1, float v2, float v3, float v4, float v5){
  float v[6] = float[6](v0, v1, v2, v3, v4, v5); float t = fract(h) * 6.0; int i = int(floor(t)) % 6; float f = smoothstep(0.0, 1.0, t - floor(t)); return mix(v[i], v[(i + 1) % 6], f); }
vec3 gHueSat(vec3 c, float s0, float s1, float s2, float s3, float s4, float s5, float h0, float h1, float h2, float h3, float h4, float h5){
  vec3 h = gHsv(c); float s = gCyc(h.x, s0, s1, s2, s3, s4, s5), dh = gCyc(h.x, h0, h1, h2, h3, h4, h5);
  float y = dot(c, GW); return y + gRot(c - y, dh) * s; }
float gKey(vec3 c, vec4 a, vec4 b){
  vec3 h = gHsv(c); float soft = b.z + 1e-4; float dh = abs(fract(h.x - a.x / 360.0 + 0.5) - 0.5), hw = a.y / 720.0;
  float kh = a.y >= 359.5 ? 1.0 : 1.0 - smoothstep(hw, hw + soft * 0.5, dh);
  float ks = smoothstep(a.z - soft, a.z, h.y) * (1.0 - smoothstep(a.w, a.w + soft, h.y));
  float l = dot(c, GW); float kl = smoothstep(b.x - soft, b.x, l) * (1.0 - smoothstep(b.y, b.y + soft, l));
  float k = clamp(kh * ks * kl, 0.0, 1.0); return b.w > 0.5 ? 1.0 - k : k; }
vec3 gQualCorr(vec3 c, vec4 q){ float y = dot(c, GW); c = y + gRot(c - y, q.x) * q.y; return c * q.z + q.w; }
vec3 gBlend(vec3 b, vec3 t, float m){
  if (m < 0.5) return t; if (m < 1.5) return b + t; if (m < 2.5) return b * t; if (m < 3.5) return 1.0 - (1.0 - b) * (1.0 - t);
  if (m < 4.5) return mix(2.0 * b * t, 1.0 - 2.0 * (1.0 - b) * (1.0 - t), step(0.5, b));
  if (m < 5.5) return mix(2.0 * b * t + b * b * (1.0 - 2.0 * t), sqrt(max(b, 0.0)) * (2.0 * t - 1.0) + 2.0 * b * (1.0 - t), step(0.5, t));
  if (m < 6.5) return abs(b - t); if (m < 7.5) return min(b, t); if (m < 8.5) return max(b, t);
  return b + (dot(t, GW) - dot(b, GW)); }
vec3 gLut1(sampler2D S, vec3 c, vec3 lo, vec3 hi, float N){ vec3 x = (clamp((c - lo) / (hi - lo), 0.0, 1.0) * (N - 1.0) + 0.5) / N;
  return vec3(texture(S, vec2(x.r, 0.5)).r, texture(S, vec2(x.g, 0.5)).g, texture(S, vec2(x.b, 0.5)).b); }
vec3 gLut3(sampler3D L, vec3 c, vec3 lo, vec3 hi, float N, float tetra){
  vec3 x = clamp((c - lo) / (hi - lo), 0.0, 1.0);
  if (tetra < 0.5) return texture(L, (x * (N - 1.0) + 0.5) / N).rgb;
  vec3 p = x * (N - 1.0), b0 = min(floor(p), vec3(N - 2.0)), f = p - b0; ivec3 i = ivec3(b0);
  vec3 c0 = texelFetch(L, i, 0).rgb, c7 = texelFetch(L, i + ivec3(1), 0).rgb, ca, cb; vec3 r;
  if (f.r > f.g) {
    if (f.g > f.b) { ca = texelFetch(L, i + ivec3(1, 0, 0), 0).rgb; cb = texelFetch(L, i + ivec3(1, 1, 0), 0).rgb; r = c0 + f.r * (ca - c0) + f.g * (cb - ca) + f.b * (c7 - cb); }
    else if (f.r > f.b) { ca = texelFetch(L, i + ivec3(1, 0, 0), 0).rgb; cb = texelFetch(L, i + ivec3(1, 0, 1), 0).rgb; r = c0 + f.r * (ca - c0) + f.b * (cb - ca) + f.g * (c7 - cb); }
    else { ca = texelFetch(L, i + ivec3(0, 0, 1), 0).rgb; cb = texelFetch(L, i + ivec3(1, 0, 1), 0).rgb; r = c0 + f.b * (ca - c0) + f.r * (cb - ca) + f.g * (c7 - cb); }
  } else {
    if (f.b > f.g) { ca = texelFetch(L, i + ivec3(0, 0, 1), 0).rgb; cb = texelFetch(L, i + ivec3(0, 1, 1), 0).rgb; r = c0 + f.b * (ca - c0) + f.g * (cb - ca) + f.r * (c7 - cb); }
    else if (f.b > f.r) { ca = texelFetch(L, i + ivec3(0, 1, 0), 0).rgb; cb = texelFetch(L, i + ivec3(0, 1, 1), 0).rgb; r = c0 + f.g * (ca - c0) + f.b * (cb - ca) + f.r * (c7 - cb); }
    else { ca = texelFetch(L, i + ivec3(0, 1, 0), 0).rgb; cb = texelFetch(L, i + ivec3(1, 1, 0), 0).rgb; r = c0 + f.g * (ca - c0) + f.r * (cb - ca) + f.b * (c7 - cb); }
  }
  return r; }
`;
const PACK_KEYS = {}; // numeric pack order per type: every schema key; selects as option index, toggles as 0/1
for (const [t, d] of Object.entries(TYPES)) PACK_KEYS[t] = Object.keys(d.schema);
const LUT_EXTRA = 16; // lut node: has1, has3, N1, N3, lo1.xyz, hi1.xyz, lo3.xyz, hi3.xyz (16 floats after its params)

// Plan the program: topology signature, uniform layout and texture slots. mode: 'main' | 'key' | 'lattice'.
function plan(g, mode = 'main', stopAt = -1) {
  const nodes = g.nodes; const blocks = []; let vec = 0; let keys = 0, luts = 0; const sig = [mode, stopAt];
  nodes.forEach((n, i) => {
    if (stopAt >= 0 && i > stopAt) return;
    const nf = PACK_KEYS[n.type].length + (n.type === 'lut' ? LUT_EXTRA : 0);
    const b = { n, i, base: vec * 4, floats: nf }; vec += Math.ceil(nf / 4);
    if (n.type === 'qualifier' && mode === 'main' && n.params.blur > 0.001 && keys < MAX_BLUR_KEYS) b.key = keys++;
    if (n.type === 'lut') { const l = n.lut && getLut(n.lut.id); if (l) { b.lut = l; b.slot = luts++; } }
    if (n.type === 'mixer') b.src = n.src === 'in' ? -1 : nodes.findIndex(m => m.id === n.src);
    blocks.push(b);
    sig.push(`${n.type}${n.par ? 'p' : ''}${b.key != null ? 'k' + b.key : ''}${b.lut ? 'L' + (b.lut.data1 ? 1 : 0) + (b.lut.data3 ? 3 : 0) : ''}${b.src != null ? 's' + b.src : ''}`);
  });
  return { blocks, vec: Math.max(1, vec), keys, luts, sig: sig.join('|') };
}
function codegen(pl, stopKey) {
  const f = (b, k) => { const idx = b.base + (typeof k === 'number' ? k : PACK_KEYS[b.n.type].indexOf(k)); return `GP[${idx >> 2}].${'xyzw'[idx & 3]}`; };
  const v4 = (b, ks) => `vec4(${ks.map(k => f(b, k)).join(', ')})`;
  let decl = `${LIB}\nuniform vec4 GP[${pl.vec}];\n`;
  for (let k = 0; k < pl.keys; k++) decl += `uniform sampler2D GK${k};\n`;
  for (const b of pl.blocks) if (b.lut) { if (b.lut.data1) decl += `uniform sampler2D GS${b.slot};\n`; if (b.lut.data3) decl += `uniform sampler3D GL${b.slot};\n`; }
  let body = 'vec3 gradeAll(vec3 c0, vec2 uv){\n  vec3 cur = c0, gin = c0, gsum = c0; float gn = 1.0;\n';
  for (const b of pl.blocks) body += `  vec3 n${b.i} = c0;\n`;
  const flush = () => '  if (gn > 0.5) cur = gsum / gn;\n';
  pl.blocks.forEach((b, j) => {
    const n = b.n, par = n.par && j > 0;
    if (!par) body += flush() + '  gin = cur; gsum = vec3(0.0); gn = 0.0;\n';
    const x = 'gin', w = `(${f(b, 'on')} * ${f(b, 'mix')})`; let y;
    body += `  { // node ${b.i + 1} ${n.type}\n`;
    if (n.type === 'primary') y = `gPrimary(${x}, ${v4(b, ['liftR', 'liftG', 'liftB', 'liftY'])}, ${v4(b, ['gammaR', 'gammaG', 'gammaB', 'gammaY'])}, ${v4(b, ['gainR', 'gainG', 'gainB', 'gainY'])}, ${v4(b, ['offR', 'offG', 'offB', 'offY'])}, ${v4(b, ['contrast', 'pivot', 'sat', 'hue'])})`;
    else if (n.type === 'curves') {
      const cv = (ch, e) => `gCurve(${e}, ${[0, 1, 2, 3, 4].map(i => f(b, ch + i)).join(', ')})`;
      body += `    vec3 t = vec3(${cv('y', x + '.r')}, ${cv('y', x + '.g')}, ${cv('y', x + '.b')});\n`;
      y = `vec3(${cv('r', 't.r')}, ${cv('g', 't.g')}, ${cv('b', 't.b')})`;
    } else if (n.type === 'huesat') y = `gHueSat(${x}, ${[0, 1, 2, 3, 4, 5].map(i => f(b, 's' + i)).join(', ')}, ${[0, 1, 2, 3, 4, 5].map(i => f(b, 'h' + i)).join(', ')})`;
    else if (n.type === 'qualifier') {
      const kexpr = b.key != null ? `texture(GK${b.key}, uv).r` : `gKey(${x}, ${v4(b, ['hue', 'width', 'satLo', 'satHi'])}, ${v4(b, ['lumLo', 'lumHi', 'soft', 'invert'])})`;
      if (stopKey === b.i) { body += `    return vec3(gKey(${x}, ${v4(b, ['hue', 'width', 'satLo', 'satHi'])}, ${v4(b, ['lumLo', 'lumHi', 'soft', 'invert'])}));\n  }\n}\n`; return; }
      body += `    float k = ${kexpr};\n`; y = `gQualCorr(${x}, ${v4(b, ['qHue', 'qSat', 'qGain', 'qOff'])})`;
      body += `    n${b.i} = mix(${x}, ${y}, clamp(${w} * k, 0.0, 1.0));\n  }\n  gsum += n${b.i}; gn += 1.0;\n`; return;
    } else if (n.type === 'lut') {
      if (!b.lut) y = x; // missing table: pass-through (the page shows the missing state)
      else {
        const e = PACK_KEYS.lut.length, F = k => f(b, e + k), V3 = k => `vec3(${F(k)}, ${F(k + 1)}, ${F(k + 2)})`;
        body += `    vec3 t = ${x};\n`;
        if (b.lut.data1) body += `    t = gLut1(GS${b.slot}, t, ${V3(4)}, ${V3(7)}, ${F(2)});\n`;
        if (b.lut.data3) body += `    t = gLut3(GL${b.slot}, t, ${V3(10)}, ${V3(13)}, ${F(3)}, ${f(b, 'interp')} < 0.5 ? 1.0 : 0.0);\n`;
        y = 't';
      }
    } else if (n.type === 'mixer') {
      const base = b.src < 0 ? 'c0' : `n${b.src}`;
      body += `    n${b.i} = mix(${base}, gBlend(${base}, ${x}, ${f(b, 'blend')}), clamp(${w}, 0.0, 1.0));\n  }\n  gsum += n${b.i}; gn += 1.0;\n`; return;
    }
    body += `    n${b.i} = mix(${x}, ${y}, clamp(${w}, 0.0, 1.0));\n  }\n  gsum += n${b.i}; gn += 1.0;\n`;
  });
  if (stopKey == null || stopKey < 0) body += flush() + '  return cur;\n}\n';
  return decl + body;
}
// Uniform values in plan order (selects → option index, toggles → 0/1, LUT meta appended).
function pack(pl) {
  const a = new Float32Array(pl.vec * 4);
  for (const b of pl.blocks) {
    const sc = schemaFor(b.n.type);
    PACK_KEYS[b.n.type].forEach((k, j) => { const s = sc[k], v = b.n.params[k]; a[b.base + j] = s.type === 'select' ? Math.max(0, s.options.findIndex(o => o.v === v)) : s.type === 'toggle' ? (v ? 1 : 0) : Number(v) || 0; });
    if (b.n.type === 'lut' && b.lut) {
      const e = b.base + PACK_KEYS.lut.length, l = b.lut;
      a.set([l.data1 ? 1 : 0, l.data3 ? 1 : 0, l.size1, l.size3, ...l.min1, ...l.max1, ...l.min3, ...l.max3], e);
    }
  }
  return a;
}
const FS_LATTICE = `#version 300 es
precision highp float; out vec4 o; uniform float N, black, white, gam, gmap; uniform vec3 s0, s1, s2;
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
/*GRADE_DECL*/
void main(){ ivec2 q = ivec2(gl_FragCoord.xy); int n = int(N); vec3 c = vec3(float(q.x % n), float(q.x / n), float(q.y)) / (N - 1.0); vec2 p = vec2(0.5);
  c = clamp((c - black) / max(0.001, white - black), 0.0, 1.0); c = pow(c, vec3(1.0 / gam));
  if (gmap > 0.0) { float l = luma(c); vec3 m = l < 0.5 ? mix(s0, s1, l * 2.0) : mix(s1, s2, (l - 0.5) * 2.0); c = mix(c, m, gmap); }
  /*GRADE_CALL*/
  o = vec4(c, 1.0); }`;

// GPU side, owned by the finisher (same WebGL2 context). env: { gl, mk(fs), draw(prog, target, uniforms, textures), mkTex(w,h,float), blur2(srcT,a,b,r), FS_FINAL, size() }.
function createGrader(env) {
  const { gl } = env; const progs = new Map(); const lutTex = new Map(); let keyTex = []; let keySize = '';
  const floatRT = !!gl.getExtension('EXT_color_buffer_float');
  let lastError = null;
  function program(key, build) {
    let p = progs.get(key); if (p !== undefined) return p;
    try { p = env.mk(build()); lastError = null; } catch (e) { console.error('grade:', e); lastError = String(e.message || e); p = null; }
    progs.set(key, p); if (progs.size > 24) { const k0 = progs.keys().next().value; const old = progs.get(k0); if (old) gl.deleteProgram(old.p); progs.delete(k0); }
    return p;
  }
  const inject = (src, decl, call) => src.replace('/*GRADE_DECL*/', decl).replace('/*GRADE_CALL*/', call);
  function texFor(l) {
    let t = lutTex.get(l.id); if (t) return t; t = {};
    // typed-array uploads to 3D textures must not flip or premultiply (the finisher leaves premultiply on)
    const pm = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL), fy = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (l.data3) {
      const N = l.size3; t.t3 = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, t.t3);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, N, N, N, 0, gl.RGB, gl.FLOAT, l.data3);
      for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_3D, p, v);
    }
    if (l.data1) {
      t.t1 = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t.t1); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB16F, l.size1, 1, 0, gl.RGB, gl.FLOAT, l.data1);
      for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, pm); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, fy);
    lutTex.set(l.id, t);
    if (lutTex.size > 8) { const k0 = lutTex.keys().next().value; const o = lutTex.get(k0); if (o.t3) gl.deleteTexture(o.t3); if (o.t1) gl.deleteTexture(o.t1); lutTex.delete(k0); }
    return t;
  }
  function lutTextures(pl) {
    const out = {};
    for (const b of pl.blocks) if (b.lut) { const t = texFor(b.lut); if (t.t1) out['GS' + b.slot] = t.t1; if (t.t3) out['GL' + b.slot] = { t3: t.t3 }; }
    return out;
  }
  function keys(n) {
    const [W, H] = env.size(), w = Math.max(1, W >> 2), h = Math.max(1, H >> 2), sz = `${w}x${h}`;
    if (sz !== keySize) { for (const k of keyTex) { gl.deleteTexture(k.a.t); gl.deleteFramebuffer(k.a.f); gl.deleteTexture(k.b.t); gl.deleteFramebuffer(k.b.f); } keyTex = []; keySize = sz; }
    while (keyTex.length < n) keyTex.push({ a: env.mkTex(w, h, true), b: env.mkTex(w, h, true) });
    return keyTex;
  }
  // Final pass with the grade injected. uni/txs: the finisher's FS_FINAL uniforms and textures.
  function final(g, uni, txs) {
    const pl = plan(g, 'main');
    const prog = program('main|' + pl.sig, () => inject(env.FS_FINAL, codegen(pl), 'c = gradeAll(c, p);'));
    if (!prog) return false;
    const GP = pack(pl); const extra = { ...txs, ...lutTextures(pl) };
    if (pl.keys) {
      const kt = keys(pl.keys);
      for (const b of pl.blocks) if (b.key != null) {
        const kp = plan(g, 'key', b.i);
        const kprog = program('key|' + kp.sig, () => inject(env.FS_FINAL, codegen(kp, b.i), 'c = gradeAll(c, p); o = vec4(c, 1.0); return;'));
        if (!kprog) return false;
        const kk = kt[b.key]; env.draw(kprog, kk.a, { ...uni, 'GP[0]': pack(kp) }, { ...txs, ...lutTextures(kp) });
        const r = 0.6 + b.n.params.blur * 5.4; env.blur2(kk.a.t, kk.b, kk.a, r); env.blur2(kk.a.t, kk.b, kk.a, r * 1.6);
        extra['GK' + b.key] = kk.a.t;
      }
    }
    env.draw(prog, null, { ...uni, 'GP[0]': GP }, extra);
    return true;
  }
  // Bake levels + gradient map + grade into an N³ table (red fastest). f: evaluated finish (with .grade); x: { stops }.
  function lattice(f, x, N = 33) {
    const g = f.grade && active(f.grade) ? f.grade : null;
    const pl = g ? plan(g, 'lattice') : null;
    const prog = program('lat|' + (pl ? pl.sig : 'none'), () => inject(FS_LATTICE, pl ? codegen(pl) : '', pl ? 'c = gradeAll(c, p);' : ''));
    if (!prog) throw new Error(lastError || 'The grade shader failed to compile.');
    const W = N * N, H = N;
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, floatRT ? gl.RGBA32F : gl.RGBA8, W, H, 0, gl.RGBA, floatRT ? gl.FLOAT : gl.UNSIGNED_BYTE, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const tgt = { f: fb, w: W, h: H };
    env.draw(prog, tgt, { N, black: f.black, white: f.white, gam: f.gamma, gmap: f.gmap, s0: x.stops[0], s1: x.stops[1], s2: x.stops[2], ...(pl ? { 'GP[0]': pack(pl) } : {}) }, pl ? lutTextures(pl) : {});
    const px = floatRT ? new Float32Array(W * H * 4) : new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, floatRT ? gl.FLOAT : gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(t);
    const out = new Float32Array(N * N * N * 3), sc = floatRT ? 1 : 1 / 255;
    for (let i = 0; i < N * N * N; i++) { out[i * 3] = px[i * 4] * sc; out[i * 3 + 1] = px[i * 4 + 1] * sc; out[i * 3 + 2] = px[i * 4 + 2] * sc; }
    return { data: out, precision: floatRT ? 'float32' : '8-bit' };
  }
  return { active, final, lattice, get error() { return lastError; }, get programs() { return progs.size; } };
}

return { VERSION, MAX_NODES, MAX_LUT_NODES, MAX_BLUR_KEYS, TYPES, TYPE_IDS, BLENDS, HUES, schemaFor, newGrade, newNode, sanitizeGrade, nodeById, schemaAt, active, evalCopy, nodeLabel, paths,
  LutError, parseCube, parse3dl, parseHald, parseLut, serializeCube, identityLut, sampleLut, lutId, registerLut, getLut, listLuts, plan, codegen, pack, createGrader, FS_LATTICE };

})();

