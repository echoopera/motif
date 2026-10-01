// Render worker check (Motif 6). Proves, in a real Chromium:
//   1. parity  — worker-mode stage pixels equal main-thread pixels (canvas, text, WebGPU, kit shader, runtime-installed kit, audio-mapped scene)
//   2. relief  — during deliberately heavy scenes the main thread has far fewer long tasks (and, on a real GPU, a steadier rAF) in worker mode
//   3. fallback — ?worker=0, no canvas transfer, image/video layers and a worker crash all land on the main thread automatically
//   4. no page errors
//   SOFTWARE_GL=1 PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node tools/worker-check.mjs [--seconds 6] [--webgpu] [--cpu2d] [--file motif5.html]
//   --only parity,relief,fallback runs a subset. --cpu2d rasterises Canvas 2D on the calling thread (no GPU process), which isolates main-thread cost under software GL.
// Writes performance-review/worker-check-<date>.json. Software GL timings are not representative of a real GPU.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(import.meta.dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const file = arg('file', 'motif5.html'), seconds = +arg('seconds', 6), webgpu = !!arg('webgpu', false), cpu2d = !!arg('cpu2d', false), only = String(arg('only', 'parity,relief,fallback')).split(',');
const args = [...(process.env.SOFTWARE_GL ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--ignore-gpu-blocklist']), ...(webgpu || !process.env.SOFTWARE_GL ? ['--enable-unsafe-webgpu'] : []), ...(cpu2d ? ['--disable-accelerated-2d-canvas'] : [])];
const browser = await chromium.launch({ channel: process.env.CHROME_CHANNEL || undefined, headless: true, args });
const url = q => pathToFileURL(path.join(root, file)).href + (q || '');
const report = { browser: browser.version(), args, software: null, renderer: null, cpus: (await import('node:os')).cpus().length, parity: [], relief: {}, fallback: {}, pageErrors: [], failures: [] };
const fail = msg => { report.failures.push(msg); console.error('FAIL', msg); };

// Page-side helpers, installed into every page.
const HELPERS = () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const S = () => __lab.stage;
  window.__wc = {
    sleep,
    async mode(m, ms = 30000) { const t0 = performance.now(); while (S().engineMode !== m) { if (performance.now() - t0 > ms) return false; await sleep(50); } await S().settle(); return true; },
    hash(d) { let h = 2166136261 >>> 0; for (let i = 0; i < d.length; i += 7) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h; },
    // Re-render until two consecutive frames match (shader compiles and font loads settle), then return the pixels.
    async capture() {
      let prev = null, r = null;
      for (let i = 0; i < 25; i++) { S().invalidate(); await S().settle(); r = await S().readPixels(); const h = __wc.hash(r.data); if (h === prev) return r; prev = h; await sleep(i < 4 ? 150 : 500); }
      return r;
    },
    scene(styleId, base) {
      const p = base ? structuredClone(base) : __lab.project; p.layers = [p.layers[0]]; p.active = p.layers[0].id; p.keys = {};
      __lab.setProject(p); if (styleId) __lab.selectStyle(styleId);
    },
    async parity(label, setup) {
      const st = S(); st.pause(); st.setCache(false); st.setQuality('quarter'); if (setup) await setup();
      st.seekTime(__lab.project.finish.loop * 0.37);
      st.setEngine('auto'); const okW = await __wc.mode('worker'); const w = await __wc.capture(); const infoW = st.info;
      st.setEngine('main'); await __wc.mode('main'); const m = await __wc.capture(); const infoM = st.info;
      st.setEngine('auto');
      let diff = 0, max = 0; const n = Math.min(w.data.length, m.data.length);
      for (let i = 0; i < n; i++) { const d = Math.abs(w.data[i] - m.data[i]); if (d) { diff++; if (d > max) max = d; } }
      const colors = new Set(); for (let i = 0; i < m.data.length; i += 4 * 97) colors.add((m.data[i] << 16) | (m.data[i + 1] << 8) | m.data[i + 2]);
      return { label, style: __lab.project.layers.map(l => l.styleId).join('+'), size: `${m.w}x${m.h}`, workerMode: okW, sameSize: w.w === m.w && w.h === m.h, diffBytes: diff, maxDiff: max, sampledColors: colors.size, enginesWorker: infoW && infoW.engines, enginesMain: infoM && infoM.engines };
    },
    // Main-thread responsiveness while the stage plays the current scene for `sec` seconds.
    async relief(mode, sec) {
      const st = S(); st.setEngine(mode === 'main' ? 'main' : 'auto'); await __wc.mode(mode);
      st.setCache(false); st.setQuality('high'); st.play(); await sleep(1500);
      const long = []; const po = new PerformanceObserver(l => { for (const e of l.getEntries()) long.push(e.duration); }); po.observe({ type: 'longtask' });
      const raf = []; let last = 0, on = true; const loop = now => { if (last) raf.push(now - last); last = now; if (on) requestAnimationFrame(loop); }; requestAnimationFrame(loop);
      const lag = []; let lagOn = true; (async () => { while (lagOn) { const t0 = performance.now(); await new Promise(r => setTimeout(r, 0)); lag.push(performance.now() - t0); await sleep(50); } })();
      const f0 = st.framesDrawn, t0 = performance.now(); await sleep(sec * 1000); const dt = (performance.now() - t0) / 1000, frames = st.framesDrawn - f0;
      on = false; lagOn = false; po.disconnect(); st.pause();
      const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b.length ? +b[Math.min(b.length - 1, Math.ceil(b.length * p) - 1)].toFixed(1) : 0; };
      return { mode: st.engineMode, seconds: +dt.toFixed(2), longTasks: long.length, longTaskMs: Math.round(long.reduce((a, b) => a + b, 0)), longestTaskMs: Math.round(Math.max(0, ...long)), rafP50: q(raf, 0.5), rafP95: q(raf, 0.95), rafMax: q(raf, 1), lagP95: q(lag, 0.95), previewFps: +(frames / dt).toFixed(1), renderMs: +st.frameMs().toFixed(1) };
    },
  };
};
async function open(q, init) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }); const errors = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('worker', w => w.on('console', () => {}));
  if (init) await page.addInitScript(init);
  await page.goto(url(q)); await page.waitForFunction(() => window.__lab, null, { timeout: 60000 });
  await page.evaluate(`(${HELPERS})()`);
  return { page, errors, done: async () => { report.pageErrors.push(...errors.map(e => `${q || ''} ${e}`)); await page.close(); } };
}

try {
  // ---------- 1. parity ----------
  if (only.includes('parity')) {
    const { page, done } = await open('');
    const boot = await page.evaluate(async () => { const ok = await __wc.mode('worker', 60000); const g = __lab.kits.gpuStatus(); return { ok, caps: __lab.stage.engineCaps, reason: __lab.stage.engineReason, mainGpu: __lab.gpu.state, software: g.software, renderer: g.renderer }; });
    report.boot = boot; report.software = boot.software; report.renderer = boot.renderer;
    if (!boot.ok) fail(`stage never reached worker mode: ${boot.reason}`);
    const pick = await page.evaluate(() => {
      const S = __m_style_library.STYLES;
      const glsl = S.filter(s => s.engine === 'glsl' && !(s.inputs && s.inputs.length));
      return { text: (S.find(s => s.params && s.params.font && !s.kit) || {}).id, gpu: (S.find(s => s.gpu) || {}).id, kit: glsl[0] && glsl[0].id, kit2: glsl[Math.floor(glsl.length / 2)] && glsl[Math.floor(glsl.length / 2)].id };
    });
    const demo = await page.evaluate(() => __lab.project);
    const cases = [['demo project (3 layers + finish)', null, true], ['canvas: plexus', 'plexus'], ['canvas: halftone', 'halftone'], ['text style', pick.text], ['WebGPU style', pick.gpu], ['kit shader', pick.kit], ['kit shader 2', pick.kit2]];
    for (const [label, id, whole] of cases) {
      if (!whole && !id) { report.parity.push({ label, skipped: 'no such style' }); continue; }
      const r = await page.evaluate(async ([label, id, whole, demo]) => __wc.parity(label, async () => { if (whole) __lab.setProject(demo); else __wc.scene(id, demo); }), [label, id, !!whole, demo]);
      report.parity.push(r); console.log('parity', JSON.stringify(r));
    }
    // A kit installed at runtime must reach the worker (registry mirror).
    // As a JSON bundle (the .motifkit zip needs the fflate CDN script, which offline runs do not have).
    const { execFileSync } = await import('node:child_process');
    const bundle = execFileSync('python3', ['-c', 'import zipfile,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({"manifest":json.loads(z.read("manifest.json")),"files":{n:z.read(n).decode() for n in z.namelist() if n!="manifest.json" and not n.endswith("/")}}))', path.join(root, 'kits/param-lab-0.1.0.motifkit')]);
    const kitBytes = [...bundle];
    const inst = await page.evaluate(async ([bytes]) => { const before = __m_style_library.STYLES.length; await __lab.importKitBytes(bytes, 'param-lab.motifkit.json'); const s = __m_style_library.STYLES.find(x => x.kit === 'param-lab'); return { added: __m_style_library.STYLES.length - before, id: s && s.id }; }, [kitBytes]);
    if (inst.id) { const r = await page.evaluate(async ([id, demo]) => __wc.parity('runtime-installed kit', async () => __wc.scene(id, demo)), [inst.id, demo]); report.parity.push(r); console.log('parity', JSON.stringify(r)); }
    else report.parity.push({ label: 'runtime-installed kit', skipped: 'install failed' });
    // Analysed audio envelope (marshalled to the worker): a 4 s pulsing tone mapped onto a parameter.
    const sr = 22050, n = sr * 4, wav = Buffer.alloc(44 + n * 2);
    wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 2, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sr, 24); wav.writeUInt32LE(sr * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) { const tt = i / sr; wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 110 * tt) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 2 * tt)) * 20000), 44 + i * 2); }
    const au = await page.evaluate(async ([bytes, demo]) => {
      __wc.scene('plexus', demo); await __lab.loadAudio(new Uint8Array(bytes).buffer, 'pulse.wav');
      const env = __lab.env; return { env: !!env, marshallable: !!(env && env.source), maps: __lab.project.audio && __lab.project.audio.maps.length };
    }, [[...wav], demo]);
    report.audio = au;
    if (au.env) { const r = await page.evaluate(async () => __wc.parity('audio-mapped scene (analysed envelope)', null)); report.parity.push(r); console.log('parity', JSON.stringify(r)); }
    await done();
  }
  // ---------- 2. main-thread relief ----------
  // Two heavy scenes, each measured main → worker → main → worker on one page after start-up work (thumbnails, compiles) is quiet.
  // canvas-heavy: the demo plus three dense Plexus layers, all Canvas 2D, no GPU finishing (cost lands on the rendering thread;
  // run with --cpu2d so Canvas 2D rasterises there too instead of in the GPU process).
  // shader-heavy: the demo with its WebGL2 finish plus a kit shader layer (under software GL the GPU process is CPU-bound,
  // so rAF there is limited by the GPU process in both modes; gated only on a real GPU).
  if (only.includes('relief')) {
    const { page, done } = await open('');
    report.relief.quiet = await page.evaluate(async () => {
      await __wc.mode('worker', 60000); __lab.stage.pause(); let lastLong = performance.now(); const t0 = performance.now();
      const po = new PerformanceObserver(l => { if (l.getEntries().length) lastLong = performance.now(); }); po.observe({ type: 'longtask' });
      while (performance.now() - lastLong < 2000 && performance.now() - t0 < 30000) await __wc.sleep(200);
      po.disconnect(); return Math.round(performance.now() - t0);
    });
    if (!report.renderer) { const g = await page.evaluate(() => __lab.kits.gpuStatus()); report.renderer = g.renderer; report.software = g.software; }
    const demo = await page.evaluate(() => __lab.project);
    const kit = await page.evaluate(() => (__m_style_library.STYLES.find(s => s.engine === 'glsl' && !(s.inputs && s.inputs.length)) || {}).id);
    const scenes = {
      'canvas-heavy': p => {
        p.finish = { ...p.finish, glow: 0, chroma: 0, depth: 0, black: 0, white: 1, gamma: 1, gmap: 0, shutter: 0 };
        const base = p.layers.find(l => l.styleId === 'plexus');
        for (let i = 0; i < 3; i++) { const l = structuredClone(base); l.id = 'wc-plx' + i; l.shared = { ...l.shared, seed: (l.shared.seed || 1) + 11 * (i + 1) }; l.params = { ...l.params, points: 260, distance: 0.4, lines: 0.4 }; l.comp = { ...l.comp, blend: 'screen', opacity: 0.5 }; p.layers.splice(1, 0, l); }
        return p;
      },
      'shader-heavy': (p, kit) => { if (kit) { const l = structuredClone(p.layers[0]); l.id = 'wc-kit'; l.styleId = kit; l.params = {}; l.comp = { ...l.comp, blend: 'screen', opacity: 0.6 }; p.layers.splice(1, 0, l); } return p; },
    };
    for (const [name, fn] of Object.entries(scenes)) {
      await page.evaluate(([src, demo, kit]) => { const fn = (0, eval)(src); __lab.setProject(fn(structuredClone(demo), kit)); }, [fn.toString(), demo, kit]);
      const runs = report.relief[name] = { main: [], worker: [] };
      for (const mode of ['main', 'worker', 'main', 'worker']) {
        const r = await page.evaluate(async ([m, s]) => __wc.relief(m, s), [mode, seconds]);
        r.scene = name; r.post = await page.evaluate(() => __lab.stage.info && __lab.stage.info.post); runs[mode].push(r); console.log('relief', JSON.stringify(r));
      }
    }
    await done();
  }
  // ---------- 3. fallback ----------
  if (only.includes('fallback')) {
  {
    const { page, done } = await open('?worker=0');
    report.fallback.forced = await page.evaluate(async () => { await __wc.sleep(3000); return { mode: __lab.stage.engineMode, reason: __lab.stage.engineReason, frames: __lab.stage.framesDrawn }; });
    await done();
  }
  {
    const { page, done } = await open('', () => { delete HTMLCanvasElement.prototype.transferControlToOffscreen; });
    report.fallback.noTransfer = await page.evaluate(async () => { await __wc.sleep(3000); return { mode: __lab.stage.engineMode, reason: __lab.stage.engineReason, frames: __lab.stage.framesDrawn }; });
    await done();
  }
  {
    const { page, done } = await open('');
    report.fallback.media = await page.evaluate(async () => {
      await __wc.mode('worker', 60000); const S = __m_style_library.STYLES.find(s => s.inputs && s.inputs.length); if (!S) return { skipped: 'no media style' };
      __wc.scene(S.id); await __wc.mode('worker');
      const c = document.createElement('canvas'); c.width = 64; c.height = 48; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(0, 0, 64, 48); x.fillStyle = '#3c3'; x.fillRect(16, 12, 32, 24);
      const blob = await new Promise(r => c.toBlob(r, 'image/png')); const ok = await __lab.attachMedia(new File([blob], 'probe.png', { type: 'image/png' }));
      const toMain = await __wc.mode('main', 10000); const reason = __lab.stage.engineReason;
      const p = __lab.project; for (const l of p.layers) delete l.media; __lab.setProject(p);
      const back = await __wc.mode('worker', 10000);
      return { style: S.id, attached: ok, toMain, reason, backToWorker: back };
    });
    report.fallback.crash = await page.evaluate(async () => {
      const st = __lab.stage; st.play(); await __wc.mode('worker'); st.debugWorker('crash');
      const toMain = await __wc.mode('main', 10000); const f0 = st.framesDrawn; await __wc.sleep(1500);
      const px = await st.readPixels(); st.pause();
      return { toMain, reason: st.engineReason, framesAfter: st.framesDrawn - f0, pixels: px.w * px.h, canvases: document.querySelectorAll('#stageBox canvas').length };
    });
    await done();
  }
  }
} finally { await browser.close(); }

// ---------- verdict ----------
for (const p of report.parity) if (!p.skipped) {
  if (!p.workerMode) fail(`parity ${p.label}: worker mode not reached`);
  else if (!p.sameSize || p.diffBytes) fail(`parity ${p.label}: ${p.diffBytes} bytes differ (max ${p.maxDiff})`);
  if (p.sampledColors < 2) fail(`parity ${p.label}: blank frame`);
}
for (const [name, runs] of Object.entries(report.relief)) {
  if (!runs || !runs.main) continue;
  // Under software GL with GPU-accelerated Canvas 2D, all raster runs in the (CPU-bound) GPU process for both modes, so the
  // page's main thread is not where the cost lands: report only. Use --cpu2d there, or a real GPU, for a gated run.
  const soft = !!process.env.SOFTWARE_GL, w = runs.worker, m = runs.main, gated = soft ? cpu2d && name === 'canvas-heavy' : true;
  if (soft && !cpu2d) console.log(`relief ${name}: report only (software GL with accelerated Canvas 2D: raster cost sits in the GPU process in both modes)`);
  runs.summary = { gated, mainLongTaskMs: m.map(x => x.longTaskMs), workerLongTaskMs: w.map(x => x.longTaskMs), mainRafP95: m.map(x => x.rafP95), workerRafP95: w.map(x => x.rafP95), mainLagP95: m.map(x => x.lagP95), workerLagP95: w.map(x => x.lagP95) };
  if (w.some(x => x.mode !== 'worker') || m.some(x => x.mode !== 'main')) fail(`relief ${name}: runs were not in the intended modes`);
  // Long-task time is the gate (robust on any device). rAF p95 is gated only on a real GPU: under software GL the compositor
  // shares the CPUs with SwiftShader and the worker, so rAF stays slow in both modes. Event-loop lag is reported, not gated
  // (a 50 ms probe often lands between frame tasks).
  if (!gated) continue;
  if (!(Math.max(...w.map(x => x.longTaskMs)) < Math.min(...m.map(x => x.longTaskMs)) * 0.25)) fail(`relief ${name}: worker mode did not cut main-thread long-task time by 4x`);
  if (!soft && !(Math.max(...w.map(x => x.rafP95)) < Math.min(...m.map(x => x.rafP95)))) fail(`relief ${name}: worker mode did not lower main-thread rAF p95`);
}
const fb = report.fallback;
if (only.includes('fallback')) {
if (!fb.forced || fb.forced.mode !== 'main' || !/worker=0/.test(fb.forced.reason) || !fb.forced.frames) fail('?worker=0 did not force the main thread');
if (!fb.noTransfer || fb.noTransfer.mode !== 'main' || !fb.noTransfer.frames) fail('missing transferControlToOffscreen did not fall back');
if (fb.media && !fb.media.skipped && !(fb.media.attached && fb.media.toMain && fb.media.backToWorker)) fail('media layer fallback did not switch main → worker correctly');
if (!fb.crash || !fb.crash.toMain || !(fb.crash.framesAfter > 0) || fb.crash.canvases !== 1) fail('worker crash did not fall back to a live main-thread stage');
}
if (report.pageErrors.length) fail(`page errors: ${report.pageErrors.join(' | ')}`);
const out = path.join(root, 'performance-review', `worker-check-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`${report.renderer || 'unknown GPU'}${report.software ? ' (SOFTWARE GL: timings not representative of a real GPU)' : ''} · ${report.cpus} CPUs · → ${path.relative(root, out)}`);
console.table(Object.values(report.relief).filter(v => v && v.main).flatMap(v => [...v.main, ...v.worker]).map(({ scene, mode, longTasks, longTaskMs, longestTaskMs, rafP50, rafP95, lagP95, previewFps, renderMs, post }) => ({ scene, mode, longTasks, longTaskMs, longestTaskMs, rafP50, rafP95, lagP95, previewFps, renderMs, post })));
console.log(JSON.stringify(report.fallback));
console.log(report.failures.length ? `worker-check FAILED (${report.failures.length})` : 'worker-check OK');
process.exit(report.failures.length ? 1 : 0);
