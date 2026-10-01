// Node grade: .cube / .3dl / HALD parsing, .cube serialisation, schema sanitiser, project round-trip and GLSL planning.
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './load.mjs';
const MODS = ['tokens', 'engine-core', 'style-library', 'kit-gl', 'kits', 'colour', 'timeline', 'grade'];
const m = load(...MODS); const G = m.__m_grade, T = m.__m_timeline;

const cube = (N, f = (r, g, b) => [r, g, b], head = '') => {
  const rows = [`TITLE "t"`, head, `LUT_3D_SIZE ${N}`].filter(Boolean);
  for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) rows.push(f(r / (N - 1), g / (N - 1), b / (N - 1)).map(v => v.toFixed(6)).join(' '));
  return rows.join('\n') + '\n';
};
const arr = a => Array.from(a);
const code = fn => { try { fn(); } catch (e) { return e.code || e.message; } return 'ok'; };

test('cube: identity 3D parses with domain, title and content id', () => {
  const l = G.parseCube(cube(17), 'id.cube');
  assert.equal(l.size3, 17); assert.equal(l.size1, 0); assert.equal(l.title, 't'); assert.deepEqual(arr(l.min3), [0, 0, 0]); assert.deepEqual(arr(l.max3), [1, 1, 1]);
  assert.equal(l.data3.length, 17 ** 3 * 3); assert.match(l.id, /^lut_[a-z0-9]{8,32}$/);
  assert.equal(G.parseCube(cube(17), 'other-name.cube').id, l.id, 'id is content-addressed');
  for (const c of [[0, 0, 0], [1, 1, 1], [0.3, 0.6, 0.9], [0.123, 0.987, 0.5]]) G.sampleLut(l, c).forEach((v, i) => assert.ok(Math.abs(v - c[i]) < 1e-6));
});

test('cube: 1D, shaper + 3D, DOMAIN and INPUT_RANGE keywords, CRLF and comments', () => {
  const one = ['# 1D gamma', 'LUT_1D_SIZE 3', '0 0 0', '0.25 0.25 0.25', '1 1 1'].join('\r\n');
  const l1 = G.parseCube(one); assert.equal(l1.size1, 3); assert.equal(l1.data3, null);
  assert.ok(Math.abs(G.sampleLut(l1, [0.5, 0.5, 0.5])[0] - 0.25) < 1e-6);
  const dom = cube(2, (r, g, b) => [r, g, b], 'DOMAIN_MIN -0.5 -0.5 -0.5\nDOMAIN_MAX 1.5 1.5 1.5');
  const ld = G.parseCube(dom); assert.deepEqual(arr(ld.min3), [-0.5, -0.5, -0.5]); assert.ok(Math.abs(G.sampleLut(ld, [0.5, 0.5, 0.5])[0] - 0.5) < 1e-6);
  const shaper = ['LUT_1D_SIZE 2', 'LUT_3D_SIZE 2', 'LUT_1D_INPUT_RANGE 0 2', '0 0 0', '1 1 1', ...cube(2).split('\n').slice(2)].join('\n');
  const ls = G.parseCube(shaper); assert.equal(ls.size1, 2); assert.equal(ls.size3, 2); assert.deepEqual(arr(ls.max1), [2, 2, 2]);
  assert.ok(Math.abs(G.sampleLut(ls, [1, 1, 1])[0] - 0.5) < 1e-6);
  assert.equal(G.parseCube('LUT_IN_VIDEO_RANGE\n' + cube(2)).size3, 2, 'tool metadata keywords are tolerated');
});

test('cube: malformed inputs are rejected with designed error codes, never a crash', () => {
  const N = cube(2).split('\n');
  const cases = [
    ['', 'empty'], ['# nothing\n', 'empty'], ['hello world', 'keyword'], ['LUT_3D_SIZE 2\n0 0 0\n', 'count'], ['LUT_3D_SIZE 2\n' + '0 0 0\n'.repeat(9), 'count'],
    ['LUT_3D_SIZE 1\n0 0 0', 'size'], ['LUT_3D_SIZE 300\n', 'too-large'], ['LUT_3D_SIZE 2.5\n', 'size'], ['LUT_3D_SIZE\n', 'size'], ['LUT_1D_SIZE 99999\n', 'too-large'],
    ['LUT_3D_SIZE 2\n0 0\n', 'row'], ['LUT_3D_SIZE 2\n0 0 0 0\n', 'row'], ['LUT_3D_SIZE 2\nNaN 0 0\n', 'number'], ['LUT_3D_SIZE 2\n1e400 0 0\n', 'number'], ['LUT_3D_SIZE 2\n0x10 0 0\n', 'number'],
    ['0 0 0\n', 'size'], [N.slice(0, 4).join('\n') + '\nDOMAIN_MIN 0 0 0\n' + N.slice(4).join('\n'), 'keyword'],
    ['DOMAIN_MIN 1 1 1\nDOMAIN_MAX 0 0 0\n' + N.slice(1).join('\n'), 'domain'], ['DOMAIN_MIN 0 0\n' + N.slice(1).join('\n'), 'domain'],
    ['BOGUS 1\n', 'keyword'], ['\u0000\u0001binary', 'format'],
  ];
  for (const [txt, want] of cases) assert.equal(code(() => G.parseCube(txt)), want, JSON.stringify(txt.slice(0, 40)));
  assert.equal(code(() => G.parseCube(null)), 'format');
  assert.equal(code(() => G.parseCube('x'.repeat(25 * 1048576))), 'too-large');
});

test('cube: serialise → parse round-trip is exact to 6 decimals', () => {
  const N = 33, d = G.identityLut(N); for (let i = 0; i < d.length; i += 3) { d[i] = d[i] ** 0.8; d[i + 2] = 1 - d[i + 2] * 0.5; }
  const txt = G.serializeCube(d, N, 'round "trip"'); assert.match(txt, /^TITLE "round trip"\n/); assert.match(txt, /\nLUT_3D_SIZE 33\n/);
  const l = G.parseCube(txt); assert.equal(l.size3, 33); let e = 0; for (let i = 0; i < d.length; i++) e = Math.max(e, Math.abs(l.data3[i] - d[i])); assert.ok(e < 1e-6, 'max err ' + e);
  assert.equal(code(() => G.serializeCube(new Float32Array(10), 33)), 'count');
});

test('3dl and HALD parse into the same red-fastest table', () => {
  const N = 3, rows = ['0 512 1023']; for (let r = 0; r < N; r++) for (let g = 0; g < N; g++) for (let b = 0; b < N; b++) rows.push([r, g, b].map(v => Math.round(v / (N - 1) * 1023)).join(' '));
  const l = G.parse3dl(rows.join('\n'), 'x.3dl'); assert.equal(l.size3, 3);
  for (const c of [[0.5, 0, 1], [1, 0.5, 0]]) G.sampleLut(l, c).forEach((v, i) => assert.ok(Math.abs(v - c[i]) < 1e-3));
  assert.equal(code(() => G.parse3dl('0 256 512 768 1023\n1 2 3\n')), 'count'); assert.equal(code(() => G.parse3dl('0 100 1023 1500\n')), 'domain');
  const L = 2, W = L ** 3, Nn = L * L, px = new Uint8ClampedArray(W * W * 4);
  for (let i = 0; i < Nn ** 3; i++) { const r = i % Nn, g = Math.floor(i / Nn) % Nn, b = Math.floor(i / Nn / Nn); px.set([r / (Nn - 1) * 255, g / (Nn - 1) * 255, b / (Nn - 1) * 255, 255], i * 4); }
  const h = G.parseHald(px, W, W); assert.equal(h.size3, 4); G.sampleLut(h, [0.2, 0.7, 0.4]).forEach((v, i) => assert.ok(Math.abs(v - [0.2, 0.7, 0.4][i]) < 0.01));
  assert.equal(code(() => G.parseHald(px, W, W + 1)), 'size'); assert.equal(code(() => G.parseHald(px, 9, 9)), 'size');
});

test('sanitiser: versioned, bounded, additive, forward tolerant', () => {
  assert.equal(G.sanitizeGrade(null), null); assert.equal(G.sanitizeGrade([1]), null);
  const g = G.sanitizeGrade({ v: 99, on: 'yes', extra: 1, nodes: [
    { id: 'n1', type: 'primary', par: true, params: { liftR: 9, gainY: -3, sat: 'x', bogus: 1 } },
    { id: 'n1', type: 'curves' }, { type: 'nope' }, null, 'x',
    { id: 'm', type: 'mixer', src: 'zzz', par: true }, { id: 'n9', type: 'mixer', src: 'n1' },
    { id: 'nq', type: 'lut', lut: { id: 'not a lut', name: 'x' } }, { id: 'nl', type: 'lut', lut: { id: 'lut_abcdefgh12', name: 'Film', size: 33 }, params: { interp: 'cubic' } },
  ] });
  assert.equal(g.v, 1); assert.equal(g.on, true); assert.equal('extra' in g, false);
  assert.equal(g.nodes.length, 6); assert.equal(g.nodes[0].par, false, 'first node is never parallel');
  assert.equal(g.nodes[0].params.liftR, 0.5); assert.equal(g.nodes[0].params.gainY, 0); assert.equal(g.nodes[0].params.sat, 1); assert.equal('bogus' in g.nodes[0].params, false);
  assert.notEqual(g.nodes[1].id, 'n1', 'duplicate ids are re-issued'); assert.equal(new Set(g.nodes.map(n => n.id)).size, 6);
  const mixers = g.nodes.filter(n => n.type === 'mixer'); assert.equal(mixers[0].src, 'in'); assert.equal(mixers[0].par, false); assert.equal(mixers[1].src, 'n1');
  const luts = g.nodes.filter(n => n.type === 'lut'); assert.equal(luts[0].lut, null); assert.equal(luts[1].lut.name, 'Film'); assert.equal(luts[1].params.interp, 'tetra');
  const many = G.sanitizeGrade({ nodes: Array.from({ length: 40 }, () => ({ type: 'lut' })) }); assert.equal(many.nodes.length, G.MAX_LUT_NODES);
  assert.equal(G.sanitizeGrade({ nodes: Array.from({ length: 40 }, () => ({ type: 'primary' })) }).nodes.length, G.MAX_NODES);
  assert.equal(G.sanitizeGrade({ on: false }).on, false);
  assert.equal(JSON.stringify(G.sanitizeGrade(g)), JSON.stringify(g), 'idempotent');
});

test('project: v5 projects stay unchanged; grade channels are ordinary keyable, evaluable paths', () => {
  const p0 = T.newProject('plexus'); const s0 = T.sanitizeProject(JSON.parse(JSON.stringify(p0)));
  assert.equal('grade' in s0, false, 'no grade block is added to existing projects');
  assert.equal('grade' in T.evaluate(s0, 1, null).finish, false);
  let p = JSON.parse(JSON.stringify(s0)); p.grade = { v: 1, on: true, nodes: [G.newNode('primary', []), { id: 'nq', type: 'qualifier', params: {} }] };
  p = T.sanitizeProject(p); const id = p.grade.nodes[0].id;
  assert.equal(T.schemaAt(p, `G:${id}:gainY`).label, 'Gain'); assert.equal(T.getBase(p, `G:${id}:sat`), 1);
  p = T.setBase(p, `G:${id}:sat`, 5); assert.equal(T.getBase(p, `G:${id}:sat`), 2, 'clamped by schema');
  p = T.setKey(p, `G:${id}:sat`, 0, 0); p = T.setKey(p, `G:${id}:sat`, 0.5, 2, 'linear'); p.keys[`G:${id}:sat`][0].e = 'linear';
  p = T.sanitizeProject(JSON.parse(JSON.stringify(p)));
  const ev = T.evaluate(p, p.finish.loop * 0.25, null); assert.ok(Math.abs(ev.finish.grade.nodes[0].params.sat - 1) < 1e-9);
  assert.equal(p.grade.nodes[0].params.sat, 2, 'evaluation does not mutate the project');
  assert.equal(T.pathLabel(p, `G:${id}:sat`), 'Grade 1 Saturation'); assert.ok(T.allPaths(p, true).some(x => x.path === `G:${id}:gainY`));
  // keys on a deleted node are dropped by the sanitiser
  p.grade.nodes.shift(); assert.equal(Object.keys(T.sanitizeProject(p).keys).some(k => k.startsWith('G:' + id)), false);
});

test('GLSL plan: topology signature, uniform packing and blurred-key slots', () => {
  const g = G.sanitizeGrade({ nodes: [{ id: 'na', type: 'primary' }, { id: 'nb', type: 'curves', par: true }, { id: 'nc', type: 'qualifier', params: { blur: 0.5 } }, { id: 'nd', type: 'mixer', src: 'na', params: { blend: 'screen' } }] });
  const pl = G.plan(g); assert.equal(pl.keys, 1); assert.match(pl.sig, /curvesp/); assert.match(pl.sig, /mixers0/);
  const gp = G.pack(pl); assert.equal(gp.length, pl.vec * 4); assert.equal(gp[pl.blocks[3].base + 2], 3, 'select packs as option index');
  const src = G.codegen(pl); assert.match(src, /uniform sampler2D GK0/); assert.match(src, /vec3 gradeAll/); assert.ok(!/GL0/.test(src));
  const k = G.codegen(G.plan(g, 'key', 2), 2); assert.match(k, /return vec3\(gKey/);
  const bal = s => [...s].reduce((a, c) => a + (c === '{') - (c === '}'), 0); assert.equal(bal(src), 0); assert.equal(bal(k), 0);
});
