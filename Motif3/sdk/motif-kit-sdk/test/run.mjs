// SDK 1.2.5 test suite: node test/run.mjs   (GL tests need playwright + chromium; set MOTIF_CHROMIUM or skip with --no-gl)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..'), require = createRequire(import.meta.url);
const KG = new Function(fs.readFileSync(path.join(root, 'lib/kit-gl.js'), 'utf8'))();
let pass = 0, fail = 0; const t = (name, ok, extra) => { if (ok) pass++; else { fail++; console.log('  FAIL', name, extra === undefined ? '' : extra); } };
const kit = (name) => { const dir = path.join(root, 'examples', name), files = {}; const w = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) w(p); else files[path.relative(dir, p)] = fs.readFileSync(p, 'utf8'); } }; w(dir); const m = JSON.parse(files['manifest.json']); delete files['manifest.json']; return { m, files }; };
const base = () => ({ format: 'motif-kit@1', id: 'tk', name: 'T', version: '1.0.0', styles: [{ id: 'aa', name: 'A', passes: [{ src: 'a.glsl' }], params: {} }] });
const F = { 'a.glsl': 'vec4 motif(vec2 uv, vec2 fc){ return vec4(1.0); }' };

// validator
for (const k of ['stack-lab', 'vector-type', 'sequence-demo']) { const { m, files } = kit(k); const v = KG.validateKit(m, files); t(`${k} validates`, v.ok, v.errors); }
{ const m = base(); m.styles[0].stack = { layers: 3 }; const v = KG.validateKit(m, F); t('stack needs sdk 1.2.5', !v.ok && /sdk/.test(v.errors.join())); m.sdk = '1.2.5'; const v2 = KG.validateKit(m, F); t('stack ok with sdk', v2.ok, v2.errors); t('stack makes 3 inputs', v2.kit.styles[0].inputs.length === 3);
  t('stack params generated', !!v2.kit.styles[0].params.layer2Blend && v2.kit.styles[0].params.layer1PosX.part.kind === 'point');
  m.styles[0].stack = { layers: 4 }; t('stack max 3', !KG.validateKit(m, F).ok); m.styles[0].stack = { layers: 2, defaults: [{ blend: 'nope' }] }; t('bad blend rejected', !KG.validateKit(m, F).ok);
  m.sdk = '9.0.0'; t('future sdk rejected', !KG.validateKit(m, F).ok); }
{ const m = base(); m.sdk = '1.2.5'; m.styles[0].inputs = [{ id: 't', type: 'text' }, { id: 'u', type: 'text' }, { id: 'v', type: 'text' }]; t('max 2 text inputs', !KG.validateKit(m, F).ok);
  m.styles[0].inputs = [{ id: 'logo', type: 'svg', src: 'x.svg' }]; t('missing svg rejected', !KG.validateKit(m, F).ok);
  t('svg with script rejected', !KG.validateKit(m, { ...F, 'x.svg': '<svg><script>1</script></svg>' }).ok); t('clean svg ok', KG.validateKit(m, { ...F, 'x.svg': '<svg viewBox="0 0 1 1"><path d="M0 0h1v1z"/></svg>' }).ok);
  m.styles[0].inputs = [{ id: 't', type: 'text', font: 'nofont' }]; t('unknown font rejected', !KG.validateKit(m, F).ok);
  m.styles[0].inputs = [{ id: 't', type: 'text' }]; m.styles[0].params = { tSize: { type: 'range', min: 0, max: 1, def: 0.5 } }; t('param clash rejected', !KG.validateKit(m, F).ok); }

// playhead
{ const N = 400, e = (k, mode, salt) => { let m = 0; for (let i = 0; i < N; i++) { const a = KG.playhead(k, mode, salt, i / N, 417), b = KG.playhead(k, mode, salt, (i + 1) / N, 417); m = Math.max(m, Math.abs(b - a)); } return m; };
  for (const mode of [0, 1, 2, 3]) for (const k of [1, 2, 3, 5]) { const end = KG.playhead(k, mode, 1, 1, 417), st = KG.playhead(k, mode, 1, 0, 417); const closes = mode < 2 ? Math.abs(end - st) === k : Math.abs(end - st) < 1e-9; t(`playhead closes mode ${mode} k ${k}`, closes, [st, end]); t(`playhead continuous mode ${mode} k ${k}`, e(k, mode, 1) < 2.5 * k / N * 2 + 1e-6, e(k, mode, 1)); }
  t('random uses both directions', [...Array(8).keys()].some(i => KG.playhead(8, 3, 1, (i + 0.25) / 8, 417) < 0) && [...Array(8).keys()].some(i => KG.playhead(8, 3, 1, (i + 0.25) / 8, 417) > 0));
  t('speed 0 holds', KG.playhead(0, 0, 1, 0.7, 1) === 0); }

// sequencer
{ const s = (cues, o) => KG.validateSequence({ id: 'sq', loop: 8, bpm: 120, cues, ...o }, {});
  t('time units', (() => { const r = s([{ style: 'a', at: '2b', len: '1s' }]); return r.ok && Math.abs(r.seq.cues[0].at - 0.125) < 1e-9 && Math.abs(r.seq.cues[0].len - 0.125) < 1e-9; })());
  t('overlap over maxActive rejected', !s(Array.from({ length: 5 }, (_, i) => ({ id: 'c' + i, style: 'a', at: 0, len: 0.5, lane: i }))).ok);
  const r = s([{ style: 'a', at: 0.9, len: 0.2, repeat: { every: 0.3, count: 3 } }]); t('repeat expands + wraps', r.ok && r.seq.cues.length === 3 && Math.abs(r.seq.cues[1].at - 0.2) < 1e-9, r.errors);
  const p = KG.planSequence(r.seq, 0.05, {}); t('wrapped cue active across loop end', p.active.length === 1 && Math.abs(p.active[0].local - 0.75) < 1e-6, p);
  const q = s([{ style: 'a', at: 0.1, len: 0.5, cycles: 2, fadeIn: 0.1, fadeOut: 0.1 }]).seq, a0 = KG.planSequence(q, 0.1, {}).active[0], a1 = KG.planSequence(q, 0.1 + 0.5 - 1e-6, {}).active[0];
  t('cue edges: envelope 0, inner phase closes', a0.env === 0 && a1.env < 1e-6 && (Math.abs(a0.innerP - a1.innerP) < 1e-3 || Math.abs(Math.abs(a0.innerP - a1.innerP) - 1) < 1e-3), [a0, a1]);
  t('deterministic', JSON.stringify(KG.planSequence(q, 0.3, { seed: 5 })) === JSON.stringify(KG.planSequence(q, 0.3, { seed: 5 })));
  const ch = s([{ style: 'a', at: 0, len: 1, chance: 0 }]).seq; t('chance 0 never plays', KG.planSequence(ch, 0.5, {}).active.length === 0);
  t('bad dir rejected', !s([{ style: 'a', len: 0.5, dir: 'sideways' }]).ok); t('cycles must be whole', !s([{ style: 'a', len: 0.5, cycles: 1.5 }]).ok);
  t('seconds without loop rejected', !KG.validateSequence({ id: 'sq', cues: [{ style: 'a', len: '2s' }] }, {}).ok); }

// GL tests
if (!process.argv.includes('--no-gl')) {
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.log('  skip GL tests (playwright missing)'); }
  if (chromium) {
    const exe = process.env.MOTIF_CHROMIUM, browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
    const page = await browser.newPage(); await page.setContent('<canvas></canvas>'); await page.addScriptTag({ content: `window.KG = (function(){ ${fs.readFileSync(path.join(root, 'lib/kit-gl.js'), 'utf8')} })();` });
    const r = await page.evaluate(async () => {
      const rt = KG.createGlRuntime(); if (!rt.ok) return { fatal: rt.reason };
      const pal = { bg: '#000000', ink: '#ffffff', a: ['#ff0000', '#00ff00', '#0000ff'] };
      // The shader writes (playhead + 4) / 8 as grey; read back, undo sRGB, compare with the JS playhead.
      const probe = 'vec4 motif(vec2 uv, vec2 fc) { float ph = fc.x / u_res.x; float g = (M_playheadAt(ph, float(p_k), p_mode, 3.0) + 8.0) / 16.0; return vec4(vec3(g), 1.0); }';
      const spec = { k: { type: 'int', min: 0, max: 8, def: 1, label: 'k' }, mode: { type: 'select', options: ['forward', 'backward', 'pingpong', 'random'].map(v => ({ v, l: v })), def: 'forward', label: 'm' } };
      const c = rt.compile('probe', { passes: [{ src: probe }], common: '', params: spec, inputs: [], sdk: '1.2.5' }, true); if (!c.ok) return { err: c.error };
      const W = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = 1; const x = cv.getContext('2d', { willReadFrequently: true }); let worst = 0, signMiss = 0;
      for (const mode of ['forward', 'backward', 'pingpong', 'random']) for (const k of [1, 2, 3, 5]) {
        rt.draw('probe', W, 1, { p: 0, L: 6, seed: 417, safe: false, pal, params: { k, mode }, spec, media: null }); x.clearRect(0, 0, W, 1); rt.blit(x, W, 1); const px = x.getImageData(0, 0, W, 1).data;
        for (let i = 0; i < W; i++) { const ph = (i + 0.5) / W, s = px[i * 4] / 255, lin = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); // blit is sRGB-encoded; the grey was written linear
          const got = lin * 16 - 8, want = KG.playhead(k, mode, 3, ph, 417); const e = Math.abs(got - want); worst = Math.max(worst, e); if (e > 0.5) { signMiss++; (window.__bad = window.__bad || {})[mode + k] = (window.__bad[mode + k] || 0) + 1; } }
      }
      return { worst, signMiss, bad: window.__bad };
    });
    if (r.fatal) console.log('  skip GL tests:', r.fatal);
    else if (r.err) t('playhead probe compiles', false, r.err);
    else { t('shader playhead matches JS (random signs agree)', r.signMiss === 0, r); t('shader playhead within 8-bit precision', r.worst < 0.2, r.worst); }
    await browser.close();
  }
}
console.log(`  ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
