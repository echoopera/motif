// Soak / resilience test: repeated UI churn, leak accounting, WebGL context loss and hidden-tab recovery.
//   SOFTWARE_GL=1 node tests/browser/soak.mjs [--minutes 0.5] [--switches 200] [--dialogs 50] [--heap-limit-mb 64]
// Numbers printed here come from the device named in the summary. Software GL (SwiftShader) is NOT representative of a real GPU:
// it proves the lifecycle (no errors, no leaks, recovery works), not performance.
import fs from 'node:fs';
import path from 'node:path';
import { root, arg, launch, openApp, gpuInfo, rendererClass, gitRev, suite } from './lib.mjs';

const MINUTES = +arg('minutes', 0.5), SWITCHES = +arg('switches', 200), DIALOGS = +arg('dialogs', 50), HEAP_LIMIT = +arg('heap-limit-mb', 64);
const s = suite('soak'), outDir = path.join(root, 'tests/soak-out'); fs.mkdirSync(outDir, { recursive: true });

// Counts runtime-created canvases / WebGL contexts / video elements / AudioContexts through WeakRefs so GC'd ones are not leaks.
const INSTRUMENT = `(() => {
  const reg = window.__inst = { created: { canvas: 0, video: 0, gl: 0, ctx2d: 0, audio: 0 }, canvases: [], videos: [], gls: [] };
  const mk = Document.prototype.createElement;
  Document.prototype.createElement = function (tag, o) { const e = mk.call(this, tag, o), t = String(tag).toLowerCase(); if (t === 'canvas') { reg.created.canvas++; reg.canvases.push(new WeakRef(e)); } else if (t === 'video') { reg.created.video++; reg.videos.push(new WeakRef(e)); } return e; };
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) { const c = gc.call(this, type, ...a); if (c && !this.__t) { this.__t = type; if (/webgl/.test(type)) { reg.created.gl++; reg.gls.push(new WeakRef(this)); } else if (type === '2d') reg.created.ctx2d++; } return c; };
  if (window.AudioContext) { const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); reg.created.audio++; } }; }
  window.__live = () => { const alive = l => l.map(w => w.deref()).filter(Boolean); const cv = alive(reg.canvases), gl = alive(reg.gls), v = alive(reg.videos);
    return { canvasesLive: cv.length, canvasesAttached: cv.filter(c => c.isConnected).length, glLive: gl.length, glAttached: gl.filter(c => c.isConnected).length, videosLive: v.length, created: { ...reg.created } }; };
})()`;

const browser = await launch(['--js-flags=--expose-gc']);
const summary = { device: null, phases: {} };
let exit = 0;
try {
  const app = await openApp(browser, { viewport: { width: 800, height: 520 }, pauseStage: false, initScript: INSTRUMENT, settle: 1500 });
  const { page } = app, cdp = await app.ctx.newCDPSession(page); await cdp.send('Performance.enable');
  const gpu = await gpuInfo(page), cls = rendererClass(gpu);
  summary.device = { ...gpu, class: cls, browser: browser.version(), revision: gitRev() };
  console.log(`device: ${gpu.renderer} (${cls}) · ${gpu.cores} cores · ${gpu.memoryGB ?? '?'} GB · ${browser.version()}${cls === 'swiftshader' ? ' · SOFTWARE GL: lifecycle evidence only, not performance' : ''}`);

  const sample = async () => {
    for (let i = 0; i < 2; i++) await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(150);
    await page.evaluate(() => { try { gc(); } catch {} }); await page.waitForTimeout(100);
    const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
    const live = await page.evaluate(() => window.__live()), mem = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : null));
    const cs = await page.evaluate(() => { const c = window.__lab.stage.cacheStats(); return { cacheMB: +(c.bytes / 1048576).toFixed(1), cacheBudgetMB: +(c.budget / 1048576).toFixed(1), cacheFrames: c.frames }; });
    return { ...cs, heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), perfMemoryMB: mem == null ? null : +(mem / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners, documents: m.Documents, ...live };
  };
  const settleFrames = n => page.evaluate(n => new Promise(r => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
  const gpuState = () => page.evaluate(() => { const g = window.__lab.kits.gpuStatus(); return { lost: g.lost, resets: g.resets, ok: g.ok }; });

  // ---- warm-up so one-time allocations (shader compiles, caches) are not counted as growth ----
  await page.evaluate(() => { window.__lab.stage.setQuality('quarter'); window.__lab.stage.play(); });
  const ids = await page.evaluate(() => window.__lab.styles.map(s => s.id));
  for (const id of ids.slice(0, 6)) { await page.evaluate(id => window.__lab.selectStyle(id), id); await settleFrames(3); }
  const base = await sample(); summary.baseline = base; console.log('baseline', JSON.stringify(base));

  // ---- 1. style switches ----
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const heapSeries = [base.heapMB]; const t1 = Date.now();
  for (let i = 0; i < SWITCHES; i++) {
    await page.evaluate(id => window.__lab.selectStyle(id), ids[Math.floor(rnd() * ids.length)]); await settleFrames(2);
    if ((i + 1) % 50 === 0) { const m = await sample(); heapSeries.push(m.heapMB); console.log(`  switches ${i + 1}/${SWITCHES}: heap ${m.heapMB} MB, GL live ${m.glLive}, canvases live ${m.canvasesLive}, listeners ${m.listeners}`); }
  }
  const afterSwitch = await sample(); summary.phases.styleSwitches = { count: SWITCHES, ms: Date.now() - t1, heapSeriesMB: heapSeries, after: afterSwitch };
  s.check('soak:style-switches:no-page-errors', app.errors.length + app.consoleErrors.length === 0, `${SWITCHES} switches; ${app.errors.concat(app.consoleErrors).slice(0, 3).join(' | ')}`);
  s.check('soak:style-switches:heap-bounded', afterSwitch.heapMB - base.heapMB <= HEAP_LIMIT, `heap ${base.heapMB} -> ${afterSwitch.heapMB} MB after forced GC (limit +${HEAP_LIMIT} MB); series ${heapSeries.join(', ')}`);
  s.check('soak:style-switches:no-canvas-leak', afterSwitch.canvasesLive - base.canvasesLive <= 12, `live canvases ${base.canvasesLive} -> ${afterSwitch.canvasesLive} (${afterSwitch.created.canvas} created in total, ${afterSwitch.canvasesAttached} attached)`);
  s.check('soak:style-switches:no-webgl-context-leak', afterSwitch.glLive - base.glLive <= 2 && afterSwitch.glLive <= 8, `live WebGL contexts ${base.glLive} -> ${afterSwitch.glLive} (${afterSwitch.created.gl} ever created; Chrome drops the oldest above 16)`);
  s.check('soak:style-switches:no-video-leak', afterSwitch.videosLive - base.videosLive <= 0, `live <video> ${base.videosLive} -> ${afterSwitch.videosLive}`);
  s.check('soak:style-switches:dom-listeners-bounded', afterSwitch.listeners - base.listeners <= 500 && afterSwitch.nodes - base.nodes <= 3000, `nodes ${base.nodes} -> ${afterSwitch.nodes}, listeners ${base.listeners} -> ${afterSwitch.listeners}`);
  s.check('soak:no-too-many-contexts-warning', !app.warnings.some(w => /too many active webgl contexts/i.test(w)), app.warnings.filter(w => /webgl/i.test(w)).slice(0, 2).join(' | '));

  // ---- 2. export dialog open/close ----
  const d0 = await sample(), t2 = Date.now(); let stuck = 0;
  for (let i = 0; i < DIALOGS; i++) {
    await page.evaluate(() => window.__lab.openExport()); await page.waitForTimeout(40);
    if (!(await page.evaluate(() => document.getElementById('exportDlg').open))) stuck++;
    await page.keyboard.press('Escape'); await page.waitForTimeout(25);
    if (await page.evaluate(() => document.getElementById('exportDlg').open)) stuck++;
  }
  const d1 = await sample(); summary.phases.exportDialog = { count: DIALOGS, ms: Date.now() - t2, before: d0, after: d1 };
  s.check('soak:export-dialog:opens-and-closes', stuck === 0, `${DIALOGS} open/Esc cycles, ${stuck} wrong states`);
  s.check('soak:export-dialog:no-listener-growth', d1.listeners - d0.listeners <= DIALOGS * 2 && d1.nodes - d0.nodes <= 1500, `listeners ${d0.listeners} -> ${d1.listeners}, nodes ${d0.nodes} -> ${d1.nodes} over ${DIALOGS} cycles`);
  s.check('soak:export-dialog:heap-bounded', d1.heapMB - d0.heapMB <= 16, `heap ${d0.heapMB} -> ${d1.heapMB} MB`);
  s.check('soak:export-dialog:no-page-errors', app.errors.length + app.consoleErrors.length === 0, app.errors.concat(app.consoleErrors).slice(0, 3).join(' | '));

  // ---- 3. timed churn: play/pause, resize, aspect, tab switching ----
  const deadline = Date.now() + MINUTES * 60000, aspects = ['16x9', '9x16', '1x1', '4x5', '4x3', '21x9'], tabs = ['layer', 'colour', 'finish', 'audio', 'looks', 'kits'], sizes = [[800, 520], [700, 560], [900, 600], [640, 700], [800, 520]];
  let iter = 0; const t3 = Date.now(), series = []; let nextSample = Date.now() + 10000;
  while (Date.now() < deadline) {
    const i = iter++;
    await page.evaluate(([a, t]) => { const l = window.__lab; l.setAspect(a); l.setTab(t); l.stage.playing ? l.stage.pause() : l.stage.play(); }, [aspects[i % 6], tabs[i % 6]]);
    if (i % 3 === 0) await page.setViewportSize({ width: sizes[i % sizes.length][0], height: sizes[i % sizes.length][1] });
    if (i % 5 === 0) await page.evaluate(id => window.__lab.selectStyle(id), ids[Math.floor(rnd() * ids.length)]);
    await settleFrames(2);
    if (Date.now() > nextSample) { nextSample = Date.now() + 10000; const m = await sample(); series.push({ t: Math.round((Date.now() - t3) / 1000), heapMB: m.heapMB, glLive: m.glLive, canvasesLive: m.canvasesLive }); }
  }
  await page.evaluate(() => window.__lab.stage.play()); await page.setViewportSize({ width: 800, height: 520 });
  const afterChurn = await sample(); summary.phases.churn = { minutes: MINUTES, iterations: iter, series, after: afterChurn };
  console.log(`churn: ${iter} iterations in ${((Date.now() - t3) / 1000).toFixed(0)} s; heap ${afterSwitch.heapMB} -> ${afterChurn.heapMB} MB`);
  s.check('soak:churn:no-page-errors', app.errors.length + app.consoleErrors.length === 0, `${iter} iterations of play/pause + resize + aspect + tab; ${app.errors.concat(app.consoleErrors).slice(0, 3).join(' | ')}`);
  s.check('soak:churn:heap-bounded', afterChurn.heapMB - afterSwitch.heapMB <= HEAP_LIMIT, `heap ${afterSwitch.heapMB} -> ${afterChurn.heapMB} MB (limit +${HEAP_LIMIT})`);
  s.check('soak:render-cache-bounded', afterChurn.cacheMB <= afterChurn.cacheBudgetMB && afterSwitch.cacheMB <= afterSwitch.cacheBudgetMB, `render cache ${afterChurn.cacheMB} MB of ${afterChurn.cacheBudgetMB} MB budget (${afterChurn.cacheFrames} frames) after the churn`);
  s.check('soak:churn:no-canvas-or-context-growth', afterChurn.canvasesLive - afterSwitch.canvasesLive <= 12 && afterChurn.glLive <= Math.max(afterSwitch.glLive, 8), `canvases ${afterSwitch.canvasesLive} -> ${afterChurn.canvasesLive}, GL contexts ${afterSwitch.glLive} -> ${afterChurn.glLive}`);

  // ---- 4. WebGL context loss ----
  {
    await page.evaluate(() => { const l = window.__lab; l.setAspect('16x9'); l.stage.pause(); });
    await page.evaluate(() => { const T = window.__lab.api.timeline; const p = T.newProject('neuro/mitosis'); p.finish = { ...p.finish, shutter: 0, glow: 0.7, chroma: 0.3 }; window.__lab.setProject(p); });
    await settleFrames(4);
    const render = () => page.evaluate(() => { try { const r = window.__lab.renderAt(window.__lab.project, 2, 96, 54); let sum = 0, nz = 0; for (let i = 0; i < r.data.length; i += 4) { sum += r.data[i] + r.data[i + 1] + r.data[i + 2]; if (r.data[i] + r.data[i + 1] + r.data[i + 2] > 12) nz++; } return { sum, nz, engines: r.info.engines.join('+'), post: r.info.post }; } catch (e) { return { error: String(e && e.message || e) }; } });
    const before = await render(); s.check('contextloss:renders-before', !before.error && before.nz > 100, JSON.stringify(before));
    const canv = await page.evaluate(() => window.__inst && (() => { const out = []; window.__inst.gls.forEach((w, i) => { const c = w.deref(); if (c && c.isConnected !== undefined) out.push(i); }); return out.length; })());
    const lose = await page.evaluate(() => { const res = []; window.__inst.gls.forEach((w, i) => { const c = w.deref(); if (!c) return; const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return; const ext = gl.getExtension('WEBGL_lose_context'); if (!ext) return; res.push({ i, w: c.width, h: c.height, attached: c.isConnected }); window.__lostCtx = window.__lostCtx || []; window.__lostCtx.push({ c, ext, gl }); }); window.__lostCtx.forEach(x => x.ext.loseContext()); return res; });
    summary.phases.contextLoss = { contexts: lose };
    s.info('contextloss:contexts', `${lose.length} live WebGL canvases lost: ${lose.map(x => `${x.w}x${x.h}${x.attached ? ' attached' : ' offscreen'}`).join(', ')} (of ${canv})`);
    await page.waitForTimeout(300);
    const during = await render(); s.check('contextloss:no-exception-while-lost', !during.error, JSON.stringify(during));
    const lostState = await gpuState(); s.info('contextloss:state-while-lost', JSON.stringify(lostState));
    // allow the app's own restore path (kit runtime asks the browser to restore after 1.5 s); then restore any context the app does not restore itself
    await page.waitForTimeout(2600);
    const isLost = () => page.evaluate(() => window.__lostCtx.map(x => x.gl.isContextLost()));
    const stillLost = await isLost(); const appRestored = stillLost.filter(x => !x).length;
    await page.evaluate(() => window.__lostCtx.forEach(x => { if (x.gl.isContextLost()) try { x.ext.restoreContext(); } catch {} })); await page.waitForTimeout(800);
    summary.phases.contextLoss.restoredByApp = appRestored; summary.phases.contextLoss.total = stillLost.length;
    s.check('contextloss:app-restores-its-contexts', appRestored === stillLost.length, `${appRestored}/${stillLost.length} contexts were restored by the app's own handler; the rest only after the test called restoreContext() (no webglcontextlost handler => browser cannot restore after a real GPU reset)`);
    let after = null; for (let i = 0; i < 6; i++) { after = await render(); if (!after.error && after.nz > 100) break; await page.waitForTimeout(500); }
    s.check('contextloss:renders-after-restore', !after.error && after.nz > 100, JSON.stringify(after));
    s.check('contextloss:output-matches-before', after && before && after.sum === before.sum, `pixel sum before ${before.sum} after ${after && after.sum} (post path ${before.post} -> ${after && after.post})`);
    const gs = await gpuState(); s.check('contextloss:gpu-status-recovered', !gs.lost && gs.ok, JSON.stringify(gs));
    await page.evaluate(() => window.__lab.stage.play()); await page.waitForTimeout(800); const t0 = await page.evaluate(() => window.__lab.stage.time); await page.waitForTimeout(700); const t1b = await page.evaluate(() => window.__lab.stage.time);
    s.check('contextloss:playback-continues', t1b !== t0, `stage time ${t0} -> ${t1b}`);
    s.check('contextloss:no-page-errors', app.errors.length === 0, app.errors.join(' | '));
  }

  // ---- 5. hidden tab ----
  {
    await page.evaluate(() => { window.__lab.stage.play(); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(800);
    const hid = await page.evaluate(() => ({ hidden: document.hidden, errs: 0 }));
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(800); const ta = await page.evaluate(() => window.__lab.stage.time); await page.waitForTimeout(700); const tb = await page.evaluate(() => window.__lab.stage.time);
    s.check('hidden-tab:simulated-visibility-event', hid.hidden && ta !== tb && app.errors.length === 0, `hidden handler ran without errors; playback resumed (time ${ta} -> ${tb}). This is a simulated visibilitychange, not a real background tab`);
    try {
      await cdp.send('Page.setWebLifecycleState', { state: 'frozen' }); await page.waitForTimeout(500); await cdp.send('Page.setWebLifecycleState', { state: 'active' }); await page.waitForTimeout(1000);
      const tc = await page.evaluate(() => window.__lab.stage.time); await page.waitForTimeout(700); const td = await page.evaluate(() => window.__lab.stage.time);
      s.check('hidden-tab:freeze-and-resume', tc !== td && app.errors.length === 0, `CDP Page.setWebLifecycleState frozen -> active; playback advancing again (${tc} -> ${td})`);
    } catch (e) { s.info('hidden-tab:freeze-and-resume', `not run: ${String(e.message).slice(0, 120)}`); }
    const gs = await gpuState(); s.check('hidden-tab:gpu-ok', gs.ok && !gs.lost, JSON.stringify(gs));
  }

  const fin = await sample(); summary.final = fin;
  s.check('soak:final:no-page-errors', app.errors.length + app.consoleErrors.length === 0, app.errors.concat(app.consoleErrors).join(' | '));
  summary.consoleWarnings = app.warnings.slice(0, 10);
} finally { await browser.close(); }

const sum = s.summary(summary); fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(sum, null, 1));
console.log(`\nsoak: ${sum.passed} passed, ${sum.failed} failed (${(sum.ms / 1000).toFixed(0)} s) on ${summary.device && summary.device.renderer}`);
process.exit(sum.failed ? 1 : 0);
