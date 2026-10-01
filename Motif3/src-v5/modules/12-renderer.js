// ---- module: renderer v2.0.0
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
  return { renderFrame, compositor, finisher };
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

// Stage: owns the preview canvas and the loop. clock() may return transport time from audio.
function createStage({ host, box, pipeline, getProject, onTick, onError, clock, env, extras }) {
  let canvas = null, ctx = null, space = 'srgb';
  let aspect = '16x9', quality = 'auto', playing = true, t = 0, last = 0, raf = 0, cssW = 0, cssH = 0, dirty = true, held = false;
  const timings = []; let lastInfo = null;
  // Render cache: finished preview frames on the project's frame grid, keyed by a hash of the project plus
  // everything else that changes pixels. Scrubbing, stepping and looping replay from here instead of re-rendering.
  const cache = { on: true, map: new Map(), bytes: 0, sig: '', env: null, hits: 0, misses: 0, budget: Math.min(768, Math.max(128, ((navigator.deviceMemory || 4) * 64))) * 1048576, full: false };
  const sigOf = pr => { const str = JSON.stringify(pr); let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36) + '.' + str.length; };
  function cacheClear() { cache.map.clear(); cache.bytes = 0; cache.full = false; }
  function cacheStats() { const pr = getProject(), n = framesPerLoop(pr, pr.output.fps || 30); return { on: cache.on, frames: cache.map.size, loopFrames: n, bytes: cache.bytes, budget: cache.budget, hits: cache.hits, misses: cache.misses, full: cache.full, fraction: Math.min(1, cache.map.size / n) }; }
  function makeCanvasEl() {
    const c = document.createElement('canvas'); c.id = 'stage'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Animation preview');
    if (canvas) { c.setAttribute('aria-label', canvas.getAttribute('aria-label')); canvas.replaceWith(c); } else box.prepend(c);
    canvas = c; ctx = c.getContext('2d', { colorSpace: space === 'p3' ? 'display-p3' : 'srgb' }); layout();
  }
  const dprFor = () => { const d = window.devicePixelRatio || 1; return quality === 'quarter' ? 0.25 : quality === 'draft' ? 0.5 : quality === 'high' ? Math.min(d, 2) : Math.min(d, 1.5); };
  function layout() {
    const r = host.getBoundingClientRect(), cs = getComputedStyle(host); const ar = aspectRatio(aspect);
    const aw = Math.max(1, r.width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)), ah = Math.max(1, r.height - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
    let w = aw, h = w / ar; if (h > ah) { h = ah; w = h * ar; }
    cssW = Math.max(1, Math.floor(w)); cssH = Math.max(1, Math.floor(h));
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    box.style.width = cssW + 'px'; box.style.height = cssH + 'px';
    const d = dprFor(); canvas.width = Math.max(2, Math.round(cssW * d)); canvas.height = Math.max(2, Math.round(cssH * d));
    dirty = true;
  }
  const ro = new ResizeObserver(() => layout());
  function draw() {
    const pr = getProject(); const t0 = performance.now();
    const e = env && env(), live = !!(extras && extras.live && extras.live()), zebra = !!(extras && extras.zebra);
    const fps = pr.output.fps || 30, N = framesPerLoop(pr, fps), L = pr.finish.loop;
    // Cache only deterministic scenes: no live audio, no video or image media (decoded in real time), no pending shader compiles.
    const media = pr.layers.some(l => l.media && Object.keys(l.media).length);
    const usable = cache.on && !live && !media && !__m_kits.runtime.pendingCompiles && !(__m_kits.job && __m_kits.job.on);
    let key = null, rt = t;
    if (usable) {
      const sig = sigOf(pr) + '|' + canvas.width + 'x' + canvas.height + '|' + space + '|' + zebra + '|' + quality;
      if (sig !== cache.sig || e !== cache.env) { cacheClear(); cache.sig = sig; cache.env = e; }
      const i = Math.min(N - 1, Math.floor((t / L) * N + 1e-6)); rt = (i / N) * L; key = (playing ? 'p' : 's') + i;
      const hit = cache.map.get(key);
      if (hit) {
        cache.hits++; cache.map.delete(key); cache.map.set(key, hit);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(hit.c, 0, 0); ctx.restore();
        lastInfo = hit.info; timings.push(performance.now() - t0); if (timings.length > 60) timings.shift();
        dirty = false; if (onTick) onTick(t, lastInfo); return;
      }
      cache.misses++;
    }
    __m_kits.setPreview(true, playing);
    let failed = false;
    try { lastInfo = pipeline.renderFrame(ctx, canvas.width, canvas.height, pr, usable ? rt : t, { preview: playing, previewSamples: quality === 'high' ? 8 : 4, env: e, zebra: extras && extras.zebra, onError }); }
    catch (er) { failed = true; if (onError) onError(er); }
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
          c.getContext('2d').drawImage(canvas, 0, 0); cache.map.set(key, { c, bytes, info: lastInfo }); cache.bytes += bytes;
        } catch (er) { cache.on = false; cacheClear(); }
      }
    }
    timings.push(performance.now() - t0); if (timings.length > 60) timings.shift();
    dirty = false; if (onTick) onTick(t, lastInfo);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const L = getProject().finish.loop;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    if (last && playing && !document.hidden && !__m_kits.job.on && !__m_kits.runtime.pendingCompiles) __m_kits.reportFrame(now - last);
    last = now;
    if (playing) { const ct = clock ? clock() : null; t = ct != null ? ct % L : (t + dt) % L; dirty = true; }
    else if (extras && extras.live && extras.live()) dirty = true;
    if (dirty && !held && !(__m_kits.job && __m_kits.job.on)) draw();
  }
  makeCanvasEl(); ro.observe(host); raf = requestAnimationFrame(frame);
  const loopLen = () => getProject().finish.loop;
  return {
    setAspect(a) { aspect = a; layout(); }, get aspect() { return aspect; },
    setQuality(q) { quality = q; layout(); },
    setSpace(s) { if (s === space) return; space = s; makeCanvasEl(); },
    get canvas() { return canvas; },
    hold(on) { held = !!on; if (!held) dirty = true; }, get held() { return held; }, // background renders (render queue) own the pipeline: the viewer stops drawing until released
    play() { playing = true; last = 0; }, pause() { playing = false; dirty = true; },
    toggle() { playing = !playing; last = 0; dirty = true; return playing; },
    get playing() { return playing; }, get time() { return t; }, get info() { return lastInfo; },
    seek(frac) { t = Math.min(0.999999, Math.max(0, frac)) * loopLen(); dirty = true; },
    seekTime(s) { const L = loopLen(); t = ((s % L) + L) % L; dirty = true; },
    step(frames, fps = 30) { const L = loopLen(); t = (((t + frames / fps) % L) + L) % L; dirty = true; },
    invalidate() { cacheClear(); dirty = true; },
    setCache(on) { cache.on = !!on; if (!on) cacheClear(); dirty = true; }, get cacheOn() { return cache.on; }, cacheStats, cacheClear,
    frameMs() { return timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : 0; },
    size() { return { w: canvas.width, h: canvas.height, cssW, cssH }; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); },
  };
}

return { createPipeline, exportSize, aspectRatio, frameCount, frameTime, framesPerLoop, renderThumb, renderProjectThumb, createStage };

})();

