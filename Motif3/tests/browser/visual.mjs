// Visual regression. Renders a fixed scene set deterministically through the app's own pipeline (__lab) and compares to goldens.
//   SOFTWARE_GL=1 node tests/browser/visual.mjs                 compare against tests/golden/<renderer-class>/
//   SOFTWARE_GL=1 node tests/browser/visual.mjs --update        regenerate every golden (renders twice; unstable scenes are refused)
//   ... --only neuro/                                           restrict to scene ids containing the text (also valid with --update)
//   ... --strict                                                treat an environment mismatch (GPU/driver/fonts/engine) as failure
// Goldens are keyed by renderer class: tests/golden/swiftshader (committed) and tests/golden/real (gitignored: they differ per GPU).
// Scene set: every style x 3 fixed times, finish-stack combos, 6 aspect ratios, sRGB vs Display-P3, a multi-layer project.
import fs from 'node:fs';
import path from 'node:path';
import { encodePng, decodePng, compareImages, diffTriptych, DEFAULT_TOLERANCE } from '../../tools/imgdiff.mjs';
import { root, arg, flag, launch, openApp, gpuInfo, rendererClass, gitRev, suite } from './lib.mjs';

const TIMES = [0, 2, 4.1];            // seconds on the default 6 s loop
const STYLE_SIZE = [96, 54];
const GOLDEN_BUDGET_KB = +arg('max-golden-kb', 4096);
const cli = Object.fromEntries(['channel', 'fraction', 'mean'].filter(k => arg(k, null) != null).map(k => [k, +arg(k)]));
let TOL = { ...DEFAULT_TOLERANCE, ...cli };
const only = arg('only', null), update = flag('update'), strict = flag('strict');
const outDir = path.join(root, 'tests/visual-out');
const safe = id => id.replace(/[^\w.-]+/g, '__');

function buildScenes(styleIds) {
  const S = [];
  for (const id of styleIds) for (const t of TIMES) S.push({ id: `style/${id}@${t}`, styles: [id], finish: { grain: 0 }, t, w: STYLE_SIZE[0], h: STYLE_SIZE[1], group: 'style' });
  const base = 'neuro/mitosis', alt = 'stagger-rise';
  const fin = (name, finish, styles = [base], extra = {}) => S.push({ id: `finish/${name}`, styles, finish, t: 2, w: 160, h: 90, group: 'finish', ...extra });
  fin('none', { grain: 0, vignette: 0 });
  fin('grain-vignette', { grain: 0.6, vignette: 0.7 });
  fin('glow', { glow: 0.8, glowThreshold: 0.35, glowRadius: 0.6 });
  fin('chroma-depth-tilt', { chroma: 0.6, depth: 0.7, depthMode: 'tilt', focus: 0.3 });
  fin('depth-radial', { depth: 0.8, depthMode: 'radial', focus: 0.5 });
  fin('depth-luma', { depth: 0.8, depthMode: 'luma', focus: 0.4 });
  fin('grade-levels', { black: 0.12, white: 0.85, gamma: 1.6 });
  fin('gmap-palette', { gmap: 1, gmapMode: 'palette' });
  fin('gmap-duotone', { gmap: 1, gmapMode: 'duotone' });
  fin('gmap-ink', { gmap: 1, gmapMode: 'ink' });
  fin('motion-blur', { shutter: 270, samples: 8 }, [alt]);
  fin('motion-blur-gl-style', { shutter: 180, samples: 6 });
  fin('everything', { shutter: 180, samples: 6, glow: 0.5, glowThreshold: 0.4, chroma: 0.4, depth: 0.5, black: 0.05, gamma: 1.2, gmap: 0.4, grain: 0.3, vignette: 0.4 });
  fin('broadcast-safe', { glow: 0.5 }, [base], { output: { broadcastSafe: true } });
  S.push({ id: 'stack/three-layer-blend', styles: [alt, 'quantum/nebula-genesis', 'lissajous'], comp: [{}, { blend: 'screen', opacity: 0.8 }, { blend: 'multiply', opacity: 0.6 }], t: 2, w: 160, h: 90, group: 'stack' });
  S.push({ id: 'stack/demo-project', demo: true, t: 2, w: 160, h: 90, group: 'stack' });
  for (const [a, w, h] of [['16x9', 160, 90], ['9x16', 90, 160], ['1x1', 120, 120], ['4x5', 96, 120], ['4x3', 128, 96], ['21x9', 168, 72]])
    S.push({ id: `aspect/${a}`, styles: ['kinetic-subdivision/kinetic-treemap'], t: 2, w, h, group: 'aspect' });
  for (const sp of ['srgb', 'p3']) for (const st of ['neuro/mitosis', 'lissajous']) S.push({ id: `space/${sp}/${st}`, styles: [st], t: 2, w: 128, h: 72, space: sp, group: 'space' });
  return S;
}

// Runs in the page: renders each scene, returns { id, b64, engines, ms }.
async function renderBatch(page, scenes) {
  return page.evaluate(async scenes => {
    const lab = window.__lab, T = lab.api.timeline, out = [];
    const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
    const waitCompiles = async () => { const t0 = performance.now(); while (lab.kits.runtime.pendingCompiles && performance.now() - t0 < 10000) await new Promise(r => setTimeout(r, 30)); };
    for (const sc of scenes) {
      let pr;
      if (sc.demo) pr = lab.project;
      else {
        pr = T.newProject(sc.styles[0]);
        for (let i = 1; i < sc.styles.length; i++) pr.layers.push(T.newLayer(sc.styles[i]));
        if (sc.comp) sc.comp.forEach((c, i) => Object.assign(pr.layers[i].comp, c));
        pr.finish = { ...pr.finish, shutter: 0, ...(sc.finish || {}) };
        if (sc.space) pr.output = { ...pr.output, space: sc.space };
        if (sc.output) pr.output = { ...pr.output, ...sc.output };
      }
      lab.pipeline.renderFrame(document.createElement('canvas').getContext('2d'), 8, 8, pr, 0, {}); // trigger kit compiles
      await waitCompiles();
      let data, info, ms;
      if (sc.space === 'p3') {
        const c = document.createElement('canvas'); c.width = sc.w; c.height = sc.h;
        const x = c.getContext('2d', { colorSpace: 'display-p3', willReadFrequently: true }); const t0 = performance.now();
        info = lab.pipeline.renderFrame(x, sc.w, sc.h, pr, sc.t, { env: lab.env, space: 'p3' }); ms = performance.now() - t0;
        data = x.getImageData(0, 0, sc.w, sc.h, { colorSpace: 'display-p3' }).data;
      } else { const r = lab.renderAt(pr, sc.t, sc.w, sc.h); data = r.data; info = r.info; ms = r.ms; }
      out.push({ id: sc.id, w: sc.w, h: sc.h, b64: b64(new Uint8Array(data.buffer, data.byteOffset, data.length)), engines: [...new Set(info.engines)].join('+'), post: info.post, ms });
    }
    return out;
  }, scenes);
}
async function renderAll(page, scenes, onProgress) {
  const res = []; for (let i = 0; i < scenes.length; i += 24) { res.push(...await renderBatch(page, scenes.slice(i, i + 24))); onProgress && onProgress(res.length); }
  return res;
}
const toImg = r => ({ w: r.w, h: r.h, data: new Uint8Array(Buffer.from(r.b64, 'base64')) });

const t0 = Date.now(), s = suite('visual');
const browser = await launch();
let exit = 0;
try {
  const app = await openApp(browser);
  const { page } = app, gpu = await gpuInfo(page), cls = rendererClass(gpu);
  const fonts = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d'), probe = f => { c.font = `16px ${f}`; return +c.measureText('Motif Rendering 0123 gjqy @%').width.toFixed(2); };
    return Object.fromEntries(['sans-serif', 'serif', 'monospace', '"Arial Narrow"', 'system-ui'].map(f => [f, probe(f)]));
  });
  const styleIds = await page.evaluate(() => window.__lab.styles.map(s => s.id));
  let scenes = buildScenes(styleIds); const total = scenes.length;
  if (only) scenes = scenes.filter(sc => sc.id.includes(only));
  const goldenDir = path.join(root, 'tests/golden', cls), manifestPath = path.join(goldenDir, 'manifest.json');
  console.log(`renderer: ${gpu.renderer} · class ${cls} · ${scenes.length}/${total} scenes${update ? ' · UPDATE' : ''}`);

  let rendered = await renderAll(page, scenes, n => process.stdout.write(`\r  rendered ${n}/${scenes.length}`)); console.log();
  const pageErr = () => app.errors.concat(app.consoleErrors);

  if (update) {
    // Determinism gate: render again in the same page; scenes that differ are unstable and are not written.
    const again = await renderAll(page, scenes); const unstable = [];
    rendered = rendered.filter((r, i) => { const same = r.b64 === again[i].b64; if (!same) unstable.push(r.id); return same; });
    const flat = rendered.filter(r => { const d = toImg(r).data; let mn = 255, mx = 0; for (let i = 0; i < d.length; i += 4) { const l = d[i] + d[i + 1] + d[i + 2]; if (l < mn) mn = l; if (l > mx) mx = l; } return mx - mn < 6; }).map(r => r.id);
    if (flat.length) console.log(`note: ${flat.length} scene(s) render a flat image (check they are meant to): ${flat.join(', ')}`);
    fs.mkdirSync(goldenDir, { recursive: true });
    const manifest = fs.existsSync(manifestPath) && only ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { scenes: {} };
    if (!only) for (const f of fs.readdirSync(goldenDir)) if (f.endsWith('.png')) fs.unlinkSync(path.join(goldenDir, f));
    for (const r of rendered) {
      const png = encodePng(r.w, r.h, toImg(r).data); fs.writeFileSync(path.join(goldenDir, safe(r.id) + '.png'), png);
      manifest.scenes[r.id] = { file: safe(r.id) + '.png', w: r.w, h: r.h, engines: r.engines, post: r.post, bytes: png.length };
    }
    Object.assign(manifest, { schema: 1, rendererClass: cls, renderer: gpu.renderer, software: gpu.software, browser: browser.version(), fonts, tolerance: TOL, times: TIMES, generated: new Date().toISOString(), revision: gitRev(), note: 'Generated by tests/browser/visual.mjs --update. Goldens differ per GPU: only the swiftshader class is committed.' });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
    const files = fs.readdirSync(goldenDir).filter(f => f.endsWith('.png')), kb = files.reduce((a, f) => a + fs.statSync(path.join(goldenDir, f)).size, 0) / 1024;
    console.log(`wrote ${rendered.length} goldens · ${files.length} files, ${kb.toFixed(0)} KB total in ${path.relative(root, goldenDir)} (budget ${GOLDEN_BUDGET_KB} KB)`);
    if (unstable.length) { console.error(`UNSTABLE (differ between two renders in one page, not written): ${unstable.join(', ')}`); exit = 1; }
    if (kb > GOLDEN_BUDGET_KB) { console.error(`golden set ${kb.toFixed(0)} KB exceeds budget ${GOLDEN_BUDGET_KB} KB`); exit = 1; }
    if (pageErr().length) { console.error('page errors:', pageErr()); exit = 1; }
  } else {
    if (!fs.existsSync(manifestPath)) {
      const msg = `no goldens for renderer class "${cls}" (${path.relative(root, goldenDir)}); run with --update`;
      if (cls === 'swiftshader' || strict) { s.check('visual:goldens-present', false, msg); exit = 1; } else { console.log('SKIP  ' + msg); s.info('visual:skipped', msg); }
    } else {
      const man = JSON.parse(fs.readFileSync(manifestPath, 'utf8')), env = [];
      if (man.renderer !== gpu.renderer) env.push(`GPU/driver "${man.renderer}" -> "${gpu.renderer}"`);
      if (JSON.stringify(man.fonts) !== JSON.stringify(fonts)) env.push(`font metrics differ (text styles may drift): ${JSON.stringify(man.fonts)} -> ${JSON.stringify(fonts)}`);
      if (man.browser !== browser.version()) env.push(`browser ${man.browser} -> ${browser.version()} (informational)`);
      const hardEnv = env.filter(e => !e.endsWith('(informational)'));
      TOL = { ...DEFAULT_TOLERANCE, ...man.tolerance, ...cli }; const results = [], missing = [];
      for (const r of rendered) {
        const g = man.scenes[r.id]; if (!g) { missing.push(r.id); continue; }
        const exp = decodePng(fs.readFileSync(path.join(goldenDir, g.file))), act = toImg(r), cmp = compareImages(exp, act, TOL);
        results.push({ id: r.id, ...cmp, engineChanged: g.engines !== r.engines ? `${g.engines} -> ${r.engines}` : null, exp, act });
      }
      const failing = results.filter(r => !r.ok).sort((a, b) => b.fraction - a.fraction || b.mean - a.mean);
      const worst = [...results].sort((a, b) => b.fraction - a.fraction || b.mean - a.mean).slice(0, 8);
      fs.rmSync(outDir, { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true });
      for (const f of failing.slice(0, 40)) { const tri = diffTriptych(f.exp, f.act, TOL); fs.writeFileSync(path.join(outDir, `diff-${safe(f.id)}.png`), encodePng(tri.w, tri.h, tri.data)); }
      const brief = r => ({ id: r.id, ok: r.ok, differingPct: +(r.fraction * 100).toFixed(3), meanErr: +r.mean.toFixed(3), maxDelta: r.maxDelta, reason: r.reason, engineChanged: r.engineChanged });
      const report = { rendererClass: cls, renderer: gpu.renderer, tolerance: TOL, compared: results.length, failed: failing.length, missingGoldens: missing, environmentNotes: env, worst: worst.map(brief), failing: failing.map(brief), goldenRevision: man.revision, ms: Date.now() - t0 };
      fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
      console.log(`compared ${results.length} scenes: ${results.length - failing.length} within tolerance, ${failing.length} outside · tolerance channel>${TOL.channel}, <=${(TOL.fraction * 100).toFixed(2)}% pixels, mean<=${TOL.mean}`);
      console.log('worst 5:'); for (const w of worst.slice(0, 5)) console.log(`  ${w.id}  ${(w.fraction * 100).toFixed(3)}% differ · mean ${w.mean.toFixed(3)} · max ${w.maxDelta}`);
      if (env.length) console.log('environment notes:\n  ' + env.join('\n  '));
      const changedEng = results.filter(r => r.engineChanged); if (changedEng.length) console.log(`engine path changed for ${changedEng.length} scene(s), e.g. ${changedEng[0].id}: ${changedEng[0].engineChanged}`);
      const envMismatch = hardEnv.length > 0 || changedEng.length > 0;
      s.check('visual:no-page-errors', pageErr().length === 0, pageErr().join(' | '));
      s.check('visual:goldens-complete', missing.length === 0, missing.length ? `${missing.length} scene(s) without golden, e.g. ${missing.slice(0, 3).join(', ')}; run --update --only <id>` : `${results.length} scenes`);
      if (failing.length && envMismatch && !strict) { s.info('visual:env-mismatch', `${failing.length} scene(s) outside tolerance but the environment differs from the goldens (${hardEnv.concat(changedEng.length ? ['engine path'] : []).join('; ')}); NOT VERIFIED. Regenerate goldens on this class of machine or rerun with --strict`); console.log('NOT VERIFIED: environment differs from goldens; differences are not treated as regressions without --strict'); }
      else s.check('visual:within-tolerance', failing.length === 0, failing.length ? `${failing.length} scenes; artifacts in tests/visual-out (worst: ${failing[0].id})` : `${results.length} scenes`);
      exit = s.failed.length ? 1 : 0;
      fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(s.summary({ rendererClass: cls, compared: results.length, failedScenes: failing.length, envMismatch, goldenKB: Math.round(fs.readdirSync(goldenDir).filter(f => f.endsWith('.png')).reduce((a, f) => a + fs.statSync(path.join(goldenDir, f)).size, 0) / 1024) })));
    }
  }
} finally { await browser.close(); }
console.log(`visual ${exit ? 'FAILED' : 'done'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(exit);
