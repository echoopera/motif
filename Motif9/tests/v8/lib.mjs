// Shared helpers for the Motif 8 tests. Set PLAYWRIGHT_MODULE to your Playwright entry point when it is not installed locally,
// and MOTIF_CHROMIUM to a Chromium binary if Playwright's own is not downloaded. Browser suites use software GL (SwiftShader).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { createRequire } from 'node:module';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export async function playwright() {
  if (process.env.PLAYWRIGHT_MODULE) return import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
  const require = createRequire(import.meta.url);
  for (const base of [root, path.join(root, 'sdk/motif-kit-sdk')]) { try { return require(require.resolve('playwright', { paths: [base] })); } catch (e) { /* try the next place */ } }
  throw new Error('Playwright not found: npm i playwright, or set PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs');
}
export function readKit(dir) {
  const files = {}; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(glsl|json|md|txt|svg)$/i.test(f)) files[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
  walk(dir); const manifest = JSON.parse(files['manifest.json']); delete files['manifest.json']; return { manifest, files };
}
export async function launch() {
  const pw = await playwright(), { chromium } = pw.chromium ? pw : (pw.default || pw);
  const exe = process.env.MOTIF_CHROMIUM;
  return chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files'] });
}
export async function openApp(browser, { query = '', viewport = { width: 1440, height: 900 }, wait = 2500, file = path.join(root, 'Motif.html') } = {}) {
  const page = await browser.newPage({ viewport }); const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); }); page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 300)));
  await page.goto(pathToFileURL(file).href + query); await page.waitForTimeout(wait); return { page, errors };
}
export function suite(name) {
  let pass = 0, fail = 0; const failures = [];
  const t = (label, ok, extra) => { if (ok) pass++; else { fail++; failures.push(label); console.log(`  FAIL  ${label}${extra === undefined ? '' : '  ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 300)}`); } };
  const done = () => { console.log(`${name}: ${pass} passed, ${fail} failed`); process.exitCode = fail ? 1 : 0; return { pass, fail, failures }; };
  return { t, done };
}
