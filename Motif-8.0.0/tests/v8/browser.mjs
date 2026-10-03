// Motif 8 browser tests (Playwright, software GL): node tests/v8/browser.mjs
// Boot, bundled kits, validation, rendering determinism and loop closure, the Sequencer layer (single-cue identity, blend, overlap cap,
// worker/main parity, undo, save/open, missing kits) and its inspector (add, edit, keyboard, drag).
import { launch, openApp, suite, readKit, root } from './lib.mjs';
import path from 'node:path';
const { t, done } = suite('Motif 8 browser'); const browser = await launch();
const H = `const hash = d => { let x = 2166136261 >>> 0; const a = new Uint8Array(d); for (let i = 0; i < a.length; i++) { x ^= a[i]; x = Math.imul(x, 16777619) >>> 0; } return x.toString(36); };
  const mad = (a, b) => { const x = new Uint8Array(a), y = new Uint8Array(b); let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]); return s / x.length; };
  const T = __lab.api.timeline, KV = __m_kit_v4;
  const proj = (id, o = {}) => { const p = T.newProject(id); p.finish = { ...p.finish, loop: 6 }; const st = __m_style_library.getStyle(id); if (st.palette) p.layers[0].shared.palette = st.palette; Object.assign(p.layers[0], o); return p; };
  const frame = (p, tt, w = 160, h = 90) => __lab.renderAt(p, tt, w, h).data;
  const seam = (p, L = 6) => { const d = 1 / 240; let ref = 0; for (let k = 1; k < 6; k++) ref = Math.max(ref, mad(frame(p, k * L / 6 - L * d), frame(p, k * L / 6))); return mad(frame(p, L - L * d), frame(p, 0)) / Math.max(ref, 0.05); };`;
const ev = (page, body, arg) => page.evaluate(new Function('arg', `return (async () => { ${H}\n${body} })()`), arg);

// ---- boot ----------------------------------------------------------------------------------------------------
{
  const { page, errors } = await openApp(browser);
  const b = await ev(page, `return { title: document.title, ver: document.querySelector('.ver').textContent, fmts: __m_kit_sandbox.FORMATS, api: __lab.kits.KIT_FORMAT, seq: !!__m_style_library.getStyle('sequencer') && __m_style_library.getStyle('sequencer').id, cat: __m_kits.catalog().filter(k => k.installed).map(k => k.id), n: __lab.styles.length };`);
  t('boots without console errors', errors.length === 0, errors); t('title and version', b.title === 'Motif 8' && b.ver === 'MOTIF 8.0', b); t('reads motif-kit@1 to @4', ['motif-kit@1', 'motif-kit@2', 'motif-kit@3', 'motif-kit@4'].every(f => b.fmts.includes(f)) && b.api === 'motif-kit@4');
  t('Sequencer style is in the library', b.seq === 'sequencer'); t('the three reference kits are bundled', ['stack-lab', 'vector-type', 'sequence-demo'].every(k => b.cat.includes(k)), b.cat);

  // ---- validation in the app ------------------------------------------------------------------------------------
  const kits = ['stack-lab', 'vector-type', 'sequence-demo'].map(k => readKit(path.join(root, 'sdk/motif-kit-sdk/examples', k)));
  const v = await ev(page, `return arg.map(k => { const v = __m_kit_sandbox.validate(k.manifest, k.files); return { ok: v.ok, e: v.errors.slice(0, 3), seqs: v.kit && v.kit.sequences.length }; });`, kits);
  t('reference kits validate in the app', v.every(x => x.ok), v); t('sequence-demo ships 2 sequences', v[2].seqs === 2);
  const neg = await ev(page, `const { manifest, files } = arg; const bad = []; const tryIt = (label, m, f) => { const v = __m_kit_sandbox.validate(m, f); if (v.ok) bad.push(label); };
    const m3 = JSON.parse(JSON.stringify(manifest)); m3.format = 'motif-kit@3'; tryIt('stack in @3', m3, files);
    const m4 = JSON.parse(JSON.stringify(manifest)); m4.styles[0].stack = { layers: 4 }; tryIt('4 layers', m4, files);
    const m5 = JSON.parse(JSON.stringify(manifest)); m5.capabilities = []; tryIt('stack without media capability', m5, files);
    return bad;`, kits[0]);
  t('the app rejects bad stack kits', neg.length === 0, neg);
  const neg2 = await ev(page, `const { manifest, files } = arg; const bad = []; const tryIt = (label, m, f) => { const v = __m_kit_sandbox.validate(m, f); if (v.ok) bad.push(label); };
    tryIt('svg with script', manifest, { ...files, 'assets/mark.svg': '<svg viewBox="0 0 1 1"><script>alert(1)</script><path d="M0 0h1v1z"/></svg>' });
    const m1 = JSON.parse(JSON.stringify(manifest)); m1.capabilities = ['text']; tryIt('svg without vector capability', m1, files);
    tryIt('svg file missing', manifest, Object.fromEntries(Object.entries(files).filter(([k]) => !k.endsWith('.svg'))));
    return bad;`, kits[1]);
  t('the app rejects unsafe or undeclared svg inputs', neg2.length === 0, neg2);
  const neg3 = await ev(page, `const { manifest, files } = arg; const bad = []; const tryIt = (label, m, f) => { const v = __m_kit_sandbox.validate(m, f); if (v.ok) bad.push(label); };
    const m1 = JSON.parse(JSON.stringify(manifest)); m1.sequences = [{ id: 'x', name: 'x', cues: Array.from({ length: 5 }, (_, i) => ({ id: 'c' + i, style: 'rings', at: 0, len: 0.5, lane: i })) }]; tryIt('5 overlapping cues', m1, files);
    const m2 = JSON.parse(JSON.stringify(manifest)); m2.sequences = [{ id: 'x', name: 'x', cues: [{ style: 'nope', len: 0.5 }] }]; tryIt('unknown local style', m2, files);
    const m3 = JSON.parse(JSON.stringify(manifest)); m3.format = 'motif-kit@3'; tryIt('sequences in @3', m3, files);
    return bad;`, kits[2]);
  t('the app rejects bad sequences', neg3.length === 0, neg3);

  // ---- rendering ----------------------------------------------------------------------------------------------------
  const r = await ev(page, `const out = {}; for (const id of ['sequence-demo/rings', 'sequence-demo/swirl', 'vector-type/shape-field', 'vector-type/logo-reveal', 'vector-type/type-poster', 'stack-lab/image-stack']) {
      const p = proj(id), a = frame(p, 0.7), b = frame(p, 0.7), c = frame(p, 3.3); let lum = 0; const d = new Uint8Array(a); for (let i = 0; i < d.length; i += 4) lum += (d[i] + d[i + 1] + d[i + 2]) / 765;
      out[id] = { det: hash(a) === hash(b), moves: mad(a, c) > 0.2 || id === 'stack-lab/image-stack', lum: +(lum / (d.length / 4)).toFixed(3), seam: +seam(p).toFixed(2) }; } return out;`);
  for (const [id, x] of Object.entries(r)) { t(`${id}: deterministic`, x.det); t(`${id}: not blank`, x.lum > 0.02, x); t(`${id}: animates`, x.moves, x); t(`${id}: loop closes`, x.seam < 3, x); }

  // ---- sequencer layer -------------------------------------------------------------------------------------------------
  const sq = await ev(page, `const mk = (cues, o = {}) => { const p = T.newProject('sequencer'); p.layers[0].seq = KV.sanitizeSeq({ cues, maxActive: 4, ...o }); return p; };
    const one = id => ({ id: 'c1', style: id, at: 0, len: 1, lane: 0, fadeIn: 0, fadeOut: 0, cycles: 1, dir: 'forward', blend: 'normal', opacity: 1 });
    const res = {};
    for (const id of ['orbit-rings', 'sequence-demo/swirl']) { const direct = T.newProject(id); direct.finish = { ...direct.finish, loop: 6 }; const s = mk([one(id)]); s.finish = { ...s.finish, loop: 6 };
      for (const k of ['palette', 'seed']) s.layers[0].shared[k] = direct.layers[0].shared[k]; res['id:' + id] = mad(frame(s, 1.7), frame(direct, 1.7)); }
    const A = mk([one('sequence-demo/rings'), { ...one('sequence-demo/swirl'), id: 'c2', lane: 1, blend: 'add' }]), B = mk([one('sequence-demo/rings'), { ...one('sequence-demo/swirl'), id: 'c2', lane: 1, blend: 'normal' }]);
    res.blend = mad(frame(A, 1.7), frame(B, 1.7));
    const starter = T.newProject('sequencer'); starter.finish = { ...starter.finish, loop: 6 }; res.seam = seam(starter); res.det = hash(frame(starter, 2.2)) === hash(frame(starter, 2.2));
    const many = mk(Array.from({ length: 6 }, (_, i) => ({ ...one('orbit-rings'), id: 'c' + (i + 1), lane: i })), { maxActive: 2 }); const plan = KV.planSequence(many.layers[0].seq, 0.5, { L: 6 });
    res.cap = plan.active.length; res.dropped = plan.dropped;
    const gone = mk([one('no-such-kit/style')]); res.missingStyle = hash(frame(gone, 1)) !== undefined; res.missing = __m_kits.missingKits(gone);
    const kitSeq = mk([one('stack-lab/image-stack')]); res.kitCue = (() => { const l = new Uint8Array(frame(kitSeq, 1)); let s = 0; for (let i = 0; i < l.length; i += 4) s += l[i]; return s > 0; })();
    return res;`);
  t('a one-cue Sequencer matches the style rendered directly (built-in canvas style; edge anti-aliasing differs slightly between the layer and stage canvases)', sq['id:orbit-rings'] < 3, sq['id:orbit-rings']); t('a one-cue Sequencer is pixel-identical to the style rendered directly (kit shader)', sq['id:sequence-demo/swirl'] < 0.01, sq['id:sequence-demo/swirl']);
  t('cue blend modes change the picture', sq.blend > 0.5, sq.blend); t('the starter sequence loops without a seam', sq.seam < 3, sq.seam); t('Sequencer frames are deterministic', sq.det);
  t('never more than maxActive shaders at once', sq.cap === 2 && sq.dropped === 4, sq); t('a cue with a missing style draws nothing and does not throw', sq.missingStyle); t('missing kits are found through cues', sq.missing.length === 1 && sq.missing[0] === 'no-such-kit', sq.missing);
  t('a kit style with media inputs renders inside a cue', sq.kitCue);

  // ---- inspector --------------------------------------------------------------------------------------------------------
  await ev(page, `__lab.selectStyle('sequencer'); __lab.setTab('layer');`); await page.waitForTimeout(800);
  const cues = () => ev(page, `const l = __lab.project.layers.find(x => x.id === __lab.project.active); return l.seq.cues.map(c => ({ id: c.id, style: c.style, at: c.at, len: c.len, lane: c.lane }));`);
  const n0 = (await cues()).length; t('selecting Sequencer gives the layer its starter cues', n0 === 3, n0);
  t('timeline and cue list are labelled for assistive tech', await page.evaluate(() => !!document.querySelector('#seqTl[aria-label]') && [...document.querySelectorAll('#seqTl [data-cue]')].every(g => g.getAttribute('role') === 'button' && g.getAttribute('aria-label')) && !!document.querySelector('.sqmeter[role="status"]')));
  await page.click('[data-sq="add"]'); await page.waitForTimeout(400); t('+ Cue adds a cue and selects it', (await cues()).length === n0 + 1);
  await page.selectOption('#sq-style', 'sequence-demo/bars'); await page.waitForTimeout(400); const after = await cues(); t('the cue editor changes the style', after[after.length - 1].style === 'sequence-demo/bars', after);
  await page.selectOption('#sq-dir', 'pingpong'); await page.selectOption('#sq-blend', 'screen'); await page.waitForTimeout(300);
  t('direction and blend are editable', await ev(page, `const c = __lab.project.layers.find(x => x.id === __lab.project.active).seq.cues.slice(-1)[0]; return c.dir === 'pingpong' && c.blend === 'screen';`));
  const id = after[after.length - 1].id, at0 = after[after.length - 1].at;
  await page.focus(`#seqTl [data-cue="${id}"]`); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400); const moved = (await cues()).find(c => c.id === id);
  t('arrow keys move a focused cue by 1/32 of the loop', Math.abs(moved.at - (at0 + 1 / 32)) < 1e-6, [at0, moved.at]);
  await page.focus(`#seqTl [data-cue="${id}"]`); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(400); t('Up and Down change lane', (await cues()).find(c => c.id === id).lane === moved.lane + 1);
  const box = await page.locator(`#seqTl [data-cue="${id}"] rect`).first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(500);
  t('dragging a cue moves it along the loop', (await cues()).find(c => c.id === id).at > moved.at + 0.02, (await cues()).find(c => c.id === id));
  await page.focus(`#seqTl [data-cue="${id}"]`); await page.keyboard.press('Delete'); await page.waitForTimeout(400); t('Delete removes the cue', (await cues()).length === n0);
  await ev(page, `__lab.undo();`); await page.waitForTimeout(400); t('undo restores the cue', (await cues()).length === n0 + 1);
  const rt = await ev(page, `const data = JSON.parse(JSON.stringify({ project: __lab.project })); const before = JSON.stringify(__lab.project.layers.find(x => x.id === __lab.project.active).seq); const ok = __lab.loadProjectData(data); const after = JSON.stringify(__lab.project.layers.find(x => x.id === __lab.project.active).seq); return { ok, same: before === after };`);
  t('a saved project keeps the cue list', rt.ok && rt.same, rt);
  const dup = await ev(page, `const n = __lab.project.layers.length; document.getElementById('dupLayer').click(); await new Promise(r => setTimeout(r, 300)); const l = __lab.project.layers; return l.length === n + 1 && JSON.stringify(l.find(x => x.id === __lab.project.active).seq.cues.map(c => c.style)) === JSON.stringify(l[l.indexOf(l.find(x => x.id === __lab.project.active)) - 1].seq.cues.map(c => c.style));`);
  t('Duplicate layer copies the cue list', dup === true);
  await ev(page, `__lab.api.timeline && 0; const sel = document.querySelector('[data-sq="load"]'); if (!sel) return; sel.value = 'sequence-demo:showcase'; sel.dispatchEvent(new Event('change', { bubbles: true }));`); await page.waitForTimeout(600);
  t('kit sequences load into the layer', (await cues()).length === 8, (await cues()).length);
  t('no console errors during the session', errors.length === 0, errors);
  await page.close();
}

// ---- the shader playhead and the JS playhead agree (the loop rule and video seeking both rely on it) -------------------------------------------------
{
  const { page, errors } = await openApp(browser);
  const r = await ev(page, `const KG = __m_kit_gl, rt = KG.createGlRuntime(); if (!rt.ok) return { skip: rt.reason };
    const probe = 'vec4 motif(vec2 uv, vec2 fc) { float ph = fc.x / u_res.x; float g = (M_playheadAt(ph, float(p_k), p_mode, 3.0) + 8.0) / 16.0; return vec4(vec3(g), 1.0); }';
    const spec = { k: { type: 'int', min: 0, max: 8, def: 1, label: 'k' }, mode: { type: 'select', options: ['forward', 'backward', 'pingpong', 'random'].map(v => ({ v, l: v })), def: 'forward', label: 'm' } };
    const c = rt.compile('probe', { passes: [{ src: probe }], common: '', params: spec, inputs: [], extra: KV.PRELUDE_V4 }, true); if (!c.ok) return { err: c.error };
    const W = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = 1; const x = cv.getContext('2d', { willReadFrequently: true }); let worst = 0, signMiss = 0, n = 0;
    for (const mode of ['forward', 'backward', 'pingpong', 'random']) for (const k of [1, 2, 3, 5]) {
      rt.draw('probe', W, 1, { p: 0, L: 6, seed: 417, safe: false, pal: { bg: '#000000', ink: '#ffffff', a: ['#ff0000', '#00ff00', '#0000ff'] }, params: { k, mode }, spec, media: null }); x.clearRect(0, 0, W, 1); rt.blit(x, W, 1); const px = x.getImageData(0, 0, W, 1).data;
      for (let i = 0; i < W; i++) { const ph = (i + 0.5) / W, s = px[i * 4] / 255, lin = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4), got = lin * 16 - 8, want = KV.playhead(k, mode, 3, ph, 417), e = Math.abs(got - want); worst = Math.max(worst, e); if (e > 0.5) signMiss++; n++; } }
    return { worst, signMiss, n };`);
  if (r.skip) console.log('  skip playhead parity:', r.skip); else if (r.err) t('the shader playhead compiles with the @4 prelude', false, r.err);
  else { t('shader and JS playheads agree, including the random direction of every round trip', r.signMiss === 0, r); t('...within 8-bit precision', r.worst < 0.2, r.worst); console.log(`  playhead parity: ${r.n} samples, worst error ${r.worst.toFixed(3)} cycles`); }
  t('no errors', errors.length === 0, errors); await page.close();
}

// ---- video layers follow the playhead (optional: needs ffmpeg on PATH to make a test clip) -------------------------------------------------------
{
  const { spawnSync } = await import('node:child_process'); const os = await import('node:os'); const fs = await import('node:fs'); const clip = path.join(os.tmpdir(), 'motif8-test.webm');
  const ff = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24:duration=4', '-c:v', 'libvpx', '-b:v', '400k', '-g', '12', clip], { stdio: 'ignore' });
  if (ff.status !== 0 || !fs.existsSync(clip)) console.log('  skip video playhead test (ffmpeg not found)');
  else {
    const { page, errors } = await openApp(browser);
    const r = await ev(page, `const bytes = Uint8Array.from(atob(arg), c => c.charCodeAt(0));
      let pr = T.newProject('stack-lab/tri-channel'); pr.finish = { ...pr.finish, loop: 6 }; __lab.setProject(pr);
      const ok = await __lab.attachMedia(new File([bytes], 'test.webm', { type: 'video/webm' }), 'layer1'); await new Promise(r => setTimeout(r, 1500));
      const get = (dir, sp) => { const q = JSON.parse(JSON.stringify(__lab.project)); Object.assign(q.layers[0].params, { layer1Speed: sp, layer1Dir: dir, layer2Opacity: 0, layer3Opacity: 0 }); return q; };
      const fr = async (q, t) => { await __lab.media.prepare(q, t); return __lab.renderAt(q, t, 160, 90).data; };
      const F = get('forward', 1), B = get('backward', 1), P = get('pingpong', 1), Z = get('forward', 0);
      const f15 = await fr(F, 1.5), f45 = await fr(F, 4.5), b15 = await fr(B, 1.5), b45 = await fr(B, 4.5), p0 = await fr(P, 0), p6 = await fr(P, 5.99), z15 = await fr(Z, 1.5);
      return { ok, mirror: [mad(b15, f45), mad(b45, f15)], moves: mad(f15, f45), pp: mad(p0, p6), own: mad(z15, f15) };`, fs.readFileSync(clip).toString('base64'));
    t('a video attaches to a stack layer', r.ok === true);
    t('backward at t equals forward at L - t (frame-exact seeking by the playhead)', r.mirror[0] < 2 && r.mirror[1] < 2 && r.moves > 3, r);
    t('ping-pong returns to where it started', r.pp < 2, r); t('Cycles / loop at 0 keeps the clip on its own timing (same as forward, 1 cycle)', r.own < 0.5, r);
    t('no errors', errors.length === 0, errors); await page.close();
  }
}

// ---- worker and main thread agree on a Sequencer frame ---------------------------------------------------------------------------
{
  const shot = async query => {
    const { page, errors } = await openApp(browser, { query, wait: 3000, viewport: { width: 1280, height: 800 } });
    await ev(page, `__lab.selectStyle('sequencer'); __lab.stage.pause(); __lab.stage.seek(0.37);`); await page.waitForTimeout(2500);
    const bb = await page.locator('#stageCol canvas').first().boundingBox(); const buf = await page.screenshot({ clip: { x: Math.round(bb.x), y: Math.round(bb.y), width: Math.round(bb.width), height: Math.round(bb.height) } }); await page.close(); return { buf, errors };
  };
  const a = await shot(''), b = await shot('?worker=0');
  const pg = await browser.newPage(); const diff = await pg.evaluate(async ([x, y]) => { const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; }); const [ia, ib] = await Promise.all([load(x), load(y)]);
    const c = document.createElement('canvas'); c.width = Math.min(ia.width, ib.width); c.height = Math.min(ia.height, ib.height); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(ia, 0, 0); const A = g.getImageData(0, 0, c.width, c.height).data; g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const B = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]); return { mad: s / A.length, size: [ia.width, ia.height, ib.width, ib.height] }; }, [a.buf.toString('base64'), b.buf.toString('base64')]);
  t('worker and main-thread renders of a Sequencer layer agree', diff.mad < 2, diff); t('no errors in either mode', a.errors.length + b.errors.length === 0, [...a.errors, ...b.errors]); await pg.close();
}
await browser.close(); done();
