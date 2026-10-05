// motif-kit@4 unit tests against the SDK build of the engine (DOM-free): node --test tests/v8/unit.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import { root, readKit } from './lib.mjs';
const KG = new Function(fs.readFileSync(path.join(root, 'sdk/motif-kit-sdk/lib/kit-gl.js'), 'utf8'))(), V = KG.v4;
const base = () => ({ format: 'motif-kit@4', id: 'tk', name: 'T', version: '1.0.0', capabilities: [], styles: [{ id: 'aa', name: 'A', passes: [{ src: 'a.glsl' }], params: {} }] });
const F = { 'a.glsl': 'vec4 motif(vec2 uv, vec2 fc){ return vec4(1.0); }' };
const kit = n => readKit(path.join(root, 'sdk/motif-kit-sdk/examples', n));

test('the reference kits validate (including static GLSL analysis)', () => {
  for (const k of ['stack-lab', 'vector-type', 'sequence-demo']) { const { manifest, files } = kit(k), v = KG.validateKit(manifest, files); assert.ok(v.ok, k + ': ' + v.errors.join('; ')); assert.equal(v.kit.format, 'motif-kit@4'); }
});
test('layer stacks: limits, generated inputs and controls', () => {
  const m = base(); m.capabilities = ['media']; m.styles[0].stack = { layers: 3 };
  const v = KG.validateKit(m, F); assert.ok(v.ok, v.errors.join()); const s = v.kit.styles[0];
  assert.deepEqual(s.inputs.map(q => q.id), ['layer1', 'layer2', 'layer3']); assert.ok(s.params.layer2Blend && s.params.layer1PosX.part.kind === 'point'); assert.equal(s.blocks.length, 3);
  m.styles[0].stack = { layers: 4 }; assert.ok(!KG.validateKit(m, F).ok);
  m.styles[0].stack = { layers: 2, defaults: [{ blend: 'nope' }] }; assert.ok(!KG.validateKit(m, F).ok);
  const old = base(); old.format = 'motif-kit@3'; old.capabilities = ['media']; old.styles[0].stack = { layers: 2 }; assert.ok(!KG.validateKit(old, F).ok, '@3 rejects stack');
});
test('svg inputs: safe files only, capability required', () => {
  const m = base(); m.capabilities = ['vector']; m.styles[0].inputs = [{ id: 'logo', type: 'svg', src: 'x.svg' }];
  const good = '<svg viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>';
  assert.ok(KG.validateKit(m, { ...F, 'x.svg': good }).ok); assert.ok(!KG.validateKit(m, F).ok, 'missing file');
  for (const bad of ['<svg><script>1</script></svg>', '<svg><image href="http://x/y.png"/></svg>', '<svg onload="x()"></svg>', '<svg><use href="http://x/#a"/></svg>', 'not svg']) assert.ok(!KG.validateKit(m, { ...F, 'x.svg': bad }).ok, bad);
  m.capabilities = []; assert.ok(!KG.validateKit(m, { ...F, 'x.svg': good }).ok, 'needs the vector capability');
  const o = base(); o.format = 'motif-kit@3'; o.styles[0].inputs = [{ id: 'logo', type: 'svg', src: 'x.svg' }]; assert.ok(!KG.validateKit(o, { ...F, 'x.svg': good }).ok, '@3 rejects svg');
});
test('text distance fields add a derived input', () => {
  const m = base(); m.capabilities = ['text']; m.styles[0].inputs = [{ id: 'title', type: 'text', sdf: true, lines: [{ id: 'l1', def: 'HI' }] }];
  const v = KG.validateKit(m, F); assert.ok(v.ok, v.errors.join()); assert.deepEqual(v.kit.styles[0].inputs.map(q => q.type), ['text', 'sdf']);
  m.format = 'motif-kit@3'; assert.ok(!KG.validateKit(m, F).ok);
});
test('generated controls cannot clash with declared ones', () => {
  const m = base(); m.capabilities = ['media']; m.styles[0].stack = { layers: 1 }; m.styles[0].params = { layer1Opacity: { type: 'range', min: 0, max: 1, def: 1 } };
  assert.ok(!KG.validateKit(m, F).ok);
});
test('earlier formats still validate: reference @1, @2 and @3 kits are unchanged', () => {
  for (const k of ['param-lab', 'lumen-fx', 'type-lines']) { const { manifest, files } = kit(k), v = KG.validateKit(manifest, files); assert.ok(v.ok, k); assert.ok(!/motif-kit@4/.test(v.kit.sourceFormat)); }
});
test('playhead closes the loop in every mode and is continuous', () => {
  const N = 400; for (const mode of [0, 1, 2, 3]) for (const k of [1, 2, 3, 5]) {
    const a = V.playhead(k, mode, 1, 0, 417), b = V.playhead(k, mode, 1, 1, 417); assert.ok(mode < 2 ? Math.abs(b - a) === k : Math.abs(b - a) < 1e-9, `closes mode ${mode} k ${k}`);
    let mx = 0; for (let i = 0; i < N; i++) mx = Math.max(mx, Math.abs(V.playhead(k, mode, 1, (i + 1) / N, 417) - V.playhead(k, mode, 1, i / N, 417))); assert.ok(mx < 4 * k / N + 1e-6, `continuous mode ${mode} k ${k}: ${mx}`);
  }
  const signs = new Set(); for (let i = 0; i < 16; i++) signs.add(Math.sign(V.playhead(16, 3, 1, (i + 0.25) / 16, 417))); assert.ok(signs.has(1) && signs.has(-1), 'random uses both directions');
  assert.equal(V.playhead(0, 0, 1, 0.7, 1), 0);
});
test('sequences: validation and planning', () => {
  const s = (cues, o) => V.validateSequence({ id: 'sq', loop: 8, bpm: 120, cues, ...o }, {});
  const r1 = s([{ style: 'a', at: '2b', len: '1s' }]); assert.ok(r1.ok); assert.ok(Math.abs(r1.seq.cues[0].at - 0.125) < 1e-9 && Math.abs(r1.seq.cues[0].len - 0.125) < 1e-9);
  assert.ok(!s(Array.from({ length: 5 }, (_, i) => ({ id: 'c' + i, style: 'a', at: 0, len: 0.5, lane: i }))).ok, 'more than maxActive overlapping');
  assert.ok(!s([{ style: 'a', len: 0.5, dir: 'sideways' }]).ok); assert.ok(!s([{ style: 'a', len: 0.5, cycles: 1.5 }]).ok); assert.ok(!s([{ style: 'a', len: 0.5, params: { __proto__x: 1, constructor: 2 } }]).ok);
  assert.ok(!V.validateSequence({ id: 'sq', cues: [{ style: 'a', len: '2s' }] }, {}).ok, 'seconds need a loop');
  const r = s([{ style: 'a', at: 0.9, len: 0.2, repeat: { every: 0.3, count: 3 } }]); assert.ok(r.ok); assert.equal(r.seq.cues.length, 3);
  const p = V.planSequence(r.seq, 0.05, {}); assert.equal(p.active.length, 1); assert.ok(Math.abs(p.active[0].local - 0.75) < 1e-6, 'a cue wraps past the loop end');
  const q = s([{ style: 'a', at: 0.1, len: 0.5, cycles: 2, fadeIn: 0.1, fadeOut: 0.1 }]).seq, a0 = V.planSequence(q, 0.1, {}).active[0], a1 = V.planSequence(q, 0.6 - 1e-6, {}).active[0];
  assert.equal(a0.env, 0); assert.ok(a1.env < 1e-6, 'cues start and end invisible'); const dd = Math.abs(a0.innerP - a1.innerP); assert.ok(dd < 1e-3 || Math.abs(dd - 1) < 1e-3, 'inner phase closes');
  assert.equal(JSON.stringify(V.planSequence(q, 0.3, { seed: 5 })), JSON.stringify(V.planSequence(q, 0.3, { seed: 5 })));
  assert.equal(V.planSequence(s([{ style: 'a', at: 0, len: 1, chance: 0 }]).seq, 0.5, {}).active.length, 0);
});
test('sanitizeSeq bounds hostile data', () => {
  const z = V.sanitizeSeq({ cues: [{ style: 'ok', at: 7, len: -3, lane: 99, cycles: 50, dir: 'x', blend: 'x', opacity: 9, params: { __proto__: 1, good: 2, bad: {}, 'x y': 1 } }, { style: '../../etc' }, null] });
  assert.equal(z.cues.length, 1); const c = z.cues[0]; assert.ok(c.at <= 1 && c.len >= 0.01 && c.lane <= 7 && c.cycles <= 8 && c.opacity <= 1 && c.dir === 'forward' && c.blend === 'normal'); assert.deepEqual(Object.keys(c.params), ['good']);
  assert.equal(V.sanitizeSeq({ cues: Array.from({ length: 500 }, () => ({ style: 'a' })) }).cues.length, 64);
});
test('svg parser: shapes, transforms, skipped elements', () => {
  const d = V.parseSvg('<svg viewBox="0 0 10 10"><defs><path d="M0 0"/></defs><g transform="translate(2 3)"><rect x="0" y="0" width="4" height="4"/><circle cx="5" cy="5" r="1"/></g><text>hi</text><path d="M1 1L2 2" fill="none" stroke="#000"/></svg>');
  assert.equal(d.shapes.length, 3); assert.deepEqual(d.viewBox, [0, 0, 10, 10]); assert.equal(d.shapes[0].m[4], 2); assert.equal(d.shapes[2].fill, 'none');
});
test('sdf of a half-plane edge is accurate to a fraction of a pixel', () => {
  const w = 64, h = 32, a = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = x > 32 ? 255 : x === 32 ? 128 : 0;
  const out = V.sdfFromAlpha(a, w, h, 16), at = x => (out[(10 * w + x) * 4] / 255 - 0.5) * 2 * 16;
  assert.ok(Math.abs(at(20) - 12) < 0.3 && Math.abs(at(40) + 8) < 0.3, `${at(20)} ${at(40)}`); // edge at x = 32.5: pixel centres at 20.5 and 40.5
});

test('hostile svg text parses and validates in linear time', () => {
  const evil = ['<svg viewBox="0 0 1 1"' + ' '.repeat(65000), '<svg viewBox="0 0 1 1">' + '<g>'.repeat(20000), '<svg>' + '<path d="M0 0" '.repeat(4000), '<svg ' + 'a="'.repeat(21000), '<!--'.repeat(16000), '<a'.repeat(30000), '<?'.repeat(30000), '<svg>' + '<!DOCTYPE '.repeat(6000), '="'.repeat(30000), '<svg>' + '<rect width="1" height="1"/>'.repeat(2400)];
  for (const e of evil) { const t0 = performance.now(); const text = e.slice(0, 64 * 1024); V.svgProblem(text); try { V.parseSvg(text); } catch (x) { /* a parse error is fine */ } const ms = performance.now() - t0; assert.ok(ms < 400, `${ms | 0} ms for ${JSON.stringify(e.slice(0, 24))}`); }
});
