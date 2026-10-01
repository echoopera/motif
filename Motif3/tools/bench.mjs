// Frame-time benchmark and budget gate for Motif 5.
//   node tools/bench.mjs                      all styles at 1280x720, writes performance-review/bench-<date>.json
//   node tools/bench.mjs --budget             also fail (exit 1) when a style's p95 exceeds tools/budgets.json
//   node tools/bench.mjs --styles a,b --size 1920x1080 --frames 90 --file motif5.html
//   node tools/bench.mjs --kit my-kit.motifkit  install a kit (folder, .motifkit or JSON bundle) through the guarded
//                                              path, bench its styles, effects and transitions, and compare each
//                                              with its declared `cost` (used by `motif-kit bench`; --strict fails on
//                                              a mismatch > 2× on a hardware GPU)
// Run on a machine with a real GPU for meaningful numbers; software GL (SwiftShader) is flagged and the budget gate is skipped.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readKitPath } from './lib/kit-files.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const file = arg('file', 'motif5.html'), [w, h] = String(arg('size', '1280x720')).split('x').map(Number), frames = +arg('frames', 60);
const styles = arg('styles', null), gate = !!arg('budget', false), kitPath = arg('kit', null), strict = !!arg('strict', false);
const budgets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'budgets.json'), 'utf8'));
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || undefined, headless: true, args: process.env.SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
let code = 0;
try { app: { // labelled so kit mode can leave early without re-indenting the app benchmark
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(root, file)).href); await page.waitForFunction(() => window.__lab, null, { timeout: 30000 }); await page.waitForTimeout(1500);
  if (kitPath) { code = await benchKit(page, errors); break app; }
  const report = await page.evaluate(async o => window.__lab.bench({ all: true, silent: true, w: o.w, h: o.h, frames: o.frames, styles: o.styles }), { w, h, frames, styles: styles ? String(styles).split(',') : undefined });
  report.pageErrors = errors; report.browser = browser.version();
  const out = path.join(root, 'performance-review', `bench-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(`${report.renderer || 'unknown GPU'}${report.software ? ' (SOFTWARE)' : ''} · ${report.size} · ${report.scenes.length} styles → ${path.relative(root, out)}`);
  console.table(report.scenes.map(s => ({ style: s.id, p50: s.p50, p95: s.p95, max: s.max, budget: budgets.styles[s.id] ?? budgets.default, ok: s.p95 <= (budgets.styles[s.id] ?? budgets.default), err: s.errors.length })));
  if (gate) {
    if (report.software) console.log('Budget gate skipped: software GL is not representative.');
    else { const bad = report.scenes.filter(s => s.p95 > (budgets.styles[s.id] ?? budgets.default)); if (bad.length) { console.error(`Over budget: ${bad.map(s => s.id).join(', ')}`); code = 1; } }
    if (errors.length) { console.error('Page errors:', errors); code = 1; }
  }
} } finally { await browser.close(); }
process.exit(code);

// ---- kit mode ---------------------------------------------------------------------------------------------------
// Declared `cost` is relative to a cost-1 style at MS_PER_MPX ms per megapixel (05-kits.js drawPlan); the measured
// cost is p50 / (MS_PER_MPX × megapixels). Software GL numbers are reported but never judged.
async function benchKit(page, errors) {
  const raw = readKitPath(path.resolve(kitPath));
  const inst = await page.evaluate(async raw => { const r = await window.__lab.kitHost.install(raw, { source: 'file', approved: 'all' }); return { ok: r.ok, errors: r.errors || [], quarantined: r.quarantined || [], canary: r.canary || {}, entries: r.report ? r.report.entries : [], kit: r.kit ? { id: r.kit.id, name: r.kit.name, version: r.kit.version } : null }; }, raw);
  if (!inst.ok) { console.error(`Install failed:\n${inst.errors.join('\n')}`); return 1; }
  const ids = inst.entries.filter(e => e.kind === 'style').map(e => e.id);
  const report = ids.length ? await page.evaluate(async o => window.__lab.bench({ all: true, silent: true, w: o.w, h: o.h, frames: o.frames, styles: o.ids }), { w, h, frames, ids }) : { scenes: [], ...(await page.evaluate(() => { const g = window.__lab.kits.gpuStatus(); return { renderer: g.renderer, software: g.software }; })) };
  const fx = await page.evaluate(async o => {
    const H = window.__lab.kitHost, sleep = ms => new Promise(r => setTimeout(r, ms)), out = [];
    const mk = () => Object.assign(document.createElement('canvas'), { width: o.w, height: o.h });
    const a = mk(), b = mk(), dst = mk(), dx = dst.getContext('2d', { willReadFrequently: true });
    window.__lab.pipeline.renderFrame(a.getContext('2d'), o.w, o.h, window.__lab.project, 0.5, {}); window.__lab.pipeline.renderFrame(b.getContext('2d'), o.w, o.h, window.__lab.project, 2.5, {});
    const pal = { bg: '#05060A', ink: '#F2F5FF', a: ['#35E0FF', '#FF3D9A', '#FFB547'] };
    for (const e of o.entries.filter(x => x.kind !== 'style')) {
      const run = q => (e.kind === 'effect' ? H.applyEffect(e.id, dx, a, { w: o.w, h: o.h, p: q, L: 6, seed: 7, pal }) : H.renderTransition(e.id, dx, a, b, q, { w: o.w, h: o.h, p: q, L: 6, seed: 7, pal }));
      let r = run(0); for (let k = 0; k < 800 && r === 'pending'; k++) { await sleep(25); r = run(0); }
      const ms = [];
      for (let i = -4; i < o.frames && r === 'ok'; i++) { const t0 = performance.now(); r = run(Math.max(0, i) / o.frames); dx.getImageData(0, 0, 1, 1); if (i >= 0) ms.push(performance.now() - t0); if (i % 8 === 7) await sleep(0); }
      const s = [...ms].sort((x, y) => x - y), q = f => (s.length ? +s[Math.min(s.length - 1, Math.ceil(s.length * f) - 1)].toFixed(2) : null);
      out.push({ id: e.id, kind: e.kind, p50: q(0.5), p95: q(0.95), max: s.length ? +s[s.length - 1].toFixed(2) : null, errors: r === 'ok' ? [] : [r] });
    }
    return { out, msPerMpx: window.__lab.kits.MS_PER_MPX };
  }, { w, h, frames, entries: inst.entries });
  const mpx = (w * h) / 1e6, unit = fx.msPerMpx || 3.2;
  const rows = [...report.scenes.map(s => ({ ...s, kind: 'style' })), ...fx.out].map(s => {
    const e = inst.entries.find(x => x.id === s.id) || {}, measured = s.p50 == null ? null : s.p50 / (unit * mpx), ratio = measured == null ? null : measured / (e.cost || 1);
    const verdict = report.software ? 'n/a (software GL)' : ratio == null ? 'no data' : ratio > 2 ? 'under-declared' : ratio < 0.33 ? 'over-declared' : 'ok';
    return { entry: s.id, kind: s.kind, p50: s.p50, p95: s.p95, declared: e.cost, measured: measured == null ? null : +measured.toFixed(2), ratio: ratio == null ? null : +ratio.toFixed(2), verdict, canary64: (inst.canary[s.id] || {}).ms64 ?? null, errors: (s.errors || []).join('; ') };
  });
  const result = { app: 'Motif 5', kind: 'kit-bench', kit: inst.kit, date: new Date().toISOString(), renderer: report.renderer || null, software: !!report.software, size: `${w}x${h}`, frames, msPerMpxCost1: unit, quarantined: inst.quarantined, rows, pageErrors: errors };
  const file = path.join(root, 'performance-review', `kit-bench-${inst.kit.id}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(`${result.renderer || 'unknown GPU'}${result.software ? ' (SOFTWARE: costs not judged)' : ''} · ${result.size} · ${inst.kit.name} ${inst.kit.version} → ${path.relative(root, file)}`);
  console.table(rows.map(r => ({ entry: r.entry, kind: r.kind, p50: r.p50, p95: r.p95, declared: r.declared, measured: r.measured, verdict: r.verdict, canary64: r.canary64 })));
  if (inst.quarantined.length) console.log(`Quarantined at install: ${inst.quarantined.join(', ')}`);
  const bad = rows.filter(r => r.errors || r.verdict === 'under-declared' || r.verdict === 'over-declared');
  if (errors.length) { console.error('Page errors:', errors); return 1; }
  if (rows.some(r => r.errors) || inst.quarantined.length) return 1;
  return strict && bad.length ? 1 : 0;
}
