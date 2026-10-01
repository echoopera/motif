// Grade page + GPU scopes + LUTs, in a real browser.
//   SOFTWARE_GL=1 PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tests/browser/grade-check.mjs [motif7.html]
// Optional BASE_HTML=<older motif7.html>: also proves a v5 project renders bit-identically to that build (grade absent).
// Prints one JSON line of measurements, then "grade OK". Numbers under SwiftShader are not representative of a GPU.
import path from 'node:path'; import { pathToFileURL } from 'node:url'; import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '../..');
const file = process.argv[2] || 'motif7.html';
const browser = await chromium.launch({ headless: true, args: process.env.SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const R = {}; let passed = false;
const open = async (html, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts }); await ctx.route(/^https?:/, r => r.abort());
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(pathToFileURL(path.resolve(root, html)).href); await page.waitForFunction(() => window.__lab); await page.waitForTimeout(600);
  return { page, errors, ctx };
};
// In-page helpers: synthetic frames, a neutral finish, and running the finisher directly on a frame.
const HELPERS = () => {
  window.__g = {
    frame(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const d = x.createImageData(w, h); for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) { const v = fn(i, y); d.data.set([v[0], v[1], v[2], 255], (y * w + i) * 4); } x.putImageData(d, 0, 0); return c; },
    mixed(w = 256, h = 64) { return this.frame(w, h, (x, y) => [x, (x * 7 + y * 13) % 256, (x * 3 + y * 29 + 11) % 256]); },
    neutral: () => ({ ...__m_engine_core.defaults(__m_timeline.FINISH_SCHEMA), grain: 0, vignette: 0, glow: 0, chroma: 0, depth: 0 }),
    run(src, grade, f) {
      const fin = __lab.pipeline.finisher; fin.setSpace('srgb'); fin.loadInput(src, src.width, src.height);
      const ff = { ...(f || this.neutral()) }; if (grade) ff.grade = __m_timeline.sanitizeProject({ layers: [], grade }).grade;
      const out = fin.process(ff, { stops: [[0, 0, 0], [0.5, 0.5, 0.5], [1, 1, 1]], shade: [0, 0, 0], frame: 0, legal: false, zebra: false });
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(out, 0, 0); return x.getImageData(0, 0, c.width, c.height).data;
    },
    diff(a, b) { let m = 0, s = 0; for (let i = 0; i < a.length; i++) { if ((i & 3) === 3) continue; const d = Math.abs(a[i] - b[i]); m = Math.max(m, d); s += d; } return { max: m, mean: +(s / (a.length * 0.75)).toFixed(4) }; },
    cubeText(N, f) { const rows = [`LUT_3D_SIZE ${N}`]; for (let b = 0; b < N; b++) for (let g = 0; g < N; g++) for (let r = 0; r < N; r++) rows.push(f(r / (N - 1), g / (N - 1), b / (N - 1)).map(v => v.toFixed(6)).join(' ')); return rows.join('\n'); },
  };
};

try {
  // ---------------------------------------------------------------- core build
  const { page, errors } = await open(file, { reducedMotion: 'reduce' });
  await page.evaluate(HELPERS);
  R.device = await page.evaluate(() => { const gl = document.createElement('canvas').getContext('webgl2'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: gl ? gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER) : 'none', ua: navigator.userAgent.replace(/^.*(Chrome\/[\d.]+).*$/, '$1'), floatBlend: !!(gl && gl.getExtension('EXT_float_blend')) }; });

  // 1. LUT identity: every 8-bit input within 1 code value, both interpolations, 3D and 1D shaper.
  R.identity = await page.evaluate(() => {
    const G = __m_grade, src = __g.mixed(256, 64), base = __g.run(src, null);
    const id3 = G.registerLut(G.parseCube(__g.cubeText(33, (r, g, b) => [r, g, b]), 'identity33.cube'));
    const id17 = G.registerLut(G.parseCube(__g.cubeText(17, (r, g, b) => [r, g, b]), 'identity17.cube'));
    const id1 = G.registerLut(G.parseCube(['LUT_1D_SIZE 1024', ...Array.from({ length: 1024 }, (_, i) => [i, i, i].map(v => (v / 1023).toFixed(6)).join(' '))].join('\n'), 'identity1d.cube'));
    const lutGrade = (id, interp) => ({ v: 1, on: true, nodes: [{ id: 'n1', type: 'lut', lut: { id, name: 'x', size: 33 }, params: { interp } }] });
    const passthrough = __g.diff(base, __g.run(src, null, { ...__g.neutral() }));
    return { passthrough, tetra33: __g.diff(base, __g.run(src, lutGrade(id3, 'tetra'))), tri33: __g.diff(base, __g.run(src, lutGrade(id3, 'tri'))), tetra17: __g.diff(base, __g.run(src, lutGrade(id17, 'tetra'))), shaper1d: __g.diff(base, __g.run(src, lutGrade(id1, 'tetra'))),
      identityNodes: __g.diff(base, __g.run(src, { v: 1, on: true, nodes: ['primary', 'curves', 'huesat', 'qualifier', 'mixer'].map((t, i) => ({ id: 'n' + (i + 1), type: t })) })),
      bypassed: __g.diff(base, __g.run(src, { v: 1, on: false, nodes: [{ id: 'n1', type: 'primary', params: { gainY: 3 } }] })) };
  });
  for (const k of ['tetra33', 'tri33', 'tetra17', 'shaper1d', 'identityNodes']) assert.ok(R.identity[k].max <= 1, `${k}: max ${R.identity[k].max}`);
  assert.equal(R.identity.bypassed.max, 0, 'bypassed grade is bit-identical');

  // 2. Node maths on flat colours: gain, parallel average, mixer, qualifier key, missing LUT pass-through, blurred key.
  R.maths = await page.evaluate(() => {
    const px = (grade, rgb = [64, 64, 64]) => Array.from(__g.run(__g.frame(32, 32, () => rgb), grade).slice(0, 3));
    const g = nodes => ({ v: 1, on: true, nodes });
    return {
      gain2: px(g([{ id: 'n1', type: 'primary', params: { gainY: 2 } }])),
      parallelAvg: px(g([{ id: 'n1', type: 'primary', params: { gainY: 2 } }, { id: 'n2', type: 'primary', par: true, params: { gainY: 0 } }])),
      mixerHalf: px(g([{ id: 'n1', type: 'primary', params: { gainY: 3 } }, { id: 'n2', type: 'mixer', src: 'in', params: { mix: 0.5 } }])),
      opacityHalf: px(g([{ id: 'n1', type: 'primary', params: { gainY: 3, mix: 0.5 } }])),
      disabled: px(g([{ id: 'n1', type: 'primary', params: { gainY: 3, on: false } }])),
      satZero: px(g([{ id: 'n1', type: 'primary', params: { sat: 0 } }]), [200, 40, 40]),
      qualRedOnly: [px(g([{ id: 'n1', type: 'qualifier', params: { hue: 0, width: 60, qGain: 0 } }]), [200, 30, 30]), px(g([{ id: 'n1', type: 'qualifier', params: { hue: 0, width: 60, qGain: 0 } }]), [30, 200, 30])],
      qualBlur: px(g([{ id: 'n1', type: 'qualifier', params: { hue: 0, width: 60, qGain: 0, blur: 0.6 } }]), [200, 30, 30]),
      missingLut: px(g([{ id: 'n1', type: 'lut', lut: { id: 'lut_missing000000', name: 'gone.cube', size: 33 } }])),
      curveLift: px(g([{ id: 'n1', type: 'curves', params: { y0: 0.2 } }]), [0, 0, 0]),
      error: __lab.pipeline.finisher.grader.error,
    };
  });
  const near = (a, b, t = 2) => a.every((v, i) => Math.abs(v - b[i]) <= t);
  assert.ok(near(R.maths.gain2, [128, 128, 128]), 'gain 2 doubles'); assert.ok(near(R.maths.parallelAvg, [64, 64, 64]), 'parallel nodes average');
  assert.ok(near(R.maths.mixerHalf, [128, 128, 128]), 'mixer 50% over input'); assert.ok(near(R.maths.opacityHalf, [128, 128, 128]), 'node opacity');
  assert.ok(near(R.maths.disabled, [64, 64, 64]), 'disabled node'); assert.ok(near(R.maths.satZero, R.maths.satZero.map(() => R.maths.satZero[1]), 1), 'saturation 0 is grey');
  assert.ok(near(R.maths.qualRedOnly[0], [0, 0, 0], 3) && near(R.maths.qualRedOnly[1], [30, 200, 30], 2), 'qualifier keys red only');
  assert.ok(near(R.maths.qualBlur, [0, 0, 0], 3), 'blurred key on a flat field'); assert.ok(near(R.maths.missingLut, [64, 64, 64]), 'missing LUT passes through');
  assert.ok(near(R.maths.curveLift, [51, 51, 51]), 'curve black lift'); assert.equal(R.maths.error, null);

  // 3. Scopes on known synthetic frames (own instance on an OffscreenCanvas + the page's instance).
  R.scopes = await page.evaluate(() => {
    const S = __m_scopes, oc = new OffscreenCanvas(512, 256), sc = S.createScopes(oc); if (!sc.ok) return { ok: false, reason: sc.reason };
    const ramp = __g.frame(256, 144, x => [x, x, x]);
    const w = sc.update(ramp, { mode: 'wave', space: 'rec709', exact: true }); const acc = sc.read('acc');
    let worst = 0, mass = 1; for (let x = 0; x < acc.w; x += 1) { let best = -1, bv = -1, tot = 0, near = 0; for (let y = 0; y < acc.h; y++) { const v = acc.data[(y * acc.w + x) * 4]; tot += v; if (v > bv) { bv = v; best = y; } } for (let y = Math.max(0, x - 1); y <= Math.min(255, x + 1); y++) near += acc.data[(y * acc.w + x) * 4]; worst = Math.max(worst, Math.abs(best - x)); mass = Math.min(mass, near / tot); }
    const hr = sc.update(ramp, { mode: 'hist', space: 'rec709', exact: true }); const h = sc.read('hist'); let hmin = Infinity, hmax = 0; for (let i = 0; i < 256; i++) { const v = h.data[i * 4 + 3]; hmin = Math.min(hmin, v); hmax = Math.max(hmax, v); }
    // 75% colour bars → six vectorscope peaks at the graticule targets
    const bars = [[191, 0, 0], [191, 191, 0], [0, 191, 0], [0, 191, 191], [0, 0, 191], [191, 0, 191]];
    sc.update(__g.frame(240, 120, x => bars[Math.floor(x / 40)]), { mode: 'vector', space: 'rec709', exact: true }); const v = sc.read('acc');
    const vec = S.targets('rec709').map(t => { const cx = Math.round((t.x * 0.5 + 0.5) * v.w - 0.5), cy = Math.round((t.y * 0.5 + 0.5) * v.h - 0.5); let s = 0; for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) s += v.data[(y * v.w + x) * 4 + 3]; return { id: t.id, frac: +(s / (240 * 120 / 6)).toFixed(3) }; });
    // parade: a 75% red field → R third at level 191, G and B thirds at 0
    sc.update(__g.frame(96, 54, () => [191, 0, 0]), { mode: 'parade', space: 'rec709', exact: true }); const p = sc.read('acc');
    const peakRow = ch => { let best = 0, bv = -1; for (let y = 0; y < p.h; y++) { let s = 0; for (let x = Math.floor(p.w * ch / 3); x < Math.floor(p.w * (ch + 1) / 3); x++) s += p.data[(y * p.w + x) * 4 + ch]; if (s > bv) { bv = s; best = y; } } return best; };
    const p3 = sc.update(__g.frame(96, 54, () => [0, 191, 0]), { mode: 'wave', space: 'p3', exact: true }), r709 = sc.update(__g.frame(96, 54, () => [0, 191, 0]), { mode: 'wave', space: 'rec709', exact: true });
    // timing: live (320-wide grid) vs exact on a 1280×720 frame
    const big = __g.frame(1280, 720, (x, y) => [(x * 3) & 255, (y * 5) & 255, (x + y) & 255]); const t = {};
    for (const m of ['wave', 'parade', 'vector', 'hist']) { sc.update(big, { mode: m, space: 'rec709', exact: false }); const a = []; for (let i = 0; i < 5; i++) a.push(sc.update(big, { mode: m, space: 'rec709', exact: false }).ms); const e = sc.update(big, { mode: m, space: 'rec709', exact: true }); t[m] = { liveMs: +(a.sort((x, y) => x - y)[2]).toFixed(1), exactMs: +e.ms.toFixed(1), exactGrid: e.grid.join('x') }; }
    return { ok: true, acc: w.acc, waveWorstRowError: worst, waveMassWithin1: +mass.toFixed(3), histFlat: [hmin, hmax], ramp: hr.stats, rampWaveModeMedian: +w.stats.median.toFixed(3), vec, parade: [peakRow(0), peakRow(1), peakRow(2)], greenLumaMedian: { rec709: +r709.stats.median.toFixed(3), p3: +p3.stats.median.toFixed(3) }, timing: t };
  });
  assert.ok(R.scopes.ok, R.scopes.reason);
  assert.ok(R.scopes.waveWorstRowError <= 1, 'waveform rows'); assert.ok(R.scopes.waveMassWithin1 >= 0.95, 'waveform mass');
  assert.ok(R.scopes.histFlat[0] === R.scopes.histFlat[1], 'ramp histogram is flat'); assert.ok(Math.abs(R.scopes.ramp.median - 0.5) < 0.01);
  for (const t of R.scopes.vec) assert.ok(t.frac > 0.9, `vector target ${t.id}: ${t.frac}`);
  assert.deepEqual(R.scopes.parade, [191, 0, 0]); assert.notEqual(R.scopes.greenLumaMedian.rec709, R.scopes.greenLumaMedian.p3);

  // 4. Cube round-trip: bake → serialise → parse → as a LUT node it reproduces the grade.
  R.cube = await page.evaluate(() => {
    const G = __m_grade, P = __m_colour_page, src = __g.mixed(256, 64);
    const pr = __lab.project; delete pr.grade; __lab.setProject(pr);
    const idText = P.exportCube(33).text, id = G.parseCube(idText, 'id.cube'); let ide = 0; const ref = G.identityLut(33); for (let i = 0; i < ref.length; i++) ide = Math.max(ide, Math.abs(id.data3[i] - ref[i]));
    const grade = { v: 1, on: true, nodes: [{ id: 'n1', type: 'primary', params: { liftB: 0.04, gainR: 0.1, gammaY: 0.15, sat: 1.3, contrast: 1.1 } }, { id: 'n2', type: 'curves', params: { y1: 0.3, b3: 0.7 } }, { id: 'n3', type: 'huesat', params: { s2: 0.6, h4: 15 } }] };
    const p2 = __lab.project; p2.grade = grade; __lab.setProject(p2);
    const t0 = performance.now(); const ex = P.exportCube(33), bakeMs = performance.now() - t0;
    const lut = G.parseCube(ex.text, 'baked.cube'); G.registerLut(lut);
    const viaGrade = __g.run(src, grade), viaLut = __g.run(src, { v: 1, on: true, nodes: [{ id: 'n1', type: 'lut', lut: { id: lut.id, name: 'baked', size: 33 } }] });
    const re = G.parseCube(G.serializeCube(lut.data3, 33), 'again.cube'); let rt = 0; for (let i = 0; i < lut.data3.length; i++) rt = Math.max(rt, Math.abs(re.data3[i] - lut.data3[i]));
    return { identityMaxErr: ide, precision: ex.precision, bytes: ex.text.length, bakeMs: +bakeMs.toFixed(1), lutVsGrade: __g.diff(viaGrade, viaLut), reserialiseMaxErr: rt, header: ex.text.split('\n').slice(0, 5) };
  });
  assert.ok(R.cube.identityMaxErr < (R.cube.precision === 'float32' ? 1e-5 : 1 / 255 + 1e-6), 'identity bake');
  assert.ok(R.cube.lutVsGrade.max <= 3, 'baked LUT reproduces the grade'); assert.ok(R.cube.reserialiseMaxErr < 1e-6);

  // 5. Malformed LUT files → designed error state, nothing thrown, project untouched.
  R.malformed = await page.evaluate(async () => {
    const P = __m_colour_page; __lab.setTab('grade'); const before = JSON.stringify(__lab.project.grade || null); const out = [];
    const bad = [['empty.cube', ''], ['short.cube', 'LUT_3D_SIZE 2\n0 0 0\n'], ['words.cube', 'hello there'], ['nan.cube', 'LUT_3D_SIZE 2\n' + 'NaN 0 0\n'.repeat(8)], ['huge-size.cube', 'LUT_3D_SIZE 4096\n'], ['domain.cube', 'DOMAIN_MIN 1 1 1\nDOMAIN_MAX 0 0 0\nLUT_3D_SIZE 2\n' + '0 0 0\n'.repeat(8)], ['bin.cube', '\u0000\u0001\u0002'], ['x.3dl', '0 64 128\n1 2\n'], ['pic.png', 'not a png'], ['notes.docx', 'x']];
    for (const [name, text] of bad) { const r = await P.importFile(new File([text], name, { type: name.endsWith('.png') ? 'image/png' : 'text/plain' })); out.push({ name, ok: r === null && P.st.lut.kind === 'error', alert: !!document.querySelector('#panel-grade [role=alert]'), msg: P.st.lut.text }); }
    const big = await P.importFile(new File([new Uint8Array(25 * 1048576)], 'big.cube')); out.push({ name: 'big.cube (25 MB)', ok: big === null && P.st.lut.kind === 'error', msg: P.st.lut.text });
    return { cases: out, unchanged: JSON.stringify(__lab.project.grade || null) === before };
  });
  for (const c of R.malformed.cases) assert.ok(c.ok, `${c.name} rejected`); assert.ok(R.malformed.unchanged);

  // 6. A good import through the UI path adds a LUT node; preset JSON keeps grade + keys.
  R.project = await page.evaluate(async () => {
    const P = __m_colour_page, T = __m_timeline; const pr = __lab.project; delete pr.grade; __lab.setProject(pr);
    const id = await P.importFile(new File([__g.cubeText(17, (r, g, b) => [r * 0.9, g, b])], 'warm.cube'));
    const g = __lab.project.grade; const n = g.nodes[g.nodes.length - 1];
    let p = __lab.project; const nid = n.id; p = T.setKey(p, `G:${nid}:mix`, 0, 0.2); p = T.setKey(p, `G:${nid}:mix`, 0.5, 1); __lab.setProject(p);
    const back = __lab.parsePreset(__lab.presetJSON()).project;
    return { added: n.type === 'lut' && n.lut.id === id, presetKeepsGrade: JSON.stringify(back.grade) === JSON.stringify(__lab.project.grade), presetKeepsKeys: JSON.stringify(back.keys[`G:${nid}:mix`]) === JSON.stringify(__lab.project.keys[`G:${nid}:mix`]), status: P.st.lut.text };
  });
  assert.ok(R.project.added && R.project.presetKeepsGrade && R.project.presetKeepsKeys);

  // 6b. Grade channels are lockable: a locked value survives Vary, unlocked ones change.
  R.locks = await page.evaluate(async () => {
    const P = __m_colour_page; const p = __lab.project; p.grade = { v: 1, on: true, nodes: [{ id: 'n1', type: 'primary' }] }; __lab.setProject(p); __lab.setTab('grade');
    P.st.sel = 'n1'; P.render(); const btn = document.querySelector('#panel-grade [data-lock="G:n1:sat"]'); if (!btn) return { button: false }; btn.click();
    P.vary(); const a = __lab.project.grade.nodes[0].params;
    return { button: true, pressed: btn.isConnected ? btn.getAttribute('aria-pressed') : document.querySelector('#panel-grade [data-lock="G:n1:sat"]').getAttribute('aria-pressed'), satKept: a.sat === 1, othersChanged: ['contrast', 'liftR', 'gainY', 'gammaB'].some(k => a[k] !== __m_engine_core.defaults(__m_grade.schemaFor('primary'))[k]) };
  });
  assert.ok(R.locks.button && R.locks.satKept && R.locks.othersChanged, 'locks respected by Vary');

  // 7. v5 project opens unchanged; grade off renders identically (same build, full pipeline).
  R.v5 = await page.evaluate(() => {
    const T = __m_timeline, C = __m_colour; const pr = T.newProject('kaleidoscope'); pr.finish = { ...pr.finish, glow: 0.3, vignette: 0.2, grain: 0.1 };
    const v5 = JSON.parse(JSON.stringify(T.sanitizeProject(pr, C.sanitizeCustom))); const again = T.sanitizeProject(JSON.parse(JSON.stringify(v5)), C.sanitizeCustom);
    const a = __lab.renderAt(v5, 1.25, 320, 180, { cpu: true }), b = __lab.renderAt({ ...v5, grade: { v: 1, on: false, nodes: [{ id: 'n1', type: 'primary', params: { gainY: 2 } }] } }, 1.25, 320, 180, { cpu: true });
    const c = __lab.renderAt({ ...v5, grade: { v: 1, on: true, nodes: [{ id: 'n1', type: 'primary', params: { gainY: 1.4 } }] } }, 1.25, 320, 180, { cpu: true });
    return { unchanged: JSON.stringify(again) === JSON.stringify(v5), hasGrade: 'grade' in again, offDiff: __g.diff(a.data, b.data), onDiff: __g.diff(a.data, c.data), json: JSON.stringify(v5) };
  });
  assert.ok(R.v5.unchanged && !R.v5.hasGrade); assert.equal(R.v5.offDiff.max, 0); assert.ok(R.v5.onDiff.mean > 1, 'an active grade changes the frame');

  // 8. Pipeline cost of the grade at 1280×720 (median of 7, finisher only) and of the stage frame.
  R.cost = await page.evaluate(() => {
    const src = __g.frame(1280, 720, (x, y) => [x & 255, y & 255, (x ^ y) & 255]); const fin = __lab.pipeline.finisher;
    const gl = fin.canvas.getContext('webgl2'), px = new Uint8Array(4);
    const time = grade => { const a = []; for (let i = 0; i < 8; i++) { const t0 = performance.now(); fin.loadInput(src, 1280, 720); fin.process({ ...__g.neutral(), gamma: 1.01, ...(grade ? { grade: __m_timeline.sanitizeProject({ layers: [], grade }).grade } : {}) }, { stops: [[0, 0, 0], [0.5, 0.5, 0.5], [1, 1, 1]], shade: [0, 0, 0], frame: 0 }); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); a.push(performance.now() - t0); } return +(a.sort((x, y) => x - y)[3]).toFixed(1); };
    const id = __m_grade.listLuts().find(l => l.size3 === 33).id;
    const heavy = { v: 1, on: true, nodes: [{ id: 'n1', type: 'primary' }, { id: 'n2', type: 'curves' }, { id: 'n3', type: 'huesat' }, { id: 'n4', type: 'qualifier', params: { blur: 0.4 } }, { id: 'n5', type: 'lut', lut: { id, name: 'x', size: 33 } }, { id: 'n6', type: 'mixer' }] };
    const sharp = JSON.parse(JSON.stringify(heavy)); sharp.nodes[3].params.blur = 0;
    // shader (re)compile cost when the topology changes: first frame of a new graph shape minus a steady frame
    const fresh = { v: 1, on: true, nodes: [{ id: 'n1', type: 'curves' }, { id: 'n2', type: 'primary', par: true }, { id: 'n3', type: 'huesat' }] };
    const one = g => { const t0 = performance.now(); fin.loadInput(src, 1280, 720); fin.process({ ...__g.neutral(), grade: __m_timeline.sanitizeProject({ layers: [], grade: g }).grade }, { stops: [[0, 0, 0], [0.5, 0.5, 0.5], [1, 1, 1]], shade: [0, 0, 0], frame: 0 }); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return performance.now() - t0; };
    const first = one(fresh), steady = one(fresh);
    return { finishNoGradeMs: time(null), finishOnePrimaryMs: time({ v: 1, on: true, nodes: [{ id: 'n1', type: 'primary' }] }), finishSixNodesMs: time(sharp), finishSixNodesBlurKeyMs: time(heavy), newTopologyCompileMs: +(first - steady).toFixed(1) };
  });

  // 9. Keyboard-only: reach the Grade tab, switch scope, add / edit / disable / reorder / delete nodes, bypass.
  R.keyboard = await (async () => {
    const pr = await page.evaluate(() => { const p = __lab.project; delete p.grade; __lab.setProject(p); __lab.setTab('layer'); return true; });
    const k = (key, n = 1) => (async () => { for (let i = 0; i < n; i++) { await page.keyboard.press(key); await page.waitForTimeout(60); } })();
    await page.focus('#tabs [data-tab=layer]'); // starting point: the tab strip, as a keyboard user would Tab to it
    const tabs = await page.evaluate(() => [...document.querySelectorAll('#tabs [role=tab]')].filter(b => b.offsetParent).map(b => b.dataset.tab));
    await k('ArrowRight', tabs.indexOf('grade') - tabs.indexOf('layer')); await page.waitForTimeout(300);
    const onGrade = await page.evaluate(() => __lab.tab);
    let tabs2 = 0; while (tabs2 < 30 && !(await page.evaluate(() => !!document.activeElement.closest('#panel-grade')))) { await k('Tab'); tabs2++; } // Tab into the page
    const f0 = await page.evaluate(() => document.activeElement.dataset.gr + ':' + document.activeElement.dataset.v);
    await k('ArrowRight'); const mode = await page.evaluate(() => __m_colour_page.st.mode);
    await k('ArrowLeft');
    await page.focus('#panel-grade .gr-node[tabindex="0"]'); // roving focus target (reached with Tab in normal use)
    await k('n'); const menuOpen = await page.evaluate(() => !!document.querySelector('#grMenu') && document.activeElement.getAttribute('role') === 'menuitem');
    await k('Enter'); // first item: Primaries
    await k('n'); await k('ArrowDown'); await k('Enter'); // Curves after it
    const after2 = await page.evaluate(() => __lab.project.grade.nodes.map(n => n.type));
    await k('d'); const disabled = await page.evaluate(() => __lab.project.grade.nodes[1].params.on === false);
    await k('d'); await k('Alt+ArrowLeft'); const reordered = await page.evaluate(() => __lab.project.grade.nodes.map(n => n.type));
    await k('ArrowRight'); await k('p'); const parallel = await page.evaluate(() => __lab.project.grade.nodes[1].par === true);
    await k('Enter'); const editFocus = await page.evaluate(() => document.activeElement && document.activeElement.closest('details[data-g="gr-node"]') !== null);
    await page.focus('#panel-grade .gr-node[tabindex="0"]'); await k('Enter'); await page.waitForTimeout(100); const nodeSel = await page.evaluate(() => __m_colour_page.st.sel);
    const wheel = await page.$('#panel-grade .gr-pad[data-wheel=gain]'); let wheelMoved = null;
    if (wheel) { await wheel.focus(); await k('ArrowUp', 3); wheelMoved = await page.evaluate(id => __lab.project.grade.nodes.find(n => n.id === id).params.gainR, nodeSel); }
    await page.focus('#panel-grade .gr-node[tabindex="0"]'); await k('b'); const bypassed = await page.evaluate(() => __lab.project.grade.on === false); await k('b');
    const beforeDel = await page.evaluate(() => document.activeElement.dataset.fk); await k('Delete'); const left = await page.evaluate(() => __lab.project.grade.nodes.length);
    return { onGrade, tabPressesToPage: tabs2, beforeDel, firstStop: f0, modeAfterArrow: mode, menuOpen, after2, disabled, reordered, parallel, editFocus, wheelMoved, bypassed, left, focusIn: await page.evaluate(() => document.activeElement && document.activeElement.className) };
  })();
  const K = R.keyboard;
  assert.equal(K.onGrade, 'grade'); assert.equal(K.modeAfterArrow, 'parade'); assert.ok(K.menuOpen); assert.deepEqual(K.after2, ['primary', 'curves']);
  assert.ok(K.disabled); assert.deepEqual(K.reordered, ['curves', 'primary']); assert.ok(K.parallel); assert.ok(K.editFocus); assert.ok(K.wheelMoved > 0); assert.ok(K.bypassed); assert.equal(K.left, 1);

  // 10. Stage scopes run from the live frame at the inspector width; labels are DOM.
  R.page = await page.evaluate(async () => {
    const P = __m_colour_page; __lab.setTab('grade'); __lab.stage.pause(); __lab.stage.seek(0.3); await new Promise(r => setTimeout(r, 400));
    const r = P.runScope(true); const lbls = [...document.querySelectorAll('#panel-grade .gr-lbls span')].map(s => s.textContent);
    const fig = document.querySelector('#panel-grade .gr-scope').getBoundingClientRect();
    return { ms: r && +r.ms.toFixed(1), grid: r && r.grid, labels: lbls, scopeCss: [Math.round(fig.width), Math.round(fig.height)], readout: document.getElementById('grReadout').textContent, tabsOneRow: (() => { const t = [...document.querySelectorAll('#tabs [role=tab]')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect().top); return Math.max(...t) - Math.min(...t) < 2; })() };
  });
  assert.ok(R.page.labels.length >= 5 && R.page.tabsOneRow);
  R.errors = errors; assert.equal(errors.length, 0, errors.join('\n'));

  // 11. Optional: bit-identical to an older build for the same v5 project (grade absent).
  if (process.env.BASE_HTML) {
    const render = async (html) => { const o = await open(html); const d = await o.page.evaluate(json => Array.from(__lab.renderAt(JSON.parse(json), 1.25, 320, 180, { cpu: true }).data), R.v5.json); const d2 = await o.page.evaluate(json => Array.from(__lab.renderAt(JSON.parse(json), 2.5, 320, 180, {}).data), R.v5.json); await o.ctx.close(); return [d, d2]; };
    const [a, b] = [await render(process.env.BASE_HTML), await render(file)];
    const md = (x, y) => x.reduce((m, v, i) => Math.max(m, Math.abs(v - y[i])), 0);
    R.vsBase = { cpuFinishMaxDiff: md(a[0], b[0]), gpuFinishMaxDiff: md(a[1], b[1]) }; assert.equal(R.vsBase.cpuFinishMaxDiff, 0); assert.equal(R.vsBase.gpuFinishMaxDiff, 0);
  }
  delete R.v5.json;
  console.log(JSON.stringify(R));
  console.log('grade OK'); passed = true;
} finally { if (!passed) console.error('partial results:', JSON.stringify(R)); await browser.close(); }
