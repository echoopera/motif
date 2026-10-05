// node --test tests/v9/unit.test.mjs : MotifGraph engine contracts (no browser).
import test from 'node:test'; import assert from 'node:assert/strict';
import { loadGraph } from './engine-load.mjs';
const G = loadGraph(), X = (p = 0.3, A = 16 / 9) => ({ A, p, pal: { ink: [0, 0, 0], a0: [1, 0, 0], a1: [0, 1, 0], a2: [0, 0, 1], bg: [1, 1, 1] }, spec: [0.1, 0.9, 0.2, 0.7, 0.3, 0.5, 0.8, 0.4], luma: (u, v) => Math.min(1, Math.max(0, u * 0.7 + (1 - v) * 0.2)) });
const mk = (...specs) => { const g = G.newGraph('layer'); const used = new Set(['stage']); for (const [type, params, ref] of specs) { const n = G.newNode(type, used); used.add(n.id); Object.assign(n.params, params); if (ref) n.ref = ref; g.nodes.push(n); } return G.sanitizeGraph(g, 'layer'); };
const ev = g => G.evalCopy(g);

test('registry: unique stable ids, every schema key lives in its kind layout, slots fit the stride', () => {
  const ids = G.TYPE_IDS.map(k => G.TYPES[k].id); assert.equal(new Set(ids).size, ids.length);
  for (const k of G.TYPE_IDS) { const t = G.TYPES[k]; for (const key of Object.keys(t.schema)) assert.ok(key in G.SLOT[t.kind], `${k}.${key}`); }
  for (const kind of Object.keys(G.LAYOUT)) assert.ok(G.LAYOUT[kind].length <= G.STRIDE, kind);
  assert.equal(G.TYPES.plain.id, 10); assert.equal(G.TYPES.wave.id, 36); // ids are saved in projects: they must never move
});
test('sanitize is idempotent, keeps one stage and one cloner, caps nodes, cuts reference cycles', () => {
  const g = mk(['cloner'], ['cloner'], ['sphere'], ['plain', {}, 'nope']);
  assert.equal(g.nodes.filter(n => n.type === 'cloner').length, 1); assert.equal(g.nodes.filter(n => n.type === 'stage').length, 1); assert.equal(g.nodes[0].type, 'stage');
  assert.equal(g.nodes.find(n => n.type === 'plain').ref, '');
  assert.deepEqual(G.sanitizeGraph(g, 'layer'), g);
  const many = G.newGraph('layer'); for (let i = 0; i < 40; i++) many.nodes.push({ id: 'g' + i.toString(36), type: 'wave', on: true, params: {} });
  assert.ok(G.sanitizeGraph(many, 'layer').nodes.length <= G.MAX_NODES);
  const cyc = G.newGraph('layer'); cyc.nodes.push({ id: 'ga', type: 'sphere', ref: 'gb', params: {} }, { id: 'gb', type: 'box', ref: 'ga', params: {} }, { id: 'gc', type: 'noisef', ref: 'gb', params: {} }, { id: 'gd', type: 'index', ref: 'gc', params: {} });
  const c = G.sanitizeGraph(cyc, 'layer'); const depth = (n, d = 0) => { const r = n.ref && c.nodes.find(x => x.id === n.ref); return r && d < 10 ? 1 + depth(r, d + 1) : 0; };
  for (const n of c.nodes) assert.ok(depth(n) <= 2, `ref depth ${n.id}`);
});
test('unknown node types from a newer Motif survive a round trip and are never drawn', () => {
  const g = mk(['wave']); g.nodes.push({ id: 'gz', type: 'quantum-fold', on: true, params: { a: 1 } });
  const s = G.sanitizeGraph(g, 'layer'); const u = s.nodes.find(n => n.id === 'gz'); assert.ok(u && u.unknown && u.on === true && u.params.a === 1);
  assert.equal(G.evalCopy(s).nodes.some(n => n.id === 'gz'), false); assert.deepEqual(G.sanitizeGraph(s, 'layer'), s);
});
test('hash and noise are bit-stable (golden values: the GLSL must agree)', () => {
  const c = G.cpu; assert.equal(c.pcg(0), 129708002); assert.equal(c.pcg(1), 2831084092); assert.equal(c.rnd(1, 2).toFixed(6), '0.873793'); assert.equal(c.vn4(1.25, 2.5, 0.75, 3.1, 7).toFixed(6), '0.525742');
  for (let i = 0; i < 200; i++) { const v = c.vn4(i * 0.37, i * 0.11, -i * 0.5, i * 0.07, i); assert.ok(v >= 0 && v <= 1); }
});
test('loop closure: every effector, field and deformer returns to frame 0 at frame L (CPU reference)', () => {
  const rows = [];
  const add = (type, params, extra = []) => rows.push({ type, g: mk(['cloner', { mode: 'grid', cols: 6, rows: 4, content: 'tiles' }], ...extra, [type, params, extra.length ? 'REF' : undefined]) });
  for (const t of ['random', 'delay', 'noise']) for (const cyc of [1, 2, 5]) rows.push({ type: t + cyc, g: mk(['cloner', { mode: 'radial', count: 20 }], [t, { cycles: cyc, posX: 0.3, posY: 0.2, rotZ: 40, scale: 0.5, opacity: -0.4 }]) });
  for (const t of ['wave', 'ripple', 'noised', 'bend', 'twist', 'swirl', 'bulge', 'lens', 'spherify', 'taper', 'shear', 'squash']) for (const cyc of [1, 3]) rows.push({ type: t + cyc, g: mk([t, { cycles: cyc, strength: 0.4, dir: 'both' }]) });
  for (const t of ['sphere', 'box', 'linear', 'noisef', 'randomf', 'stripes']) for (const mo of ['none', 'sweep', 'orbit', 'pulse']) { const g = mk(['cloner', { mode: 'grid', cols: 5, rows: 4 }], [t, { cycles: 2, motion: mo, travel: 1 }], ['plain', { posX: 1, scale: 1 }]); const f = g.nodes.find(n => n.type === t), e = g.nodes.find(n => n.type === 'plain'); e.ref = f.id; rows.push({ type: t + mo, g }); }
  for (const { type, g } of rows) {
    const pk0 = G.pack(ev(g)), N = G.cpu.instanceCount(pk0);
    for (const q of [[0.2, 0.3], [0.9, 0.6], [0.5, 0.5]]) for (const idx of [0, Math.floor(N / 2), N - 1]) {
      const a = G.cpu.vertex(pk0, idx, N, q, X(0)), b = G.cpu.vertex(pk0, idx, N, q, X(1));
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(a.pos[i] - b.pos[i]) < 1e-4, `${type} pos[${i}] ${a.pos[i]} vs ${b.pos[i]}`);
      assert.ok(Math.abs(a.alpha - b.alpha) < 1e-4, `${type} alpha`);
    }
  }
});
test('cloner: grid tiles tile the picture exactly; counts follow the layout', () => {
  const g = mk(['cloner', { mode: 'grid', cols: 4, rows: 3, content: 'tiles', fill: 1 }]), pk = G.pack(ev(g)), N = G.cpu.instanceCount(pk), A = 16 / 9;
  assert.equal(N, 12);
  for (let i = 0; i < N; i++) { const lo = G.cpu.vertex(pk, i, N, [0, 0], X(0)), hi = G.cpu.vertex(pk, i, N, [1, 1], X(0));
    assert.ok(Math.abs((hi.pos[0] - lo.pos[0]) - 2 * A / 4) < 1e-5 && Math.abs((hi.pos[1] - lo.pos[1]) - 2 / 3) < 1e-5, 'tile size');
    // an untouched tile shows exactly the picture behind it: uv is the screen mapping of the position
    for (const q of [[0, 0], [1, 0], [0.3, 0.8], [1, 1]]) { const v = G.cpu.vertex(pk, i, N, q, X(0)); assert.ok(Math.abs(v.uv[0] - (v.pos[0] / (2 * A) + 0.5)) < 1e-5 && Math.abs(v.uv[1] - (0.5 - v.pos[1] / 2)) < 1e-5); } }
  for (const [mode, count, exp] of [['linear', 7, 7], ['radial', 11, 11], ['spiral', 30, 30], ['phyllo', 99, 99], ['scatter', 1234, 1234], ['honeycomb', 0, 8 * 6]]) assert.equal(G.cpu.instanceCount(G.pack(ev(mk(['cloner', { mode, count, cols: 8, rows: 6 }])))), exp, mode);
  assert.equal(G.cpu.instanceCount(G.pack(ev(mk(['cloner', { mode: 'grid', cols: 128, rows: 128 }])))), 16384);
});
test('fields: values stay in range; combine modes behave; the Picture field follows the picture', () => {
  const g = mk(['sphere', { x: 0, y: 0, sizeX: 0.5, sizeY: 0.5, falloff: 0.5, motion: 'none' }], ['plain', { posX: 1 }]); const pk = G.pack(ev(g)), fi = pk.table.findIndex(t => t.ty === 20), x = X();
  assert.ok(G.cpu.field(pk, fi, [0, 0], 0, 0, x) > 0.99); assert.equal(G.cpu.field(pk, fi, [1.2, 0], 0, 0, x), 0);
  const inv = mk(['sphere', { invert: true, motion: 'none' }]); const pi = G.pack(ev(inv)); assert.equal(G.cpu.field(pi, pi.table.findIndex(t => t.ty === 20), [0, 0], 0, 0, x), 0);
  const two = G.newGraph('layer'); const a = G.newNode('sphere', ['stage']); const b = G.newNode('box', ['stage', a.id]); a.params.combine = 'min'; a.ref = b.id; b.params.sizeX = 0.1; b.params.sizeY = 0.1; two.nodes.push(a, b);
  const p2 = G.pack(ev(G.sanitizeGraph(two, 'layer'))); const v = G.cpu.field(p2, p2.table.findIndex(t => t.ty === 20), [0.3, 0], 0, 0, x); assert.ok(v >= 0 && v <= 1);
  const lg = mk(['luma']); const pl = G.pack(ev(lg)); const lf = pl.table.findIndex(t => t.ty === 27); assert.ok(G.cpu.field(pl, lf, [1.5, 0], 0, 0, x) > G.cpu.field(pl, lf, [-1.5, 0], 0, 0, x));
});
test('effectors: delay is a travelling wave; sound reads the spectrum; ref weights the result', () => {
  const g = mk(['cloner', { mode: 'linear', count: 5, size: 0.1, width: 1 }], ['delay', { scale: 1, cycles: 1, spread: 1, shape: 'pulse' }]), pk = G.pack(ev(g)), N = 5, sa = [];
  for (let i = 0; i < N; i++) sa.push(G.cpu.vertex(pk, i, N, [1, 1], X(0.5)).pos[0] - G.cpu.vertex(pk, i, N, [0, 0], X(0.5)).pos[0]);
  assert.ok(new Set(sa.map(v => v.toFixed(4))).size > 2, 'sizes differ along the array');
  const s = mk(['cloner', { mode: 'linear', count: 3, size: 0.1 }], ['sound', { scale: 1, bands: 3, bandStart: 0 }]), ps = G.pack(ev(s)); const sz = i => G.cpu.vertex(ps, i, 3, [1, 1], X()).pos[0] - G.cpu.vertex(ps, i, 3, [0, 0], X()).pos[0];
  assert.ok(sz(1) > sz(0) && sz(1) > sz(2), 'band 1 of the spectrum is the loudest of the three');
});
test('deformers: identity at zero strength; z push only with the depth direction; object vs world space', () => {
  for (const t of ['bend', 'twist', 'swirl', 'taper', 'shear', 'wave', 'ripple', 'noised', 'bulge', 'lens']) { const g = mk([t, { strength: 0 }]), pk = G.pack(ev(g)); const v = G.cpu.vertex(pk, 0, 1, [0.37, 0.61], X()), A = 16 / 9; assert.ok(Math.abs(v.pos[0] - (0.37 - 0.5) * 2 * A * G.OVER) < 1e-5 && Math.abs(v.pos[1] - (0.61 - 0.5) * 2 * G.OVER) < 1e-5 && Math.abs(v.pos[2]) < 1e-6, t); }
  const w = mk(['wave', { strength: 0.2, dir: 'z' }]), pw = G.pack(ev(w)); assert.ok(Math.abs(G.cpu.vertex(pw, 0, 1, [0.3, 0.5], X()).pos[2]) > 0.01); assert.ok(Math.abs(G.cpu.vertex(pw, 0, 1, [0.3, 0.5], X()).pos[1]) < 1e-6);
  const base = ['cloner', { mode: 'grid', cols: 3, rows: 3, content: 'tiles' }], wo = G.pack(ev(mk(base, ['bulge', { space: 'world', strength: 1, size: 3 }]))), ob = G.pack(ev(mk(base, ['bulge', { space: 'object', strength: 1, size: 3 }])));
  const a = G.cpu.vertex(wo, 0, 9, [0.5, 0.5], X()).pos, b = G.cpu.vertex(ob, 0, 9, [0.5, 0.5], X()).pos; assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-3, 'world and object space differ');
});
test('presets: valid, stable under sanitize, inside the vertex budget', () => {
  assert.ok(G.PRESETS.length >= 12);
  for (const p of G.PRESETS) for (const sc of ['layer', '@']) { const g = G.applyPreset(p.id, sc); assert.ok(g && G.active(g), p.id); assert.deepEqual(G.sanitizeGraph(g, sc), g, p.id); const e = G.estimate(G.evalCopy(g)); assert.ok(e.vertices <= G.MAX_VERTS, p.id); }
});
test('budget: the mesh detail drops, never the instance count, when a graph would exceed the vertex cap', () => {
  const e = G.estimate(ev(mk(['cloner', { mode: 'grid', cols: 128, rows: 128, detail: 32 }]))); assert.ok(e.capped && e.vertices <= G.MAX_VERTS && e.instances === 16384);
  assert.equal(G.estimate(ev(mk(['wave']))).capped, false);
});
test('paths: every numeric channel is addressable and has a schema', () => {
  const g = mk(['cloner'], ['sphere'], ['plain', {}, undefined], ['wave']); const all = G.paths(g, 'L1', true, 'Layer 1 graph'); assert.ok(all.length > 30); const seen = new Set();
  for (const p of all) { assert.ok(!seen.has(p.path), p.path); seen.add(p.path); const m = /^M:([^:]+):([^:]+):(.+)$/.exec(p.path); const s = G.schemaAt(g, m[2], m[3]); assert.ok(s && (s.type === 'range' || s.type === 'int')); }
});
test('active(): the stage alone, a disabled graph or only disabled nodes change nothing', () => {
  assert.equal(G.active(G.newGraph('layer')), false); const g = mk(['wave']); assert.equal(G.active(g), true); g.on = false; assert.equal(G.active(g), false); g.on = true; g.nodes.find(n => n.type === 'wave').on = false; assert.equal(G.active(g), false);
});
