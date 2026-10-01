// Frame-time benchmark and budget gate for Motif 5.
//   node tools/bench.mjs                      all styles at 1280x720, writes performance-review/bench-<date>.json
//   node tools/bench.mjs --budget             also fail (exit 1) when a style's p95 exceeds tools/budgets.json
//   node tools/bench.mjs --styles a,b --size 1920x1080 --frames 90 --file motif5.html
// Run on a machine with a real GPU for meaningful numbers; software GL (SwiftShader) is flagged and the budget gate is skipped.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const file = arg('file', 'motif5.html'), [w, h] = String(arg('size', '1280x720')).split('x').map(Number), frames = +arg('frames', 60);
const styles = arg('styles', null), gate = !!arg('budget', false);
const budgets = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'budgets.json'), 'utf8'));
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || undefined, headless: true, args: process.env.SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root, file)).href); await page.waitForFunction(() => window.__lab, null, { timeout: 30000 }); await page.waitForTimeout(1500);
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
} finally { await browser.close(); }
process.exit(code);
