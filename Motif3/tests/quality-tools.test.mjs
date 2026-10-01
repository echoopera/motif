// Unit tests for the quality-bar tooling itself: PNG codec + image comparison, budget contract, bench comparer, contrast maths.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import { encodePng, decodePng, compareImages, DEFAULT_TOLERANCE } from '../tools/imgdiff.mjs';
import { budgetFor, validateBudgets, evaluateReport, proposeBudgets, compareReports, renderMarkdown } from '../tools/budget-lib.mjs';
import { ratio, checkTokens } from '../tools/contrast.mjs';
const root = path.resolve(import.meta.dirname, '..');

const img = (w, h, f) => { const d = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, b, a = 255] = f(x, y); d.set([r, g, b, a], (y * w + x) * 4); } return { w, h, data: d }; };

test('png round-trips RGB and RGBA exactly', () => {
  const a = img(37, 19, (x, y) => [x * 6, y * 13, (x * y) & 255]);
  const r = decodePng(encodePng(a.w, a.h, a.data)); assert.deepEqual([...r.data], [...a.data]);
  const b = img(8, 8, (x, y) => [x * 30, y * 30, 7, (x + y) * 16]); const rb = decodePng(encodePng(8, 8, b.data)); assert.deepEqual([...rb.data], [...b.data]);
});

test('compareImages: tolerance, fraction and size mismatch', () => {
  const a = img(20, 10, () => [100, 100, 100]);
  assert.ok(compareImages(a, img(20, 10, () => [104, 100, 100])).ok, 'within per-channel tolerance');
  assert.ok(!compareImages(a, img(20, 10, () => [130, 100, 100])).ok, 'all pixels far off fails');
  const few = img(20, 10, (x, y) => (x === 0 && y === 0 ? [255, 0, 0] : [100, 100, 100]));
  assert.ok(!compareImages(a, few).ok, '1/200 = 0.5% > 0.4% fails');
  assert.ok(compareImages(a, few, { fraction: 0.01 }).ok, 'looser fraction passes');
  assert.ok(!compareImages(a, img(10, 10, () => [100, 100, 100])).ok);
  assert.equal(DEFAULT_TOLERANCE.channel, 6);
});

test('budgets.json satisfies the schema contract', () => {
  const b = JSON.parse(fs.readFileSync(path.join(root, 'tools/budgets.json'), 'utf8'));
  assert.deepEqual(validateBudgets(b), []);
  assert.equal(b.schema, 2); assert.equal(b.reference, null, 'no reference may be recorded until measured on a real GPU');
  assert.deepEqual(validateBudgets({ default: 16.7, styles: { a: { p95: -1 } } }).length, 1);
});

const rep = (renderer, software, scenes, size = '1280x720') => ({ renderer, software, size, frames: 60, date: '2026-01-01T00:00:00Z', scenes: scenes.map(([id, p95, extra]) => ({ id, p50: p95 / 2, p95, max: p95 * 1.2, errors: [], ...extra })) });

test('budgetFor accepts numbers and objects, falls back to default', () => {
  const b = { default: 16.7, styles: { a: 5, b: { p95: 7, max: 20 } } };
  assert.equal(budgetFor(b, 'a').p95, 5); assert.equal(budgetFor(b, 'b').max, 20); assert.equal(budgetFor(b, 'zzz').source, 'default');
  const ev = evaluateReport(rep('GPU', false, [['a', 6], ['b', 6, { max: 25 }], ['c', 10]]), b);
  assert.deepEqual(ev.map(r => r.ok), [false, false, true]);
});

test('proposeBudgets refuses software GL and never invents values', () => {
  assert.throws(() => proposeBudgets(rep('SwiftShader', true, [['a', 100]]), { default: 16.7, styles: {} }), /software/);
  const { budgets, skipped } = proposeBudgets(rep('Apple M', false, [['a', 4.01], ['bad', 9, { errors: ['x'] }]]), { default: 16.7, styles: { keep: 3 } }, { margin: 0.25 });
  assert.equal(budgets.styles.a.p95, 5.1); assert.equal(budgets.styles.keep, 3); assert.equal(budgets.default, 16.7); assert.deepEqual(skipped, ['bad']);
  assert.equal(budgets.reference.device, 'Apple M'); assert.deepEqual(validateBudgets(budgets), []);
});

test('compareReports fails on >15% p95 regressions only', () => {
  const o = rep('GPU', false, [['a', 10], ['b', 10], ['tiny', 0.5], ['gone', 1]]);
  const n = rep('GPU', false, [['a', 11.4], ['b', 11.6], ['tiny', 0.7], ['new', 2]]);
  const c = compareReports(o, n);
  assert.deepEqual(c.regressions.map(r => r.id), ['b'], '+14% passes, +16% fails, tiny delta below 0.25 ms ignored');
  assert.deepEqual(c.added, ['new']); assert.deepEqual(c.removed, ['gone']);
  assert.equal(compareReports(o, rep('GPU', true, [['a', 10]])).comparable, false, 'software vs hardware not comparable');
  assert.equal(compareReports(o, rep('Other GPU', false, [['a', 10]])).comparable, false);
  assert.equal(compareReports(o, rep('GPU', false, [['a', 10]], '1920x1080')).comparable, false);
  assert.match(renderMarkdown(o, { default: 16.7, styles: {}, reference: null }), /none recorded yet/);
});

test('token contrast: body text >= 4.5 and UI/focus >= 3 on the live palette', () => {
  assert.ok(Math.abs(ratio('#000000', '#FFFFFF') - 21) < 1e-9);
  const bad = checkTokens('live').filter(r => !r.ok); assert.deepEqual(bad, [], JSON.stringify(bad));
});
