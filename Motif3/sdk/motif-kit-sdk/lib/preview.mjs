// motif-kit preview: renders each style at four loop phases in headless Chromium (WebGL2), reports compile
// errors with pass-local line numbers, the loop seam, blank frames and frame time, and writes a contact sheet.
//  - media inputs and stack layers (SDK 1.1 / 1.2.5) get --media <image>, or built-in test cards, and are checked for response;
//  - svg and text inputs (1.2.5) are baked to distance fields exactly as the app does it;
//  - styles with controls for speed and direction are loop-tested in all four play modes ("motion seam");
//  - sequences are rendered through the real compositor, 8 frames each, and loop-tested.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
export async function runPreview(KG, raw, only, flags) {
  const require = createRequire(import.meta.url);
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.error('preview needs playwright: npm i -D playwright && npx playwright install chromium'); process.exit(1); }
  const v = KG.validateKit(raw.manifest, raw.files); v.warnings.forEach(w => console.log('  warn ', w));
  if (!v.ok) { v.errors.forEach(e => console.log('  error', e)); process.exit(1); }
  const kit = v.kit; const styles = kit.styles.filter(s => !only.length || only.includes(s.localId));
  const W = +(flags.w || 320), H = +(flags.h || 180);
  let mediaUrl = null;
  if (flags.media && flags.media !== true) {
    const ext = path.extname(flags.media).toLowerCase(); const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }[ext];
    if (!mime) { console.error('--media takes a png, jpg, webp or gif image (use a still from your video).'); process.exit(1); }
    mediaUrl = `data:${mime};base64,${fs.readFileSync(flags.media).toString('base64')}`;
  }
  const src = fs.readFileSync(new URL('./kit-gl.js', import.meta.url), 'utf8');
  const exe = flags.chromium || process.env.MOTIF_CHROMIUM;
  const files = {}, fontsB64 = {};
  for (const [k, t] of Object.entries(raw.files)) { if (typeof t === 'string') files[k] = t; else fontsB64[k] = Buffer.from(t).toString('base64'); }
  const seqWanted = flags.sequence && flags.sequence !== true ? [flags.sequence] : kit.sequences.map(s => s.id);
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage(); await page.setContent('<canvas id="c"></canvas>');
  await page.addScriptTag({ content: `window.KG = (function(){ ${src} })();` });
  const res = await page.evaluate(async ({ kit, styles, W, H, mediaUrl, files, fontsB64, seqWanted, all }) => {
    const rt = KG.createGlRuntime(); if (!rt.ok) return { fatal: rt.reason };
    // Fonts bundled with the kit.
    const fontFiles = {}; for (const [k, b] of Object.entries(fontsB64)) fontFiles[k] = Uint8Array.from(atob(b), c => c.charCodeAt(0));
    const families = await KG.loadKitFonts(kit, fontFiles);
    const baker = KG.createInputBaker();
    // Media source: the user's image, or test cards (gradient, grid, rings, lettering, an arrow that shows orientation).
    let userImg = null; if (mediaUrl) { userImg = new Image(); userImg.src = mediaUrl; await userImg.decode(); }
    const hues = [['#1E3A8A', '#DB2777', '#F59E0B'], ['#064E3B', '#10B981', '#FDE68A'], ['#4C1D95', '#06B6D4', '#F472B6']];
    const card = n => {
      if (userImg) return userImg;
      const src = document.createElement('canvas'); src.width = 1280; src.height = 720; const x = src.getContext('2d'), h = hues[n % 3];
      const g = x.createLinearGradient(0, 0, 1280, 720); g.addColorStop(0, h[0]); g.addColorStop(0.5, h[1]); g.addColorStop(1, h[2]); x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; for (let i = 0; i <= 1280; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 720); x.stroke(); } for (let j = 0; j <= 720; j += 64) { x.beginPath(); x.moveTo(0, j); x.lineTo(1280, j); x.stroke(); }
      for (let r = 60; r < 360; r += 60) { x.beginPath(); x.arc(640, 360, r, 0, Math.PI * 2); x.strokeStyle = r % 120 ? '#FFFFFF' : '#111111'; x.lineWidth = 6; x.stroke(); }
      x.fillStyle = '#FFFFFF'; x.font = '700 150px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(['MOTIF', 'LAYER', 'STACK'][n % 3], 640, 360);
      x.fillStyle = '#FFFFFF'; x.beginPath(); x.moveTo(60, 60); x.lineTo(300, 60); x.lineTo(180, 200); x.closePath(); x.fill(); // top-left arrow: shows flips and rotation
      return src;
    };
    const bakeFill = (src, w, h, n) => { const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, ar = w / h; let cw = sw, ch = sh; if (sw / sh > ar) cw = sh * ar; else ch = sw / ar; const c = document.createElement('canvas'); c.width = Math.round(cw); c.height = Math.round(ch); c.getContext('2d').drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, c.width, c.height); return { canvas: c, rev: 1, w: sw, h: sh, time: 0 }; };
    const cardCache = new Map();
    const cardFor = (id, n) => { if (!cardCache.has(id)) cardCache.set(id, bakeFill(card(n), W, H, n)); return cardCache.get(id); };
    const mediaFor = (st, params, noMedia) => {
      if (noMedia) return null;
      const out = {}; (st.inputs || []).forEach((q, i) => { if (q.type !== 'svg' && q.type !== 'text') out[q.id] = cardFor(q.id, q.stack ? q.stack - 1 : i); });
      Object.assign(out, baker(st, { params, w: W, h: H, files, families }));
      return Object.keys(out).length ? out : null;
    };
    const defParams = st => Object.fromEntries(Object.entries(st.params).map(([k, s]) => [k, s.def]));
    const palOf = st => kit.palettes.find(p => p.id === st.palette) || kit.palettes[0] || { bg: '#000000', ink: '#ffffff', a: ['#35E0FF', '#FF3D9A', '#FFB547'] };
    const defOf = st => ({ passes: st.passes, common: kit.common, params: st.params, inputs: st.inputs || [], sdk: st.sdk });
    const md = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tx = tmp.getContext('2d', { willReadFrequently: true });
    const phases = [0, 0.25, 0.5, 0.75], pad = 4, lab = 16;
    const sheet = document.getElementById('c'); sheet.width = 4 * (W + pad) + pad; sheet.height = styles.length * (H + pad + lab) + pad;
    const sx = sheet.getContext('2d'); sx.fillStyle = '#1a1a1a'; sx.fillRect(0, 0, sheet.width, sheet.height);
    const out = [];
    styles.forEach((st, row) => {
      const pal = palOf(st), params = defParams(st), inputs = st.inputs || [];
      const c = rt.compile(st.id, defOf(st), true);
      const y = pad + row * (H + pad + lab); sx.fillStyle = '#ddd'; sx.font = '11px monospace'; sx.fillText(st.localId + (c.ok ? '' : '  ✖'), pad, y + 11);
      if (!c.ok) { out.push({ id: st.localId, error: c.error }); return; }
      const u = (p, over, noMedia) => { const P = { ...params, ...(over || {}) }; return { p, L: 6, seed: 417, safe: true, pal, params: P, spec: st.params, media: mediaFor(st, P, noMedia) }; };
      const grab = (p, over, noMedia) => { rt.draw(st.id, W, H, u(p, over, noMedia)); tx.clearRect(0, 0, W, H); rt.blit(tx, W, H); return tx.getImageData(0, 0, W, H).data; };
      const t0 = performance.now(); phases.forEach((p, i) => { rt.draw(st.id, W, H, u(p)); const x = pad + i * (W + pad); sx.fillStyle = pal.bg; sx.fillRect(x, y + lab, W, H); sx.drawImage(rt.canvas, 0, rt.canvas.height - H, W, H, x, y + lab, W, H); });
      const gl = rt.canvas.getContext('webgl2'); gl.finish(); const ms = (performance.now() - t0) / 4;
      const d = 1 / 240, z = grab(0); const seam = md(grab(1 - d), z); let ref = 0; for (let k = 1; k < 8; k++) ref = Math.max(ref, md(grab(k / 8 - d), grab(k / 8)));
      let lum = 0; const m = grab(0.37); for (let i = 0; i < m.length; i += 4) lum += (m[i] + m[i + 1] + m[i + 2]) / 765;
      const resp = inputs.length ? md(grab(0.37, null, true), m) : null;
      // Motion seam: turn every block's speed on and run all four play modes; the loop must still close.
      let mseam = null;
      if (st.blocks && st.blocks.length) {
        mseam = 0;
        for (const dir of ['forward', 'backward', 'pingpong', 'random']) {
          const over = {}; for (const b of st.blocks) { over[b.id + 'Speed'] = 2; over[b.id + 'Dir'] = dir; over[b.id + 'MotionX'] = 1; over[b.id + 'MotionY'] = 1; if (b.kind === 'layer') over[b.id + 'Edge'] = 'clip'; }
          const a = grab(0, over), b2 = grab(1 - d, over); let r2 = 0; for (let k = 1; k < 8; k++) r2 = Math.max(r2, md(grab(k / 8 - d, over), grab(k / 8, over)));
          mseam = Math.max(mseam, md(a, b2) / Math.max(r2, 0.05));
        }
      }
      out.push({ id: st.localId, ms: +ms.toFixed(1), seam: +(seam / Math.max(ref, 0.05)).toFixed(2), lum: +(lum / (W * H)).toFixed(3), inputs: inputs.map(q => q.id + (q.implicit ? '*' : '')), resp: resp == null ? null : +resp.toFixed(2), mseam: mseam == null ? null : +mseam.toFixed(2), blocks: (st.blocks || []).length });
    });
    // Sequences through the real compositor.
    const seqOut = [], seqPngs = {};
    for (const sid of seqWanted) {
      const seq = kit.sequences.find(s => s.id === sid); if (!seq) { seqOut.push({ id: sid, error: 'no such sequence in this kit' }); continue; }
      const byRef = new Map(kit.styles.map(s => [s.id, s]));
      for (const ref of new Set(seq.cues.map(c => c.style))) { const st = byRef.get(ref); if (st) { const c = rt.compile(st.id, defOf(st), true); if (!c.ok) seqOut.push({ id: sid, error: `${ref}: ${c.error}` }); } }
      const resolve = (ref, cue) => { const st = byRef.get(ref); if (!st) return null; const P = { ...defParams(st), ...(cue ? cue.params : {}) }; return { key: st.id, def: defOf(st), spec: st.params, defaults: defParams(st), media: mediaFor(st, P) }; };
      const sq = KG.createSequencer(rt, resolve, { dom: true });
      const pal = palOf(kit.styles[0]); const n = 8, cv = document.createElement('canvas'); cv.width = n * (W + pad) + pad; cv.height = H + pad * 2 + lab; const cx = cv.getContext('2d'); cx.fillStyle = '#1a1a1a'; cx.fillRect(0, 0, cv.width, cv.height);
      const fc = document.createElement('canvas'); fc.width = W; fc.height = H; const fx = fc.getContext('2d', { willReadFrequently: true });
      const frame = p => { fx.setTransform(1, 0, 0, 1, 0, 0); fx.globalCompositeOperation = 'source-over'; fx.globalAlpha = 1; fx.fillStyle = pal.bg; fx.fillRect(0, 0, W, H); const r = sq.render(fx, W, H, seq, { p, L: seq.loop || 6, seed: 417, safe: true, pal }); return { r, data: fx.getImageData(0, 0, W, H).data }; };
      const info = { id: sid, cues: seq.cues.length, peak: KG.analyzeSequence(seq).peak, max: seq.maxActive, missing: new Set(), errors: {}, dropped: 0 };
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        const p = i / n, { r } = frame(p); r.missing.forEach(m => info.missing.add(m)); Object.assign(info.errors, r.errors); info.dropped += r.dropped;
        const x = pad + i * (W + pad); cx.drawImage(fc, x, pad + lab); cx.fillStyle = '#ddd'; cx.font = '11px monospace'; cx.fillText(`${sid}  p=${p.toFixed(3)}  ${r.active.map(a => a.cue.id).join(' ')}`.slice(0, 54), x, pad + 11);
      }
      info.ms = +((performance.now() - t0) / n).toFixed(1);
      const d = 1 / 240, z = frame(0).data, last = frame(1 - d).data; let ref = 0; for (let k = 1; k < 8; k++) ref = Math.max(ref, md(frame(k / 8 - d).data, frame(k / 8).data));
      info.seam = +(md(last, z) / Math.max(ref, 0.05)).toFixed(2); info.missing = [...info.missing];
      seqOut.push(info); seqPngs[sid] = cv.toDataURL('image/png');
    }
    return { out, seqOut, seqPngs, png: sheet.toDataURL('image/png') };
  }, { kit, styles, W, H, mediaUrl, files, fontsB64, seqWanted, all: !only.length });
  await browser.close();
  if (res.fatal) { console.error('WebGL2 unavailable:', res.fatal); process.exit(1); }
  let bad = 0;
  for (const r of res.out) {
    if (r.error) { bad++; console.log(`  ✖ ${r.id}\n${r.error.replace(/^/gm, '      ')}`); continue; }
    const notes = [r.seam > 3 ? 'loop seam' : '', r.mseam != null && r.mseam > 3 ? 'motion seam' : '', r.lum < 0.01 ? 'blank?' : '', r.resp != null && r.resp < 0.5 ? 'ignores media/input?' : ''].filter(Boolean).join(', ');
    if (notes) bad++;
    console.log(`  ${notes ? '!' : '✓'} ${r.id.padEnd(24)} ${String(r.ms).padStart(7)} ms  seam ×${r.seam}${r.mseam != null ? `  motion ×${r.mseam}` : ''}  luma ${r.lum}${r.inputs.length ? `  inputs ${r.inputs.join(',')} Δ${r.resp}` : ''}${notes ? '  ← ' + notes : ''}`);
  }
  for (const s of res.seqOut) {
    if (s.error) { bad++; console.log(`  ✖ sequence ${s.id}: ${s.error}`); continue; }
    const notes = [s.seam > 3 ? 'loop seam' : '', s.missing.length ? `missing ${s.missing.join(', ')}` : '', Object.keys(s.errors).length ? 'shader errors' : '', s.dropped ? `${s.dropped} cue-frames dropped (over maxActive)` : ''].filter(Boolean).join(', ');
    if (notes) bad++;
    console.log(`  ${notes ? '!' : '✓'} sequence ${s.id.padEnd(16)} ${String(s.ms).padStart(7)} ms  ${s.cues} cues, peak ${s.peak}/${s.max}  seam ×${s.seam}${notes ? '  ← ' + notes : ''}`);
    for (const [k, e] of Object.entries(s.errors)) console.log(`      ${k}: ${e.split('\n')[0]}`);
    fs.writeFileSync(path.resolve(flags.out || '.', `${kit.id}-seq-${s.id}.png`), Buffer.from(res.seqPngs[s.id].split(',')[1], 'base64'));
  }
  const file = path.resolve(flags.out || '.', `${kit.id}-preview.png`); fs.writeFileSync(file, Buffer.from(res.png.split(',')[1], 'base64'));
  if (res.out.some(r => r.inputs && r.inputs.length)) console.log(`  inputs: ${flags.media && flags.media !== true ? flags.media : 'built-in test cards'} (Δ = mean pixel change vs. no input; * = implicit SDK 1.0 input)`);
  console.log(`  sheet ${file}\n  frame times are SwiftShader (CPU) numbers: expect 20–100× faster on a real GPU.`);
  process.exit(bad ? 1 : 0);
}
