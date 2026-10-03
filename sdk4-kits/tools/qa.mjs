#!/usr/bin/env node
// Look-development and QA driver around tools/harness.mjs.
//   node tools/qa.mjs sheet <kit> [style,style|all] [--phases 0,.25,.5,.75] [--w 270 --h 480] [--set key=val,key=val] [--palette id] [--out file.png]
//   node tools/qa.mjs frame <kit> <style> [--p 0] [--w 1440 --h 2560] [--set ...] [--out file.png]
//   node tools/qa.mjs qa <kit> [style,...|all] [--w 180 --h 320] [--out qa.json]     seam, pops, flashes, exposure
//   node tools/qa.mjs film <kit> <style> [--seconds 6 --fps 30 --w 540 --h 960 --loops 2] [--out file.mp4]
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { openHarness } from './harness.mjs';
const [cmd, kitId, styleArg, ...rest] = process.argv.slice(2);
const flags = {}; { const r = (styleArg && styleArg.startsWith('--') ? [styleArg, ...rest] : rest); for (let i = 0; i < r.length; i++) if (r[i].startsWith('--')) { const k = r[i].slice(2); flags[k] = r[i + 1] && !r[i + 1].startsWith('--') ? r[++i] : true; } }
const styleSel = styleArg && !styleArg.startsWith('--') ? styleArg : 'all';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const kitDir = path.join(root, 'kits', kitId);
const parseSet = s => Object.fromEntries((s && s !== true ? String(s).split(',') : []).map(kv => { const [k, v] = kv.split('='); return [k, v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v]; }));
const W = +(flags.w || 270), Hh = +(flags.h || 480);
const h = await openHarness();
const { kit, report, warnings } = await h.register(kitDir);
const styles = styleSel === 'all' ? kit.styles.map(s => s.localId) : styleSel.split(',');
const set = parseSet(flags.set);
const outFile = flags.out && flags.out !== true ? path.resolve(flags.out) : null;

if (cmd === 'sheet') {
  const phases = String(flags.phases || '0,0.25,0.5,0.75').split(',').map(Number);
  const png = await h.page.evaluate(({ kitId, styles, phases, W, Hh, set, palette, L, seed }) => {
    const cols = phases.length, pad = 4, lab = 14; const sh = document.createElement('canvas'); sh.width = cols * (W + pad) + pad; sh.height = styles.length * (Hh + pad + lab) + pad;
    const x = sh.getContext('2d'); x.fillStyle = '#161616'; x.fillRect(0, 0, sh.width, sh.height); x.font = '11px monospace';
    styles.forEach((id, r) => { const st = H.prep(kitId, id); const y = pad + r * (Hh + pad + lab); x.fillStyle = '#ddd'; x.fillText(id, pad, y + 11);
      phases.forEach((p, c) => { H.grab(kitId, st, { p, set, palette, L, seed }, W, Hh); x.drawImage(H.tmp, pad + c * (W + pad), y + lab); }); });
    return sh.toDataURL('image/png').split(',')[1];
  }, { kitId, styles, phases, W, Hh, set, palette: flags.palette, L: +(flags.L || 12), seed: +(flags.seed || 417) });
  const f = outFile || path.join(root, 'qa', kitId, 'sheet.png'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, Buffer.from(png, 'base64')); console.log('wrote', f);
} else if (cmd === 'frame') {
  const buf = await h.png(kitId, styles[0], { p: +(flags.p || 0), set, palette: flags.palette, L: +(flags.L || 12), seed: +(flags.seed || 417) }, W, Hh);
  const f = outFile || path.join(root, 'qa', kitId, `${styles[0]}-p${flags.p || 0}.png`); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, buf); console.log('wrote', f);
} else if (cmd === 'qa') {
  const results = [];
  for (const id of styles) {
    const r = await h.page.evaluate(({ kitId, id, W, Hh, set }) => {
      const st = H.prep(kitId, id); const n = W * Hh * 4;
      const grab = (p, o = {}) => Uint8ClampedArray.from(H.grab(kitId, st, { p, set: { ...set, ...(o.set || {}) }, L: o.L ?? 12, seed: o.seed ?? 417, safe: true }, W, Hh));
      const md = (a, b) => { let s = 0; for (let i = 0; i < n; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (n / 4) / 3; };
      const lumM = a => { let s = 0; for (let i = 0; i < n; i += 4) s += 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]; return s / (n / 4) / 255; };
      const out = { id };
      // Delta0: mean abs 8-bit difference between phase 1-eps (one 60 fps frame earlier than the wrap) and phase 0; also exact p=1 vs p=0.
      const eps = 1 / (12 * 60); const f0 = grab(0), f1 = grab(1), fe = grab(1 - eps), fp = grab(eps);
      out.delta0_p1 = +md(f0, f1).toFixed(3); out.seamStep = +md(fe, f0).toFixed(3); out.seamStepAfter = +md(f0, fp).toFixed(3);
      // adjacent-frame velocity at 60 fps over 24 sampled windows across the loop (one frame apart)
      const vs = []; for (let k = 0; k < 24; k++) { const p = (k + 0.37) / 24; vs.push(md(grab(p), grab(p + eps))); } vs.sort((a, b) => a - b);
      const med = vs[12], mx = vs[vs.length - 1]; out.velMedian = +med.toFixed(3); out.velMax = +mx.toFixed(3);
      out.seamRatio = +(Math.max(out.seamStep, out.seamStepAfter) / Math.max(med, 0.02)).toFixed(2); // seam step vs a typical step: ~1 means invisible
      out.popRatio = +(mx / Math.max(med, 0.02)).toFixed(2);
      // exposure at min / default / max quality (same phase, same params)
      const q = st.params.quality; if (q) { const ls = q.options.map(o => lumM(grab(0.31, { set: { quality: o.v } }))); out.exposureByQuality = ls.map(v => +v.toFixed(4)); out.exposureSpread = +(Math.max(...ls) / Math.max(Math.min(...ls), 1e-4) - 1).toFixed(3); }
      out.meanLuma = +lumM(grab(0.31)).toFixed(4);
      // flash audit: worst case 1 s loop at 4x tempo (u_L = 0.25 s) -> sample 1 s at 60 fps on a 4x4 tile grid, count flash pairs per tile (0.1 luminance swing)
      const gw = 4, gh = 4; const tiles = Array.from({ length: gw * gh }, () => []);
      const fr = 60; const wl = fr; for (let f = 0; f < wl; f++) { const a = grab((f / fr) / 0.25 % 1, { L: 0.25 }); const acc = new Float64Array(gw * gh), cnt = new Float64Array(gw * gh);
        for (let y = 0; y < Hh; y++) for (let x2 = 0; x2 < W; x2++) { const i = (y * W + x2) * 4, t = Math.min(gh - 1, Math.floor(y / Hh * gh)) * gw + Math.min(gw - 1, Math.floor(x2 / W * gw)); const c = [a[i], a[i + 1], a[i + 2]].map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); acc[t] += 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; cnt[t]++; }
        for (let t = 0; t < gw * gh; t++) tiles[t].push(acc[t] / cnt[t]); }
      let flashTiles = 0, flashMax = 0; for (const seq of tiles) { let flashes = 0, dir = 0, last = seq[0], anchor = seq[0];
        for (let i = 1; i < seq.length; i++) { const dd = seq[i] - anchor; const d2 = dd > 0.1 ? 1 : dd < -0.1 ? -1 : 0; if (d2 !== 0) { if (dir !== 0 && d2 !== dir) flashes++; dir = d2; anchor = seq[i]; } last = seq[i]; }
        flashMax = Math.max(flashMax, Math.floor(flashes / 2) + 0); if (flashes >= 6) flashTiles++; }
      out.flashTilesOver3 = flashTiles; out.flashPairsMaxPerSec = flashMax;
      return out;
    }, { kitId, id, W, Hh, set });
    const tag = (r.seamRatio <= 3 ? 'seam ok' : 'SEAM?') + ' · ' + (r.popRatio <= 3 ? 'pop ok' : r.popRatio <= 6 ? 'pop warn' : 'POP FAIL') + ' · ' + (r.flashTilesOver3 === 0 ? 'flash ok' : r.flashTilesOver3 < 4 ? 'flash warn' : 'FLASH FAIL') + ' · ' + (r.exposureSpread === undefined || r.exposureSpread <= 0.15 ? 'exposure ok' : 'EXPOSURE ' + r.exposureSpread);
    console.log(`${id.padEnd(22)} d0(p1)=${r.delta0_p1} seamStep=${r.seamStep}/${r.seamStepAfter} vel~${r.velMedian} max ${r.velMax} seam×${r.seamRatio} pop×${r.popRatio} expSpread=${r.exposureSpread} | ${tag}`);
    results.push(r);
  }
  const f = outFile || path.join(root, 'qa', kitId, 'qa.json'); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify({ kit: kit.id, version: kit.version, size: [W, Hh], renderer: 'SwiftShader (software GL, headless Chromium)', note: 'Metric definitions in tools/qa.mjs. Software timings and metrics are relative diagnostics, not device performance.', results }, null, 2)); console.log('wrote', f);
} else if (cmd === 'film') {
  const fps = +(flags.fps || 30), secs = +(flags.seconds || 6), loops = +(flags.loops || 1), n = fps * secs;
  const FW = +(flags.w || 540), FH = +(flags.h || 960); const tmp = fs.mkdtempSync('/tmp/film-');
  for (let i = 0; i < n * loops; i++) { const buf = await h.png(kitId, styles[0], { p: (i % n) / n, set, palette: flags.palette, L: secs, seed: +(flags.seed || 417) }, FW, FH); fs.writeFileSync(path.join(tmp, String(i).padStart(5, '0') + '.png'), buf); }
  const f = outFile || path.join(root, 'qa', kitId, `${styles[0]}.mp4`); fs.mkdirSync(path.dirname(f), { recursive: true });
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', f], { stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true }); console.log(r.status === 0 ? 'wrote ' + f : 'ffmpeg failed');
} else console.log('commands: sheet | frame | qa | film');
await h.close();
