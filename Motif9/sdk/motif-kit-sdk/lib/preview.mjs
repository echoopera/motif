// motif-kit preview: renders each style at four loop phases in headless Chromium (WebGL2), reports compile
// errors with pass-local line numbers, the loop seam, blank frames and frame time, and writes a contact sheet.
// Styles that declare media inputs (SDK 1.1) are rendered with --media <image> (png/jpg/webp), or with a built-in
// test card, and checked that they actually respond to the media.
// Text inputs (motif-kit@3) are rendered with their declared default strings (or --text "LINE 1|LINE 2|LINE 3"),
// rasterized by the app's own atlas code with the bundled fallback font (lib/fonts/DejaVuSans-Bold.ttf), so compile,
// canary-style timing and the "responds to its input" check all run on real glyphs on every machine.
// motif-kit@4: svg inputs and text distance fields are baked exactly as the app does; layer stacks get a distinct test card per layer;
// styles with stack or svg controls are loop-tested with every play mode on ("motion seam"); sequences are rendered through the
// same planner and blend modes as the app's Sequencer layer (8 frames each, loop-tested), see --sequence <id>.
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
  const fontB64 = fs.readFileSync(new URL('./fonts/DejaVuSans-Bold.ttf', import.meta.url)).toString('base64');
  const textOverride = flags.text && flags.text !== true ? String(flags.text).split('|') : null;
  const seqWanted = flags.sequence && flags.sequence !== true ? [flags.sequence] : (kit.sequences || []).map(q => q.id);
  const exe = flags.chromium || process.env.MOTIF_CHROMIUM;
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage(); await page.setContent('<canvas id="c"></canvas>');
  await page.addScriptTag({ content: `window.KG = (function(){ ${src} })();` });
  const res = await page.evaluate(async ({ kit, styles, W, H, mediaUrl, fontB64, textOverride, seqWanted }) => {
    const rt = KG.createGlRuntime(); if (!rt.ok) return { fatal: rt.reason };
    // Bundled fallback font for text inputs: every line is drawn with it, whatever family the manifest names.
    const fbytes = Uint8Array.from(atob(fontB64), c => c.charCodeAt(0));
    const face = new FontFace('Motif Preview Sans', fbytes.buffer); await face.load(); document.fonts.add(face);
    const TA = KG.textAtlas;
    const textAtlas = q => TA.atlasFor(q, { lines: Object.fromEntries(q.lines.map((l, i) => [l.id, { ...l, text: textOverride && textOverride[i] != null ? textOverride[i] : l.def, font: { family: 'Motif Preview Sans', weight: l.font.weight } }])) }, Math.max(W, 1024), 'preview');
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
    // Stack layers (motif-kit@4) get a distinct card each, so blend modes and per-layer motion are visible.
    const cards = [baked, bakedB];
    { const c3 = document.createElement('canvas'); c3.width = W; c3.height = H; const x = c3.getContext('2d'); x.fillStyle = '#10B981'; x.fillRect(0, 0, W, H); x.fillStyle = '#FDE68A'; for (let i = 0; i < 9; i++) x.fillRect((i % 3) * W / 3 + 6, Math.floor(i / 3) * H / 3 + 6, W / 3 - 12, H / 3 - 12); x.fillStyle = '#064E3B'; x.beginPath(); x.moveTo(8, 8); x.lineTo(70, 8); x.lineTo(8, 60); x.fill(); cards.push({ canvas: c3, rev: 1, w: W, h: H, time: 0 }); }
    const V4 = KG.v4;
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
      const mediaFor = P => {
        if (!inputs.length) return null;
        const m = Object.fromEntries(inputs.filter(q => q.type !== 'svg' && q.type !== 'sdf').map(q => [q.id, q.type === 'text' ? textAtlas(q) : q.stack ? cards[(q.stack - 1) % 3] : baked]));
        Object.assign(m, V4.resolveSvg(inputs, { w: W, h: H }) || {}, V4.resolveTextSdf(inputs, m, { w: W, h: H }) || {});
        return m;
      };
      const media = mediaFor(params);
      const ext = st.kind === 'effect' ? { input: baked } : st.kind === 'transition' ? { from: baked, to: bakedB } : null;
      const u = (p, noMedia) => ({ p, L: 6, seed: 417, safe: true, pal, params, spec: st.params, media: noMedia ? null : media, ext, progress: p });
      const grab = (p, noMedia) => { rt.draw(st.id, W, H, u(p, noMedia)); tx.clearRect(0, 0, W, H); rt.blit(tx, W, H); return tx.getImageData(0, 0, W, H).data; };
      const md = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };
      const t0 = performance.now(); phases.forEach((p, i) => { rt.draw(st.id, W, H, u(p)); const x = pad + i * (W + pad); sx.fillStyle = pal.bg; sx.fillRect(x, y + lab, W, H); sx.drawImage(rt.canvas, 0, rt.canvas.height - H, W, H, x, y + lab, W, H); });
      const gl = rt.canvas.getContext('webgl2'); gl.finish(); const ms = (performance.now() - t0) / 4;
      const d = 1 / 240, z = grab(0); const seam = md(grab(1 - d), z); let ref = 0; for (let k = 1; k < 8; k++) ref = Math.max(ref, md(grab(k / 8 - d), grab(k / 8)));
      let lum = 0; const m = grab(0.37); for (let i = 0; i < m.length; i += 4) lum += (m[i] + m[i + 1] + m[i + 2]) / 765;
      const resp = inputs.length ? md(grab(0.37, true), m) : null;
      // motif-kit@4 motion seam: every block's Cycles/loop on, all four play modes; the loop must still close.
      let mseam = null;
      if (st.blocks && st.blocks.length) {
        mseam = 0;
        for (const dir of ['forward', 'backward', 'pingpong', 'random']) {
          const over = {}; for (const b of st.blocks) { over[b.id + 'Speed'] = 2; over[b.id + 'Dir'] = dir; over[b.id + 'MotionX'] = 1; over[b.id + 'MotionY'] = 1; if (b.kind === 'layer') over[b.id + 'Edge'] = 'clip'; }
          const g2 = (p) => { rt.draw(st.id, W, H, { ...u(p), params: { ...params, ...over } }); tx.clearRect(0, 0, W, H); rt.blit(tx, W, H); return tx.getImageData(0, 0, W, H).data; };
          const a = g2(0), b2 = g2(1 - d); let r2 = 0; for (let k = 1; k < 8; k++) r2 = Math.max(r2, md(g2(k / 8 - d), g2(k / 8)));
          mseam = Math.max(mseam, md(a, b2) / Math.max(r2, 0.05));
        }
      }
      out.push({ id: st.localId, kind: st.kind || 'style', mseam: mseam == null ? null : +mseam.toFixed(2), ms: +ms.toFixed(1), seam: +(seam / Math.max(ref, 0.05)).toFixed(2), lum: +(lum / (W * H)).toFixed(3), inputs: inputs.map(q => q.id + (q.implicit ? '*' : '') + (q.type === 'text' ? ' (text)' : q.type === 'svg' ? ' (svg)' : q.type === 'sdf' ? ' (distance)' : q.stack ? ' (layer)' : '')), resp: resp == null ? null : +resp.toFixed(2) });
    });
    // Sequences: the app's planner and blend modes, one 2D canvas, 8 frames each.
    const seqOut = [], seqPngs = {};
    for (const sid of seqWanted) {
      const seq = (kit.sequences || []).find(q => q.id === sid); if (!seq) { seqOut.push({ id: sid, error: 'no such sequence in this kit' }); continue; }
      const byRef = new Map(KG.renderables(kit).filter(e => e.kind === 'style').map(e => [e.id, e])); const errs = new Set();
      const frame = p => {
        const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { willReadFrequently: true });
        const pal0 = kit.palettes[0] || { bg: '#000000', ink: '#ffffff', a: ['#35E0FF', '#FF3D9A', '#FFB547'] }; x.fillStyle = pal0.bg; x.fillRect(0, 0, W, H);
        const plan = V4.planSequence(seq, p, { L: seq.loop || 6, seed: 417, maxActive: seq.maxActive });
        for (const a of plan.active) {
          const st = byRef.get(a.cue.style); if (!st) { errs.add('missing ' + a.cue.style); continue; }
          const pal = kit.palettes.find(q => q.id === st.palette) || pal0, params = { ...Object.fromEntries(Object.entries(st.params).map(([k, q]) => [k, q.def])), ...a.cue.params };
          const k = rt.compile(st.id, { passes: st.passes, common: kit.common, params: st.params, inputs: st.inputs || [], ...(st.runtime || {}) }, true); if (!k.ok) { errs.add(a.cue.style + ': ' + k.error.split('\n')[0]); continue; }
          const media = (st.inputs || []).length ? Object.fromEntries((st.inputs || []).filter(q => q.type !== 'svg' && q.type !== 'sdf').map(q => [q.id, q.type === 'text' ? textAtlas(q) : baked])) : null;
          if (media) Object.assign(media, V4.resolveSvg(st.inputs, { w: W, h: H }) || {}, V4.resolveTextSdf(st.inputs, media, { w: W, h: H }) || {});
          rt.draw(st.id, W, H, { p: a.innerP, L: a.innerL, seed: a.cue.seed || 417, safe: true, pal, params, spec: st.params, media });
          x.save(); x.globalCompositeOperation = V4.BLEND_CANVAS[a.cue.blend]; x.globalAlpha = a.alpha; rt.blit(x, W, H); x.restore();
        }
        return { x, cv, plan, data: x.getImageData(0, 0, W, H).data };
      };
      const n = 8, sh = document.createElement('canvas'); sh.width = n * (W + pad) + pad; sh.height = H + pad * 2 + lab; const sc = sh.getContext('2d'); sc.fillStyle = '#1a1a1a'; sc.fillRect(0, 0, sh.width, sh.height);
      const info = { id: sid, cues: seq.cues.length, peak: V4.analyzeSequence(seq).peak, max: seq.maxActive }; const t0 = performance.now(); let dropped = 0;
      for (let i = 0; i < n; i++) { const f = frame(i / n); dropped += f.plan.dropped; sc.drawImage(f.cv, pad + i * (W + pad), pad + lab); sc.fillStyle = '#ddd'; sc.font = '11px monospace'; sc.fillText((sid + ' p=' + (i / n).toFixed(3) + ' ' + f.plan.active.map(a => a.cue.id).join(' ')).slice(0, 54), pad + i * (W + pad), pad + 11); }
      info.ms = +((performance.now() - t0) / n).toFixed(1); info.dropped = dropped;
      const d = 1 / 240, md2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; }; const z = frame(0).data; let ref = 0; for (let k = 1; k < 8; k++) ref = Math.max(ref, md2(frame(k / 8 - d).data, frame(k / 8).data));
      info.seam = +(md2(frame(1 - d).data, z) / Math.max(ref, 0.05)).toFixed(2); info.errors = [...errs]; seqOut.push(info); seqPngs[sid] = sh.toDataURL('image/png');
    }
    return { out, seqOut, seqPngs, png: sheet.toDataURL('image/png') };
  }, { kit, styles, W, H, mediaUrl, fontB64, textOverride, seqWanted });
  await browser.close();
  if (res.fatal) { console.error('WebGL2 unavailable:', res.fatal); process.exit(1); }
  let bad = 0;
  for (const r of res.out) {
    if (r.error) { bad++; console.log(`  ✖ ${r.id}\n${r.error.replace(/^/gm, '      ')}`); continue; }
    const notes = [r.kind === 'style' && r.seam > 3 ? 'loop seam' : '', r.mseam != null && r.mseam > 3 ? 'motion seam' : '', r.lum < 0.01 ? 'blank?' : '', r.resp != null && r.resp < 0.5 ? (r.inputs.some(x => /\(text\)/.test(x)) ? 'ignores its text?' : 'ignores media?') : ''].filter(Boolean).join(', ');
    if (notes) bad++;
    console.log(`  ${notes ? '!' : '✓'} ${r.id.padEnd(24)} ${String(r.ms).padStart(7)} ms  seam ×${r.seam}${r.mseam != null ? `  motion ×${r.mseam}` : ''}  luma ${r.lum}${r.inputs.length ? `  media ${r.inputs.join(',')} Δ${r.resp}` : ''}${notes ? '  ← ' + notes : ''}`);
  }
  for (const q of res.seqOut) {
    if (q.error) { bad++; console.log(`  ✖ sequence ${q.id}: ${q.error}`); continue; }
    const notes = [q.seam > 3 ? 'loop seam' : '', q.errors.length ? q.errors.join('; ') : '', q.dropped ? `${q.dropped} cue-frames dropped (over maxActive)` : ''].filter(Boolean).join(', ');
    if (notes) bad++;
    console.log(`  ${notes ? '!' : '✓'} sequence ${q.id.padEnd(16)} ${String(q.ms).padStart(7)} ms  ${q.cues} cues, peak ${q.peak}/${q.max}  seam ×${q.seam}${notes ? '  ← ' + notes : ''}`);
    fs.writeFileSync(path.resolve(flags.out || '.', `${kit.id}-seq-${q.id}.png`), Buffer.from(res.seqPngs[q.id].split(',')[1], 'base64'));
  }
  const file = path.resolve(flags.out || '.', `${kit.id}-preview.png`); fs.writeFileSync(file, Buffer.from(res.png.split(',')[1], 'base64'));
  if (res.out.some(r => r.inputs && r.inputs.some(x => !/\(text\)/.test(x)))) console.log(`  media: ${flags.media && flags.media !== true ? flags.media : 'built-in test card'} (Δ = mean pixel change vs. no media; * = implicit SDK 1.0 input)`);
  if (res.out.some(r => r.inputs && r.inputs.some(x => /\(text\)/.test(x)))) console.log(`  text:  ${textOverride ? textOverride.join(' | ') : 'declared default strings'} in the bundled DejaVu Sans Bold (Δ = mean pixel change vs. no atlas)`);
  console.log(`  sheet ${file}\n  frame times are SwiftShader (CPU) numbers: expect 20–100× faster on a real GPU.`);
  process.exit(bad ? 1 : 0);
}
