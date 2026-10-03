#!/usr/bin/env node
// am — AgentMotif's look-development toolchain for Motif kits (motif-kit@1, SDK 1.2).
//   am lib list                                    list GLSL modules in agent-motif/lib/glsl
//   am lib build <mod ...> --out <kit>/common.glsl [--append own.glsl]   concatenate modules (+ deps) into a kit common
//   am lib test                                    compile every module against the Motif prelude
//   am new <dir> --id <id> [--modules color,noise,post]   scaffold a kit wired to the library
//   am analyze <image> [--out dir]                 visual fingerprint + palette + technique hints of a reference
//   am compare <kit> <style> --ref <image> [--phase .37] [--mode style|layout|exact] [--params p.json] [--media img]
//   am tune <kit> <style> --ref <image> [--gens 12 --pop 10] [--only a,b | --lock a,b] [--palette ref] [--apply]
//   am qa <kit> [style ...] [--w 640 --h 360]      loop seam, motion continuity, WCAG flash count, cost, filmstrip
//   am film <kit> <style> [--seconds 6 --fps 30 --w 960 --h 540] [--params p.json] [--media img]   render a .webm
//   am frame <kit> <style> [--phase .37 --w 1280 --h 720] [--params p.json] [--media img] [--format jpg] [--name file]   render one frame
// Common flags: --out <dir> (default ./am-out), --no-media (render media styles' procedural fallback), --chromium <path>.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
// SDK 4.0 (motif-kit@4; reads @1–@3). Override with AM_SDK=<path to a motif-kit-sdk folder>.
const SDK = path.resolve(process.env.AM_SDK || path.resolve(ROOT, '../Motif3/sdk/motif-kit-sdk-4.0.0'));
const FONT_B64 = (() => { try { return fs.readFileSync(path.join(SDK, 'lib/fonts/DejaVuSans-Bold.ttf')).toString('base64'); } catch (e) { return ''; } })();
const LIB = path.join(ROOT, 'lib/glsl');
const KG_SRC = fs.readFileSync(path.join(SDK, 'lib/kit-gl.js'), 'utf8');
const KG = new Function(KG_SRC)();
const METRICS = fs.readFileSync(path.join(here, 'metrics.js'), 'utf8');

const [cmd, ...rest] = process.argv.slice(2);
const flags = {}, args = [];
const VAL = ['text', 'out', 'id', 'ref', 'phase', 'mode', 'params', 'media', 'gens', 'pop', 'only', 'lock', 'palette', 'w', 'h', 'seconds', 'fps', 'chromium', 'append', 'modules', 'phases', 'seed', 'name', 'loops', 'format'];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith('--')) { args.push(a); continue; }
  const [k, v] = a.slice(2).split('=');
  if (v !== undefined) flags[k] = v; else if (VAL.includes(k) && rest[i + 1] !== undefined && !rest[i + 1].startsWith('--')) flags[k] = rest[++i]; else flags[k] = true;
}
const die = m => { console.error(m); process.exit(1); };
const OUT = path.resolve(flags.out || 'am-out');
const ensureOut = () => fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- GLSL library
function modules() {
  const m = {};
  for (const f of fs.readdirSync(LIB).filter(f => f.endsWith('.glsl'))) {
    const src = fs.readFileSync(path.join(LIB, f), 'utf8'); const id = f.replace(/\.glsl$/, '');
    const req = ((src.match(/^\/\/ @requires(.*)$/m) || [])[1] || '').trim().split(/\s+/).filter(Boolean);
    const about = ((src.match(/^\/\/ @module \S+ — (.*)$/m) || [])[1] || '').trim();
    m[id] = { id, src, req, about };
  }
  return m;
}
function resolveModules(names) {
  const all = modules(), order = [], seen = new Set();
  const visit = n => { if (seen.has(n)) return; if (!all[n]) die(`unknown module "${n}" (have: ${Object.keys(all).join(', ')})`); seen.add(n); all[n].req.forEach(visit); order.push(n); };
  names.forEach(visit); return order.map(n => all[n]);
}
function buildCommon(names, append) {
  const mods = resolveModules(names);
  let s = `// AgentMotif library: ${mods.map(m => m.id).join(', ')} (built by am lib build; edit the kit's own code below the marker)\n`;
  for (const m of mods) s += `\n// ======== ${m.id} ========\n` + m.src.replace(/^\/\/ @(module|requires).*\n/gm, '');
  s += '\n// ======== kit ========\n';
  if (append) s += fs.readFileSync(append, 'utf8');
  return s;
}

// ---------------------------------------------------------------- kits
function readKitDir(dir) {
  const files = {};
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (!f.startsWith('.') && /\.(glsl|json|md|txt|svg)$/i.test(f)) files[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
  walk(dir);
  if (!files['manifest.json']) die(`No manifest.json in ${dir}`);
  const manifest = JSON.parse(files['manifest.json']); delete files['manifest.json'];
  return { manifest, files };
}
function loadKit(dir) {
  const raw = readKitDir(dir); const v = KG.validateKit(raw.manifest, raw.files);
  const diags = v.diagnostics || [];
  for (const d of diags) console.log(`  ${d.severity === 'error' ? 'error' : 'warn '} ${d.file || 'manifest.json'}${d.line ? ':' + d.line : ''}  ${d.message}${d.entry ? '  (' + d.entry + ')' : ''}`);
  if (!diags.length) v.warnings.forEach(w => console.log('  warn ', w));
  if (!v.ok) { if (!diags.length) v.errors.forEach(e => console.log('  error', e)); process.exit(1); }
  v.kit.renderables = KG.renderables ? KG.renderables(v.kit) : v.kit.styles;
  return { kit: v.kit, manifest: raw.manifest };
}
function readParams() {
  if (!flags.params) return {};
  const t = fs.existsSync(flags.params) ? fs.readFileSync(flags.params, 'utf8') : flags.params; const j = JSON.parse(t); return j.params || j;
}
const dataUrl = f => { const ext = path.extname(f).toLowerCase(); const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }[ext]; if (!mime) die(`${f}: use png, jpg, webp or gif`); return `data:${mime};base64,${fs.readFileSync(f).toString('base64')}`; };

// ---------------------------------------------------------------- browser
function findChromium() {
  if (flags.chromium) return flags.chromium; if (process.env.MOTIF_CHROMIUM) return process.env.MOTIF_CHROMIUM;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try { for (const d of fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().reverse()) { const p = path.join(base, d, 'chrome-linux/chrome'); if (fs.existsSync(p)) return p; } } catch (e) { /* default */ }
  return undefined;
}
function playwright() {
  for (const from of [path.join(SDK, 'package.json'), path.join(ROOT, 'package.json'), import.meta.url]) { try { return createRequire(from)('playwright'); } catch (e) { /* next */ } }
  try { return createRequire('/opt/node22/lib/node_modules/')('playwright'); } catch (e) { die('needs playwright: (cd Motif3/sdk/motif-kit-sdk && npm i)'); }
}
async function openPage() {
  const { chromium } = playwright(); const exe = findChromium();
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage(); await page.setContent('<canvas id="c"></canvas>');
  page.on('console', m => { if (m.type() === 'error') console.log('  [page]', m.text()); });
  await page.addScriptTag({ content: `window.KG = (function(){ ${KG_SRC} })();` });
  await page.addScriptTag({ content: METRICS });
  await page.addScriptTag({ content: HARNESS });
  return { browser, page };
}
// In-page harness: compile + render kit styles, bake media, read pixels, encode PNGs.
const HARNESS = `
window.H = (() => {
  const rt = KG.createGlRuntime(); let kit = null; const media = {};
  const imgs = {};
  async function img(url) { if (imgs[url]) return imgs[url]; const im = new Image(); im.src = url; await im.decode(); imgs[url] = im; return im; }
  function bake(src, w, h) { const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, ar = w / h; let cw = sw, ch = sh; if (sw / sh > ar) cw = sh * ar; else ch = sw / ar; const c = document.createElement('canvas'); c.width = Math.round(cw); c.height = Math.round(ch); c.getContext('2d').drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, c.width, c.height); return { canvas: c, rev: 1, w: sw, h: sh, time: 0 }; }
  function testCard() { const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 1280, 720); g.addColorStop(0, '#1E3A8A'); g.addColorStop(0.5, '#DB2777'); g.addColorStop(1, '#F59E0B'); x.fillStyle = g; x.fillRect(0, 0, 1280, 720); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; for (let i = 0; i <= 1280; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 720); x.stroke(); } for (let j = 0; j <= 720; j += 64) { x.beginPath(); x.moveTo(0, j); x.lineTo(1280, j); x.stroke(); } x.fillStyle = '#FFFFFF'; x.font = '700 150px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('MOTIF', 640, 360); return c; }
  function cardB() { const c = document.createElement('canvas'); c.width = 1280; c.height = 720; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 1280, 720); g.addColorStop(0, '#0B1E3B'); g.addColorStop(1, '#F2C14E'); x.fillStyle = g; x.fillRect(0, 0, 1280, 720); return c; }
  // Fallback font for text inputs, as the SDK preview does (bundled DejaVu Sans Bold).
  let fontReady = null;
  function loadFont(b64) { if (fontReady || !b64) return fontReady; const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const face = new FontFace('Motif Preview Sans', bytes.buffer); fontReady = face.load().then(f => { document.fonts.add(f); return true; }); return fontReady; }
  let textOverride = null;
  function textAtlas(q, W) { const TA = KG.textAtlas; return TA.atlasFor(q, { lines: Object.fromEntries(q.lines.map((l, i) => [l.id, { ...l, text: textOverride && textOverride[i] != null ? textOverride[i] : l.def, font: { family: 'Motif Preview Sans', weight: l.font.weight } }])) }, Math.max(W, 1024), 'am'); }
  const list = () => kit.renderables || kit.styles;
  function style(id) { const st = list().find(s => s.localId === id || s.id === id); if (!st) throw new Error('no entry ' + id + ' (have ' + list().map(s => s.localId).join(', ') + ')'); return st; }
  function compile(id) { const st = style(id); return rt.compile(st.id, { passes: st.passes, common: kit.common, params: st.params, inputs: st.inputs || [], ...(st.runtime || {}) }, true); }
  function defaults(st) { return Object.fromEntries(Object.entries(st.params).map(([k, s]) => [k, s.def])); }
  function pal(st, over) { return over || kit.palettes.find(p => p.id === st.palette) || kit.palettes[0] || { bg: '#000000', ink: '#ffffff', a: ['#35E0FF', '#FF3D9A', '#FFB547'] }; }
  const tmp = document.createElement('canvas'); const tx = tmp.getContext('2d', { willReadFrequently: true });
  // Inputs for one frame: media (user image or test card), stack layers (distinct cards), text atlases,
  // svg and text distance fields (baked by the SDK's own v4 code), and effect/transition sources.
  function inputsFor(st, W, H, o) {
    const ins = st.inputs || []; if (!ins.length && !st.kind) return { media: null, ext: null };
    const cardA = () => bake(o.mediaKey ? imgs[o.mediaKey] : (media.card || (media.card = testCard())), W, H);
    const cards = [() => cardA(), () => bake(media.b || (media.b = cardB()), W, H), () => bake(media.card || (media.card = testCard()), W, H)];
    let m = null;
    if (ins.length) {
      m = {};
      for (const q of ins) {
        if (q.type === 'svg' || q.type === 'sdf') continue;
        if (q.type === 'text') { m[q.id] = textAtlas(q, W); continue; }
        if (o.noMedia || window.__noMedia) continue;
        m[q.id] = q.stack ? cards[(q.stack - 1) % 3]() : cardA();
      }
      if (KG.v4) Object.assign(m, KG.v4.resolveSvg(ins, { w: W, h: H }) || {}, KG.v4.resolveTextSdf(ins, m, { w: W, h: H }) || {});
    }
    const ext = st.kind === 'effect' ? { input: cardA() } : st.kind === 'transition' ? { from: cardA(), to: cards[1]() } : null;
    return { media: m, ext };
  }
  function render(id, o) {
    const st = style(id); const W = o.w, H = o.h; const P = pal(st, o.pal);
    const params = Object.assign(defaults(st), o.params || {});
    const { media: m, ext } = inputsFor(st, W, H, o);
    rt.draw(st.id, W, H, { p: o.p, L: o.L || 6, seed: o.seed || 417, safe: o.safe !== false, pal: P, params, spec: st.params, media: m, ext, progress: o.progress != null ? o.progress : o.p });
    tmp.width = W; tmp.height = H; tx.fillStyle = P.bg; tx.fillRect(0, 0, W, H); rt.blit(tx, W, H); return tx.getImageData(0, 0, W, H);
  }
  async function imageData(url, maxW) { const im = await img(url); const w = Math.min(maxW || 512, im.naturalWidth), h = Math.round(im.naturalHeight * w / im.naturalWidth); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(im, 0, 0, w, h); return x.getImageData(0, 0, w, h); }
  function sheet(tiles, labels, cols) { const W = tiles[0].width, Hh = tiles[0].height, pad = 6, lab = 18; cols = cols || tiles.length; const rows = Math.ceil(tiles.length / cols); const c = document.createElement('canvas'); c.width = cols * (W + pad) + pad; c.height = rows * (Hh + pad + lab) + pad; const x = c.getContext('2d'); x.fillStyle = '#141414'; x.fillRect(0, 0, c.width, c.height); tiles.forEach((t, i) => { const cx = pad + (i % cols) * (W + pad), cy = pad + Math.floor(i / cols) * (Hh + pad + lab); x.fillStyle = '#ddd'; x.font = '12px monospace'; x.fillText(labels[i] || '', cx, cy + 13); x.putImageData(t, cx, cy + lab); }); return c.toDataURL('image/png'); }
  function fit(idata, W, H) { const c = document.createElement('canvas'); c.width = idata.width; c.height = idata.height; c.getContext('2d').putImageData(idata, 0, 0); const d = document.createElement('canvas'); d.width = W; d.height = H; const x = d.getContext('2d'); x.drawImage(c, 0, 0, W, H); return x.getImageData(0, 0, W, H); }
  // Exact reference for transition endpoints: the same graph and inputs, with the pass replaced by a pass-through.
  function identity(id, which, o) {
    const st = style(id); const key = '__id_' + which + '_' + st.id;
    const rtm = JSON.parse(JSON.stringify(st.runtime || {}));
    const src = 'vec4 motif(vec2 uv, vec2 fc) { return g_' + which + 'At(fc / u_res); }';
    if (rtm.graph) rtm.graph.passes.forEach(ps => { ps.src = src; });
    const c = rt.compile(key, { passes: st.passes.map(ps => ({ ...ps, src })), common: '', params: st.params, inputs: [], ...rtm }, true); if (!c.ok) throw new Error(c.error);
    const { ext } = inputsFor(st, o.w, o.h, o); const P = pal(st);
    rt.draw(key, o.w, o.h, { p: o.p, L: 6, seed: 417, safe: true, pal: P, params: defaults(st), spec: st.params, media: null, ext, progress: 0 });
    tmp.width = o.w; tmp.height = o.h; tx.fillStyle = P.bg; tx.fillRect(0, 0, o.w, o.h); rt.blit(tx, o.w, o.h); return tx.getImageData(0, 0, o.w, o.h);
  }
  function cardData(which, W, H) { const c = which === 'to' ? (media.b || (media.b = cardB())) : (media.card || (media.card = testCard())); let src = bake(c, W, H).canvas; while (src.width > 2 * W) { const h = document.createElement('canvas'); h.width = Math.max(W, Math.round(src.width / 2)); h.height = Math.max(H, Math.round(src.height / 2)); const hx = h.getContext('2d'); hx.imageSmoothingQuality = 'high'; hx.drawImage(src, 0, 0, h.width, h.height); src = h; } tmp.width = W; tmp.height = H; tx.imageSmoothingQuality = 'high'; tx.drawImage(src, 0, 0, W, H); return tx.getImageData(0, 0, W, H); } // mip-chain downscale, like the GPU's trilinear sampling
  return { rt, img, compile, render, cardData, identity, imageData, sheet, fit, style, defaults, loadFont, setText(t) { textOverride = t; }, list, setKit(k) { kit = k; }, get kit() { return kit; } };
})();
`;
const savePng = (file, url) => { fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); return file; };
const strip = f => { const o = JSON.parse(JSON.stringify(f)); delete o._samples; delete o._gray; return o; };

// ---------------------------------------------------------------- commands
async function cmdAnalyze() {
  if (!args[0]) die('usage: am analyze <image> [--out dir]');
  ensureOut(); const { browser, page } = await openPage();
  const url = dataUrl(args[0]);
  const r = await page.evaluate(async url => {
    const d = await H.imageData(url, 512); const f = AM.features(d); const hints = AM.hints(f);
    // Board: reference, palette strip, clusters, layout thumb.
    const c = document.createElement('canvas'); const W = 512, Hh = Math.round(d.height * W / d.width); c.width = W + 260; c.height = Math.max(Hh, 300); const x = c.getContext('2d'); x.fillStyle = '#141414'; x.fillRect(0, 0, c.width, c.height);
    const t = document.createElement('canvas'); t.width = d.width; t.height = d.height; t.getContext('2d').putImageData(d, 0, 0); x.drawImage(t, 0, 0, W, Hh);
    x.font = '12px monospace'; let y = 14; x.fillStyle = '#ddd'; x.fillText('Motif palette', W + 12, y); y += 8;
    const P = f.color.palette; [['bg', P.bg], ['ink', P.ink], ['a0', P.a[0]], ['a1', P.a[1]], ['a2', P.a[2]]].forEach(([k, v], i) => { x.fillStyle = v; x.fillRect(W + 12 + i * 48, y, 44, 34); x.fillStyle = '#aaa'; x.fillText(k, W + 12 + i * 48, y + 48); });
    y += 70; x.fillStyle = '#ddd'; x.fillText('clusters (weight)', W + 12, y); y += 8;
    f.color.clusters.forEach((cl, i) => { x.fillStyle = cl.hex; x.fillRect(W + 12, y + i * 26, Math.max(4, cl.w * 220), 20); x.fillStyle = '#aaa'; x.fillText(cl.hex + ' ' + (cl.w * 100).toFixed(0) + '%', W + 12 + Math.max(4, cl.w * 220) + 6, y + i * 26 + 14); });
    return { f, hints, png: c.toDataURL('image/png') };
  }, url);
  await browser.close();
  const base = path.basename(args[0]).replace(/\.\w+$/, '');
  fs.writeFileSync(path.join(OUT, `${base}.brief.json`), JSON.stringify({ source: args[0], ...strip(r.f), hints: r.hints }, null, 2));
  savePng(path.join(OUT, `${base}.brief.png`), r.png);
  const f = r.f;
  console.log(`  ${args[0]}  ${f.size.join('×')}`);
  console.log(`  tone     ${f.tone.key}  meanL ${f.tone.meanL}  p05 ${f.tone.p05}  p95 ${f.tone.p95}  contrast ${f.tone.contrast}  highlights ${(f.tone.highlights * 100).toFixed(1)}%`);
  console.log(`  colour   chroma ${f.color.meanChroma} (p90 ${f.color.chromaP90})  clusters ${f.color.clusters.map(c => `${c.hex}:${(c.w * 100).toFixed(0)}%`).join(' ')}`);
  console.log(`  palette  bg ${f.color.palette.bg}  ink ${f.color.palette.ink}  a ${f.color.palette.a.join(' ')}`);
  console.log(`  texture  β ${f.texture.beta}  edge ${f.texture.edge}  grain ${f.texture.grain}  coherence ${f.texture.coherence} @ ${f.texture.strokeAngle}°  radial ${f.texture.radial}`);
  console.log(`  layout   centroid ${f.layout.centroid}  symLR ${f.layout.symLR}  symTB ${f.layout.symTB}  n-fold ${f.layout.nfold || '-'}  radial ${f.layout.radial.map(v => v.toFixed(2)).join(' ')}`);
  console.log('  hints'); r.hints.forEach(h => console.log('   · ' + h));
  console.log(`  wrote ${path.join(OUT, base + '.brief.json')} and .brief.png`);
}

async function withKit(fn) {
  const kitDir = args[0]; if (!kitDir) die('kit folder required');
  const { kit, manifest } = loadKit(kitDir); const { browser, page } = await openPage();
  await page.evaluate(async ([k, nm, font, text]) => { H.setKit(k); window.__noMedia = nm; H.setText(text); await H.loadFont(font); }, [kit, !!flags['no-media'], FONT_B64, flags.text && flags.text !== true ? String(flags.text).split('|') : null]);
  if (flags.media && flags.media !== true) await page.evaluate(u => H.img(u), dataUrl(flags.media));
  try { return await fn({ kit, manifest, page, kitDir }); } finally { await browser.close(); }
}
const mediaKey = () => (flags.media && flags.media !== true ? dataUrl(flags.media) : null);

async function cmdCompare() {
  const styleId = args[1]; if (!styleId || !flags.ref) die('usage: am compare <kit> <style> --ref <image> [--phase .37] [--mode style]');
  ensureOut();
  await withKit(async ({ page }) => {
    const r = await page.evaluate(async ({ styleId, ref, phase, mode, params, mk, W }) => {
      const c = H.compile(styleId); if (!c.ok) return { error: c.error };
      const t = await H.imageData(ref, 512); const Hh = Math.round(W * t.height / t.width);
      const ft = AM.features(t); const phases = phase.split(',').map(Number);
      const outs = phases.map(p => { const im = H.render(styleId, { w: W, h: Hh, p, params, mediaKey: mk }); const fr = AM.features(im); return { p, im, res: AM.compare(ft, fr, mode), fr }; });
      const best = outs.reduce((a, b) => (b.res.score > a.res.score ? b : a));
      const png = H.sheet([H.fit(t, W, Hh), ...outs.map(o => o.im)], ['target', ...outs.map(o => `p=${o.p}  ${o.res.score.toFixed(1)}`)], Math.min(4, outs.length + 1));
      return { results: outs.map(o => ({ p: o.p, ...o.res })), best: best.res, png };
    }, { styleId, ref: dataUrl(flags.ref), phase: String(flags.phase || '0.37'), mode: flags.mode || 'style', params: readParams(), mk: mediaKey(), W: +(flags.w || 384) });
    if (r.error) die(`  ✖ ${styleId}\n${r.error}`);
    const file = savePng(path.join(OUT, `compare-${styleId}.png`), r.png);
    fs.writeFileSync(path.join(OUT, `compare-${styleId}.json`), JSON.stringify(r.results, null, 2));
    for (const x of r.results) console.log(`  p=${x.p}  score ${x.score.toFixed(1)}  palette ${x.parts.palette}  tone ${x.parts.tone}  texture ${x.parts.texture}  layout ${x.parts.layout}  structure ${x.parts.structure}`);
    console.log('  gaps (best phase):'); (r.best.gaps.length ? r.best.gaps : ['none above threshold']).forEach(g => console.log('   · ' + g));
    console.log(`  sheet ${file}`);
  });
}

// Separable CMA-ES-lite over the style's numeric parameter space (normalised to 0..1 per dimension).
function paramSpace(st, only, lock) {
  const dims = [];
  for (const [k, s] of Object.entries(st.params)) {
    const base = s.part ? s.part.of : k;
    if (only.length && !only.includes(base) && !only.includes(k)) continue; if (lock.includes(base) || lock.includes(k)) continue;
    if (s.mutate === 0 && !only.length) continue;
    if (s.type === 'range') { const max = s.randMax != null ? s.randMax : s.max; dims.push({ k, type: 'range', min: s.min, max, log: !!s.log && s.min > 0 }); }
    else if (s.type === 'int') dims.push({ k, type: 'int', min: s.min, max: s.randMax != null ? s.randMax : s.max });
    else if (s.type === 'toggle') dims.push({ k, type: 'toggle' });
    else if (s.type === 'select') dims.push({ k, type: 'select', options: s.options.map(o => o.v) });
  }
  return dims;
}
const decode = (dims, x) => Object.fromEntries(dims.map((d, i) => { const u = Math.min(1, Math.max(0, x[i])); if (d.type === 'range') return [d.k, d.log ? d.min * Math.pow(d.max / d.min, u) : d.min + (d.max - d.min) * u]; if (d.type === 'int') return [d.k, Math.round(d.min + (d.max - d.min) * u)]; if (d.type === 'toggle') return [d.k, u >= 0.5]; return [d.k, d.options[Math.min(d.options.length - 1, Math.floor(u * d.options.length))]]; }));
const encode = (dims, p) => dims.map(d => { const v = p[d.k]; if (d.type === 'range') return d.log ? Math.log(v / d.min) / Math.log(d.max / d.min) : (v - d.min) / (d.max - d.min || 1); if (d.type === 'int') return (v - d.min) / (d.max - d.min || 1); if (d.type === 'toggle') return v ? 0.75 : 0.25; return (Math.max(0, d.options.indexOf(v)) + 0.5) / d.options.length; });

async function cmdTune() {
  const styleId = args[1]; if (!styleId || !flags.ref) die('usage: am tune <kit> <style> --ref <image> [--gens 12 --pop 10]');
  ensureOut();
  await withKit(async ({ kit, page, kitDir }) => {
    const st = (kit.renderables || kit.styles).find(s => s.localId === styleId); if (!st) die(`no style ${styleId}`);
    const only = flags.only ? String(flags.only).split(',') : [], lock = flags.lock ? String(flags.lock).split(',') : [];
    const dims = paramSpace(st, only, lock); if (!dims.length) die('no tunable params');
    const start = Object.assign(Object.fromEntries(Object.entries(st.params).map(([k, s]) => [k, s.def])), readParams());
    let palOver = null;
    const ref = dataUrl(flags.ref); const mode = flags.mode || 'style'; const phases = String(flags.phases || flags.phase || '0.37').split(',').map(Number);
    const W = +(flags.w || 256);
    const init = await page.evaluate(async ({ styleId, ref, W, usePal }) => { const c = H.compile(styleId); if (!c.ok) return { error: c.error }; const t = await H.imageData(ref, 512); window.__ft = AM.features(t); window.__Hh = Math.round(W * t.height / t.width); return { pal: usePal ? window.__ft.color.palette : null, Hh: window.__Hh }; }, { styleId, ref, W, usePal: flags.palette === 'ref' });
    if (init.error) die(init.error);
    palOver = init.pal;
    const evalBatch = cands => page.evaluate(({ styleId, cands, phases, mode, W, pal, mk }) => cands.map(params => { let s = 0; for (const p of phases) { const im = H.render(styleId, { w: W, h: window.__Hh, p, params, pal, mediaKey: mk }); s += AM.compare(window.__ft, AM.features(im), mode).score; } return s / phases.length; }), { styleId, cands, phases, mode, W, pal: palOver, mk: mediaKey() });
    const n = dims.length, lambda = +(flags.pop || Math.max(8, 4 + Math.floor(3 * Math.log(n)))), mu = Math.floor(lambda / 2), gens = +(flags.gens || 12);
    const wts = Array.from({ length: mu }, (_, i) => Math.log(mu + 0.5) - Math.log(i + 1)); const ws = wts.reduce((a, b) => a + b, 0); wts.forEach((v, i) => (wts[i] = v / ws));
    let mean = encode(dims, start).map(v => Math.min(1, Math.max(0, v))); let sig = new Array(n).fill(0.22);
    let s0 = (await evalBatch([decode(dims, mean)]))[0]; let best = { x: mean.slice(), s: s0 }; const hist = [+s0.toFixed(2)];
    let rs = +(flags.seed || 1234); const rnd = () => ((rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296); const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    console.log(`  tuning ${styleId}: ${n} dims [${dims.map(d => d.k).join(', ')}], λ=${lambda}, ${gens} generations, mode ${mode}, phases ${phases.join(',')}${palOver ? ', palette from reference' : ''}`);
    console.log(`  gen 0  score ${s0.toFixed(2)}`);
    for (let g = 1; g <= gens; g++) {
      const xs = Array.from({ length: lambda }, () => mean.map((m, i) => { let v = m + sig[i] * gauss(); if (v < 0) v = -v; if (v > 1) v = 2 - v; return Math.min(1, Math.max(0, v)); }));
      const sc = await evalBatch(xs.map(x => decode(dims, x)));
      const idx = sc.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
      const improved = idx[0][0] > best.s;
      if (improved) best = { x: xs[idx[0][1]].slice(), s: idx[0][0] };
      const old = mean.slice(); mean = new Array(n).fill(0); for (let j = 0; j < mu; j++) { const x = xs[idx[j][1]]; for (let i = 0; i < n; i++) mean[i] += wts[j] * x[i]; }
      // Elitist pull toward the best-so-far plus a 1/5th-success-style global step size, so it converges instead of wandering.
      for (let i = 0; i < n; i++) mean[i] = 0.6 * mean[i] + 0.4 * best.x[i];
      const step = improved ? 1.15 : 0.82;
      for (let i = 0; i < n; i++) { let v = 0; for (let j = 0; j < mu; j++) { const x = xs[idx[j][1]]; v += wts[j] * (x[i] - old[i]) ** 2; } sig[i] = Math.min(0.35, Math.max(0.015, (0.6 * sig[i] + 0.4 * Math.sqrt(v)) * step)); }
      hist.push(+best.s.toFixed(2)); console.log(`  gen ${g}  best ${best.s.toFixed(2)}  gen-top ${idx[0][0].toFixed(2)}  σ̄ ${(sig.reduce((a, b) => a + b, 0) / n).toFixed(3)}`);
    }
    const bestP = Object.assign({}, start, decode(dims, best.x));
    const round = (k, v) => { const s = st.params[k]; if (s && s.type === 'range') { const st2 = s.step || 0.001; return +(Math.round(v / st2) * st2).toFixed(4); } return v; };
    Object.keys(bestP).forEach(k => (bestP[k] = round(k, bestP[k])));
    const png = await page.evaluate(async ({ ref, styleId, a, b, phase, pal, W, mk }) => { const t = await H.imageData(ref, 512); const Hh = window.__Hh; const x = H.render(styleId, { w: W, h: Hh, p: phase, params: a, pal, mediaKey: mk }); const y = H.render(styleId, { w: W, h: Hh, p: phase, params: b, pal, mediaKey: mk }); const s0 = AM.compare(window.__ft, AM.features(x)).score, s1 = AM.compare(window.__ft, AM.features(y)).score; return H.sheet([H.fit(t, W, Hh), x, y], ['target', 'before ' + s0.toFixed(1), 'after ' + s1.toFixed(1)], 3); }, { ref, styleId, a: start, b: bestP, phase: phases[0], pal: palOver, W, mk: mediaKey() });
    const file = savePng(path.join(OUT, `tune-${styleId}.png`), png);
    const result = { style: styleId, mode, phases, score: { before: hist[0], after: +best.s.toFixed(2) }, history: hist, params: bestP, palette: palOver };
    fs.writeFileSync(path.join(OUT, `tune-${styleId}.json`), JSON.stringify(result, null, 2));
    console.log(`  ${hist[0].toFixed(2)} → ${best.s.toFixed(2)}`);
    console.log('  params ' + JSON.stringify(Object.fromEntries(dims.map(d => [d.k, bestP[d.k]]))));
    if (flags.apply) {
      const mp = path.join(kitDir, 'manifest.json'); const m = JSON.parse(fs.readFileSync(mp, 'utf8')); const ms = m.styles.find(s => s.id === styleId);
      for (const d of dims) {
        const k = d.k, spec = st.params[k];
        if (spec.part) { const of = spec.part.of, mp2 = ms.params[of]; if (mp2.type === 'point') { mp2.def = [round(of + 'X', bestP[of + 'X']), round(of + 'Y', bestP[of + 'Y'])]; } else if (mp2.type === 'color') { const h = c => Math.round(Math.max(0, Math.min(1, bestP[of + c])) * 255).toString(16).padStart(2, '0'); mp2.def = ('#' + h('R') + h('G') + h('B')).toUpperCase(); } }
        else if (ms.params[k]) ms.params[k].def = bestP[k];
      }
      if (palOver && ms.palette) { const p = m.palettes.find(p => p.id === ms.palette); if (p) Object.assign(p, { bg: palOver.bg, ink: palOver.ink, a: palOver.a }); }
      fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n'); console.log(`  applied defaults to ${mp}`);
    }
    console.log(`  sheet ${file}`);
  });
}

async function cmdQa() {
  ensureOut();
  await withKit(async ({ kit, page }) => {
    const only = args.slice(1); const styles = (kit.renderables || kit.styles).filter(s => !only.length || only.includes(s.localId)).map(s => s.localId);
    const W = +(flags.w || 480), Hh = +(flags.h || 270);
    const res = await page.evaluate(({ styles, W, Hh, mk, params }) => {
      const out = [];
      const md = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4 * 3); };
      const relLum = d => { const T = 4, tl = new Array(T * T).fill(0), n = new Array(T * T).fill(0); const w = d.width, h = d.height; const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const k = Math.floor(y * T / h) * T + Math.floor(x * T / w); tl[k] += 0.2126 * lin(d.data[i]) + 0.7152 * lin(d.data[i + 1]) + 0.0722 * lin(d.data[i + 2]); n[k]++; } return tl.map((v, i) => v / n[i]); };
      for (const id of styles) {
        const c = H.compile(id); if (!c.ok) { out.push({ id, error: c.error }); continue; }
        if (H.style(id).kind === 'transition') {
          // Contract: progress 0 shows `from` exactly, progress 1 shows `to` exactly; the middle must differ from both.
          const a = H.render(id, { w: 160, h: 90, p: 0.3, progress: 0, mediaKey: mk, params }), b = H.render(id, { w: 160, h: 90, p: 0.3, progress: 1, mediaKey: mk, params }), m = H.render(id, { w: 160, h: 90, p: 0.3, progress: 0.5, mediaKey: mk, params });
          const fa = H.identity(id, 'from', { w: 160, h: 90, p: 0.3, mediaKey: mk }), fb = H.identity(id, 'to', { w: 160, h: 90, p: 0.3, mediaKey: mk });
          // Compare 8x8 block means: robust to GPU-vs-canvas resampling of 1 px lines, still catches any real change.
          const blk = im => { const o = []; for (let by = 0; by < 90; by += 8) for (let bx = 0; bx < 160; bx += 8) { let r = 0, g = 0, b2 = 0, n = 0; for (let y = by; y < Math.min(by + 8, 90); y++) for (let x = bx; x < bx + 8; x++) { const i = (y * 160 + x) * 4; r += im.data[i]; g += im.data[i + 1]; b2 += im.data[i + 2]; n++; } o.push(r / n, g / n, b2 / n, 0); } return o; };
          const mdB = (x, y) => md(blk(x), blk(y)) * 4 / 3;
          out.push({ id, transition: true, d0: +mdB(a, fa).toFixed(2), d1: +mdB(b, fb).toFixed(2), dm: +Math.min(mdB(m, fa), mdB(m, fb)).toFixed(2) });
          continue;
        }
        const N = 48; const frames = []; for (let i = 0; i <= N; i++) frames.push(H.render(id, { w: 160, h: 90, p: i / N, mediaKey: mk, params }).data.slice());
        const steps = []; for (let i = 1; i <= N; i++) steps.push(md(frames[i - 1], frames[i]));
        const seamExact = md(frames[0], frames[N]); const sorted = [...steps].sort((a, b) => a - b); const med = sorted[Math.floor(N / 2)];
        const seamStep = steps[N - 1]; const maxStep = Math.max(...steps.slice(0, N - 1));
        // WCAG 2.3.1, same method as Motif's kit audit: 24 samples across the loop, 4x4 tiles of relative luminance,
        // a change >= 0.1 with the darker side < 0.8 is an event, opposing event pairs / loop seconds / 2 = flashes/s.
        // Worst case is a 1 s loop at 4x tempo (u_L = 0.25 s); also a 1 s loop. The audit fails a style when >= 4 tiles exceed 3/s.
        let worst = 0, tilesOver = 0;
        for (const Ls of [0.25, 1]) {
          const seq = []; for (let f = 0; f < 24; f++) seq.push(relLum(H.render(id, { w: 64, h: 36, p: f / 24, L: Ls, safe: true, mediaKey: mk, params })));
          let over = 0;
          for (let k = 0; k < 16; k++) { const ev = []; for (let f = 0; f < 24; f++) { const a = seq[f][k], b = seq[(f + 1) % 24][k]; const d = b - a; if (Math.abs(d) >= 0.1 && Math.min(a, b) < 0.8) ev.push(Math.sign(d)); } let pairs = 0; for (let i = 1; i < ev.length; i++) if (ev[i] !== ev[i - 1]) pairs++; const c = pairs / Ls / 2; worst = Math.max(worst, c); if (c > 3) over++; }
          tilesOver = Math.max(tilesOver, over);
        }
        // Cost at the requested size.
        const gl = H.rt.canvas.getContext('webgl2'); H.render(id, { w: W, h: Hh, p: 0.1, mediaKey: mk, params }); gl.finish(); const t0 = performance.now(); for (let i = 0; i < 3; i++) H.render(id, { w: W, h: Hh, p: 0.2 + i * 0.1, mediaKey: mk, params }); gl.finish(); const ms = (performance.now() - t0) / 3;
        // Quality consistency (research acceptance): exposure should hold between the lowest and highest step count.
        let qratio = null; const sp = H.style(id).params.steps;
        if (sp && sp.type === 'int') { const lum = im => { let s = 0; for (let i = 0; i < im.data.length; i += 4) s += 0.2126 * im.data[i] + 0.7152 * im.data[i + 1] + 0.0722 * im.data[i + 2]; return s / (im.data.length / 4); }; const lo = lum(H.render(id, { w: 160, h: 90, p: 0.3, mediaKey: mk, params: { ...params, steps: sp.min } })), hi = lum(H.render(id, { w: 160, h: 90, p: 0.3, mediaKey: mk, params: { ...params, steps: sp.max } })); qratio = +(lo / Math.max(hi, 1e-3)).toFixed(3); }
        const strip = []; for (let i = 0; i < 6; i++) strip.push(H.render(id, { w: 240, h: 135, p: i / 6, mediaKey: mk, params }));
        out.push({ id, seam: +(seamExact).toFixed(2), seamRatio: +(seamStep / Math.max(med, 0.05)).toFixed(2), motion: +med.toFixed(2), pop: +(maxStep / Math.max(med, 0.05)).toFixed(2), flashes: +worst.toFixed(2), tilesOver, qratio, ms: +ms.toFixed(1), strip: H.sheet(strip, ['0', '1/6', '2/6', '3/6', '4/6', '5/6'], 6) });
      }
      return out;
    }, { styles, W, Hh, mk: mediaKey(), params: readParams() });
    let bad = 0;
    for (const r of res) {
      if (r.error) { bad++; console.log(`  ✖ ${r.id}\n${r.error.replace(/^/gm, '      ')}`); continue; }
      if (r.transition) { const ok = r.d0 < 2 && r.d1 < 2 && r.dm > 2; if (!ok) bad++; console.log(`  ${ok ? '✓' : '!'} ${r.id.padEnd(22)} transition  progress 0 vs from Δ${r.d0}  progress 1 vs to Δ${r.d1}  midpoint differs Δ${r.dm}${ok ? '' : '  ← endpoints must match from/to exactly'}`); continue; }
      const notes = [r.seam > 1.5 ? `frame 0 ≠ frame L (Δ${r.seam})` : '', r.seamRatio > 3 ? 'seam jump' : '', r.pop > 6 ? 'discontinuity mid-loop' : '', r.motion < 0.05 ? 'static?' : '', r.tilesOver >= 4 ? `${r.tilesOver} tiles > 3 flashes/s (fails WCAG 2.3.1 audit)` : ''].filter(Boolean);
      const warns = r.flashes > 3 && r.tilesOver < 4 ? [`${r.tilesOver} tile(s) reach ${r.flashes} flashes/s at worst-case tempo (audit passes below 4 tiles)`] : [];
      if (r.qratio != null && Math.abs(r.qratio - 1) > 0.15) warns.push(`exposure shifts ${((r.qratio - 1) * 100).toFixed(0)}% between min and max Quality`);
      if (notes.length) bad++;
      savePng(path.join(OUT, `qa-${r.id}.png`), r.strip);
      console.log(`  ${notes.length ? '!' : warns.length ? '~' : '✓'} ${r.id.padEnd(22)} ${String(r.ms).padStart(7)} ms@${W}x${Hh}  motion ${r.motion}  seam Δ${r.seam} (×${r.seamRatio})  pop ×${r.pop}  flashes ${r.flashes}/s (tiles>3: ${r.tilesOver})${r.qratio != null ? `  quality-exposure ×${r.qratio}` : ''}${notes.length ? '  ← ' + notes.join(', ') : warns.length ? '  ~ ' + warns.join(', ') : ''}`);
    }
    console.log(`  filmstrips in ${OUT}/qa-*.png  (ms are SwiftShader CPU numbers: a real GPU is 20–100× faster)`);
    process.exitCode = bad ? 1 : 0;
  });
}

async function cmdFrame() {
  const styleId = args[1]; if (!styleId) die('usage: am frame <kit> <style> [--phase .37]'); ensureOut();
  await withKit(async ({ page }) => {
    const jpg = flags.format === 'jpg';
    const r = await page.evaluate(({ styleId, p, W, Hh, params, mk, jpg }) => { const c = H.compile(styleId); if (!c.ok) return { error: c.error }; const im = H.render(styleId, { w: W, h: Hh, p, params, mediaKey: mk }); const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; cv.getContext('2d').putImageData(im, 0, 0); return { png: jpg ? cv.toDataURL('image/jpeg', 0.9) : cv.toDataURL('image/png') }; }, { styleId, p: +(flags.phase || 0.37), W: +(flags.w || 1280), Hh: +(flags.h || 720), params: readParams(), mk: mediaKey(), jpg });
    if (r.error) die(r.error);
    console.log('  wrote ' + savePng(path.join(OUT, `${styleId}${flags.name ? '' : '-' + (flags.phase || 0.37)}.${jpg ? 'jpg' : 'png'}`.replace(styleId, flags.name || styleId)), r.png));
  });
}

async function cmdFilm() {
  const styleId = args[1]; if (!styleId) die('usage: am film <kit> <style> [--seconds 6 --fps 30]'); ensureOut();
  await withKit(async ({ page }) => {
    const sec = +(flags.seconds || 6), fps = +(flags.fps || 30), loops = +(flags.loops || 1);
    const r = await page.evaluate(async ({ styleId, sec, fps, loops, W, Hh, params, mk }) => {
      const c = H.compile(styleId); if (!c.ok) return { error: c.error };
      const N = Math.round(sec * fps * loops); const frames = [];
      for (let i = 0; i < N; i++) { const im = H.render(styleId, { w: W, h: Hh, p: (i / (sec * fps)) % 1, L: sec, params, mediaKey: mk }); frames.push(await createImageBitmap(im)); }
      const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh; const x = cv.getContext('2d'); x.drawImage(frames[0], 0, 0);
      const stream = cv.captureStream(0); const track = stream.getVideoTracks()[0];
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12e6 }); const chunks = []; rec.ondataavailable = e => e.data.size && chunks.push(e.data);
      const done = new Promise(res => (rec.onstop = res)); rec.start();
      const t0 = performance.now();
      for (let i = 0; i < N; i++) { x.drawImage(frames[i], 0, 0); track.requestFrame(); const due = t0 + (i + 1) * 1000 / fps; await new Promise(res => setTimeout(res, Math.max(0, due - performance.now()))); }
      rec.stop(); await done; const blob = new Blob(chunks, { type: 'video/webm' }); const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768)); return { b64: btoa(s), mime };
    }, { styleId, sec, fps, loops, W: +(flags.w || 960), Hh: +(flags.h || 540), params: readParams(), mk: mediaKey() });
    if (r.error) die(r.error);
    const f = path.join(OUT, `${styleId}.webm`); fs.writeFileSync(f, Buffer.from(r.b64, 'base64')); console.log(`  wrote ${f} (${r.mime})`);
  });
}

async function cmdLib() {
  const sub = args[0];
  if (sub === 'list' || !sub) { for (const m of Object.values(modules())) console.log(`  ${m.id.padEnd(8)} ${m.req.length ? '(+' + m.req.join(',') + ') ' : ''}${m.about}`); return; }
  if (sub === 'build') {
    const names = args.slice(1); if (!names.length) die('usage: am lib build <module ...> --out <file> [--append own.glsl]');
    const s = buildCommon(names, flags.append); if (flags.out) { fs.writeFileSync(flags.out, s); console.log(`  wrote ${flags.out} (${(s.length / 1024).toFixed(1)} KB)`); } else process.stdout.write(s); return;
  }
  if (sub === 'test') {
    const all = Object.keys(modules()); const common = buildCommon(all);
    // 1. The app's sandbox: static analysis of the whole library as a kit common (loops, budgets, directives).
    const probe = { format: 'motif-kit@4', id: 'am-lib-test', name: 'am lib test', version: '0.0.1', common: 'common.glsl', palettes: [{ id: 'probe', name: 'P', bg: '#000000', ink: '#FFFFFF', a: ['#FF0000', '#00FF00', '#0000FF'] }], styles: [{ id: 'probe', name: 'T', passes: [{ src: 't.glsl' }], params: { a: { type: 'range', label: 'A', min: 0, max: 1, def: 0.5 }, b: { type: 'range', label: 'B', min: 0, max: 1, def: 0.5 }, c: { type: 'range', label: 'C', min: 0, max: 1, def: 0.5 }, d: { type: 'range', label: 'D', min: 0, max: 1, def: 0.5 } } }] };
    const sv = KG.validateKit(probe, { 'common.glsl': common, 't.glsl': 'vec4 motif(vec2 uv, vec2 fc) { return vec4(am_agx(vec3(uv, p_a), 0.0), 1.0); }' });
    (sv.diagnostics || []).forEach(d => console.log(`  ${d.severity === 'error' ? 'error' : 'warn '} ${d.file || ''}${d.line ? ':' + d.line : ''}  ${d.message}`));
    console.log(sv.ok ? `  ✓ sandbox: library passes static analysis (SDK ${KG.SDK_VERSION || '?'})` : '  ✖ sandbox rejected the library');
    if (!sv.ok) { process.exitCode = 1; return; }
    const { browser, page } = await openPage();
    const r = await page.evaluate(common => { const rt = KG.createGlRuntime(); return rt.compile('t', { passes: [{ src: 'vec4 motif(vec2 uv, vec2 fc) { return vec4(am_agx(vec3(uv, 0.5), 0.0), 1.0); }' }], common, params: {}, inputs: [] }, true); }, common);
    await browser.close();
    console.log(r.ok ? `  ✓ all modules compile together (${all.join(', ')}; ${(common.length / 1024).toFixed(1)} KB)` : `  ✖ ${r.error}`); process.exitCode = r.ok ? 0 : 1; return;
  }
  die('am lib list | build | test');
}

function cmdNew() {
  const dest = args[0]; if (!dest) die('usage: am new <dir> --id my-kit [--modules color,noise,post]'); if (fs.existsSync(dest)) die(`${dest} exists`);
  const id = String(flags.id || path.basename(dest)); const mods = String(flags.modules || 'color,noise,post,field').split(',');
  fs.mkdirSync(path.join(dest, 'styles'), { recursive: true });
  fs.writeFileSync(path.join(dest, 'kit.glsl'), '// Kit-specific helpers. Rebuild common.glsl after editing:\n//   am lib build ' + mods.join(' ') + ' --append kit.glsl --out common.glsl\n');
  fs.writeFileSync(path.join(dest, 'common.glsl'), buildCommon(mods, path.join(dest, 'kit.glsl')));
  fs.writeFileSync(path.join(dest, 'styles/hero.glsl'), `// Graph pass "scene" (scale 0.5): the HDR scene, linear light. Values above 1 bloom in the post pass.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q, w; float f = am_warp(uv * p_scale, 5, 1.0, 0.6, 3.0, q, w);
  vec3 col = am_rampOk(sat(0.5 + 0.6 * f)) + am_accentLoop(length(w) + u_p) * pow(sat(f + 0.3), 3.0) * p_glow * 2.0;
  return vec4(col, 1.0);
}
`);
  fs.writeFileSync(path.join(dest, 'styles/hero-post.glsl'), `// Graph output pass (full res, reads scene): bloom, chromatic aberration, tone map, grain, vignette.
vec4 motif(vec2 uv, vec2 fc) {
  vec2 q = fc / u_res;
  vec3 c = am_ca(g_scene, q, 0.004, 5);
  c += am_bloom(g_scene, q, 3.0) * p_bloom;
  c = am_tonemap(c, p_exposure, 0);
  c *= mix(1.0, am_vignette(uv, 1.0), 0.6);
  return vec4(am_grain(c, fc, 0.6, 1.0), 1.0);
}
`);
  const manifest = { format: 'motif-kit@4', capabilities: [], id, name: String(flags.name || id), version: '0.1.0', author: 'AgentMotif', description: 'Built with AgentMotif.', license: '', accent: '#7C5CFF', common: 'common.glsl', palettes: [{ id: 'night', name: 'Night', bg: '#06070C', ink: '#F4F1EA', a: ['#7C5CFF', '#FF4F8B', '#3DE0C8'] }], styles: [{ id: 'hero', name: 'Hero', group: 'AgentMotif', palette: 'night', tags: ['agentmotif'], blurb: 'Starter: warped field, HDR glow, lens finish.', flash: false, cost: 1, graph: { buffers: { scene: { scale: 0.5 } }, passes: [{ src: 'styles/hero.glsl', writes: 'scene' }, { src: 'styles/hero-post.glsl', reads: ['scene'], writes: 'output' }] }, params: { scale: { type: 'range', label: 'Scale', min: 0.5, max: 4, def: 1.6, group: 'Field' }, glow: { type: 'range', label: 'Glow', min: 0, max: 2, def: 0.8, group: 'Field' }, bloom: { type: 'range', label: 'Bloom', min: 0, max: 1.5, def: 0.5, group: 'Lens' }, exposure: { type: 'range', label: 'Exposure', min: -3, max: 3, def: 0, unit: 'EV', group: 'Lens' } } }] };
  fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`  created ${dest} (modules: ${resolveModules(mods).map(m => m.id).join(', ')}). Next: am qa ${dest}`);
}

const table = { analyze: cmdAnalyze, compare: cmdCompare, tune: cmdTune, qa: cmdQa, film: cmdFilm, frame: cmdFrame, lib: cmdLib, new: cmdNew };
if (!table[cmd]) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 14).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(cmd ? 1 : 0); }
await table[cmd]();
