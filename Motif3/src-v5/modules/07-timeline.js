// ---- module: timeline v1.0.0
const __m_timeline = (() => {
// timeline — the v2 project model: layers, composite settings, finish block, output settings,
// one path grammar for every value, cyclic keyframes, audio modulation and project-level
// mutate / randomize. Pure: no DOM.
// Paths:  L:<layerId>:p:<key> (style)  L:<layerId>:s:<key> (layer shared)  L:<layerId>:c:<key> (composite)  F:<key> (finish)
//         G:<nodeId>:<key> (node grade, 11a-grade; optional `grade` block, absent in v3–v5 projects)
const { P, defaults, sanitize, mutate, randomize, ease, clamp, lerp, fract } = __m_engine_core;
const { SHARED_SCHEMA, getStyle, defaultLook, sanitizeLook, mulberry32 } = __m_style_library;

const FORMAT = 'motif-style-lab/preset@2';
const MAX_LAYERS = 4;
const BLENDS = [
  { v: 'source-over', l: 'Normal' }, { v: 'multiply', l: 'Multiply' }, { v: 'screen', l: 'Screen' }, { v: 'overlay', l: 'Overlay' },
  { v: 'lighter', l: 'Add' }, { v: 'darken', l: 'Darken' }, { v: 'lighten', l: 'Lighten' }, { v: 'difference', l: 'Difference' },
  { v: 'exclusion', l: 'Exclusion' }, { v: 'soft-light', l: 'Soft light' }, { v: 'color-dodge', l: 'Colour dodge' },
];
const COMP_SCHEMA = {
  opacity: P.range('Opacity', 0, 1, 1, 0.01, { group: 'comp', mutate: 0 }),
  blend: P.select('Blend', BLENDS, 'source-over', { group: 'comp', mutate: 0 }),
  fill: P.toggle('Fill background', false, { group: 'comp', mutate: 0 }),
  mask: P.select('Mask', [{ v: 'none', l: 'None' }, { v: 'circle', l: 'Circle' }, { v: 'rect', l: 'Rectangle' }, { v: 'band', l: 'Band' }, { v: 'gradient', l: 'Linear gradient' }, { v: 'matte-alpha', l: 'Track matte · alpha' }, { v: 'matte-luma', l: 'Track matte · luma' }], 'none', { group: 'mask', mutate: 0 }),
  maskSize: P.range('Mask size', 0, 1.5, 0.6, 0.01, { group: 'mask', mutate: 0 }),
  maskFeather: P.range('Feather', 0, 1, 0.2, 0.01, { group: 'mask', mutate: 0 }),
  maskX: P.range('Mask X', -0.5, 0.5, 0, 0.01, { group: 'mask', mutate: 0 }),
  maskY: P.range('Mask Y', -0.5, 0.5, 0, 0.01, { group: 'mask', mutate: 0 }),
  maskAngle: P.range('Mask angle', -180, 180, 0, 1, { group: 'mask', unit: '°', mutate: 0 }),
  maskInvert: P.toggle('Invert mask', false, { group: 'mask', mutate: 0 }),
};
const FINISH_SCHEMA = {
  loop: P.range('Loop length', 1, 32, 6, 0.05, { group: 'time', unit: 's', mutate: 0 }),
  shutter: P.range('Shutter angle', 0, 360, 0, 1, { group: 'blur', unit: '°', mutate: 0 }),
  samples: P.int('Samples', 2, 32, 8, { group: 'blur', mutate: 0 }),
  glow: P.range('Glow', 0, 1, 0, 0.01, { group: 'glow', mutate: 0.3 }),
  glowThreshold: P.range('Threshold', 0, 1, 0.6, 0.01, { group: 'glow', mutate: 0.3 }),
  glowRadius: P.range('Radius', 0.05, 1, 0.4, 0.01, { group: 'glow', mutate: 0.3 }),
  chroma: P.range('Chromatic offset', 0, 1, 0, 0.01, { group: 'lens', mutate: 0.3 }),
  depth: P.range('Depth blur', 0, 1, 0, 0.01, { group: 'lens', mutate: 0.2 }),
  depthMode: P.select('Depth from', [{ v: 'tilt', l: 'Tilt (vertical)' }, { v: 'radial', l: 'Radial' }, { v: 'luma', l: 'Brightness' }], 'tilt', { group: 'lens', mutate: 0 }),
  focus: P.range('Focus', 0, 1, 0.5, 0.01, { group: 'lens', mutate: 0.2 }),
  black: P.range('Black point', 0, 0.5, 0, 0.01, { group: 'grade', mutate: 0.2 }),
  white: P.range('White point', 0.5, 1, 1, 0.01, { group: 'grade', mutate: 0.2 }),
  gamma: P.range('Gamma', 0.3, 3, 1, 0.01, { group: 'grade', mutate: 0.2 }),
  gmap: P.range('Gradient map', 0, 1, 0, 0.01, { group: 'grade', mutate: 0 }),
  gmapMode: P.select('Map colours', [{ v: 'palette', l: 'Palette' }, { v: 'duotone', l: 'Duotone' }, { v: 'ink', l: 'Ink' }], 'palette', { group: 'grade', mutate: 0 }),
  grain: P.range('Grain', 0, 1, 0.12, 0.01, { group: 'texture', mutate: 0.5 }),
  vignette: P.range('Vignette', 0, 1, 0.15, 0.01, { group: 'texture', mutate: 0.5 }),
};
const OUTPUT_DEFAULT = { space: 'srgb', broadcastSafe: false, fps: 30 };
const BANDS = [
  { id: 'sub', l: 'Sub · 20–60 Hz' }, { id: 'bass', l: 'Bass · 60–250 Hz' }, { id: 'lowmid', l: 'Low-mid · 250–500 Hz' }, { id: 'mid', l: 'Mid · 0.5–2 kHz' },
  { id: 'highmid', l: 'High-mid · 2–6 kHz' }, { id: 'high', l: 'High · 6–16 kHz' }, { id: 'level', l: 'Level (RMS)' }, { id: 'onset', l: 'Onsets (kick/snare)' },
];
const EASES = [{ v: 'linear', l: 'Linear' }, { v: 'smooth', l: 'Smooth' }, { v: 'in', l: 'Ease in' }, { v: 'out', l: 'Ease out' }, { v: 'hold', l: 'Hold' }];
const easeFn = { linear: ease.linear, smooth: ease.inOutCubic, in: ease.inCubic, out: ease.outCubic, hold: () => 0 };

let lid = 0;
const newLayerId = () => `l${Date.now().toString(36).slice(-4)}${(lid++).toString(36)}`;
const clone = o => JSON.parse(JSON.stringify(o));
const GR = () => (typeof __m_grade !== 'undefined' ? __m_grade : null); // resolved at call time (module loads later)

// ---------- construction ----------
function newLayer(styleId, shared, comp) {
  const look = defaultLook(styleId, shared);
  return { id: newLayerId(), styleId: look.styleId, params: look.params, shared: look.shared, comp: sanitize(comp || {}, COMP_SCHEMA), visible: true };
}
function newProject(styleId = 'particle-form') {
  const l = newLayer(styleId);
  return { format: FORMAT, layers: [l], active: l.id, finish: defaults(FINISH_SCHEMA), palettes: [], keys: {}, audio: null, output: { ...OUTPUT_DEFAULT } };
}
// Media attached to a kit style's inputs: { <inputId>: { asset, name, kind, w, h, dur, fit, timing } }.
function sanitizeMedia(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const out = {};
  for (const [k, v] of Object.entries(m).slice(0, 4)) {
    if (!/^[a-z][a-zA-Z0-9]{0,15}$/.test(k) || !v || typeof v !== 'object' || !/^m_[a-z0-9]{6,40}$/.test(String(v.asset || ''))) continue;
    out[k] = { asset: v.asset, name: String(v.name || '').slice(0, 80), kind: v.kind === 'video' ? 'video' : 'image', w: Math.max(0, Math.round(Number(v.w) || 0)), h: Math.max(0, Math.round(Number(v.h) || 0)), dur: Math.max(0, Number(v.dur) || 0),
      fit: ['fill', 'fit', 'stretch'].includes(v.fit) ? v.fit : 'fill', timing: v.timing === 'free' ? 'free' : 'loop' };
  }
  return Object.keys(out).length ? out : null;
}
function sanitizeLayer(l) {
  const look = sanitizeLook(l);
  const out = { id: typeof l.id === 'string' && l.id ? l.id.slice(0, 24) : newLayerId(), styleId: look.styleId, params: look.params, shared: look.shared, comp: sanitize(l.comp, COMP_SCHEMA), visible: l.visible !== false };
  const media = sanitizeMedia(l.media); if (media) out.media = media;
  return out;
}
function sanitizeProject(pr, sanitizeCustom) {
  const layers = (Array.isArray(pr && pr.layers) ? pr.layers : []).slice(0, MAX_LAYERS).map(sanitizeLayer);
  if (!layers.length) layers.push(newLayer('particle-form'));
  const ids = new Set(); layers.forEach(l => { while (ids.has(l.id)) l.id = newLayerId(); ids.add(l.id); });
  const out = {
    format: FORMAT, layers, active: layers.some(l => l.id === pr.active) ? pr.active : layers[0].id,
    finish: sanitize(pr.finish, FINISH_SCHEMA),
    palettes: (Array.isArray(pr.palettes) ? pr.palettes : []).map(p => (sanitizeCustom ? sanitizeCustom(p) : p)).filter(Boolean).slice(0, 24),
    keys: {}, audio: null, output: { ...OUTPUT_DEFAULT, ...(pr.output || {}) },
  };
  if (pr.grade && GR()) { const g = GR().sanitizeGrade(pr.grade); if (g) out.grade = g; }
  out.output.space = ['srgb', 'p3', 'rec709'].includes(out.output.space) ? out.output.space : 'srgb';
  out.output.broadcastSafe = !!out.output.broadcastSafe;
  out.output.fps = [24, 25, 30, 50, 60].includes(Number(out.output.fps)) ? Number(out.output.fps) : 30;
  for (const [path, ks] of Object.entries(pr.keys || {})) {
    const s = schemaAt(out, path); if (!s || !Array.isArray(ks) || !ks.length) continue;
    const clean = ks.map(k => ({ u: clamp(Number(k.u) || 0, 0, 0.99999), v: sanitizeValue(k.v, s), e: easeFn[k.e] ? k.e : 'smooth' })).sort((a, b) => a.u - b.u);
    out.keys[path] = dedupe(clean);
  }
  if (pr.audio && typeof pr.audio === 'object') {
    const a = pr.audio;
    out.audio = { bpm: clamp(Number(a.bpm) || 120, 40, 240), bars: [1, 2, 4, 8].includes(Number(a.bars)) ? Number(a.bars) : 4, offset: Math.max(0, Number(a.offset) || 0), snap: a.snap !== false, name: String(a.name || '').slice(0, 80),
      maps: (Array.isArray(a.maps) ? a.maps : []).filter(m => BANDS.some(b => b.id === m.band) && isNumericPath(out, m.path)).map(m => ({ id: String(m.id || Math.random().toString(36).slice(2, 8)), band: m.band, path: m.path, amount: clamp(Number(m.amount) || 0, -1, 1), smooth: clamp(Number(m.smooth) || 0, 0, 1) })).slice(0, 16) };
  }
  return out;
}
function dedupe(ks) { const out = []; for (const k of ks) { if (out.length && Math.abs(out[out.length - 1].u - k.u) < 1e-4) out[out.length - 1] = k; else out.push(k); } return out; }
function sanitizeValue(v, s) { return sanitize({ x: v }, { x: s }).x; }
// v1 preset → v2 project.
function fromV1(look, aspect) {
  const l = sanitizeLook(look); const pr = newProject(l.styleId);
  Object.assign(pr.layers[0], { params: l.params, shared: l.shared });
  const sh = look.shared || {};
  pr.finish = sanitize({ ...pr.finish, loop: sh.loop, grain: sh.grain, vignette: sh.vignette }, FINISH_SCHEMA);
  return { project: pr, aspect: aspect || '16x9' };
}

// ---------- paths ----------
function layerById(pr, id) { return pr.layers.find(l => l.id === id) || null; }
function parsePath(path) {
  const m = /^L:([^:]+):([psc]):(.+)$/.exec(path); if (m) return { kind: 'L', layer: m[1], scope: m[2], key: m[3] };
  const f = /^F:(.+)$/.exec(path); if (f) return { kind: 'F', key: f[1] };
  const g = /^G:([^:]+):(.+)$/.exec(path); if (g) return { kind: 'G', node: g[1], key: g[2] };
  return null;
}
function schemaAt(pr, path) {
  const p = parsePath(path); if (!p) return null;
  if (p.kind === 'F') return FINISH_SCHEMA[p.key] || null;
  if (p.kind === 'G') return GR() && pr.grade ? GR().schemaAt(pr.grade, p.node, p.key) : null;
  const l = layerById(pr, p.layer); if (!l) return null;
  const sc = p.scope === 'p' ? getStyle(l.styleId).params : p.scope === 's' ? SHARED_SCHEMA : COMP_SCHEMA;
  return sc[p.key] || null;
}
function isNumericPath(pr, path) { const s = schemaAt(pr, path); return !!s && (s.type === 'range' || s.type === 'int'); }
function bucket(obj, p) { return p.scope === 'p' ? obj.params : p.scope === 's' ? obj.shared : obj.comp; }
function getBase(pr, path) {
  const p = parsePath(path); if (!p) return undefined;
  if (p.kind === 'F') return pr.finish[p.key];
  if (p.kind === 'G') { const n = GR() && GR().nodeById(pr.grade, p.node); return n ? n.params[p.key] : undefined; }
  const l = layerById(pr, p.layer); return l ? bucket(l, p)[p.key] : undefined;
}
function setBase(pr, path, v) {
  const p = parsePath(path), s = schemaAt(pr, path); if (!p || !s) return pr;
  const next = clone(pr); v = sanitizeValue(v, s);
  if (p.kind === 'F') next.finish[p.key] = v; else if (p.kind === 'G') GR().nodeById(next.grade, p.node).params[p.key] = v; else bucket(layerById(next, p.layer), p)[p.key] = v;
  return next;
}
function pathLabel(pr, path) {
  const p = parsePath(path), s = schemaAt(pr, path); if (!p || !s) return path;
  if (p.kind === 'F') return s.label;
  if (p.kind === 'G') return `Grade ${pr.grade.nodes.findIndex(n => n.id === p.node) + 1} ${s.label}`;
  const idx = pr.layers.findIndex(l => l.id === p.layer);
  return `L${idx + 1} ${s.label}`;
}
// Every addressable path of a project (for audio targets and the lane).
function allPaths(pr, numericOnly) {
  const out = [];
  pr.layers.forEach((l, i) => {
    const push = (scope, schema) => { for (const [k, s] of Object.entries(schema)) if (!numericOnly || s.type === 'range' || s.type === 'int') out.push({ path: `L:${l.id}:${scope}:${k}`, label: `L${i + 1} ${s.label}`, group: `Layer ${i + 1} · ${getStyle(l.styleId).name}` }); };
    push('p', getStyle(l.styleId).params); push('s', SHARED_SCHEMA); push('c', COMP_SCHEMA);
  });
  for (const [k, s] of Object.entries(FINISH_SCHEMA)) if (k !== 'loop' && (!numericOnly || s.type === 'range' || s.type === 'int')) out.push({ path: `F:${k}`, label: s.label, group: 'Finish' });
  if (pr.grade && GR()) out.push(...GR().paths(pr.grade, numericOnly));
  return out;
}

// ---------- keys ----------
const U_EPS = 1 / 240;
function keyIndexAt(ks, u) { return (ks || []).findIndex(k => Math.min(Math.abs(k.u - u), 1 - Math.abs(k.u - u)) < U_EPS); }
function setKey(pr, path, u, v, e) {
  const s = schemaAt(pr, path); if (!s) return pr;
  const next = clone(pr); const ks = (next.keys[path] || []).slice();
  u = fract(u); v = sanitizeValue(v, s);
  const i = keyIndexAt(ks, u);
  if (i >= 0) ks[i] = { ...ks[i], v, e: e || ks[i].e }; else ks.push({ u, v, e: e || (s.type === 'range' || s.type === 'int' || s.dynamic ? 'smooth' : 'hold') });
  ks.sort((a, b) => a.u - b.u); next.keys[path] = ks; return next;
}
function removeKey(pr, path, idx) { const next = clone(pr); const ks = (next.keys[path] || []).slice(); ks.splice(idx, 1); if (ks.length) next.keys[path] = ks; else delete next.keys[path]; return next; }
function moveKey(pr, path, idx, u) {
  const next = clone(pr); const ks = next.keys[path]; if (!ks || !ks[idx]) return pr;
  const k = ks[idx]; k.u = clamp(fract(u), 0, 0.99999);
  ks.sort((a, b) => a.u - b.u); next.keys[path] = dedupe(ks); return { project: next, index: next.keys[path].indexOf(k) };
}
function clearKeys(pr, path) { const next = clone(pr); delete next.keys[path]; return next; }
// Cyclic interpolation. Returns { v, mix } where mix = { to, t } for palette cross-fades.
function valueAt(ks, u, s) {
  const n = ks.length; if (n === 1) return { v: ks[0].v };
  let i = -1; for (let j = 0; j < n; j++) if (ks[j].u <= u) i = j;
  if (i < 0) i = n - 1;
  const a = ks[i], b = ks[(i + 1) % n];
  let span = b.u - a.u; if (span <= 0) span += 1;
  let d = u - a.u; if (d < 0) d += 1;
  const x = clamp(d / span), e = a.e || 'smooth';
  if (e === 'hold') return { v: a.v };
  const y = easeFn[e](x);
  if (s.type === 'range') return { v: lerp(a.v, b.v, y) };
  if (s.type === 'int') return { v: Math.round(lerp(a.v, b.v, y)) };
  if (s.dynamic) return { v: a.v, mix: a.v !== b.v ? { to: b.v, t: y } : null }; // palette cross-fade
  return { v: a.v };
}

// ---------- evaluation ----------
// Resolve every keyed / audio-mapped value at time t (seconds, may exceed the loop).
// env(band, seconds, smooth) → 0..1 or null. Returns { layers:[look + comp + pmix], finish, u }.
function evaluate(pr, t, env) {
  const L = pr.finish.loop; const u = fract(t / L);
  const layers = pr.layers.map(l => ({ id: l.id, styleId: l.styleId, params: { ...l.params }, shared: { ...l.shared, loop: L }, comp: { ...l.comp }, visible: l.visible, pmix: null, media: l.media || null }));
  const finish = { ...pr.finish };
  const byId = new Map(layers.map(l => [l.id, l]));
  const grade = pr.grade && GR() ? GR().evalCopy(pr.grade) : null; if (grade) finish.grade = grade;
  const apply = (path, fn) => {
    const p = parsePath(path); if (!p) return;
    if (p.kind === 'F') { finish[p.key] = fn(finish[p.key], FINISH_SCHEMA[p.key]); return; }
    if (p.kind === 'G') { const n = grade && grade.nodes.find(x => x.id === p.node), s = n && GR().schemaFor(n.type)[p.key]; if (s) n.params[p.key] = fn(n.params[p.key], s); return; }
    const l = byId.get(p.layer); if (!l) return;
    const sc = p.scope === 'p' ? getStyle(l.styleId).params : p.scope === 's' ? SHARED_SCHEMA : COMP_SCHEMA;
    const b = bucket(l, p); if (!sc[p.key]) return; b[p.key] = fn(b[p.key], sc[p.key], l, p.key);
  };
  for (const [path, ks] of Object.entries(pr.keys)) {
    if (!ks.length) continue;
    apply(path, (cur, s, l, key) => { const r = valueAt(ks, u, s); if (r.mix && l && key === 'palette') l.pmix = r.mix; return r.v; });
  }
  if (env && pr.audio && pr.audio.maps.length) {
    const at = (pr.audio.offset || 0) + t;
    for (const m of pr.audio.maps) {
      const e = env(m.band, at, m.smooth); if (e == null) continue;
      apply(m.path, (cur, s) => { if (!s || (s.type !== 'range' && s.type !== 'int')) return cur; let v = cur + m.amount * (s.max - s.min) * e; v = clamp(v, s.min, s.max); return s.type === 'int' ? Math.round(v) : v; });
    }
  }
  return { layers, finish, u };
}

// ---------- project-level variation ----------
function lockedFor(pr, layer, locks) {
  // Keyed paths behave as locked for Mutate / Evolve / Randomize.
  const set = new Set();
  for (const key of Object.keys(pr.keys)) { const p = parsePath(key); if (p && p.layer === layer.id) set.add(p.key); }
  for (const k of locks || []) set.add(k);
  return set;
}
function mutateProject(pr, layerId, strength, locks, rng, includeColour) {
  const next = clone(pr); const l = layerById(next, layerId) || next.layers[0];
  const lk = lockedFor(pr, l, locks);
  const st = getStyle(l.styleId);
  const a = mutate(l.params, st.params, strength, lk, rng), b = mutate(l.shared, SHARED_SCHEMA, strength, lk, rng);
  l.params = a.values; l.shared = b.values; const changed = [...a.changed, ...b.changed];
  if (!lk.has('seed')) { l.shared.seed = 1 + Math.floor(rng() * 9998); changed.push('seed'); }
  return { project: next, changed };
}
function randomizeProject(pr, layerId, locks, rng) {
  const next = clone(pr); const l = layerById(next, layerId) || next.layers[0];
  const lk = lockedFor(pr, l, locks); const st = getStyle(l.styleId);
  const a = randomize(l.params, st.params, lk, rng); l.params = a.values;
  if (!lk.has('seed')) l.shared.seed = 1 + Math.floor(rng() * 9998);
  return { project: next, changed: a.changed };
}

return { FORMAT, MAX_LAYERS, BLENDS, COMP_SCHEMA, FINISH_SCHEMA, OUTPUT_DEFAULT, BANDS, EASES, newLayer, newProject, sanitizeProject, fromV1, layerById, parsePath, schemaAt, isNumericPath, getBase, setBase, pathLabel, allPaths, keyIndexAt, setKey, removeKey, moveKey, clearKeys, valueAt, evaluate, mutateProject, randomizeProject, lockedFor, clone, mulberry32 };

})();

