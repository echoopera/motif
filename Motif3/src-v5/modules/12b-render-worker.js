// ---- module: render-worker v1.0.0
const __m_render_worker = (() => {
// render-worker — preview rendering off the UI thread (Motif 6). The page keeps one copy of the engine source
// (<script type="text/plain" id="motif-engine-src">, modules 01–12b); `connect` boots a dedicated worker from that
// same text via a Blob URL (shim first), and `serve` is the worker's side: it owns the transferred stage canvas, its
// own GPU engine, kit runtime, finisher and render cache, and answers one frame request at a time.
// Protocol (page → worker): init { fonts } · canvas { canvas, space, gen } · frame { id, t, w, h, playing, quality,
// zebra, cache, forceCpu, project?, env?, kits?, clear? } · read { id }.
// (worker → page): ready { caps } · caps { caps } · frame { id, gen, ok, info, ms, cache, gpu } · gpu · fonts · error · fatal · pixels.

function forcedMain() { try { return new URLSearchParams(location.search).get('worker') === '0'; } catch (e) { return false; } }
function unsupported() {
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof OffscreenCanvas === 'undefined') return 'OffscreenCanvas or workers are unavailable';
  if (typeof HTMLCanvasElement === 'undefined' || !HTMLCanvasElement.prototype.transferControlToOffscreen) return 'canvas transfer is unavailable';
  if (!document.getElementById('motif-engine-src')) return 'engine source is not embedded';
  return '';
}

// Page side. onMessage gets every worker message; onFail(reason) fires once on a crash or load error.
function connect(onMessage, onFail) {
  const no = forcedMain() ? 'main thread forced by ?worker=0' : unsupported();
  if (no) return { ok: false, reason: no };
  let w, url;
  try {
    const seed = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^motif-kits/.test(k)) seed[k] = localStorage.getItem(k); } } catch (e) { /* storage unavailable */ }
    const code = `"use strict";\n(${__m_worker_shim.install.toString()})(self, ${JSON.stringify(seed)});\n${document.getElementById('motif-engine-src').textContent}\n__m_render_worker.serve(self);\n//# sourceURL=motif-render-worker.js`;
    url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    w = new Worker(url, { name: 'motif-render' });
  } catch (e) { if (url) URL.revokeObjectURL(url); return { ok: false, reason: 'render worker could not start: ' + (e && e.message) }; }
  let dead = false;
  const die = reason => { if (dead) return; dead = true; onFail(reason); };
  w.onmessage = e => { if (dead) return; if (url && e.data.type === 'ready') { URL.revokeObjectURL(url); url = null; } onMessage(e.data); };
  w.onerror = e => { e.preventDefault(); die(e.message || 'worker error'); };
  w.onmessageerror = () => die('a message could not be decoded');
  const fonts = [...document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis"]')].map(l => l.href);
  w.postMessage({ type: 'init', fonts });
  return { ok: true, client: { caps: null, post: (m, tr) => { if (!dead) w.postMessage(m, tr || []); }, terminate: () => { dead = true; w.terminate(); } } };
}

// Worker side.
function serve(scope) {
  const K = __m_kits, R = __m_renderer, A = __m_audio;
  let gpu = null, pipeline = null, fc = null, canvas = null, ctx = null, space = 'srgb', gen = 0, project = null, env = null, lastStart = 0, lastPlaying = false;
  const post = (m, tr) => scope.postMessage(m, tr || []);
  const onError = er => post({ type: 'error', message: String((er && er.message) || er) });
  K.on(ev => { if (ev.type === 'gpu') post({ type: 'gpu', gpu: ev.gpu }); });
  // Text styles need the page's web fonts; document.fonts is page-only, so the worker loads the same Google CSS itself.
  // Latin subsets load eagerly (then cached frames are dropped and the page redraws); other subsets load on use.
  async function loadFonts(hrefs) {
    if (!scope.fonts || typeof FontFace === 'undefined') return;
    const eager = [];
    for (const href of hrefs) {
      let css = ''; try { css = await (await fetch(href)).text(); } catch (e) { continue; }
      const re = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*{([^}]*)}/g; let m;
      while ((m = re.exec(css))) {
        const body = m[2], get = k => { const x = new RegExp('(?:^|[;\\s])' + k + '\\s*:\\s*([^;]+)').exec(body); return x ? x[1].trim() : null; };
        const fam = get('font-family'), src = get('src'); if (!fam || !src) continue;
        const d = {}; for (const [k, p] of [['style', 'font-style'], ['weight', 'font-weight'], ['stretch', 'font-stretch'], ['unicodeRange', 'unicode-range']]) { const v = get(p); if (v) d[k] = v; }
        try { const ff = new FontFace(fam.replace(/^['"]|['"]$/g, ''), src, d); scope.fonts.add(ff); if (!m[1] || /^latin/.test(m[1])) eager.push(ff.load()); } catch (e) { /* malformed face: skip */ }
      }
    }
    if (eager.length) { await Promise.allSettled(eager); if (fc) fc.clear(); post({ type: 'fonts' }); }
  }
  async function handle(m) {
    if (m.type === 'init') {
      gpu = __m_gpu_engine.createGpuEngine(); pipeline = R.createPipeline({ gpu }); fc = R.createFrameCache(pipeline);
      loadFonts(m.fonts || []);
      // Ready at once; WebGPU styles draw with Canvas 2D until the device arrives (as on the page), then caps update.
      const caps = () => { const g = K.gpuStatus(); return { webgl2: g.ok, webgpu: gpu.state === 'init' ? null : gpu.state === 'ready', gpuReason: gpu.reason, finisher: pipeline.finisher.ok, software: g.software, renderer: g.renderer }; };
      gpu.init().then(() => { fc.clear(); post({ type: 'caps', caps: caps() }); });
      post({ type: 'ready', caps: caps() });
    } else if (m.type === 'canvas') {
      canvas = m.canvas; ctx = null; gen = m.gen || gen; if (fc) fc.clear();
      if (canvas) {
        space = m.space || 'srgb'; ctx = canvas.getContext('2d', { colorSpace: space === 'p3' ? 'display-p3' : 'srgb' });
        // A GPU-process reset drops the 2D context; the browser restores it. Only a context that never returns is fatal.
        const c = canvas; let wait = 0;
        c.addEventListener('contextlost', () => { if (fc) fc.clear(); clearTimeout(wait); wait = setTimeout(() => { if (c === canvas) post({ type: 'fatal', message: 'preview canvas context lost' }); }, 4000); });
        c.addEventListener('contextrestored', () => { clearTimeout(wait); if (fc) fc.clear(); post({ type: 'gpu', gpu: 'restored' }); });
      }
    } else if (m.type === 'frame') {
      if (m.project) project = m.project;
      if ('env' in m) env = m.env ? A.makeEnv(m.env) : null;
      if (m.kits) { K.applySnapshot(m.kits); fc.clear(); }
      if (m.clear) fc.clear();
      fc.on = m.cache;
      if (gpu.forceCpu !== !!m.forceCpu) { gpu.setForceCpu(m.forceCpu); fc.clear(); }
      if (!ctx || !project) { post({ type: 'frame', id: m.id, gen, ok: false, ms: 0, cache: null, gpu: K.gpuStatus() }); return; }
      if (canvas.width !== m.w || canvas.height !== m.h) { canvas.width = m.w; canvas.height = m.h; }
      const t0 = performance.now();
      // The worker's own frame cadence feeds the kit-shader load governor (the page's rAF no longer reflects it).
      if (m.playing && lastPlaying && !K.runtime.pendingCompiles) K.reportFrame(t0 - lastStart);
      lastStart = t0; lastPlaying = m.playing;
      const r = fc.draw(ctx, canvas, project, m.t, { playing: m.playing, quality: m.quality, space, zebra: m.zebra, env, live: false, onError });
      post({ type: 'frame', id: m.id, gen, ok: !r.failed, info: r.info, ms: performance.now() - t0, cache: fc.stats(project), gpu: K.gpuStatus() });
    } else if (m.type === 'read') {
      const d = ctx ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
      post({ type: 'pixels', id: m.id, w: d ? d.width : 0, h: d ? d.height : 0, data: d ? d.data : null }, d ? [d.data.buffer] : []);
    } else if (m.type === 'debug-crash') setTimeout(() => { throw new Error('render worker: simulated crash'); }, 0);
  }
  // Messages are handled strictly in order (init awaits WebGPU); an exception that escapes a handler is fatal for the worker.
  let chain = Promise.resolve();
  scope.onmessage = e => { chain = chain.then(() => handle(e.data)).catch(er => post({ type: 'fatal', message: String((er && er.message) || er) })); };
}

return { connect, serve, forcedMain };

})();
