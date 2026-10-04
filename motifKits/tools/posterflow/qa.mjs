// Posterflow QA: playbook gates run headless against the kit.  node qa.mjs [--media img.png] [--out dir]
//   seam, pops, flash audit (worst case: 1 s loop at 4x tempo), every param at min/max (dead, blank, non-finite),
//   quality exposure, aspect ratios, palettes, no-media fallback, transition endpoints, effect alpha, timing.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(HERE, '../../src/posterflow');
const SDK = process.env.MOTIF_SDK || path.resolve(HERE, '../../../Motif3/sdk/motif-kit-sdk-4.0.0');
const args = process.argv.slice(2); const flag = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const OUT = path.resolve(flag('out') || path.join(HERE, 'qa-out')); fs.mkdirSync(OUT, { recursive: true });
const files = {}; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'previews') walk(p); } else if (/\.(glsl|json|md|txt|svg)$/i.test(f)) files[path.relative(KIT, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } }; walk(KIT);
const src = fs.readFileSync(path.join(SDK, 'lib/kit-gl.js'), 'utf8');
const media = flag('media') ? 'data:image/png;base64,' + fs.readFileSync(flag('media')).toString('base64') : null;
const require = createRequire(path.join(SDK, 'package.json')); const { chromium } = require('playwright');
const browser = await chromium.launch({ ...(process.env.MOTIF_CHROMIUM ? { executablePath: process.env.MOTIF_CHROMIUM } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(); await page.setContent('<canvas id="c"></canvas>');
await page.addScriptTag({ content: `window.KG = (function(){ ${src} })();` });
const res = await page.evaluate(async ({ files, media }) => {
  const KG = window.KG, V = KG.validateKit(JSON.parse(files['manifest.json']), files); if (!V.ok) return { fatal: V.errors };
  const kit = V.kit, rt = KG.createGlRuntime(); if (!rt.ok) return { fatal: rt.reason };
  const W = 216, H = 384, tmp = document.createElement('canvas'), tx = tmp.getContext('2d', { willReadFrequently: true });
  const mk = (w, h) => { tmp.width = w; tmp.height = h; };
  // test source: the supplied image, else a procedural card with soft + hard content
  const srcC = document.createElement('canvas'); srcC.width = 720; srcC.height = 1280; { const x = srcC.getContext('2d');
    if (media) { const im = new Image(); im.src = media; await im.decode(); const s = Math.max(720 / im.width, 1280 / im.height); x.drawImage(im, (720 - im.width * s) / 2, (1280 - im.height * s) / 2, im.width * s, im.height * s); }
    else { const g = x.createLinearGradient(0, 0, 720, 1280); g.addColorStop(0, '#0b1d4d'); g.addColorStop(.4, '#d63a78'); g.addColorStop(.7, '#f6a04a'); g.addColorStop(1, '#101a3a'); x.fillStyle = g; x.fillRect(0, 0, 720, 1280); for (let i = 0; i < 40; i++) { x.fillStyle = `hsla(${(i * 47) % 360},70%,${30 + (i * 13) % 50}%,.7)`; x.beginPath(); x.arc((i * 331) % 720, (i * 577) % 1280, 30 + (i * 29) % 120, 0, 7); x.fill(); } } }
  const bakeFor = (w, h) => { const sw = srcC.width, sh = srcC.height, ar = w / h; let cw = sw, ch = sh; if (sw / sh > ar) cw = sh * ar; else ch = sw / ar; const c = document.createElement('canvas'); c.width = Math.round(cw); c.height = Math.round(ch); c.getContext('2d').drawImage(srcC, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, c.width, c.height); return { canvas: c, rev: 1, w: sw, h: sh, time: 0 }; };
  const other = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#0B1E3B'); g.addColorStop(1, '#F2C14E'); x.fillStyle = g; x.fillRect(0, 0, w, h); return { canvas: c, rev: 1, w, h, time: 0 }; };
  const md = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4 * 3); };
  const stats = d => { let l = 0, l2 = 0, n = d.length / 4, bad = 0, a = 0; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 765; l += v; l2 += v * v; a += d[i + 3]; } const m = l / n; return { mean: m, sd: Math.sqrt(Math.max(0, l2 / n - m * m)), alpha: a / n / 255 }; };
  const out = [], issues = [];
  const all = [...kit.styles, ...kit.effects, ...kit.transitions];
  for (const st of all) {
    const rec = { id: st.localId, kind: st.kind || 'style', checks: {}, fails: [], warns: [] };
    const pal = kit.palettes.find(p => p.id === 'posterflow.' + st.palette) || kit.palettes[0];
    const c = rt.compile(st.id, { passes: st.passes, common: kit.common, params: st.params, inputs: st.inputs || [], ...(st.runtime || {}) });
    if (!c.ok) { rec.fails.push('compile: ' + c.error); out.push(rec); continue; }
    const defs = P0 => Object.fromEntries(Object.entries(st.params).map(([k, s]) => [k, s.def]));
    const base = defs();
    const R = (o = {}) => { const w = o.w || W, h = o.h || H, p = o.p == null ? .37 : o.p; mk(w, h); const b = o.nomedia ? null : (st.inputs && st.inputs.length ? { source: bakeFor(w, h) } : null);
      const ext = st.kind === 'effect' ? { input: bakeFor(w, h) } : st.kind === 'transition' ? { from: bakeFor(w, h), to: other(w, h) } : null;
      rt.draw(st.id, w, h, { p, L: o.L || 6, seed: o.seed || 417, safe: true, pal: o.pal || pal, params: o.params || base, spec: st.params, media: b, ext, progress: o.progress == null ? p : o.progress }); tx.clearRect(0, 0, w, h); rt.blit(tx, w, h); return tx.getImageData(0, 0, w, h).data; };
    const isT = st.kind === 'transition';
    // 1 seam + pops (styles and effects)
    if (!isT) {
      const d = 1 / 240, z = R({ p: 0 }), e = R({ p: 1 - d }), one = R({ p: 1 });
      const N = 24; let frames = []; for (let k = 0; k < N; k++) frames.push(R({ p: k / N })); const steps = []; for (let k = 0; k < N; k++) steps.push(md(frames[k], frames[(k + 1) % N]));
      const med = [...steps].sort((a, b) => a - b)[N >> 1], mx = Math.max(...steps); const fine = md(R({ p: 0.5 - d }), R({ p: .5 }));
      rec.checks.seamExact = +md(z, one).toFixed(3); rec.checks.seamNext = +md(z, e).toFixed(3); rec.checks.stepMedian = +med.toFixed(2);
      rec.checks.pop = +(mx / Math.max(med, 0.05)).toFixed(2);
      if (rec.checks.seamExact > 1.5) rec.fails.push(`loop seam Δ${rec.checks.seamExact} (p=0 vs p=1)`);
      if (rec.checks.pop > 6) rec.fails.push(`pop ×${rec.checks.pop}`); else if (rec.checks.pop > 3) rec.warns.push(`pop ×${rec.checks.pop}`);
      // 2 flash audit: worst case 1 s loop at 4x tempo = 0.25 s effective loop, 60 fps, 4x4 tiles, 2 s
      const tiles = 16, series = Array.from({ length: tiles }, () => []); const L = .25, fps = 60, T = 2;
      for (let f = 0; f < fps * T; f++) { const p = ((f / fps) / L) % 1, d2 = R({ p, L, w: 128, h: 228 }); const w2 = 128, h2 = 228;
        for (let ty = 0; ty < 4; ty++) for (let tx2 = 0; tx2 < 4; tx2++) { let s = 0, n = 0; for (let y = ty * h2 / 4; y < (ty + 1) * h2 / 4; y += 3) for (let x = tx2 * w2 / 4; x < (tx2 + 1) * w2 / 4; x += 3) { const i = (Math.floor(y) * w2 + Math.floor(x)) * 4, lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; s += .2126 * lin(d2[i]) + .7152 * lin(d2[i + 1]) + .0722 * lin(d2[i + 2]); n++; } series[ty * 4 + tx2].push(s / n); } }
      let bad = 0, worst = 0; for (const s of series) { let flashes = 0, dir = 0, ref = s[0]; for (let i = 1; i < s.length; i++) { const dl = s[i] - s[i - 1]; if (Math.abs(dl) >= .1 && Math.sign(dl) !== dir) { if (dir !== 0) flashes++; dir = Math.sign(dl); } } const fps3 = flashes / T; worst = Math.max(worst, fps3); if (fps3 > 3) bad++; }
      rec.checks.flashTiles = bad; rec.checks.flashWorst = +worst.toFixed(1); if (bad >= 4) rec.fails.push(`flash audit: ${bad} tiles > 3/s`); else if (bad >= 1) rec.warns.push(`flash audit: ${bad} tiles > 3/s`);
      // 3 params at min / max
      const dead = [], broken = []; const frame0 = R({}); const gate = (k, P) => { const s = st.params[k].show; if (!s) return P; const g = st.params[s.param]; if ('is' in s) P[s.param] = [].concat(s.is)[0]; else if ('not' in s) { const o = (g.options || []).map(x => x.v).find(v => ![].concat(s.not).includes(v)); if (o != null) P[s.param] = o; } else if ('gt' in s) P[s.param] = Math.max(s.gt + 1, g.def); return P; };
      for (const [k, sp] of Object.entries(st.params)) {
        const vals = sp.type === 'toggle' ? [!sp.def] : sp.type === 'select' ? sp.options.map(o => o.v).filter(v => v !== sp.def) : [sp.min, sp.max]; let best = 0;
        const refP = gate(k, { ...base }), ref = md(frame0, frame0) === 0 ? R({ params: refP }) : frame0;
        for (const v of vals) { const P = gate(k, { ...base }); P[k] = v; const d = R({ params: P }); const s = stats(d); best = Math.max(best, md(d, ref));
          if (!(s.mean > .004 && s.mean < .996) || s.sd < .004 || s.alpha < .99 || !isFinite(s.mean)) broken.push(`${k}=${typeof v === 'number' ? +v.toFixed(3) : v} (mean ${s.mean.toFixed(3)}, sd ${s.sd.toFixed(3)})`); }
        if (best < .25 && !(sp.part && sp.part.kind === 'color')) dead.push(`${k} (Δ${best.toFixed(2)})`);
      }
      rec.checks.deadParams = dead; rec.checks.brokenExtremes = broken; if (broken.length) rec.fails.push('blank/non-finite at: ' + broken.join('; ')); if (dead.length) rec.warns.push('weak/dead params: ' + dead.join(', '));
      // 4 quality exposure
      const qk = ['taps', 'steps', 'radius'].filter(k => st.params[k] && st.params[k].type === 'int'); for (const k of qk) { const lo = stats(R({ params: { ...base, [k]: st.params[k].min } })).mean, hi = stats(R({ params: { ...base, [k]: st.params[k].max } })).mean; const r = hi / Math.max(lo, 1e-3); rec.checks['quality_' + k] = +r.toFixed(2); if (Math.abs(r - 1) > .15) rec.warns.push(`quality ${k}: exposure ×${r.toFixed(2)} min→max`); }
      // 5 aspect + palettes + fallback + seeds + tempo
      for (const [n, w, h] of [['1:1', 256, 256], ['16:9', 384, 216], ['4:5', 240, 300]]) { const s = stats(R({ w, h })); if (s.sd < .004) rec.fails.push('blank at ' + n); if (!isFinite(s.mean)) rec.fails.push('non-finite at ' + n); }
      for (const p of kit.palettes) { const s = stats(R({ pal: p })); if (s.sd < .004 || s.mean < .004 || s.mean > .996) rec.fails.push('blank with palette ' + p.id); }
      if (st.inputs && st.inputs.length) { const nm = R({ nomedia: true }), s = stats(nm); rec.checks.fallbackSd = +s.sd.toFixed(3); rec.checks.fallbackMean = +s.mean.toFixed(3); if (s.sd < .02) rec.fails.push('no-media fallback is flat'); const wm = R({}); rec.checks.mediaResponse = +md(nm, wm).toFixed(1); if (md(nm, wm) < 2) rec.fails.push('ignores media'); }
      for (const sd of [1, 9999]) if (stats(R({ seed: sd })).sd < .004) rec.fails.push('blank at seed ' + sd);
      for (const L of [.5, 30]) if (stats(R({ L })).sd < .004) rec.fails.push('blank at L=' + L);
      // 6 timing relative (SwiftShader)
      const t0 = performance.now(); for (let i = 0; i < 4; i++) R({ p: i / 4, w: 360, h: 640 }); rec.checks.msPerMpx = +((performance.now() - t0) / 4 / (360 * 640 / 1e6)).toFixed(0);
    } else {
      const from = bakeFor(W, H), to = other(W, H); const ref = (b) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(b.canvas, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; };
      const d0 = md(R({ progress: 0 }), ref(from)), d1 = md(R({ progress: 1 }), ref(to)); rec.checks.endpoint0 = +d0.toFixed(2); rec.checks.endpoint1 = +d1.toFixed(2);
      if (d0 > 1.5) rec.fails.push(`progress 0 differs from 'from' by Δ${d0.toFixed(2)}`); if (d1 > 1.5) rec.fails.push(`progress 1 differs from 'to' by Δ${d1.toFixed(2)}`);
      const mid = stats(R({ progress: .5 })); if (mid.sd < .004) rec.fails.push('blank at mid-transition');
    }
    if (st.kind === 'effect') { const s = stats(R({})); rec.checks.alpha = +s.alpha.toFixed(3); if (s.alpha < .99) rec.warns.push('alpha < 1 on an opaque input: ' + s.alpha.toFixed(3)); }
    out.push(rec);
  }
  return { out };
}, { files, media });
await browser.close();
if (res.fatal) { console.error('fatal', res.fatal); process.exit(2); }
let nf = 0, nw = 0; const lines = ['# Posterflow QA', '', `Kit ${files['manifest.json'].match(/"version": "([^"]+)"/)[1]} · ${res.out.length} entries · ${new Date().toISOString().slice(0, 10)}`, '', '| entry | seam | pop | flash | min/max | result |', '| --- | --- | --- | --- | --- | --- |'];
for (const r of res.out) { nf += r.fails.length; nw += r.warns.length; const c = r.checks; lines.push(`| ${r.id} | ${c.seamExact ?? '–'} | ${c.pop ?? '–'} | ${c.flashTiles ?? '–'} | ${c.brokenExtremes ? (c.brokenExtremes.length ? '✖' : '✓') : '–'} | ${r.fails.length ? '✖ ' + r.fails.join(' · ') : r.warns.length ? '⚠ ' + r.warns.join(' · ') : '✓'} |`); }
lines.push('', `**${nf} failures, ${nw} warnings.**`); fs.writeFileSync(path.join(OUT, 'qa-report.md'), lines.join('\n') + '\n'); fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify(res.out, null, 1));
console.log(lines.join('\n')); process.exit(nf ? 1 : 0);
