// Media pipeline check (OPFS pool, WebCodecs decode, Media page). Browser test: needs Playwright + Chromium + ffmpeg.
//   SOFTWARE_GL=1 PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tests/browser/media-check.mjs [motif7.html]
// Fixtures are generated locally with ffmpeg (VP9 in MP4: the Chromium builds Playwright ships cannot decode H.264).
// Software-GL timings printed here are NOT representative of real hardware; they only prove the paths run.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import http from 'node:http';
import { execFileSync } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '../..');
const file = path.resolve(root, process.argv[2] || 'motif7.html');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motif-media-'));
const ff = (...a) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { cwd: tmp });
const fx = { idx: path.join(tmp, 'idx.mp4'), idxu: path.join(tmp, 'idx-untagged.mp4'), long: path.join(tmp, 'long.mp4'), rot: path.join(tmp, 'rot.mp4') };
const BT709 = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
// idx: frame N is flat colour r = 5N, g = 3N (24 fps, GOP 12), so a decoded frame names its own index. Tagged BT.709.
const GEQ = "nullsrc=size=320x180:rate=24,format=rgb24,geq=r='mod(N*5,256)':g='mod(N*3,256)':b=100";
ff('-f', 'lavfi', '-i', GEQ + ',scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-t', '2', '-c:v', 'libvpx-vp9', '-g', '12', '-b:v', '4M', ...BT709, fx.idx);
// the same picture with no colour tags (BT.601 matrix): Chrome's <video> and WebCodecs disagree on these, which the parity probe must catch
ff('-f', 'lavfi', '-i', GEQ + ',format=yuv420p', '-t', '2', '-c:v', 'libvpx-vp9', '-g', '12', '-b:v', '4M', fx.idxu);
// long: 640x360 testsrc2, 6 s, 144-frame GOP (one keyframe per six seconds: worst case for random access). Tagged BT.709.
ff('-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=24:duration=6,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libvpx-vp9', '-g', '144', '-b:v', '600k', ...BT709, fx.long);
ff('-display_rotation', '90', '-i', fx.long, '-c', 'copy', fx.rot);

const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(fs.readFileSync(file)); }).listen(0);
const url = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch({ headless: true, args: process.env.SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const results = [], measures = {}, errors = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route(/cdn\.jsdelivr\.net|fonts\.g/, r => r.abort());   // sandbox has no CDN; exports are not exercised here
const watch = p => { p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); }); };
const open = async () => { const p = await ctx.newPage(); watch(p); await p.goto(url); await p.waitForFunction(() => window.__lab, null, { timeout: 30000 }); await p.waitForTimeout(600); return p; };
const bytes = f => [...fs.readFileSync(f)];
const SETUP = async ({ bytes, name }) => {   // add file, attach to a media-style layer
  const lab = __lab; lab.stage.pause(); const p = lab.project; p.layers = [p.layers[0]]; p.active = p.layers[0].id; p.keys = {}; lab.setProject(p); lab.selectStyle('kinetic-subdivision/kinetic-treemap');
  const meta = await lab.media.add(new File([new Uint8Array(bytes)], name, { type: 'video/mp4' }));
  const q = lab.project; q.layers[0].media = { source: { ...meta, fit: 'fill', timing: 'free' } }; q.finish.shutter = 0; lab.setProject(q);
  await lab.media.info(meta.asset).el; return meta;
};

try {
  // ---------- 1. OPFS persistence across reload ----------
  let page = await open();
  const b = await page.evaluate(() => __lab.media.pool.backend);
  check('pool backend is OPFS', b === 'opfs', b);
  const meta = await page.evaluate(SETUP, { bytes: bytes(fx.long), name: 'long.mp4' });
  check('import stored in pool', meta.stored === true);
  const opfs = await page.evaluate(async id => { const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('motif-media'); const names = []; for await (const [n] of d.entries()) names.push(n); const f = await (await d.getFileHandle(id + '.bin')).getFile(); return { names, size: f.size }; }, meta.asset);
  check('bytes on disk in OPFS (.bin + .json)', opfs.names.includes(meta.asset + '.bin') && opfs.names.includes(meta.asset + '.json') && opfs.size === fs.statSync(fx.long).size, JSON.stringify(opfs));
  await page.waitForTimeout(900);   // autosave debounce
  await page.reload(); await page.waitForFunction(() => window.__lab); await page.waitForTimeout(800);
  const after = await page.evaluate(async id => {
    const lab = __lab, a = lab.media.ensure(id); await a.ready; const i = lab.media.info(id);
    const m = lab.project.layers[0].media; return { state: i.state, w: i.w, h: i.h, ref: !!(m && m.source && m.source.asset === id), list: (await lab.media.pool.list()).length };
  }, meta.asset);
  check('file survives reload without re-selecting', after.state === 'ready' && after.w === 640 && after.h === 360 && after.ref && after.list === 1, JSON.stringify(after));

  // ---------- 2. legacy IndexedDB read-through + migration, IDB fallback, worker writer ----------
  const legacy = await page.evaluate(async bs => {
    const blob = new Blob([new Uint8Array(bs)], { type: 'video/mp4' }), id = 'm_000000000000000000000001';
    const db = await new Promise((res, rej) => { const r = indexedDB.open('motif3-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('assets', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise(res => { const tx = db.transaction('assets', 'readwrite'); tx.objectStore('assets').put({ id, name: 'old.mp4', kind: 'video', mime: 'video/mp4', blob, w: 640, h: 360, dur: 6, added: 1 }); tx.oncomplete = res; });
    const pool = __m_media_pool.create(), before = (await pool.list()).find(x => x.id === id);
    const got = await pool.get(id), listed = (await pool.list()).find(x => x.id === id);
    const inIdb = await new Promise(res => { const q = db.transaction('assets').objectStore('assets').get(id); q.onsuccess = () => res(!!q.result); });
    await pool.remove(id); db.close();
    return { before: before && before.backend, got: got && got.name, size: got && got.size, after: listed && listed.backend, inIdb };
  }, bytes(fx.idx));
  check('legacy IndexedDB asset readable and migrated to OPFS', legacy.before === 'idb' && legacy.got === 'old.mp4' && legacy.after === 'opfs' && legacy.inIdb === false, JSON.stringify(legacy));
  const modes = await page.evaluate(async bs => {
    const out = {};
    for (const [label, o] of [['idb', { backend: 'idb' }], ['worker', { forceWorker: true }]]) {
      const pool = __m_media_pool.create(o), blob = new Blob([new Uint8Array(bs)], { type: 'video/mp4' }), id = label === 'idb' ? 'm_aaaaaaaaaaaaaaaaaaaaaaa1' : 'm_aaaaaaaaaaaaaaaaaaaaaaa2';
      const r = await pool.put(id, { name: label, kind: 'video' }, blob), g = await pool.get(id), l = (await pool.list()).find(x => x.id === id);
      out[label] = { backend: r.backend, ok: g && g.blob.size === blob.size && g.name === label, listed: !!l }; await pool.remove(id);
      out[label].gone = !(await pool.get(id));
    } return out;
  }, bytes(fx.idx));
  check('IndexedDB fallback backend round-trips', modes.idb.backend === 'idb' && modes.idb.ok && modes.idb.listed && modes.idb.gone, JSON.stringify(modes.idb));
  check('worker (sync access handle) writer round-trips', modes.worker.backend === 'opfs' && modes.worker.ok && modes.worker.listed && modes.worker.gone, JSON.stringify(modes.worker));

  // ---------- 3. frame accuracy, determinism, ring bound, cleanup ----------
  const acc = await page.evaluate(async bs => {
    const lab = __lab, blob = new Blob([new Uint8Array(bs)], { type: 'video/mp4' });
    const base = { ...__m_webcodecs.live }, dec = await __m_webcodecs.open(blob); if (!dec) return { unsupported: true };
    const c = document.createElement('canvas'); c.width = 320; c.height = 180; const x = c.getContext('2d', { willReadFrequently: true });
    const rgb = async t => { const f = await dec.frameAt(t); x.drawImage(f.bitmap, 0, 0); const d = x.getImageData(140, 70, 40, 40).data; let r = 0, g = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; } const n = d.length / 4; return [r / n, g / n, f.ts]; };
    const N = 48, res = { frames: N, wrong: [], tsOff: 0 };
    const order = []; for (let i = 0; i < N; i++) order.push(i);
    const shuffled = order.map(i => (i * 17) % N);       // random-access order covering every frame across GOP boundaries
    for (const seq of [order, shuffled, order.slice().reverse()]) for (const n of seq) {
      const [r, g, ts] = await rgb((n + 0.5) / 24);
      if (Math.abs(r - (n * 5) % 256) > 4 || Math.abs(g - (n * 3) % 256) > 4) res.wrong.push(n);
      res.tsOff = Math.max(res.tsOff, Math.abs(ts - n / 24));
    }
    res.codec = dec.codec; res.fps = dec.fps; res.dur = dec.dur; res.stats = dec.stats();
    // idle release in the middle of a session must not corrupt the next frame
    await new Promise(r => setTimeout(r, 4600)); const g = await dec.frameAt(40.5 / 24); res.afterIdle = Math.abs(g.ts - 40 / 24) < 1e-6;
    // sub-frame offsets inside one frame interval resolve to the same frame
    const o = [0.001, 0.02, 0.0399].map(d => 0); for (let i = 0; i < 3; i++) o[i] = (await dec.frameAt(20 / 24 + [0.001, 0.02, 0.0399][i])).ts; res.subframe = o.every(v => Math.abs(v - 20 / 24) < 1e-6);
    dec.dispose(); const L = __m_webcodecs.live; res.live = { sessions: L.sessions - base.sessions, bitmaps: L.bitmaps - base.bitmaps, bytes: L.bytes - base.bytes }; return res;
  }, bytes(fx.idx));
  check('WebCodecs available in this browser', !acc.unsupported);
  check('every frame decodes to its own index (sequential, shuffled and reverse access)', acc.wrong.length === 0 && acc.tsOff < 1e-6, `wrong=${JSON.stringify(acc.wrong)} tsOff=${acc.tsOff}`);
  check('ring is bounded', acc.stats.frames <= acc.stats.maxFrames, `${acc.stats.frames} <= ${acc.stats.maxFrames}`);
  check('idle decoder release mid-session does not corrupt the next frame', acc.afterIdle);
  check('sub-frame offsets inside one frame interval resolve to the same frame', acc.subframe);
  check('dispose() frees the ring (0 bitmaps, 0 bytes, 0 sessions)', acc.live.bitmaps === 0 && acc.live.bytes === 0 && acc.live.sessions === 0, JSON.stringify(acc.live));
  measures.fixtureIdx = { codec: acc.codec, fps: acc.fps, dur: acc.dur };

  // Identical pixels twice through the real render path (export-style prepare + renderAt), including a different seek between.
  const det = await page.evaluate(async id => {
    const lab = __lab, p = lab.project, hash = a => { let h = 2166136261; for (let i = 0; i < a.length; i += 7) h = Math.imul(h ^ a[i], 16777619) >>> 0; return h; };
    const grab = async t => { await lab.media.prepare(p, t); const px = lab.renderAt(p, t, 320, 180).data; return hash(px); };
    const t = 2.5 + 1 / 48, a1 = await grab(t), other = await grab(0.2), a2 = await grab(t);
    lab.media.release(); const i = lab.media.info(id);
    return { a1, a2, differs: other !== a1, decoder: i.decoder };
  }, meta.asset);
  check('seek to the same time twice returns identical pixels (render path)', det.a1 === det.a2 && det.differs && det.decoder === 'webcodecs', JSON.stringify(det));

  // Preview scrubbing (paused stage) goes through the decoder, coalesced, and playback hands back to <video>.
  const scrub = await page.evaluate(async id => {
    const lab = __lab, wait = ms => new Promise(r => setTimeout(r, ms)); lab.stage.pause(); const d0 = lab.media.info(id).decoderStats.decodes;
    for (const t of [0.5, 1.5, 2.5, 3.5, 4.5]) { lab.stage.seekTime(t); await wait(30); }   // rapid scrub: only the newest target must matter
    await wait(1200); const s = lab.media.info(id).decoderStats;
    lab.stage.seekTime(1.0); await wait(1200); const s2 = lab.media.info(id).decoderStats;
    return { decodedAfterScrub: s.decodes - d0, frames: s.frames, moved: s2.decodes > s.decodes || s2.frames >= s.frames };
  }, meta.asset);
  check('paused stage scrubbing decodes through WebCodecs', scrub.decodedAfterScrub > 0 && scrub.frames > 0 && scrub.moved, JSON.stringify(scrub));

  // Decoded frame vs the <video> element: same size, orientation and colour
  const cmp = await page.evaluate(async ([bsPlain, bsRot]) => {
    const out = {};
    for (const [label, bs] of [['plain', bsPlain], ['rotated', bsRot]]) {
      const blob = new Blob([new Uint8Array(bs)], { type: 'video/mp4' }), dec = await __m_webcodecs.open(blob);
      const v = document.createElement('video'); v.muted = true; v.src = URL.createObjectURL(blob); await new Promise(r => v.addEventListener('loadeddata', r, { once: true }));
      v.currentTime = 2.02; await new Promise(r => v.addEventListener('seeked', r, { once: true }));
      const f = await dec.frameAt(v.currentTime + 0.001);
      const W = 64, H = 64 * v.videoHeight / v.videoWidth | 0, c1 = new OffscreenCanvas(W, H), c2 = new OffscreenCanvas(W, H), a = c1.getContext('2d'), b = c2.getContext('2d');
      a.drawImage(v, 0, 0, W, H); b.drawImage(f.bitmap, 0, 0, W, H);
      const d1 = a.getImageData(0, 0, W, H).data, d2 = b.getImageData(0, 0, W, H).data; let s = 0; for (let i = 0; i < d1.length; i++) s += Math.abs(d1[i] - d2[i]);
      out[label] = { video: [v.videoWidth, v.videoHeight], dec: [dec.w, dec.h], bitmap: [f.bitmap.width, f.bitmap.height], meanAbsDiff: +(s / d1.length).toFixed(3), vt: v.currentTime, ts: f.ts };
      dec.dispose(); v.removeAttribute('src');
    } return out;
  }, [bytes(fx.long), bytes(fx.rot)]);
  check('decoded frame matches <video> (size, orientation, colour) for plain and rotated clips', ['plain', 'rotated'].every(k => cmp[k].video[0] === cmp[k].dec[0] && cmp[k].video[1] === cmp[k].dec[1] && cmp[k].bitmap[0] === cmp[k].dec[0] && cmp[k].meanAbsDiff < 3), JSON.stringify(cmp));

  // Untagged (BT.601) clip: <video> and WebCodecs disagree on colour, so the parity probe must refuse WebCodecs and keep <video>.
  const probe = await page.evaluate(async ([tagged, untagged]) => {
    const out = {};
    for (const [label, bs] of [['tagged', tagged], ['untagged', untagged]]) {
      const before = { ...__m_webcodecs.live }, meta = await __lab.media.add(new File([new Uint8Array(bs)], label + '.mp4', { type: 'video/mp4' }));
      await __lab.media.info(meta.asset).el; await new Promise(r => setTimeout(r, 1200)); const i = __lab.media.info(meta.asset);
      out[label] = { decoder: i.decoder, probe: +__m_webcodecs.live.lastProbe.toFixed(2), rejected: __m_webcodecs.live.rejected - before.rejected };
      __lab.media.forget(meta.asset); await __lab.media.pool.remove(meta.asset);   // keep the pool as the page tests expect
    } return out;
  }, [bytes(fx.idx), bytes(fx.idxu)]);
  check('parity probe keeps WebCodecs for tagged clips and falls back to <video> for untagged ones', probe.tagged.decoder === 'webcodecs' && probe.untagged.decoder === 'video' && probe.untagged.rejected === 1, JSON.stringify(probe));
  measures.parityProbe = probe;

  // ---------- 4. performance numbers (software GL / CPU decode: indicative only) ----------
  const perf = await page.evaluate(async bs => {
    const dec = await __m_webcodecs.open(new Blob([new Uint8Array(bs)], { type: 'video/mp4' })), out = {};
    let t0 = performance.now(); for (let i = 0; i < 96; i++) await dec.frameAt((i + 0.5) / 24); const seq = performance.now() - t0; const s1 = dec.stats();
    out.sequentialMsPerFrame = +(seq / 96).toFixed(2); out.sequentialDecodes = s1.decodes; out.sequentialRestarts = s1.restarts;
    const lat = []; for (const t of [5.9, 0.4, 3.3, 5.0, 1.1, 4.4]) { const a = performance.now(); await dec.frameAt(t); lat.push(+(performance.now() - a).toFixed(1)); }
    out.randomAccessMs = lat; out.gopFrames = 144; out.ring = dec.stats().frames; dec.dispose(); return out;
  }, bytes(fx.long));
  measures.decode640x360_vp9_gop144 = perf;
  check('sequential decode advances one open decoder (no restart per frame)', perf.sequentialRestarts <= 2 && perf.sequentialDecodes < 96 * 3, JSON.stringify(perf));

  // ---------- 5. Media page ----------
  await page.evaluate(() => __lab.setTab('media')); await page.waitForSelector('#panel-media .mp-body'); await page.waitForTimeout(500);
  check('Media tab present and in the tab bar', await page.locator('.tabs button[data-tab="media"]').count() === 1);
  const rows = await page.locator('#panel-media .mp-item').count();
  check('pool lists the imported clip with thumbnail, badge and meter', rows === 1 && await page.locator('#panel-media .mp-item img.mp-thumb').count() === 1 && /In use/.test(await page.locator('#panel-media .mp-badge').first().innerText()) && await page.locator('#panel-media [role="meter"]').count() === 1, `rows=${rows}`);
  const text = await page.locator('#panel-media .mp-item').first().innerText(); check('row shows resolution, duration, codec, size', /640×360/.test(text) && /6\.0 s/.test(text) && /vp9|mp4/i.test(text) && /KB|MB/.test(text), text.replace(/\n/g, ' | '));
  // keyboard: second clip, roving focus, Delete -> confirm -> Remove
  { const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#panel-media [data-act="import"]').click()]); await fc.setFiles(fx.idx); } await page.waitForFunction(() => document.querySelectorAll('#panel-media .mp-item').length === 2); await page.waitForTimeout(300);
  await page.locator('#panel-media .mp-item').first().focus(); await page.keyboard.press('ArrowDown');
  const sel = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-selected') + '|' + document.activeElement.classList.contains('mp-item'));
  check('arrow keys move roving focus and selection', sel === 'true|true', sel);
  await page.keyboard.press('Delete'); const confirmShown = await page.locator('#panel-media [data-act="remove"]').count() === 1 && await page.evaluate(() => document.activeElement.dataset.act === 'cancel');
  check('Delete asks for confirmation naming the clip, focus on Cancel', confirmShown);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.querySelectorAll('#panel-media .mp-item').length === 1);
  const stillOpfs = await page.evaluate(async () => (await __lab.media.pool.list()).length);
  check('confirmed delete removes the clip from the pool', stillOpfs === 1, 'pool=' + stillOpfs);
  // empty + relink: project references a clip this browser doesn't have
  await page.evaluate(() => { const p = __lab.project; p.layers[0].media = { source: { asset: 'm_ffffffffffffffffffffffff', name: 'gone.mp4', kind: 'video', w: 320, h: 180, dur: 2, fit: 'fit', timing: 'free' } }; __lab.setProject(p); });
  await page.waitForSelector('#panel-media [data-relink]', { timeout: 5000 });
  check('missing reference listed with Relink', /gone\.mp4/.test(await page.locator('#panel-media .mp-miss').innerText()));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#panel-media [data-relink]').click()]); await chooser.setFiles(fx.idx);
  await page.waitForFunction(() => !document.querySelector('#panel-media [data-relink]') && __lab.project.layers[0].media.source.asset !== 'm_ffffffffffffffffffffffff', null, { timeout: 15000 });
  const rl = await page.evaluate(() => { const m = __lab.project.layers[0].media.source; return { name: m.name, fit: m.fit, timing: m.timing, w: m.w, state: __lab.media.info(m.asset).state }; });
  check('relink rewrites the project reference, keeps fit and timing', rl.name === 'idx.mp4' && rl.fit === 'fit' && rl.timing === 'free' && rl.w === 320, JSON.stringify(rl));
  // quota-exceeded state
  await page.evaluate(() => { __lab.media.pool.put = async () => { throw Object.assign(new Error('full'), { code: 'quota' }); }; });
  { const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('#panel-media [data-act="import"]').click()]); await fc.setFiles(fx.rot); } await page.waitForSelector('#panel-media .mp-banner[data-kind="quota"]', { timeout: 10000 });
  check('quota exceeded shows a recovery banner', /Browser storage is full/.test(await page.locator('#panel-media .mp-banner[data-kind="quota"]').innerText()));
  // reduced motion
  const rm = await page.evaluate(() => { const e = document.createElement('div'); e.className = 'mp-skel'; document.body.appendChild(e); const n = getComputedStyle(e).animationName; e.remove(); return n; });
  await page.emulateMedia({ reducedMotion: 'reduce' }); const rm2 = await page.evaluate(() => { const e = document.createElement('div'); e.className = 'mp-skel'; document.body.appendChild(e); const n = getComputedStyle(e).animationName; e.remove(); return n; });
  check('reduced motion disables the skeleton animation', rm !== 'none' && rm2 === 'none', `${rm} -> ${rm2}`);
  await page.screenshot({ path: path.join(tmp, 'media-page.png') }); measures.screenshot = path.join(tmp, 'media-page.png');

  // ---------- 6. cleanup through the store ----------
  const leak = await page.evaluate(async () => { __lab.media.ids().forEach(id => __lab.media.forget(id)); await new Promise(r => setTimeout(r, 100)); return { ...__m_webcodecs.live }; });
  check('forgetting every asset leaves 0 live bitmaps and 0 decoder sessions', leak.bitmaps === 0 && leak.sessions === 0, JSON.stringify(leak));
  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) { check('test run completed', false, e.stack || String(e)); }
finally { await browser.close(); srv.close(); }
for (const f of fs.readdirSync(tmp)) if (f.endsWith('.mp4')) fs.rmSync(path.join(tmp, f));
console.log('\nmeasurements (software GL / headless; not representative of hardware):\n' + JSON.stringify(measures, null, 1));
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
