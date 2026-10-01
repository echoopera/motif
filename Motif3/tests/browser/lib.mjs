// Shared helpers for the browser suites (visual, a11y, soak). Run with SOFTWARE_GL=1 for deterministic SwiftShader output and
// PLAYWRIGHT_MODULE=<path to playwright/index.mjs> when Playwright is not installed locally.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export const root = path.resolve(import.meta.dirname, '../..');
export const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
export const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
export const flag = k => process.argv.includes('--' + k);

export async function launch(extraArgs = []) {
  return chromium.launch({
    channel: process.env.CHROME_CHANNEL || undefined, headless: true,
    args: [...(process.env.SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist']), ...extraArgs],
  });
}

// Opens the app in a fresh context. External hosts (fonts, CDN muxers) are blocked so runs are hermetic and fast; the app
// is designed to work without them. `errors` collects uncaught page errors and console errors that are not blocked requests.
export async function openApp(browser, { file = 'motif5.html', viewport = { width: 1440, height: 900 }, context = {}, settle = 1200, pauseStage = true, initScript = null } = {}) {
  const ctx = await browser.newContext({ viewport, ...context });
  const page = await ctx.newPage(); const errors = [], consoleErrors = [], warnings = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_BLOCKED|net::ERR_/.test(m.text())) consoleErrors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  if (initScript) await page.addInitScript(initScript);
  await page.route(/^https?:/, r => r.abort());
  await page.goto(pathToFileURL(path.join(root, file)).href);
  await page.waitForFunction(() => window.__lab, null, { timeout: 30000 });
  await page.waitForTimeout(settle);
  if (pauseStage) await page.evaluate(() => window.__lab.stage.pause());
  return { ctx, page, errors, consoleErrors, warnings };
}

export async function gpuInfo(page) {
  return page.evaluate(() => { const g = window.__lab.kits.gpuStatus(); return { renderer: g.renderer || null, software: !!g.software, ua: navigator.userAgent, cores: navigator.hardwareConcurrency || null, memoryGB: navigator.deviceMemory || null }; });
}
export const rendererClass = gpu => (gpu.software || /swiftshader|llvmpipe|software/i.test(gpu.renderer || '') ? 'swiftshader' : 'real');

export function gitRev() { try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { return null; } }

// Tiny result collector used by the suites: records pass/fail/info lines and a JSON summary the verify runner can read.
// `known` = ids of documented, deliberately-open defects (docs/a11y-findings.md): they print KNOWN and do not fail the run.
export function suite(name, known = []) {
  const results = []; const t0 = Date.now(), knownSet = new Set(known);
  const api = {
    name, results,
    check(id, ok, detail = '', severity = 'major') {
      const isKnown = !ok && knownSet.has(id);
      results.push({ id, ok: !!ok || isKnown, known: isKnown, detail, severity }); console.log(`${ok ? 'PASS' : isKnown ? 'KNOWN' : 'FAIL'}  ${id}${detail ? ' — ' + detail : ''}`); return !!ok;
    },
    info(id, detail) { results.push({ id, ok: true, info: true, detail }); console.log(`INFO  ${id} — ${detail}`); },
    get failed() { return results.filter(r => !r.ok); },
    summary(extra = {}) { return { suite: name, passed: results.filter(r => r.ok && !r.info && !r.known).length, known: results.filter(r => r.known).length, failed: results.filter(r => !r.ok).length, ms: Date.now() - t0, ...extra, results }; },
  };
  return api;
}
