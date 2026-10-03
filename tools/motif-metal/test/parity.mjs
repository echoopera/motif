// Parity: render every style of a kit twice, once with the WebGL2 runtime in headless Chromium and once by running the
// generated Metal source on the CPU (clang + the metal_stdlib shim, with the Swift runtime's pass/texture conventions),
// then compare the final frames. This tests the translator's semantics (maths, swizzles, mod/mix/step overloads, array
// and matrix handling, y-flip, intermediate passes, sRGB + dither) on every kit, on any OS.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readKit } from '../lib/kitio.mjs';
import { convertKit, loadKitGl } from '../lib/convert.mjs';
import { toCxx, SHIM } from './check.mjs';
import { png } from './png.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const run = (cmd, args) => new Promise(res => { const p = spawn(cmd, args); let e = ''; p.stderr.on('data', d => e += d); p.on('close', code => res({ code, err: e })); });
async function pool(items, n, fn) { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); }

function wrapper(fn, nIn, derivs) {
  const args = ['t[0]', 't[1]', 't[2]', 't[3]', ...(nIn > 0 ? ['t[4]'] : []), ...(nIn > 1 ? ['t[5]'] : [])].join(', ');
  return `
struct CpuTex { const float* data; int w, h; };
static_assert(sizeof(MotifUniforms) == 144, "MotifUniforms must be 144 bytes");
extern "C" void cpu_${fn}(const MotifUniforms* U, const float* P, const CpuTex* T, int w, int h, float* out) {
  texture2d<float> t[6];
  for (int i = 0; i < 6; i++) { t[i].data = T[i].data; t[i].w = T[i].w; t[i].h = T[i].h; }
  std::vector<std::vector<float>> logs((size_t)w * h);
  g_deriv.w = w; g_deriv.h = h; g_deriv.logs = &logs;
  for (int run = ${derivs ? 1 : 2}; run <= 2; run++) {
    g_deriv.mode = ${derivs ? 'run' : '0'};
    for (int y = 0; y < h; y++) for (int x = 0; x < w; x++) {
      g_deriv.x = x; g_deriv.y = y; g_deriv.k = 0;
      float4 r = ${fn}(float4{x + 0.5f, y + 0.5f, 0.0f, 1.0f}, *U, P, ${args});
      float* o = out + 4 * ((size_t)y * w + x); o[0] = r.x; o[1] = r.y; o[2] = r.z; o[3] = r.w;
    }
  }
  g_deriv.mode = 0;
}
`;
}

export async function parityKit(KG, kitPath, flags = {}) {
  const W = +(flags.w || 192), H = +(flags.h || 108), PH = +(flags.phase || 0.37);
  const only = flags.styles ? String(flags.styles).split(',') : null;
  const conv = convertKit(KG, readKit(kitPath));
  const kit = conv.kit;
  const styles = kit.styles.filter(s => !only || only.includes(s.localId));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motif-parity-'));

  // 1. build driver + one shared object per pass
  const drv = path.join(tmp, 'driver');
  let r = await run('clang++', ['-std=c++17', '-O1', '-ldl', path.join(here, 'parity-driver.cpp'), '-o', drv]);
  if (r.code) throw new Error('driver build failed:\n' + r.err);
  const jobs = [];
  for (const st of conv.json.styles.filter(s => styles.some(x => x.localId === s.localId))) for (const p of st.passes) {
    const msl = conv.files[`Metal/${p.source}.metal`];
    const src = toCxx(msl) + wrapper(p.function, st.inputs.length, /\b(fwidth|dfdx|dfdy|M_dFdy)\s*\(/.test(msl.slice(msl.indexOf('struct MPass_'))));
    const cpp = path.join(tmp, p.source + '.cpp'); fs.writeFileSync(cpp, src);
    jobs.push({ cpp, so: path.join(tmp, p.source + '.so'), key: p.source });
  }
  const failures = new Map();
  await pool(jobs, Math.max(1, os.cpus().length), async j => {
    const x = await run('clang++', ['-std=c++17', '-O1', '-shared', '-fPIC', '-Wno-unknown-attributes', '-Wno-c++20-extensions', '-I', SHIM, j.cpp, '-o', j.so]);
    if (x.code) failures.set(j.key, x.err.split('\n').slice(0, 8).join('\n'));
  });

  // 2. WebGL reference
  let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage(); await page.setContent('<canvas id="c"></canvas>');
  await page.addScriptTag({ content: `window.KG = (function(){ ${fs.readFileSync(path.join(here, '../lib/kit-gl.js'), 'utf8').replace('gl.LINEAR_MIPMAP_LINEAR', 'gl.LINEAR')} })();   // CPU oracle samples level 0 only, so the reference does too` });
  const ref = await page.evaluate(async ({ kit, styles, W, H, PH }) => {
    const rt = KG.createGlRuntime(); if (!rt.ok) return { fatal: rt.reason };
    const card = document.createElement('canvas'); card.width = W; card.height = H; const x = card.getContext('2d');
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1E3A8A'); g.addColorStop(0.5, '#DB2777'); g.addColorStop(1, '#F59E0B'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1; for (let i = 0; i <= W; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let j = 0; j <= H; j += 16) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); }
    x.strokeStyle = '#fff'; x.lineWidth = 3; for (let r = 12; r < 60; r += 14) { x.beginPath(); x.arc(W / 2, H / 2, r, 0, Math.PI * 2); x.stroke(); }
    x.fillStyle = '#fff'; x.font = '700 28px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('MOTIF', W / 2, H / 2);
    const cardBytes = Array.from(x.getImageData(0, 0, W, H).data);
    const out = {};
    const media = { canvas: card, rev: 1, w: W, h: H, time: 0 };
    for (const st of styles) {
      const pal = kit.palettes.find(p => p.id === st.palette) || kit.palettes[0] || { bg: '#05060A', ink: '#F2F5FF', a: ['#35E0FF', '#FF3D9A', '#FFB547'] };
      const params = Object.fromEntries(Object.entries(st.params).map(([k, s]) => [k, s.def]));
      const c = rt.compile(st.id, { passes: st.passes, common: kit.common, params: st.params, inputs: st.inputs || [] });
      if (!c.ok) { out[st.localId] = { error: c.error }; continue; }
      const variants = (st.inputs || []).length ? [false, true] : [false];
      out[st.localId] = {};
      for (const withMedia of variants) {
        const m = withMedia ? Object.fromEntries(st.inputs.map(q => [q.id, media])) : null;
        rt.draw(st.id, W, H, { p: PH, L: 6, seed: 417, safe: true, pal, params, spec: st.params, media: m });
        const gl = rt.canvas.getContext('webgl2'); const buf = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        const flipped = new Uint8Array(W * H * 4); for (let y = 0; y < H; y++) flipped.set(buf.subarray(y * W * 4, (y + 1) * W * 4), (H - 1 - y) * W * 4);
        out[st.localId][withMedia ? 'media' : 'plain'] = Array.from(flipped);
      }
    }
    return { out, cardBytes };
  }, { kit, styles, W, H, PH });
  await browser.close();
  if (ref.fatal) throw new Error('WebGL2 unavailable: ' + ref.fatal);

  // media card as linear premultiplied float RGBA (the sRGB8_ALPHA8 decode)
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const cardF = new Float32Array(W * H * 4); for (let i = 0; i < W * H; i++) { cardF[i * 4] = lin(ref.cardBytes[i * 4]); cardF[i * 4 + 1] = lin(ref.cardBytes[i * 4 + 1]); cardF[i * 4 + 2] = lin(ref.cardBytes[i * 4 + 2]); cardF[i * 4 + 3] = ref.cardBytes[i * 4 + 3] / 255; }
  const cardPath = path.join(tmp, 'card.f32'); fs.writeFileSync(cardPath, Buffer.from(cardF.buffer));

  // 3. CPU run + compare
  const results = [];
  for (const st of styles) {
    const js = conv.json.styles.find(s => s.localId === st.localId);
    const bad = js.passes.map(p => failures.get(p.source)).find(Boolean);
    const rr = ref.out[st.localId];
    if (bad || rr.error) { results.push({ id: st.localId, error: bad ? 'clang: ' + bad : 'web: ' + rr.error }); continue; }
    const pal = kit.palettes.find(p => p.id === st.palette) || kit.palettes[0] || { bg: '#05060A', ink: '#F2F5FF', a: ['#35E0FF', '#FF3D9A', '#FFB547'] };
    const colors = [pal.bg, pal.ink, ...pal.a.slice(0, 3)].map(h => [...KG.hexToLin(h), 0]);
    const P = js.params.map(p => p.type === 'toggle' ? (p.def ? 1 : 0) : p.type === 'select' ? Math.max(0, p.options.findIndex(o => o.v === p.def)) : +p.def);
    const row = { id: st.localId };
    for (const variant of Object.keys(rr)) {
      const withMedia = variant === 'media';
      const U = [W, H, PH, 6, 417, 1, 1, 0, ...colors.flat(), ...(withMedia && st.inputs.length > 0 ? [1, 0, W, H] : [0, 0, 0, 0]), ...(withMedia && st.inputs.length > 1 ? [1, 0, W, H] : [0, 0, 0, 0])];
      const outPath = path.join(tmp, `${st.localId}-${variant}.rgba`);
      const jobTxt = [`${W} ${H}`, U.join(' '), `${P.length} ${P.join(' ')}`, `${js.passes.length}`, ...js.passes.map(p => `${path.join(tmp, p.source + '.so')} ${p.function} ${p.scale}`),
        `${withMedia ? st.inputs.length : 0}`, ...(withMedia ? st.inputs.map(() => cardPath) : []), outPath].join('\n');
      const jobFile = path.join(tmp, `${st.localId}-${variant}.job`); fs.writeFileSync(jobFile, jobTxt);
      const t0 = Date.now();
      const x = spawnSync(path.join(tmp, 'driver'), [jobFile], { encoding: 'utf8', timeout: 600000 });
      if (x.status) { row[variant] = { error: `driver exit ${x.status}: ${x.stderr}` }; continue; }
      const cpu = fs.readFileSync(outPath), web = rr[variant];
      let sum = 0, big = 0, mx = 0; const n = W * H;
      for (let i = 0; i < n; i++) { let d = 0; for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(cpu[i * 4 + c] - web[i * 4 + c])); sum += d; if (d > 8) big++; if (d > mx) mx = d; }
      // Structural check: 6x6 block averages. High-frequency styles amplify the GPU's reduced-precision sin/pow into edge
      // noise that averages out; a wrong translation (flipped y, bad mod, lost swizzle) does not.
      const B = 6; let bsum = 0, bmax = 0, bn = 0;
      for (let by = 0; by + B <= H; by += B) for (let bx = 0; bx + B <= W; bx += B) {
        let e = 0; for (let c = 0; c < 3; c++) { let sa = 0, sb = 0; for (let yy = 0; yy < B; yy++) for (let xx = 0; xx < B; xx++) { const i = ((by + yy) * W + bx + xx) * 4 + c; sa += cpu[i]; sb += web[i]; } e = Math.max(e, Math.abs(sa - sb) / (B * B)); }
        bsum += e; bmax = Math.max(bmax, e); bn++;
      }
      row[variant] = { mean: +(sum / n).toFixed(3), bigPct: +(100 * big / n).toFixed(2), max: mx, blur: +(bsum / bn).toFixed(3), blurMax: +bmax.toFixed(1), ms: Date.now() - t0 };
      (row.frames ||= []).push({ variant, web: Buffer.from(web), cpu });
      if (flags.dump) { fs.mkdirSync(flags.dump, { recursive: true }); fs.writeFileSync(path.join(flags.dump, `${kit.id}-${st.localId}-${variant}-cpu.rgba`), cpu); fs.writeFileSync(path.join(flags.dump, `${kit.id}-${st.localId}-${variant}-web.rgba`), Buffer.from(web)); }
    }
    results.push(row);
  }
  return { kit, results, W, H };
}

// Styles whose output depends on the exact bits of a computed float, so no two GPUs agree on them either.
const KNOWN_CHAOTIC = {
  'mosaic/low-poly': { limit: 8, why: 'hashes triangle centroids ((a+b+c)/3.0 → floatBitsToUint): last-bit float differences change the random facet shading' },
  'mosaic/sprite-mosaic': { limit: 30, why: 'banana sprite: pow(sin(PI * t), 0.75) is NaN at t = 1 (sin(PI) = -8.7e-8 in float), so the result depends on each GPU\'s NaN handling; max(sin(PI * t), 0.0) would fix the kit' },
};

// Contact sheet: one row per style, left = WebGL, right = generated Metal run on the CPU.
export function sheet(r, file, variant = 'media') {
  const rows = r.results.map(x => ({ id: x.id, f: (x.frames || []).find(f => f.variant === variant) || (x.frames || [])[0] })).filter(x => x.f);
  const gap = 6, W = r.W * 2 + gap, H = r.H, out = Buffer.alloc(W * H * rows.length * 4, 24);
  rows.forEach((row, k) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < r.W; x++) for (const [side, buf] of [[0, row.f.web], [1, row.f.cpu]]) {
      const i = (y * r.W + x) * 4, o = ((k * H + y) * W + side * (r.W + gap) + x) * 4;
      out[o] = buf[i]; out[o + 1] = buf[i + 1]; out[o + 2] = buf[i + 2]; out[o + 3] = 255;
    }
  });
  fs.writeFileSync(file, png(W, H * rows.length, out));
}

export function report(r, tol = { blur: 2.5, blurMax: 40 }) {
  let bad = 0;
  console.log(`  ${r.kit.id} ${r.kit.version} @ ${r.W}×${r.H}  (8-bit levels; ✓ = 6×6-block mean error ≤ ${tol.blur} and worst block ≤ ${tol.blurMax}; \"exact\" = pixel mean ≤ 1.5)`);
  for (const x of r.results) {
    if (x.error) { bad++; console.log(`  ✖ ${x.id.padEnd(22)} ${x.error.split('\n')[0]}`); continue; }
    for (const [v, m] of Object.entries(x)) {
      if (v === 'id' || v === 'frames') continue;
      if (m.error) { bad++; console.log(`  ✖ ${x.id.padEnd(22)} ${v}: ${m.error.split('\n')[0]}`); continue; }
      let ok = m.blur <= tol.blur && m.blurMax <= tol.blurMax; const known = KNOWN_CHAOTIC[`${r.kit.id}/${x.id}`];
      if (!ok && known && m.blur <= known.limit) { ok = true; console.log(`  ≈ ${x.id.padEnd(22)} ${v.padEnd(6)} block mean ${m.blur}: known, ${known.why}`); continue; }
      if (!ok) bad++;
      console.log(`  ${ok ? (m.mean <= 1.5 ? '✓' : '≈') : '✖'} ${x.id.padEnd(22)} ${v.padEnd(6)} pixel mean ${String(m.mean).padStart(6)}  block mean ${String(m.blur).padStart(6)}  worst block ${String(m.blurMax).padStart(5)}`);
    }
  }
  return bad;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = [], flags = {};
  for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); flags[k] = v === undefined ? true : v; } else args.push(a); }
  const KG = loadKitGl();
  let bad = 0;
  for (const k of args) { const r = await parityKit(KG, k, flags); bad += report(r); if (flags.sheet) sheet(r, flags.sheet); }
  process.exit(bad ? 1 : 0);
}
