// Text inputs (motif-kit@3) in real Chromium: FaceType 1.3.0 end to end.
//   SOFTWARE_GL=1 PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tests/browser/text.browser.mjs [motif7.html]
// Covers: install through the Kits file input with the `text` capability on the approval card; the inspector's Text
// section (three live fields with maxlength, family / weight / size / tracking / align) changes pixels; hold keys for
// strings and fonts, eased keys for size; undo/redo; autosave + reload; project file and preset round trips; duplicate
// layer; style switch inside the kit keeps text, another kit drops it; the atlas rebuilds only on text changes (counted,
// in the worker); worker == main pixels; a late font load invalidates cached frames; an imported font file renders on
// both threads and shows Relink in a browser without it; a PNG export matches the preview; hostile strings and font
// names neither crash nor stall; no page errors.
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { rawFromZip } from '../lib/kits.mjs';
import { tinyFont } from '../lib/tiny-font.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '../..');
const appFile = path.resolve(root, process.argv[2] || 'motif7.html');
const KIT = path.join(root, 'kits/facetype-1.3.0.motifkit');
const SW = !!process.env.SOFTWARE_GL;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motif-text-'));
const FONT = path.join(tmp, 'MotifTestBlock.ttf'); fs.writeFileSync(FONT, tinyFont('Motif Test Block'));
const browser = await chromium.launch({ headless: true, args: SW ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const results = []; let failed = 0;
async function step(name, fn) {
  const t0 = Date.now();
  try { const note = await fn(); results.push(`ok   ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)${note ? ' · ' + note : ''}`); }
  catch (e) { failed++; results.push(`FAIL ${name}: ${e && e.message ? e.message.split('\n').slice(0, 8).join('\n     ') : e}`); }
  console.log(results[results.length - 1]);
}
async function open(ctx, query = '') {
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route(/^https?:\/\//, r => r.abort());
  await page.goto(pathToFileURL(appFile).href + query); await page.waitForFunction(() => window.__lab, null, { timeout: 60000 }); await page.waitForTimeout(600);
  await inject(page);
  return { page, errors };
}
async function inject(page) {
  await page.evaluate(() => {
    __lab.stage.pause();
    // Page helpers: FNV hash of a main-thread render, mean pixel difference, wait for a style's program.
    window.__t = {
      sleep: ms => new Promise(r => setTimeout(r, ms)),
      hash(d) { let h = 2166136261; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h; },
      diff(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; },
      render(pr, f = 0.3, w = 320, h = 180) { pr = pr || __lab.project; return __lab.renderAt(pr, f * pr.finish.loop, w, h).data; },
      async ready(id) { const K = __lab.kits; for (let i = 0; i < 600; i++) { const pr = __lab.project; __lab.renderAt(pr, 0, 32, 18); if (K.runtime.programs.has(id) && !K.runtime.pendingCompiles) return true; await __t.sleep(25); } return false; },
      // Settled: fonts loaded on the page, and (in the worker) no font load pending and the atlas stats stable for two frames.
      async settle() {
        await __lab.textAtlas.whenReady(__lab.project);
        let prev = '';
        for (let i = 0; i < 40; i++) { __lab.stage.invalidate(); await __lab.stage.settle(); await __t.sleep(30); const s = __lab.stage.atlasStats || {}; const k = JSON.stringify(s); if (k === prev && !s.pending) return; prev = k; }
      },
      toast() { return document.getElementById('toast').textContent; },
      layer() { const pr = __lab.project; return pr.layers.find(l => l.id === pr.active); },
      path(f, line = 'line1') { return `L:${__lab.project.active}:t:type.${line}.${f}`; },
    };
  });
}
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const { page, errors } = await open(ctx);
const ID = 'facetype/signal-scan';

try {
  await step('install FaceType 1.3.0 through the Kits file input: approval card lists "text"; installs as motif-kit@3', async () => {
    await page.evaluate(() => __lab.setTab('kits'));
    await page.setInputFiles('#kitFile', KIT);
    await page.waitForFunction(() => __lab.kitReview, null, { timeout: 30000 });
    const card = await page.locator('#kitReview').textContent();
    assert.match(card, /text: Draws text you type/); assert.doesNotMatch(card, /media:/);
    assert.deepEqual(await page.evaluate(() => __lab.kitReview.capabilities), ['text']);
    await page.locator('#kitReview [data-approve]').click();
    await page.waitForFunction(() => __lab.kits.list().some(k => k.id === 'facetype'), null, { timeout: 180000 });
    const k = await page.evaluate(() => __lab.kits.list().find(x => x.id === 'facetype'));
    assert.equal(k.format, 'motif-kit@3'); assert.deepEqual(k.approved, ['text']); assert.equal(k.styles.length, 10);
    assert.deepEqual(k.styles.filter(s => s.quarantine).map(s => s.id), [], 'no style quarantined by the default-text canary');
    const canary = await page.evaluate(() => Object.keys((__lab.kits.list().find(x => x.id === 'facetype').report || {}).canary || {}).length);
    return `${k.styles.length} styles, canary ran on ${canary}`;
  });

  await step('the canary probes text shaders with the default atlas (real glyphs, not a blank texture)', async () => {
    const r = await page.evaluate(() => {
      const TA = __lab.textAtlas, q = __lab.kits.entry('facetype/signal-scan').entry.inputs[0];
      const a = TA.defaultAtlas(q, 1024), x = new OffscreenCanvas(a.w, a.h).getContext('2d'); x.drawImage(a.canvas, 0, 0);
      const d = x.getImageData(0, 0, a.w, a.h).data; let cov = [0, 0, 0], prem = 0;
      const bh = a.h / 3; for (let i = 0; i < d.length; i += 4) { const y = Math.floor(i / 4 / a.w); if (d[i + 3]) cov[Math.floor(y / bh)]++; if (d[i + 3] && (d[i] < 254 || d[i + 1] < 254 || d[i + 2] < 254)) prem++; }
      return { w: a.w, h: a.h, cov, prem, lines: q.lines.map(l => l.def) };
    });
    assert.deepEqual(r.lines, ['FORM FOLLOWS', 'FREQUENCY', 'TYPE IS SIGNAL']);
    assert.equal(r.w, 1024); assert.equal(r.h, 3 * Math.round(1024 / 12));
    for (const c of r.cov) assert.ok(c > 500, `every band has glyph coverage (${r.cov})`);
    assert.equal(r.prem, 0, 'white glyphs (2D readback is straight alpha; the GL upload premultiplies, so the shader sees rgb == a)');
    return `atlas ${r.w}×${r.h}, coverage px per band ${r.cov.join('/')}`;
  });

  await step('Text section: three live fields with maxlength, per-line font, weight, size, tracking, align; no media picker', async () => {
    await page.evaluate(id => { __lab.setTab('layer'); __lab.selectStyle(id); }, ID);
    assert.ok(await page.evaluate(id => __t.ready(id), ID));
    const panel = page.locator('#panel-layer');
    assert.equal(await panel.locator('.mslot').count(), 0, 'no image picker for a text input');
    const fields = panel.locator('input[type=text][data-path*=":t:type."]');
    assert.equal(await fields.count(), 3);
    assert.deepEqual(await fields.evaluateAll(els => els.map(e => [e.value, e.maxLength, !!document.querySelector(`label[for="${e.id}"]`)])), [['FORM FOLLOWS', 48, true], ['FREQUENCY', 48, true], ['TYPE IS SIGNAL', 48, true]]);
    for (const sel of ['[data-ffam]', '[data-fweight]', 'input[type=range][data-path$=".size"]', 'input[type=range][data-path$=".tracking"]', 'select[data-path$=".align"]']) {
      assert.equal(await panel.locator(sel).count(), 3, sel);
      const unlabeled = await panel.locator(sel).evaluateAll(els => els.filter(e => !document.querySelector(`label[for="${e.id}"]`)).length); assert.equal(unlabeled, 0, `${sel} labelled`);
    }
    // Keyboard: the first text field is reachable and typing is live (maxlength enforced by the field and the sanitizer).
    const f1 = fields.nth(0); await f1.focus(); await page.keyboard.press('Control+A'); await page.keyboard.type('X'.repeat(60));
    assert.equal(await f1.inputValue(), 'X'.repeat(48));
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => __t.layer().text.type.lines.line1.text), 'X'.repeat(48));
    await page.evaluate(() => __lab.undo());
    assert.equal(await page.evaluate(() => __t.layer().text.type.lines.line1.text), 'FORM FOLLOWS', 'undo restores the text');
  });

  await step('editing each of the three lines changes pixels', async () => {
    const out = [];
    for (const [i, line] of ['line1', 'line2', 'line3'].entries()) {
      const before = await page.evaluate(() => __t.render());
      const f = page.locator('input[type=text][data-path*=":t:type."]').nth(i);
      await f.fill('MOTIF ' + (i + 1)); await f.press('Enter'); await f.blur();
      const r = await page.evaluate(({ before, line }) => ({ d: __t.diff(before, __t.render()), v: __t.layer().text.type.lines[line].text }), { before, line });
      assert.equal(r.v, 'MOTIF ' + (i + 1)); assert.ok(r.d > 0.2, `${line}: pixels changed (${r.d.toFixed(2)})`); out.push(r.d.toFixed(2));
    }
    return `mean |Δ| ${out.join(', ')}`;
  });

  await step('font family, weight, size, tracking and alignment each change pixels', async () => {
    const out = {};
    const measure = async (label, act) => { const before = await page.evaluate(() => __t.render()); await act(); const d = await page.evaluate(b => __t.diff(b, __t.render()), before); out[label] = d; assert.ok(d > 0.05, `${label} changed pixels (${d.toFixed(3)})`); };
    await measure('family', async () => { const el = page.locator('[data-ffam$="line1.font"]'); await el.fill('DejaVu Serif'); await el.press('Tab'); });
    await measure('weight', async () => { await page.selectOption('[data-fweight$="line1.font"]', '300'); });
    const setRange = (sel, v) => page.evaluate(({ sel, v }) => { const el = document.querySelector(sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, { sel, v });
    await measure('size', () => setRange('input[type=range][data-path$="line2.size"]', 0.4));
    await measure('tracking', () => setRange('input[type=range][data-path$="line2.tracking"]', 0.4));
    await measure('align', async () => { await page.selectOption('select[data-path$="line3.align"]', 'left'); });
    const l = await page.evaluate(() => __t.layer().text.type.lines);
    assert.deepEqual(l.line1.font, { family: 'DejaVu Serif', weight: 300 }); assert.equal(l.line2.size, 0.4); assert.equal(l.line2.tracking, 0.4); assert.equal(l.line3.align, 'left');
    return Object.entries(out).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ');
  });

  await step('keys: text and font hold (no interpolation), size eases; the key button keys a text field', async () => {
    const r = await page.evaluate(() => {
      const T = __lab.api.timeline; let pr = __lab.project; const P = __t.path;
      pr = T.setKey(pr, P('text'), 0, 'ALPHA'); pr = T.setKey(pr, P('text'), 0.5, 'OMEGA');
      pr = T.setKey(pr, P('font'), 0, { family: 'DejaVu Sans', weight: 700 }); pr = T.setKey(pr, P('font'), 0.5, { family: 'DejaVu Serif', weight: 400 });
      pr = T.setKey(pr, P('size'), 0, 0.3); pr = T.setKey(pr, P('size'), 0.5, 0.9);
      __lab.setProject(pr); pr = __lab.project;
      const at = u => { const ev = T.evaluate(pr, u * pr.finish.loop, null); return ev.layers.find(l => l.id === pr.active).text.type.lines.line1; };
      const a = at(0.25), b = at(0.49), c = at(0.75);
      const eases = pr.keys[P('text')].map(k => k.e).concat(pr.keys[P('font')].map(k => k.e));
      // Pixels: at 0.4 the keyed layer draws exactly what a base value of ALPHA draws (no blend toward OMEGA).
      const base = JSON.parse(JSON.stringify(pr)); delete base.keys[P('text')]; base.layers.find(l => l.id === pr.active).text.type.lines.line1.text = 'ALPHA';
      const same = __t.hash(__t.render(pr, 0.4)) === __t.hash(__t.render(base, 0.4));
      const omega = JSON.parse(JSON.stringify(base)); omega.layers.find(l => l.id === pr.active).text.type.lines.line1.text = 'OMEGA';
      const same2 = __t.hash(__t.render(pr, 0.7)) === __t.hash(__t.render(omega, 0.7));
      return { a, b, c, eases, same, same2 };
    });
    assert.equal(r.a.text, 'ALPHA'); assert.equal(r.b.text, 'ALPHA'); assert.equal(r.c.text, 'OMEGA');
    assert.deepEqual(r.a.font, { family: 'DejaVu Sans', weight: 700 }); assert.deepEqual(r.c.font, { family: 'DejaVu Serif', weight: 400 });
    assert.deepEqual([...new Set(r.eases)], ['hold'], 'string and font keys default to hold');
    assert.ok(r.a.size > 0.3 && r.a.size < 0.9 && Math.abs(r.b.size - 0.9) < 0.02, `size eases (${r.a.size}, ${r.b.size})`);
    assert.ok(r.same && r.same2, 'keyed text draws exactly the held string on each side of the key');
    // UI: the ◇ next to line 2's text keys it at the playhead.
    await page.evaluate(() => { __lab.stage.seek(0.1); __lab.setTab('layer'); });
    await page.locator(`.kb[data-key$=":t:type.line2.text"]`).click();
    const k2 = await page.evaluate(() => __lab.project.keys[__t.path('text', 'line2')]);
    assert.equal(k2.length, 1); assert.equal(k2[0].e, 'hold');
    // Clean up keys for the next steps.
    await page.evaluate(() => { const pr = __lab.project; for (const p of Object.keys(pr.keys)) if (p.includes(':t:')) delete pr.keys[p]; __lab.setProject(pr); });
  });

  await step('undo / redo across text edits', async () => {
    const r = await page.evaluate(() => {
      const T = __lab.api.timeline, P = __t.path('text');
      __lab.setProject(T.setBase(__lab.project, P, 'ONE')); __lab.setProject(T.setBase(__lab.project, P, 'TWO'));
      const v = () => __t.layer().text.type.lines.line1.text;
      const a = v(); __lab.undo(); const b = v(); __lab.undo(); const c = v(); __lab.redo(); const d = v(); __lab.redo(); const e = v();
      return [a, b, c, d, e];
    });
    assert.deepEqual(r.slice(0, 2), ['TWO', 'ONE']); assert.equal(r[3], 'ONE'); assert.equal(r[4], 'TWO');
  });

  await step('duplicate layer copies the text; a style of the same kit keeps it; another kit drops it', async () => {
    const r = await page.evaluate(async () => {
      const before = __t.layer().text; document.getElementById('dupLayer').click(); await __t.sleep(50);
      const dup = __t.layer(); const same = JSON.stringify(dup.text) === JSON.stringify(before);
      __lab.selectStyle('facetype/monument'); const kept = __t.layer().text && __t.layer().text.type.lines.line1.text;
      __lab.selectStyle('cyberpunk/' + __lab.kits.list().find(k => k.id === 'cyberpunk').styles[0].localId); const dropped = __t.layer().text;
      __lab.undo(); __lab.undo(); __lab.undo();
      return { same, kept, dropped, n: __lab.project.layers.length, text: __t.layer().text.type.lines.line1.text };
    });
    assert.ok(r.same, 'duplicate has identical text'); assert.equal(r.kept, 'TWO'); assert.equal(r.dropped, undefined);
    assert.equal(r.text, 'TWO');
  });

  await step('project file and preset round trips keep text and typography', async () => {
    const r = await page.evaluate(() => {
      const T = __lab.api.timeline; let pr = __lab.project; pr = T.setBase(pr, __t.path('text', 'line3'), 'ROUND TRIP'); pr = T.setBase(pr, __t.path('font', 'line3'), { family: 'DejaVu Sans Mono', weight: 800 }); __lab.setProject(pr);
      const want = JSON.stringify(__t.layer().text);
      const payload = JSON.parse(JSON.stringify(__lab.projectPayload()));
      __lab.setProject(T.newProject('plexus'));
      __lab.loadProjectData(payload); const a = JSON.stringify(__t.layer().text);
      const preset = __lab.parsePreset(__lab.presetJSON()); const l = preset.project.layers.find(x => x.text);
      return { a: a === want, p: JSON.stringify(l.text) === want, line3: __t.layer().text.type.lines.line3 };
    });
    assert.ok(r.a, 'project file'); assert.ok(r.p, 'preset'); assert.equal(r.line3.text, 'ROUND TRIP'); assert.deepEqual(r.line3.font, { family: 'DejaVu Sans Mono', weight: 800 });
  });

  await step('atlas rebuilds only when text changes (worker count); motion, colour and scrubbing reuse it', async () => {
    await page.evaluate(() => { __lab.setTab('finish'); __lab.stage.setEngine('auto'); });
    await page.waitForFunction(() => __lab.stage.engineMode === 'worker', null, { timeout: 30000 });
    const r = await page.evaluate(async () => {
      const T = __lab.api.timeline, st = () => (__lab.stage.atlasStats || { builds: 0 }).builds;
      await __t.settle(); const b0 = st();
      const id = __lab.project.active;
      for (const [k, v] of [['motion', 0.9], ['density', 0.2], ['line1PosX', 0.3], ['line2Angle', 20]]) { __lab.setProject(T.setBase(__lab.project, `L:${id}:p:${k}`, v)); await __t.settle(); }
      __lab.setProject(T.setBase(__lab.project, `L:${id}:s:palette`, 'chroma')); await __t.settle();
      for (const f of [0.1, 0.5, 0.9]) { __lab.stage.seek(f); await __t.settle(); }
      const b1 = st();
      __lab.setProject(T.setBase(__lab.project, __t.path('text'), 'REBUILD')); await __t.settle();
      const b2 = st();
      return { b0, b1, b2, mode: __lab.stage.engineMode };
    });
    assert.equal(r.mode, 'worker');
    assert.equal(r.b1, r.b0, `no rebuild for params, palette or time (${r.b0} → ${r.b1})`);
    assert.equal(r.b2, r.b1 + 1, `one rebuild for a text change (${r.b1} → ${r.b2})`);
    return `builds ${r.b0} → ${r.b1} → ${r.b2}`;
  });

  await step('worker and main thread draw identical pixels (text layer)', async () => {
    const grab = () => page.evaluate(async () => { await __t.settle(); const p = await __lab.stage.readPixels(); return { w: p.w, h: p.h, hash: __t.hash(p.data), mode: __lab.stage.engineMode, data: Array.from(p.data.slice(0, 0)) }; });
    await page.evaluate(() => __lab.stage.seek(0.37));
    const w = await grab();
    await page.evaluate(() => __lab.stage.setEngine('main')); await page.waitForFunction(() => __lab.stage.engineMode === 'main');
    const m = await grab();
    const d = await page.evaluate(async () => { const a = await __lab.stage.readPixels(); __lab.stage.setEngine('auto'); return a.data.length; });
    assert.equal(w.mode, 'worker'); assert.equal(m.mode, 'main'); assert.equal(w.w, m.w);
    assert.equal(w.hash, m.hash, 'pixel-identical');
    return `${w.w}×${w.h}, hash ${w.hash.toString(16)}`;
  });

  await step('a late-arriving font invalidates cached frames (main thread)', async () => {
    const b64 = fs.readFileSync(FONT).toString('base64');
    const r = await page.evaluate(async b64 => {
      __lab.stage.setEngine('main'); __lab.stage.setCache(true); __lab.setTab('finish');
      for (let i = 0; i < 100 && __lab.stage.engineMode !== 'main'; i++) await __t.sleep(20);
      const T = __lab.api.timeline, TA = __lab.textAtlas;
      // A web font that is declared but not loaded yet (like a slow Google Fonts face).
      const face = new FontFace('Late Block', `url(data:font/ttf;base64,${b64})`); document.fonts.add(face);
      const e0 = TA.epoch;
      __lab.setProject(T.setBase(__lab.project, __t.path('font'), { family: 'Late Block', weight: 400 }));
      __lab.stage.seek(0.2); await __lab.stage.settle(); const first = await __lab.stage.readPixels();
      const statsA = __lab.stage.cacheStats();
      for (let i = 0; i < 100 && face.status !== 'loaded'; i++) await __t.sleep(20);
      await TA.whenReady(); await __t.sleep(100); __lab.stage.seek(0.2); await __lab.stage.settle(); const second = await __lab.stage.readPixels();
      return { e0, e1: TA.epoch, status: face.status, d: __t.diff(first.data, second.data), framesA: statsA.frames, sig: __lab.stage.cacheStats().frames };
    }, b64);
    assert.equal(r.status, 'loaded'); assert.ok(r.e1 > r.e0, 'font epoch advanced'); assert.ok(r.framesA >= 1, 'a frame was cached before the font arrived');
    assert.ok(r.d > 0.05, `the cached fallback frame was replaced (Δ ${r.d.toFixed(3)})`);
    await page.evaluate(() => __lab.stage.setEngine('auto'));
    return `epoch ${r.e0} → ${r.e1}, Δ ${r.d.toFixed(2)}`;
  });

  await step('imported font file (generated TTF, solid-block glyphs) renders on the page and in the worker', async () => {
    // Start from an installed face (the previous step left the block-shaped "Late Block" on line 1).
    await page.evaluate(() => { __lab.setProject(__lab.api.timeline.setBase(__lab.project, __t.path('font'), { family: 'DejaVu Sans', weight: 700 })); __lab.setTab('layer'); __lab.stage.setEngine('auto'); });
    const before = await page.evaluate(() => __t.render());
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-fimport$="line1.font"]').click();
    await (await chooser).setFiles(FONT);
    try { await page.waitForFunction(() => { const f = __t.layer().text.type.lines.line1.font; return f.source && /^f_/.test(f.source); }, null, { timeout: 20000 }); }
    catch (e) { throw new Error('import did not apply; toast: ' + await page.evaluate(() => __t.toast())); }
    await page.waitForFunction(() => __lab.stage.engineMode === 'worker', null, { timeout: 30000 });
    const r = await page.evaluate(async before => {
      const TA = __lab.textAtlas, f = __t.layer().text.type.lines.line1.font;
      // The atlas band of line 1 is solid rectangles: count rows with long runs of full coverage.
      const q = __lab.kits.entry('facetype/signal-scan').entry.inputs[0];
      const a = TA.atlasFor(q, __t.layer().text.type, 1024, 'probe'); const x = new OffscreenCanvas(a.w, a.h).getContext('2d'); x.drawImage(a.canvas, 0, 0);
      const solidOf = at => { const c = new OffscreenCanvas(at.w, at.h).getContext('2d'); c.drawImage(at.canvas, 0, 0); const dd = c.getImageData(0, 0, at.w, at.h / 3).data; let n = 0; for (let i = 3; i < dd.length; i += 4) if (dd[i] === 255) n++; return n; };
      const solid = solidOf(a), plain = solidOf(TA.atlasFor(q, { lines: { ...__t.layer().text.type.lines, line1: { ...__t.layer().text.type.lines.line1, font: { family: 'DejaVu Sans', weight: 700 } } } }, 1024, 'probe2'));
      const after = __t.render(); await __t.settle(); const wk = await __lab.stage.readPixels();
      __lab.stage.setEngine('main'); for (let i = 0; i < 50 && __lab.stage.engineMode !== 'main'; i++) await __t.sleep(20); await __t.settle(); const mn = await __lab.stage.readPixels(); __lab.stage.setEngine('auto');
      return { f, status: TA.fontStatus(f), solid, plain, d: __t.diff(before, after), parity: __t.hash(wk.data) === __t.hash(mn.data), hint: document.querySelector(`[data-fhint$="line1.font"]`).dataset.state };
    }, before);
    assert.equal(r.f.family, 'Motif Test Block'); assert.equal(r.status.state, 'ok'); assert.equal(r.hint, 'ok');
    assert.ok(r.solid > 2 * r.plain, `line 1 is drawn with the block font (${r.solid} fully covered px vs ${r.plain} with DejaVu Sans)`);
    assert.ok(r.d > 0.2, 'pixels changed'); assert.ok(r.parity, 'worker (font bytes posted once) == main');
    return `${r.solid} solid px in band 1 (DejaVu Sans: ${r.plain})`;
  });

  await step('autosave + reload restores text and the imported font (IndexedDB)', async () => {
    const want = await page.evaluate(() => JSON.stringify(__t.layer().text));
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    await page.reload(); await page.waitForFunction(() => window.__lab, null, { timeout: 60000 }); await inject(page);
    await page.waitForFunction(() => __lab.project.layers.some(l => l.text), null, { timeout: 30000 });
    await page.waitForFunction(() => { const l = __lab.project.layers.find(x => x.text); const f = l.text.type.lines.line1.font; return f.source && __lab.textAtlas.fontInfo(f.source) && __lab.textAtlas.fontInfo(f.source).state === 'ready'; }, null, { timeout: 20000 });
    const got = await page.evaluate(() => JSON.stringify(__lab.project.layers.find(l => l.text).text));
    assert.equal(got, want);
  });

  await step('another browser without the font file: Relink shows, and relinking restores it', async () => {
    const payload = await page.evaluate(() => JSON.stringify(__lab.projectPayload()));
    const kitRaw = rawFromZip(fs.readFileSync(KIT));
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const b = await open(ctx2);
    await b.page.evaluate(async raw => { await __lab.kitHost.install(raw, { source: 'file', approved: ['text'] }); }, kitRaw);
    await b.page.evaluate(p => { __lab.loadProjectData(JSON.parse(p)); __lab.setTab('layer'); }, payload);
    const hint = b.page.locator('[data-fhint$="line1.font"]');
    assert.equal(await hint.getAttribute('data-state'), 'missing');
    assert.match(await hint.textContent(), /isn’t in this browser/);
    const chooser = b.page.waitForEvent('filechooser');
    await hint.locator('[data-frelink]').click(); await (await chooser).setFiles(FONT);
    await b.page.waitForFunction(() => document.querySelector('[data-fhint$="line1.font"]').dataset.state === 'ok', null, { timeout: 20000 });
    assert.deepEqual(b.errors, []);
    await ctx2.close();
  });

  await step('fallback hint: a family this browser lacks says "Fallback in use"', async () => {
    await page.evaluate(() => __lab.setTab('layer'));
    const el = page.locator('[data-ffam$="line2.font"]'); await el.fill('Nowhere Grotesk'); await el.press('Tab');
    const h = page.locator('[data-fhint$="line2.font"]');
    assert.equal(await h.getAttribute('data-state'), 'fallback'); assert.match(await h.textContent(), /Fallback in use: “Nowhere Grotesk” isn’t available/);
  });

  await step('PNG export uses the same text as the preview', async () => {
    const r = await page.evaluate(async () => {
      __lab.stage.seek(0.25); const t = __lab.stage.time;
      const x = await __lab.exportNow({ format: 'png', tier: 360, time: t });
      const bmp = await createImageBitmap(__lab.lastBlob); const c = new OffscreenCanvas(bmp.width, bmp.height).getContext('2d'); c.drawImage(bmp, 0, 0);
      const exp = c.getImageData(0, 0, bmp.width, bmp.height).data;
      const pv = __lab.renderAt(__lab.project, t, bmp.width, bmp.height).data;
      // A different string must differ by far more than the export / preview difference.
      const T = __lab.api.timeline, other = __lab.renderAt(T.setBase(__lab.project, __t.path('text', 'line2'), 'SOMETHING ELSE'), t, bmp.width, bmp.height).data;
      return { w: bmp.width, h: bmp.height, d: __t.diff(exp, pv), dOther: __t.diff(pv, other), type: x.type };
    });
    assert.ok(r.d < 0.5, `export ≈ preview (mean |Δ| ${r.d.toFixed(3)})`); assert.ok(r.dOther > 4 * Math.max(r.d, 0.05), `a different text is clearly different (${r.dOther.toFixed(2)})`);
    return `${r.w}×${r.h}, export vs preview ${r.d.toFixed(3)}, vs other text ${r.dOther.toFixed(2)}`;
  });

  await step('short WebM clip exports with text (smoke)', async () => {
    const r = await page.evaluate(async () => { const pr = __lab.project; pr.finish = { ...pr.finish, loop: 1 }; __lab.setProject(pr); try { const x = await __lab.exportNow({ format: 'webm', tier: 180, fps: 12, loops: 1 }); return { size: x.size, type: x.type }; } catch (e) { return { err: String(e.message || e) }; } });
    if (r.err && /can’t encode|WebCodecs/.test(r.err)) return 'SKIPPED: ' + r.err;
    assert.ok(!r.err, r.err); assert.ok(r.size > 1000); return `${r.size} bytes ${r.type}`;
  });

  await step('hostile text and font names: bounded, no crash, no stall', async () => {
    const r = await page.evaluate(async () => {
      const T = __lab.api.timeline, TA = __lab.textAtlas, P = __t.path;
      const cases = ['A'.repeat(1e6), '😀👩‍👩‍👧‍👦🏳️‍🌈'.repeat(30), 'שלום עולם مرحبا', 'a​‍‌⁠b﻿', 'x\u0000\u0007\u001b[31m\r\nline y', '𐀀\ud800', '<img src=x onerror=__pwn=1>'];
      const out = []; let worst = 0;
      for (const s of cases) {
        const t0 = performance.now();
        let pr = T.setBase(__lab.project, P('text'), s);
        pr = T.setBase(pr, P('font'), { family: 'F'.repeat(10000), weight: 12345, source: '../../etc' });
        pr = T.setBase(pr, P('font', 'line2'), { family: 'x", serif; color:red', weight: -4 });
        pr = T.setBase(pr, P('size'), 1e9); pr = T.setBase(pr, P('tracking'), -1e9); pr = T.setBase(pr, P('align'), 'justify');
        __lab.setProject(pr); __t.render(); await __t.settle();
        worst = Math.max(worst, performance.now() - t0);
        const l = __t.layer().text.type.lines; out.push({ len: l.line1.text.length, f1: l.line1.font, f2: l.line2.font, size: l.line1.size, tr: l.line1.tracking, al: l.line1.align, ctrl: /[\u0000-\u001f]/.test(l.line1.text) });
      }
      // The same through a project document (sanitizeProject on load).
      const doc = __lab.project; doc.layers.find(l => l.text).text = { type: { lines: { line1: { text: { toString() { return 'obj'; } }, font: 'Arial', size: 'NaN', tracking: null, align: {} }, evil: { text: 'x' } } }, __proto__: { polluted: 1 }, other: 5 };
      __lab.setProject(JSON.parse(JSON.stringify(doc)));
      return { out, worst, pwn: window.__pwn, polluted: ({}).polluted, after: __t.layer().text, inputs: document.querySelector('[data-ffam$="line1.font"]') ? document.querySelector('[data-ffam$="line1.font"]').value.length : 0 };
    });
    for (const o of r.out) { assert.ok(o.len <= 48, `text bounded (${o.len})`); assert.equal(o.ctrl, false); assert.deepEqual(o.f1, { family: 'Instrument Sans', weight: 900 }); assert.equal(o.f2.family, 'Instrument Sans'); assert.equal(o.f2.weight, 100); assert.equal(o.size, 1); assert.equal(o.tr, -0.2); assert.equal(o.al, 'center'); }
    assert.equal(r.out[5].len <= 48, true);
    assert.equal(r.pwn, undefined); assert.equal(r.polluted, undefined);
    assert.deepEqual(Object.keys(r.after), ['type']); assert.deepEqual(Object.keys(r.after.type.lines), ['line1', 'line2', 'line3']);
    assert.ok(r.worst < (SW ? 4000 : 800), `worst edit + render ${Math.round(r.worst)} ms`);
    return `worst ${Math.round(r.worst)} ms per hostile edit`;
  });

  await step('no page errors', async () => { assert.deepEqual(errors, []); });
} finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
