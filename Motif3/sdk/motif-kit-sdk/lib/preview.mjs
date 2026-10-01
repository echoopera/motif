// motif-kit preview: renders each style at four loop phases in headless Chromium (WebGL2), reports compile
// errors with pass-local line numbers, the loop seam, blank frames and frame time, and writes a contact sheet.
// Styles that declare media inputs (SDK 1.1) are rendered with --media <image> (png/jpg/webp), or with a built-in
// test card, and checked that they actually respond to the media.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
export async function runPreview(KG, raw, only, flags) {
  const require = createRequire(import.meta.url);
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { console.error('preview needs playwright: npm i -D playwright && npx playwright install chromium'); process.exit(1); }
  const v = KG.validateKit(raw.manifest, raw.files); v.warnings.forEach(w => console.log('  warn ', w));
  if (!v.ok) { v.errors.forEach(e => console.log('  error', e)); process.exit(1); }
  const kit = v.kit; const styles = KG.renderables(kit).filter(s => !only.length || only.includes(s.localId)); // styles, effects (on a test card) and transitions (test card → palette)
  const W = +(flags.w || 320), H = +(flags.h || 180);
  let mediaUrl = null;
  if (flags.media && flags.media !== true) {
    const ext = path.extname(flags.media).toLowerCase(); const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }[ext];
    if (!mime) { console.error('--media takes a png, jpg, webp or gif image (use a still from your video).'); process.exit(1); }
    mediaUrl = `data:${mime};base64,${fs.readFileSync(flags.media).toString('base64')}`;
  }
  const src = fs.readFileSync(new URL('./kit-gl.js', import.meta.url), 'utf8');
  const exe = flags.chromium || process.env.MOTIF_CHROMIUM;
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage(); await page.setContent('<canvas id="c"></canvas>');
  await page.addScriptTag({ content: `window.KG = (function(){ ${src} })();` });
  const res = await page.evaluate(async ({ kit, styles, W, H, mediaUrl }) => {
    const rt = KG.createGlRuntime(); if (!rt.ok) return { fatal: rt.reason };
    // Media source: the user's image, or a test card (gradient, grid, rings, lettering) that makes displacement visible.
    let src;
    if (mediaUrl) { const im = new Image(); im.src = mediaUrl; await im.decode(); src = im; }
    else {
      src = document.createElement('canvas'); src.width = 1280; src.height = 720; const x = src.getContext('2d');
      const g = x.createLinearGradient(0, 0, 1280, 720); g.addColorStop(0, '#1E3A8A'); g.addColorStop(0.5, '#DB2777'); g.addColorStop(1, '#F59E0B'); x.fillStyle = g; x.fillRect(0, 0, 1280, 720);
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 2; for (let i = 0; i <= 1280; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 720); x.stroke(); } for (let j = 0; j <= 720; j += 64) { x.beginPath(); x.moveTo(0, j); x.lineTo(1280, j); x.stroke(); }
      for (let r = 60; r < 360; r += 60) { x.beginPath(); x.arc(640, 360, r, 0, Math.PI * 2); x.strokeStyle = r % 120 ? '#FFFFFF' : '#111111'; x.lineWidth = 6; x.stroke(); }
      x.fillStyle = '#FFFFFF'; x.font = '700 150px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('MOTIF', 640, 360);
    }
    const bakeFill = (w, h) => { const sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, ar = w / h; let cw = sw, ch = sh; if (sw / sh > ar) cw = sh * ar; else ch = sw / ar; const c = document.createElement('canvas'); c.width = Math.round(cw); c.height = Math.round(ch); c.getContext('2d').drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, c.width, c.height); return { canvas: c, rev: 1, w: sw, h: sh, time: 0 }; };
    const baked = bakeFill(W, H);
    const other = document.createElement('canvas'); other.width = W; other.height = H; { const x = other.getContext('2d'); const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0B1E3B'); g.addColorStop(1, '#F2C14E'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    const bakedB = { canvas: other, rev: 1, w: W, h: H, time: 0 };
    const phases = [0, 0.25, 0.5, 0.75], pad = 4, lab = 16;
    const sheet = document.getElementById('c'); sheet.width = 4 * (W + pad) + pad; sheet.height = styles.length * (H + pad + lab) + pad;
    const sx = sheet.getContext('2d'); sx.fillStyle = '#1a1a1a'; sx.fillRect(0, 0, sheet.width, sheet.height);
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H; const tx = tmp.getContext('2d');
    const out = [];
    styles.forEach((st, row) => {
      const pal = kit.palettes.find(p => p.id === st.palette) || kit.palettes[0] || { bg: '#000000', ink: '#ffffff', a: ['#35E0FF', '#FF3D9A', '#FFB547'] };
      const params = Object.fromEntries(Object.entries(st.params).map(([k, s]) => [k, s.def]));
      const inputs = st.inputs || [];
      const c = rt.compile(st.id, { passes: st.passes, common: kit.common, params: st.params, inputs, ...(st.runtime || {}) });
      const y = pad + row * (H + pad + lab); sx.fillStyle = '#ddd'; sx.font = '11px monospace'; sx.fillText(st.localId + (c.ok ? '' : '  ✖'), pad, y + 11);
      if (!c.ok) { out.push({ id: st.localId, error: c.error }); return; }
      const media = inputs.length ? Object.fromEntries(inputs.map(q => [q.id, baked])) : null;
      const ext = st.kind === 'effect' ? { input: baked } : st.kind === 'transition' ? { from: baked, to: bakedB } : null;
      const u = (p, noMedia) => ({ p, L: 6, seed: 417, safe: true, pal, params, spec: st.params, media: noMedia ? null : media, ext, progress: p });
      const grab = (p, noMedia) => { rt.draw(st.id, W, H, u(p, noMedia)); tx.clearRect(0, 0, W, H); rt.blit(tx, W, H); return tx.getImageData(0, 0, W, H).data; };
      const md = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
      const t0 = performance.now(); phases.forEach((p, i) => { rt.draw(st.id, W, H, u(p)); const x = pad + i * (W + pad); sx.fillStyle = pal.bg; sx.fillRect(x, y + lab, W, H); sx.drawImage(rt.canvas, 0, rt.canvas.height - H, W, H, x, y + lab, W, H); });
      const gl = rt.canvas.getContext('webgl2'); gl.finish(); const ms = (performance.now() - t0) / 4;
      const d = 1 / 240, z = grab(0); const seam = md(grab(1 - d), z); let ref = 0; for (let k = 1; k < 8; k++) ref = Math.max(ref, md(grab(k / 8 - d), grab(k / 8)));
      let lum = 0; const m = grab(0.37); for (let i = 0; i < m.length; i += 4) lum += (m[i] + m[i + 1] + m[i + 2]) / 765;
      const resp = inputs.length ? md(grab(0.37, true), m) : null;
      out.push({ id: st.localId, kind: st.kind || 'style', ms: +ms.toFixed(1), seam: +(seam / Math.max(ref, 0.05)).toFixed(2), lum: +(lum / (W * H)).toFixed(3), inputs: inputs.map(q => q.id + (q.implicit ? '*' : '')), resp: resp == null ? null : +resp.toFixed(2) });
    });
    return { out, png: sheet.toDataURL('image/png') };
  }, { kit, styles, W, H, mediaUrl });
  await browser.close();
  if (res.fatal) { console.error('WebGL2 unavailable:', res.fatal); process.exit(1); }
  let bad = 0;
  for (const r of res.out) {
    if (r.error) { bad++; console.log(`  ✖ ${r.id}\n${r.error.replace(/^/gm, '      ')}`); continue; }
    const notes = [r.kind === 'style' && r.seam > 3 ? 'loop seam' : '', r.lum < 0.01 ? 'blank?' : '', r.resp != null && r.resp < 0.5 ? 'ignores media?' : ''].filter(Boolean).join(', ');
    if (notes) bad++;
    console.log(`  ${notes ? '!' : '✓'} ${r.id.padEnd(24)} ${String(r.ms).padStart(7)} ms  seam ×${r.seam}  luma ${r.lum}${r.inputs.length ? `  media ${r.inputs.join(',')} Δ${r.resp}` : ''}${notes ? '  ← ' + notes : ''}`);
  }
  const file = path.resolve(flags.out || '.', `${kit.id}-preview.png`); fs.writeFileSync(file, Buffer.from(res.png.split(',')[1], 'base64'));
  if (res.out.some(r => r.inputs && r.inputs.length)) console.log(`  media: ${flags.media && flags.media !== true ? flags.media : 'built-in test card'} (Δ = mean pixel change vs. no media; * = implicit SDK 1.0 input)`);
  console.log(`  sheet ${file}\n  frame times are SwiftShader (CPU) numbers: expect 20–100× faster on a real GPU.`);
  process.exit(bad ? 1 : 0);
}
