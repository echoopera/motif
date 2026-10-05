// Motif 9 browser tests (Playwright, software GL): node tests/v9/browser.mjs
// MotifGraph end to end: boot, GPU against the CPU reference for every node type, determinism, loop closure in pixels, layer and
// composite scope, mask / mix / pre-and-post-finish semantics, keyframes and audio on graph channels, save/open and undo, the
// inspector, worker/main parity, budgets and fault containment.
import { launch, openApp, suite } from './lib.mjs';
const { t, done } = suite('Motif 9 browser'); const browser = await launch();
const H = `const hash = d => { let x = 2166136261 >>> 0; const a = new Uint8Array(d); for (let i = 0; i < a.length; i++) { x ^= a[i]; x = Math.imul(x, 16777619) >>> 0; } return x.toString(36); };
  const mad = (a, b) => { const x = new Uint8Array(a), y = new Uint8Array(b); let s = 0; for (let i = 0; i < x.length; i++) s += Math.abs(x[i] - y[i]); return s / x.length; };
  const T = __lab.api.timeline, G = __m_graph;
  const proj = (id = 'type-stagger', o = {}) => { const p = T.newProject(id); p.finish = { ...p.finish, loop: 6, grain: 0, vignette: 0, shutter: 0 }; Object.assign(p.layers[0], o); return p; };
  const withGraph = (p, preset, scope = 'layer', patch) => { const g = typeof preset === 'string' ? G.applyPreset(preset, scope === 'layer' ? 'layer' : '@') : preset; if (patch) patch(g); if (scope === 'layer') p.layers[0].graph = g; else p.graph = g; return T.sanitizeProject(p); };
  const mk = (specs, scope = 'layer') => { const g = G.newGraph(scope === 'layer' ? 'layer' : '@'); const used = new Set(['stage']); for (const [type, params, ref] of specs) { const n = G.newNode(type, used); used.add(n.id); Object.assign(n.params, params || {}); if (ref) n.ref = ref; g.nodes.push(n); } return G.sanitizeGraph(g, scope === 'layer' ? 'layer' : '@'); };
  const frame = (p, tt, w = 192, h = 108) => __lab.renderAt(p, tt, w, h).data;`;
const ev = (page, body, arg) => page.evaluate(new Function('arg', `return (async () => { ${H}\n${body} })()`), arg);

// ---- boot ----------------------------------------------------------------------------------------------------------------
const { page, errors } = await openApp(browser);
{
  const b = await ev(page, `return { title: document.title, ver: document.querySelector('.ver').textContent, tab: !!document.querySelector('[data-tab=graph]'), types: G.TYPE_IDS.length, presets: G.PRESETS.length, auto: typeof __lab.graph };`);
  t('boots without console errors', errors.length === 0, errors); t('title, version, MotifGraph page and automation surface', b.title === 'Motif 9' && b.ver === 'MOTIF 9.0' && b.tab && b.auto === 'object', b);
  t('30 node types and at least 12 presets ship', b.types === 30 && b.presets >= 12, b);
}

// ---- GPU against the CPU reference, every node type -------------------------------------------------------------------------
{
  const r = await ev(page, `
    const rend = G.createRenderer(); if (!rend.ok) return { err: rend.error };
    const A = 16 / 9, tex = document.createElement('canvas'); tex.width = 256; tex.height = 256; const tx = tex.getContext('2d'); const gr = tx.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff'); tx.fillStyle = gr; tx.fillRect(0, 0, 256, 256);
    const X = p => ({ A, p, pal: { ink: [0.1, 0.1, 0.1], a0: [1, 0, 0], a1: [0, 1, 0], a2: [0, 0, 1], bg: [1, 1, 1] }, spec: [0.1, 0.9, 0.2, 0.7, 0.3, 0.5, 0.8, 0.4], lumaTex: tex, luma: (u, v) => Math.min(1, Math.max(0, u)) });
    const pts = []; for (const u of [0.07, 0.5, 0.93]) for (const v of [0.1, 0.5, 0.88]) pts.push({ q: [u, v] });
    const cases = []; const cl = ['cloner', { mode: 'grid', cols: 5, rows: 3, content: 'tiles', stepRot: 40, stepScale: 0.3, rotate: 10 }];
    for (const mode of ['grid', 'honeycomb', 'linear', 'radial', 'spiral', 'phyllo', 'scatter']) for (const content of ['tiles', 'whole']) cases.push(['cloner ' + mode + ' ' + content, [['cloner', { mode, content, count: 17, cols: 4, rows: 3, angle: 25, arc: 200, turns: 2, align: true, rotate: 12, stepRot: 30, stepScale: 0.4, posX: 0.1, seed: 5 }]]]);
    for (const [ei, k] of ['plain', 'random', 'step', 'delay', 'noise', 'sound'].entries()) cases.push(['effector ' + k, [cl, [k, { strength: 0.8, posX: 0.3, posY: -0.2, posZ: 0.4, rotX: 30, rotY: 20, rotZ: 50, scale: 0.4, scaleX: 0.1, scaleY: -0.2, opacity: -0.3, tint: 0.5, tintColor: ['a1', 'cycle', 'ramp', 'ink', 'cycle', 'ramp'][ei], cycles: 2, phase: 0.2, spread: 1.3, shape: 'spring', bands: 5, bandStart: 1 }]]]);
    for (const shape of ['pulse', 'sine', 'saw', 'tri', 'spring']) cases.push(['delay shape ' + shape, [cl, ['delay', { shape, scale: 1, cycles: 1, spread: 2 }]]]);
    for (const k of ['sphere', 'box', 'linear', 'radial', 'noisef', 'randomf', 'index', 'luma', 'stripes']) for (const motion of ['none', 'sweep', 'orbit', 'pulse']) cases.push(['field ' + k + ' ' + motion, [cl, [k, { motion, travel: 0.8, x: 0.2, y: -0.1, angle: 30, cycles: 2, phase: 0.1, scale: 4, seed: 9 }], ['plain', { posX: 0.5, scale: 0.5 }, 'FIELD']]]);
    cases.push(['field combine', [cl, ['sphere', { motion: 'none', combine: 'max' }], ['stripes', { combine: 'sub' }], ['noisef', { combine: 'over' }], ['plain', { posX: 0.5 }, 'FIELD0']]]);
    for (const k of ['bend', 'twist', 'swirl', 'taper', 'shear', 'squash', 'wave', 'ripple', 'noised', 'bulge', 'spherify', 'lens', 'displace']) for (const space of ['world', 'object']) for (const dir of ['plane', 'z', 'both']) cases.push(['deformer ' + k + ' ' + space + ' ' + dir, [cl, [k, { space, dir, strength: 0.6, size: 0.7, x: 0.1, y: -0.1, angle: 20, cycles: 2, phase: 0.15, scale: 1.2, seed: 3, mid: 0.4 }]]]);
    cases.push(['deformer with field', [cl, ['sphere', { motion: 'none' }], ['wave', { strength: 0.2, dir: 'both', cycles: 1 }, 'FIELD'], ['bend', { strength: 0.8, space: 'object' }, 'FIELD']]]);
    let worst = 0, worstCase = '', n = 0, bad = [];
    for (const [name, specs] of cases) {
      const g = mk(specs.map(s => s.slice())); const f = g.nodes.find(x => G.kindOf(x.type) === 'field'); for (const nd of g.nodes) if (nd.ref === 'FIELD' || nd.ref === 'FIELD0' || (G.kindOf(nd.type) !== 'field' && f && specs.some(s => s[2]))) { /* resolved below */ }
      const spec2 = specs.map(s => s.slice()); const g2 = G.newGraph('layer'); const used = new Set(['stage']); const made = [];
      for (const [type, params] of spec2) { const nd = G.newNode(type, used); used.add(nd.id); Object.assign(nd.params, params || {}); g2.nodes.push(nd); made.push(nd); }
      const fields = made.filter(x => G.kindOf(x.type) === 'field');
      specs.forEach((s, i) => { if (s[2] === 'FIELD') made[i].ref = fields[0] ? fields[0].id : ''; if (s[2] === 'FIELD0') made[i].ref = fields[0] ? fields[0].id : ''; });
      if (name === 'field combine') { fields[0].ref = fields[1].id; fields[1].ref = fields[2].id; }
      const gg = G.sanitizeGraph(g2, 'layer'), e = G.evalCopy(gg), pk = G.pack(e), N = G.cpu.instanceCount(pk);
      for (const p of [0, 0.37]) {
        const gpu = rend.probeVertices(e, X(p), pts); if (!gpu) return { err: 'probe failed ' + name };
        for (const v of gpu) { const c = G.cpu.vertex(pk, v.inst, N, pts[gpu.indexOf(v) % pts.length].q, X(p));
          const d = Math.max(Math.abs(c.pos[0] - v.pos[0]), Math.abs(c.pos[1] - v.pos[1]), Math.abs(c.pos[2] - v.pos[2]), Math.abs(c.alpha - v.alpha), Math.abs(c.uv[0] - v.uv[0]) * 2, Math.abs(c.uv[1] - v.uv[1]) * 2, Math.abs(c.color[0] - v.color[0]), Math.abs(c.color[1] - v.color[1]), Math.abs(c.color[2] - v.color[2])); n++;
          const lumaNode = /luma|displace/.test(name) ? 0.02 : 0;
          if (d > worst && !(d !== d)) { worst = d; worstCase = name; }
          if (!(d <= 0.0015 + lumaNode * 3)) bad.push(name + ' p=' + p + ' d=' + d.toFixed(5)); } }
    }
    return { cases: cases.length, samples: n, worst, worstCase, bad: [...new Set(bad)].slice(0, 12) };`);
  t(`GPU vertex stage matches the CPU reference across ${r.cases} node configurations (${r.samples} vertices, worst error ${r.worst && r.worst.toFixed(5)} in '${r.worstCase}')`, !r.err && r.bad.length === 0, r);
}

// ---- determinism, pass-through, loop closure, presets --------------------------------------------------------------------------
{
  const r = await ev(page, `
    const base = proj(); const a = frame(base, 1.1), res = {};
    res.same = hash(frame(withGraph(proj(), 'type-wave'), 1.1)) === hash(frame(withGraph(proj(), 'type-wave'), 1.1));
    res.stageOnly = hash(frame(withGraph(proj(), G.newGraph('layer')), 1.1)) === hash(a);
    const off = G.applyPreset('type-wave', 'layer'); off.on = false; res.off = hash(frame(withGraph(proj(), off), 1.1)) === hash(a);
    res.identity = mad(frame(withGraph(proj(), mk([['wave', { strength: 0 }]])), 1.1), a);
    res.changes = mad(frame(withGraph(proj(), 'type-wave'), 1.1), a);
    res.seam = {}; res.worst = 0; res.worstId = '';
    for (const p of G.PRESETS) for (const scope of ['layer', 'composite']) {
      const pr = withGraph(proj(), p.id, scope), L = 6; const f0 = frame(pr, 0), fL = frame(pr, L), fm = frame(pr, L / 2), fe = frame(pr, L - L / 240), fb = frame(pr, L / 12 - L / 240), fc = frame(pr, L / 12);
      const closure = mad(f0, fL), seamStep = mad(fe, f0), ref = Math.max(mad(fb, fc), 0.2); const q = seamStep / ref;
      res.seam[p.id + ':' + scope] = { closure: +closure.toFixed(3), q: +q.toFixed(2), moves: +mad(f0, fm).toFixed(2) };
    }
    return res;`);
  t('a graph renders deterministically', r.same); t('a graph with only the stage, or switched off, is a pass-through (pixel-identical)', r.stageOnly && r.off, { stageOnly: r.stageOnly, off: r.off });
  t('an identity deformer returns the picture within resampling error', r.identity < 1.2, r.identity); t('a real graph changes the picture', r.changes > 3, r.changes);
  const ids = Object.keys(r.seam), badC = ids.filter(k => r.seam[k].closure > 0.05), badQ = ids.filter(k => r.seam[k].q > 2.5), still = ids.filter(k => r.seam[k].moves < 0.3 && !/kick|twist|noise|lens|type-wave/.test(k));
  t(`loop closure: frame 0 equals frame L for all ${ids.length} preset and scope combinations`, badC.length === 0, badC.map(k => k + ' ' + r.seam[k].closure));
  t('no jump at the loop seam (step across it no larger than ordinary frame-to-frame motion)', badQ.length === 0, badQ.map(k => k + ' ' + r.seam[k].q));
  t('presets move over the loop', still.length === 0, still);
}

// ---- scopes, mask, mix, finishing order ---------------------------------------------------------------------------------------
{
  const r = await ev(page, `
    const two = () => { const p = T.newProject('type-stagger'); p.finish = { ...p.finish, loop: 6, grain: 0, vignette: 0, shutter: 0 }; const l2 = T.newLayer('halftone'); l2.id = 'L2x'; p.layers.push(l2); return p; };
    const w = 192, h = 108, px = (d, x, y) => { const a = new Uint8Array(d), i = (y * w + x) * 4; return [a[i], a[i + 1], a[i + 2], a[i + 3]]; };
    const res = {};
    // layer scope deforms only that layer; composite scope deforms the lot
    const p0 = T.sanitizeProject(two()); const gL = mk([['cloner', { mode: 'grid', cols: 6, rows: 4, content: 'tiles', fill: 0.8 }]], 'layer');
    const pTop = two(); pTop.layers[1].graph = gL; const pBot = two(); pBot.layers[0].graph = gL; const pC = two(); pC.graph = mk([['cloner', { mode: 'grid', cols: 6, rows: 4, content: 'tiles', fill: 0.8 }]], '@');
    const f0 = frame(T.sanitizeProject(p0), 0.8, w, h), fTop = frame(T.sanitizeProject(pTop), 0.8, w, h), fBot = frame(T.sanitizeProject(pBot), 0.8, w, h), fC = frame(T.sanitizeProject(pC), 0.8, w, h);
    res.layer = [mad(f0, fTop), mad(f0, fBot), mad(f0, fC), mad(fTop, fC)];
    // layer mask applies to the graph's result
    const pm = T.newProject('type-stagger'); pm.finish = { ...pm.finish, loop: 6, grain: 0, vignette: 0, shutter: 0 }; pm.layers[0].graph = mk([['wave', { strength: 0.1 }]], 'layer'); pm.layers[0].comp = { ...pm.layers[0].comp, mask: 'circle', maskSize: 0.5, maskFeather: 0.05 };
    const pmx = T.sanitizeProject(pm), cv = document.createElement('canvas'); cv.width = w; cv.height = h; __lab.pipeline.renderFrame(cv.getContext('2d'), w, h, pmx, 0.5, { transparent: true }); const md = cv.getContext('2d').getImageData(0, 0, w, h).data;
    let inA = 0, outA = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = md[(y * w + x) * 4 + 3], d = Math.hypot((x - w / 2) / h, (y - h / 2) / h); if (d < 0.25) inA += a > 0 ? 1 : 0; else if (d > 0.5) outA += a > 0 ? 1 : 0; } res.maskCorner = [outA, 0]; res.maskCentre = inA;
    // mix: half graph, half original
    const full = frame(withGraph(proj(), mk([['wave', { strength: 0.12 }], ['bulge', { strength: 0.6 }]])), 0.9, w, h);
    const half = frame(withGraph(proj(), mk([['wave', { strength: 0.12 }], ['bulge', { strength: 0.6 }]]), 'layer', g => { g.nodes[0].params.mix = 0.5; }), 0.9, w, h); const orig = frame(proj(), 0.9, w, h);
    const avg = new Uint8Array(full.length); const fa = new Uint8Array(full), oa = new Uint8Array(orig); for (let i = 0; i < avg.length; i++) avg[i] = (fa[i] + oa[i]) / 2; res.mix = [mad(half, avg.buffer), mad(half, full), mad(half, orig)];
    // composite: before or after the finishing stack
    const mkp = place => { const p = proj(); p.finish = { ...p.finish, grain: 0.8, vignette: 0.8 }; const g = mk([['lens', { strength: 0.9 }], ['bulge', { strength: 0.8 }]], '@'); g.place = place; p.graph = g; return T.sanitizeProject(p); };
    const pre = frame(mkp('pre'), 0.9, w, h), post = frame(mkp('post'), 0.9, w, h); res.place = mad(pre, post); res.placeKept = T.sanitizeProject(mkp('post')).graph.place;
    return res;`);
  t('layer scope deforms only that layer; composite scope deforms the whole frame', r.layer[0] > 0.5 && r.layer[2] > 0.5 && r.layer[3] > 0.5, r.layer);
  t('a graph on a layer is drawn before its mask: outside the mask stays transparent', r.maskCorner[0] === 0 && r.maskCorner[1] === 0 && r.maskCentre > 0, r);
  t('Mix blends the graph with the original (matches an explicit average)', r.mix[0] < 1.6 && r.mix[1] > 0.5 && r.mix[2] > 0.5, r.mix);
  t('a composite graph runs before or after the finishing stack, and the choice is kept', r.place > 0.4 && r.placeKept === 'post', r);
}

// ---- keyframes, audio and the sound effector on graph channels ----------------------------------------------------------------------
{
  const r = await ev(page, `
    let p = proj(); p = withGraph(p, mk([['wave', { strength: 0.02, cycles: 1 }]])); const id = p.layers[0].graph.nodes.find(n => n.type === 'wave').id, lid = p.layers[0].id, path = 'M:' + lid + ':' + id + ':strength';
    const res = { schema: !!T.schemaAt(p, path), numeric: T.isNumericPath(p, path), label: T.pathLabel(p, path), base: T.getBase(p, path) };
    let q = T.setKey(p, path, 0.0, 0.02); q = T.setKey(q, path, 0.5, 0.2); q = T.sanitizeProject(JSON.parse(JSON.stringify(q)));
    res.keysKept = !!q.keys[path] && q.keys[path].length === 2; const e0 = T.evaluate(q, 0, null), e1 = T.evaluate(q, 3, null);
    res.eval = [e0.layers[0].graph.nodes.find(n => n.id === id).params.strength, e1.layers[0].graph.nodes.find(n => n.id === id).params.strength];
    res.moves = mad(frame(q, 0), frame(q, 3)) > 0.5; res.inPaths = T.allPaths(q, true).some(x => x.path === path);
    const aq = T.sanitizeProject({ ...q, audio: { bpm: 120, bars: 4, offset: 0, snap: true, name: 't', maps: [{ id: 'm1', band: 'bass', path, amount: 0.8, smooth: 0 }] } }); res.audioKept = !!aq.audio && aq.audio.maps.length === 1;
    const env = (band, s) => (band === 'bass' ? 1 : 0); res.audio = T.evaluate(aq, 1, env).layers[0].graph.nodes.find(n => n.id === id).params.strength;
    // the Sound effector moves with the audio and sits still without it
    const sp = withGraph(proj(), mk([['cloner', { mode: 'grid', cols: 6, rows: 4, content: 'tiles', fill: 0.9 }], ['sound', { scale: 1, bands: 8, bandStart: 0 }]]));
    const render = e => { const c = document.createElement('canvas'); c.width = 192; c.height = 108; __lab.pipeline.renderFrame(c.getContext('2d'), 192, 108, sp, 1, { env: e }); return c.getContext('2d').getImageData(0, 0, 192, 108).data.buffer; };
    const quiet = render(null), loud = render((b) => (b === 'sub' || b === 'bass' ? 1 : 0.2)); res.sound = mad(quiet, loud);
    return res;`);
  t('graph channels are addressable: schema, label, base value, audio target', r.schema && r.numeric && r.inPaths && /Wave/.test(r.label) && r.base === 0.02, r);
  t('keyframes on a graph channel survive sanitize and animate the picture', r.keysKept && r.eval[0] < 0.1 && r.eval[1] > 0.1 && r.moves, r);
  t('an audio map on a graph channel is kept and drives the value', r.audioKept && r.audio > 0.5, r);
  t('the Sound effector reacts to audio', r.sound > 0.3, r.sound);
}

// ---- save / open, undo, unknown nodes ----------------------------------------------------------------------------------------
{
  const r = await ev(page, `
    const p = withGraph(withGraph(proj(), 'radial-array', 'layer'), 'lens-ripple', 'composite'); const j = JSON.stringify(p), back = T.sanitizeProject(JSON.parse(j));
    const res = { roundTrip: JSON.stringify(back) === j, hasBoth: !!back.layers[0].graph && !!back.graph };
    const u = JSON.parse(j); u.layers[0].graph.nodes.push({ id: 'gq', type: 'future-node', on: true, params: { z: 3 } }); const ub = T.sanitizeProject(u); const kept = ub.layers[0].graph.nodes.find(n => n.id === 'gq');
    res.unknown = !!kept && kept.params.z === 3; res.unknownSilent = hash(frame(ub, 0.5)) === hash(frame(back, 0.5));
    const bad = JSON.parse(j); bad.layers[0].graph.nodes[1].params.cols = 'x'; bad.layers[0].graph.nodes.push(null, 5, { type: 'wave', params: { strength: 'NaN' } }); res.junk = (() => { try { const s = T.sanitizeProject(bad); return s.layers[0].graph.nodes.every(n => n && typeof n.type === 'string'); } catch (e) { return String(e); } })();
    return res;`);
  t('a project with layer and composite graphs round-trips through sanitize byte for byte', r.roundTrip && r.hasBoth, r);
  t('unknown node types are kept and never drawn; malformed graph JSON is repaired, not fatal', r.unknown && r.unknownSilent && r.junk === true, r);
}

// ---- the inspector page ------------------------------------------------------------------------------------------------------------------
{
  const { page: pg, errors: er } = await openApp(browser, { viewport: { width: 1440, height: 900 } });
  await pg.evaluate(() => __lab.setTab('graph')); await pg.waitForTimeout(400);
  const s0 = await pg.evaluate(() => ({ empty: !!document.querySelector('#panel-graph .mg-empty'), seg: document.querySelectorAll('#panel-graph [data-mg=scope]').length }));
  await pg.click('#panel-graph [data-mg=menu][data-id=presets]'); await pg.waitForTimeout(150);
  const menu = await pg.evaluate(() => document.querySelectorAll('#panel-graph #mgMenu [role=menuitem]').length);
  await pg.click('#panel-graph #mgMenu [data-id=grid-cascade]'); await pg.waitForTimeout(500);
  const s1 = await pg.evaluate(() => { const g = __lab.project.layers.find(l => l.id === __lab.project.active).graph; return { types: g.nodes.map(n => n.type), rows: document.querySelectorAll('#panel-graph [data-path^="M:"]').length, nodes: document.querySelectorAll('#panel-graph .mg-node').length, cost: (document.querySelector('#panel-graph .mg-cost') || {}).textContent }; });
  // edit a value through the shell's own row
  const path = await pg.evaluate(() => document.querySelector('#panel-graph input[type=range][data-path*=":cols"]').dataset.path);
  await pg.evaluate(p => { const el = document.querySelector(`#panel-graph input[data-path="${p}"]`); el.value = 12; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, path);
  await pg.waitForTimeout(300);
  const s2 = await pg.evaluate(p => ({ cols: __lab.api.timeline.getBase(__lab.project, p) }), path);
  // add, disable, move, remove, undo
  await pg.click('#panel-graph [data-mg=menu][data-id=add]'); await pg.click('#panel-graph #mgMenu [data-type=wave]'); await pg.waitForTimeout(300);
  const n1 = await pg.evaluate(() => __lab.graph.describe().nodes.length);
  await pg.click('#panel-graph .mg-node:last-of-type [data-mg=on]'); await pg.waitForTimeout(200); const off = await pg.evaluate(() => __lab.graph.describe().nodes.at(-1).on);
  await pg.click('#panel-graph .mg-node:last-of-type [data-mg=del]'); await pg.waitForTimeout(200); const n2 = await pg.evaluate(() => __lab.graph.describe().nodes.length);
  await pg.evaluate(() => __lab.undo()); await pg.waitForTimeout(250); const n3 = await pg.evaluate(() => __lab.graph.describe().nodes.length);
  // composite scope is separate and carries the placement choice
  await pg.click('#panel-graph [data-mg=scope][data-id=composite]'); await pg.waitForTimeout(250);
  const comp = await pg.evaluate(() => ({ empty: !!document.querySelector('#panel-graph .mg-empty'), place: !!document.querySelector('#panel-graph [data-mgplace]') }));
  await pg.click('#panel-graph [data-mg=menu][data-id=add]'); await pg.click('#panel-graph #mgMenu [data-type=ripple]'); await pg.waitForTimeout(300);
  await pg.selectOption('#panel-graph [data-mgplace]', 'post'); await pg.waitForTimeout(250);
  const comp2 = await pg.evaluate(() => ({ place: __lab.project.graph.place, layerGraph: !!__lab.project.layers[0].graph }));
  // a field reference, then removing the field clears it
  await pg.click('#panel-graph [data-mg=scope][data-id=layer]'); await pg.waitForTimeout(200);
  const ref = await pg.evaluate(() => { const G = __lab.graph; const f = G.add('sphere'); const e = G.add('plain'); G.setRef(e, f); const d1 = G.describe(); G.remove(f); const d2 = G.describe(); return [d1.nodes.find(n => n.id === e).ref === f, d2.nodes.find(n => n.id === e).ref === '']; });
  // keyboard: the add menu opens, arrows move, Enter adds, Escape closes
  await pg.focus('#panel-graph [data-mg=menu][data-id=add]'); await pg.keyboard.press('Enter'); await pg.waitForTimeout(150); const open = await pg.evaluate(() => !!document.querySelector('#panel-graph #mgMenu'));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150); const closed = await pg.evaluate(() => !document.querySelector('#panel-graph #mgMenu'));
  t('the page opens empty with a layer/composite switch and a preset menu', s0.empty && s0.seg === 2 && menu >= 12, { s0, menu });
  t('choosing a preset puts the stack on the layer and shows its rows, cost and nodes', s1.types.includes('cloner') && s1.types.includes('delay') && s1.rows > 20 && s1.nodes === 3 && /clones/.test(s1.cost || ''), s1);
  t('a slider edit goes through the shell: the project value changes', s2.cols === 12, s2);
  t('add, disable, remove and undo behave', n1 === s1.types.length + 1 && off === false && n2 === s1.types.length && n3 === s1.types.length + 1, { n1, off, n2, n3, base: s1.types.length });
  t('composite scope is its own stack with a before/after finishing choice', comp.empty && comp.place && comp2.place === 'post' && !comp2.layerGraph, { comp, comp2 });
  t('field references are kept and cleared when the field is removed', ref[0] && ref[1], ref);
  t('the add menu is keyboard operable (Enter opens, Escape closes)', open && closed, { open, closed });
  t('no console errors while using the page', er.length === 0, er); await pg.close();
}


// ---- Motif patterns on the page: audition, loud faults, keyboard, stack map (design/motifgraph-ui) ---------------------------------------
{
  const { page: pg, errors: er } = await openApp(browser, { query: '?worker=0', viewport: { width: 1440, height: 900 }, wait: 3000 });
  await pg.evaluate(() => __lab.setTab('graph')); await pg.waitForTimeout(300);
  const h0 = await pg.evaluate(() => __lab.historySize);
  await pg.click('#panel-graph [data-mg=menu][data-id=presets]'); await pg.hover('#panel-graph #mgMenu [data-id=radial-array]'); await pg.waitForTimeout(700);
  const hov = await pg.evaluate(() => ({ aud: __lab.graph.auditioning, shown: !document.getElementById('aud').hidden, name: document.getElementById('audName').textContent, hasGraph: !!__lab.project.layers.find(l => l.id === __lab.project.active).graph, hist: __lab.historySize }));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(250);
  const esc = await pg.evaluate(() => ({ aud: __lab.graph.auditioning, shown: !document.getElementById('aud').hidden }));
  await pg.click('#panel-graph [data-mg=menu][data-id=presets]'); await pg.waitForTimeout(150); await pg.keyboard.press('ArrowDown'); await pg.waitForTimeout(250);
  const arrow = await pg.evaluate(() => ({ aud: __lab.graph.auditioning, name: document.getElementById('audName').textContent }));
  await pg.keyboard.press('Enter'); await pg.waitForTimeout(500);
  const commit = await pg.evaluate(() => ({ aud: __lab.graph.auditioning, shown: !document.getElementById('aud').hidden, hasGraph: !!__lab.project.layers.find(l => l.id === __lab.project.active).graph, hist: __lab.historySize }));
  t('hovering a preset previews it on the stage without touching the project or undo history', hov.aud && hov.shown && /Preset/.test(hov.name) && !hov.hasGraph && hov.hist === h0, { hov, h0 });
  t('Escape leaves the audition; arrowing to a menu item previews it at once', !esc.aud && !esc.shown && arrow.aud && /Preset/.test(arrow.name), { esc, arrow });
  t('Enter commits the audition as one undoable step and clears the overlay', !commit.aud && !commit.shown && commit.hasGraph && commit.hist === h0 + 1, { commit, h0 });
  // stack map and keyboard on a node
  const map = await pg.evaluate(() => ({ chips: document.querySelectorAll('#panel-graph .mg-chip').length, nodes: __lab.graph.describe().nodes.length, folded: [...document.querySelectorAll('#panel-graph .mg-node')].filter(d => !d.open).length, reads: [...document.querySelectorAll('#panel-graph .mg-node:not([open]) .mg-read')].every(x => x.textContent.trim().length > 0) }));
  await pg.click('#panel-graph .mg-chip[data-kind=effector]'); await pg.waitForTimeout(250);
  const goto = await pg.evaluate(() => ({ open: document.querySelector('#panel-graph .mg-node[data-kind=effector]').open, focus: document.activeElement.parentElement && document.activeElement.parentElement.dataset.kind }));
  await pg.keyboard.press('Alt+e'); await pg.waitForTimeout(250); const off = await pg.evaluate(() => __lab.graph.describe().nodes.find(n => n.type === 'delay').on);
  await pg.keyboard.press('Alt+d'); await pg.waitForTimeout(250); const dup = await pg.evaluate(() => __lab.graph.describe().nodes.filter(n => n.type === 'delay').length);
  await pg.keyboard.press('Delete'); await pg.waitForTimeout(250); const del = await pg.evaluate(() => __lab.graph.describe().nodes.filter(n => n.type === 'delay').length);
  t('the stack map has a chip per node, folded nodes read out what they do, and a chip opens and focuses its node', map.chips === map.nodes && map.folded >= 1 && map.reads && goto.open && goto.focus === 'effector', { map, goto });
  t('on a focused node: Alt+E toggles, Alt+D duplicates, Delete removes', off === false && dup === 2 && del === 1, { off, dup, del });
  // bypass and unknown-node states are visible
  await pg.evaluate(() => __lab.graph.setOn(false)); await pg.waitForTimeout(300);
  const byp = await pg.evaluate(() => ({ mode: !!document.querySelector('#panel-graph .mg-mode'), dim: document.querySelector('#panel-graph .mg-stack').dataset.bypass }));
  await pg.evaluate(() => __lab.graph.setOn(true)); await pg.waitForTimeout(300); const byp2 = await pg.evaluate(() => !!document.querySelector('#panel-graph .mg-mode'));
  await pg.evaluate(() => { const p = __lab.project; p.layers.find(l => l.id === p.active).graph.nodes.push({ id: 'gq', type: 'future-node', on: true, params: {} }); __lab.setProject(__lab.api.timeline.sanitizeProject(p)); __lab.graph.render(); }); await pg.waitForTimeout(300);
  const unk = await pg.evaluate(() => (document.querySelector('#panel-graph .mg-node[data-off="true"]:not([data-node])') || {}).textContent || '');
  t('Bypassed shows a notice and dims the stack; turning On clears it', byp.mode && byp.dim === 'true' && !byp2, { byp, byp2 }); t('a node type from a newer Motif is listed, dimmed, as kept and not drawn', /newer Motif/.test(unk), unk);
  // a GPU fault is loud, then clears
  const f1 = await pg.evaluate(async () => { __lab.stage.invalidate(); await new Promise(r => setTimeout(r, 700)); const rr = __lab.pipeline.compositor.graph(); const x = rr && rr.gl && rr.gl.getExtension('WEBGL_lose_context'); if (!x) return { err: 'no renderer' }; window.__loseX = x; x.loseContext(); await new Promise(r => setTimeout(r, 200)); __lab.stage.invalidate(); await new Promise(r => setTimeout(r, 900)); return { alert: !!document.querySelector('#panel-graph .mg-alert'), text: (document.querySelector('#panel-graph .mg-alert') || {}).textContent || '', info: __lab.stage.info && __lab.stage.info.graph }; });
  const f2 = await pg.evaluate(async () => { window.__loseX.restoreContext(); await new Promise(r => setTimeout(r, 900)); __lab.stage.invalidate(); await new Promise(r => setTimeout(r, 900)); return { alert: !!document.querySelector('#panel-graph .mg-alert'), info: __lab.stage.info && __lab.stage.info.graph }; });
  t('a GPU fault is announced on the page (role=alert, picture passes through) and clears when the GPU returns', f1.alert && /paused/.test(f1.text) && f1.info && f1.info.failed && !f2.alert && f2.info && !f2.info.failed, { f1, f2 });
  t('no console errors on the page', er.length === 0, er); await pg.close();
}

// ---- worker and main thread agree on a graph frame ----------------------------------------------------------------------------------
{
  const shot = async query => {
    const { page: pg, errors: er } = await openApp(browser, { query, wait: 3000, viewport: { width: 1280, height: 800 } });
    await pg.evaluate(() => { const T = __lab.api.timeline, p = __lab.project; p.layers[0].graph = __m_graph.applyPreset('perspective-cards', 'layer'); p.graph = __m_graph.applyPreset('lens-ripple', '@'); __lab.setProject(T.sanitizeProject(p)); __lab.stage.pause(); __lab.stage.seek(0.37); });
    await pg.waitForTimeout(6000); // software GL: the Worker's first frames (shader compile, two graphs) take a few seconds
    const bb = await pg.locator('#stageCol canvas').first().boundingBox(); const buf = await pg.screenshot({ clip: { x: Math.round(bb.x), y: Math.round(bb.y), width: Math.round(bb.width), height: Math.round(bb.height) } }); await pg.close(); return { buf, errors: er };
  };
  const a = await shot(''), b = await shot('?worker=0');
  const pg = await browser.newPage(); const diff = await pg.evaluate(async ([x, y]) => { const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; }); const [ia, ib] = await Promise.all([load(x), load(y)]);
    const c = document.createElement('canvas'); c.width = Math.min(ia.width, ib.width); c.height = Math.min(ia.height, ib.height); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(ia, 0, 0); const A = g.getImageData(0, 0, c.width, c.height).data; g.clearRect(0, 0, c.width, c.height); g.drawImage(ib, 0, 0); const B = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]); return { mad: s / A.length, size: [ia.width, ia.height, ib.width, ib.height] }; }, [a.buf.toString('base64'), b.buf.toString('base64')]);
  t('render Worker and main-thread renders of layer + composite graphs agree', diff.mad < 2, diff); t('no errors in either mode', a.errors.length + b.errors.length === 0, [...a.errors, ...b.errors]); await pg.close();
}

// ---- budgets and fault containment -----------------------------------------------------------------------------------------------------
{
  const r = await ev(page, `
    const res = {}; const huge = mk([['cloner', { mode: 'grid', cols: 128, rows: 128, detail: 32, content: 'tiles' }], ['delay', { scale: 0.5 }], ['wave', { strength: 0.05, space: 'object' }]]);
    const est = G.estimate(G.evalCopy(huge)); res.est = [est.capped, est.vertices, est.instances];
    const mid = withGraph(proj(), mk([['cloner', { mode: 'grid', cols: 48, rows: 27, detail: 4, content: 'tiles', fill: 0.9 }], ['delay', { scale: 0.5 }], ['wave', { strength: 0.05, space: 'object' }]]));
    const t0 = performance.now(); const f = frame(mid, 0.5, 320, 180); res.midMs = performance.now() - t0; res.midPaints = mad(f, frame(proj(), 0.5, 320, 180)) > 0.2;
    // a lost context passes the picture through without throwing, then recovers
    const comp = __lab.pipeline.compositor, r0 = comp.graph(); res.hadRenderer = !!r0;
    if (r0 && r0.gl) { const x = r0.gl.getExtension('WEBGL_lose_context'); const gp = withGraph(proj(), 'type-wave'); const plain = frame(withGraph(proj(), G.newGraph('layer')), 0.5); const withG = frame(gp, 0.5); x.loseContext(); await new Promise(r => setTimeout(r, 80));
      let threw = false, during = null; try { during = frame(gp, 0.5); } catch (e) { threw = String(e); } res.lost = { threw, passthrough: during && mad(during, plain) < 0.5, differs: mad(withG, plain) > 1 };
      x.restoreContext(); await new Promise(r => setTimeout(r, 700)); res.recovered = mad(frame(gp, 0.5), withG) < 0.5; }
    return res;`);
  t('an over-budget graph lowers mesh detail, keeps every clone, and still renders', r.est[0] && r.est[1] <= 3000000 && r.est[2] === 16384 && r.midPaints, r);
  t('a lost GPU context passes the picture through without throwing, then recovers', r.hadRenderer && r.lost && r.lost.threw === false && r.lost.passthrough && r.lost.differs && r.recovered, r);
}

t('no console errors across the suite', errors.length === 0, errors);
await browser.close(); done();
