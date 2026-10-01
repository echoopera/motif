// Export + Deliver page check, run offline (every http(s) request is refused): MP4 / WebM / ZIP through the render queue with container header
// and duration checks, queue ordering, reload recovery (interrupted -> retry), hardware-preference fallback, capability matrix, the quick-export
// dialog, and the Deliver page UI. Prints real numbers; with SOFTWARE_GL=1 these are software GL + software encoders, not a real Mac.
//   SOFTWARE_GL=1 PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/export-check.mjs [motif7.html]
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const browser = await chromium.launch({ headless: true, args: process.env.SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const t00 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - t00) / 1000).toFixed(0)}s]`, ...a);
const report = {};
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const blocked = []; await context.route(/^https?:/, r => { blocked.push(r.request().url()); r.abort(); });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  const url = pathToFileURL(path.join(root, process.argv[2] || 'motif7.html')).href;
  const boot = async () => { await page.goto(url); await page.waitForFunction(() => window.__lab && window.__lab.queue); await page.waitForTimeout(800); };
  // A small, cheap project: one 2D style, 1 s loop at 12 fps = 12 frames, square 720 x 720.
  const smallProject = async (loop = 1) => page.evaluate(l => { const pr = __lab.project; pr.layers = [pr.layers[pr.layers.length - 1]]; pr.active = pr.layers[0].id; pr.finish.loop = l; pr.output.fps = 12; __lab.setProject(pr); __lab.setAspect('1x1'); }, loop);
  const waitJobs = (pred, ms = 240000) => page.waitForFunction(p => { const f = new Function('s', 'return ' + p); return f(__lab.queue.snapshot()); }, pred, { timeout: ms, polling: 250 });
  const probeBlob = (id) => page.evaluate(async id => {
    const blob = await __lab.queue.output(id); const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer()); const r = { size: blob.size, head: Array.from(head) };
    if (/^video\//.test(blob.type)) { const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(blob); await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error('video error ' + (v.error && v.error.message))); setTimeout(() => rej(new Error('metadata timeout')), 15000); }); r.duration = v.duration; r.w = v.videoWidth; r.h = v.videoHeight; }
    return r;
  }, id);
  const ascii = (a, o, n) => String.fromCharCode(...a.slice(o, o + n));

  await boot(); await smallProject();
  const caps = await page.evaluate(() => __lab.probe()); report.caps = { codecs: caps.codecs, webmAlpha: caps.webmAlpha, aac: caps.aac, opus: caps.opus };
  log('caps', JSON.stringify(report.caps));
  const gpu = await page.evaluate(() => ({ ...__lab.api.kits.gpuStatus() })); report.softwareGl = !!gpu.software; log('gpu', gpu.renderer, 'software=' + gpu.software);

  // ---- 1. capability matrix: codec x resolution x alpha
  const matrix = await page.evaluate(() => __lab.capabilityMatrix('16x9', 30));
  assert.equal(matrix.rows.length, 5 * 4, 'five codecs by four sizes');
  for (const r of matrix.rows) assert.ok(typeof r.supported === 'boolean' && typeof r.hardware === 'boolean' && typeof r.alpha === 'boolean');
  report.matrix = Object.fromEntries(matrix.codecs.map(c => [c.id, matrix.rows.filter(r => r.codec === c.id).map(r => `${r.tier}:${r.supported ? (r.hardware ? 'hw' : 'sw') : '-'}${r.alpha ? '+a' : ''}`).join(' ')]));
  log('matrix', JSON.stringify(report.matrix));

  // ---- 2. no external requests: only fonts may have been attempted
  const nonFont = () => blocked.filter(u => !/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u));
  assert.deepEqual(nonFont(), [], 'no non-font network requests');

  // ---- 3. Deliver page: tab, presets, warnings, keyboard
  await page.click('[data-tab="deliver"]'); await page.waitForSelector('.dl-card'); await page.waitForSelector('.dl[data-caps="1"]');
  const cards = await page.$$eval('.dl-card', els => els.map(e => ({ id: e.dataset.id, name: e.querySelector('[data-f=name]').textContent, add: !e.querySelector('[data-act=add]').disabled, warns: [...e.querySelectorAll('.dl-warn')].map(w => w.textContent) })));
  assert.deepEqual(cards.map(c => c.id), ['youtube-1080', 'hevc-4k', 'social-vertical', 'transparent-webm', 'png-sequence', 'master']);
  for (const c of cards) { const hasAvc = !!caps.codecs.avc, hasHevc = !!caps.codecs.hevc; if (['youtube-1080', 'social-vertical', 'master'].includes(c.id)) assert.equal(c.add, hasAvc, c.id + ' availability follows H.264 support'); if (c.id === 'hevc-4k') assert.equal(c.add, hasHevc); }
  report.presetAvailability = Object.fromEntries(cards.map(c => [c.id, c.add ? 'ok' : 'blocked: ' + c.warns[0]]));
  await page.focus('.dl-card [data-act=edit]'); await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.activeElement.closest('.dl-card') !== null), 'Tab moves through preset buttons');
  assert.ok(await page.$('.dl-sec .dl-empty'), 'designed empty state is shown for an empty queue');

  // edit transparent-webm to 720 and make a new custom MP4 preset, through the UI with the keyboard-reachable controls
  await page.click('.dl-card[data-id="transparent-webm"] [data-act=edit]'); await page.selectOption('#dl-ed-tier', '720'); await page.click('[data-act=save-preset]');
  assert.ok(await page.$('.dl-card[data-id="transparent-webm"] .dl-chip:not([hidden])'), 'edited chip on a built-in');
  const mp4codec = caps.codecs.avc ? 'avc' : caps.codecs.av1 ? 'av1' : 'vp9';
  await page.click('[data-act=new-preset]'); await page.fill('#dl-ed-name', 'Test MP4'); await page.selectOption('#dl-ed-format', 'mp4'); await page.selectOption('#dl-ed-codec', mp4codec); await page.selectOption('#dl-ed-tier', '720'); await page.click('[data-act=save-preset]');
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const p = __m_render_queue.listPresets().find(x => x.id === 'png-sequence'); __m_render_queue.savePreset({ ...p, tier: 720 }); });
  await page.click('[data-tab="layer"]'); await page.click('[data-tab="deliver"]'); // panel re-runs on visit; the edits must survive
  const customId = await page.evaluate(() => __m_render_queue.listPresets().find(p => p.name === 'Test MP4').id);

  // ---- 4. queue three jobs, verify sequential completion + container bytes + duration
  await page.evaluate(() => { window.__ev = []; __lab.queue.subscribe(s => { const r = s.running; const last = window.__ev[window.__ev.length - 1]; if (r && (!last || last.id !== r.id)) window.__ev.push({ id: r.id, t: Date.now(), concurrent: s.jobs.filter(j => j.status === 'running').length }); }); });
  await page.click(`.dl-card[data-id="${customId}"] [data-act=add]`); await page.click('.dl-card[data-id="transparent-webm"] [data-act=add]'); await page.click('.dl-card[data-id="png-sequence"] [data-act=add]');
  await page.waitForSelector('.dl-job'); assert.equal((await page.$$('.dl-job')).length >= 1, true);
  const tQ = Date.now(); log('queued 3 jobs');
  await waitJobs("s.jobs.length === 3 && s.jobs.every(j => j.status === 'done' || j.status === 'error')");
  const snap = await page.evaluate(() => __lab.queue.snapshot()); log('queue done in', ((Date.now() - tQ) / 1000).toFixed(1) + 's');
  for (const j of snap.jobs) assert.equal(j.status, 'done', `${j.name} ${j.presetName}: ${j.error}`);
  const starts = snap.jobs.map(j => j.startedAt), ends = snap.jobs.map(j => j.finishedAt);
  assert.ok(starts[1] >= ends[0] && starts[2] >= ends[1], 'jobs ran strictly one after another');
  const ev = await page.evaluate(() => window.__ev); assert.deepEqual(ev.map(e => e.id), snap.jobs.map(j => j.id), 'started in the order added'); assert.ok(ev.every(e => e.concurrent === 1));
  const outs = {};
  for (const j of snap.jobs) {
    const pr = await probeBlob(j.id); outs[j.presetName] = { ...pr, head: undefined, size: pr.size, codec: j.output.codec, container: j.output.container, renderMs: j.output.renderMs, renderFps: j.output.renderFps, storage: j.output.storage, stats: j.output.stats };
    if (j.output.container === 'MP4') { assert.equal(ascii(pr.head, 4, 4), 'ftyp', 'MP4 ftyp box'); assert.ok(Math.abs(pr.duration - 1) < 0.15, 'MP4 duration ' + pr.duration); assert.equal(pr.w, 720); }
    else if (j.output.container === 'WEBM') { assert.deepEqual(pr.head.slice(0, 4), [0x1A, 0x45, 0xDF, 0xA3], 'EBML header'); assert.ok(Math.abs(pr.duration - 1) < 0.15, 'WebM duration ' + pr.duration); }
    else { assert.equal(ascii(pr.head, 0, 2), 'PK', 'ZIP'); }
    assert.ok(j.output.size > 1000);
  }
  report.queueOutputs = outs; log('outputs', JSON.stringify(outs));
  await page.waitForFunction(() => document.querySelectorAll('.dl-out').length === 3);
  const dl = page.waitForEvent('download'); await page.click('.dl-out:nth-child(1) [data-act=download]'); const d = await dl; const dpath = await d.path(); const dbytes = fs.readFileSync(dpath).subarray(0, 4);
  assert.ok(dbytes[0] === 0x50 || dbytes[0] === 0x1A || dbytes.subarray(0, 4).toString('latin1') !== '', 'download has content'); report.downloadedName = d.suggestedFilename();
  assert.deepEqual(nonFont(), [], 'still no non-font network requests after exporting (offline exports)');

  // ---- 5. quick-export dialog still works unchanged, and gains Add to queue
  await page.evaluate(() => __lab.queue.pause());
  await page.keyboard.press('x'); await page.waitForSelector('#exportDlg[open]'); await page.waitForFunction(() => document.querySelectorAll('#exCodec option').length > 0);
  await page.click('#formats .fmt[data-f=webm]'); await page.selectOption('#exTier', '720'); await page.selectOption('#exLoops', '1');
  await page.click('#exQueue'); await page.waitForFunction(() => !document.getElementById('exportDlg').open);
  assert.equal(await page.evaluate(() => __lab.queue.snapshot().jobs.filter(j => j.status === 'queued').length), 1, 'dialog Add to queue adds a job (queue paused)');
  const qid = await page.evaluate(() => __lab.queue.snapshot().jobs.find(j => j.status === 'queued').id); await page.evaluate(id => __lab.queue.cancel(id), qid); await page.evaluate(() => __lab.queue.resume());
  await page.evaluate(() => __lab.openExport()); await page.click('#formats .fmt[data-f=webm]'); await page.selectOption('#exTier', '720');
  const dl2 = page.waitForEvent('download', { timeout: 200000 }); await page.click('#exRender'); const d2 = await dl2; await page.waitForFunction(() => /Saved|Rendered/.test(document.getElementById('exStatus').textContent), null, { timeout: 30000 });
  report.dialogStatus = await page.textContent('#exStatus'); log('dialog', report.dialogStatus); assert.match(report.dialogStatus, /frames\/s|Saved/);
  assert.equal(ascii([...fs.readFileSync(await d2.path()).subarray(0, 4)], 0, 0), ''); assert.deepEqual([...fs.readFileSync(await d2.path()).subarray(0, 4)], [0x1A, 0x45, 0xDF, 0xA3]);
  await page.click('#exCancel'); await page.waitForFunction(() => !document.getElementById('exportDlg').open);

  // ---- 6. hardware preference falls back: an encoder that rejects prefer-hardware at configure() still yields a file
  const hw = await page.evaluate(async () => {
    const orig = VideoEncoder.isConfigSupported.bind(VideoEncoder), cfg = VideoEncoder.prototype.configure; let hwTried = 0, swUsed = 0;
    VideoEncoder.isConfigSupported = async c => orig({ ...c, hardwareAcceleration: 'no-preference' }).then(r => ({ ...r, config: c }));
    VideoEncoder.prototype.configure = function (c) { if (c.hardwareAcceleration === 'prefer-hardware') { hwTried++; throw new DOMException('hardware encoder unavailable', 'NotSupportedError'); } swUsed++; return cfg.call(this, c); };
    try { const r = await __lab.exportNow({ format: 'webm', codec: 'vp9', fps: 12, withAudio: false }); return { ok: r.size > 1000, hwTried, swUsed, hardwareRequested: r.stats.hardwareRequested }; }
    finally { VideoEncoder.isConfigSupported = orig; VideoEncoder.prototype.configure = cfg; }
  });
  assert.ok(hw.ok && hw.hwTried === 1 && hw.swUsed === 1 && hw.hardwareRequested === false, JSON.stringify(hw)); report.hardwareFallback = hw; log('hw fallback', JSON.stringify(hw));

  // ---- 7. encode throughput + frame path comparison (same project, 12 frames)
  const paths = {};
  for (const fs_ of ['i420', 'canvas']) {
    const r = await page.evaluate(async fsrc => { const r = await __lab.exportNow({ format: 'webm', codec: 'vp9', fps: 12, withAudio: false, frameSource: fsrc }); const blob = __lab.lastBlob;
      const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(blob); await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('decode')); }); v.currentTime = 0.5; await new Promise(res => { v.onseeked = res; }); const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.drawImage(v, 0, 0, 64, 64);
      return { stats: r.stats, color: r.colorTag, px: Array.from(x.getImageData(0, 0, 64, 64).data) }; }, fs_);
    paths[fs_] = r; assert.equal(r.stats.framePath, fs_);
  }
  let diff = 0; const a = paths.i420.px, b = paths.canvas.px; let n = 0; for (let i = 0; i < a.length; i += 4) { for (let k = 0; k < 3; k++) { diff += Math.abs(a[i + k] - b[i + k]); n++; } }
  report.framePaths = { i420: { fps: paths.i420.stats.fps, avgMs: paths.i420.stats.avgMs, tag: paths.i420.color }, canvas: { fps: paths.canvas.stats.fps, avgMs: paths.canvas.stats.avgMs, tag: paths.canvas.color }, decodedMeanAbsDiff: +(diff / n).toFixed(2) };
  log('frame paths', JSON.stringify(report.framePaths));
  { let lum = 0; for (let i = 0; i < a.length; i += 4) lum += a[i] + a[i + 1] + a[i + 2]; report.framePaths.meanLuma = +(lum / (a.length / 4 * 3)).toFixed(1); assert.ok(report.framePaths.meanLuma > 4, 'compared frame is not black'); }
  assert.ok(report.framePaths.decodedMeanAbsDiff < 12, 'both frame paths decode to similar pixels');

  // ---- 8. reload mid-job: running -> interrupted, queued waits paused, retry completes
  await page.evaluate(() => __lab.queue.clearFinished()); await smallProject(2);
  await page.evaluate(id => { const q = __lab.queue, p = __m_render_queue.listPresets().find(x => x.id === id); q.add(__lab.project, p, { aspect: '1x1' }); q.add(__lab.project, p, { aspect: '1x1' }); }, customId);
  await waitJobs("s.running && s.running.progress > 0.08", 120000);
  await page.reload(); await page.waitForFunction(() => window.__lab && window.__lab.queue); await page.waitForFunction(() => __lab.queue.snapshot().ready, null, { timeout: 15000 });
  let s2 = await page.evaluate(() => __lab.queue.snapshot()); report.afterReload = s2.jobs.map(j => j.status).join(',') + ' paused=' + s2.paused + '/' + s2.pauseReason + ' persistent=' + s2.persistent + ' storage=' + s2.storage; log('after reload', report.afterReload);
  assert.deepEqual(s2.jobs.map(j => j.status), ['interrupted', 'queued']); assert.ok(s2.paused && s2.pauseReason === 'reload');
  await page.click('[data-tab="deliver"]'); await page.waitForSelector('.dl-job[data-status=interrupted]');
  assert.ok(await page.$('.dl-banner [data-act=retry-all]'), 'interrupted banner offers Retry all'); assert.ok(await page.$('.dl-banner [data-act=resume]'), 'paused banner offers Resume');
  assert.ok((await page.textContent('.dl-job[data-status=interrupted] .dl-chip')).includes('Interrupted'));
  await page.click('[data-act=retry-all]'); await page.click('.dl-banner [data-act=resume]');
  await waitJobs("s.jobs.length === 2 && s.jobs.every(j => j.status === 'done')", 240000);
  const s3 = await page.evaluate(() => __lab.queue.snapshot()); assert.equal(s3.jobs[0].attempts, 2); report.afterRetry = s3.jobs.map(j => `${j.status}/attempts=${j.attempts}`).join(',');
  log('after retry', report.afterRetry);
  assert.deepEqual(nonFont(), [], 'offline throughout');
  assert.equal(errors.length, 0, errors.join('\n'));
  report.pageErrors = 0; report.blockedHosts = [...new Set(blocked.map(u => new URL(u).host))];
  console.log(JSON.stringify(report, null, 1)); console.log('export OK');
} finally { await browser.close(); }
