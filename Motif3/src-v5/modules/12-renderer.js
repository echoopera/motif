// ---- module: renderer v2.1.0
const __m_renderer = (() => {
// renderer — the frame pipeline (evaluate → layers → motion blur → finishing), the stage loop
// with an optional audio clock, library thumbnails and export sizing.
const { ASPECTS } = __m_tokens;
const { mulberry32, hash, memo, makeCanvas, fract } = __m_engine_core;
const { evaluate } = __m_timeline;
const { createCompositor } = __m_compositor;
const { createFinisher, needsGpu } = __m_finish;
const { resolvePalette, gradientStops, hexToRgb01 } = __m_colour;

function grainTile(light, dark) {
  return memo(`grain|${light}|${dark}`, () => {
    const c = makeCanvas(256, 256), x = c.getContext('2d'), rng = mulberry32(99);
    for (let i = 0; i < 9000; i++) { x.globalAlpha = 0.25 + rng() * 0.75; x.fillStyle = rng() < 0.5 ? light : dark; x.fillRect(Math.floor(rng() * 256), Math.floor(rng() * 256), 1, 1); }
    return c;
  });
}
// Canvas 2D finish (grain + vignette) for when no GPU pass is needed or WebGL2 is missing.
function cpuFinish(ctx, w, h, f, pal, t, transparent) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  if (f.vignette > 0 && !transparent) {
    const D = Math.hypot(w, h) / 2, g = ctx.createRadialGradient(w / 2, h / 2, D * 0.35, w / 2, h / 2, D);
    g.addColorStop(0, pal.alpha(pal.shade, 0)); g.addColorStop(1, pal.alpha(pal.shade, f.vignette * 0.7));
    ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  if (f.grain > 0) {
    const tile = grainTile(pal.grainLight, pal.grainDark), sc = Math.max(1, Math.min(w, h) / 720);
    const fi = Math.floor(fract(t / f.loop) * f.loop * 24), ox = hash(fi, 1) * 256, oy = hash(fi, 2) * 256;
    ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = f.grain * 0.55; ctx.scale(sc, sc);
    for (let y = -oy; y < h / sc; y += 256) for (let x = -ox; x < w / sc; x += 256) ctx.drawImage(tile, x, y);
  }
  ctx.restore();
}

// WebGPU → Canvas 2D → WebGL hand-offs are not always ordered; a 1-pixel read makes the 2D canvas
// finish its pending draws before WebGL samples it.
function syncCanvas(c) { try { c._ctx.getImageData(0, 0, 1, 1); } catch (e) { /* tainted or unavailable */ } }

// One pipeline per page: shares the GPU engine, the WebGL2 finisher and scratch canvases.
function createPipeline({ gpu }) {
  const compositor = createCompositor({ gpu });
  const finisher = createFinisher();
  // Render project at time t into ctx (w×h). opts: { transparent, env, preview, previewSamples, space, zebra, cpu, onError }
  function renderFrame(ctx, w, h, project, t, opts = {}) {
    const out = project.output, space = opts.space || out.space;
    const ev0 = evaluate(project, t, opts.env), f = ev0.finish;
    let samples = f.shutter > 0 ? f.samples : 1;
    if (opts.preview && samples > 1) samples = Math.max(2, Math.min(samples, opts.previewSamples || 4));
    const zebra = !!opts.zebra, legal = !!out.broadcastSafe;
    const gpuPost = finisher.ok && (needsGpu(f, { broadcastSafe: legal, zebra }) || samples > 1);
    const common = { transparent: opts.transparent, space, customs: project.palettes, cpu: opts.cpu, onError: opts.onError };
    let pal, engines = [];
    if (!gpuPost && samples === 1) {
      const r = compositor.renderEvaluated(ctx, w, h, ev0, t, common); pal = r.pal; engines = r.engines;
      cpuFinish(ctx, w, h, f, pal, t, opts.transparent);
      return { u: ev0.u, engines, samples, post: 'cpu' };
    }
    const comp = compositor.scratch('comp', w, h, space);
    const fps = out.fps || 30;
    const job = opts.job && opts.job.on ? opts.job : null;
    if (samples > 1) {
      const acc = finisher.ok ? null : compositor.scratch('acc', w, h, space);
      const k0 = job ? job.k : 0;
      if (k0 === 0) { if (finisher.ok) { finisher.setSpace(space); finisher.beginAccum(w, h); } else acc._ctx.clearRect(0, 0, w, h); }
      else { pal = job.pal; engines = job.engines; if (finisher.ok) finisher.setSpace(space); }
      for (let k = k0; k < samples; k++) {
        const tk = t + ((k + 0.5) / samples - 0.5) * (f.shutter / 360) / fps;
        const r = compositor.renderEvaluated(comp._ctx, w, h, k === Math.floor(samples / 2) && samples % 2 ? ev0 : evaluate(project, tk, opts.env), tk, common);
        if (k === 0) { pal = r.pal; engines = r.engines; if (job) { job.pal = pal; job.engines = engines; } }
        if (finisher.ok) { if (r.engines.includes('gpu')) syncCanvas(comp); finisher.addAccum(comp, 1 / samples); }
        else { acc._ctx.globalAlpha = 1 / (k + 1); acc._ctx.drawImage(comp, 0, 0); acc._ctx.globalAlpha = 1; }
        if (job) { job.sampleDone(); if (k + 1 < samples && job.expired()) throw { isSuspend: true }; }
      }
      if (!finisher.ok) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h); ctx.drawImage(acc, 0, 0); ctx.restore(); cpuFinish(ctx, w, h, f, pal, t, opts.transparent); return { u: ev0.u, engines, samples, post: 'cpu' }; }
    } else {
      const r = compositor.renderEvaluated(comp._ctx, w, h, ev0, t, common); pal = r.pal; engines = r.engines;
      if (engines.includes('gpu')) syncCanvas(comp);
      finisher.setSpace(space); finisher.loadInput(comp, w, h);
    }
    const stops = gradientStops(pal, f.gmapMode).map(hexToRgb01);
    const glc = finisher.process(f, { stops, shade: hexToRgb01(pal.shade), frame: Math.floor(fract(t / f.loop) * f.loop * 24), legal, zebra });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(glc, 0, 0, w, h); ctx.restore();
    return { u: ev0.u, engines, samples, post: 'gpu' };
  }
  return { renderFrame, compositor, finisher, gpu };
}

function exportSize(aspectId, tier) {
  const a = ASPECTS.find(x => x.id === aspectId) || ASPECTS[0];
  const short = tier; const even = v => Math.round(v / 2) * 2;
  return a.w >= a.h ? { w: even((short * a.w) / a.h), h: short } : { w: short, h: even((short * a.h) / a.w) };
}
function aspectRatio(aspectId) { const a = ASPECTS.find(x => x.id === aspectId) || ASPECTS[0]; return a.w / a.h; }
// Frames per loop are rounded to whole frames; frame times are spread across the exact loop so every
// loop closes seamlessly even when a bar-snapped length is not frame-aligned (rate error < 0.5 frame per loop).
function framesPerLoop(project, fps) { return Math.max(1, Math.round(project.finish.loop * fps)); }
function frameCount(project, fps, loops) { return framesPerLoop(project, fps) * loops; }
function frameTime(project, fps, i) { return (i / framesPerLoop(project, fps)) * project.finish.loop; }

// Library / Evolve thumbnail of one look (no finish, Canvas 2D so the GPU stays free for the stage).
function renderThumb(pipeline, canvas, look, p, customs) {
  const ctx = canvas.getContext('2d'); const L = look.shared.loop || 6;
  const t = fract(((p - (look.shared.phase || 0)) / (look.shared.tempo || 1))) * L;
  const pal = resolvePalette(look.shared.palette, look.shared.invert, customs || []);
  pipeline.compositor.renderLook(ctx, canvas.width, canvas.height, look, t, pal, { bg: true, cpu: true });
}
function renderProjectThumb(pipeline, canvas, project, t) {
  pipeline.renderFrame(canvas.getContext('2d'), canvas.width, canvas.height, { ...project, finish: { ...project.finish, shutter: 0 } }, t, { cpu: true });
}

// Render cache + one cached preview draw, shared by the main-thread stage and the render worker so both cache alike.
// Finished preview frames live on the project's frame grid, keyed by a hash of the project plus everything else that
// changes pixels. Scrubbing, stepping and looping replay from here instead of re-rendering.
function createFrameCache(pipeline) {
  const cache = { on: true, map: new Map(), bytes: 0, sig: '', env: null, hits: 0, misses: 0, budget: Math.min(768, Math.max(128, ((navigator.deviceMemory || 4) * 64))) * 1048576, full: false };
  const sigOf = pr => { const str = JSON.stringify(pr); let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36) + '.' + str.length; };
  function clear() { cache.map.clear(); cache.bytes = 0; cache.full = false; }
  function stats(pr) { const n = framesPerLoop(pr, pr.output.fps || 30); return { on: cache.on, frames: cache.map.size, loopFrames: n, bytes: cache.bytes, budget: cache.budget, hits: cache.hits, misses: cache.misses, full: cache.full, fraction: Math.min(1, cache.map.size / n) }; }
  // s: { playing, quality, space, zebra, env, live, onError } → { info, failed }
  function draw(ctx, canvas, pr, t, s) {
    const e = s.env, playing = s.playing;
    const fps = pr.output.fps || 30, N = framesPerLoop(pr, fps), L = pr.finish.loop;
    // Cache only deterministic scenes: no live audio, no video or image media (decoded in real time), no pending shader compiles.
    const media = pr.layers.some(l => l.media && Object.keys(l.media).length);
    const usable = cache.on && !s.live && !media && !__m_kits.runtime.pendingCompiles && !(__m_kits.job && __m_kits.job.on);
    let key = null, rt = t;
    if (usable) {
      // Text layers: the project hash covers strings and typography; the font epoch covers fonts that finished loading
      // (or imported files registered) after frames were cached, so a late font never replays stale glyphs.
      const sig = sigOf(pr) + '|' + canvas.width + 'x' + canvas.height + '|' + s.space + '|' + !!s.zebra + '|' + s.quality + '|f' + __m_text_atlas.epoch;
      if (sig !== cache.sig || e !== cache.env) { clear(); cache.sig = sig; cache.env = e; }
      const i = Math.min(N - 1, Math.floor((t / L) * N + 1e-6)); rt = (i / N) * L; key = (playing ? 'p' : 's') + i;
      const hit = cache.map.get(key);
      if (hit) {
        cache.hits++; cache.map.delete(key); cache.map.set(key, hit);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(hit.c, 0, 0); ctx.restore();
        return { info: hit.info, failed: false };
      }
      cache.misses++;
    }
    __m_kits.setPreview(true, playing);
    let failed = false, info = null;
    try { info = pipeline.renderFrame(ctx, canvas.width, canvas.height, pr, usable ? rt : t, { preview: playing, previewSamples: s.quality === 'high' ? 8 : 4, env: e, zebra: s.zebra, onError: s.onError }); }
    catch (er) { failed = true; if (s.onError) s.onError(er); }
    finally { __m_kits.setPreview(false); }
    // Frames drawn while shaders were still downscaled for load are not stored: the loop would replay them blurry.
    if (key && !failed && !(playing && __m_kits.gpuStatus().scale < 0.95) && !__m_kits.runtime.pendingCompiles) {
      const bytes = canvas.width * canvas.height * 4;
      if (cache.bytes + bytes > cache.budget) {
        // Scrubbing evicts the oldest frame; playback keeps the first frames of the loop instead of thrashing.
        if (!playing && cache.map.size) { const k0 = cache.map.keys().next().value, v = cache.map.get(k0); cache.map.delete(k0); cache.bytes -= v.bytes; }
        else cache.full = true;
      }
      if (cache.bytes + bytes <= cache.budget) {
        try {
          const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(canvas.width, canvas.height) : Object.assign(document.createElement('canvas'), { width: canvas.width, height: canvas.height });
          c.getContext('2d').drawImage(canvas, 0, 0); cache.map.set(key, { c, bytes, info }); cache.bytes += bytes;
        } catch (er) { cache.on = false; clear(); }
      }
    }
    return { info, failed };
  }
  return { draw, clear, stats, get on() { return cache.on; }, set on(v) { cache.on = !!v; if (!cache.on) clear(); } };
}

// Stage: owns the preview canvas and the loop. clock() may return transport time from audio.
// Two backends behind one API. Worker: the canvas is transferred to the render worker (__m_render_worker), which
// draws (and caches) off the UI thread; main posts one frame request at a time and the next carries the then-current
// time, so a slow worker drops stale frames instead of queueing them. Main: the original in-page path, used when
// OffscreenCanvas or worker WebGL2/WebGPU is missing, after a worker failure, with ?worker=0, and for scenes whose
// inputs live on the page (image/video layers, live audio input).
function createStage({ host, box, pipeline, getProject, onTick, onError, clock, env, extras }) {
  let canvas = null, ctx = null, space = 'srgb', ovr = null; // ovr: Arrange plays its sequence through the stage (main thread)
  let aspect = '16x9', quality = 'auto', playing = true, t = 0, last = 0, raf = 0, cssW = 0, cssH = 0, pxW = 2, pxH = 2, dirty = true, held = false;
  const timings = []; let lastInfo = null, drawn = 0;
  const fc = createFrameCache(pipeline);
  const RW = typeof __m_render_worker !== 'undefined' ? __m_render_worker : null;
  let mode = 'main', why = 'render worker starting', forced = false, wk = null, wstat = null, inflight = 0, sentAt = 0, fid = 0, gen = 0, pend = null;
  const sent = { pr: null, env: undefined, kits: -1, clear: true, fonts: new Set() }, waiters = [], reads = new Map();
  let wAtlas = null; // the worker's text-atlas stats (rebuild count), for the inspector and tests
  const zebraOn = () => !!(extras && extras.zebra), liveOn = () => !!(extras && extras.live && extras.live());
  const timing = ms => { timings.push(ms); if (timings.length > 60) timings.shift(); };
  // Clearing is sent with the next frame request; until the worker answers, stats read as the (empty) local cache.
  function dropStats() { fc.clear(); sent.clear = true; if (wstat) wstat.cache = null; }
  // settle() waiters: idle (nothing dirty or in flight), or, while playing, once a newer frame has been drawn.
  function settled() { if (!waiters.length || pend) return; for (let i = waiters.length - 1; i >= 0; i--) { const w = waiters[i]; if ((!dirty && !inflight) || (playing && drawn > w.d0)) { waiters.splice(i, 1); w.r(); } } }
  function newEl() {
    const c = document.createElement('canvas'); c.setAttribute('role', 'img'); c.setAttribute('aria-label', canvas ? canvas.getAttribute('aria-label') : 'Animation preview');
    c.style.width = cssW + 'px'; c.style.height = cssH + 'px'; c.width = pxW; c.height = pxH; return c;
  }
  function dropPending() { if (pend) { pend.el.remove(); pend = null; } }
  // Main-thread canvas. Also how worker mode ends: a transferred canvas can never get a 2D context again.
  function makeCanvasEl() {
    dropPending();
    const c = newEl(); c.id = 'stage';
    if (canvas) canvas.replaceWith(c); else box.prepend(c);
    canvas = c; ctx = c.getContext('2d', { colorSpace: space === 'p3' ? 'display-p3' : 'srgb' }); cssW = cssH = 0; layout(true);
  }
  // Worker canvas: transferred, then kept hidden under the current one until the worker's first frame lands (no blank flash).
  function toWorker() {
    dropPending();
    const c = newEl(); Object.assign(c.style, { position: 'absolute', left: '0', top: '0', visibility: 'hidden' }); box.prepend(c);
    const off = c.transferControlToOffscreen(); pend = { el: c, gen: ++gen, ready: false };
    wk.post({ type: 'canvas', canvas: off, space, gen }, [off]);
    mode = 'worker'; why = ''; sent.pr = null; sent.clear = true; dirty = true;
  }
  function adopt() {
    const old = canvas; canvas = pend.el; pend = null; ctx = null;
    Object.assign(canvas.style, { position: '', left: '', top: '', visibility: '' }); canvas.id = 'stage';
    if (old && old !== canvas) old.remove();
  }
  function toMain(reason) {
    why = reason; if (mode === 'main') { dropPending(); return; }
    mode = 'main'; if (wk) wk.post({ type: 'canvas', canvas: null }); makeCanvasEl(); dirty = true;
  }
  function fail(reason) {
    if (wk) { try { wk.terminate(); } catch (e) { /* already gone */ } wk = null; }
    inflight = 0; reads.forEach(r => r(null)); reads.clear(); waiters.splice(0).forEach(w => w.r());
    console.warn('Motif render worker stopped, preview continues on the main thread:', reason);
    toMain('render worker stopped (' + reason + ')');
  }
  // Why the preview must stay on the main thread right now ('' = the worker can take it).
  function mainReason() {
    if (forced) return 'switched to the main thread';
    if (ovr) return 'Arrange plays on the main thread';
    if (!wk) return why;
    if (!wk.caps) return 'render worker starting';
    if (wk.caps.webgl2 === false && __m_kits.gpuStatus().ok) return 'WebGL2 is unavailable in workers';
    const g = pipeline.gpu; if (g && wk.caps.webgpu === false && (g.state === 'ready' || g.state === 'off')) return 'WebGPU is unavailable in workers';
    const pr = getProject();
    if (pr.layers.some(l => l.media && Object.keys(l.media).length)) return 'image or video layers render on the main thread';
    if (pr.grade && pr.grade.nodes && pr.grade.nodes.some(n => n.type === 'lut' && n.lut)) return 'LUT grades render on the main thread';
    if (liveOn()) return 'live audio input renders on the main thread';
    const e = env && env(); if (e && !e.source) return 'audio envelope cannot be sent to the worker';
    return '';
  }
  function onMessage(m) {
    if (m.type === 'ready' || m.type === 'caps') { if (wk) wk.caps = m.caps; sent.clear = true; dirty = true; }
    else if (m.type === 'frame') {
      if (m.id === inflight) inflight = 0;
      if (m.ok) { lastInfo = m.info; drawn++; } timing(m.ms); wstat = { cache: m.cache, gpu: m.gpu }; if (m.atlas) wAtlas = m.atlas;
      if (pend && m.gen === pend.gen) pend.ready = true;
      if (mode === 'worker' && dirty && !(__m_kits.job && __m_kits.job.on)) post();
      settled();
    } else if (m.type === 'gpu' || m.type === 'fonts') dirty = true;
    else if (m.type === 'error') { if (onError) onError(new Error(m.message)); }
    else if (m.type === 'pixels') { const r = reads.get(m.id); reads.delete(m.id); if (r) r({ w: m.w, h: m.h, data: m.data }); }
    else if (m.type === 'fatal') fail(m.message);
  }
  if (!RW) why = 'render worker unavailable';
  else { const r = RW.connect(onMessage, fail); if (r.ok) wk = r.client; else why = r.reason; }
  const dprFor = () => { const d = window.devicePixelRatio || 1; return quality === 'quarter' ? 0.25 : quality === 'draft' ? 0.5 : quality === 'high' ? Math.min(d, 2) : Math.min(d, 1.5); };
  // Layout is split in two so resizing stays cheap: the CSS size follows the host every frame (the browser just
  // scales the canvas) and the backing store is reallocated once the size has settled.
  let settleTimer = 0, layoutRaf = 0;
  function measure() {
    const r = host.getBoundingClientRect(), cs = getComputedStyle(host); const ar = aspectRatio(aspect);
    const aw = Math.max(1, r.width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)), ah = Math.max(1, r.height - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
    let w = aw, h = w / ar; if (h > ah) { h = ah; w = h * ar; }
    return { w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
  }
  function applyBacking() {
    const d = dprFor(), bw = Math.max(2, Math.round(cssW * d)), bh = Math.max(2, Math.round(cssH * d));
    if (pxW !== bw || pxH !== bh) { pxW = bw; pxH = bh; if (mode === 'main') { canvas.width = bw; canvas.height = bh; } dirty = true; } // the worker resizes its canvas from each frame request
  }
  function layout(now) {
    const m = measure();
    if (m.w !== cssW || m.h !== cssH) {
      cssW = m.w; cssH = m.h;
      for (const c of [canvas, pend && pend.el]) if (c) { c.style.width = cssW + 'px'; c.style.height = cssH + 'px'; }
      box.style.width = cssW + 'px'; box.style.height = cssH + 'px';
    }
    if (now || pxW <= 2 || Math.abs(pxW / dprFor() - cssW) > 96) { clearTimeout(settleTimer); applyBacking(); return; }
    clearTimeout(settleTimer); settleTimer = setTimeout(() => { const s = measure(); cssW = s.w; cssH = s.h; applyBacking(); }, 120);
  }
  const layoutSoon = () => { if (layoutRaf) return; layoutRaf = requestAnimationFrame(() => { layoutRaf = 0; layout(); }); };
  const ro = new ResizeObserver(layoutSoon);
  function draw() {
    const t0 = performance.now();
    if (ovr) {
      __m_kits.setPreview(true, playing);
      try { lastInfo = ovr.draw(ctx, canvas.width, canvas.height, t, { preview: playing }); } catch (e) { if (onError) onError(e); } finally { __m_kits.setPreview(false); }
      drawn++; timing(performance.now() - t0); dirty = false; if (onTick) onTick(t, lastInfo); return;
    }
    const r = fc.draw(ctx, canvas, getProject(), t, { playing, quality, space, zebra: zebraOn(), env: env && env(), live: liveOn(), onError });
    if (!r.failed) { lastInfo = r.info; drawn++; }
    timing(performance.now() - t0); dirty = false; if (onTick) onTick(t, lastInfo);
  }
  function post() {
    if (inflight || !wk) return;
    const pr = getProject(), e = env && env();
    const m = { type: 'frame', id: ++fid, t, w: pxW, h: pxH, playing, quality, zebra: zebraOn(), cache: fc.on, forceCpu: !!(pipeline.gpu && pipeline.gpu.forceCpu) };
    if (pr !== sent.pr) m.project = pr;
    if (e !== sent.env) m.env = e ? e.source : null;
    if (__m_kits.revision !== sent.kits) m.kits = __m_kits.snapshot();
    // Imported font files go to the worker once per content id (it registers the same bytes with its own FontFace).
    const fonts = __m_text_atlas.fontPayload(sent.fonts); if (fonts.length) m.fonts = fonts;
    if (sent.clear) m.clear = true;
    try { wk.post(m); } catch (er) { fail('scene could not be sent: ' + (er && er.message)); return; }
    sent.pr = pr; sent.env = e; sent.kits = __m_kits.revision; sent.clear = false; for (const f of fonts) sent.fonts.add(f.id);
    inflight = m.id; sentAt = performance.now(); dirty = false; if (onTick) onTick(t, lastInfo);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (pend && pend.ready) adopt();
    const L = loopLen();
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    if (last && playing && mode === 'main' && !document.hidden && !__m_kits.job.on && !__m_kits.runtime.pendingCompiles) __m_kits.reportFrame(now - last);
    last = now;
    if (playing) { const ct = !ovr && clock ? clock() : null; t = ct != null ? ct % L : (t + dt) % L; dirty = true; }
    else if (liveOn()) dirty = true;
    const reason = mainReason();
    if (reason && mode === 'worker') toMain(reason); else if (!reason && mode === 'main') toWorker(); else if (reason) why = reason;
    if (inflight && now - sentAt > 30000) fail('no reply for 30 s');
    if (dirty && !held && !(__m_kits.job && __m_kits.job.on)) { if (mode === 'worker') post(); else draw(); }
    settled();
  }
  makeCanvasEl(); ro.observe(host); raf = requestAnimationFrame(frame);
  const loopLen = () => (ovr ? Math.max(0.1, ovr.duration()) : getProject().finish.loop);
  return {
    setOverride(o) { ovr = o || null; t = Math.min(t, Math.max(0, loopLen() - 1e-3)); last = 0; dirty = true; }, get overridden() { return !!ovr; },
    setAspect(a) { aspect = a; layout(true); dirty = true; }, get aspect() { return aspect; },
    setQuality(q) { quality = q; layout(true); dirty = true; },
    setSpace(s) { if (s === space) return; space = s; if (mode === 'worker') toWorker(); else makeCanvasEl(); },
    get canvas() { return canvas; },
    hold(on) { held = !!on; if (!held) dirty = true; }, get held() { return held; }, // background renders (render queue) own the pipeline: the viewer stops drawing until released
    play() { playing = true; last = 0; }, pause() { playing = false; dirty = true; },
    toggle() { playing = !playing; last = 0; dirty = true; return playing; },
    get playing() { return playing; }, get time() { return t; }, get info() { return lastInfo; },
    seek(frac) { t = Math.min(0.999999, Math.max(0, frac)) * loopLen(); dirty = true; },
    seekTime(s) { const L = loopLen(); t = ((s % L) + L) % L; dirty = true; },
    step(frames, fps = 30) { const L = loopLen(); t = (((t + frames / fps) % L) + L) % L; dirty = true; },
    invalidate() { dropStats(); sent.pr = null; dirty = true; },
    setCache(on) { fc.on = on; dropStats(); dirty = true; }, get cacheOn() { return fc.on; },
    cacheStats() { return mode === 'worker' && wstat && wstat.cache ? { ...wstat.cache, on: fc.on } : fc.stats(getProject()); },
    cacheClear: dropStats,
    frameMs() { return timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : 0; },
    size() { return { w: pxW, h: pxH, cssW, cssH }; },
    // Render backend: 'worker' (off the UI thread) or 'main'; engineReason says why main is in use.
    get atlasStats() { return mode === 'worker' ? wAtlas : __m_text_atlas.stats(); },
    get engineMode() { return mode; }, get engineReason() { return mode === 'main' ? why : ''; }, get engineCaps() { return wk && wk.caps ? { ...wk.caps } : null; }, get framesDrawn() { return drawn; },
    gpuStatus() { return mode === 'worker' && wstat && wstat.gpu ? wstat.gpu : __m_kits.gpuStatus(); },
    setEngine(pref) { forced = pref === 'main'; dirty = true; },
    // Resolves once the requested frame has been drawn (in either backend): when idle, or while playing after the next frame.
    settle() { return new Promise(r => { waiters.push({ r, d0: drawn }); }); },
    readPixels() {
      if (mode === 'main') { const d = ctx.getImageData(0, 0, canvas.width, canvas.height); return Promise.resolve({ w: d.width, h: d.height, data: d.data }); }
      return new Promise(r => { const id = ++fid; reads.set(id, r); wk.post({ type: 'read', id }); });
    },
    debugWorker(kind) { if (wk) wk.post({ type: 'debug-' + kind }); }, // test hook: 'crash' exercises the fallback
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); if (wk) { wk.terminate(); wk = null; } },
  };
}

return { createPipeline, createFrameCache, exportSize, aspectRatio, frameCount, frameTime, framesPerLoop, renderThumb, renderProjectThumb, createStage };

})();
