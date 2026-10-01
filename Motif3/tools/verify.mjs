// `npm run verify`: runs every automated quality check and prints a one-page evidence summary (Design Harness evidence-ledger
// format, studio/harness/templates/evidence-ledger.md) mapped to acceptance criteria AC-1..AC-7 of studio/brief.json.
//   npm run verify                      all steps on SwiftShader (SOFTWARE_GL=1), target < 5 min
//   npm run verify -- --only unit,visual   subset
//   npm run verify -- --fast            soak with 60 switches / 20 dialogs instead of 200 / 50 (the ledger prints the counts actually run)
//   npm run verify -- --real           keep the machine's real GPU (visual goldens are then compared per renderer class)
//   npm run verify -- --soak-minutes 5  longer soak
// Other lanes register evidence for AC-2/4/5/6 by adding the probe scripts named in ACCEPTANCE below (exit 0 = pass); until then those AC are NOT MET.
// Every status here is derived from commands this script actually ran; nothing is assumed.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const only = arg('only', null) ? String(arg('only')).split(',') : null, real = !!arg('real', false), soakMin = String(arg('soak-minutes', 0.5));
const outDir = path.join(root, 'verify-out'); fs.mkdirSync(outDir, { recursive: true });
const env = { ...process.env, ...(real ? {} : { SOFTWARE_GL: '1' }) };
if (!env.PLAYWRIGHT_MODULE) { try { const g = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' }).stdout.trim(); if (g && fs.existsSync(path.join(g, 'playwright/index.mjs'))) env.PLAYWRIGHT_MODULE = path.join(g, 'playwright/index.mjs'); } catch { /* local node_modules/playwright is used */ } }
const rev = (() => { const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : 'unknown'; })();
const dirty = (() => { const r = spawnSync('git', ['status', '--porcelain', '--', '.'], { cwd: root, encoding: 'utf8' }); return r.status === 0 && r.stdout.trim() ? '+uncommitted' : ''; })();
const readJson = f => { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { return null; } };

const results = {};
function run(id, label, cmd, args, { expect = 0, parse } = {}) {
  if (only && !only.includes(id)) return null;
  const t0 = Date.now(); process.stdout.write(`  ${id.padEnd(14)} ${label} ... `);
  const r = spawnSync(cmd, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 12 * 60 * 1000 });
  const out = (r.stdout || '') + (r.stderr || ''), ms = Date.now() - t0, ok = r.status === expect;
  const res = { id, label, ok, status: r.status, ms, out, ...(parse ? parse(out) : {}) }; results[id] = res;
  console.log(`${ok ? 'ok' : 'FAILED (exit ' + r.status + ')'} ${(ms / 1000).toFixed(1)} s${res.note ? ' · ' + res.note : ''}`);
  if (!ok) console.log(out.split('\n').slice(-12).map(l => '      | ' + l).join('\n'));
  return res;
}

console.log(`Motif verify · ${new Date().toISOString()} · revision ${rev}${dirty} · ${real ? 'real GPU where available' : 'SwiftShader (software GL)'}\n`);
const T0 = Date.now();
run('build', 'motif7.html matches src-v5', 'python3', ['src-v5/build.py', '--check']);
run('unit', 'unit tests (node --test)', 'node', ['--test', ...fs.readdirSync(path.join(root, 'tests')).filter(f => f.endsWith('.test.mjs')).map(f => 'tests/' + f)], { parse: o => { const p = /(?:#|ℹ) pass (\d+)/.exec(o), f = /(?:#|ℹ) fail (\d+)/.exec(o); return { pass: p ? +p[1] : 0, fail: f ? +f[1] : 0, note: `${p ? p[1] : '?'} pass, ${f ? f[1] : '?'} fail` }; } });
run('cache', 'render cache pixel-identity', 'node', ['tools/cache-check.mjs']);
run('visual', 'visual regression vs goldens', 'node', ['tests/browser/visual.mjs'], { parse: () => { const j = readJson('tests/visual-out/summary.json'); return { sum: j, note: j ? `${j.compared} scenes, ${j.failedScenes} outside tolerance${j.envMismatch ? ', ENV MISMATCH' : ''}` : '' }; } });
run('a11y', 'keyboard / ARIA / contrast / reflow', 'node', ['tests/browser/a11y.mjs'], { parse: () => { const j = readJson('tests/a11y-out/summary.json'); return { sum: j, note: j ? `${j.passed} pass, ${j.known} known-open, ${j.failed} fail` : '' }; } });
run('soak', `soak (${soakMin} min churn)`, 'node', ['tests/browser/soak.mjs', '--minutes', soakMin, ...(arg('fast', false) ? ['--switches', '60', '--dialogs', '20'] : [])], { parse: () => { const j = readJson('tests/soak-out/summary.json'); return { sum: j, note: j ? `${j.passed} pass, ${j.failed} fail` : '' }; } });
const smoke = path.join(outDir, 'bench-smoke.json');
run('bench-smoke', 'bench harness (3 styles, 640x360)', 'node', ['tools/bench.mjs', '--budget', '--styles', 'particle-form,lissajous,neuro/mitosis', '--frames', '12', '--size', '640x360', '--out', smoke], { parse: () => { const j = readJson('verify-out/bench-smoke.json'); return { sum: j, note: j ? `${j.scenes.length} styles; p95 ${j.scenes.map(s => s.p95).join('/')} ms on ${j.software ? 'software GL' : 'GPU'}` : '' }; } });

// Gate mechanism on synthetic reports: proves CI would fail over budget / on a >15% regression, independent of this machine's GPU.
if (!only || only.includes('bench-gate')) {
  const t0 = Date.now(); const mk = (p95, extra = {}) => ({ renderer: 'synthetic GPU', software: false, size: '1280x720', frames: 60, date: '2000-01-01T00:00:00Z', scenes: [{ id: 'synthetic/style', p50: p95 / 2, p95, max: p95 * 1.3, errors: [] }], ...extra });
  const w = (n, o) => { const f = path.join(outDir, n); fs.writeFileSync(f, JSON.stringify(o)); return f; };
  const bud = w('synthetic-budgets.json', { schema: 2, default: 16.7, reference: null, styles: { 'synthetic/style': { p95: 10 } } });
  const sp = (script, a) => spawnSync('node', [path.join('tools', script), ...a], { cwd: root, encoding: 'utf8' }).status;
  const checks = [['within budget exits 0', sp('bench-gate.mjs', [w('s-ok.json', mk(9)), '--budgets', bud]) === 0], ['over budget exits 1', sp('bench-gate.mjs', [w('s-over.json', mk(11)), '--budgets', bud]) === 1],
    ['software GL is skipped (exit 0)', sp('bench-gate.mjs', [w('s-sw.json', mk(99, { software: true })), '--budgets', bud]) === 0],
    ['+10% p95 passes the comparer', sp('bench-compare.mjs', [w('c-old.json', mk(10)), w('c-new10.json', mk(11))]) === 0], ['+20% p95 fails the comparer (exit 1)', sp('bench-compare.mjs', [w('c-old.json', mk(10)), w('c-new20.json', mk(12))]) === 1],
    ['different GPU is not comparable (exit 2)', sp('bench-compare.mjs', [w('c-old.json', mk(10)), w('c-other.json', mk(10, { renderer: 'other GPU' }))]) === 2]];
  const ok = checks.every(c => c[1]); results['bench-gate'] = { id: 'bench-gate', label: 'budget gate + regression comparer (synthetic)', ok, ms: Date.now() - t0, checks, note: `${checks.filter(c => c[1]).length}/${checks.length} mechanism checks` };
  console.log(`  ${'bench-gate'.padEnd(14)} budget gate + regression comparer (synthetic) ... ${ok ? 'ok' : 'FAILED: ' + checks.filter(c => !c[1]).map(c => c[0]).join('; ')}`);
}

// Probes registered by other lanes (exit 0 = pass). Absent file = no evidence.
const ACCEPTANCE = {
  'AC-1': { text: 'Benchmark harness reports p50/p95 per style and CI fails over declared budgets', steps: ['unit', 'bench-smoke', 'bench-gate'] },
  'AC-2': { text: 'Render Worker on OffscreenCanvas; main-thread frame time < 4 ms during a heavy style; main-thread fallback', probes: ['tests/browser/worker-engine.mjs'] },
  'AC-3': { text: 'Scrubbing/looping replay from a bounded render cache with pixel-identical output', steps: ['cache', 'soak'], soakIds: ['soak:render-cache-bounded'] },
  'AC-4': { text: 'WebCodecs decode + OPFS persistence; WebCodecs export; background render queue', probes: ['tests/browser/media-pool.mjs', 'tests/browser/deliver-queue.mjs'] },
  'AC-5': { text: 'Colour page: GPU waveform/vectorscope/histogram, node grade, LUT import/export', probes: ['tests/browser/colour-page.mjs'] },
  'AC-6': { text: 'Kits install through a versioned plugin API with sandbox and schema validation', probes: ['tests/browser/plugin-sandbox.mjs'] },
  'AC-7': { text: 'Each page (Media, Edit, Colour, Deliver) keyboard-complete with designed empty, loading and error states', steps: ['a11y'], cap: 'PARTIAL', capNote: 'keyboard/ARIA evidence covers the current inspector tabs, dialogs, library, stage and timeline; there are no Media/Edit/Colour/Deliver pages yet and empty/loading/error states are not tested' },
};
const probeIds = [];
for (const ac of Object.values(ACCEPTANCE)) for (const p of ac.probes || []) if (fs.existsSync(path.join(root, p))) { const id = 'probe:' + path.basename(p, '.mjs'); probeIds.push(id); run(id, `lane probe ${p}`, 'node', [p]); }

const total = (Date.now() - T0) / 1000;
const soakIds = id => (results.soak && results.soak.sum ? results.soak.sum.results.filter(r => r.id === id && !r.info) : []);
const budgets = readJson('tools/budgets.json'), swSmoke = results['bench-smoke'] && results['bench-smoke'].sum && results['bench-smoke'].sum.software;
function status(id, ac) {
  const notes = [];
  if (ac.probes) {
    const missing = ac.probes.filter(p => !fs.existsSync(path.join(root, p))), failing = ac.probes.filter(p => results['probe:' + path.basename(p, '.mjs')] && !results['probe:' + path.basename(p, '.mjs')].ok);
    if (missing.length) return ['NOT MET', `no evidence: ${missing.join(', ')} not present (owned by another lane)`];
    return failing.length ? ['NOT MET', `probe failing: ${failing.join(', ')}`] : ['MET', `probe(s) passed: ${ac.probes.join(', ')} (scope and device are the probe's; see its output)`];
  }
  const missing = ac.steps.filter(s => !results[s]); if (missing.length) return ['NOT VERIFIED', `step(s) not run: ${missing.join(', ')}`];
  const bad = ac.steps.filter(s => !results[s].ok); if (bad.length) return ['NOT MET', `failing step(s): ${bad.join(', ')}`];
  for (const sid of ac.soakIds || []) { const r = soakIds(sid); if (!r.length || !r.every(x => x.ok)) return ['NOT MET', `${sid} not satisfied`]; notes.push(`${sid} ok`); }
  let st = 'MET';
  if (id === 'AC-1' && budgets && !budgets.reference) { st = 'PARTIAL'; notes.push('mechanism proven on synthetic data and a software-GL smoke run; budgets.json has NO measured reference (defaults are placeholders) and the gate has not run on a real GPU'); }
  if (id === 'AC-3') notes.push(`replay identity from tools/cache-check.mjs on ${swSmoke === false ? 'GPU' : 'software GL'}; bound checked through soak churn`);
  if (ac.cap) { st = ac.cap; notes.push(ac.capNote); }
  return [st, notes.join('; ')];
}

const dev = (results.soak && results.soak.sum && results.soak.sum.device) || (results['bench-smoke'] && results['bench-smoke'].sum && { renderer: results['bench-smoke'].sum.renderer }) || {};
const L = [];
L.push('# Motif quality evidence (one page)', '', `Revision ${rev}${dirty} · ${new Date().toISOString().slice(0, 10)} · device: ${dev.renderer || 'unknown'}${dev.class === 'swiftshader' || swSmoke ? ' (SOFTWARE GL: lifecycle and correctness evidence only, not performance)' : ''} · ${((Date.now() - T0) / 1000).toFixed(0)} s total`, '');
L.push('## Evidence ledger', '', '| ID | Claim or decision | Observed / source / inference / hypothesis | Local artifact and provenance | Date/revision | Method and scope | Limits | Owner |', '| --- | --- | --- | --- | --- | --- | --- | --- |');
const d = new Date().toISOString().slice(0, 10), rv = `${d} · ${rev}${dirty}`, st = id => (results[id] ? (results[id].ok ? 'pass' : 'FAIL') : 'not run');
const v = results.visual && results.visual.sum, a = results.a11y && results.a11y.sum, k = results.soak && results.soak.sum, bs = results['bench-smoke'] && results['bench-smoke'].sum;
const row = (...c) => L.push('| ' + c.join(' | ') + ' |');
row('Q-1', 'Production HTML is built from src-v5; unit and tooling contracts hold', `Observed: build ${st('build')}; unit ${results.unit ? results.unit.note : 'not run'}`, '`python3 src-v5/build.py --check`, `tests/*.test.mjs`', rv, 'Node test runner; modules in a vm, PNG codec, budget schema, comparer, token contrast', 'Pure logic only; no GL', 'Verifier');
row('Q-2', 'Rendered output is deterministic and unchanged vs goldens', `Observed: ${st('visual')}${v ? `; ${v.compared} scenes (every style x3 times, finish combos, 6 aspects, sRGB/P3, multi-layer), ${v.failedScenes} outside tolerance, goldens ${v.goldenKB} KB` : ''}`, '`tests/browser/visual.mjs`, `tests/golden/swiftshader/`, diffs in `tests/visual-out/`', rv, 'Same pipeline as export (`__lab.renderAt`); per-channel > 6/255 and > 0.4% pixels or mean > 1.5 fails', 'SwiftShader goldens only; other GPUs differ. Fonts/engine/driver mismatch reports NOT VERIFIED. 96x54-168x72 px renders', 'Verifier');
row('Q-3', 'Cache replay is pixel-identical and invalidates on edit', `Observed: ${st('cache')}`, '`tools/cache-check.mjs`', rv, '12 frames scrubbed live vs replayed, edit invalidation, play-through hits', 'Quarter proxy, software GL', 'Performance');
row('Q-4', 'Keyboard, ARIA, contrast, reflow, reduced motion, targets on the current shell', `Observed: ${st('a11y')}${a ? `; ${a.passed} checks pass, ${a.known} known-open, ${a.failed} fail` : ''}`, '`tests/browser/a11y.mjs`, `docs/a11y-findings.md`, `tests/a11y-out/`', rv, 'Real Chromium key events at 1440x900, 720x450@2x, 360/320 px, coarse pointer', 'No screen reader run; NOT a WCAG conformance claim; contrast of text over images/gradients and the canvas content not measured', 'Accessibility');
const hs = k && k.phases && k.phases.styleSwitches, ch = k && k.phases && k.phases.churn;
row('Q-5', 'No page errors, bounded heap, no canvas/GL/video leaks, context-loss and hidden-tab recovery', `Observed: ${st('soak')}${k ? `; ${hs ? hs.count : '?'} style switches, ${k.phases.exportDialog ? k.phases.exportDialog.count : '?'} export open/close, ${ch ? ch.iterations : '?'} churn iterations/${ch ? ch.minutes : '?'} min; heap ${k.baseline ? k.baseline.heapMB : '?'} -> ${k.final ? k.final.heapMB : '?'} MB; ${k.passed} pass, ${k.failed} fail` : ''}`, '`tests/browser/soak.mjs`, `tests/soak-out/summary.json`', rv, 'CDP forced GC + WeakRef counting; WEBGL_lose_context; simulated visibility + CDP lifecycle freeze', 'Software GL: not representative of GPU memory or timing; minutes-scale, not hours; real background-tab throttling not observed', 'Performance');
row('Q-6', 'Per-style p50/p95 are measured and budgets are enforceable', `Observed: smoke ${st('bench-smoke')}${bs ? `; ${bs.scenes.map(s => `${s.id} p95 ${s.p95} ms`).join(', ')} on ${bs.software ? 'SOFTWARE GL' : bs.renderer}` : ''}; gate mechanism ${st('bench-gate')} (${results['bench-gate'] ? results['bench-gate'].note : ''}). Hypothesis: budgets.json defaults (16.7 ms) are placeholders${budgets && budgets.reference ? '' : ', no measured reference recorded'}`, '`tools/bench.mjs`, `tools/bench-compare.mjs`, `tools/bench-gate.mjs`, `tools/budgets.json`', rv, '3-style smoke at 640x360; synthetic reports for exit codes', 'Software-GL numbers are for trend only. Real-GPU `--update-budgets --runs 3` NOT run', 'Performance');
L.push('', '## Acceptance criteria (studio/brief.json)', '', '| AC | Criterion | Status | Evidence / limits |', '| --- | --- | --- | --- |');
const brief = readJson('../studio/brief.json') || readJson('../../studio/brief.json'); const crit = id => (brief && brief.acceptance && (brief.acceptance.find(x => x.id === id) || {}).criterion) || ACCEPTANCE[id].text;
const summary = {};
for (const [id, ac] of Object.entries(ACCEPTANCE)) { const [s, n] = status(id, ac); summary[id] = s; L.push(`| ${id} | ${crit(id)} | **${s}** | ${n} |`); }
L.push('', `Legend: MET = every named check ran and passed; PARTIAL = checks pass but part of the criterion is unproven (stated); NOT MET = no evidence or a failing check; NOT VERIFIED = step not run. Only the Verifier lane marks a criterion MET in the harness record.`);
const failed = Object.values(results).filter(r => !r.ok);
L.push(`Steps: ${Object.values(results).map(r => `${r.id} ${r.ok ? 'ok' : 'FAIL'} ${(r.ms / 1000).toFixed(0)}s`).join(' · ')}`, `Total ${total.toFixed(0)} s${total > 300 ? ' (OVER the 5 min target)' : ''}.`);
const md = L.join('\n') + '\n'; fs.writeFileSync(path.join(outDir, 'evidence.md'), md); fs.writeFileSync(path.join(outDir, 'evidence.json'), JSON.stringify({ revision: rev + dirty, date: new Date().toISOString(), ac: summary, steps: Object.fromEntries(Object.entries(results).map(([k2, r]) => [k2, { ok: r.ok, ms: r.ms, note: r.note }])) }, null, 1));
console.log('\n' + md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
process.exit(failed.length ? 1 : 0);
