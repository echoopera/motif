// ---- module: shell v2.1.0
const __m_shell = (() => {
// shell/css — workspace styles. Layout keeps the preview pinned: on desktop only the side
// panels scroll; under 1100 px the page is a fixed shell and only the active panel scrolls.


// shell/html — static structure. Panels are filled by the shell at runtime.
const LOCK_SVG = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
const KEY_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.8 14.2 8 8 14.2 1.8 8Z" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.5"/></svg>';
const EYE_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8Z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="8" r="2.1" fill="currentColor"/></svg>';
const EYE_OFF_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M1 8s2.6-4.5 7-4.5S15 8 15 8s-2.6 4.5-7 4.5S1 8 1 8Z" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".45"/><path d="M2.5 13.5 13.5 2.5" stroke="currentColor" stroke-width="1.5"/></svg>';



// shell — the Motif 3 workspace (finishing-suite layout): library, pinned stage, key lane, layers, colour, finish,
// audio, looks, Evolve, export and keyboard. Owns UI state only; all rendering goes through
// the renderer pipeline and all project changes through the timeline model.
const { ASPECTS, PALETTES } = __m_tokens;
const { clamp, fract } = __m_engine_core;
const { STYLES, CATEGORIES, SHARED_SCHEMA, getStyle } = __m_style_library;
const K = __m_kits;
const C = __m_colour;
const T = __m_timeline;
const A = __m_audio;
const { createGpuEngine, GPU_STYLES } = __m_gpu_engine;
const { createPipeline, createStage, renderThumb, renderProjectThumb, exportSize, frameCount, aspectRatio } = __m_renderer;
const X = __m_exporter;

// Extension seam: feature modules (20-*.js ...) call __m_shell.use({ id, name, icon, panel(host, api), tick(t, api, info), init(host, api), commands(api) })
// before boot. Each becomes an inspector tab + panel (+ ⌘K entries). `api` is the narrow surface a page may touch.
const extensions = [];
function use(ext) { if (!ext || !ext.id || typeof ext.panel !== 'function') throw new Error('shell.use: { id, name, panel } required'); if (extensions.some(e => e.id === ext.id)) throw new Error('shell.use: duplicate page ' + ext.id); extensions.push(ext); }

function boot() {
  const $ = id => document.getElementById(id);
  const app = $('app');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- media inputs (images and video for kit styles that declare `inputs`) ----------
  // Assets are kept by content hash. Bytes live in the media pool (13a: OPFS with an IndexedDB fallback; per browser, never uploaded); the project only stores
  // { asset, name, kind, w, h, dur, fit, timing } per layer input, so autosave, undo and saved looks stay small.
  // Rendering bakes each asset into a canvas with the frame's aspect ratio (fit applied), which the kit runtime
  // uploads as an sRGB texture. Video: preview plays and drifts back into sync; export seeks every frame exactly.
  function createMediaStore({ onChange, isPlaying }) {
    const MAX_IMAGE = 60 * 1048576, MAX_VIDEO = 4096 * 1048576, MAX_BAKE = 4096;
    const assets = new Map();
    let passive = false;
    const pool = __m_media_pool.create();
    const kindOf = f => /^video\//.test(f.type) || /\.(mp4|m4v|mov|webm|ogv)$/i.test(f.name || '') ? 'video' : /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(f.name || '') ? 'image' : null;
    function decode(a) {
      a.ready = (async () => {
        if (a.kind === 'image') {
          let bmp; try { bmp = await createImageBitmap(a.blob, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(a.blob); }
          Object.assign(a, { el: bmp, w: bmp.width, h: bmp.height, dur: 0 });
        } else {
          const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.loop = true; v.preload = 'auto'; v.disablePictureInPicture = true;
          v.src = URL.createObjectURL(a.blob);
          await new Promise((res, rej) => { v.addEventListener('loadeddata', res, { once: true }); v.addEventListener('error', () => rej(new Error('This browser can’t decode that video. Try MP4 (H.264) or WebM.')), { once: true }); });
          Object.assign(a, { el: v, w: v.videoWidth, h: v.videoHeight, dur: v.duration || 0 });
          // Playback time advances between decoded frames. Only rebake/upload when pixels change.
          // Seek completion also invalidates immediately: paused/export renders cannot wait for a callback.
          a.frameRev = 0;
          a.frameCallbacks = typeof v.requestVideoFrameCallback === 'function';
          if (a.frameCallbacks) {
            const decoded = () => { a.frameRev++; a.frameCallback = v.requestVideoFrameCallback(decoded); };
            a.frameCallback = v.requestVideoFrameCallback(decoded);
          }
          v.addEventListener('seeked', () => { a.frameRev++; if (!passive) onChange(a.id); });
          // Optional frame-accurate WebCodecs path (13b) for scrubbing and export seeks; null when unsupported.
          a.curRev = 0;
          a.decP = __m_webcodecs.open(a.blob, { reference: v }).then(d => { if (d && a.forgotten) { d.dispose(); return null; } if (d && Math.abs(d.w - a.w) <= 1 && Math.abs(d.h - a.h) <= 1) { a.dec = d; a.codec = d.codec; } else if (d) d.dispose(); return a.dec || null; }).catch(() => null);
        }
        a.state = 'ready';
      })().catch(e => { a.state = 'error'; a.error = e.message || String(e); }).finally(() => onChange(a.id));
      return a.ready;
    }
    function ensure(id) {
      let a = assets.get(id); if (a) return a;
      a = { id, state: 'loading', bakes: new Map() }; assets.set(id, a);
      a.ready = pool.get(id).then(rec => { if (!rec || !rec.blob) { a.state = 'missing'; onChange(id); return; } Object.assign(a, { name: rec.name, kind: rec.kind, mime: rec.mime, blob: rec.blob, size: rec.size, thumb: rec.thumb }); return decode(a); });
      return a;
    }
    // Add a File/Blob. Returns the layer-input metadata to store in the project.
    async function add(file) {
      const kind = kindOf(file); if (!kind) throw new Error(`${file.name || 'That file'} isn’t an image or video.`);
      if (file.size > (kind === 'image' ? MAX_IMAGE : MAX_VIDEO)) throw new Error(`${file.name} is larger than ${kind === 'image' ? '60 MB' : '4 GB'}.`);
      const id = await pool.hashFile(file);
      let a = assets.get(id);
      if (!a || a.state === 'missing' || a.state === 'error') {
        a = { id, state: 'loading', bakes: new Map(), name: String(file.name || kind).slice(0, 80), kind, mime: file.type || '', blob: file, size: file.size };
        assets.set(id, a); await decode(a);
        if (a.state !== 'ready') throw new Error(a.error || 'That file could not be decoded.');
        a.thumb = pool.thumbnail(a.el, a.w, a.h); a.storeError = '';
        a.stored = await pool.put(id, { name: a.name, kind, mime: a.mime, w: a.w, h: a.h, dur: a.dur, thumb: a.thumb }, a.blob).then(r => r.ok, e => { a.storeError = e.code || 'error'; return false; });
        if (a.stored && a.decP) a.decP.then(d => d && pool.update(id, { codec: d.codec }));
      } else await a.ready;
      return { asset: id, name: a.name, kind: a.kind, w: a.w, h: a.h, dur: a.dur ? Math.round(a.dur * 1000) / 1000 : 0, stored: !!a.stored || a.stored === undefined, ...(a.storeError ? { storeError: a.storeError } : {}) };
    }
    function bakeFor(a, fit, w, h) {
      const ar = w / h, key = fit === 'stretch' ? 'stretch' : `${fit}|${ar.toFixed(4)}`;
      let b = a.bakes.get(key);
      if (!b) {
        const mw = a.w, mh = a.h, mar = mw / mh; let cw, ch;
        if (fit === 'stretch') { cw = mw; ch = mh; }
        else if ((fit === 'fill') === (mar > ar)) { ch = mh; cw = mh * ar; }
        else { cw = mw; ch = mw / ar; }
        const s = Math.min(1, MAX_BAKE / Math.max(cw, ch)); cw = Math.max(1, Math.round(cw * s)); ch = Math.max(1, Math.round(ch * s));
        const c = document.createElement('canvas'); c.width = cw; c.height = ch;
        b = { canvas: c, ctx: c.getContext('2d'), rev: 0, time: NaN, fit };
        a.bakes.set(key, b);
        if (a.bakes.size > 6) a.bakes.delete(a.bakes.keys().next().value);
      }
      return b;
    }
    function paint(a, b) {
      const c = b.canvas, x = b.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      const src = a.cur || a.el;   // decoded WebCodecs frame while scrubbing, else the image / <video>
      if (b.fit === 'stretch') x.drawImage(src, 0, 0, c.width, c.height);
      else { const s = b.fit === 'fill' ? Math.max(c.width / a.w, c.height / a.h) : Math.min(c.width / a.w, c.height / a.h); const dw = a.w * s, dh = a.h * s; x.drawImage(src, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh); }
      b.rev++;
    }
    // Video time for project time t. 'loop' retimes the clip to exactly one Motif loop (seamless);
    // 'free' plays at real speed and wraps at the clip's own length.
    function videoTime(a, m, t, L) {
      const d = Math.max(0.001, a.dur || 0.001);
      const vt = m.timing === 'free' ? ((t % d) + d) % d : (((t / L) % 1) + 1) % 1 * d;
      return Math.min(vt, Math.max(0, d - 0.001));
    }
    function steer(a, m, vt, L) {
      const v = a.el;
      if (isPlaying()) {
        a.cur = null; a.decWant = NaN;
        const rate = m.timing === 'free' ? 1 : Math.max(0.0625, Math.min(16, (a.dur || 1) / L));
        if (Math.abs(v.playbackRate - rate) > 1e-3) v.playbackRate = rate;
        if (v.paused) v.play().catch(() => {});
        const drift = Math.abs(v.currentTime - vt);
        if (!v.seeking && drift > 0.2 && drift < a.dur - 0.2) v.currentTime = vt;
      } else {
        if (!v.paused) v.pause();
        if (a.dec) scrubDecoded(a, vt);
        if ((!a.dec || !a.cur) && !v.seeking && Math.abs(v.currentTime - vt) > 1e-3) v.currentTime = vt;
      }
    }
    // Paused with a WebCodecs decoder: decode the exact frame (coalesced to the newest target) and show it when it lands.
    function scrubDecoded(a, vt) {
      if (a.decWant === vt) return; a.decWant = vt;
      a.dec.scrub(vt).then(f => { if (!f || passive || a.decWant !== vt) return; a.cur = f.bitmap; a.curTs = f.ts; a.curRev++; onChange(a.id); }, () => { a.dec = null; a.cur = null; });
    }
    // Called by the kit runtime for every draw of a style that declares inputs.
    // opts.preview: this is the stage (may steer videos). Other renders (thumbnails) never seek.
    function resolve(inputs, S, opts = {}) {
      const lm = S.media; if (!lm) return null;
      let out = null;
      for (const q of inputs) {
        const m = lm[q.id]; if (!m || !m.asset) continue;
        const a = ensure(m.asset); if (a.state !== 'ready') continue;
        const b = bakeFor(a, m.fit || q.fit || 'fill', S.w, S.h);
        let time = 0;
        if (a.kind === 'video') {
          const L = S.L || 6;
          if (opts.preview && !passive) steer(a, m, videoTime(a, m, S.t || 0, L), L);
          time = a.cur ? a.curTs : a.el.currentTime;
          const frame = a.cur ? 'c' + a.curRev : a.frameCallbacks ? a.frameRev : time;
          if (b.frame !== frame || !b.rev) { paint(a, b); b.frame = frame; b.time = time; }
        } else if (!b.rev) paint(a, b);
        (out || (out = {}))[q.id] = { canvas: b.canvas, rev: b.rev, w: a.w, h: a.h, time };
      }
      return out;
    }
    const seekTo = (v, vt) => new Promise(res => {
      if (!v.seeking && Math.abs(v.currentTime - vt) < 1e-4 && v.readyState >= 2) return res();
      const done = () => { clearTimeout(to); res(); }; const to = setTimeout(done, 8000);
      v.addEventListener('seeked', done, { once: true }); v.currentTime = vt;
    });
    // Export: before each frame, load every asset the project uses and seek videos to that frame's exact time.
    async function prepare(project, t) {
      passive = true;
      const L = project.finish.loop;
      for (const l of project.layers) {
        if (l.visible === false || !l.media) continue;
        for (const m of Object.values(l.media)) {
          if (!m || !m.asset) continue;
          const a = ensure(m.asset); await a.ready; if (a.state !== 'ready') continue;
          if (a.kind === 'video') {
            a.el.pause(); const vt = videoTime(a, m, t, L); await a.decP;
            if (a.dec) { try { const f = await a.dec.frameAt(vt); a.cur = f.bitmap; a.curTs = f.ts; a.curRev++; a.decWant = vt; continue; } catch (e) { a.dec = null; a.cur = null; } }
            await seekTo(a.el, vt);
          }
        }
      }
    }
    function release() { passive = false; for (const a of assets.values()) if (a.dec) a.dec.release(); onChange(null); }
    // Drop an asset's decoders, frames and object URL (the pool entry is separate: pool.remove).
    function forget(id) { const a = assets.get(id); if (!a) return; a.forgotten = true; if (a.dec) a.dec.dispose(); a.cur = null; if (a.el && a.kind === 'video') { a.el.pause(); a.el.removeAttribute('src'); a.el.load(); } if (a.el && a.el.close) a.el.close(); assets.delete(id); onChange(id); }
    function info(id) { const a = assets.get(id); return a ? { state: a.state, error: a.error, el: a.el, w: a.w, h: a.h, kind: a.kind, dur: a.dur, codec: a.codec || '', decoder: a.dec ? 'webcodecs' : 'video', decoderStats: a.dec ? a.dec.stats() : null } : { state: 'unknown' }; }
    function used(project) { const ids = new Set(); for (const l of project.layers) for (const m of Object.values(l.media || {})) if (m && m.asset) ids.add(m.asset); return [...ids]; }
    function pauseAll() { for (const a of assets.values()) if (a.el && a.kind === 'video' && !a.el.paused) a.el.pause(); }
    // Stop decoders for unused layers, preserving hidden and animated track-matte dependencies.
    function syncPlayback(project) {
      if (passive) return;
      const active = new Set();
      if (isPlaying() && !document.hidden) for (let i = 0; i < project.layers.length; i++) {
        const l = project.layers[i], above = project.layers[i + 1];
        const matte = above && above.visible !== false && (/^matte/.test(above.comp.mask) ||
          (project.keys && project.keys[`L:${above.id}:c:mask`] || []).some(k => /^matte/.test(k.v)));
        if (l.visible === false && !matte) continue;
        for (const m of Object.values(l.media || {})) if (m && m.asset) active.add(m.asset);
      }
      for (const a of assets.values()) if (a.kind === 'video' && a.el && !a.el.paused && !active.has(a.id)) a.el.pause();
    }
    return { add, ensure, resolve, prepare, release, info, used, kindOf, pauseAll, syncPlayback, forget, ids: () => [...assets.keys()], pool, get persistent() { return pool.backend.then(b => b !== 'none'); } };
  }

  const media = createMediaStore({ isPlaying: () => stage.playing, onChange: () => { stage.invalidate(); if (tab === 'layer') paintMediaThumbs(); } });
  K.setMediaResolver(media.resolve);
  document.addEventListener('visibilitychange', () => { if (document.hidden) media.pauseAll(); });
  // ---------- state ----------
  const AUTOSAVE = 'motif3-autosave-v1';
  let project = demoProject(), restored = false, audition = null;
  // Motif 6 state: project file identity, Arrange, viewer tools, clip library.
  let projectName = 'Demo project', dirty = false, fileHandle = null, dirHandle = null, projectId = 'p-' + Date.now().toString(36), pendingSv = null;
  let arrMode = false, moveTool = false, gridOn = false, gridN = 8;
  let clips = [], groups = [];
  const arrUi = { pps: 72, sel: new Set(), fx: null, region: null, tool: 'select', snap: true };
  try {
    const sv = JSON.parse(localStorage.getItem(AUTOSAVE) || 'null');
    if (sv && sv.project && K.missingKits(sv.project).length === 0) { project = T.sanitizeProject(sv.project, C.sanitizeCustom); restored = true; if (typeof sv.name === 'string' && sv.name) projectName = sv.name.slice(0, 60); if (typeof sv.id === 'string' && sv.id) projectId = sv.id.slice(0, 40); }
    else if (sv && sv.project) pendingSv = sv; // needs a kit that is still loading from IndexedDB
  } catch (e) { /* no usable autosave */ }
  let aspect = '16x9', strength = 0.35, catFilter = 'all', query = '', tab = 'layer', zebra = false;
  let selKey = null; // { path, idx }
  let evolveOpen = false, children = [], round = 0, lastFocus = null;
  const locks = new Set(); // paths locked from Mutate / Evolve / Randomize
  const history = [JSON.stringify(project)]; let cursor = 0;
  // Autosave: the project is written shortly after every change and when the page is hidden or closed.
  let asTimer = 0;
  function saveNow() { try { localStorage.setItem(AUTOSAVE, JSON.stringify({ v: 1, at: Date.now(), aspect, project, name: projectName, id: projectId })); } catch (e) { /* storage full or unavailable */ } }
  function autosave() { clearTimeout(asTimer); asTimer = setTimeout(saveNow, 600); }
  addEventListener('pagehide', saveNow); document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  const clone = T.clone;
  function commit(next, msg) {
    dirty = true; project = T.sanitizeProject(next, C.sanitizeCustom);
    const snap = JSON.stringify(project);
    if (snap !== history[cursor]) { history.splice(cursor + 1); history.push(snap); if (history.length > 300) history.shift(); cursor = history.length - 1; }
    syncAudioRegion(); refresh(); if (msg) toast(msg);
  }
  function live(next) { project = next; if (!dirty) { dirty = true; updateNameUi(); } autosave(); stage.invalidate(); }
  function undo() { if (cursor > 0) { cursor--; dirty = true; project = JSON.parse(history[cursor]); syncAudioRegion(); refresh(); toast('Undo'); } }
  function redo() { if (cursor < history.length - 1) { cursor++; dirty = true; project = JSON.parse(history[cursor]); syncAudioRegion(); refresh(); toast('Redo'); } }
  const active = () => T.layerById(project, project.active) || project.layers[0];
  const lpath = (scope, key, id = project.active) => `L:${id}:${scope}:${key}`;

  function demoProject() {
    // Plexus behind Particle Form over Halftone: burst builds 0 → 1, palette shifts at 3.5 s.
    let pr = T.newProject('plexus');
    const base = pr.layers[0]; base.shared.palette = 'graphite'; base.params = { ...base.params, points: 150, distance: 0.19, lines: 0.5 };
    const half = T.newLayer('halftone', { ...base.shared }, { blend: 'screen', opacity: 0.24 });
    half.params = { ...half.params, cell: 0.02, contrast: 0.8, duotone: true };
    const form = T.newLayer('particle-form', { ...base.shared }, { blend: 'source-over' });
    form.params = { ...form.params, count: 6000, dot: 0.9, turbulence: 0.6 };
    pr.layers.push(half, form); pr.active = form.id;
    pr.finish = { ...pr.finish, glow: 0.4, glowThreshold: 0.5, glowRadius: 0.45, vignette: 0.3, grain: 0.08 };
    pr = T.setKey(pr, `L:${form.id}:p:burst`, 0, 0, 'smooth'); pr = T.setKey(pr, `L:${form.id}:p:burst`, 0.5, 1, 'smooth');
    for (const l of pr.layers) { pr = T.setKey(pr, `L:${l.id}:s:palette`, 0, 'graphite', 'hold'); pr = T.setKey(pr, `L:${l.id}:s:palette`, 3.5 / 6, 'chroma', 'hold'); }
    return T.sanitizeProject(pr, C.sanitizeCustom);
  }

  // ---------- engine ----------
  const gpu = createGpuEngine();
  const pipeline = createPipeline({ gpu });
  const player = A.createPlayer();
  let analysis = null, envFn = null, liveOn = false, audioSync = true, trackName = '';
  const liveEnv = band => { const b = player.liveBands(); return b ? b[band] : null; };
  const currentEnv = () => (liveOn ? liveEnv : envFn);
  const stage = createStage({
    host: $('stageHost'), box: $('stageBox'), pipeline, getProject: () => audition || project, onTick, onError: e => console.error(e),
    clock: () => (audioSync && player.playing ? player.time() : null), env: currentEnv, extras: { get zebra() { return zebra; }, live: () => liveOn },
  });
  stage.setSpace(project.output.space);
  if (reduce) { stage.pause(); $('rmHint').hidden = false; }
  function updateEngineChip() {
    const c = $('engineChip'), s = gpu.state;
    c.textContent = s === 'ready' ? 'GPU' : s === 'init' ? 'GPU…' : s === 'off' ? 'CPU · GPU off' : 'CPU';
    c.dataset.state = s === 'ready' ? 'gpu' : 'cpu';
    c.title = s === 'ready' ? 'WebGPU engine on for Flow Field, Orbital Swarm, Metaballs and Particle Form. Click to use Canvas 2D.' : s === 'off' ? 'WebGPU is available but switched off. Click to turn it on.' : `Canvas 2D engine. ${gpu.reason || ''}`;
    c.disabled = !(s === 'ready' || s === 'off');
  }
  updateEngineChip();
  gpu.init().then(() => { updateEngineChip(); stage.invalidate(); if (tab === 'layer') renderPanel(); });
  $('engineChip').addEventListener('click', () => { gpu.setForceCpu(!gpu.forceCpu); updateEngineChip(); stage.invalidate(); renderPanel(); toast(gpu.forceCpu ? 'Canvas 2D engine' : 'WebGPU engine'); });

  // ---------- ticking ----------
  const pad2 = n => String(n).padStart(2, '0');
  function timecode(s) { const fps = project.output.fps; const f = Math.floor(s * fps + 1e-6); const ff = f % fps, ts = Math.floor(f / fps); return `${pad2(Math.floor(ts / 3600))}:${pad2(Math.floor(ts / 60) % 60)}:${pad2(ts % 60)}:${pad2(ff)}`; }
  // Kit shaders render at an adaptive internal scale on the stage; the page bar shows it.
  let gpuChipKey = '';
  function updateGpuChip() {
    const c = $('gpuChip'); if (!c) return;
    const kitLayers = project.layers.filter(l => l.visible !== false && getStyle(l.styleId).engine === 'glsl');
    const g = stage.gpuStatus ? stage.gpuStatus() : K.gpuStatus(); // the stage's kit runtime (in the render worker when it runs there)
    let text, state, title;
    if (!g.ok) { text = 'Shaders off'; state = 'err'; title = 'WebGL2 is unavailable, so kit shader styles cannot render in this browser.'; }
    else if (g.software) { text = 'Software GL'; state = 'err'; title = `WebGL is running in software (${g.renderer}), so kit shaders render on the CPU: previews are low resolution and exports are very slow. Turn on hardware acceleration in the browser and reload.`; }
    else if (g.lost) { text = 'GPU reset · recovering'; state = 'err'; title = 'The browser reset the GPU. Kit styles come back automatically at a lower render scale.'; }
    else if (!kitLayers.length) { text = 'Shaders idle'; state = ''; title = 'No kit shader style is on a visible layer.'; }
    else { const pct = Math.round(g.scale * 100); text = `Shaders ${pct}%`; state = pct >= 95 ? 'gpu' : 'warn'; title = `Kit shaders preview at ${pct}% internal resolution to hold the frame rate${g.timer ? ' (measured on the GPU)' : ''}. Exports always render at full resolution.${g.resets ? ` GPU resets this session: ${g.resets}.` : ''}`; }
    const key = text + state; if (key === gpuChipKey) return; gpuChipKey = key;
    c.textContent = text; c.dataset.state = state; c.title = title;
  }
  $('gpuChip').addEventListener('click', () => setTab('kits'));
  let lastUi = 0, lastEvo = 0;
  function onTick(t, info) {
    if (arrMode) updateArrPlayhead(t);
    const now = performance.now(); if (now - lastUi < 60 && stage.playing) return; lastUi = now;
    if (!arrMode) media.syncPlayback(project);
    const L = loopSec(), u = t / L;
    $('time').innerHTML = timecode(t) + `<small>/ ${timecode(L)}</small>`; $('lcd').style.setProperty('--u', u.toFixed(4));
    if (document.activeElement !== $('scrub')) $('scrub').value = Math.round(u * 1000);
    $('frameRead').textContent = `f ${String(Math.floor(t * project.output.fps + 1e-6)).padStart(3, '0')} / ${Math.round(L * project.output.fps)}`;
    updateGpuChip(); updateCacheChip();
    const engines = info && info.engines || [];
    const eng = engines.includes('gpu') ? ' · WebGPU' : engines.includes('webgl') ? ' · WebGL' : engines.includes('software-gl') ? ' · Software GL' : '';
    const cadence = (stage.gpuStatus ? stage.gpuStatus() : K.gpuStatus()).cadence, inWorker = stage.engineMode === 'worker';
    const rate = stage.playing && cadence.fps ? `${Math.round(cadence.fps)} fps · ` : '';
    $('perf').textContent = `${rate}${stage.frameMs().toFixed(1)} ms${info && info.samples > 1 ? ` · ${info.samples}× blur` : ''}${eng}${inWorker ? ' · Worker' : ''}`;
    $('perf').title = `${inWorker ? 'Preview renders in a background worker, off the UI thread; time is worker render submission per frame.' : `Main-thread render submission time.${stage.engineReason ? ` Preview renders on the main thread: ${stage.engineReason}.` : ''}`} ${stage.playing && cadence.fps ? `Recent frame interval: ${cadence.meanMs.toFixed(1)} ms average, ${cadence.p95Ms.toFixed(1)} ms at the 95th percentile. ` : ''}The Shaders indicator shows internal preview resolution; exports use full resolution.`;
    $('lane').style.setProperty('--ph', u.toFixed(4));
    for (const x of extensions) if (x.tick) { try { x.tick(t, extApi, info); } catch (e) { console.error(e); } }
    if (evolveOpen && now - lastEvo > 90) { lastEvo = now; drawChildren(t); }
    if (!arrMode) updateAnimatedRows(t);
    if (tab === 'audio') updateMeters(t);
  }

  // ---------- render cache chip ----------
  let cacheChipKey = '';
  function updateCacheChip() {
    const c = $('cacheChip'); if (!c) return;
    const st = stage.cacheStats(); let text, state, title;
    if (!st.on) { text = 'Cache off'; state = ''; title = 'Render cache is off: every frame renders live. Click to turn it on.'; }
    else if (!st.frames) { text = 'Cache'; state = ''; title = 'Frames you play or scrub are kept so the loop replays instantly. Click to turn off.'; }
    else { const pct = Math.round(st.fraction * 100); text = `Cache ${pct}%`; state = pct >= 95 ? 'gpu' : 'warn'; title = `${st.frames} of ${st.loopFrames} loop frames cached (${(st.bytes / 1048576).toFixed(0)} of ${(st.budget / 1048576).toFixed(0)} MB)${st.full ? '. Memory budget reached: lower Preview quality to cache the whole loop' : ''}. Preview plays on the output frame grid (${project.output.fps} fps), as the export will. Click to turn off.`; }
    const key = text + state; if (key === cacheChipKey) return; cacheChipKey = key;
    c.textContent = text; c.dataset.state = state; c.title = title;
  }
  function toggleCache() { stage.setCache(!stage.cacheOn); cacheChipKey = ''; updateCacheChip(); toast(stage.cacheOn ? 'Render cache on' : 'Render cache off'); }
  $('cacheChip').addEventListener('click', toggleCache);

  // ---------- benchmark ----------
  // Renders each scene at a fixed size and time sweep, forcing a GPU readback per frame so the wall time covers
  // submission plus execution. Output is JSON with p50/p95/max frame times for CI budgets and cross-machine comparison.
  const pctile = (a, q) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.ceil(b.length * q) - 1)]; };
  async function benchScene(pr, { w, h, frames, warm }) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d', { willReadFrequently: false });
    const fps = pr.output.fps || 30, N = frames, L = pr.finish.loop, ms = [], errs = [];
    __m_kits.setPreview(false);
    for (let i = -warm; i < N; i++) {
      const t = (((i + warm) % N) / N) * L, t0 = performance.now();
      try { pipeline.renderFrame(x, w, h, pr, t, { env: null, onError: e => errs.push(String(e && e.message || e)) }); x.getImageData(0, 0, 1, 1); } catch (e) { errs.push(String(e && e.message || e)); }
      if (i >= 0) ms.push(performance.now() - t0);
      if (i % 8 === 7) await new Promise(r => setTimeout(r, 0)); // keep the page responsive
    }
    const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
    return { p50: +pctile(ms, 0.5).toFixed(2), p95: +pctile(ms, 0.95).toFixed(2), max: +Math.max(...ms).toFixed(2), mean: +mean.toFixed(2), fps60: pctile(ms, 0.95) <= 16.7, errors: [...new Set(errs)].slice(0, 3) };
  }
  async function runBench(opt = {}) {
    const w = opt.w || 1280, h = opt.h || 720, frames = opt.frames || 60, warm = opt.warm == null ? 6 : opt.warm;
    const wasPlaying = stage.playing; stage.pause(); const wasCache = stage.cacheOn; stage.setCache(false);
    const g = K.gpuStatus(), report = { app: 'Motif 7', date: new Date().toISOString(), ua: navigator.userAgent, renderer: g.renderer || null, software: !!g.software, timerQuery: !!g.timer, cores: navigator.hardwareConcurrency || null, memoryGB: navigator.deviceMemory || null, dpr: window.devicePixelRatio || 1, size: `${w}x${h}`, frames, scenes: [] };
    try {
      const list = opt.all ? (opt.styles || STYLES.map(s => s.id)).map(id => ({ id, pr: (() => { const p = T.newProject(id); p.finish = { ...p.finish, shutter: 0 }; return p; })() })) : [{ id: 'current scene', pr: (() => { const p = clone(project); return p; })() }];
      let n = 0;
      for (const sc of list) {
        toast(`Benchmark ${++n}/${list.length} · ${sc.id}`);
        pipeline.renderFrame(document.createElement('canvas').getContext('2d'), 8, 8, sc.pr, 0, {}); // starts shader compiles before timing
        if (K.runtime.pendingCompiles) { const t0 = performance.now(); while (K.runtime.pendingCompiles && performance.now() - t0 < 8000) await new Promise(r => setTimeout(r, 30)); }
        report.scenes.push({ id: sc.id, ...(await benchScene(sc.pr, { w, h, frames, warm })) });
      }
    } finally { stage.setCache(wasCache); if (wasPlaying) stage.play(); else stage.invalidate(); }
    const worst = report.scenes.reduce((a, b) => (b.p95 > a.p95 ? b : a), report.scenes[0]);
    report.summary = { scenes: report.scenes.length, over60fpsBudget: report.scenes.filter(x => !x.fps60).map(x => x.id), worst: worst && { id: worst.id, p95: worst.p95 } };
    if (!opt.silent) {
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `motif-bench-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(`Benchmark done · worst p95 ${report.summary.worst.p95} ms · ${report.summary.over60fpsBudget.length} over 16.7 ms`);
    }
    return report;
  }
  $('benchChip').addEventListener('click', () => runBench());

  // ---------- top bar ----------
  const aspectsEl = $('aspects');
  aspectsEl.innerHTML = ASPECTS.map((a, i) => `<button role="radio" data-a="${a.id}" aria-checked="${a.id === aspect}" title="${a.label} (${i + 1})">${a.label}</button>`).join('');
  $('aspectSel').innerHTML = ASPECTS.map(a => `<option value="${a.id}">${a.label}</option>`).join('');
  $('aspectSel').addEventListener('change', e => setAspect(e.target.value));
  function setAspect(a) {
    aspect = a; autosave(); updateHud(); $('aspectSel').value = a; stage.setAspect(a); $('stageCol').style.setProperty('--ar', aspectRatio(a).toFixed(4));
    aspectsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.a === a));
    if (evolveOpen) layoutChildren();
  }
  if (restored) { try { const sv = JSON.parse(localStorage.getItem(AUTOSAVE)); if (sv && ASPECTS.some(a => a.id === sv.aspect)) aspect = sv.aspect; } catch (e) { /* keep default */ } }
  setAspect(aspect);
  if (restored) setTimeout(() => toast('Restored your last session'), 700);
  aspectsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setAspect(b.dataset.a); });
  function setPlayUi(on) { $('play').innerHTML = on ? '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>'; $('play').setAttribute('aria-label', on ? 'Pause' : 'Play'); }
  function togglePlay() {
    const on = stage.toggle(); setPlayUi(on); if (on) $('rmHint').hidden = true;
    if (player.buffer && audioSync && !arrMode) { if (on) player.start(stage.time); else player.stop(); }
  }
  $('play').addEventListener('click', togglePlay);
  if (reduce) setPlayUi(false);
  $('quality').addEventListener('change', e => stage.setQuality(e.target.value));
  $('guidesBtn').addEventListener('click', toggleGuides);
  function toggleGuides() { const on = $('guides').hidden; $('guides').hidden = !on; $('guidesBtn').setAttribute('aria-pressed', on); }
  function seekFrac(f) { stage.seek(f); if (player.playing) player.start(stage.time); }
  $('scrub').addEventListener('input', e => seekFrac(e.target.value / 1000));
  (() => {
    const coach = $('coach'); if (!coach) return;
    let seen = false; try { seen = localStorage.getItem('motif5-coach') === '1'; } catch (e) { /* storage unavailable */ }
    if (seen) return;
    coach.hidden = false;
    const done = () => { if (coach.hidden) return; coach.hidden = true; try { localStorage.setItem('motif5-coach', '1'); } catch (e) { /* per-viewer convenience only */ } };
    $('coachClose').addEventListener('click', done);
    ['mutateBtn', 'evolveBtn', 'randomBtn', 'play'].forEach(id => $(id).addEventListener('click', done));
    $('libList').addEventListener('click', done);
    addEventListener('keydown', e => { if (!e.metaKey && !e.ctrlKey && /^(m|e|r| )$/i.test(e.key)) done(); });
  })();
  function stepFrames(n) { if (stage.playing) togglePlay(); stage.step(n, project.output.fps); refreshRowsOnly(); }
  $('toStart').addEventListener('click', () => { seekFrac(0); if (!stage.playing) refreshRowsOnly(); });
  $('stepBack').addEventListener('click', () => jumpKey(-1));
  $('stepFwd').addEventListener('click', () => jumpKey(1));

  // ---------- tabs ----------
  const mqDesktop = matchMedia('(min-width: 64em)');
  function setTab(t) {
    if (t === 'library' && mqDesktop.matches) t = 'layer';
    tab = t; app.dataset.tab = t;
    $('tabs').querySelectorAll('[role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
    $('insp').querySelectorAll('[role=tabpanel]').forEach(p => { p.hidden = p.dataset.panel !== t; });
    renderPanel(); $('insp').scrollTop = 0;
    const tb = $('tabs').querySelector(`[data-tab=${t}]`); if (tb && tb.scrollIntoView) tb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  $('tabs').addEventListener('click', e => { const b = e.target.closest('[role=tab]'); if (b) setTab(b.dataset.tab); });
  $('tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const bs = [...$('tabs').querySelectorAll('[role=tab]')].filter(b => b.offsetParent); const i = bs.findIndex(b => b.dataset.tab === tab);
    const n = bs[(i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length]; setTab(n.dataset.tab); n.focus(); e.preventDefault();
  });
  mqDesktop.addEventListener('change', () => { if (tab === 'library') setTab('layer'); stage.setAspect(aspect); });

  // ---------- library ----------
  const catsEl = $('cats');
  function renderChips() {
    if (catFilter !== 'all' && !CATEGORIES.some(c => c.id === catFilter)) catFilter = 'all';
    catsEl.innerHTML = [{ id: 'all', name: 'All' }, ...CATEGORIES].map(c => `<button class="chip" data-c="${c.id}" aria-pressed="${c.id === catFilter}">${c.kit ? `<span class="kd" style="--kd:${c.accent || 'var(--accent)'}" aria-hidden="true"></span>` : ''}${esc(c.name)}</button>`).join('');
    $('search').placeholder = `Search ${STYLES.length} styles`;
    $('libCount').textContent = `${STYLES.length}`;
  }
  renderChips();
  catsEl.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && catsEl.scrollWidth > catsEl.clientWidth) { catsEl.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  catsEl.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; catFilter = b.dataset.c; catsEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderLibrary(); });
  $('search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderLibrary(); });
  const libViewKey = 'motif3-lib-view';
  function setLibView(v) { $('panel-library').dataset.view = v; $('libView').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.v === v)); try { localStorage.setItem(libViewKey, v); } catch (e) { /* per-viewer convenience only */ } }
  $('libView').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLibView(b.dataset.v); });
  try { const v = localStorage.getItem(libViewKey); if (v === 'list' || v === 'grid' || v === 'dense') setLibView(v); } catch (e) { /* storage unavailable */ }
  const thumbs = new Map();
  function thumbLook(st) { const l = active(); const pal = st.palette && getStyle(l.styleId).kit !== st.kit ? st.palette : l.shared.palette; return { styleId: st.id, params: T.newLayer(st.id).params, shared: { ...l.shared, palette: pal, invert: st.palette && pal === st.palette ? false : l.shared.invert, zoom: 1, rotate: 0, phase: 0, tempo: 1, loop: project.finish.loop } }; }
  function renderLibrary() {
    const list = $('libList'); list.innerHTML = ''; thumbs.clear(); let count = 0;
    for (const cat of CATEGORIES) {
      const items = STYLES.filter(s => s.category === cat.id && (catFilter === 'all' || catFilter === cat.id) && (!query || s.name.toLowerCase().includes(query) || s.blurb.toLowerCase().includes(query) || (s.tags || []).some(t => t.includes(query)) || (s.kitName || '').toLowerCase().includes(query)));
      if (!items.length) continue;
      const h = document.createElement('li'); h.className = 'lib-cat'; h.setAttribute('role', 'presentation'); h.innerHTML = cat.kit ? `<span class="kd" style="--kd:${cat.accent || 'var(--accent)'}" aria-hidden="true"></span>${esc(cat.name)} kit` : esc(cat.name); list.appendChild(h);
      for (const st of items) {
        count++;
        const li = document.createElement('li'); li.className = 'style-row'; li.setAttribute('role', 'option'); li.id = 'opt-' + st.id; li.tabIndex = -1;
        li.setAttribute('aria-selected', st.id === active().styleId);
        li.title = st.name + ' · ' + st.blurb; li.dataset.name = st.name; li.innerHTML = `<canvas width="128" height="80" aria-hidden="true"></canvas><div><b>${esc(st.name)}</b><span class="n"><span class="cat">${st.kit ? esc(st.group || cat.name) : cat.name}</span>${st.gpu ? '<span class="gpu">GPU</span>' : ''}${st.inputs && st.inputs.some(q => q.type !== 'text') ? '<span class="medtag" title="Takes an image or video">MEDIA</span>' : ''}${st.inputs && st.inputs.some(q => q.type === 'text') ? '<span class="medtag" title="Draws text you type in the inspector">TEXT</span>' : ''}${st.engine === 'glsl' && !(st.inputs && st.inputs.length) ? '<span class="glsl">GLSL</span>' : ''}${st.flash ? '<span title="Contains flashing; the photosensitive limiter is ' + (K.safe ? 'on' : 'off') + '">⚡</span>' : ''}</span></div>`;
        li.addEventListener('click', () => selectStyle(st.id));
        const c = li.querySelector('canvas'); thumbs.set(st.id, c);
        li.addEventListener('pointerenter', () => { animateThumb(st, c, true); libHover(st, true); });
        li.addEventListener('pointerleave', () => { animateThumb(st, c, false); libHover(st, false); });
        list.appendChild(li);
      }
    }
    if (!count) { const e = document.createElement('li'); e.className = 'lib-empty'; e.textContent = `No styles match “${query}”.`; list.appendChild(e); }
    list.setAttribute('aria-activedescendant', 'opt-' + active().styleId);
    drawThumbs();
  }
  let thumbJob = 0;
  function drawThumbs() {
    const job = ++thumbJob; let i = 0;
    const box = $('libList').getBoundingClientRect();
    const seen = c => { const r = c.getBoundingClientRect(); return r.bottom >= box.top && r.top <= box.bottom && r.width > 0; };
    const entries = [...thumbs.entries()].map(e => [e, seen(e[1]) ? 0 : 1]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
    const step = () => { if (job !== thumbJob) return; const t0 = performance.now(); while (i < entries.length && performance.now() - t0 < 10) { const [id, c] = entries[i++]; renderThumb(pipeline, c, thumbLook(getStyle(id)), 0.3, project.palettes); } if (i < entries.length) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  let hoverRaf = 0;
  function animateThumb(st, c, on) {
    cancelAnimationFrame(hoverRaf);
    if (!on || reduce) { renderThumb(pipeline, c, thumbLook(st), 0.3, project.palettes); return; }
    const start = performance.now(); const L = project.finish.loop;
    const loop = now => { renderThumb(pipeline, c, thumbLook(st), 0.3 + ((now - start) / 1000) / L, project.palettes); hoverRaf = requestAnimationFrame(loop); };
    hoverRaf = requestAnimationFrame(loop);
  }
  function selectStyle(id) {
    const l = active(); if (id === l.styleId) return;
    const next = clone(project); const nl = T.layerById(next, l.id);
    const ns = getStyle(id), os = getStyle(l.styleId);
    nl.styleId = id; nl.params = T.newLayer(id).params;
    // Kit styles carry a suggested palette: adopt it when entering a kit from outside it.
    let palMsg = '';
    if (ns.palette && ns.kit !== os.kit && !Object.keys(next.keys).some(p => p === `L:${l.id}:s:palette`)) { nl.shared.palette = ns.palette; nl.shared.invert = false; palMsg = ` · ${ns.palette.split('.')[1]} palette`; }
    // Text (motif-kit@3) belongs to the kit: styles of the same kit keep it, another kit starts from its own defaults.
    const textKit = !!ns.kit && ns.kit === os.kit;
    if (!textKit) delete nl.text;
    let dropped = 0; for (const p of Object.keys(next.keys)) if (p.startsWith(`L:${l.id}:p:`) || (!textKit && p.startsWith(`L:${l.id}:t:`))) { delete next.keys[p]; dropped++; }
    if (next.audio) next.audio.maps = next.audio.maps.filter(m => !m.path.startsWith(`L:${l.id}:p:`) && (textKit || !m.path.startsWith(`L:${l.id}:t:`)));
    commit(next, dropped ? `${getStyle(id).name} · removed ${dropped} key${dropped > 1 ? ' rows' : ' row'} from the old style${palMsg}` : palMsg ? `${ns.name}${palMsg}` : null);
    const el = $('opt-' + id); if (el) el.scrollIntoView({ block: 'nearest' });
    if (!mqDesktop.matches && tab === 'library') toast(`Layer ${project.layers.findIndex(x => x.id === l.id) + 1} is now ${getStyle(id).name}`);
  }
  function stepStyle(d) { const i = STYLES.findIndex(s => s.id === active().styleId); selectStyle(STYLES[(i + d + STYLES.length) % STYLES.length].id); }

  // ---------- text inputs (motif-kit@3): imported font files, installed-font browsing, typography rows ----------
  // Fonts are content-addressed (f_<sha256>) in IndexedDB "motif-fonts" (per browser, never uploaded); a project stores
  // only { family, weight, source }. Missing files show Relink. The engine (04b) draws with them on the page and, after
  // the bytes are posted once, in the render worker.
  const TA = __m_text_atlas;
  const fontStore = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open('motif-fonts', 1); r.onupgradeneeded = () => r.result.createObjectStore('fonts', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('fonts', mode); const q = fn(t.objectStore('fonts')); t.oncomplete = () => res(q && q.result); t.onerror = t.onabort = () => rej(t.error); }));
    return { all: () => tx('readonly', st => st.getAll()).catch(() => []), put: rec => tx('readwrite', st => st.put(rec)), remove: id => tx('readwrite', st => st.delete(id)) };
  })();
  const FONT_MAX = 16 * 1048576;
  const fontKind = b => { const t = String.fromCharCode(b[0], b[1], b[2], b[3]); return b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0 ? 'ttf' : t === 'OTTO' ? 'otf' : t === 'true' ? 'ttf' : t === 'wOFF' ? 'woff' : t === 'wOF2' ? 'woff2' : null; };
  // Family name from an sfnt 'name' table (TTF/OTF; typographic family 16 preferred over family 1). WOFF/WOFF2 use the file name.
  function sfntFamily(buf) {
    try {
      const v = new DataView(buf), n = v.getUint16(4);
      for (let i = 0; i < Math.min(n, 64); i++) {
        const o = 12 + 16 * i; if (String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3)) !== 'name') continue;
        const off = v.getUint32(o + 8), count = Math.min(v.getUint16(off + 2), 512), so = off + v.getUint16(off + 4); let best = null;
        for (let j = 0; j < count; j++) {
          const r = off + 6 + 12 * j, pid = v.getUint16(r), nid = v.getUint16(r + 6), len = Math.min(v.getUint16(r + 8), 128), at = so + v.getUint16(r + 10);
          if (nid !== 1 && nid !== 16) continue; let t = '';
          if (pid === 3 || pid === 0) for (let k = 0; k + 1 < len; k += 2) t += String.fromCharCode(v.getUint16(at + k)); else if (pid === 1) for (let k = 0; k < len; k++) t += String.fromCharCode(v.getUint8(at + k)); else continue;
          if (t && (!best || nid === 16)) best = t;
        }
        return best;
      }
    } catch (e) { /* malformed table: fall back to the file name */ }
    return null;
  }
  async function importFont(file) {
    if (!file || file.size > FONT_MAX) throw new Error(`${file ? file.name : 'That file'} is larger than 16 MB.`);
    const buf = await file.arrayBuffer();
    if (buf.byteLength < 12 || !fontKind(new Uint8Array(buf, 0, 4))) throw new Error(`${file.name} isn’t a TTF, OTF, WOFF or WOFF2 font.`);
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), id = 'f_' + [...h.slice(0, 12)].map(b => b.toString(16).padStart(2, '0')).join('');
    const family = TA.cleanFamily(sfntFamily(buf) || String(file.name || '').replace(/\.[^.]*$/, '').replace(/[^\p{L}\p{N} _.&+()-]+/gu, ' '), 'Imported font');
    const rec = await TA.registerFont(id, buf, { family, keep: true });
    if (!rec || rec.state !== 'ready') throw new Error(`${file.name} couldn’t be loaded as a font${rec && rec.error ? ` (${rec.error})` : ''}.`);
    let stored = true; try { await fontStore.put({ id, family: rec.family, name: String(file.name || '').slice(0, 80), size: buf.byteLength, data: buf, added: Date.now() }); } catch (e) { stored = false; }
    return { id, family: rec.family, stored };
  }
  fontStore.all().then(rows => { for (const r of rows || []) if (r && TA.FONT_ID_RE.test(r.id) && r.data) TA.registerFont(r.id, r.data, { family: r.family, keep: true }); });
  let localFamilies = [], hintTimer = 0;
  // A font finished loading (here or, via the worker's "fonts" message, there): redraw and refresh the fallback hints.
  TA.on(() => { stage.invalidate(); clearTimeout(hintTimer); hintTimer = setTimeout(() => refreshFontHints(), 60); });

  // ---------- parameter rows ----------
  const fmtNum = (v, s) => { if (s.type === 'int') return `${Math.round(v).toLocaleString('en-US')}${s.unit || ''}`; const dec = s.step >= 1 ? 0 : s.step >= 0.1 ? 1 : 2; return `${Number(v).toFixed(dec)}${s.unit || ''}`; };
  const fmt = (v, s) => (s.type === 'range' || s.type === 'int' ? fmtNum(v, s) : s.type === 'toggle' ? (v ? 'On' : 'Off') : String(v));
  const toSlider = (v, s) => (s.log ? Math.round(((Math.log(v) - Math.log(s.min)) / (Math.log(s.max) - Math.log(s.min))) * 1000) : v);
  const fromSlider = (x, s) => { if (!s.log) return Number(x); let v = Math.exp(Math.log(s.min) + (x / 1000) * (Math.log(s.max) - Math.log(s.min))); const q = v < 1000 ? 10 : v < 10000 ? 100 : 1000; v = Math.round(v / q) * q; return clamp(v, s.min, s.max); };
  const uNow = () => fract(stage.time / project.finish.loop);
  function keyState(path) { const ks = project.keys[path]; if (!ks || !ks.length) return 'none'; return T.keyIndexAt(ks, uNow()) >= 0 ? 'on' : 'anim'; }
  const isMapped = path => !!(project.audio && project.audio.maps.some(m => m.path === path));
  function shownValue(path) { if (!project.keys[path]) return T.getBase(project, path); const ev = T.evaluate(project, stage.time, null); return valueFromEval(ev, path); }
  function valueFromEval(ev, path) { const p = T.parsePath(path); if (!p) return undefined; if (p.kind === 'F') return ev.finish[p.key]; if (p.kind === 'G') { const n = ev.finish.grade && ev.finish.grade.nodes.find(x => x.id === p.node); return n ? n.params[p.key] : undefined; } const l = ev.layers.find(x => x.id === p.layer); if (!l) return undefined; return (p.scope === 'p' ? l.params : p.scope === 's' ? l.shared : l.comp)[p.key]; }
  const rid = path => 'r_' + path.replace(/[^a-z0-9]/gi, '_');
  function rowHtml(path, opts = {}) {
    const s = T.schemaAt(project, path); if (!s) return '';
    const v = shownValue(path), id = rid(path), ks = keyState(path), locked = locks.has(path), mapped = isMapped(path);
    const lockable = /^(L:[^:]+:[ps]:|G:)/.test(path) && s.type !== 'text' && (s.mutate ?? 1) !== 0;
    const lock = lockable ? `<button class="ib lock" data-lock="${path}" aria-pressed="${locked}" aria-label="Lock ${s.label}" title="Lock from Mutate, Evolve and Randomize">${LOCK_SVG}</button>` : '<span></span>';
    const key = opts.nokey ? '<span></span>' : `<button class="ib kb" data-key="${path}" data-state="${ks}" aria-label="${ks === 'on' ? 'Remove key' : 'Add key'} for ${s.label}" title="${ks === 'none' ? 'Key this value at the playhead' : ks === 'on' ? 'Remove the key at the playhead' : 'Add a key at the playhead'}">${KEY_SVG}</button>`;
    const cls = `row${s.type === 'toggle' ? ' toggle' : ''}${locked ? ' locked' : ''}${mapped ? ' mapped' : ''}`;
    let note = '';
    if (s.cpuMax && v > s.cpuMax && !gpu.ready) note = `<span class="note warn">Canvas 2D draws ${s.cpuMax.toLocaleString('en-US')}; WebGPU draws all ${Math.round(v).toLocaleString('en-US')}.</span>`;
    else if (s.cpuMax && gpu.ready) note = `<span class="note">WebGPU · up to ${s.max.toLocaleString('en-US')}</span>`;
    if (s.type === 'range' || s.type === 'int') {
      const mn = s.log ? 0 : s.min, mx = s.log ? 1000 : s.max, st = s.log ? 1 : s.step;
      return `<div class="${cls}" data-row="${path}"><label for="${id}">${s.label}</label>${lock}${key}<output class="val${ks !== 'none' ? ' anim' : ''}" id="${id}-v">${fmt(v, s)}</output><input type="range" id="${id}" data-path="${path}" min="${mn}" max="${mx}" step="${st}" value="${toSlider(v, s)}">${note}</div>`;
    }
    if (s.type === 'select' && /:c:blend$/.test(path)) { const cur = s.options.find(o => o.v === v) || s.options[0]; return `<div class="${cls}" data-row="${path}"><label for="${id}">${s.label}</label>${lock}${key}<span></span><button type="button" class="selbtn" id="${id}" data-blend="${path}" aria-haspopup="listbox" aria-expanded="false"><span>${cur.l}</span><svg class="i" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg></button></div>`; }
    if (s.type === 'select') return `<div class="${cls}" data-row="${path}"><label for="${id}">${s.label}</label>${lock}${key}<span></span><select id="${id}" data-path="${path}">${s.options.map(o => `<option value="${o.v}"${o.v === v ? ' selected' : ''}>${o.l}</option>`).join('')}</select></div>`;
    if (s.type === 'toggle') return `<div class="${cls}" data-row="${path}"><label for="${id}">${s.label}</label>${lock}${key}<input type="checkbox" class="switch" role="switch" id="${id}" data-path="${path}"${v ? ' checked' : ''}></div>`;
    return `<div class="${cls}" data-row="${path}"><label for="${id}">${s.label}</label><span></span>${key}<span></span><input type="text" id="${id}" data-path="${path}" maxlength="${s.max}" value="${esc(v)}" spellcheck="false"></div>`;
  }
  const openGroups = { media: true, style: true, comp: true, mask: false, motion: false, palette: true, editor: true, brand: false, output: true, time: true, blur: true, glow: true, lens: false, grade: false, texture: false, track: true, tempo: true, maps: true, live: false };
  const group = (id, title, body, extra = '') => `<details class="group" data-g="${id}"${openGroups[id] ? ' open' : ''}><summary><span class="lbl">${title}${extra}</span></summary><div class="rows">${body}</div></details>`;
  function readInput(el) { const s = T.schemaAt(project, el.dataset.path); if (!s) return undefined; if (s.type === 'toggle') return el.checked; if (s.type === 'range' || s.type === 'int') return fromSlider(el.value, s); return el.value; }
  // Edit a value: animated paths write a key at the playhead (auto-key), others set the base value.
  function applyValue(path, v) { return project.keys[path] ? T.setKey(project, path, uNow(), v) : T.setBase(project, path, v); }
  function bindRows(root) {
    const padMove = (el, e) => {
      const r = el.getBoundingClientRect(), lo = +el.dataset.lo, hi = +el.dataset.hi;
      const nx = clamp((e.clientX - r.left) / r.width, 0, 1), ny = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
      const vals = [lo + nx * (hi - lo), lo + ny * (hi - lo)].map(v => +v.toFixed(3)); live(setComp(el, vals)); paintComp(el, vals);
    };
    root.addEventListener('pointerdown', e => {
      const el = e.target.closest && e.target.closest('.xypad'); if (!el) return;
      el.setPointerCapture(e.pointerId); el._drag = true; padMove(el, e); e.preventDefault();
    });
    root.addEventListener('pointermove', e => { const el = e.target.closest && e.target.closest('.xypad'); if (el && el._drag) padMove(el, e); });
    const padEnd = e => { const el = e.target.closest && e.target.closest('.xypad'); if (el && el._drag) { el._drag = false; commit(project); } };
    root.addEventListener('pointerup', padEnd); root.addEventListener('pointercancel', padEnd);
    root.addEventListener('keydown', e => {
      const el = e.target; if (!el.classList || !el.classList.contains('xypad')) return;
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]; if (!d) return;
      const paths = el.dataset.paths.split(','), lo = +el.dataset.lo, hi = +el.dataset.hi, st = (hi - lo) / (e.shiftKey ? 20 : 100);
      const vals = paths.map((p, i) => clamp(+(shownValue(p) + d[i] * st).toFixed(3), lo, hi)); commit(setComp(el, vals)); e.preventDefault();
    });
    root.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset && el.dataset.comp === 'color') { const vals = compVals(el); live(setComp(el, vals)); paintComp(el, vals); return; }
      if (el.dataset && el.dataset.path && /^L:[^:]+:p:/.test(el.dataset.path)) queueMicrotask(() => applyShow(root));
      if (!el.dataset || !el.dataset.path) return;
      const v = readInput(el); const s = T.schemaAt(project, el.dataset.path); if (v === undefined) return;
      live(applyValue(el.dataset.path, v));
      const out = $(el.id + '-v'); if (out) out.textContent = fmt(v, s);
      if (el.dataset.path === 'F:loop') syncAudioRegion();
    });
    root.addEventListener('change', e => { const el = e.target; if (el.dataset && el.dataset.comp === 'color') { commit(setComp(el, compVals(el))); return; } if (!el.dataset || !el.dataset.path) return; const v = readInput(el); if (v === undefined) return; commit(applyValue(el.dataset.path, v)); });
    root.addEventListener('dblclick', e => { const el = e.target; if (el.type !== 'range' || !el.dataset.path) return; const s = T.schemaAt(project, el.dataset.path); commit(applyValue(el.dataset.path, s.def), `${s.label} reset`); });
    root.addEventListener('click', e => {
      const bb = e.target.closest('[data-blend]'); if (bb) { openBlendMenu(bb); return; }
      const lk = e.target.closest('[data-lock]');
      if (lk) { const p = lk.dataset.lock; locks.has(p) ? locks.delete(p) : locks.add(p); lk.setAttribute('aria-pressed', locks.has(p)); lk.closest('.row').classList.toggle('locked', locks.has(p)); return; }
      const lc = e.target.closest('[data-lockc]');
      if (lc) { const ps = lc.dataset.lockc.split(','), on = !ps.every(p => locks.has(p)); ps.forEach(p => on ? locks.add(p) : locks.delete(p)); lc.setAttribute('aria-pressed', on); lc.closest('.row').classList.toggle('locked', on); return; }
      const kc = e.target.closest('[data-keyc]');
      if (kc) { toggleKeyGroup(kc.dataset.keyc.split(',')); return; }
      const kb = e.target.closest('[data-key]');
      if (kb) toggleKey(kb.dataset.key);
    });
  }
  function toggleKey(path) {
    const s = T.schemaAt(project, path); if (!s) return;
    const ks = project.keys[path], u = uNow();
    if (!ks) { commit(T.setKey(project, path, u, T.getBase(project, path)), `Keyed ${s.label} · move the playhead, change the value`); selKey = { path, idx: 0 }; return; }
    const i = T.keyIndexAt(ks, u);
    if (i >= 0) { commit(T.removeKey(project, path, i), project.keys[path].length === 1 ? `${s.label} is no longer animated` : 'Key removed'); selKey = null; }
    else { const v = shownValue(path); const next = T.setKey(project, path, u, v); commit(next, 'Key added'); selKey = { path, idx: T.keyIndexAt(project.keys[path], u) }; }
  }
  function updateAnimatedRows(t) {
    const root = $('panel-' + tab); if (!root || tab === 'clips') return;
    const paths = [...Object.keys(project.keys), ...(project.audio ? project.audio.maps.map(m => m.path) : [])]; if (!paths.length) return;
    const ev = T.evaluate(project, t, currentEnv());
    root.querySelectorAll('[data-comp]').forEach(el => { if (el === document.activeElement || el._drag) return; const ps = el.dataset.paths.split(','); const vs = ps.map(p => valueFromEval(ev, p)); if (vs.every(v => v !== undefined)) paintComp(el, vs); const kb = el.closest('.row').querySelector('.kb'); if (kb) { const ks = ps.map(keyState); kb.dataset.state = ks.every(x => x === 'on') ? 'on' : ks.some(x => x !== 'none') ? 'anim' : 'none'; } });
    applyShow(root);
    for (const path of new Set(paths)) {
      const el = $(rid(path)); if (!el || el === document.activeElement) continue;
      const s = T.schemaAt(project, path); const v = valueFromEval(ev, path); if (v === undefined) continue;
      if (s.type === 'range' || s.type === 'int') el.value = toSlider(v, s); else if (s.type === 'toggle') el.checked = !!v; else if (el.tagName === 'SELECT') el.value = v;
      else if (s.type === 'text') el.value = v;
      else if (s.type === 'font') { el.value = v.family; const w = $(el.id + '-w'); if (w && w !== document.activeElement) w.value = String(v.weight); }
      else if (el.dataset && el.dataset.blend) { const o = s.options.find(q => q.v === v); if (o && el.firstElementChild) el.firstElementChild.textContent = o.l; }
      const out = $(el.id + '-v'); if (out) out.textContent = fmt(v, s);
      const kb = el.closest('.row') && el.closest('.row').querySelector('.kb'); if (kb) kb.dataset.state = keyState(path);
    }
    if (tab === 'colour') { const pk = root.querySelector('[data-key$=":s:palette"]'); if (pk) pk.dataset.state = keyState(pk.dataset.key); }
    paintRanges(root);
  }

  // ---------- panels ----------
  ['wheel', 'touchmove'].forEach(t => $('insp').addEventListener(t, () => { $('insp').dataset.userScroll = '1'; setTimeout(() => { delete $('insp').dataset.userScroll; }, 160); }, { passive: true }));
  ['layer', 'colour', 'finish', 'audio'].forEach(p => bindRows($('panel-' + p)));
  $('insp').addEventListener('pointerover', e => { const l = e.target.closest && e.target.closest('.row label, .row .rl'); if (l && !l.title && l.scrollWidth > l.clientWidth) l.title = l.textContent; });
  $('insp').addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.g) openGroups[d.dataset.g] = d.open; }, true);
  // Extension pages: tabs + panels are created once; panel() re-runs on every visit and on project refresh.
  const extApi = {
    get project() { return project; }, commit: (next, msg) => commit(next, msg), live: next => live(next), toast: m => toast(m),
    stage, pipeline, T, C, K, A, media, $, get tab() { return tab; }, setTab: t => setTab(t), clone,
    X, get aspect() { return aspect; }, get hasAudio() { return !!player.buffer; }, exportCtx: () => exportCtx(), queue: __m_render_queue.getQueue(), downloads: () => getDownloads(), gpuStatus: () => K.gpuStatus(),
    // Inspector building blocks so pages look and behave like the core panels (scrub labels, keys, locks, filled sliders).
    rowHtml: (path, o) => rowHtml(path, o), group: (id, title, body, extra) => group(id, title, body, extra), openGroups, locks, toggleKey: p => toggleKey(p),
    keyState: p => keyState(p), shownValue: p => shownValue(p), uNow: () => uNow(), paintRanges: r => paintRanges(r), refreshRows: () => refreshRowsOnly(), esc, store, reduce,
    get history() { return { cursor, size: history.length }; },
  };
  extensions.forEach(ext => {
    const b = document.createElement('button'); b.setAttribute('role', 'tab'); b.dataset.tab = ext.id; b.setAttribute('aria-selected', 'false'); b.setAttribute('aria-controls', 'panel-' + ext.id);
    b.innerHTML = `${ext.icon || '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>'}<span>${ext.name}</span>`; $('tabs').appendChild(b);
    const sec = document.createElement('section'); sec.setAttribute('role', 'tabpanel'); sec.id = 'panel-' + ext.id; sec.dataset.panel = ext.id; sec.hidden = true; $('insp').appendChild(sec);
    bindRows(sec); if (ext.init) { try { ext.init(sec, extApi); } catch (e) { console.error(e); } }
  });
  let scrollHold = 0;
  function renderPanel() {
    const insp = $('insp'), sc = insp.scrollTop, ae = document.activeElement;
    const fid = ae && ae !== document.body && ae.id && insp.contains(ae) ? ae.id : null;
    renderPanel0();
    insp.scrollTop = sc;
    if (fid) { const n = document.getElementById(fid); if (n && n !== document.activeElement) n.focus({ preventScroll: true }); }
    // some browsers settle the scroll offset after layout: hold the position one frame later too (unless the user has scrolled since)
    const tk = ++scrollHold; requestAnimationFrame(() => { if (tk === scrollHold && Math.abs(insp.scrollTop - sc) > 1 && !insp.dataset.userScroll) insp.scrollTop = sc; });
  }
  function renderPanel0() { const ext = extensions.find(e => e.id === tab); if (ext) { try { ext.panel($('panel-' + ext.id), extApi); } catch (e) { console.error(e); $('panel-' + ext.id).textContent = 'This page failed to load.'; } paintRanges($('insp')); return; } if (arrMode && ['layer', 'colour', 'finish', 'audio'].includes(tab)) { renderArrangeNotice(); return; } if (tab === 'layer') renderLayerPanel(); else if (tab === 'colour') renderColourPanel(); else if (tab === 'finish') renderFinishPanel(); else if (tab === 'audio') renderAudioPanel(); else if (tab === 'clips') renderClips(); else if (tab === 'kits') renderKitsPanel(); paintRanges($('insp')); }

  // Layers
  // ---- style parameters: grouped sections, colour / point compounds, show conditions ----
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const hex2 = n => Math.round(clamp(n, 0, 1) * 255).toString(16).padStart(2, '0');
  function compoundHtml(k, part, st) {
    const parts = Object.keys(st.params).filter(x => st.params[x].part && st.params[x].part.of === part.of);
    const paths = parts.map(x => lpath('p', x)), s0 = st.params[parts[0]];
    const vals = paths.map(p => shownValue(p)), ks = paths.map(keyState), locked = paths.every(p => locks.has(p)), mapped = paths.some(isMapped);
    const kstate = ks.every(x => x === 'on') ? 'on' : ks.some(x => x !== 'none') ? 'anim' : 'none';
    const id = 'c_' + part.of + '_' + project.active;
    const lock = (s0.mutate ?? 1) !== 0 ? `<button class="ib lock" data-lockc="${paths.join(',')}" aria-pressed="${locked}" aria-label="Lock ${esc(part.label)}" title="Lock from Mutate, Evolve and Randomize">${LOCK_SVG}</button>` : '<span></span>';
    const key = `<button class="ib kb" data-keyc="${paths.join(',')}" data-state="${kstate}" aria-label="Key ${esc(part.label)}" title="Key this at the playhead">${KEY_SVG}</button>`;
    const cls = `row crow${locked ? ' locked' : ''}${mapped ? ' mapped' : ''}`;
    const tip = s0.hint ? ` title="${esc(s0.hint)}"` : '';
    if (part.kind === 'color') {
      const hex = '#' + vals.map(hex2).join('');
      return `<div class="${cls}" data-row="${paths[0]}"><label for="${id}"${tip}>${esc(part.label)}</label>${lock}${key}<output class="val${kstate !== 'none' ? ' anim' : ''}" id="${id}-v">${hex.toUpperCase()}</output><input type="color" class="cswatch" id="${id}" data-comp="color" data-paths="${paths.join(',')}" value="${hex}"></div>`;
    }
    const [lo, hi] = [s0.min, s0.max], nx = (vals[0] - lo) / (hi - lo), ny = (vals[1] - lo) / (hi - lo);
    return `<div class="${cls} padrow" data-row="${paths[0]}"><label for="${id}"${tip}>${esc(part.label)}</label>${lock}${key}<output class="val${kstate !== 'none' ? ' anim' : ''}" id="${id}-v">${vals[0].toFixed(2)}, ${vals[1].toFixed(2)}</output><div class="xypad" id="${id}" tabindex="0" role="slider" aria-label="${esc(part.label)}" data-comp="point" data-paths="${paths.join(',')}" data-lo="${lo}" data-hi="${hi}"><i style="left:${(nx * 100).toFixed(2)}%;top:${((1 - ny) * 100).toFixed(2)}%"></i></div></div>`;
  }
  function paramRow(k, st) {
    const s = st.params[k];
    let h = s.part ? (s.part.i === 0 ? compoundHtml(k, s.part, st) : '') : rowHtml(lpath('p', k));
    if (!h) return '';
    if (s.hint && !s.part) h = h.replace('<label ', `<label title="${esc(s.hint)}" `);
    if (s.show) h = h.replace('<div class="row', `<div data-show="${esc(JSON.stringify(s.show))}" class="row`);
    return h;
  }
  function styleGroups(st) {
    const order = [], by = new Map();
    for (const k of Object.keys(st.params)) { const g = st.params[k].group || ''; if (!by.has(g)) { by.set(g, []); order.push(g); } by.get(g).push(k); }
    if (!by.has('')) { by.set('', []); order.unshift(''); }
    const reset = '<div class="btnrow"><button class="btn sm" id="resetStyle">Reset style</button></div>';
    return order.map((g, i) => {
      const id = g ? 'kg-' + slug(g) : 'style'; if (g && openGroups[id] === undefined) openGroups[id] = true;
      return group(id, g ? esc(g) : 'Style', by.get(g).map(k => paramRow(k, st)).join('') + (i === order.length - 1 ? reset : ''));
    }).join('');
  }
  function showOk(c, v) {
    const eq = (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9);
    if ('is' in c) return [].concat(c.is).some(x => eq(x, v));
    if ('not' in c) return ![].concat(c.not).some(x => eq(x, v));
    if ('gt' in c) return Number(v) > c.gt;
    if ('lt' in c) return Number(v) < c.lt;
    return true;
  }
  function applyShow(root) {
    if (!root) return;
    root.querySelectorAll('[data-show]').forEach(el => {
      let c; try { c = JSON.parse(el.dataset.show); } catch (e) { return; }
      const v = shownValue(lpath('p', c.param)); el.hidden = v === undefined ? false : !showOk(c, v);
    });
  }
  function setComp(el, vals) {
    const paths = el.dataset.paths.split(',');
    let pr = project;
    paths.forEach((p, i) => { pr = pr.keys[p] ? T.setKey(pr, p, uNow(), vals[i]) : T.setBase(pr, p, vals[i]); });
    return pr;
  }
  function compVals(el) {
    if (el.dataset.comp === 'color') { const h = el.value; return [1, 3, 5].map(i => +(parseInt(h.slice(i, i + 2), 16) / 255).toFixed(4)); }
    return null;
  }
  function paintComp(el, vals) {
    const out = $(el.id + '-v');
    if (el.dataset.comp === 'color') { const h = '#' + vals.map(hex2).join(''); if (el !== document.activeElement) el.value = h; if (out) out.textContent = h.toUpperCase(); return; }
    const lo = +el.dataset.lo, hi = +el.dataset.hi, dot = el.firstElementChild;
    dot.style.left = ((vals[0] - lo) / (hi - lo) * 100).toFixed(2) + '%'; dot.style.top = ((1 - (vals[1] - lo) / (hi - lo)) * 100).toFixed(2) + '%';
    if (out) out.textContent = `${vals[0].toFixed(2)}, ${vals[1].toFixed(2)}`;
  }
  function toggleKeyGroup(paths) {
    let pr = project; const u = uNow(); const ev = T.evaluate(project, stage.time, null);
    const allOn = paths.every(p => pr.keys[p] && T.keyIndexAt(pr.keys[p], u) >= 0);
    for (const p of paths) {
      if (allOn) { pr = T.removeKey(pr, p, T.keyIndexAt(pr.keys[p], u)); }
      else if (!pr.keys[p]) pr = T.setKey(pr, p, u, T.getBase(pr, p));
      else if (T.keyIndexAt(pr.keys[p], u) < 0) pr = T.setKey(pr, p, u, valueFromEval(ev, p));
    }
    commit(pr, allOn ? 'Keys removed' : 'Keys added');
  }
  function renderLayerPanel() { renderLayerPanel0(); applyShow($('panel-layer')); }
  function renderLayerPanel0() {
    const l = active(), st = getStyle(l.styleId), idx = project.layers.indexOf(l), n = project.layers.length;
    const cat = CATEGORIES.find(c => c.id === st.category).name;
    const list = project.layers.map((x, i) => ({ x, i })).reverse().map(({ x, i }) => `<li class="layer" style="--lc:var(--clip-${i % 4 + 1})" role="option" tabindex="0" data-layer="${x.id}" aria-selected="${x.id === l.id}" data-hidden="${!x.visible}"><button class="ib eye" data-eye="${x.id}" aria-label="${x.visible ? 'Hide' : 'Show'} layer ${i + 1}" aria-pressed="${!x.visible}">${x.visible ? EYE_SVG : EYE_OFF_SVG}</button><canvas width="88" height="56" aria-hidden="true"></canvas><span class="t"><b>${i + 1} · ${getStyle(x.styleId).name}</b><small>${T.BLENDS.find(b => b.v === x.comp.blend).l} · ${Math.round(x.comp.opacity * 100)}%${x.comp.mask !== 'none' ? ' · mask' : ''}</small></span><span class="readout">${i === 0 ? 'base' : ''}</span></li>`).join('');
    const bottom = idx === 0;
    const compKeys = ['opacity', 'blend', ...(bottom ? [] : ['fill']), 'mask'];
    const maskKeys = l.comp.mask === 'none' ? [] : /^matte/.test(l.comp.mask) ? ['maskInvert'] : ['maskSize', 'maskFeather', 'maskX', 'maskY', ...(l.comp.mask === 'circle' ? [] : ['maskAngle']), 'maskInvert'];
    const matteNote = /^matte/.test(l.comp.mask) ? `<p class="info">${bottom ? 'A matte needs a layer below.' : `Matte: layer ${idx}. Hide it to see only the result.`}</p>` : '';
    $('panel-layer').innerHTML = `
      <div class="panel-head"><div class="lbl">Layer ${idx + 1} of ${n} · ${esc(cat)}${st.kit ? ` kit · ${esc(st.group || '')}` : ''}</div><div class="ph-row"><h1 title="${esc(st.blurb)}">${esc(st.name)}</h1><span class="tags">${st.engine === 'glsl' ? `<span class="tag">GLSL${st.passes > 1 ? ' ×' + st.passes : ''}</span>` : st.gpu ? `<span class="tag">${gpu.ready ? 'WebGPU' : 'Canvas 2D'}</span>` : ''}</span></div>${K.errors.has(st.id) ? `<p class="kit-status" data-kind="error">${esc(K.errors.get(st.id))}</p>` : ''}${st.flash && !K.safe ? '<p class="info">⚡ Flashing content · limiter is off (Kits)</p>' : ''}</div>
      <details class="group" data-g="layers" open><summary><span class="lbl">Layers <span class="count">${n}/${T.MAX_LAYERS}</span></span></summary>
        <ul class="layers" id="layerList" role="listbox" aria-label="Layers, top first">${list}</ul>
        <div class="layer-tools">
          <button class="btn sm" id="addLayer"${n >= T.MAX_LAYERS ? ' disabled' : ''}>+ Add</button><button class="btn sm" id="dupLayer"${n >= T.MAX_LAYERS ? ' disabled' : ''}>Duplicate</button>
          <button class="btn sm icon" id="upLayer" aria-label="Move layer up"${idx >= n - 1 ? ' disabled' : ''}>▲</button><button class="btn sm icon" id="downLayer" aria-label="Move layer down"${idx <= 0 ? ' disabled' : ''}>▼</button>
          <button class="btn sm" id="delLayer"${n <= 1 ? ' disabled' : ''}>Delete</button>
        </div>
      </details>
      ${textGroupsHtml(st)}
      ${mediaInputsOf(st).length ? group('media', 'Media', mediaInputsOf(st).map(q => mediaSlotHtml(l, q)).join(''), (l.media && mediaInputsOf(st).some(q => l.media[q.id])) ? ' <span class="count">●</span>' : '') : ''}
      ${styleGroups(st)}
      ${group('comp', 'Composite', compKeys.map(k => rowHtml(lpath('c', k))).join('') + (bottom ? '<p class="info">The base layer always fills its background.</p>' : ''))}
      ${l.comp.mask !== 'none' ? group('mask', 'Mask', maskKeys.map(k => rowHtml(lpath('c', k))).join('') + matteNote) : ''}
      ${group('motion', 'Motion and transform', ['tempo', 'phase', 'seed', 'zoom', 'rotate', 'posX', 'posY'].map(k => rowHtml(lpath('s', k))).join(''))}`;
    paintMediaThumbs();
    $('panel-layer').querySelectorAll('#layerList canvas').forEach(c => { const x = T.layerById(project, c.closest('.layer').dataset.layer); renderThumb(pipeline, c, { ...x, shared: { ...x.shared, loop: project.finish.loop } }, 0.3, project.palettes); });
  }
  // ---- text inputs (motif-kit@3) ----
  // One group per text input; per line: text (live, maxlength), font family (installed, typed or imported) + weight,
  // size, tracking, alignment. Every field keys like any channel: strings, fonts and alignment hold; size and tracking ease.
  const textInputsOf = st => (st.inputs || []).filter(q => q.type === 'text');
  const mediaInputsOf = st => (st.inputs || []).filter(q => q.type !== 'text');
  const WEIGHTS = [[100, 'Thin'], [200, 'Extra light'], [300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold'], [900, 'Black']];
  function fontHintHtml(path, f) {
    const s = TA.fontStatus(f);
    const text = s.state === 'ok' ? '' : s.state === 'loading' ? 'Loading font…' : s.state === 'missing' ? `The font file for “${f.family}” isn’t in this browser. Drawing with ${s.using} until you relink it.` : s.state === 'error' ? `Couldn’t use the font file (${s.detail}). Drawing with ${s.using}.` : `Fallback in use: ${s.detail} Drawing with ${s.using}.`;
    return `<div class="fhint" data-fhint="${path}" data-state="${s.state}" role="status">${text ? `<span>${esc(text)}</span>` : ''}${s.state === 'missing' || s.state === 'error' ? `<button class="btn sm" data-frelink="${path}">Relink…</button>` : ''}</div>`;
  }
  function refreshFontHints() {
    const root = $('panel-layer'); if (!root || tab !== 'layer') return;
    root.querySelectorAll('[data-fhint]').forEach(el => { const f = shownValue(el.dataset.fhint); if (f && typeof f === 'object' && !el.contains(document.activeElement)) el.outerHTML = fontHintHtml(el.dataset.fhint, f); });
  }
  function fontRowHtml(path) {
    const s = T.schemaAt(project, path); if (!s) return '';
    const f = shownValue(path) || s.def, id = rid(path), ks = keyState(path);
    const key = `<button class="ib kb" data-key="${path}" data-state="${ks}" aria-label="${ks === 'on' ? 'Remove key' : 'Add key'} for ${esc(s.line)} font" title="Key the font at the playhead (a font holds until the next key)">${KEY_SVG}</button>`;
    return `<div class="row" data-row="${path}"><label for="${id}">Font</label><span></span>${key}<span></span><input type="text" id="${id}" data-ffam="${path}" list="motifFontList" maxlength="64" spellcheck="false" autocomplete="off" value="${esc(f.family)}" aria-describedby="${id}-h" title="Type an installed family, pick one from the list, or import a font file"></div>
      <div class="row"><label for="${id}-w">Weight</label><span></span><span></span><span></span><select id="${id}-w" data-fweight="${path}">${WEIGHTS.map(([w, n]) => `<option value="${w}"${w === f.weight ? ' selected' : ''}>${w} · ${n}</option>`).join('')}</select></div>
      <div id="${id}-h">${fontHintHtml(path, f)}</div>
      <div class="btnrow"><button class="btn sm" data-fimport="${path}">Import font file…</button>${typeof window.queryLocalFonts === 'function' ? `<button class="btn sm" data-flocal="${path}">Installed fonts…</button>` : ''}${f.source && TA.fontInfo(f.source) ? '<span class="info">Imported file</span>' : ''}</div>`;
  }
  function fontListHtml() {
    const names = new Set(['Instrument Sans', 'Anybody', 'Fraunces', 'JetBrains Mono', 'system-ui', 'sans-serif', 'serif', 'monospace']);
    for (const r of TA.fontPayload()) names.add(r.family);
    for (const n of localFamilies) names.add(n);
    return `<datalist id="motifFontList">${[...names].slice(0, 2000).map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>`;
  }
  function textGroupsHtml(st) {
    const qs = textInputsOf(st); if (!qs.length) return '';
    return qs.map((q, qi) => {
      const gid = 'text-' + q.id; if (openGroups[gid] === undefined) openGroups[gid] = true;
      const body = q.lines.map(ln => {
        const p = f => lpath('t', `${q.id}.${ln.id}.${f}`);
        return `<div class="tline" role="group" aria-label="${esc(q.label)} · ${esc(ln.label)}"><div class="lbl tl-h" aria-hidden="true">${esc(ln.label)}</div>${rowHtml(p('text'))}${fontRowHtml(p('font'))}${rowHtml(p('size'))}${rowHtml(p('tracking'))}${rowHtml(p('align'))}</div>`;
      }).join('');
      return group(gid, `${esc(q.label)} · text`, (q.hint ? `<p class="info">${esc(q.hint)}</p>` : '') + body + (qi === 0 ? fontListHtml() : ''));
    }).join('');
  }
  // Font edits (family, weight, import, relink, installed fonts). Text, size, tracking and align use the generic row handlers.
  let fontTarget = null;
  const fontOf = path => { const v = shownValue(path); return v && typeof v === 'object' ? v : (T.schemaAt(project, path) || {}).def; };
  function setFont(path, patch, msg) { if (!T.schemaAt(project, path)) return; const next = { ...fontOf(path), ...patch }; if (!next.source) delete next.source; commit(applyValue(path, next), msg); }
  $('panel-layer').addEventListener('change', e => {
    const el = e.target;
    if (el.dataset && el.dataset.ffam) {
      const fam = TA.cleanFamily(el.value, null);
      if (!fam) { toast('Font names use letters, digits, spaces and . _ & + ( ) - only.'); el.value = fontOf(el.dataset.ffam).family; return; }
      const imp = TA.fontPayload().find(r => r.family === fam); // typing an imported font's name selects that file
      setFont(el.dataset.ffam, { family: fam, source: imp ? imp.id : undefined }, `Font · ${fam}`);
    } else if (el.dataset && el.dataset.fweight) setFont(el.dataset.fweight, { weight: Number(el.value) }, `Weight · ${el.value}`);
  });
  $('panel-layer').addEventListener('click', async e => {
    const im = e.target.closest('[data-fimport], [data-frelink]');
    if (im) { fontTarget = { path: im.dataset.fimport || im.dataset.frelink, relink: !!im.dataset.frelink }; $('fontFile').click(); return; }
    const lf = e.target.closest('[data-flocal]');
    if (lf) {
      try {
        const list = await window.queryLocalFonts();
        localFamilies = [...new Set(list.map(f => TA.cleanFamily(f.family, null)).filter(Boolean))].sort((a, b) => a.localeCompare(b)).slice(0, 2000);
        const dl = $('motifFontList'); if (dl) dl.outerHTML = fontListHtml();
        toast(localFamilies.length ? `${localFamilies.length} installed families: type in Font to search them` : 'No installed fonts were shared. Type a family name instead.');
        const inp = $(rid(lf.dataset.flocal)); if (inp) inp.focus();
      } catch (err) { toast(err && err.name === 'NotAllowedError' ? 'Font access was not allowed. Type a family name, or import a font file.' : 'This browser can’t list installed fonts. Type a family name, or import a font file.'); }
    }
  });
  async function useFontFile(f, tgt) {
    try {
      const r = await importFont(f);
      setFont(tgt.path, { family: r.family, source: r.id }, `${tgt.relink ? 'Relinked' : 'Imported'} ${r.family}${r.stored ? '' : ' · browser storage refused it, so it lasts until reload'}`);
      return true;
    } catch (err) { toast(err.message || String(err)); return false; }
  }
  $('fontFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; const tgt = fontTarget; fontTarget = null; if (!f || !tgt) return;
    await useFontFile(f, tgt);
  });
  // ---- media slots ----
  const fmtDur = s => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${s.toFixed(1)} s`;
  function mediaSlotHtml(l, q) {
    const m = l.media && l.media[q.id], info = m ? media.info(m.asset) : null;
    const accept = q.type === 'image' ? 'image' : q.type === 'video' ? 'video' : 'image or video';
    const seg = (name, opts, val) => `<div class="seg" role="radiogroup" aria-label="${name}">${opts.map(([v, lbl, tip]) => `<button role="radio" data-mset="${name}" data-input="${q.id}" data-v="${v}" aria-checked="${val === v}"${tip ? ` title="${tip}"` : ''}>${lbl}</button>`).join('')}</div>`;
    if (!m) return `<div class="mslot" data-input="${q.id}" data-kind="${q.type}">
        <button class="mdrop" data-mload="${q.id}"${q.hint ? ` title="${esc(q.hint)}"` : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l4.5-4.5 3 3L16 10l4 4"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg><b>${esc(q.label)}</b><span>Drop or choose an ${accept}</span></button>
        </div>`;
    const bad = info && (info.state === 'missing' || info.state === 'error');
    const meta = `${m.w}×${m.h} · ${m.kind === 'video' ? 'video · ' + fmtDur(m.dur) : 'image'}`;
    return `<div class="mslot" data-input="${q.id}" data-state="${bad ? 'bad' : info ? info.state : ''}">
      <div class="mhead"><canvas class="mthumb" data-mthumb="${q.id}" width="112" height="63" aria-hidden="true"></canvas>
        <div class="mmeta"><span class="lbl">${esc(q.label)}</span><b title="${esc(m.name)}">${esc(m.name || 'Untitled')}</b><span>${bad ? (info.state === 'missing' ? 'File not in this browser · relink' : esc(info.error || 'Can’t decode')) : meta}</span></div></div>
      <div class="mrow"><span class="nm">Fit</span>${seg('fit', [['fill', 'Fill', 'Cover the frame, cropping the edges'], ['fit', 'Fit', 'Show the whole image, letterboxed'], ['stretch', 'Stretch', 'Distort to the frame']], m.fit)}</div>
      ${m.kind === 'video' ? `<div class="mrow"><span class="nm">Timing</span>${seg('timing', [['loop', 'Fit to loop', 'Retime the clip to one Motif loop: seamless'], ['free', 'Real time', 'Play at normal speed; wraps at the clip length']], m.timing)}</div>` : ''}
      <div class="btnrow"><button class="btn sm" data-mload="${q.id}">${bad ? 'Relink…' : 'Replace…'}</button><button class="btn sm" data-mclear="${q.id}">Remove</button></div></div>`;
  }
  function paintMediaThumbs() {
    const l = active(); if (!l.media) return;
    $('panel-layer').querySelectorAll('[data-mthumb]').forEach(c => {
      const m = l.media[c.dataset.mthumb]; if (!m) return; const i = media.info(m.asset); if (i.state === 'unknown') media.ensure(m.asset);
      const x = c.getContext('2d'); x.fillStyle = '#16161A'; x.fillRect(0, 0, c.width, c.height);
      if (i.state !== 'ready' || !i.el) return;
      const s = Math.max(c.width / i.w, c.height / i.h); try { x.drawImage(i.el, (c.width - i.w * s) / 2, (c.height - i.h * s) / 2, i.w * s, i.h * s); } catch (e) { /* frame not ready */ }
    });
  }
  let mediaTarget = null;
  async function attachMedia(file, inputId, layerId = project.active) {
    const l = T.layerById(project, layerId), st = l && getStyle(l.styleId);
    const mi = st ? mediaInputsOf(st) : [], q = mi.find(x => x.id === inputId) || mi[0];
    if (!q) { toast('This layer’s style has no media input. Pick a style marked MEDIA in the library.'); return false; }
    const kind = media.kindOf(file);
    if (!kind) { toast(`${file.name} isn’t an image or video.`); return false; }
    if (q.type !== 'media' && q.type !== kind) { toast(`${q.label} takes ${q.type === 'image' ? 'an image' : 'a video'}.`); return false; }
    toast(`Loading ${file.name}…`);
    try {
      const meta = await media.add(file);
      const next = clone(project), nl = T.layerById(next, layerId); if (!nl) return false;
      const prev = nl.media && nl.media[q.id];
      nl.media = { ...(nl.media || {}), [q.id]: { ...meta, fit: prev ? prev.fit : q.fit, timing: prev ? prev.timing : 'loop' } };
      commit(next, `${meta.kind === 'video' ? 'Video' : 'Image'} attached · ${meta.name}`);
      if (!(await media.persistent)) toast('Attached. This browser blocks local storage, so the file won’t survive a reload.');
      else if (meta.storeError === 'quota') toast('Attached, but browser storage is full. Free space on the Media page so it survives a reload.');
      return true;
    } catch (err) { toast(err.message || String(err)); return false; }
  }
  function setMediaField(inputId, key, v) {
    const next = clone(project), nl = T.layerById(next, project.active); if (!nl.media || !nl.media[inputId]) return;
    nl.media[inputId][key] = v; commit(next);
  }
  $('mediaFile').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f && mediaTarget) await attachMedia(f, mediaTarget.input, mediaTarget.layer); mediaTarget = null; });
  $('panel-layer').addEventListener('dragover', e => { if (e.target.closest('.mslot') && hasFiles(e)) { e.preventDefault(); e.target.closest('.mslot').classList.add('over'); } });
  $('panel-layer').addEventListener('dragleave', e => { const s = e.target.closest('.mslot'); if (s) s.classList.remove('over'); });
  $('panel-layer').addEventListener('click', e => {
    const ld = e.target.closest('[data-mload]');
    if (ld) { const st = getStyle(active().styleId), q = (st.inputs || []).find(x => x.id === ld.dataset.mload); mediaTarget = { input: ld.dataset.mload, layer: project.active }; $('mediaFile').accept = q && q.type === 'image' ? 'image/*' : q && q.type === 'video' ? 'video/*' : 'image/*,video/*'; $('mediaFile').click(); return; }
    const cl = e.target.closest('[data-mclear]');
    if (cl) { const next = clone(project), nl = T.layerById(next, project.active); if (nl.media) { delete nl.media[cl.dataset.mclear]; if (!Object.keys(nl.media).length) delete nl.media; } commit(next, 'Media removed'); return; }
    const ms = e.target.closest('[data-mset]');
    if (ms) { setMediaField(ms.dataset.input, ms.dataset.mset, ms.dataset.v); return; }
  });
  $('panel-layer').addEventListener('click', e => {
    const eye = e.target.closest('[data-eye]');
    if (eye) { const next = clone(project); const l = T.layerById(next, eye.dataset.eye); l.visible = !l.visible; commit(next, l.visible ? 'Layer shown' : 'Layer hidden'); return; }
    const li = e.target.closest('.layer'); if (li && !e.target.closest('button')) { selectLayer(li.dataset.layer); return; }
    const id = e.target.id;
    if (id === 'resetStyle') { doReset(); return; }
    if (id === 'addLayer') addLayer(); else if (id === 'dupLayer') dupLayer(); else if (id === 'delLayer') delLayer(); else if (id === 'upLayer') moveLayer(1); else if (id === 'downLayer') moveLayer(-1);
  });
  $('panel-layer').addEventListener('keydown', e => {
    const li = e.target.closest('.layer'); if (!li) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectLayer(li.dataset.layer); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const i = project.layers.findIndex(l => l.id === li.dataset.layer) + (e.key === 'ArrowUp' ? 1 : -1); if (project.layers[i]) { selectLayer(project.layers[i].id); const n = $('panel-layer').querySelector(`[data-layer="${project.layers[i].id}"]`); if (n) n.focus(); } }
  });
  function selectLayer(id) { if (project.active === id) return; project = { ...project, active: id }; history[cursor] = JSON.stringify(project); refresh(); }
  function addLayer() {
    if (project.layers.length >= T.MAX_LAYERS) return;
    const used = new Set(project.layers.map(l => l.styleId)); const pick = ['plexus', 'orbital-swarm', 'halftone', 'flow-field', 'kaleidoscope'].find(s => !used.has(s)) || 'plexus';
    const l = T.newLayer(pick, { ...active().shared }, { blend: 'screen', opacity: 0.9 });
    const next = clone(project); next.layers.push(l); next.active = l.id; commit(next, `Layer ${next.layers.length} added · ${getStyle(pick).name}`);
  }
  function dupLayer() {
    if (project.layers.length >= T.MAX_LAYERS) return;
    const src = active(), next = clone(project), copy = T.newLayer(src.styleId); Object.assign(copy, { params: clone(src.params), shared: clone(src.shared), comp: clone(src.comp), visible: true }); if (src.media) copy.media = clone(src.media); if (src.text) copy.text = clone(src.text);
    const i = next.layers.findIndex(l => l.id === src.id); next.layers.splice(i + 1, 0, copy); next.active = copy.id;
    for (const [p, ks] of Object.entries(project.keys)) if (p.startsWith(`L:${src.id}:`)) next.keys[p.replace(`L:${src.id}:`, `L:${copy.id}:`)] = clone(ks);
    commit(next, 'Layer duplicated');
  }
  function delLayer() {
    if (project.layers.length <= 1) return;
    const id = project.active, next = clone(project), i = next.layers.findIndex(l => l.id === id); next.layers.splice(i, 1);
    for (const p of Object.keys(next.keys)) if (p.startsWith(`L:${id}:`)) delete next.keys[p];
    if (next.audio) next.audio.maps = next.audio.maps.filter(m => !m.path.startsWith(`L:${id}:`));
    next.active = next.layers[Math.max(0, i - 1)].id; commit(next, 'Layer deleted');
  }
  function moveLayer(d) { const next = clone(project), i = next.layers.findIndex(l => l.id === project.active), j = i + d; if (j < 0 || j >= next.layers.length) return; [next.layers[i], next.layers[j]] = [next.layers[j], next.layers[i]]; commit(next, d > 0 ? 'Moved up' : 'Moved down'); }

  // Colour
  const curPalette = () => C.paletteById(active().shared.palette, project.palettes);
  const isCustom = id => project.palettes.some(p => p.id === id);
  let brandLib = store.get('motif-style-lab-2-brand') || [];
  function renderColourPanel() {
    const l = active(), pid = l.shared.palette, p = curPalette(), custom = isCustom(pid), locksP = custom ? new Set(p.locks) : new Set();
    const swatch = (x, tag) => `<button class="sw" role="radio" data-pal="${x.id}" aria-checked="${x.id === pid}" aria-label="${esc(x.name)}" title="${esc(x.name)}"><i style="background:${x.bg}"></i>${x.a.map(c => `<i style="background:${c}"></i>`).join('')}${tag ? `<b>${tag}</b>` : ''}</button>`;
    const ppath = lpath('s', 'palette'), pks = keyState(ppath);
    const slots = C.SLOTS.map(s => { const hex = C.slotsOf(p)[s]; const lk = locksP.has(s); return `<div class="slot${lk ? ' locked' : ''}"><input type="color" value="${hex.toLowerCase()}" data-slot="${s}" aria-label="${C.SLOT_LABELS[s]} colour"><span class="nm">${C.SLOT_LABELS[s]}</span><input type="text" value="${hex}" data-hex="${s}" maxlength="7" aria-label="${C.SLOT_LABELS[s]} hex" spellcheck="false"><button class="ib lock" data-plock="${s}" aria-pressed="${lk}" aria-label="Lock ${C.SLOT_LABELS[s]}" title="Locked colours survive Evolve, Harmonize and Extract">${LOCK_SVG}</button></div>`; }).join('');
    const cr = C.contrast(p.bg, p.ink); const grade = cr >= 7 ? 'AAA' : cr >= 4.5 ? 'AA' : cr >= 3 ? 'AA large' : 'fails';
    const spaceSeg = C.SPACES.map(s => `<button role="radio" data-space="${s.id}" aria-checked="${project.output.space === s.id}" title="${s.note}">${s.label}</button>`).join('');
    $('panel-colour').innerHTML = `
      <div class="panel-head"><div class="lbl">Layer ${project.layers.indexOf(l) + 1} · ${getStyle(l.styleId).name}</div><h1>Colour</h1></div>
      ${group('palette', 'Palette', `<div class="subhead"><span>${esc(p.name)}${custom ? ' · brand' : ''}</span><button class="ib kb" data-key="${ppath}" data-state="${pks}" aria-label="${pks === 'on' ? 'Remove' : 'Add'} palette key" title="Key the palette at the playhead — palette keys cross-fade unless set to Hold">${KEY_SVG}</button></div>
        <div class="swatches" role="radiogroup" aria-label="Palette">${PALETTES.map(x => swatch(x)).join('')}${project.palettes.map(x => swatch(x, 'brand')).join('')}</div>${rowHtml(lpath('s', 'invert'))}`)}
      ${group('editor', 'Palette editor', `<div class="slots">${slots}</div>
        <p class="contrast">Ink on background <b>${cr.toFixed(2)}:1</b> · ${grade}${custom ? '' : ' · edits make a brand copy'}</p>
        ${custom ? `<label class="field"><span class="lbl">Name</span><input type="text" id="palName" value="${esc(p.name)}" maxlength="40" style="background:var(--surface-2);border:var(--hairline) solid var(--line);border-radius:var(--radius-s);padding:var(--space-2)"></label>` : ''}
        <div class="btnrow"><select id="harmScheme" aria-label="Harmony"><option value="triad">Triad</option><option value="analogous">Analogous</option><option value="complement">Complement</option></select><button class="btn sm" id="harmBtn">Harmonize</button><button class="btn sm" id="extractBtn">From image…</button></div>
        <div class="btnrow"><button class="btn sm" id="saveBrand">Save to swatch library</button>${custom ? '<button class="btn sm" id="delPal">Delete brand palette</button>' : ''}</div>`)}
      ${group('brand', 'Swatch library', brandLib.length ? `<div class="swatches">${brandLib.map((x, i) => `<button class="sw" data-brand="${i}" title="Use ${esc(x.name)}" aria-label="Use ${esc(x.name)}"><i style="background:${x.bg}"></i>${x.a.map(c => `<i style="background:${c}"></i>`).join('')}<b>${esc(x.name.slice(0, 10))}</b></button>`).join('')}</div><p class="info">Click to use in this project.</p><button class="btn sm" id="clearBrand">Clear library</button>` : '<p class="info">Saved palettes appear here.</p>', ` <span class="count">${brandLib.length}</span>`)}
      ${group('output', 'Output', `<div class="seg" role="radiogroup" aria-label="Output colour space" id="spaceSeg">${spaceSeg}</div>
        <p class="info">${C.spaceById(project.output.space).note}</p>
        <div class="toggles"><label><span>Broadcast-safe limiter</span><input type="checkbox" class="switch" role="switch" id="legalSw"${project.output.broadcastSafe ? ' checked' : ''}></label>
        <label><span>Zebra: flag illegal colours</span><input type="checkbox" class="switch" role="switch" id="zebraSw"${zebra ? ' checked' : ''}></label></div>`)}`;
  }
  function ensureCustom() {
    const l = active(); if (isCustom(l.shared.palette)) return { next: clone(project), pal: null };
    const next = clone(project), base = C.paletteById(l.shared.palette, next.palettes), cp = C.customFrom(base, `${base.name} brand`);
    next.palettes.push(cp); T.layerById(next, l.id).shared.palette = cp.id;
    for (const [path, ks] of Object.entries(next.keys)) if (path === `L:${l.id}:s:palette`) ks.forEach(k => { if (k.v === base.id) k.v = cp.id; });
    return { next, pal: cp };
  }
  function editPalette(fn, msg, liveOnly) {
    const { next } = ensureCustom(); const id = T.layerById(next, project.active).shared.palette;
    const i = next.palettes.findIndex(p => p.id === id); next.palettes[i] = fn(next.palettes[i]);
    if (liveOnly) { project = T.sanitizeProject(next, C.sanitizeCustom); stage.invalidate(); } else commit(next, msg);
  }
  const pc = $('panel-colour');
  pc.addEventListener('click', e => {
    const sw = e.target.closest('[data-pal]'); if (sw) { commit(applyValue(lpath('s', 'palette'), sw.dataset.pal)); drawThumbs(); return; }
    const pl = e.target.closest('[data-plock]'); if (pl) { const s = pl.dataset.plock; editPalette(p => ({ ...p, locks: p.locks.includes(s) ? p.locks.filter(x => x !== s) : [...p.locks, s] }), null); return; }
    const sp = e.target.closest('[data-space]'); if (sp) { const next = clone(project); next.output.space = sp.dataset.space; commit(next, `Output: ${C.spaceById(sp.dataset.space).label}`); stage.setSpace(project.output.space); return; }
    const br = e.target.closest('[data-brand]'); if (br) { const src = brandLib[Number(br.dataset.brand)]; const cp = C.sanitizeCustom({ ...src, id: undefined }); const next = clone(project); next.palettes.push(cp); commit(applyValueOn(next, lpath('s', 'palette'), cp.id), `Using ${cp.name}`); return; }
    const id = e.target.id;
    if (id === 'harmBtn') editPalette(p => C.harmonize(p, p.locks, $('harmScheme').value), 'Harmonized unlocked colours');
    if (id === 'extractBtn') $('imgFile').click();
    if (id === 'saveBrand') { const p = curPalette(); brandLib = [{ name: p.name, bg: p.bg, ink: p.ink, a: p.a.slice(), locks: p.locks || [] }, ...brandLib.filter(x => x.name !== p.name)].slice(0, 24); store.set('motif-style-lab-2-brand', brandLib); toast(`Saved ${p.name} to your swatch library`); renderColourPanel(); }
    if (id === 'delPal') { const pid = active().shared.palette, next = clone(project); next.palettes = next.palettes.filter(p => p.id !== pid); next.layers.forEach(l => { if (l.shared.palette === pid) l.shared.palette = 'signal'; }); for (const ks of Object.values(next.keys)) ks.forEach(k => { if (k.v === pid) k.v = 'signal'; }); commit(next, 'Brand palette deleted'); }
    if (id === 'clearBrand') { brandLib = []; store.set('motif-style-lab-2-brand', brandLib); renderColourPanel(); }
  });
  function applyValueOn(pr, path, v) { const saved = project; project = pr; const r = applyValue(path, v); project = saved; return r; }
  pc.addEventListener('input', e => {
    const s = e.target.dataset && e.target.dataset.slot;
    if (s) { const hex = C.normHex(e.target.value); editPalette(p => C.fromSlots({ ...C.slotsOf(p), [s]: hex }, { id: p.id, name: p.name, locks: p.locks }), null, true); const t = pc.querySelector(`[data-hex="${s}"]`); if (t) t.value = hex; }
  });
  pc.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.slot) { commit(project); renderColourPanel(); return; }
    if (t.dataset.hex) { if (!C.validHex(t.value)) { toast('Use a six-digit hex colour, like #2B44E0'); renderColourPanel(); return; } const s = t.dataset.hex, hex = C.normHex(t.value); editPalette(p => C.fromSlots({ ...C.slotsOf(p), [s]: hex }, { id: p.id, name: p.name, locks: p.locks }), null); return; } // token-lint-ignore (copy example)
    if (t.id === 'palName') { editPalette(p => ({ ...p, name: t.value.slice(0, 40) || p.name }), null); return; }
    if (t.id === 'legalSw') { const next = clone(project); next.output.broadcastSafe = t.checked; commit(next, t.checked ? 'Broadcast-safe limiter on' : 'Limiter off'); return; }
    if (t.id === 'zebraSw') { zebra = t.checked; stage.invalidate(); }
  });
  $('imgFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const bmp = await createImageBitmap(f); const S = Math.min(1, 320 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * S)); c.height = Math.max(1, Math.round(bmp.height * S));
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, c.width, c.height);
      const img = x.getImageData(0, 0, c.width, c.height); const rng = T.mulberry32(img.data.length);
      editPalette(p => ({ ...C.extractPalette(img, p, p.locks, rng), name: p.name.endsWith('brand') ? f.name.replace(/\.[^.]+$/, '').slice(0, 30) : p.name }), `Palette extracted from ${f.name}${curPalette().locks && curPalette().locks.length ? ' (locked colours kept)' : ''}`);
    } catch (err) { toast(`Couldn’t read that image: ${err.message || err}`); }
  });

  // Finish
  function renderFinishPanel() {
    const F = k => rowHtml(`F:${k}`);
    const fin = project.finish;
    $('panel-finish').innerHTML = `
      <div class="panel-head"><div class="lbl">Whole frame</div><h1>Finish</h1>${pipeline.finisher.ok ? '' : '<p>WebGL2 is unavailable: only grain and vignette apply.</p>'}</div>
      ${group('time', 'Loop', F('loop') + (project.audio && project.audio.snap ? `<p class="info">Follows Audio: ${project.audio.bars} bar${project.audio.bars > 1 ? 's' : ''} at ${project.audio.bpm} BPM</p>` : ''))}
      ${group('blur', 'Motion blur', F('shutter') + `<div class="btnrow">${[0, 90, 180, 270, 360].map(a => `<button class="btn sm" data-shutter="${a}" aria-pressed="${fin.shutter === a}">${a ? a + '°' : 'Off'}</button>`).join('')}</div>` + F('samples') + `<p class="info">Preview: up to ${$('quality').value === 'high' ? 8 : 4} samples playing, all ${fin.samples} paused. Export uses ${fin.samples}.</p>`)}
      ${group('glow', 'Glow', F('glow') + F('glowThreshold') + F('glowRadius'))}
      ${group('lens', 'Lens', F('chroma') + F('depth') + F('depthMode') + F('focus') + '<p class="info">Depth is estimated from position or brightness.</p>')}
      ${group('grade', 'Grade', F('black') + F('white') + F('gamma') + F('gmap') + F('gmapMode'))}
      ${group('texture', 'Texture', F('grain') + F('vignette'))}`;
  }
  $('panel-finish').addEventListener('click', e => { const b = e.target.closest('[data-shutter]'); if (b) commit(applyValue('F:shutter', Number(b.dataset.shutter)), Number(b.dataset.shutter) ? `Shutter ${b.dataset.shutter}°` : 'Motion blur off'); });

  // Audio
  let tapTimes = [];
  function renderAudioPanel() {
    const au = project.audio, has = !!player.buffer;
    const bars = au ? au.bars : 4, bpm = au ? au.bpm : 120;
    const maps = au ? au.maps : [];
    const targets = T.allPaths(project, true); const groups = [...new Set(targets.map(t => t.group))];
    const targetSel = (m) => `<select data-mapf="path" data-map="${m.id}" aria-label="Target parameter">${groups.map(g => `<optgroup label="${esc(g)}">${targets.filter(t => t.group === g).map(t => `<option value="${t.path}"${t.path === m.path ? ' selected' : ''}>${esc(t.label)}</option>`).join('')}</optgroup>`).join('')}</select>`;
    const bandSel = (m) => `<select data-mapf="band" data-map="${m.id}" aria-label="Audio band">${T.BANDS.map(b => `<option value="${b.id}"${b.id === m.band ? ' selected' : ''}>${b.l}</option>`).join('')}</select>`;
    const mapRows = maps.map(m => `<div class="map">${bandSel(m)}${targetSel(m)}<button class="ib" data-unmap="${m.id}" aria-label="Remove mapping" style="opacity:1">✕</button>
      <div class="full"><span>Amount</span><input type="range" min="-1" max="1" step="0.01" value="${m.amount}" data-mapf="amount" data-map="${m.id}" aria-label="Amount"><output class="readout">${m.amount.toFixed(2)}</output></div>
      <div class="full"><span>Smooth</span><input type="range" min="0" max="1" step="0.01" value="${m.smooth}" data-mapf="smooth" data-map="${m.id}" aria-label="Smoothing"><output class="readout">${Math.round(m.smooth * 600)} ms</output></div></div>`).join('');
    $('panel-audio').innerHTML = `
      <div class="panel-head"><div class="lbl">Sync</div><h1>Audio</h1><p>Load a track to sync the loop and drive values.</p>${audioMetaHtml()}</div>
      ${group('track', 'Track', `<div class="btnrow"><button class="btn sm${has ? '' : ' primary'}" id="loadAudio">${has ? 'Replace track…' : 'Load track…'}</button>${has ? `<button class="btn sm" id="audioPlay">${player.playing ? 'Stop' : 'Play from loop start'}</button>` : ''}</div>
        <p class="info" id="audioStatus">${has ? `<b>${esc(trackName)}</b> · ${player.buffer.duration.toFixed(1)} s${analysis ? ` · detected ${analysis.bpm} BPM (confidence ${(analysis.confidence * 100).toFixed(0)}%)` : ''}` : au && au.name ? `Built with <b>${esc(au.name)}</b>. Load it again to hear it.` : 'MP3, WAV, AAC, OGG or FLAC · stays in your browser'}</p>
        ${has ? `<canvas class="wave" id="wave" width="600" height="64" aria-label="Waveform: drag to set where the loop starts"></canvas><div class="row"><span class="rl">Loop starts at</span><span></span><span></span><output class="val">${(au ? au.offset : 0).toFixed(2)} s</output></div>
        <div class="toggles"><label><span>Play audio with the transport</span><input type="checkbox" class="switch" role="switch" id="audioSync"${audioSync ? ' checked' : ''}></label></div>
        <div class="row"><label for="vol">Volume</label><span></span><span></span><span></span><input type="range" id="vol" min="0" max="1" step="0.01" value="0.8"></div>` : ''}`)}
      ${group('tempo', 'Tempo and bars', `<div class="row"><label for="bpmIn">BPM</label><span></span><span></span><span></span><input type="number" id="bpmIn" min="40" max="240" step="0.1" value="${bpm}" style="grid-column:1/-1;grid-row:2;min-height:var(--target);background:var(--surface-0);padding:0 var(--space-2);font-family:var(--font-mono)"></div>
        <div class="btnrow"><button class="btn sm" id="bpmHalf">÷2</button><button class="btn sm" id="bpmDouble">×2</button><button class="btn sm" id="tapBtn">Tap</button>${analysis ? '<button class="btn sm" id="alignBtn">Align start to downbeat</button>' : ''}</div>
        <div class="subhead"><span>Loop length in bars (4/4)</span></div>
        <div class="seg" role="radiogroup" aria-label="Bars" id="barsSeg">${[1, 2, 4, 8].map(b => `<button role="radio" data-bars="${b}" aria-checked="${bars === b}">${b}</button>`).join('')}</div>
        <div class="toggles"><label><span>Snap loop to bars (${A.barsToSeconds(bpm, bars).toFixed(2)} s)</span><input type="checkbox" class="switch" role="switch" id="snapSw"${au && au.snap ? ' checked' : ''}></label></div>`)}
      ${group('maps', 'Band mappings', `<div class="meters" id="meters" aria-hidden="true">${A.BAND_IDS.map(() => '<i></i>').join('')}</div><div class="meter-l" aria-hidden="true"><span>sub</span><span>bass</span><span>lo-m</span><span>mid</span><span>hi-m</span><span>high</span><span>lvl</span><span>ons</span></div>
        <div class="maps">${mapRows || '<p class="info">Map a band to any value, e.g. bass → Burst.</p>'}</div><button class="btn sm" id="addMap"${maps.length >= 16 ? ' disabled' : ''}>+ Add mapping</button>`, maps.length ? ` <span class="count">${maps.length}</span>` : '')}
      ${group('live', 'Live input', `<div class="toggles"><label><span>Microphone or line in</span><input type="checkbox" class="switch" role="switch" id="liveSw"${liveOn ? ' checked' : ''}></label></div><p class="info">Preview only. Exports use the loaded track.</p>`)}`;
    drawWave();
  }
  function ensureAudio(next) { if (!next.audio) next.audio = { bpm: analysis ? analysis.bpm : 120, bars: 4, offset: analysis ? analysis.beatOffset : 0, snap: true, name: trackName, maps: [] }; return next.audio; }
  function snapLoop(next) { const au = next.audio; if (au && au.snap) next.finish.loop = clamp(A.barsToSeconds(au.bpm, au.bars), 1, 32); return next; }
  function drawWave() {
    const c = $('wave'); if (!c || !analysis) return; const x = c.getContext('2d'), W = c.width, H = c.height, pk = analysis.peaks, dur = analysis.duration;
    const cs = getComputedStyle(document.documentElement);
    x.clearRect(0, 0, W, H); x.fillStyle = cs.getPropertyValue('--line-strong'); // chrome colours come from tokens
    for (let i = 0; i < W; i++) { const v = pk[Math.floor((i / W) * pk.length)] * H * 0.9; x.fillRect(i, (H - v) / 2, 1, Math.max(1, v)); }
    const au = project.audio; if (!au) return; const L = project.finish.loop;
    x.fillStyle = cs.getPropertyValue('--accent-soft'); x.fillRect((au.offset / dur) * W, 0, (L / dur) * W, H);
    x.fillStyle = cs.getPropertyValue('--accent'); x.fillRect((au.offset / dur) * W, 0, 2, H);
    const beat = 60 / au.bpm; x.fillStyle = cs.getPropertyValue('--text-muted');
    for (let b = au.offset; b < au.offset + L; b += beat) x.fillRect((b / dur) * W, H - 6, 1, 6);
  }
  function syncAudioRegion() { if (player.buffer && project.audio) player.setRegion(project.audio.offset, project.finish.loop); updateBpmChip(); }
  // Tempo, bars and loop length live in the Audio tab (they used to sit in the header).
  function audioMetaHtml() {
    const au = project.audio; if (!au) return '<dl class="ameta" id="audMeta" hidden></dl>';
    const items = [[au.bpm, 'BPM', 1], [au.bars, au.bars > 1 ? 'bars' : 'bar'], [project.finish.loop.toFixed(2) + ' s', 'loop']];
    if (player.buffer) items.push([player.buffer.duration.toFixed(1) + ' s', 'track']);
    if (analysis) items.push([Math.round(analysis.confidence * 100) + '%', 'confidence']);
    return `<dl class="ameta" id="audMeta">${items.map(([v, l, hot]) => `<div${hot ? ' class="hot"' : ''}><dd>${esc(String(v))}</dd><dt>${l}</dt></div>`).join('')}</dl>`;
  }
  function updateBpmChip() { const m = $('audMeta'); if (m) m.outerHTML = audioMetaHtml(); }
  function updateMeters(t) {
    const m = $('meters'); if (!m) return; const env = currentEnv(); const at = (project.audio ? project.audio.offset : 0) + t;
    m.querySelectorAll('i').forEach((el, i) => { const v = env ? env(A.BAND_IDS[i], at, 0) : 0; el.style.setProperty('--v', (v || 0).toFixed(3)); });
  }
  async function loadAudio(arrayBuf, name) {
    const st = $('audioStatus'); if (st) st.textContent = 'Decoding…';
    try {
      const buf = await player.decode(arrayBuf); trackName = name;
      const an = await A.analyse(buf, (f, msg) => { const s = $('audioStatus'); if (s) s.textContent = `${msg || 'Analysing bands'} · ${Math.round(f * 100)}%`; });
      analysis = an; envFn = A.makeEnv(an);
      const next = clone(project); const had = !!next.audio; const au = ensureAudio(next);
      au.name = name; au.bpm = an.bpm; au.offset = an.beatOffset; au.snap = true;
      if (!had) { const L = next.finish.loop; au.bars = [1, 2, 4, 8].reduce((b, x) => (Math.abs(A.barsToSeconds(an.bpm, x) - L) < Math.abs(A.barsToSeconds(an.bpm, b) - L) ? x : b), 4); }
      if (!au.maps.length) { const l = T.layerById(next, next.active); const k = Object.entries(getStyle(l.styleId).params).find(([, s]) => s.type === 'range'); if (k) au.maps.push({ id: 'm1', band: 'bass', path: `L:${l.id}:p:${k[0]}`, amount: 0.35, smooth: 0.3 }); }
      snapLoop(next); commit(next, `${name}: ${an.bpm} BPM, loop snapped to ${au.bars} bars`);
      if (!stage.playing) togglePlay(); else if (audioSync) player.start(stage.time);
      renderAudioPanel();
    } catch (e) { const s = $('audioStatus'); if (s) s.textContent = `Couldn’t read that audio file (${e.message || e}).`; toast('Couldn’t read that audio file'); }
  }
  $('audioFile').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; await loadAudio(await f.arrayBuffer(), f.name); });
  const pa = $('panel-audio');
  pa.addEventListener('click', e => {
    const id = e.target.id;
    const um = e.target.closest('[data-unmap]'); if (um) { const next = clone(project); next.audio.maps = next.audio.maps.filter(m => m.id !== um.dataset.unmap); commit(next, 'Mapping removed'); renderAudioPanel(); return; }
    const bb = e.target.closest('[data-bars]'); if (bb) { const next = clone(project); ensureAudio(next).bars = Number(bb.dataset.bars); snapLoop(next); commit(next); renderAudioPanel(); return; }
    if (id === 'loadAudio') $('audioFile').click();
    if (id === 'audioPlay') { if (player.playing) { player.stop(); stage.pause(); setPlayUi(false); } else { stage.seek(0); stage.play(); setPlayUi(true); player.start(0); } renderAudioPanel(); }
    if (id === 'bpmHalf' || id === 'bpmDouble') { const next = clone(project); const au = ensureAudio(next); au.bpm = clamp(Math.round(au.bpm * (id === 'bpmHalf' ? 0.5 : 2) * 10) / 10, 40, 240); snapLoop(next); commit(next, `${au.bpm} BPM`); renderAudioPanel(); }
    if (id === 'tapBtn') { const now = performance.now(); tapTimes = tapTimes.filter(t => now - t < 3000); tapTimes.push(now); if (tapTimes.length >= 3) { const d = (tapTimes[tapTimes.length - 1] - tapTimes[0]) / (tapTimes.length - 1); const next = clone(project); const au = ensureAudio(next); au.bpm = Math.round(60000 / d * 10) / 10; snapLoop(next); commit(next, `Tapped ${au.bpm} BPM`); renderAudioPanel(); } else toast('Keep tapping…'); }
    if (id === 'alignBtn' && analysis) { const next = clone(project); const au = ensureAudio(next); const beat = 60 / au.bpm; au.offset = Math.max(0, analysis.beatOffset + Math.round((au.offset - analysis.beatOffset) / (beat * 4)) * beat * 4); commit(next, `Loop starts on a downbeat at ${au.offset.toFixed(2)} s`); renderAudioPanel(); }
    if (id === 'addMap') { const next = clone(project); const au = ensureAudio(next); const l = T.layerById(next, next.active); const k = Object.entries(getStyle(l.styleId).params).find(([, s]) => s.type === 'range' || s.type === 'int'); au.maps.push({ id: 'm' + Date.now().toString(36), band: ['bass', 'high', 'onset', 'mid', 'level', 'sub'][au.maps.length % 6], path: k ? `L:${l.id}:p:${k[0]}` : 'F:glow', amount: 0.3, smooth: 0.25 }); commit(next, 'Mapping added'); renderAudioPanel(); }
  });
  pa.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.mapf === 'amount' || t.dataset.mapf === 'smooth') { const next = clone(project); const m = next.audio.maps.find(x => x.id === t.dataset.map); m[t.dataset.mapf] = Number(t.value); live(next); const o = t.parentElement.querySelector('output'); if (o) o.textContent = t.dataset.mapf === 'amount' ? Number(t.value).toFixed(2) : `${Math.round(t.value * 600)} ms`; }
    if (t.id === 'vol') player.setVolume(Number(t.value));
  });
  pa.addEventListener('change', async e => {
    const t = e.target;
    if (t.dataset.mapf) { const next = clone(project); const m = next.audio.maps.find(x => x.id === t.dataset.map); m[t.dataset.mapf] = t.dataset.mapf === 'amount' || t.dataset.mapf === 'smooth' ? Number(t.value) : t.value; commit(next); if (t.tagName === 'SELECT') renderAudioPanel(); return; }
    if (t.id === 'bpmIn') { const v = Number(t.value); if (!(v >= 40 && v <= 240)) { toast('Tempo must be 40–240 BPM'); renderAudioPanel(); return; } const next = clone(project); ensureAudio(next).bpm = v; snapLoop(next); commit(next); renderAudioPanel(); }
    if (t.id === 'snapSw') { const next = clone(project); ensureAudio(next).snap = t.checked; snapLoop(next); commit(next, t.checked ? `Loop snapped to ${next.audio.bars} bars` : 'Loop length is free'); renderAudioPanel(); }
    if (t.id === 'audioSync') { audioSync = t.checked; if (!audioSync) player.stop(); else if (stage.playing) player.start(stage.time); }
    if (t.id === 'liveSw') {
      if (t.checked) { try { await player.startLive(); liveOn = true; if (!project.audio) { const next = clone(project); ensureAudio(next); commit(next); } toast('Live input on — preview only'); } catch (err) { t.checked = false; toast(`Live input unavailable: ${err.message || err}`); } }
      else { player.stopLive(); liveOn = false; toast('Live input off'); }
      renderAudioPanel();
    }
  });
  let waveDrag = false;
  function waveSeek(e) { const c = $('wave'); if (!c || !analysis) return; const r = c.getBoundingClientRect(); const f = clamp((e.clientX - r.left) / r.width); const next = clone(project); const au = ensureAudio(next); const beat = 60 / au.bpm; let off = f * analysis.duration; off = Math.max(0, analysis.beatOffset + Math.round((off - analysis.beatOffset) / beat) * beat); au.offset = Math.min(off, Math.max(0, analysis.duration - next.finish.loop)); live(next); syncAudioRegion(); drawWave(); }
  pa.addEventListener('pointerdown', e => { if (e.target.id !== 'wave') return; waveDrag = true; e.target.setPointerCapture(e.pointerId); waveSeek(e); });
  pa.addEventListener('pointermove', e => { if (waveDrag) waveSeek(e); });
  pa.addEventListener('pointerup', () => { if (waveDrag) { waveDrag = false; commit(project, `Loop starts at ${project.audio.offset.toFixed(2)} s`); renderAudioPanel(); } });

  // ---------- key lane ----------
  let laneCollapsed = matchMedia('(max-width: 40em)').matches;
  function laneRows() {
    const order = p => { const x = T.parsePath(p); if (!x) return 99; return x.kind === 'F' ? 50 : project.layers.findIndex(l => l.id === x.layer); };
    const keyed = Object.keys(project.keys).sort((a, b) => order(b) - order(a) || a.localeCompare(b));
    const mapped = project.audio ? [...new Set(project.audio.maps.map(m => m.path))].filter(p => !project.keys[p]) : [];
    return { keyed, mapped };
  }
  function renderLane() { renderLaneHead(); renderLaneRows(); }
  // Timeline | Arrange: one switch, centred in the strip above whichever surface is showing.
  const surfSeg = () => `<div class="seg surf-seg" role="radiogroup" aria-label="Animate or Arrange"><button role="radio" data-surf="timeline" aria-checked="${!arrMode}" data-tip="Animate" data-kbd="K">Animate</button><button role="radio" data-surf="arrange" aria-checked="${arrMode}" data-tip="Arrange" data-kbd="Alt A">Arrange</button></div>`;
  function setSurface(name) {
    if (name === 'arrange') { if (!arrMode) { focusSaved = null; setArrange(true); } return; }
    if (arrMode) { setArrange(false); laneCollapsed = false; focusSaved = null; layoutChanged(); return; }
    if (laneCollapsed) { laneCollapsed = false; focusSaved = null; layoutChanged(); }
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-surf]'); if (b) setSurface(b.dataset.surf); });
  function renderLaneHead() {
    const { keyed } = laneRows(); const n = keyed.reduce((a, p) => a + project.keys[p].length, 0);
    if (selKey && (!project.keys[selKey.path] || !project.keys[selKey.path][selKey.idx])) selKey = null;
    let editor = '';
    if (selKey) {
      const s = T.schemaAt(project, selKey.path), k = project.keys[selKey.path][selKey.idx];
      const valueCtl = (s.type === 'range' || s.type === 'int') ? `<input type="number" id="kVal" value="${+Number(k.v).toFixed(3)}" min="${s.min}" max="${s.max}" step="${s.log ? 1 : s.step}" aria-label="Key value">` : s.dynamic ? `<select id="kVal" aria-label="Key palette">${[...PALETTES, ...project.palettes].map(o => `<option value="${o.id}"${o.id === k.v ? ' selected' : ''}>${esc(o.name)}</option>`).join('')}</select>` : s.type === 'select' ? `<select id="kVal" aria-label="Key value">${s.options.map(o => `<option value="${o.v}"${o.v === k.v ? ' selected' : ''}>${o.l}</option>`).join('')}</select>` : s.type === 'toggle' ? `<select id="kVal" aria-label="Key value"><option value="1"${k.v ? ' selected' : ''}>On</option><option value="0"${!k.v ? ' selected' : ''}>Off</option></select>` : `<span class="readout">${esc(k.v)}</span>`;
      const easeCtl = (s.type === 'range' || s.type === 'int' || s.dynamic) ? `<select id="kEase" aria-label="Ease to next key">${T.EASES.map(o => `<option value="${o.v}"${o.v === k.e ? ' selected' : ''}>${o.l}</option>`).join('')}</select>` : '<span class="readout">Hold</span>';
      editor = `<span class="readout">${esc(T.pathLabel(project, selKey.path))} @ ${(k.u * project.finish.loop).toFixed(2)} s</span>${valueCtl}${easeCtl}<button class="btn sm" id="kDel">Delete key</button>`;
    }
    $('laneHead').innerHTML = `<div class="sh-l"><button class="btn ghost icon" id="laneToggle" aria-expanded="${!laneCollapsed}" aria-controls="laneRows" aria-label="${laneCollapsed ? 'Expand' : 'Collapse'} timeline" data-tip="${laneCollapsed ? 'Expand' : 'Collapse'} timeline" data-kbd="K"><svg class="i" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button><span class="readout">${n ? `${n} key${n > 1 ? 's' : ''}` : 'No keys'}</span></div>${surfSeg()}<div class="sh-r">${editor || '<span class="readout lane-extra">Key any value with ◇</span>'}</div>`;
    $('lane').dataset.collapsed = laneCollapsed; applyLayout(); saveLayout();
  }
  function renderLaneRows() {
    const { keyed, mapped } = laneRows();
    const bandsFor = p => project.audio ? project.audio.maps.filter(x => x.path === p).map(x => x.band).join(', ') : '';
    const rows = keyed.map(p => { const ks = project.keys[p]; const lab = T.pathLabel(project, p); const bands = bandsFor(p); return `<div class="lrow" data-lpath="${p}"><span class="nm" role="button" tabindex="0" title="${esc(lab)}${bands ? ' + audio ' + bands : ''}">${esc(lab)}${bands ? ` <small>∿ ${bands}</small>` : ''}</span><div class="track" data-track="${p}">${ks.map((k, i) => `<button class="kf" style="left:${(k.u * 100).toFixed(3)}%" data-kp="${p}" data-ki="${i}" data-ease="${k.e}" aria-pressed="${!!(selKey && selKey.path === p && selKey.idx === i)}" aria-label="${esc(lab)} key ${i + 1} at ${(k.u * project.finish.loop).toFixed(2)} seconds"></button>`).join('')}</div><button class="ib" data-clear="${p}" aria-label="Remove all keys for ${esc(lab)}" title="Remove all keys">✕</button></div>`; }).join('');
    const maps = mapped.map(p => { const lab = T.pathLabel(project, p); const m = project.audio.maps.filter(x => x.path === p).map(x => x.band).join(', '); return `<div class="lrow"><span class="nm" title="${esc(lab)}">${esc(lab)} <small>∿ ${m}</small></span><div class="track" data-track="${p}" data-env="${p}"><canvas width="300" height="20"></canvas></div><span></span></div>`; }).join('');
    const L = project.finish.loop, stepS = L <= 4 ? 0.5 : L <= 12 ? 1 : L <= 30 ? 2 : 5;
    let ticks = ''; for (let s = 0; s < L - 1e-6; s += stepS) ticks += `<span style="left:${(s / L * 100).toFixed(3)}%">${timecode(s).slice(3)}</span>`;
    const ruler = `<div class="lrow ruler"><span class="nm">${timecode(0).slice(0, 8)}</span><div class="track" data-ruler="1">${ticks}<i class="ph"></i></div><span></span></div>`;
    const clipCols = ['var(--clip-1)', 'var(--clip-2)', 'var(--clip-3)', 'var(--clip-4)'];
    const vts = project.layers.map((l, i) => ({ l, i })).reverse().map(({ l, i }) => { const st = getStyle(l.styleId); return `<div class="lrow vt" data-layer="${l.id}" style="--cb:${clipCols[i % 4]}" data-active="${l.id === project.active}" data-hidden="${l.visible === false}"><span class="nm" tabindex="0" role="button" aria-label="Select layer V${i + 1}, ${esc(st.name)}" title="Select layer V${i + 1}"><span class="vid">V${i + 1}</span>${esc(st.name)}</span><div class="track" data-vlayer="${l.id}"><span class="clipbar" style="--cb:${clipCols[i % 4]}">${esc(st.name)}<small>${st.kit ? esc(st.kitName) + ' · GLSL' : esc(l.comp.blend === 'source-over' ? 'Normal' : l.comp.blend)} · ${Math.round(l.comp.opacity * 100)}%</small></span></div><span></span></div>`; }).join('');
    const keysPart = rows + maps || '<p class="lane-empty">Key a value with ◇ to animate it. The last key eases back to the first.</p>';
    $('laneRows').innerHTML = ruler + vts + keysPart;
    drawEnvRows();
  }
  function drawEnvRows() {
    if (!envFn || !project.audio) return; const cs = getComputedStyle(document.documentElement);
    $('laneRows').querySelectorAll('[data-env] canvas').forEach(c => {
      const p = c.parentElement.dataset.env; const ms = project.audio.maps.filter(m => m.path === p); const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.fillStyle = cs.getPropertyValue('--lock');
      for (let i = 0; i < c.width; i++) { let v = 0; for (const m of ms) v = Math.max(v, envFn(m.band, project.audio.offset + (i / c.width) * project.finish.loop, m.smooth) * Math.abs(m.amount) * 2); const hh = Math.min(1, v) * c.height; x.fillRect(i, c.height - hh, 1, hh); }
    });
  }
  let drag = null;
  $('lane').addEventListener('pointerdown', e => {
    const kf = e.target.closest('.kf');
    if (kf) { e.preventDefault(); selKey = { path: kf.dataset.kp, idx: Number(kf.dataset.ki) }; drag = { el: kf, track: kf.parentElement, moved: false, id: e.pointerId }; kf.setPointerCapture(e.pointerId); renderLaneHead(); markSelected(); return; }
    const ph = e.target.closest('.ph'), tr = ph ? ph.closest('.track') : e.target.closest('.track');
    if (tr) {
      const r = tr.getBoundingClientRect(); laneScrub = { left: r.left, width: r.width, id: e.pointerId };
      seekFrac(clamp((e.clientX - r.left) / r.width, 0, 0.9999));
      try { $('lane').setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
      document.body.classList.add('scrubbing');
      if (tr.dataset.vlayer) selectLayer(tr.dataset.vlayer);
      if (!stage.playing) refreshRowsOnly();
    }
  });
  let laneScrub = null;
  const laneScrubEnd = e => { if (!laneScrub || (e && e.pointerId !== laneScrub.id)) return; laneScrub = null; document.body.classList.remove('scrubbing'); };
  $('lane').addEventListener('pointerup', laneScrubEnd); $('lane').addEventListener('pointercancel', laneScrubEnd);
  $('lane').addEventListener('pointermove', e => {
    if (laneScrub) { seekFrac(clamp((e.clientX - laneScrub.left) / laneScrub.width, 0, 0.9999)); if (!stage.playing) refreshRowsOnly(); return; }
    if (!drag) return; const r = drag.track.getBoundingClientRect(); let u = clamp((e.clientX - r.left) / r.width, 0, 0.99999);
    const fr = 1 / (project.finish.loop * project.output.fps); if (!e.shiftKey) u = Math.round(u / fr) * fr;
    const res = T.moveKey(project, selKey.path, selKey.idx, u); if (!res.project) return;
    project = res.project; selKey.idx = res.index; drag.moved = true; drag.el.style.left = (u * 100).toFixed(3) + '%'; drag.el.dataset.ki = res.index; stage.invalidate(); renderLaneHead();
  });
  $('lane').addEventListener('pointerup', () => { if (!drag) return; const moved = drag.moved; drag = null; if (moved) commit(project, 'Key moved'); else renderLane(); });
  $('lane').addEventListener('dblclick', e => {
    const tr = e.target.closest('.track'); if (!tr || e.target.closest('.kf') || tr.dataset.env || !tr.dataset.track) return;
    const r = tr.getBoundingClientRect(); const u = clamp((e.clientX - r.left) / r.width, 0, 0.9999); const p = tr.dataset.track;
    const ev = T.evaluate(project, u * project.finish.loop, null); commit(T.setKey(project, p, u, valueFromEval(ev, p)), 'Key added');
  });
  $('lane').addEventListener('click', e => {
    const nm = e.target.closest('.lrow .nm'); if (nm && !nm.closest('.ruler')) { pickLaneLayer(nm.closest('.lrow')); }
    const id = e.target.id;
    if (e.target.closest('#laneToggle')) { laneCollapsed = !laneCollapsed; focusSaved = null; layoutChanged(); return; }
    if (id === 'kDel' && selKey) { commit(T.removeKey(project, selKey.path, selKey.idx), 'Key removed'); selKey = null; renderLane(); return; }
    const cl = e.target.closest('[data-clear]'); if (cl) { commit(T.clearKeys(project, cl.dataset.clear), `${T.pathLabel(project, cl.dataset.clear)} is no longer animated`); }
  });
  $('lane').addEventListener('change', e => {
    if (!selKey) return; const ks = project.keys[selKey.path]; if (!ks) return; const k = ks[selKey.idx]; const s = T.schemaAt(project, selKey.path);
    if (e.target.id === 'kEase') { const next = clone(project); next.keys[selKey.path][selKey.idx].e = e.target.value; commit(next, `Ease: ${e.target.selectedOptions[0].textContent}`); }
    if (e.target.id === 'kVal') { let v = e.target.value; if (s.type === 'range' || s.type === 'int') v = Number(v); if (s.type === 'toggle') v = v === '1'; commit(T.setKey(project, selKey.path, k.u, v, k.e), 'Key value set'); }
  });
  $('lane').addEventListener('keydown', e => {
    const nmk = e.target.closest('.lrow .nm');
    if (nmk && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickLaneLayer(nmk.closest('.lrow')); return; }
    const kf = e.target.closest('.kf'); if (!kf) return;
    const path = kf.dataset.kp, idx = Number(kf.dataset.ki);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selKey = { path, idx }; renderLane(); focusKey(); }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); commit(T.removeKey(project, path, idx), 'Key removed'); selKey = null; }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.altKey) { e.preventDefault(); e.stopPropagation(); const fr = 1 / (project.finish.loop * project.output.fps); const k = project.keys[path][idx]; const res = T.moveKey(project, path, idx, k.u + (e.key === 'ArrowRight' ? fr : -fr) * (e.shiftKey ? 10 : 1)); selKey = { path, idx: res.index }; commit(res.project); focusKey(); }
  });
  function focusKey() { if (!selKey) return; const b = $('laneRows').querySelector(`.kf[data-kp="${selKey.path}"][data-ki="${selKey.idx}"]`); if (b) b.focus(); }
  function markSelected() { $('laneRows').querySelectorAll('.kf').forEach(b => b.setAttribute('aria-pressed', !!(selKey && b.dataset.kp === selKey.path && Number(b.dataset.ki) === selKey.idx))); }
  function refreshRowsOnly() { updateAnimatedRows(stage.time); const root = $('panel-' + tab); if (root) root.querySelectorAll('.kb').forEach(b => { b.dataset.state = keyState(b.dataset.key); }); }

  // ---------- mutate / evolve ----------
  function flash(keys) { const root = $('panel-layer'); for (const k of keys) { const r = root.querySelector(`.row[data-row="${lpath('p', k)}"], .row[data-row="${lpath('s', k)}"]`); if (r) { r.classList.add('flash'); setTimeout(() => r.classList.remove('flash'), 240); } } }
  const lockKeys = () => { const pre = `L:${project.active}:`; return new Set([...locks].filter(p => p.startsWith(pre)).map(p => p.split(':')[3])); };
  let rngSeed = (Date.now() % 100000) + 1; const nextRng = () => T.mulberry32(rngSeed++ * 7919);
  function doMutate() { const r = T.mutateProject(project, project.active, strength, lockKeys(), nextRng(), false); commit(r.project, `Mutated ${r.changed.length} parameters on layer ${project.layers.findIndex(l => l.id === project.active) + 1}`); if (tab === 'layer') flash(r.changed); }
  function doRandom() { const r = T.randomizeProject(project, project.active, lockKeys(), nextRng()); commit(r.project, 'Randomized'); if (tab === 'layer') flash(r.changed); }
  function doReset() { const next = clone(project); const l = T.layerById(next, next.active); l.params = T.newLayer(l.styleId).params; for (const p of Object.keys(next.keys)) if (p.startsWith(`L:${l.id}:p:`)) delete next.keys[p]; commit(next, 'Style parameters reset'); }
  $('mutateBtn').addEventListener('click', doMutate); $('randomBtn').addEventListener('click', doRandom); $('resetBtn').addEventListener('click', doReset);
  $('undoBtn').addEventListener('click', undo); $('redoBtn').addEventListener('click', redo);
  $('strength').addEventListener('input', e => { strength = Number(e.target.value); $('strengthVal').textContent = strength.toFixed(2); $('evoStrength').value = strength; });

  const evoGrid = $('evoGrid');
  function breedChild(rng, colour) {
    const r = T.mutateProject(project, project.active, strength, lockKeys(), rng, false); const next = r.project; const l = T.layerById(next, next.active);
    if (colour && !locks.has(lpath('s', 'palette')) && !project.keys[lpath('s', 'palette')]) {
      const cur = C.paletteById(l.shared.palette, next.palettes);
      if (isCustom(l.shared.palette)) { const np = C.mutatePalette(cur, cur.locks, strength, rng); const cp = C.sanitizeCustom({ ...np, id: undefined, name: `${cur.name.replace(/ var$/, '')} var` }); next.palettes.push(cp); l.shared.palette = cp.id; }
      else { const opts = PALETTES.filter(p => p.id !== cur.id); l.shared.palette = opts[Math.floor(rng() * opts.length)].id; }
    }
    return next;
  }
  function breed() {
    round++; $('evolveTitle').textContent = `Evolve · round ${round}`;
    const colour = $('evoColour').checked; children = Array.from({ length: 6 }, () => breedChild(nextRng(), colour));
    const pl = curPalette(); $('evoHint').textContent = `Layer ${project.layers.findIndex(l => l.id === project.active) + 1}${colour && isCustom(active().shared.palette) ? ` · varying ${pl.name}${pl.locks.length ? ', locked colours kept' : ''}` : ''} · pick one · 1–6 · Esc`;
    evoGrid.innerHTML = children.map((c, i) => `<button class="child" data-i="${i}" aria-label="Keep variation ${i + 1}"><canvas></canvas><span>${i + 1}</span></button>`).join('');
    layoutChildren(); drawChildren(stage.time);
  }
  function layoutChildren() { const ar = exportSize(aspect, 720); const cols = matchMedia('(max-width: 40em)').matches ? 2 : 3; const cw = Math.max(80, Math.floor($('stageHost').clientWidth / cols) - 16); evoGrid.querySelectorAll('canvas').forEach(c => { c.width = Math.min(cw, 360); c.height = Math.round(c.width * ar.h / ar.w); }); }
  function drawChildren(t) { evoGrid.querySelectorAll('canvas').forEach((c, i) => { if (children[i]) renderProjectThumb(pipeline, c, children[i], t); }); }
  function openEvolve() { if (evolveOpen) return; lastFocus = document.activeElement; evolveOpen = true; round = 0; $('evolve').hidden = false; breed(); const f = evoGrid.querySelector('.child'); if (f) f.focus(); }
  function closeEvolve() { evolveOpen = false; $('evolve').hidden = true; evoGrid.innerHTML = ''; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function keep(i) {
    if (!children[i]) return; const c = children[i]; closeEvolve();
    const used = new Set([...c.layers.map(l => l.shared.palette), ...Object.values(c.keys).flat().map(k => k.v)]);
    c.palettes = c.palettes.filter(p => !/ var$/.test(p.name) || used.has(p.id));
    commit(c, `Kept variation ${i + 1}`);
  }
  $('evolveBtn').addEventListener('click', openEvolve); $('evoClose').addEventListener('click', closeEvolve); $('evoAgain').addEventListener('click', breed);
  $('evoStrength').addEventListener('input', e => { strength = Number(e.target.value); $('strength').value = strength; $('strengthVal').textContent = strength.toFixed(2); });
  evoGrid.addEventListener('click', e => { const b = e.target.closest('.child'); if (b) keep(Number(b.dataset.i)); });

  // ---------- export ----------
  const FORMATS = [
    { id: 'mp4', name: 'MP4', note: 'H.264 · colour tagged' }, { id: 'webm', name: 'WebM', note: 'VP9 · alpha capable' },
    { id: 'png-seq', name: 'PNG sequence', note: 'ZIP · alpha' }, { id: 'png', name: 'PNG frame', note: 'Current frame' },
    { id: 'json', name: 'Preset JSON', note: 'preset@2 for Motif' },
  ];
  const ex = { format: 'mp4', tier: 1080, loops: 1, transparent: false, withAudio: true, quality: 'high' };
  let caps = null, exAbort = null, exStop = null, lastFile = null, downloadsP = null;
  const getDownloads = () => { if (!downloadsP) downloadsP = (window.claude && window.claude.use) ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null); return downloadsP; };
  getDownloads();
  function fillSelect(el, opts, val) { el.innerHTML = opts.map(o => `<option value="${o.v}"${String(o.v) === String(val) ? ' selected' : ''}>${o.l}</option>`).join(''); }
  function renderFormats() {
    $('formats').innerHTML = FORMATS.map(f => {
      let dis = '';
      if (caps) { if (f.id === 'mp4' && !(caps.webcodecs && caps.muxers && caps.mp4)) dis = 'No H.264 encoder in this browser'; if (f.id === 'webm' && !(caps.webcodecs && caps.muxers && caps.webm)) dis = 'No WebM encoder in this browser'; if (f.id === 'png-seq' && !caps.zip) dis = 'ZIP library unavailable'; }
      return `<button class="fmt" role="radio" data-f="${f.id}" aria-checked="${f.id === ex.format}"${dis ? ` disabled title="${dis}"` : ''}><b>${f.name}</b><small>${dis || f.note}</small></button>`;
    }).join('');
  }
  function exSummary() {
    const { w, h } = exportSize(aspect, ex.tier), fps = project.output.fps, n = arrMode ? Math.max(1, Math.round(arrDuration() * fps)) : frameCount(project, fps, ex.loops);
    const still = ex.format === 'png' || ex.format === 'json', video = ex.format === 'mp4' || ex.format === 'webm';
    const alphaOk = ['webm', 'png', 'png-seq'].includes(ex.format);
    $('exAlpha').disabled = !alphaOk; if (!alphaOk) $('exAlpha').checked = false;
    ['exFps', 'exLoops'].forEach(id => { $(id).disabled = still; }); $('exQuality').disabled = !(ex.format === 'mp4' || ex.format === 'webm'); $('exTier').disabled = ex.format === 'json';
    const cids = ex.format === 'mp4' ? ['avc', 'hevc', 'av1', 'vp9'] : ex.format === 'webm' ? ['vp9', 'av1', 'vp8'] : [], cav = cids.filter(id => caps && caps.codecs && caps.codecs[id]);
    if (!cav.includes(ex.codec)) ex.codec = cav[0] || '';
    $('exCodec').innerHTML = cav.map(id => `<option value="${id}"${id === ex.codec ? ' selected' : ''}>${X.CODECS[id].label}</option>`).join(''); $('exCodec').disabled = !cav.length; $('exQueue').disabled = still;
    $('exAudioRow').hidden = !video; $('exAudio').disabled = !player.buffer; $('exAudio').checked = !!player.buffer && ex.withAudio;
    const f = project.finish; $('exBlur').textContent = f.shutter > 0 ? `${f.shutter}° · ${f.samples} samples` : 'Off';
    const sp = C.spaceById(project.output.space);
    const gpuStyles = project.layers.filter(l => GPU_STYLES.has(l.styleId)).length;
    if (arrMode) { $('exAudioRow').hidden = true; $('exLoops').disabled = true; }
    $('exSummary').textContent = arrMode && ex.format !== 'json' ? `Arrange sequence · ${w} × ${h} px · ${fps} fps · ${n} frames · ${(n / fps).toFixed(2)} s · ${T.ARR_TRACKS} tracks` : ex.format === 'json' ? `preset@2 · ${project.layers.length} layer${project.layers.length > 1 ? 's' : ''}, ${Object.keys(project.keys).length} keyed parameters, palettes, finish${project.audio ? ', audio maps' : ''}` :
      ex.format === 'png' ? `${w} × ${h} px · ${sp.label} · frame at ${stage.time.toFixed(2)} s` :
      `${w} × ${h} px · ${fps} fps · ${n} frames · ${(n / fps).toFixed(2)} s · ${sp.label}${project.output.broadcastSafe ? ' · legal' : ''}${f.shutter > 0 ? ` · ${n * f.samples * project.layers.length} layer renders` : ''}${gpuStyles && gpu.ready ? ' · WebGPU' : ''}${ex.loops === 1 && !(project.audio && project.audio.maps.length && envFn) ? ' · seamless loop' : ''}`;
  }
  function gpuLine() {
    const g = K.gpuStatus(), el = $('exGpu'); if (!el) return;
    const usesKit = project.layers.some(l => l.visible !== false && getStyle(l.styleId).engine === 'glsl');
    if (!g.ok) { el.dataset.state = usesKit ? 'warn' : ''; el.innerHTML = 'WebGL2 unavailable' + (usesKit ? ': kit styles cannot render.' : '.'); return; }
    if (g.software) { el.dataset.state = 'warn'; el.innerHTML = `<b>Software rendering</b> (${esc(g.renderer)}). Kit shaders run on the CPU, so exports take seconds per frame. Enable hardware acceleration in the browser and reload, then use Check speed.`; return; }
    el.dataset.state = ''; el.innerHTML = `GPU <b>${esc(g.renderer || 'unknown')}</b>`;
  }
  // Times one export-size frame per visible layer (plus the finish stack) so you can see what a render will cost.
  async function checkSpeed() {
    const btn = $('exCheck'), out = $('exSpeed'); btn.disabled = true; out.innerHTML = '<span>Measuring…</span>';
    const { w, h } = exportSize(aspect, ex.tier), t = stage.time, fps = project.output.fps, n = frameCount(project, fps, ex.loops);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
    const timeOf = async pr => {
      const run = () => { const t0 = performance.now(); pipeline.renderFrame(x, w, h, pr, t, { env: envFn }); x.getImageData(0, 0, 1, 1); return performance.now() - t0; };
      run(); for (let i = 0; i < 60 && K.runtime.pendingCompiles; i++) await wait(100);
      await wait(0); return Math.min(run(), run());
    };
    try {
      // The real export path: cooperative render, full readback, colour convert, on the export canvas. Two frames at the loop start.
      const xp = { draw: 0, read: 0, conv: 0 }; let xn = 0;
      try {
        const { c: xc, ctx: xctx } = makeExportCanvas(w, h, project.output.space); const sp = spaceById(project.output.space);
        for (let i = 0; i < 3; i++) {
          const T0 = performance.now(); await frameCoop(pipeline, xctx, w, h, project, frameTime(project, fps, i), { env: envFn, space: sp.id }, K.job, null);
          const T1 = performance.now(); const im = xctx.getImageData(0, 0, w, h); const T2 = performance.now(); toI420(im.data, w, h, sp.video.fullRange, false); const T3 = performance.now();
          if (i > 0) { xp.draw += T1 - T0; xp.read += T2 - T1; xp.conv += T3 - T2; xn++; }
        }
        for (const k in xp) xp[k] /= xn || 1;
      } catch (e) { xn = 0; }
      const rows = []; const vis = project.layers.filter(l => l.visible !== false);
      const bare = clone(project); bare.finish = { ...bare.finish, glow: 0, chroma: 0, grain: 0, vignette: 0, gmap: 0, depth: 0, shutter: 0 };
      let total = await timeOf({ ...project, finish: { ...project.finish, shutter: 0 } });
      for (const l of vis) { const pr = clone(bare); pr.layers.forEach(q => { q.visible = q.id === l.id; }); rows.push([getStyle(l.styleId).name, await timeOf(pr)]); }
      const layersSum = rows.reduce((a, r) => a + r[1], 0);
      const shutter = project.finish.shutter > 0 ? project.finish.samples : 1;
      const measured = xn ? xp.draw + xp.read + xp.conv : 0;
      const perFrame = Math.max(total * shutter + 60, measured);
      const fmt = ms => ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
      const top = rows.reduce((a, r) => (r[1] > a ? r[1] : a), 0);
      out.innerHTML = rows.map(r => `<span${r[1] === top && top > 50 ? ' class="hot"' : ''}>${esc(r[0])}</span><b${r[1] === top && top > 50 ? ' class="hot"' : ''}>${fmt(r[1])}</b>`).join('') +
        `<span>Finish stack and compositing</span><b>${fmt(Math.max(0, total - layersSum))}</b>` +
        (shutter > 1 ? `<span>Motion blur × ${shutter} samples</span><b>× ${shutter}</b>` : '') +
        (xn ? `<span>Export path: draw / read / convert</span><b>${fmt(xp.draw)} / ${fmt(xp.read)} / ${fmt(xp.conv)}</b>` : '') +
        `<i class="rule"></i><span class="sum">One frame at ${w}×${h}</span><b class="sum">${fmt(perFrame)}</b>` +
        `<span class="sum">${n} frames</span><b class="sum">about ${perFrame * n / 1000 >= 90 ? Math.round(perFrame * n / 60000) + ' min' : Math.round(perFrame * n / 1000) + ' s'}</b>`;
    } catch (e) { out.innerHTML = `<span>Couldn’t measure: ${esc(e.message || e)}</span>`; }
    btn.disabled = false; stage.invalidate();
  }
  $('exCheck').addEventListener('click', checkSpeed);
  async function openExport() {
    if (!$('exportDlg').open) $('exportDlg').showModal();
    fillSelect($('exAspect'), ASPECTS.map(a => ({ v: a.id, l: a.label })), aspect);
    fillSelect($('exTier'), X.TIERS.map(t => { const s = exportSize(aspect, t); return { v: t, l: `${t === 2160 ? '4K' : t + 'p'} · ${s.w}×${s.h}` }; }), ex.tier);
    fillSelect($('exFps'), X.FPS.map(f => ({ v: f, l: `${f} fps` })), project.output.fps);
    fillSelect($('exSpace'), C.SPACES.map(s => ({ v: s.id, l: s.label })), project.output.space);
    $('exLoops').value = ex.loops; $('exAlpha').checked = ex.transparent; $('exLegal').checked = project.output.broadcastSafe;
    status(''); $('exProgress').hidden = true; $('exSave').hidden = true; $('exRender').disabled = false; $('exSpeed').innerHTML = '';
    gpuLine();
    renderFormats(); exSummary();
    if (!caps) { caps = await X.probeCapabilities(); if (!caps.mp4 && ex.format === 'mp4') ex.format = caps.webm ? 'webm' : 'png-seq'; renderFormats(); exSummary(); }
  }
  $('formats').addEventListener('click', e => { const b = e.target.closest('.fmt'); if (!b || b.disabled) return; ex.format = b.dataset.f; ex.codec = ''; renderFormats(); exSummary(); });
  $('exAspect').addEventListener('change', e => { setAspect(e.target.value); openExport(); });
  $('exTier').addEventListener('change', e => { ex.tier = Number(e.target.value); exSummary(); });
  $('exFps').addEventListener('change', e => { const next = clone(project); next.output.fps = Number(e.target.value); commit(next); exSummary(); });
  $('exLoops').addEventListener('change', e => { ex.loops = Number(e.target.value); exSummary(); });
  $('exQuality').addEventListener('change', e => { ex.quality = e.target.value; });
  $('exCodec').addEventListener('change', e => { ex.codec = e.target.value; });
  $('exQueue').addEventListener('click', async () => {
    const preset = { id: 'quick', name: 'Quick export', format: ex.format, codec: ex.codec, tier: ex.tier, fps: project.output.fps, aspect, quality: ex.quality, transparent: ex.transparent, withAudio: ex.withAudio && !!player.buffer, loops: ex.loops };
    try { await Q.add(clone(project), preset, { aspect, hasAudio: !!player.buffer }); $('exportDlg').close(); toast('Added to the render queue'); setTab('deliver'); } catch (e) { status(e && e.message ? e.message : 'Could not add to the queue.', true); }
  });
  $('exSpace').addEventListener('change', e => { const next = clone(project); next.output.space = e.target.value; commit(next); stage.setSpace(project.output.space); exSummary(); });
  $('exLegal').addEventListener('change', e => { const next = clone(project); next.output.broadcastSafe = e.target.checked; commit(next); exSummary(); });
  $('exAlpha').addEventListener('change', e => { ex.transparent = e.target.checked; });
  $('exAudio').addEventListener('change', e => { ex.withAudio = e.target.checked; });
  function status(msg, err) { $('exStatus').textContent = msg; $('exStatus').className = 'status' + (err ? ' err' : ''); }
  async function offer() {
    if (!lastFile) return; const dl = await getDownloads(); const extra = [lastFile.audioCodec ? `Audio: ${lastFile.audioCodec}.` : (lastFile.audio === false && ex.withAudio ? 'No audio track.' : ''), lastFile.stats ? `Rendered at ${lastFile.stats.fps} frames/s.` : '', lastFile.note, lastFile.colorTag ? `Colour tag: ${lastFile.colorTag}.` : ''].filter(Boolean).join(' ');
    if (dl) {
      try { await dl.save({ filename: lastFile.filename, data: lastFile.blob }); status(`Saved ${lastFile.filename}. ${extra}`); $('exSave').hidden = true; }
      catch (e) { const code = e && e.code; if (code === 'declined') status('Save cancelled. The render is still here if you want to try again.'); else if (code === 'too_large') status('That file is too large to save here. Try a smaller size or fewer loops.', true); else if (code === 'rate_limited') status('A save prompt is already open. Try again in a moment.'); else status('Saving files isn’t available in this view.', true); $('exSave').hidden = false; }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(lastFile.blob); a.download = lastFile.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000); status(`Saved ${lastFile.filename}. ${extra}`); $('exSave').hidden = false;
    }
  }
  $('exSave').addEventListener('click', offer);
  const exportCtx = () => ({ pipeline, env: envFn, job: K.job, media, audio: player.buffer ? { buffer: player.buffer, offset: project.audio ? project.audio.offset : 0 } : null });
  // Render queue host: background jobs run through the same exportCtx; the viewer is held (no drawing) while one renders so the pipeline is never shared.
  const Q = __m_render_queue.getQueue();
  Q.setProvider({
    context: () => exportCtx(),
    begin: () => { stage.pause(); if (stage.hold) stage.hold(true); media.pauseAll(); if (player.playing) player.stop(); app.dataset.rendering = '1'; },
    end: () => { delete app.dataset.rendering; if (stage.hold) stage.hold(false); stage.setSpace(project.output.space); pipeline.finisher.setSpace(project.output.space); stage.invalidate(); },
  });
  Q.init();
  $('exRender').addEventListener('click', async () => {
    const unlock = Q.lock(); if (!unlock) { status('The render queue is rendering. Pause or cancel that job first, or add this export to the queue.', true); return; }
    exAbort = new AbortController(); $('exRender').disabled = true; $('exSave').hidden = true; $('exProgress').hidden = false; $('exProgress').value = 0; status('Preparing…');
    $('exCancel').textContent = 'Stop render'; $('exCancel').classList.add('danger');
    const t0 = performance.now(); let msg = 'Preparing…', frac = 0, stopping = false;
    const clock = s => { s = Math.max(0, Math.round(s)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m` : s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
    const paint = () => { if (stopping) return; const el = (performance.now() - t0) / 1000; status(`${msg} · ${clock(el)} elapsed${frac > 0 ? ` · about ${clock(el * (1 - frac) / frac)} left` : ''}`); };
    const ticker = setInterval(paint, 500);
    exStop = () => { if (!exAbort || stopping) return; stopping = true; exAbort.abort(); $('exCancel').disabled = true; $('exCancel').textContent = 'Stopping…'; status('Stopping…'); };
    const wasPlaying = stage.playing; stage.pause(); media.pauseAll(); if (player.playing) player.stop();
    try {
      lastFile = await X.runExport(clone(project), { ...ex, withAudio: !arrMode && ex.withAudio && !!player.buffer, loops: arrMode ? 1 : ex.loops, arrange: arrMode ? arrangeSource() : null, aspect, fps: project.output.fps, time: stage.time }, { ...exportCtx(), signal: exAbort.signal, onProgress: (f, m) => { frac = f; msg = m; $('exProgress').value = f; paint(); } });
      $('exProgress').value = 1; status(`Rendered ${lastFile.filename} (${(lastFile.blob.size / 1048576).toFixed(1)} MB${lastFile.stats ? ` · ${lastFile.stats.fps} frames/s render + encode` : ''})`);
      await offer();
    } catch (e) { if (e && e.name === 'AbortError') status('Export cancelled.'); else { console.error(e); status(e && e.message ? e.message : 'Export failed.', true); } }
    finally { unlock(); clearInterval(ticker); exStop = null; exAbort = null; $('exCancel').disabled = false; $('exCancel').textContent = 'Cancel'; $('exCancel').classList.remove('danger'); $('exRender').disabled = false; stage.setSpace(project.output.space); pipeline.finisher.setSpace(project.output.space); if (wasPlaying) { stage.play(); if (player.buffer && audioSync) player.start(stage.time); } else stage.invalidate(); }
  });
  function closeExport() { if (exStop) { exStop(); return; } $('exportDlg').close(); }
  $('exCancel').addEventListener('click', closeExport); $('exportClose').addEventListener('click', closeExport);
  $('exportDlg').addEventListener('cancel', e => { if (exStop) { e.preventDefault(); exStop(); } });
  $('exportBtn').addEventListener('click', openExport);
  $('keysBtn').addEventListener('click', () => $('keysDlg').showModal());
  $('keysClose').addEventListener('click', () => $('keysDlg').close());

  // ---------- toast ----------
  let toastT = 0;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600); }

  // ---------- keyboard ----------
  document.addEventListener('keydown', e => {
    const tg = e.target, tag = tg.tagName;
    const typing = (tag === 'INPUT' && ['text', 'search', 'number'].includes(tg.type)) || tag === 'TEXTAREA' || tag === 'SELECT';
    if (document.querySelector('dialog[open]')) return;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (typing || mod || e.altKey) return;
    if (evolveOpen) { if (e.key === 'Escape') { e.preventDefault(); closeEvolve(); return; } if (/^[1-6]$/.test(e.key)) { e.preventDefault(); keep(Number(e.key) - 1); return; } }
    if (tg.closest && tg.closest('.kf')) return;
    if (arrMode && arrKey(e)) return;
    const onRange = tag === 'INPUT' && tg.type === 'range';
    switch (e.key) {
      case ' ': if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'LI' || (tg.getAttribute && tg.getAttribute('role') === 'button')) return; e.preventDefault(); togglePlay(); break;
      case 'ArrowLeft': case 'ArrowRight': if (onRange || tg.closest('.layer') || tg.closest('[role=tablist]')) return; e.preventDefault(); if (stage.playing) togglePlay(); stage.step((e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1), project.output.fps); refreshRowsOnly(); break;
      case 'Home': e.preventDefault(); seekFrac(0); if (!stage.playing) refreshRowsOnly(); break;
      case '[': stepStyle(-1); break;
      case ']': stepStyle(1); break;
      case 'm': case 'M': doMutate(); break;
      case 'e': case 'E': evolveOpen ? closeEvolve() : openEvolve(); break;
      case 'r': case 'R': doRandom(); break;
      case 's': case 'S': saveLook(); break;
      case 'g': case 'G': if (e.shiftKey) setGrid(!gridOn); else toggleGuides(); break;
      case 'k': case 'K': togLane(); break;
      case ',': jumpKey(-1); break;
      case '.': jumpKey(1); break;
      case 'v': case 'V': setMoveTool(!moveTool); break;
      case 'x': case 'X': openExport(); break;
      case 'Delete': case 'Backspace': if (selKey) { e.preventDefault(); commit(T.removeKey(project, selKey.path, selKey.idx), 'Key removed'); selKey = null; } break;
      case 'l': case 'L': togLib(); break;
      case 'i': case 'I': togInsp(); break;
      case 'f': case 'F': toggleFocus(); break;
      case 'a': case 'A': addLayer(); break;
      case 'd': case 'D': dupLayer(); break;
      case '/': e.preventDefault(); focusSearch(); break;
      case '-': case '_': nudgeStrength(-0.05); break;
      case '=': case '+': nudgeStrength(0.05); break;
      case '?': $('keysDlg').showModal(); break;
      default: if (/^[1-6]$/.test(e.key) && !evolveOpen) setAspect(ASPECTS[Number(e.key) - 1].id);
    }
  });
  $('libList').addEventListener('keydown', e => { if (/^Arrow(Down|Up|Left|Right)$/.test(e.key)) { e.preventDefault(); stepStyle(e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1); } });
  $('libList').tabIndex = 0;

  // =====================================================================
  // Motif 5 flow layer: layout manager, hover audition, command palette,
  // scrub-able labels, filled sliders. UI state only; project changes still go through commit().
  // =====================================================================
  const mqTablet = matchMedia('(min-width: 48em)');
  const IS_MAC = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
  $('cmdBtn').dataset.kbd = IS_MAC ? '⌘K' : 'Ctrl K'; $('coachK').textContent = IS_MAC ? '⌘K' : 'Ctrl K';
  if (!IS_MAC) { $('saveBtn').dataset.kbd = 'Ctrl S'; $('loadBtn').dataset.kbd = 'Ctrl O'; $('undoBtn').dataset.kbd = 'Ctrl Z'; $('redoBtn').dataset.kbd = 'Ctrl ⇧Z'; $('newBtn').dataset.kbd = 'Alt N'; }

  // ---- layout manager: sizes, collapse, presets, focus ----
  const LAYOUT_KEY = 'motif5-layout';
  const savedLay = store.get(LAYOUT_KEY) || {};
  const LAY = { lib: savedLay.lib || null, insp: savedLay.insp || null, lane: savedLay.lane || null, libOff: !!savedLay.libOff, inspOff: !!savedLay.inspOff, tall: !!savedLay.tall };
  if (typeof savedLay.laneCollapsed === 'boolean' && mqTablet.matches) laneCollapsed = savedLay.laneCollapsed;
  if (LAY.libOff && LAY.inspOff && savedLay.laneCollapsed === true) { LAY.libOff = false; LAY.inspOff = false; laneCollapsed = false; } // Focus never persists across reloads
  let lastLayoutJson = '', focusSaved = null;
  const ARR_MIN = 280, LANE_MIN = 112;
  const PRESETS = {
    explore: { libOff: false, inspOff: true, lane: false },
    build: { libOff: false, inspOff: false, lane: true },
    time: { libOff: true, inspOff: false, lane: true, tall: true },
    focus: { libOff: true, inspOff: true, lane: false },
  };
  function layoutName() {
    if (arrMode) return '';
    for (const [n, p] of Object.entries(PRESETS)) if (p.libOff === LAY.libOff && p.inspOff === LAY.inspOff && p.lane === !laneCollapsed) return n;
    return '';
  }
  function applyLayout() {
    const desk = mqDesktop.matches;
    const set = (k, v) => { if (v == null) app.style.removeProperty(k); else app.style.setProperty(k, v); };
    app.dataset.lib = LAY.libOff ? 'off' : 'on'; app.dataset.insp = LAY.inspOff ? 'off' : 'on';
    if (desk) {
      set('--lib-w', LAY.libOff ? '0px' : LAY.lib ? LAY.lib + 'px' : null);
      set('--insp-w', LAY.inspOff ? '0px' : LAY.insp ? LAY.insp + 'px' : null);
      const foc = layoutName() === 'focus'; app.dataset.focus = foc ? '1' : '';
      set('--lane-h', foc ? '0px' : !arrMode && laneCollapsed ? '40px' : LAY.tall ? Math.max(LAY.lane || 0, 336) + 'px' : LAY.lane ? Math.max(LAY.lane, ARR_MIN) + 'px' : null); // Animate and Arrange share one height, so the switch between them stays put
    } else { set('--lib-w'); set('--insp-w'); set('--lane-h'); }
    $('togLib').setAttribute('aria-pressed', !LAY.libOff); $('togInsp').setAttribute('aria-pressed', !LAY.inspOff); $('togLane').setAttribute('aria-pressed', !laneCollapsed || arrMode);
    const cur = layoutName();
    $('layouts').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.l === cur));
  }
  function saveLayout() {
    const j = JSON.stringify({ lib: LAY.lib, insp: LAY.insp, lane: LAY.lane, libOff: LAY.libOff, inspOff: LAY.inspOff, tall: LAY.tall, laneCollapsed });
    if (j !== lastLayoutJson) { lastLayoutJson = j; store.set(LAYOUT_KEY, JSON.parse(j)); }
  }
  // Layout changes only touch the strip and the grid; the rows underneath are already current.
  let layoutRaf = 0;
  function layoutChanged() { $('lane').dataset.collapsed = laneCollapsed; applyLayout(); if (layoutRaf) return; layoutRaf = requestAnimationFrame(() => { layoutRaf = 0; renderLaneHead(); }); } // renderLaneHead applies + saves
  function togLib() { if (!mqDesktop.matches) { setTab('library'); return; } LAY.libOff = !LAY.libOff; focusSaved = null; applyLayout(); saveLayout(); }
  function togInsp() { if (!mqDesktop.matches) return; LAY.inspOff = !LAY.inspOff; focusSaved = null; applyLayout(); saveLayout(); }
  function togLane() { if (arrMode) { setArrange(false); laneCollapsed = false; focusSaved = null; layoutChanged(); return; } laneCollapsed = !laneCollapsed; focusSaved = null; layoutChanged(); }
  function setLayout(name) {
    const p = PRESETS[name]; if (!p || !mqDesktop.matches) return;
    if (arrMode) setArrange(false);
    LAY.libOff = p.libOff; LAY.inspOff = p.inspOff; laneCollapsed = !p.lane; LAY.tall = !!p.tall; focusSaved = null; layoutChanged();
  }
  function toggleFocus() {
    if (!mqDesktop.matches) return;
    if (arrMode) setArrange(false);
    if (layoutName() === 'focus') {
      const s = focusSaved || PRESETS.build; LAY.libOff = s.libOff; LAY.inspOff = s.inspOff; laneCollapsed = focusSaved ? focusSaved.laneCollapsed : !PRESETS.build.lane; focusSaved = null;
    } else { focusSaved = { libOff: LAY.libOff, inspOff: LAY.inspOff, laneCollapsed }; LAY.libOff = true; LAY.inspOff = true; laneCollapsed = true; }
    layoutChanged();
  }
  function focusSearch() {
    if (!mqDesktop.matches) setTab('library'); else if (LAY.libOff) { LAY.libOff = false; applyLayout(); saveLayout(); }
    $('search').focus(); $('search').select();
  }
  $('togLib').addEventListener('click', togLib); $('togInsp').addEventListener('click', togInsp); $('togLane').addEventListener('click', togLane);
  $('layouts').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLayout(b.dataset.l); });
  mqDesktop.addEventListener('change', applyLayout); mqTablet.addEventListener('change', applyLayout);

  // splitters: drag, arrow keys, double-click to reset, drag well past the minimum to collapse.
  // Sizes come from the pointer's distance since press (never from the live layout), so the handle cannot drift,
  // and updates are batched to one per frame.
  document.querySelectorAll('.split').forEach(h => {
    const kind = h.dataset.split; let d = null, raf = 0, pending = null;
    const size = () => kind === 'lib' ? $('panel-library').getBoundingClientRect().width : kind === 'insp' ? $('insp').getBoundingClientRect().width : (arrMode ? $('arrange') : $('lane')).getBoundingClientRect().height;
    const laneMin = () => (arrMode ? ARR_MIN : LANE_MIN);
    const put = raw => {
      if (kind === 'lib') { LAY.libOff = raw < 120; if (!LAY.libOff) LAY.lib = Math.round(clamp(raw, 216, 520)); }
      else if (kind === 'insp') { LAY.inspOff = raw < 160; if (!LAY.inspOff) LAY.insp = Math.round(clamp(raw, 296, 600)); }
      else { LAY.lane = Math.round(clamp(raw, laneMin(), Math.max(laneMin() + 48, innerHeight * 0.62))); LAY.tall = false; }
      focusSaved = null; applyLayout();
    };
    const flush = () => { raf = 0; if (pending != null) { const v = pending; pending = null; put(v); } };
    const want = e => (kind === 'lib' ? d.s + e.clientX - d.x : kind === 'insp' ? d.s - (e.clientX - d.x) : d.s - (e.clientY - d.y));
    h.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return; e.preventDefault();
      try { h.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
      d = { id: e.pointerId, x: e.clientX, y: e.clientY, s: size() }; h.classList.add('on'); app.dataset.drag = kind === 'lane' ? 'row' : 'col';
    });
    h.addEventListener('pointermove', e => { if (!d || e.pointerId !== d.id) return; pending = want(e); if (!raf) raf = requestAnimationFrame(flush); });
    const end = e => {
      if (!d || (e && e.pointerId !== d.id)) return; if (raf) { cancelAnimationFrame(raf); flush(); }
      d = null; h.classList.remove('on'); delete app.dataset.drag; saveLayout(); stage.invalidate();
    };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end); h.addEventListener('lostpointercapture', end);
    h.addEventListener('dblclick', () => { if (kind === 'lib') { LAY.lib = null; LAY.libOff = false; } else if (kind === 'insp') { LAY.insp = null; LAY.inspOff = false; } else { LAY.lane = null; LAY.tall = false; } applyLayout(); saveLayout(); });
    h.addEventListener('keydown', e => {
      const k = e.key; if (!/^Arrow/.test(k)) return;
      const dir = (k === 'ArrowRight' || k === 'ArrowDown') ? 1 : (k === 'ArrowLeft' || k === 'ArrowUp') ? -1 : 0;
      const along = kind === 'lane' ? (k === 'ArrowUp' || k === 'ArrowDown') : (k === 'ArrowLeft' || k === 'ArrowRight'); if (!along) return;
      e.preventDefault(); const step = e.shiftKey ? 48 : 16;
      put(kind === 'insp' || kind === 'lane' ? size() - dir * step : size() + dir * step); saveLayout();
    });
  });

  // ---- hover / keyboard audition: preview on the stage without touching the project ----
  let audOn = store.get('motif5-audition') !== false, audTimer = 0;
  $('audBtn').setAttribute('aria-pressed', audOn);
  $('audBtn').addEventListener('click', () => { audOn = !audOn; store.set('motif5-audition', audOn); $('audBtn').setAttribute('aria-pressed', audOn); if (!audOn) setAudition(null); toast(audOn ? 'Hover preview on' : 'Hover preview off'); });
  function setAudition(next, label, hint) {
    clearTimeout(audTimer); audition = next || null; stage.invalidate();
    if (audition) { $('audName').textContent = label || ''; $('audHint').textContent = hint || ''; $('aud').hidden = false; } else $('aud').hidden = true;
  }
  function auditionStyle(id) { const next = clone(project); const nl = T.layerById(next, project.active); nl.styleId = id; nl.params = T.newLayer(id).params; return next; }
  function libHover(st, on) {
    clearTimeout(audTimer);
    if (!audOn || !matchMedia('(hover: hover)').matches) return;
    if (!on) { if (audition) setAudition(null); return; }
    if (st.id === active().styleId) return;
    audTimer = setTimeout(() => setAudition(auditionStyle(st.id), st.name, 'Click to apply'), 260);
  }
  function addLayerWithStyle(id) {
    if (project.layers.length >= T.MAX_LAYERS) { toast(`Layer limit is ${T.MAX_LAYERS}`); return; }
    const l = T.newLayer(id, { ...active().shared }, { blend: 'screen', opacity: 0.9 });
    const next = clone(project); next.layers.push(l); next.active = l.id; commit(next, `Layer ${next.layers.length} added · ${getStyle(id).name}`);
  }

  // ---- HUD + LCD text ----
  function updateHud() {
    const a = ASPECTS.find(x => x.id === aspect) || ASPECTS[0], sz = exportSize(aspect, 720);
    $('hudTag').textContent = `${a.label} · ${sz.w}×${sz.h} · ${project.output.fps} fps`;
    $('lcdRate').textContent = `${(arrMode ? arrDuration() : project.finish.loop).toFixed(2)} s · ${project.output.fps} fps`;
  }

  // ---- sliders: fill + "modified" state ----
  function paintRange(el) {
    const mn = +el.min, mx = +el.max, v = +el.value;
    el.style.setProperty('--fn', (mx > mn ? clamp((v - mn) / (mx - mn), 0, 1) : 0).toFixed(4));
    const row = el.closest('.row'); const s = el.dataset.path ? T.schemaAt(project, el.dataset.path) : null;
    if (row && s && typeof s.def === 'number') { const cur = s.log ? fromSlider(el.value, s) : +el.value; row.classList.toggle('mod', Math.abs(cur - s.def) > (s.step || 0.001) * 0.5); }
  }
  function paintRanges(root) { (root || $('insp')).querySelectorAll('input[type=range]').forEach(paintRange); }
  document.addEventListener('input', e => { const t = e.target; if (t && t.type === 'range' && t.closest && t.closest('#insp')) paintRange(t); }, true);

  // ---- scrub any numeric value by dragging its label (Shift = fine, Alt = finer) ----
  (() => {
    let d = null;
    $('insp').addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const lab = e.target.closest && e.target.closest('.row > label'); if (!lab) return;
      const inp = lab.closest('.row').querySelector('input[type=range][data-path]'); if (!inp) return;
      d = { inp, x: e.clientX, v: +inp.value, moved: false, id: e.pointerId, lab };
    });
    addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x;
      if (!d.moved) { if (Math.abs(dx) < 4) return; d.moved = true; document.body.classList.add('scrubbing'); }
      const mn = +d.inp.min, mx = +d.inp.max, step = +d.inp.step || 0;
      const full = e.altKey ? 3200 : e.shiftKey ? 1200 : 320;
      let v = clamp(d.v + (dx / full) * (mx - mn), mn, mx); if (step) v = mn + Math.round((v - mn) / step) * step;
      d.inp.value = v; d.inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const end = e => { if (!d || e.pointerId !== d.id) return; if (d.moved) { d.inp.dispatchEvent(new Event('change', { bubbles: true })); document.body.classList.remove('scrubbing'); } d = null; };
    addEventListener('pointerup', end); addEventListener('pointercancel', end);
    $('insp').addEventListener('dblclick', e => { const lab = e.target.closest && e.target.closest('.row > label'); if (!lab) return; const inp = lab.closest('.row').querySelector('input[type=range][data-path]'); if (inp) inp.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
  })();

  function nudgeStrength(dv) { const v = clamp(+(strength + dv).toFixed(2), 0.05, 1); $('strength').value = v; $('strength').dispatchEvent(new Event('input', { bubbles: true })); toast(`Strength ${v.toFixed(2)}`); }

  // ---- command palette ----
  const pal = $('pal'), palIn = $('palIn'), palList = $('palList');
  let palOpen = false, palRows = [], palItems = [], palSel = 0, palPrevFocus = null, palTimer = 0;
  const RECENT_KEY = 'motif5-recent'; let recents = store.get(RECENT_KEY) || [];
  const PAGE_NAMES = [['layer', 'Layers'], ['colour', 'Colour'], ['finish', 'Finish'], ['audio', 'Audio'], ['clips', 'Clips'], ['kits', 'Kits']];
  function showInsp() { if (mqDesktop.matches && LAY.inspOff) { LAY.inspOff = false; applyLayout(); saveLayout(); } }
  function palAll() {
    const CORE = new Set(['play', 'mutate', 'evolve', 'random', 'add', 'undo', 'redo', 'look', 'deliver', 'save', 'open', 'arrange', 'lay-explore', 'lay-build', 'lay-time', 'lay-focus']);
    const c = (id, label, kbd, run, kw = '') => ({ key: 'cmd:' + id, label, kind: 'Command', kbd, run, kw, core: CORE.has(id) });
    const out = [];
    out.push(c('play', stage.playing ? 'Pause' : 'Play', 'Space', togglePlay, 'transport start stop'));
    out.push(c('mutate', 'Mutate selected layer', 'M', doMutate, 'nudge explore variation'));
    out.push(c('evolve', 'Evolve: breed six variations', 'E', openEvolve, 'variations children'));
    out.push(c('random', 'Randomize selected layer', 'R', doRandom, 'shuffle dice'));
    out.push(c('reset', 'Reset style values', '', doReset));
    out.push(c('add', 'Add layer', 'A', addLayer)); out.push(c('dup', 'Duplicate layer', 'D', dupLayer));
    if (project.layers.length > 1) { out.push(c('del', 'Delete layer', '', delLayer)); out.push(c('up', 'Move layer up', '', () => moveLayer(1))); out.push(c('down', 'Move layer down', '', () => moveLayer(-1))); }
    if (cursor > 0) out.push(c('undo', 'Undo', IS_MAC ? '⌘Z' : 'Ctrl Z', undo));
    if (cursor < history.length - 1) out.push(c('redo', 'Redo', IS_MAC ? '⇧⌘Z' : 'Ctrl ⇧Z', redo));
    out.push(c('look', 'Save clip', 'S', saveLook)); out.push(c('save', 'Save project', IS_MAC ? '⌘S' : 'Ctrl S', () => saveProject(), 'file disk write')); out.push(c('open', 'Open project…', IS_MAC ? '⌘O' : 'Ctrl O', openProjectDialog, 'load file')); out.push(c('arrange', 'Arrange: sequence clips', 'Alt A', () => setArrange(!arrMode), 'nle edit sequence clips timeline')); out.push(c('deliver', 'Render and export', 'X', openExport, 'export deliver render mp4 gif lottie'));
    out.push(c('new', 'New project', IS_MAC ? '⌥N' : 'Alt N', newProject, 'blank slate empty start'));
    out.push(c('import-clips', 'Import clips…', '', openImportDialog, 'clips from project finder files'));
    [['explore', 'Explore', 'Alt 1'], ['build', 'Build', 'Alt 2'], ['time', 'Time', 'Alt 3'], ['focus', 'Focus', 'F']].forEach(([n, l, k]) => out.push(c('lay-' + n, `Workspace: ${l}`, k, () => setLayout(n), 'layout panels')));
    out.push(c('t-lib', 'Toggle library', 'L', togLib, 'panel')); out.push(c('t-insp', 'Toggle inspector', 'I', togInsp, 'panel')); out.push(c('t-lane', 'Toggle Animate', 'K', togLane, 'panel keys'));
    out.push(c('guides', 'Toggle safe-area guides', 'G', toggleGuides));
    out.push(c('aud', audOn ? 'Turn hover preview off' : 'Turn hover preview on', '', () => $('audBtn').click(), 'audition'));
    ASPECTS.forEach((a, i) => out.push(c('asp-' + a.id, `Aspect ratio ${a.label}`, String(i + 1), () => setAspect(a.id), 'format size')));
    [...PAGE_NAMES, ...extensions.map(x => [x.id, x.name])].forEach(([t, n]) => out.push(c('page-' + t, `Open ${n}`, '', () => { showInsp(); setTab(t); }, 'inspector page')));
    for (const x of extensions) if (x.commands) { try { for (const m of x.commands(extApi)) out.push(c(m.id, m.label, m.kbd || '', () => { showInsp(); m.run(); }, m.kw || '')); } catch (e) { console.error(e); } }
    [['dense', 'dense'], ['grid', 'thumbnails'], ['list', 'list']].forEach(([v, n]) => out.push(c('view-' + v, `Library view: ${n}`, '', () => setLibView(v), 'density')));
    [['auto', 'Auto'], ['high', 'Full'], ['draft', 'Half'], ['quarter', 'Quarter']].forEach(([v, n]) => out.push(c('q-' + v, `Preview quality: ${n}`, '', () => { $('quality').value = v; stage.setQuality(v); toast(`Preview ${n}`); }, 'resolution performance')));
    out.push(c('cache-toggle', stage.cacheOn ? 'Render cache: turn off' : 'Render cache: turn on', '', () => toggleCache(), 'performance scrub loop'));
    out.push(c('cache-clear', 'Render cache: clear', '', () => { stage.cacheClear(); stage.invalidate(); toast('Render cache cleared'); }, 'performance'));
    out.push(c('bench', 'Benchmark this scene (download frame-time JSON)', '', () => runBench(), 'performance speed fps gpu'));
    out.push(c('bench-all', 'Benchmark every style (download frame-time JSON)', '', () => runBench({ all: true }), 'performance speed fps gpu budget'));
    out.push(c('keys', 'Keyboard shortcuts', '?', () => $('keysDlg').showModal()));
    const pals = [...PALETTES, ...project.palettes];
    pals.forEach(p => out.push({ key: 'pal:' + p.id, label: p.name, kind: 'Palette', kw: 'colour color', sw: [p.bg, p.ink, ...p.a], run: () => commit(applyValue(lpath('s', 'palette'), p.id), `Palette · ${p.name}`), preview: () => applyValue(lpath('s', 'palette'), p.id), hint: 'Palette' }));
    STYLES.forEach(s => {
      const cat = CATEGORIES.find(x => x.id === s.category);
      out.push({ key: 'style:' + s.id, label: s.name, kind: s.kit ? (s.kitName || 'Kit') : 'Style', sub: cat ? cat.name : '', kw: `${cat ? cat.name : ''} ${s.blurb || ''} ${(s.tags || []).join(' ')}`, style: s, run: alt => (alt ? addLayerWithStyle(s.id) : selectStyle(s.id)), preview: () => auditionStyle(s.id), hint: '↵ apply · ⇧↵ add as layer' });
    });
    return out;
  }
  const WORD = /[\s\-_/·:]/;
  function scoreTok(t, it) {
    const lab = it.label.toLowerCase(), i = lab.indexOf(t);
    if (i === 0) return 100;
    if (i > 0) return WORD.test(lab[i - 1]) ? 90 : 70;
    const words = lab.split(/[\s\-_/·:]+/).filter(Boolean);
    if (t.length > 1 && words.map(w => w[0]).join('').includes(t)) return 60;
    const meta = `${it.kind} ${it.sub || ''} ${it.kw || ''}`.toLowerCase(), j = meta.indexOf(t);
    if (j >= 0) return WORD.test(meta[j - 1] || ' ') ? 40 : 25;
    if (t.length >= 3) { // compact in-order match inside the label only
      let ti = 0, first = -1, last = -1;
      for (let k = 0; k < lab.length && ti < t.length; k++) if (lab[k] === t[ti]) { if (first < 0) first = k; last = k; ti++; }
      if (ti === t.length && last - first + 1 <= t.length * 2) return 30 - (last - first + 1 - t.length);
    }
    return -1;
  }
  function palQuery(q) {
    const all = palAll(), tokens = q.toLowerCase().split(/\s+/).filter(Boolean); palRows = [];
    if (!tokens.length) {
      const byKey = new Map(all.map(i => [i.key, i])); const rec = recents.map(k => byKey.get(k)).filter(Boolean).slice(0, 5);
      if (rec.length) { palRows.push({ head: 'Recent' }); rec.forEach(i => palRows.push({ item: i })); }
      const cmds = all.filter(i => i.core); palRows.push({ head: 'Commands' }); cmds.forEach(i => palRows.push({ item: i }));
      palRows.push({ head: 'Palettes' }); all.filter(i => i.kind === 'Palette').forEach(i => palRows.push({ item: i }));
      palRows.push({ head: `Styles · ${STYLES.length}` }); all.filter(i => i.style).forEach(i => palRows.push({ item: i }));
    } else {
      all.map(it => { let s = 0; for (const t of tokens) { const f = scoreTok(t, it); if (f < 0) return null; s += f; } return { it, s: s - it.label.length * 0.05 }; })
        .filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 60).forEach(x => palRows.push({ item: x.it }));
    }
    palItems = palRows.filter(r => r.item).map(r => r.item); palSel = 0; palRender(); palPreviewSoon();
  }
  function palThumb(st) {
    const c = document.createElement('canvas'); c.width = 80; c.height = 48; const src = thumbs.get(st.id);
    try { if (src) c.getContext('2d').drawImage(src, 0, 0, 80, 48); } catch (e) { /* thumbnail not drawn yet */ }
    return c;
  }
  function palRender() {
    palList.innerHTML = ''; let n = 0;
    if (!palItems.length) { const li = document.createElement('li'); li.className = 'pal-none'; li.setAttribute('role', 'presentation'); li.textContent = `Nothing matches “${palIn.value.trim()}”.`; palList.appendChild(li); return; }
    for (const r of palRows) {
      if (r.head) { const h = document.createElement('li'); h.className = 'pal-sec'; h.setAttribute('role', 'presentation'); h.textContent = r.head; palList.appendChild(h); continue; }
      const it = r.item, i = n++;
      const li = document.createElement('li'); li.className = 'pal-item'; li.id = 'pal-' + i; li.setAttribute('role', 'option'); li.dataset.i = i; li.setAttribute('aria-selected', i === palSel);
      const ico = document.createElement('span'); ico.className = 'pal-ico';
      if (it.style) ico.appendChild(palThumb(it.style));
      else if (it.sw) ico.innerHTML = `<span class="sw">${it.sw.map(h => `<s style="background:${h}"></s>`).join('')}</span>`;
      else ico.innerHTML = '<span class="g">›_</span>';
      const lab = document.createElement('span'); lab.className = 'pal-lab'; lab.textContent = it.label;
      const kind = document.createElement('span'); kind.className = 'pal-kind'; kind.textContent = it.sub || it.kind;
      li.append(ico, lab, kind);
      if (it.kbd) { const k = document.createElement('kbd'); k.textContent = it.kbd; li.appendChild(k); } else li.appendChild(document.createElement('span'));
      palList.appendChild(li);
    }
    palIn.setAttribute('aria-activedescendant', 'pal-' + palSel);
  }
  function palMove(d) {
    if (!palItems.length) return; palSel = (palSel + d + palItems.length) % palItems.length;
    palList.querySelectorAll('.pal-item').forEach(li => li.setAttribute('aria-selected', +li.dataset.i === palSel));
    const el = $('pal-' + palSel); if (el) el.scrollIntoView({ block: 'nearest' }); palIn.setAttribute('aria-activedescendant', 'pal-' + palSel); palPreviewSoon();
  }
  function palPreviewSoon() {
    clearTimeout(palTimer); const it = palItems[palSel];
    if (!it || !it.preview || !audOn) { if (audition) setAudition(null); return; }
    palTimer = setTimeout(() => { if (palOpen) setAudition(it.preview(), it.label, it.hint); }, 100);
  }
  function palRun(alt) {
    const it = palItems[palSel]; if (!it) return;
    recents = [it.key, ...recents.filter(k => k !== it.key)].slice(0, 6); store.set(RECENT_KEY, recents);
    closePal(); if (it.style) it.run(alt); else it.run();
  }
  function openPal() {
    if (palOpen) return; palOpen = true; palPrevFocus = document.activeElement; pal.hidden = false; palIn.value = ''; $('cmdBtn').setAttribute('aria-expanded', 'true');
    palQuery(''); palIn.focus();
  }
  function closePal() {
    if (!palOpen) return; palOpen = false; pal.hidden = true; clearTimeout(palTimer); if (audition) setAudition(null); $('cmdBtn').setAttribute('aria-expanded', 'false');
    if (palPrevFocus && palPrevFocus.focus && document.contains(palPrevFocus)) palPrevFocus.focus();
  }
  $('cmdBtn').addEventListener('click', () => (palOpen ? closePal() : openPal()));
  palIn.addEventListener('input', () => palQuery(palIn.value));
  palIn.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); palMove(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palMove(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); palRun(e.shiftKey); }
    else if (e.key === 'Escape') { e.preventDefault(); closePal(); }
    else if (e.key === 'Tab') e.preventDefault();
  });
  palList.addEventListener('mousemove', e => { const li = e.target.closest('.pal-item'); if (li && +li.dataset.i !== palSel) { palSel = +li.dataset.i; palList.querySelectorAll('.pal-item').forEach(x => x.setAttribute('aria-selected', +x.dataset.i === palSel)); palPreviewSoon(); } });
  palList.addEventListener('click', e => { const li = e.target.closest('.pal-item'); if (li) { palSel = +li.dataset.i; palRun(e.shiftKey); } });
  pal.addEventListener('pointerdown', e => { if (e.target === pal) closePal(); });

  // global flow keys (capture: runs before the base handler)
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && !e.altKey && k === 'k') { e.preventDefault(); e.stopPropagation(); palOpen ? closePal() : openPal(); return; }
    if (palOpen || $('exportDlg').open || $('keysDlg').open || $('projDlg').open || $('askDlg').open) return;
    const tg = e.target, tag = tg.tagName; const typing = (tag === 'INPUT' && ['text', 'search', 'number'].includes(tg.type)) || tag === 'TEXTAREA' || tag === 'SELECT';
    if (typing || e.metaKey || e.ctrlKey || !e.altKey) return;
    const m = /^Digit([1-4])$/.exec(e.code);
    if (m) { e.preventDefault(); setLayout(['explore', 'build', 'time', 'focus'][m[1] - 1]); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); const i = project.layers.findIndex(l => l.id === project.active) + (e.key === 'ArrowUp' ? 1 : -1);
      if (project.layers[i]) selectLayer(project.layers[i].id);
    }
  }, true);


  // =====================================================================
  // Motif 6: tooltips, page-zoom lock, menus, clips + groups, project files,
  // viewer tools (Move, Grid) and the Arrange sequencer. UI state lives here;
  // every project change still goes through commit() / live().
  // =====================================================================
  const newId = p => p + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);
  const wrapPos = (x, n) => ((x % n) + n) % n;
  function loopSec() { return arrMode ? arrDuration() : project.finish.loop; }

  // ---- tooltips: name + shortcut on hover or keyboard focus, for icon-only controls ----
  (() => {
    const tip = $('tip'); let timer = 0, cur = null;
    const hide = () => { clearTimeout(timer); cur = null; tip.hidden = true; };
    const show = el => {
      const name = el.dataset.tip; if (!name) return; cur = el;
      const k = el.dataset.kbd;
      const meta = el.dataset.tipMeta;
      tip.classList.toggle('rich', !!meta);
      tip.innerHTML = `<span>${esc(name)}</span>${k ? `<kbd>${esc(k)}</kbd>` : ''}${meta ? `<small>${esc(meta)}</small>` : ''}`;
      tip.hidden = false;
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      const x = clamp(r.left + r.width / 2 - tw / 2, 6, Math.max(6, innerWidth - tw - 6));
      let y = r.bottom + 8; if (y + th > innerHeight - 6) y = r.top - th - 8;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    };
    document.addEventListener('pointerover', e => {
      if (e.pointerType === 'touch') return;
      const el = e.target.closest && e.target.closest('[data-tip]'); if (!el || el === cur) return;
      hide(); timer = setTimeout(() => show(el), 300);
    });
    document.addEventListener('pointerout', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && !el.contains(e.relatedTarget)) hide(); });
    document.addEventListener('pointerdown', hide, true); document.addEventListener('keydown', hide, true);
    addEventListener('scroll', hide, true); addEventListener('blur', hide);
    document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el && el.matches(':focus-visible')) { hide(); show(el); } });
    document.addEventListener('focusout', hide);
  })();

  // ---- page zoom lock: pinch and ctrl+wheel never resize the page ----
  (() => {
    const stop = e => e.preventDefault();
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, stop, { passive: false })); // Safari pinch
    document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });                  // trackpad pinch arrives as ctrl+wheel
    document.addEventListener('touchmove', e => { if (e.touches.length > 1 || (e.scale && e.scale !== 1)) e.preventDefault(); }, { passive: false });
  })();

  // ---- popup menus: blend picker (hover previews on the stage), clip and group menus ----
  let menu = null;
  function closeMenu() {
    if (!menu) return; const m = menu; menu = null; const el = $('popmenu'); el.hidden = true; el.innerHTML = '';
    if (m.anchor && m.anchor.setAttribute) m.anchor.setAttribute('aria-expanded', 'false');
    if (m.o.onClose) m.o.onClose();
    if (m.restore !== false && m.prev && m.prev.focus && document.contains(m.prev)) m.prev.focus({ preventScroll: true });
  }
  function openMenu(anchor, items, o = {}) {
    closeMenu();
    const el = $('popmenu'); el.setAttribute('aria-label', o.label || 'Menu');
    el.innerHTML = items.map((it, i) => it.sep ? '<hr>' : `<button type="button" role="${o.radio ? 'option' : 'menuitem'}" data-i="${i}"${it.disabled ? ' disabled' : ''}${it.danger ? ' class="danger"' : ''} aria-selected="${!!it.checked}"><span class="ck">${it.checked ? '✓' : ''}</span><span class="tx">${esc(it.label)}</span>${it.kbd ? `<kbd>${esc(it.kbd)}</kbd>` : ''}</button>`).join('');
    el.hidden = false;
    const ar = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    el.style.minWidth = Math.max(o.minWidth || 168, ar ? Math.min(ar.width, 260) : 0) + 'px';
    const mw = el.offsetWidth, mh = el.offsetHeight;
    let x, y;
    if (o.at) { x = o.at.x; y = o.at.y; } else { x = ar.left; y = ar.bottom + 4; if (y + mh > innerHeight - 8 && ar.top - mh - 4 > 8) y = ar.top - mh - 4; }
    x = clamp(x, 8, Math.max(8, innerWidth - mw - 8)); y = clamp(y, 8, Math.max(8, innerHeight - mh - 8));
    el.style.left = x + 'px'; el.style.top = y + 'px';
    if (anchor && anchor.setAttribute) anchor.setAttribute('aria-expanded', 'true');
    menu = { items, anchor, o, prev: document.activeElement };
    const first = (o.radio && el.querySelector('[aria-selected="true"]')) || el.querySelector('button:not([disabled])');
    if (first) first.focus({ preventScroll: true });
  }
  (() => {
    const el = $('popmenu');
    const hoverBtn = b => { if (!menu || !b || b.disabled || !menu.o.onHover) return; menu.o.onHover(menu.items[+b.dataset.i]); };
    el.addEventListener('pointerover', e => { const b = e.target.closest('button'); if (b && !b.disabled) { if (document.activeElement !== b) b.focus({ preventScroll: true }); hoverBtn(b); } });
    el.addEventListener('pointerleave', () => { if (menu && menu.o.onLeave) menu.o.onLeave(); });
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled || !menu) return;
      const it = menu.items[+b.dataset.i]; menu.restore = it.restoreFocus; const run = it.run; closeMenu(); if (run) run();
    });
    el.addEventListener('keydown', e => {
      if (!menu) return; const bs = [...el.querySelectorAll('button:not([disabled])')]; if (!bs.length) return; const i = bs.indexOf(document.activeElement);
      const go = n => { n.focus({ preventScroll: true }); hoverBtn(n); };
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); go(bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length]); }
      else if (e.key === 'Home') { e.preventDefault(); go(bs[0]); } else if (e.key === 'End') { e.preventDefault(); go(bs[bs.length - 1]); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(); } else if (e.key === 'Tab') closeMenu();
    });
    document.addEventListener('pointerdown', e => { if (menu && !el.contains(e.target) && !(menu.anchor && menu.anchor.contains && menu.anchor.contains(e.target))) closeMenu(); }, true);
    addEventListener('blur', closeMenu); addEventListener('resize', closeMenu);
    document.addEventListener('scroll', e => { if (menu && !el.contains(e.target)) closeMenu(); }, true);
  })();
  // Blend modes: hovering (or arrowing through) a mode previews it on the stage; choosing one applies it. The panel stays where it is.
  function openBlendMenu(btn) {
    if (menu && menu.anchor === btn) { closeMenu(); return; }
    const path = btn.dataset.blend, s = T.schemaAt(project, path), id = btn.id, cur = shownValue(path);
    const stop = () => { if (audition) setAudition(null); };
    const items = s.options.map(o => ({ label: o.l, v: o.v, checked: o.v === cur, restoreFocus: false, run: () => { commit(applyValue(path, o.v), `Blend: ${o.l}`); const n = document.getElementById(id); if (n) n.focus({ preventScroll: true }); } }));
    openMenu(btn, items, { radio: true, label: 'Blend mode', minWidth: 176, onHover: it => { if (it.v === cur) stop(); else setAudition(applyValue(path, it.v), `Blend · ${it.label}`, 'Click to apply'); }, onLeave: stop, onClose: stop });
  }

  // ---- small text prompt (rename, new group, save as) ----
  function askText(title, label, value, ok = 'Save') {
    return new Promise(resolve => {
      const d = $('askDlg'), inp = $('askIn'); let out = null;
      $('askTitle').textContent = title; $('askLabel').textContent = label; $('askOk').textContent = ok; inp.value = value || '';
      const done = () => { d.removeEventListener('close', done); resolve(out); };
      d.addEventListener('close', done);
      $('askForm').onsubmit = () => { out = inp.value.trim() || null; };
      $('askCancel').onclick = $('askClose').onclick = () => { out = null; d.close(); };
      d.showModal(); inp.focus(); inp.select();
    });
  }

  // ---- project name + unsaved marker ----
  function updateNameUi() {
    const b = $('projName'); if (!b) return;
    if (b.textContent !== projectName) b.textContent = projectName;
    b.parentElement.dataset.dirty = dirty ? '1' : ''; $('saveBtn').dataset.dirty = dirty ? '1' : '';
    b.title = `${dirty ? 'Unsaved changes · ' : ''}${fileHandle ? `File: ${fileHandle.name} · ` : ''}Click to rename`;
    document.title = `${projectName}${dirty ? ' •' : ''} · Motif 6`;
  }
  async function renameProject() { const n = await askText('Rename project', 'Project name', projectName, 'Rename'); if (n) { projectName = n.slice(0, 60); dirty = true; updateNameUi(); autosave(); } }
  $('projName').addEventListener('click', renameProject);
  $('projName').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); renameProject(); } });

  // ---- previous / next keyframe (Arrange: previous / next cut) ----
  function keyTimes() {
    if (arrMode) { const set = new Set([0]); for (const it of project.arrange.items) { set.add(+it.start.toFixed(4)); set.add(+(it.start + it.dur).toFixed(4)); } return [...set].sort((a, b) => a - b); }
    const L = project.finish.loop, set = new Set();
    for (const ks of Object.values(project.keys)) for (const k of ks) set.add(+(k.u * L).toFixed(4));
    return [...set].sort((a, b) => a - b);
  }
  function jumpKey(dir) {
    const ts = keyTimes(), t = stage.time, eps = 0.5 / project.output.fps;
    const to = dir < 0 ? [...ts].reverse().find(x => x < t - eps) : ts.find(x => x > t + eps);
    if (to === undefined) { toast(arrMode ? (dir < 0 ? 'Start of the sequence' : 'End of the sequence') : ts.length ? (dir < 0 ? 'No earlier keyframe' : 'No later keyframe') : 'No keyframes yet · key a value with ◇'); return; }
    stage.seekTime(arrMode ? Math.min(to, arrDuration() - 1e-3) : to);
    if (player.playing) player.start(stage.time);
    if (!arrMode) {
      const u = to / project.finish.loop;
      for (const [p, ks] of Object.entries(project.keys)) { const i = T.keyIndexAt(ks, u); if (i >= 0) { selKey = { path: p, idx: i }; renderLaneHead(); markSelected(); break; } }
      if (!stage.playing) refreshRowsOnly();
    }
  }
  function pickLaneLayer(row) {
    if (!row) return; let id = row.dataset.layer;
    if (!id && row.dataset.lpath) { const p = T.parsePath(row.dataset.lpath); if (p && p.kind !== 'F') id = p.layer; }
    if (id) selectLayer(id);
  }

  // ---------- clips: saved looks, organised in groups. Arrange lays them out on tracks ----------
  const CLIPS_KEY = 'motif6-clips', GROUPS_KEY = 'motif6-groups', OLD_LOOKS_KEY = 'motif-style-lab-2-looks';
  clips = store.get(CLIPS_KEY);
  if (!Array.isArray(clips)) clips = (store.get(OLD_LOOKS_KEY) || []).map(l => ({ ...l, group: null })); // looks from earlier versions become clips
  groups = store.get(GROUPS_KEY); if (!Array.isArray(groups)) groups = [];
  clips = clips.filter(c => c && c.project && c.project.layers);
  clips.forEach(c => { if (!c.id) c.id = newId('c'); if (!('group' in c)) c.group = null; });
  groups.forEach(g => { if (!g.id) g.id = newId('g'); });
  const clipById = id => clips.find(c => c.id === id) || null;
  const clipLoop = c => (c && c.project && c.project.finish && Number(c.project.finish.loop)) || 6;
  const clipProjCache = new WeakMap();
  function clipProject(c) { let p = clipProjCache.get(c); if (!p) { p = T.sanitizeProject(c.project, C.sanitizeCustom); clipProjCache.set(c, p); } return p; }
  function saveClips() {
    try { localStorage.setItem(CLIPS_KEY, JSON.stringify(clips)); localStorage.setItem(GROUPS_KEY, JSON.stringify(groups)); return true; }
    catch (e) { toast('Browser storage is full. Delete some clips, or save the project to a file.'); return false; }
  }
  const groupName = id => { const g = groups.find(x => x.id === id); return g ? g.name : ''; };
  function clipCard(c) {
    const inArr = arrMode;
    return `<div class="look clipcard" role="button" tabindex="0" draggable="true" data-clip="${c.id}" aria-label="${inArr ? 'Add' : 'Load'} ${esc(c.name)}" title="${inArr ? 'Click to add to Arrange · drag onto a track' : 'Click to load · drag onto a group or an Arrange track'}"><img alt="" src="${esc(c.thumb || '')}" draggable="false"><span class="dur">${clipLoop(c).toFixed(1)} s</span><small>${esc(c.name)}</small><span class="acts"><button class="x" data-cadd aria-label="Add ${esc(c.name)} to Arrange" data-tip="Add to Arrange"><svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button><button class="x" data-cmore aria-label="Options for ${esc(c.name)}" aria-haspopup="menu" data-tip="Options"><svg class="i" viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="2.6"/></svg></button></span></div>`;
  }
  function groupSection(g, list) {
    const open = g ? g.open !== false : true;
    const head = g ? `<header class="cg-head" data-group-head="${g.id}"><button class="cg-tog" aria-expanded="${open}" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(g.name)}"><svg class="i" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button><span class="cg-name" title="Double-click to rename">${esc(g.name)}</span><span class="cg-n">${list.length}</span><button class="x" data-gmore aria-label="Group options" aria-haspopup="menu" data-tip="Group options"><svg class="i" viewBox="0 0 24 24"><path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="2.6"/></svg></button></header>`
      : `<header class="cg-head loose"><span class="cg-name">Ungrouped</span><span class="cg-n">${list.length}</span></header>`;
    return `<section class="cgroup" data-group="${g ? g.id : ''}" data-open="${open}">${head}<div class="looks-grid">${open ? list.map(clipCard).join('') : ''}${open && !list.length ? `<p class="cg-empty">${g ? 'Drag clips here' : 'Nothing here'}</p>` : ''}</div></section>`;
  }
  function renderClips() {
    const root = $('looks'); if (!root) return;
    const by = new Map(groups.map(g => [g.id, []])), loose = [];
    for (const c of clips) (by.get(c.group) || loose).push(c);
    root.innerHTML = groups.map(g => groupSection(g, by.get(g.id))).join('') + (groups.length ? (loose.length || !clips.length ? groupSection(null, loose) : '') : (loose.length ? `<div class="looks-grid">${loose.map(clipCard).join('')}</div>` : ''));
    $('looksEmpty').hidden = clips.length > 0 || groups.length > 0;
    $('newGroup').title = `Create a group (${groups.length} so far)`;
  }
  // Save the working project as a clip. The arrangement belongs to the project, not the clip, so it is left out.
  function saveLook() {
    const c = document.createElement('canvas'); const sz = exportSize(aspect, 108); c.width = sz.w; c.height = sz.h;
    renderProjectThumb(pipeline, c, project, arrMode ? 0 : stage.time);
    const name = project.layers.map(l => getStyle(l.styleId).name.split(' ')[0]).join(' + ');
    const snap = clone(project); snap.arrange = { items: [], fx: [] };
    const clip = { id: newId('c'), name: `${name} ${clips.length + 1}`, group: null, project: snap, aspect, thumb: c.toDataURL('image/jpeg', 0.8), at: Date.now() };
    clips.unshift(clip); clips = clips.slice(0, 200); saveClips(); renderClips(); toast('Clip saved'); return clip;
  }
  $('saveLook').addEventListener('click', saveLook);
  function loadClip(c) {
    const miss = K.missingKits(c.project); if (miss.length) { toast(`This clip needs the ${miss.join(', ')} kit. Install it in the Kits tab first.`); return; }
    if (arrMode) setArrange(false);
    setAspect(c.aspect || aspect);
    const next = clone(c.project); next.arrange = clone(project.arrange);
    commit(next, `Loaded ${c.name}`); stage.setSpace(project.output.space);
  }
  async function newGroupPrompt() {
    const n = await askText('New group', 'Group name', `Group ${groups.length + 1}`, 'Create'); if (!n) return null;
    const g = { id: newId('g'), name: n.slice(0, 40), open: true }; groups.push(g); saveClips(); renderClips(); toast(`Group “${g.name}” created`); return g;
  }
  function moveClipToGroup(id, gid) {
    const c = clipById(id); if (!c || (c.group || null) === (gid || null)) return;
    c.group = gid || null; saveClips(); renderClips(); toast(gid ? `Moved to ${groupName(gid)}` : 'Removed from its group');
  }
  async function renameClip(c) { const n = await askText('Rename clip', 'Clip name', c.name, 'Rename'); if (n) { c.name = n.slice(0, 60); saveClips(); renderClips(); renderArrange(); } }
  async function renameGroup(g) { const n = await askText('Rename group', 'Group name', g.name, 'Rename'); if (n) { g.name = n.slice(0, 40); saveClips(); renderClips(); } }
  function deleteClip(c) {
    const used = project.arrange.items.filter(i => i.clip === c.id).length;
    if (used && !confirm(`“${c.name}” is used ${used} time${used > 1 ? 's' : ''} in Arrange. Delete it anyway? Those clips will show as missing.`)) return;
    clips = clips.filter(x => x !== c); saveClips(); renderClips(); renderArrange(); toast('Clip deleted');
  }
  function clipMenu(c, anchor, at) {
    const items = [
      { label: arrMode ? 'Load into Animate' : 'Load', kbd: '↵', run: () => loadClip(c) },
      { label: 'Add to Arrange', run: () => addClipToArrange(c.id) }, { sep: true },
      { label: 'Rename…', run: () => renameClip(c) },
      { label: 'Duplicate', run: () => { const i = clips.indexOf(c); clips.splice(i, 0, { ...clone(c), id: newId('c'), name: `${c.name} copy` }); saveClips(); renderClips(); } }, { sep: true },
      ...groups.map(g => ({ label: `Move to ${g.name}`, checked: c.group === g.id, run: () => moveClipToGroup(c.id, g.id) })),
      { label: 'New group…', run: async () => { const g = await newGroupPrompt(); if (g) moveClipToGroup(c.id, g.id); } },
      ...(c.group ? [{ label: 'Remove from group', run: () => moveClipToGroup(c.id, null) }] : []), { sep: true },
      { label: 'Delete', danger: true, run: () => deleteClip(c) },
    ];
    openMenu(anchor, items, { at, label: 'Clip options', restore: false });
  }
  function groupMenu(g, anchor, at) {
    const members = clips.filter(c => c.group === g.id);
    openMenu(anchor, [
      { label: 'Rename…', run: () => renameGroup(g) },
      { label: `Add all to Arrange (${members.length})`, disabled: !members.length, run: () => { members.slice().reverse().forEach(c => addClipToArrange(c.id, { quiet: true })); toast(`Added ${members.length} clip${members.length > 1 ? 's' : ''} to V1`); } }, { sep: true },
      { label: 'Ungroup (keep clips)', run: () => { members.forEach(c => { c.group = null; }); groups = groups.filter(x => x !== g); saveClips(); renderClips(); } },
      { label: 'Delete group and clips', danger: true, disabled: !members.length && false, run: () => { if (members.length && !confirm(`Delete “${g.name}” and its ${members.length} clip${members.length > 1 ? 's' : ''}?`)) return; clips = clips.filter(c => c.group !== g.id); groups = groups.filter(x => x !== g); saveClips(); renderClips(); renderArrange(); } },
    ], { at, label: 'Group options', restore: false });
  }
  const clipsEl = $('looks');
  clipsEl.addEventListener('click', e => {
    const card = e.target.closest('.clipcard');
    if (card) {
      const c = clipById(card.dataset.clip); if (!c) return;
      if (e.target.closest('[data-cadd]')) { addClipToArrange(c.id); return; }
      if (e.target.closest('[data-cmore]')) { clipMenu(c, e.target.closest('[data-cmore]')); return; }
      if (arrMode) addClipToArrange(c.id); else loadClip(c);
      return;
    }
    const head = e.target.closest('[data-group-head]'); if (!head) return;
    const g = groups.find(x => x.id === head.dataset.groupHead); if (!g) return;
    if (e.target.closest('[data-gmore]')) { groupMenu(g, e.target.closest('[data-gmore]')); return; }
    g.open = g.open === false; saveClips(); renderClips();
  });
  clipsEl.addEventListener('dblclick', e => { const n = e.target.closest('.cg-name'); if (!n) return; const head = n.closest('[data-group-head]'); const g = head && groups.find(x => x.id === head.dataset.groupHead); if (g) renameGroup(g); });
  clipsEl.addEventListener('contextmenu', e => {
    const card = e.target.closest('.clipcard'), head = e.target.closest('[data-group-head]');
    if (card) { e.preventDefault(); const c = clipById(card.dataset.clip); if (c) clipMenu(c, null, { x: e.clientX, y: e.clientY }); }
    else if (head) { e.preventDefault(); const g = groups.find(x => x.id === head.dataset.groupHead); if (g) groupMenu(g, null, { x: e.clientX, y: e.clientY }); }
  });
  clipsEl.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('clipcard')) { e.preventDefault(); e.target.click(); } });
  // drag a clip onto a group to file it, or onto an Arrange track to place it
  const dnd = { id: null };
  clipsEl.addEventListener('dragstart', e => {
    const card = e.target.closest('.clipcard'); if (!card) return; dnd.id = card.dataset.clip;
    e.dataTransfer.effectAllowed = 'copyMove'; e.dataTransfer.setData('application/x-motif-clip', dnd.id); e.dataTransfer.setData('text/plain', (clipById(dnd.id) || {}).name || 'clip');
    card.classList.add('dragging');
  });
  clipsEl.addEventListener('dragend', () => { dnd.id = null; clipsEl.querySelectorAll('.dragging,.over').forEach(x => x.classList.remove('dragging', 'over')); });
  clipsEl.addEventListener('dragover', e => { if (!dnd.id) return; const g = e.target.closest('.cgroup'); if (!g) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; clipsEl.querySelectorAll('.over').forEach(x => { if (x !== g) x.classList.remove('over'); }); g.classList.add('over'); });
  clipsEl.addEventListener('dragleave', e => { const g = e.target.closest('.cgroup'); if (g && !g.contains(e.relatedTarget)) g.classList.remove('over'); });
  clipsEl.addEventListener('drop', e => { const g = e.target.closest('.cgroup'); if (!g || !dnd.id) return; e.preventDefault(); const id = dnd.id; dnd.id = null; moveClipToGroup(id, g.dataset.group || null); });
  $('newGroup').addEventListener('click', newGroupPrompt);
  // ---- Import: bring clips into THIS project from another Motif project (saved here, or in the project folder) or from a file ----
  const imp = { src: null, sel: new Set() };
  const FINDER = /Mac/i.test(navigator.platform || '') ? 'Finder' : 'Files';
  $('importBtn').innerHTML = 'Import…'; $('importBtn').title = `Import clips from another Motif project or from ${FINDER}`;
  $('importFile').accept = '.motif,.json,application/json';
  function impThumb(pr, asp) {
    try { const c = document.createElement('canvas'), sz = exportSize(asp || aspect, 108); c.width = sz.w; c.height = sz.h; renderProjectThumb(pipeline, c, T.sanitizeProject(pr, C.sanitizeCustom), 0); return c.toDataURL('image/jpeg', 0.8); }
    catch (err) { return ''; }
  }
  // A source is a project file's contents: its saved clips, plus the project's own composition as one more clip.
  function impSource(data, name) {
    const pr = data && (data.project || (data.layers ? data : null));
    if (!pr || !Array.isArray(pr.layers)) throw new Error('there is no Motif project in it');
    const gs = (Array.isArray(data.groups) ? data.groups : []).map(cleanGroup).filter(Boolean);
    const items = (Array.isArray(data.clips) ? data.clips : []).map(cleanClip).filter(Boolean).map(c => ({ clip: c, group: gs.find(g => g.id === c.group) || null }));
    const main = clone(pr); main.arrange = { items: [], fx: [] };
    const asp = data.aspect && ASPECTS.some(a => a.id === data.aspect) ? data.aspect : aspect;
    items.unshift({ clip: { id: 'main', name: `${name} · composition`, group: null, project: main, aspect: asp, thumb: '', at: 0 }, group: null, main: true });
    return { name, items };
  }
  function renderImport() {
    const body = $('impBody'), foot = $('impFoot'), src = imp.src;
    if (!src) {
      const local = localProjects(), names = Object.keys(local).filter(n => local[n].id !== projectId || n !== projectName).sort((a, b) => String(local[b].savedAt).localeCompare(String(local[a].savedAt)));
      body.innerHTML = `<section class="pd-sec"><h3>Motif projects</h3>${names.length ? `<ul class="pd-list">${names.map(n => `<li><span class="pd-n">${esc(n)}</span><span class="pd-d">${(local[n].clips || []).length} clips · ${when(Date.parse(local[n].savedAt))}</span><button class="btn sm" data-imp-local="${esc(n)}">Choose</button></li>`).join('')}</ul>` : '<p class="pd-note">No other projects are saved in this browser yet.</p>'}</section>
        <section class="pd-sec"><h3>${FINDER}</h3><div class="btnrow"><button class="btn primary" id="impFinder">Choose from ${FINDER}…</button>${FS_FILE ? '<button class="btn" id="impPick">Choose from a project folder…</button>' : ''}</div><p class="pd-note">A <b>.motif</b> project, or a Motif preset (<b>.json</b>). Clips are copied into this project; the original is not touched.</p></section>`;
      foot.innerHTML = '<button class="btn primary" id="impDone">Done</button>'; return;
    }
    body.innerHTML = `<div class="imp-bar"><b>${esc(src.name)}</b><span class="grow"></span><button class="btn sm ghost" id="impAll">${imp.sel.size === src.items.length ? 'Select none' : 'Select all'}</button></div>
      <div class="imp-grid">${src.items.map((it, i) => `<button class="imp-clip" data-imp-i="${i}" aria-pressed="${imp.sel.has(i)}" title="${esc(it.clip.name)}${it.group ? ' · ' + esc(it.group.name) : ''}"><img alt="" src="${esc(it.clip.thumb || '')}"><small>${esc(it.clip.name)}</small></button>`).join('')}</div>`;
    foot.innerHTML = `<button class="btn" id="impBack">Back</button><button class="btn primary" id="impGo"${imp.sel.size ? '' : ' disabled'}>Import ${imp.sel.size || ''} clip${imp.sel.size === 1 ? '' : 's'}</button>`;
  }
  function openImportDialog() { imp.src = null; imp.sel.clear(); renderImport(); const d = $('impDlg'); if (!d.open) d.showModal(); }
  function chooseSource(data, name) {
    try { imp.src = impSource(data, name); } catch (err) { toast(`That isn’t a Motif project: ${err.message}`); return; }
    const main = imp.src.items[0]; if (!main.clip.thumb) main.clip.thumb = impThumb(main.clip.project, main.clip.aspect);
    imp.sel = new Set(imp.src.items.length > 1 ? [] : [0]); renderImport();
  }
  function doImport() {
    const src = imp.src; if (!src || !imp.sel.size) return; let n = 0;
    for (const i of imp.sel) {
      const it = src.items[i]; let gid = null;
      if (it.group) { let g = groups.find(x => x.name === it.group.name); if (!g) { g = { id: newId('g'), name: it.group.name, open: true }; groups.push(g); } gid = g.id; }
      clips.unshift({ ...clone(it.clip), id: newId('c'), group: gid, name: it.clip.name.slice(0, 60), at: Date.now() }); n++;
    }
    clips = clips.slice(0, 200); saveClips(); renderClips(); $('impDlg').close(); setTab('clips'); toast(`Imported ${n} clip${n === 1 ? '' : 's'} from ${src.name}`);
  }
  $('importBtn').addEventListener('click', openImportDialog);
  $('impClose').addEventListener('click', () => $('impDlg').close());
  $('impDlg').addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    try {
      if (t.dataset.impLocal) { const d = localProjects()[t.dataset.impLocal]; if (d) chooseSource(d, t.dataset.impLocal); }
      else if (t.id === 'impFinder') $('importFile').click();
      else if (t.id === 'impPick') { const [h] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false }); const f = await h.getFile(); chooseSource(JSON.parse(await f.text()), h.name.replace(FILE_EXT, '')); }
      else if (t.dataset.impI != null) { const i = +t.dataset.impI; if (imp.sel.has(i)) imp.sel.delete(i); else imp.sel.add(i); renderImport(); }
      else if (t.id === 'impAll') { if (imp.sel.size === imp.src.items.length) imp.sel.clear(); else imp.src.items.forEach((_, i) => imp.sel.add(i)); renderImport(); }
      else if (t.id === 'impBack') { imp.src = null; renderImport(); }
      else if (t.id === 'impGo') doImport();
      else if (t.id === 'impDone') $('impDlg').close();
    } catch (err) { if (err && err.name === 'AbortError') return; toast(`Couldn’t import: ${err && err.message ? err.message : err}`); }
  });
  $('importFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try { chooseSource(JSON.parse(await f.text()), f.name.replace(FILE_EXT, '')); if (!$('impDlg').open) $('impDlg').showModal(); }
    catch (err) { toast(`That file isn’t a Motif project or preset: ${err.message}.`); }
  });

  // ---------- project files ----------
  // Chrome and Edge can write real files to disk (File System Access API). Safari and Firefox cannot open folders,
  // so there Save keeps the project in this site's browser storage and Open lists what is stored there.
  const FS_FILE = typeof window.showSaveFilePicker === 'function' && typeof window.showOpenFilePicker === 'function';
  const FS_DIR = typeof window.showDirectoryPicker === 'function';
  $('saveBtn').dataset.tip = FS_FILE ? 'Save project to a file' : 'Save project in this browser'; $('loadBtn').dataset.tip = FS_FILE ? 'Open project from a file' : 'Open a saved project';
  const PROJ_KEY = 'motif6-projects', FILE_EXT = /\.(motif|json)$/i;
  const FILE_TYPES = [{ description: 'Motif project', accept: { 'application/json': ['.motif', '.json'] } }];
  const safeName = n => String(n || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled';
  const projectPayload = () => ({ format: 'motif6/project@1', app: 'Motif 6', id: projectId, name: projectName, savedAt: new Date().toISOString(), aspect, project: clone(project), clips: clone(clips), groups: clone(groups) });
  const fsdb = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => { try { const r = indexedDB.open('motif6-fs', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }));
    const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('kv', mode); const r = fn(t.objectStore('kv')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
    return { get: k => tx('readonly', s => s.get(k)), set: (k, v) => tx('readwrite', s => s.put(v, k)), del: k => tx('readwrite', s => s.delete(k)) };
  })();
  if (FS_DIR) fsdb.get('dir').then(h => { if (h && h.kind === 'directory') { dirHandle = h; if ($('projDlg').open) renderProjDialog(); } }).catch(() => { /* no remembered folder */ });
  async function ensurePerm(h, mode = 'readwrite') {
    if (!h || !h.queryPermission) return true;
    if ((await h.queryPermission({ mode })) === 'granted') return true;
    return (await h.requestPermission({ mode })) === 'granted';
  }
  async function writeFile(handle, text) { const w = await handle.createWritable(); await w.write(text); await w.close(); }
  function localProjects() { const all = store.get(PROJ_KEY); return all && typeof all === 'object' ? all : {}; }
  async function saveProject(o = {}) {
    try {
      if (FS_FILE) {
        let h = !o.as && fileHandle ? fileHandle : null, picked = false;
        if (!h && !o.as && dirHandle && await ensurePerm(dirHandle)) h = await dirHandle.getFileHandle(safeName(projectName) + '.motif', { create: true });
        if (!h) {
          const opts = { suggestedName: safeName(projectName) + '.motif', types: FILE_TYPES };
          if (dirHandle) opts.startIn = dirHandle;
          h = await window.showSaveFilePicker(opts); picked = true;
        }
        if (!(await ensurePerm(h))) { toast('Motif needs permission to write that file'); return false; }
        if (picked) projectName = h.name.replace(FILE_EXT, '').slice(0, 60);
        await writeFile(h, JSON.stringify(projectPayload()));
        fileHandle = h; dirty = false; updateNameUi(); autosave(); toast(`Saved ${h.name}`); return true;
      }
      const all = localProjects();
      const unnamed = /^(Demo project|Untitled( \d+)?)$/.test(projectName);
      if (o.as || (unnamed && !all[projectName])) { const n = await askText(o.as ? 'Save project as' : 'Name this project', 'Project name', unnamed ? 'My project' : projectName, 'Save'); if (!n) return false; projectName = n.slice(0, 60); }
      all[projectName] = projectPayload();
      try { localStorage.setItem(PROJ_KEY, JSON.stringify(all)); } catch (e) { toast('Browser storage is full. Delete an older project in Open, or use Export file.'); return false; }
      dirty = false; updateNameUi(); autosave(); toast(`Saved “${projectName}” in this browser`); return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
      console.error(e); toast(`Couldn’t save: ${e && e.message ? e.message : e}`); return false;
    }
  }
  // A project owns its clips and groups. Opening or starting a project swaps them out with it; nothing is shared.
  const cleanClip = c => (c && c.id && c.project && Array.isArray(c.project.layers) ? { id: String(c.id).slice(0, 40), name: String(c.name || 'Clip').slice(0, 60), group: c.group ? String(c.group).slice(0, 40) : null, project: c.project, aspect: c.aspect, thumb: typeof c.thumb === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(c.thumb) ? c.thumb : '', at: Number(c.at) || 0 } : null);
  const cleanGroup = g => (g && g.id ? { id: String(g.id).slice(0, 40), name: String(g.name || 'Group').slice(0, 40), open: g.open !== false } : null);
  // Start over from a given project: fresh undo history, its own clips, no audio or selection left over from the last one.
  function resetSession(pr, { name, id, handle = null, clipList = [], groupList = [], aspectId = null }) {
    if (evolveOpen) closeEvolve();
    if (arrMode) setArrange(false);
    if (audition) setAudition(null);
    player.clear(); analysis = null; envFn = null; trackName = ''; liveOn = false;
    locks.clear(); selKey = null; arrUi.sel.clear(); arrUi.fx = null; arrUi.region = null;
    groups = groupList.map(cleanGroup).filter(Boolean); clips = clipList.map(cleanClip).filter(Boolean); saveClips(); renderClips();
    if (aspectId && ASPECTS.some(a => a.id === aspectId)) setAspect(aspectId);
    projectName = String(name || 'Untitled').slice(0, 60); projectId = id || newId('p'); fileHandle = handle;
    project = T.sanitizeProject(pr, C.sanitizeCustom); history.length = 0; history.push(JSON.stringify(project)); cursor = 0; dirty = false;
    stage.setSpace(project.output.space); stage.seek(0); syncAudioRegion(); refresh(); updateNameUi(); saveNow();
  }
  function loadProjectData(data, { handle = null, name = null } = {}) {
    const pr = data && (data.project || (data.layers ? data : null));
    if (!pr || !Array.isArray(pr.layers)) throw new Error('this file has no Motif project in it');
    const miss = K.missingKits(pr);
    if (miss.length) { toast(`This project needs the ${miss.join(', ')} kit${miss.length > 1 ? 's' : ''}. Install ${miss.length > 1 ? 'them' : 'it'} in the Kits tab first.`); setTab('kits'); return false; }
    resetSession(pr, { name: name || data.name, id: data.id ? String(data.id).slice(0, 40) : null, handle, clipList: Array.isArray(data.clips) ? data.clips : [], groupList: Array.isArray(data.groups) ? data.groups : [], aspectId: data.aspect });
    toast(`Opened ${projectName}`);
    return true;
  }
  // ---- unsaved changes, and New: a blank project with none of the previous project's clips ----
  function confirmChoice(title, body, buttons) {
    return new Promise(resolve => {
      const d = $('confirmDlg'); let out = 'cancel';
      $('confirmTitle').textContent = title; $('confirmBody').textContent = body;
      $('confirmBtns').innerHTML = buttons.map(b => `<button class="btn${b.primary ? ' primary' : ''}" data-choice="${b.id}">${esc(b.label)}</button>`).join('');
      const done = () => { d.removeEventListener('close', done); resolve(out); };
      d.addEventListener('close', done);
      $('confirmBtns').onclick = e => { const b = e.target.closest('[data-choice]'); if (!b) return; out = b.dataset.choice; d.close(); };
      $('confirmClose').onclick = () => { out = 'cancel'; d.close(); };
      d.showModal();
    });
  }
  async function guardUnsaved(action) {
    if (!dirty) return true;
    const c = await confirmChoice('Unsaved changes', `“${projectName}” has changes that aren’t saved. Save them before you ${action}?`, [{ id: 'cancel', label: 'Cancel' }, { id: 'discard', label: 'Don’t save' }, { id: 'save', label: 'Save', primary: true }]);
    if (c === 'cancel') return false;
    if (c === 'save') return saveProject();
    return true;
  }
  const uniqueName = base => { const taken = new Set(Object.keys(localProjects())); let n = base, i = 1; while (taken.has(n)) n = `${base} ${++i}`; return n; };
  async function newProject() {
    if (!(await guardUnsaved('start a new project'))) return;
    resetSession(T.newProject(), { name: uniqueName('Untitled'), id: newId('p') });
    setTab('layer'); toast('New project · a blank slate');
  }
  $('newBtn').addEventListener('click', newProject);
  async function openFileHandle(h) {
    const f = await h.getFile(), data = JSON.parse(await f.text());
    if (!(await guardUnsaved('open another project'))) return;
    if (loadProjectData(data, { handle: h, name: h.name.replace(FILE_EXT, '') })) $('projDlg').close();
  }
  async function projList() {
    const rows = [];
    if (dirHandle) {
      let ok = false; try { ok = (await dirHandle.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch (e) { /* stale handle */ }
      if (!ok) return { needPerm: true, rows };
      for await (const [n, h] of dirHandle.entries()) if (h.kind === 'file' && FILE_EXT.test(n)) { let at = 0; try { at = (await h.getFile()).lastModified; } catch (e) { /* unreadable */ } rows.push({ name: n, at }); }
      rows.sort((a, b) => b.at - a.at);
    }
    return { rows };
  }
  const when = at => { if (!at) return ''; const d = new Date(at); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); };
  async function renderProjDialog() {
    const body = $('projBody'), local = localProjects(), names = Object.keys(local).sort((a, b) => String(local[b].savedAt).localeCompare(String(local[a].savedAt)));
    let disk = '';
    if (FS_FILE) {
      const pl = FS_DIR && dirHandle ? await projList().catch(() => ({ rows: [] })) : { rows: [] };
      disk = `<section class="pd-sec"><h3>On this computer</h3>
        <div class="btnrow"><button class="btn primary" id="pdOpenFile">Open file…</button>${FS_DIR ? `<button class="btn" id="pdPickDir">${dirHandle ? 'Change project folder…' : 'Choose project folder…'}</button>` : ''}</div>
        ${FS_DIR && dirHandle ? `<p class="pd-note">Project folder <b>${esc(dirHandle.name)}</b> · Save writes here <button class="btn sm ghost" id="pdForget">Forget</button></p>${pl.needPerm ? '<div class="btnrow"><button class="btn sm" id="pdAllow">Allow access to this folder</button></div>' : pl.rows.length ? `<ul class="pd-list">${pl.rows.map(r => `<li><span class="pd-n">${esc(r.name.replace(FILE_EXT, ''))}</span><span class="pd-d">${when(r.at)}</span><button class="btn sm" data-pd-file="${esc(r.name)}">Open</button></li>`).join('')}</ul>` : '<p class="pd-note">No Motif projects in this folder yet.</p>'}` : FS_DIR ? '<p class="pd-note">Pick a folder once and Save writes there. Open lists what is in it.</p>' : ''}
      </section>`;
    } else {
      disk = `<section class="pd-sec"><h3>Files</h3><p class="pd-note">${/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ? 'Safari' : 'This browser'} can’t open folders on your computer, so Save keeps projects in this browser. You can still move a project as a file.</p>
        <div class="btnrow"><button class="btn" id="pdImport">Import file…</button><button class="btn" id="pdExport">Export file</button></div></section>`;
    }
    const inBrowser = `<section class="pd-sec"><h3>In this browser</h3>${names.length ? `<ul class="pd-list">${names.map(n => `<li><span class="pd-n">${esc(n)}</span><span class="pd-d">${when(Date.parse(local[n].savedAt))}</span><button class="btn sm" data-pd-local="${esc(n)}">Open</button><button class="btn sm ghost" data-pd-del="${esc(n)}" aria-label="Delete ${esc(n)}">Delete</button></li>`).join('')}</ul>` : `<p class="pd-note">${FS_FILE ? 'Nothing stored in this browser.' : 'No saved projects yet. Press Save (⌘S) to keep this one here.'}</p>`}</section>`;
    body.innerHTML = (FS_FILE ? disk + inBrowser : inBrowser + disk);
  }
  function openProjectDialog() { const d = $('projDlg'); if (!d.open) d.showModal(); renderProjDialog(); }
  $('saveBtn').addEventListener('click', e => saveProject({ as: e.shiftKey }));
  $('loadBtn').addEventListener('click', openProjectDialog);
  $('projClose').addEventListener('click', () => $('projDlg').close()); $('projDone').addEventListener('click', () => $('projDlg').close());
  $('projSaveAs').addEventListener('click', async () => { if (await saveProject({ as: true })) renderProjDialog(); });
  const pdFile = Object.assign(document.createElement('input'), { type: 'file', accept: '.motif,.json,application/json', hidden: true }); document.body.appendChild(pdFile);
  pdFile.addEventListener('change', async () => {
    const f = pdFile.files && pdFile.files[0]; pdFile.value = ''; if (!f) return;
    try { const data = JSON.parse(await f.text()); if (!(await guardUnsaved('open another project'))) return; if (loadProjectData(data, { name: f.name.replace(FILE_EXT, '') })) $('projDlg').close(); } catch (err) { toast(`That file isn’t a Motif project: ${err.message}`); }
  });
  $('projBody').addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    try {
      if (t.id === 'pdOpenFile') { const [h] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false }); await openFileHandle(h); }
      else if (t.id === 'pdPickDir') { const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'motif6' }); dirHandle = h; await fsdb.set('dir', h).catch(() => { /* not remembered */ }); renderProjDialog(); }
      else if (t.id === 'pdForget') { dirHandle = null; await fsdb.del('dir').catch(() => { /* nothing stored */ }); renderProjDialog(); }
      else if (t.id === 'pdAllow') { if (await ensurePerm(dirHandle)) renderProjDialog(); }
      else if (t.dataset.pdFile) { if (!(await ensurePerm(dirHandle))) return; await openFileHandle(await dirHandle.getFileHandle(t.dataset.pdFile)); }
      else if (t.dataset.pdLocal) { const d = localProjects()[t.dataset.pdLocal]; if (d && (await guardUnsaved('open another project')) && loadProjectData(d, { name: t.dataset.pdLocal })) $('projDlg').close(); }
      else if (t.dataset.pdDel) { const n = t.dataset.pdDel; if (!confirm(`Delete “${n}” from this browser?`)) return; const all = localProjects(); delete all[n]; store.set(PROJ_KEY, all); renderProjDialog(); }
      else if (t.id === 'pdImport') pdFile.click();
      else if (t.id === 'pdExport') { await saveFile(`${safeName(projectName)}.motif`, new Blob([JSON.stringify(projectPayload())], { type: 'application/json' })); toast('Exported a copy'); }
    } catch (err) { if (err && err.name === 'AbortError') return; console.error(err); toast(`Couldn’t do that: ${err && err.message ? err.message : err}`); }
  });
  addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
    if (mod && !e.altKey && (k === 's' || k === 'o')) { e.preventDefault(); e.stopPropagation(); if (document.querySelector('dialog[open]')) return; if (k === 's') saveProject({ as: e.shiftKey }); else openProjectDialog(); return; }
    if (e.altKey && !mod && e.code === 'KeyA') { const tg = e.target, tag = tg.tagName; if ((tag === 'INPUT' && ['text', 'search', 'number'].includes(tg.type)) || tag === 'TEXTAREA') return; if (document.querySelector('dialog[open]')) return; e.preventDefault(); setArrange(!arrMode); }
    if (e.altKey && !mod && e.code === 'KeyN') { const tg = e.target, tag = tg.tagName; if ((tag === 'INPUT' && ['text', 'search', 'number'].includes(tg.type)) || tag === 'TEXTAREA') return; if (document.querySelector('dialog[open]')) return; e.preventDefault(); newProject(); }
  }, true);

  // ---------- viewer tools: Move picks and drags layers, Grid draws guides and snaps ----------
  const posPaths = id => [lpath('s', 'posX', id), lpath('s', 'posY', id)];
  const setAt = (pr, path, v) => (pr.keys[path] ? T.setKey(pr, path, uNow(), v) : T.setBase(pr, path, v));
  function setMoveTool(on) {
    if (on && arrMode) { toast('Leave Arrange to move layers'); on = false; }
    moveTool = !!on; $('toolMove').setAttribute('aria-pressed', moveTool); $('moveLayer').hidden = !moveTool; app.dataset.tool = moveTool ? 'move' : '';
    updateReticle();
  }
  function setGrid(on) { gridOn = !!on; $('toolGrid').setAttribute('aria-pressed', gridOn); $('gridN').hidden = !gridOn; $('gridOv').hidden = !gridOn; if (gridOn) drawGrid(); }
  function drawGrid() {
    const ov = $('gridOv'); if (ov.hidden) return;
    const W = $('stageBox').clientWidth, H = $('stageBox').clientHeight; if (!W || !H) return;
    const cell = W / gridN, cx = W / 2, cy = H / 2; let d = '', c = '';
    const sv = $('gridSvg'); sv.setAttribute('viewBox', `0 0 ${W} ${H}`);
    for (let k = -Math.ceil(cx / cell); k <= Math.ceil(cx / cell); k++) { const x = cx + k * cell; if (x < 0.5 || x > W - 0.5) continue; if (k === 0) c += `M${x.toFixed(1)} 0V${H}`; else d += `M${x.toFixed(1)} 0V${H}`; }
    for (let k = -Math.ceil(cy / cell); k <= Math.ceil(cy / cell); k++) { const y = cy + k * cell; if (y < 0.5 || y > H - 0.5) continue; if (k === 0) c += `M0 ${y.toFixed(1)}H${W}`; else d += `M0 ${y.toFixed(1)}H${W}`; }
    sv.innerHTML = `<path class="gl" d="${d}"/><path class="gc" d="${c}"/>`;
  }
  new ResizeObserver(() => { drawGrid(); updateReticle(); }).observe($('stageBox'));
  $('toolMove').addEventListener('click', () => setMoveTool(!moveTool));
  $('toolGrid').addEventListener('click', () => setGrid(!gridOn));
  $('gridN').value = String(gridN); $('gridN').addEventListener('change', e => { gridN = Number(e.target.value) || 8; drawGrid(); });
  function updateReticle() {
    const r = $('reticle'); if (!r) return;
    if (!moveTool || arrMode) { r.hidden = true; return; }
    const W = $('stageBox').clientWidth, H = $('stageBox').clientHeight, l = active(), li = project.layers.indexOf(l);
    const px = shownValue(lpath('s', 'posX')) || 0, py = shownValue(lpath('s', 'posY')) || 0;
    r.hidden = false; r.style.left = (W / 2 + px * W) + 'px'; r.style.top = (H / 2 + py * H) + 'px';
    $('reticleTag').textContent = `V${li + 1} · ${getStyle(l.styleId).name}`;
  }
  // Which layer is under the pointer: render each layer alone (small, transparent) and look for ink near the point, top layer first.
  const pickCv = document.createElement('canvas');
  function pickLayerAt(px, py, w, h) {
    const W = 360, H = Math.max(2, Math.round(W * h / w)); pickCv.width = W; pickCv.height = H;
    const x = pickCv.getContext('2d', { willReadFrequently: true }), gx = Math.round(px / w * W), gy = Math.round(py / h * H), R = 7;
    const ev = T.evaluate(project, stage.time, currentEnv());
    for (let i = ev.layers.length - 1; i >= 0; i--) {
      const l = ev.layers[i]; if (!l.visible) continue;
      x.clearRect(0, 0, W, H);
      try {
        const pal = C.resolvePalette(l.shared.palette, l.shared.invert, project.palettes, l.pmix && l.pmix.to, l.pmix && l.pmix.t);
        pipeline.compositor.renderLook(x, W, H, l, stage.time, pal, { bg: false, cpu: true });
        const x0 = clamp(gx - R, 0, W - 1), y0 = clamp(gy - R, 0, H - 1), d = x.getImageData(x0, y0, Math.min(2 * R + 1, W - x0), Math.min(2 * R + 1, H - y0)).data;
        for (let k = 3; k < d.length; k += 4) if (d[k] > 24) return l.id;
      } catch (err) { /* a layer that cannot draw here is skipped */ }
    }
    return null;
  }
  (() => {
    const ml = $('moveLayer'), hud = $('moveHud'); let mv = null;
    ml.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const r = ml.getBoundingClientRect(), hit = pickLayerAt(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
      if (hit && hit !== project.active) selectLayer(hit);
      const id = project.active; if (T.layerById(project, id) == null) return;
      mv = { id: e.pointerId, x0: e.clientX, y0: e.clientY, w: r.width, h: r.height, layer: id, fx0: shownValue(lpath('s', 'posX', id)) || 0, fy0: shownValue(lpath('s', 'posY', id)) || 0, moved: false };
      try { ml.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
      ml.classList.add('grab'); if (!hit) toast('Nothing under the pointer · moving the selected layer');
    });
    ml.addEventListener('pointermove', e => {
      if (!mv || e.pointerId !== mv.id) return;
      const dx = e.clientX - mv.x0, dy = e.clientY - mv.y0; if (!mv.moved && Math.hypot(dx, dy) < 3) return; mv.moved = true;
      let fx = mv.fx0 + dx / mv.w, fy = mv.fy0 + dy / mv.h;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) fy = mv.fy0; else fx = mv.fx0; }
      if (!e.altKey) {
        if (gridOn) { const cell = mv.w / gridN; fx = Math.round(fx * mv.w / cell) * cell / mv.w; fy = Math.round(fy * mv.h / cell) * cell / mv.h; }
        else { if (Math.abs(fx * mv.w) < 6) fx = 0; if (Math.abs(fy * mv.h) < 6) fy = 0; } // magnetic centre
      }
      fx = clamp(+fx.toFixed(4), -1, 1); fy = clamp(+fy.toFixed(4), -1, 1);
      const [px, py] = posPaths(mv.layer); live(setAt(setAt(project, px, fx), py, fy));
      hud.hidden = false; hud.textContent = `X ${fx.toFixed(3)}   Y ${fy.toFixed(3)}${gridOn && !e.altKey ? '   · snapped' : ''}`;
      hud.style.left = clamp(e.clientX - ml.getBoundingClientRect().left + 14, 4, mv.w - 150) + 'px'; hud.style.top = clamp(e.clientY - ml.getBoundingClientRect().top + 14, 4, mv.h - 26) + 'px';
      updateReticle();
    });
    const end = e => { if (!mv || (e && e.pointerId !== mv.id)) return; const m = mv; mv = null; ml.classList.remove('grab'); hud.hidden = true; if (m.moved) commit(project, 'Layer moved'); };
    ml.addEventListener('pointerup', end); ml.addEventListener('pointercancel', end);
    ml.addEventListener('dblclick', e => { const [px, py] = posPaths(project.active); let pr = setAt(project, px, 0); pr = setAt(pr, py, 0); commit(pr, 'Layer centred'); e.preventDefault(); });
  })();

  // ---------- Arrange: three tracks of clips, with trim, loop, opacity and transition regions ----------
  const LBL_W = 92, ROW_H = 60;
  const itemEnd = it => it.start + it.dur;
  function arrDuration() { const e = Math.max(0, ...project.arrange.items.map(itemEnd)); return e > 0 ? Math.max(1, e) : 6; }
  const fmtT = s => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 9.95 ? '0' : ''}${r.toFixed(1)}`; };
  const arrColor = id => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0; return `var(--clip-${Math.abs(h) % 6 + 1})`; };
  const trName = tr => `V${tr + 1}`;
  const itemAt = (track, time) => { let best = null; for (const it of project.arrange.items) if (it.track === track && it.start <= time + 1e-6 && time < itemEnd(it) - 1e-6 && (!best || it.start > best.start)) best = it; return best; };

  // -- transition shaders (WebGL2): A is the outgoing clip, B the incoming one, p runs 0 → 1 across the region --
  const trans = (() => {
    const STYLE_IX = Object.fromEntries(T.TRANSITIONS.map((t, i) => [t.v, i]));
    const VS = '#version 300 es\nin vec2 p; out vec2 v; void main(){ v = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }';
    const FS = `#version 300 es
precision highp float;
in vec2 v; out vec4 o;
uniform sampler2D uA, uB; uniform float uP, uOpA, uOpB, uHasA, uHasB, uAsp; uniform int uS;
vec4 A(vec2 q){ if(q.x<0.||q.x>1.||q.y<0.||q.y>1.) return vec4(0.); return texture(uA,q)*uOpA*uHasA; }
vec4 B(vec2 q){ if(q.x<0.||q.x>1.||q.y<0.||q.y>1.) return vec4(0.); return texture(uB,q)*uOpB*uHasB; }
float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y); }
float fbm(vec2 p){ return .5*vn(p)+.25*vn(p*2.03)+.125*vn(p*4.1)+.0625*vn(p*8.3); }
void main(){
  vec2 q = v; float p = uP; float e = p*p*(3.-2.*p); vec4 c; vec2 ct = vec2(.5); vec2 d = (q-ct)*vec2(uAsp,1.);
  if(uS==0){ c = mix(A(q),B(q),e); }
  else if(uS==1){ float m = 1.-smoothstep(e*1.08-.08, e*1.08, q.x); c = mix(A(q),B(q),m); }
  else if(uS==2){ float x=e; c = q.x < 1.-x ? A(q+vec2(x,0.)) : B(q-vec2(1.-x,0.)); }
  else if(uS==3){ float s1=1.+e*.5, s2=1.5-e*.5; vec4 a=A(ct+(q-ct)/s1), b=B(ct+(q-ct)/s2); c = mix(a,b,smoothstep(.15,.85,p)); }
  else if(uS==4){ float r = e*1.05*length(vec2(uAsp,1.))*.5; float m = 1.-smoothstep(r-.03,r,length(d)); c = mix(A(q),B(q),m); }
  else if(uS==5){ float ang = atan(q.x-.5, .5-q.y)/6.2831853 + .5; float m = 1.-smoothstep(e*1.02-.02, e*1.02, ang); c = mix(A(q),B(q),m); }
  else if(uS==6){ float bl = sin(p*3.14159)*.035; vec4 a=vec4(0.), b=vec4(0.); for(int i=0;i<12;i++){ float ang=float(i)*.5236; vec2 o2=vec2(cos(ang),sin(ang))*bl*(.35+.65*fract(float(i)*.618)); a+=A(q+o2); b+=B(q+o2);} a/=12.; b/=12.; c = mix(a,b,e); }
  else if(uS==7){ float cells = mix(480.,14.,sin(p*3.14159)); vec2 g = vec2(cells*uAsp, cells); vec2 qq=(floor(q*g)+.5)/g; c = mix(A(qq),B(qq),smoothstep(.3,.7,p)); }
  else if(uS==8){ float row=floor(q.y*28.); float rs=h21(vec2(row,floor(p*14.))); float amt=sin(p*3.14159); float sh=(rs-.5)*.28*amt*step(.55,rs); vec2 qa=vec2(q.x+sh,q.y); float pick = step(h21(vec2(row,7.7)), e); vec2 sp=vec2(.012*amt,0.); c = mix(A(qa),B(qa),pick); c.r = mix(A(qa+sp).r, B(qa+sp).r, pick); c.b = mix(A(qa-sp).b, B(qa-sp).b, pick); }
  else if(uS==9){ float n = fbm(q*vec2(uAsp,1.)*5.); float m = smoothstep(n-.06,n+.06, p*1.12-.06); c = mix(A(q),B(q),m); }
  else { float x=e; vec4 a=vec4(0.), b=vec4(0.); float bl=sin(p*3.14159)*.12; for(int i=0;i<10;i++){ float k=float(i)/9.-.5; a+=A(q+vec2(x+k*bl,0.)); b+=B(q-vec2(1.-x,0.)+vec2(k*bl,0.)); } a/=10.; b/=10.; c = q.x < 1.-x ? a : b; }
  o = c;
}`;
    let gl = null, cv = null, failed = false, texA = null, texB = null; const U = {};
    const mkTex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); return t; };
    function init() {
      try {
        cv = document.createElement('canvas'); cv.width = cv.height = 2;
        gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true }); if (!gl) throw new Error('no WebGL2');
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
        const pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pg);
        if (!gl.getProgramParameter(pg, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pg));
        gl.useProgram(pg); const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(pg, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        for (const n of ['uA', 'uB', 'uP', 'uOpA', 'uOpB', 'uHasA', 'uHasB', 'uAsp', 'uS']) U[n] = gl.getUniformLocation(pg, n);
        texA = mkTex(); texB = mkTex();
      } catch (err) { failed = true; gl = null; console.warn('Arrange transitions fall back to cross-fades:', err); }
    }
    function run(style, ca, cb, opA, opB, p, w, h) {
      if (failed) return null; if (!gl) init(); if (!gl) return null;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      const up = (unit, tex, src) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); };
      up(0, texA, ca); up(1, texB, cb);
      gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1); gl.uniform1f(U.uP, p); gl.uniform1f(U.uOpA, opA); gl.uniform1f(U.uOpB, opB);
      gl.uniform1f(U.uHasA, ca ? 1 : 0); gl.uniform1f(U.uHasB, cb ? 1 : 0); gl.uniform1f(U.uAsp, w / h); gl.uniform1i(U.uS, STYLE_IX[style] || 0);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return cv;
    }
    return { run };
  })();

  // -- rendering the sequence --
  const arrPool = new Map();
  function arrCanvas(slot, w, h) { let c = arrPool.get(slot); if (!c) { c = document.createElement('canvas'); arrPool.set(slot, c); } if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; }
  // One clip's frame at sequence time t. Clips are procedural loops, so a clip looks the same before its start and after its end:
  // transitions read past the edges of a clip with no handles to render.
  function drawClipFrame(item, t, w, h, slot, opts) {
    const clip = clipById(item.clip); if (!clip) return null;
    const c = arrCanvas(slot, w, h), L = clipLoop(clip), lt = wrapPos(t - item.start + item.off, L);
    try { pipeline.renderFrame(c.getContext('2d'), w, h, clipProject(clip), lt, { preview: !!opts.preview, previewSamples: 4, onError: e => console.error(e) }); } catch (err) { console.error(err); return null; }
    return c;
  }
  function runTrans(ctx, style, A, B, p, t, w, h, opts) {
    const ca = A ? drawClipFrame(A, t, w, h, 'A', opts) : null, cb = B ? drawClipFrame(B, t, w, h, 'B', opts) : null;
    if (!ca && !cb) return false;
    const out = trans.run(style, ca, cb, A ? A.opacity : 0, B ? B.opacity : 0, p, w, h);
    if (out) { ctx.drawImage(out, 0, 0, w, h); return true; }
    if (ca) { ctx.globalAlpha = A.opacity * (1 - p); ctx.drawImage(ca, 0, 0); }
    if (cb) { ctx.globalAlpha = B.opacity * p; ctx.drawImage(cb, 0, 0); }
    ctx.globalAlpha = 1; return true;
  }
  function arrDraw(ctx, w, h, t, opts = {}) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const arr = project.arrange;
    for (let tr = 0; tr < T.ARR_TRACKS; tr++) {
      const fx = arr.fx.find(f => f.track === tr && t >= f.a - 1e-6 && t <= f.b + 1e-6);
      let done = false;
      if (fx) {
        // A = the clip playing when the region opens, B = the clip playing when it closes. Same clip: dip out and back in.
        const p = clamp((t - fx.a) / (fx.b - fx.a), 0, 1), A = itemAt(tr, fx.a), B = itemAt(tr, fx.b - 1e-4);
        if (A && B && A.id === B.id) done = p < 0.5 ? runTrans(ctx, fx.style, A, null, p * 2, t, w, h, opts) : runTrans(ctx, fx.style, null, B, (p - 0.5) * 2, t, w, h, opts);
        else if (A || B) done = runTrans(ctx, fx.style, A, B, p, t, w, h, opts);
      }
      if (!done) { const it = itemAt(tr, t); const c = it && drawClipFrame(it, t, w, h, 'A', opts); if (c) { ctx.globalAlpha = it.opacity; ctx.drawImage(c, 0, 0); ctx.globalAlpha = 1; } }
    }
    if (!arr.items.length && opts.preview !== false) { ctx.fillStyle = '#ffffff55'; ctx.font = `500 ${Math.max(12, Math.round(h / 22))}px "IBM Plex Sans",system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.fillText('Arrange · drag clips from the Clips tab onto a track', w / 2, h / 2); }
    ctx.restore();
    return { engines: [], samples: 1, post: 'arrange' };
  }
  const arrSource = { duration: arrDuration, draw: (ctx, w, h, t, o) => arrDraw(ctx, w, h, t, { preview: !!(o && o.preview) }) };
  const arrangeSource = () => ({ duration: arrDuration(), draw: (ctx, w, h, t) => arrDraw(ctx, w, h, t, { preview: false }) });

  // -- editing --
  function fitStart(list, track, start, dur) {
    const on = list.filter(i => i.track === track);
    const free = s => on.every(i => s + dur <= i.start + 1e-6 || s >= itemEnd(i) - 1e-6);
    start = Math.max(0, start); if (free(start)) return start;
    const cands = [0]; for (const i of on) { cands.push(itemEnd(i)); cands.push(i.start - dur); }
    let best = null; for (const c of cands) { const cc = Math.max(0, c); if (!free(cc)) continue; if (best === null || Math.abs(cc - start) < Math.abs(best - start)) best = cc; }
    return best === null ? start : best;
  }
  const trackEnd = track => Math.max(0, ...project.arrange.items.filter(i => i.track === track).map(itemEnd));
  function addClipToArrange(clipId, o = {}) {
    const c = clipById(clipId); if (!c) return null;
    const track = o.track != null ? o.track : 0, dur = clipLoop(c);
    const start = fitStart(project.arrange.items, track, o.start != null ? o.start : trackEnd(track), dur);
    const it = { id: newId('i'), clip: c.id, track, start, dur, off: 0, opacity: 1 };
    const next = clone(project); next.arrange.items.push(it);
    arrUi.sel = new Set([it.id]); arrUi.fx = null;
    if (!arrMode && !o.quiet) setArrange(true);
    commit(next, o.quiet ? '' : `Added ${c.name} to ${trName(track)}`);
    return it;
  }
  function addCurrentToArrange() { const c = saveLook(); addClipToArrange(c.id); }
  const selItems = () => [...arrUi.sel].map(id => project.arrange.items.find(i => i.id === id)).filter(Boolean);
  function splitAtPlayhead() {
    const t = stage.time; let targets = selItems().filter(i => t > i.start + 0.1 && t < itemEnd(i) - 0.1);
    if (!targets.length) { for (let tr = T.ARR_TRACKS - 1; tr >= 0 && !targets.length; tr--) { const it = itemAt(tr, t); if (it && t > it.start + 0.1 && t < itemEnd(it) - 0.1) targets = [it]; } }
    if (!targets.length) { toast('Move the playhead inside a clip to split it'); return; }
    const next = clone(project), made = [];
    for (const it of targets) {
      const n = next.arrange.items.find(i => i.id === it.id), c = clipById(n.clip), L = c ? clipLoop(c) : n.dur, cut = t - n.start;
      const right = { ...n, id: newId('i'), start: t, dur: n.dur - cut, off: wrapPos(n.off + cut, L) }; n.dur = cut; next.arrange.items.push(right); made.push(right.id);
    }
    arrUi.sel = new Set(made); commit(next, `Split ${targets.length > 1 ? targets.length + ' clips' : 'clip'}`);
  }
  function duplicateSelected() {
    const items = selItems(); if (!items.length) { toast('Select a clip first'); return; }
    const next = clone(project), made = [];
    for (const it of items) { const start = fitStart(next.arrange.items, it.track, itemEnd(it), it.dur); const copy = { ...it, id: newId('i'), start }; next.arrange.items.push(copy); made.push(copy.id); }
    arrUi.sel = new Set(made); commit(next, 'Duplicated');
  }
  function deleteSelected() {
    if (arrUi.fx) { const next = clone(project); next.arrange.fx = next.arrange.fx.filter(f => f.id !== arrUi.fx); arrUi.fx = null; commit(next, 'Transition removed'); return; }
    if (!arrUi.sel.size) return;
    const next = clone(project); const n = arrUi.sel.size; next.arrange.items = next.arrange.items.filter(i => !arrUi.sel.has(i.id)); arrUi.sel.clear(); commit(next, `Removed ${n} clip${n > 1 ? 's' : ''}`);
  }
  function applyTransition(style) {
    const r = arrUi.region, label = (T.TRANSITIONS.find(t => t.v === style) || {}).l || style;
    if (arrUi.fx) { const next = clone(project); const f = next.arrange.fx.find(x => x.id === arrUi.fx); if (f) { f.style = style; commit(next, `Transition: ${label}`); } return; }
    if (!r) return;
    const next = clone(project); let first = null;
    for (let tr = r.t0; tr <= r.t1; tr++) {
      if (!itemAt(tr, r.a) && !itemAt(tr, r.b - 1e-4)) continue;
      next.arrange.fx = next.arrange.fx.filter(f => !(f.track === tr && f.a < r.b - 1e-6 && f.b > r.a + 1e-6));
      const f = { id: newId('x'), style, track: tr, a: r.a, b: r.b }; next.arrange.fx.push(f); first = first || f;
    }
    if (!first) { toast('No clips inside that region · drag across a clip or a cut'); return; }
    arrUi.region = null; arrUi.fx = first.id; arrUi.sel.clear(); commit(next, `${label} applied`);
  }
  // quick regions from the selected clip: its head, its tail, or the cut that follows it
  function quickRegion(kind) {
    const it = selItems()[0]; if (!it) return; const span = Math.min(1, it.dur / 2), end = itemEnd(it);
    let a, b;
    if (kind === 'head') { a = it.start; b = it.start + span; }
    else if (kind === 'tail') { a = end - span; b = end; }
    else { const nx = project.arrange.items.filter(i => i.track === it.track && i.start >= end - 1e-6).sort((x, y) => x.start - y.start)[0]; if (!nx) { toast('No clip after this one on the track'); return; } const cut = (end + nx.start) / 2, half = Math.min(0.5, it.dur / 2, nx.dur / 2); a = cut - half; b = cut + half; }
    arrUi.region = { a: Math.max(0, a), b, t0: it.track, t1: it.track }; arrUi.fx = null; renderArrHead(); renderArrBody();
  }

  // -- view --
  const tick = pps => { const want = 80 / pps; return [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find(s => s >= want) || 300; };
  const SVG = {
    select: '<path d="M5 3.5 18.5 11l-6 1.8-2.3 5.7z"/>',
    region: '<rect x="3.5" y="6.5" width="17" height="11" rx="1" stroke-dasharray="3 2.4"/><path d="M8 10v4M16 10v4"/>',
    split: '<path d="M12 3v18"/><path d="M7 8l5-5 5 5M7 16l5 5 5-5" opacity=".55"/>',
    dup: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    del: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
    snap: '<path d="M6 3v7a6 6 0 0 0 12 0V3h-4v7a2 2 0 0 1-4 0V3z"/><path d="M6 6.5h4M14 6.5h4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', fit: '<path d="M4 12h5M15 12h5M6.5 9.5 4 12l2.5 2.5M17.5 9.5 20 12l-2.5 2.5"/>',
    cur: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  };
  const ab = (act, icon, tip, kbd, on) => `<button class="btn ghost icon" data-a="${act}" aria-label="${tip}"${on != null ? ` aria-pressed="${on}"` : ''} data-tip="${tip}"${kbd ? ` data-kbd="${kbd}"` : ''}><svg class="i" viewBox="0 0 24 24">${SVG[icon]}</svg></button>`;
  function arrHeadHtml() {
    const items = selItems(), one = items.length === 1 ? items[0] : null;
    const fx = arrUi.fx && project.arrange.fx.find(f => f.id === arrUi.fx), r = arrUi.region;
    const can = !!(fx || r), dur = arrDuration();
    const opv = items.length ? Math.round(items[0].opacity * 100) : 100;
    const c1 = one && clipById(one.clip), L1 = c1 ? clipLoop(c1) : 0;
    const regTxt = fx ? `${trName(fx.track)} · ${fmtT(fx.a)}–${fmtT(fx.b)}` : r ? `${r.t0 === r.t1 ? trName(r.t0) : trName(r.t0) + '–' + trName(r.t1)} · ${fmtT(r.a)}–${fmtT(r.b)}` : '';
    return `<div class="arr-strip"><div class="sh-l"><span class="readout">${fmtT(dur)} · ${T.ARR_TRACKS} tracks</span></div>${surfSeg()}<div class="sh-r"><span class="arr-right">
      ${ab('snap', 'snap', 'Snap to clip edges and playhead', '', arrUi.snap)}
      ${ab('zoomout', 'minus', 'Zoom out', 'Pinch')}${ab('zoomin', 'plus', 'Zoom in', 'Pinch')}${ab('fit', 'fit', 'Fit sequence')}
      <button class="btn sm" data-a="addcur" data-tip="Save the working project as a clip and add it to V1">${`<svg class="i" viewBox="0 0 24 24">${SVG.cur}</svg>`} Add current</button></span></div></div>
      <div class="arr-tools"><div class="seg" role="group" aria-label="Arrange tool"><button data-a="tool-select" aria-pressed="${arrUi.tool === 'select'}" aria-label="Select tool" data-tip="Select · move, trim, loop" data-kbd="V"><svg class="i" viewBox="0 0 24 24">${SVG.select}</svg></button><button data-a="tool-region" aria-pressed="${arrUi.tool === 'region'}" aria-label="Region tool" data-tip="Region · drag across clips to choose where a transition goes" data-kbd="Shift-drag"><svg class="i" viewBox="0 0 24 24">${SVG.region}</svg></button></div>
      ${ab('split', 'split', 'Split at playhead', 'B')}${ab('dup', 'dup', 'Duplicate', 'D')}${ab('del', 'del', 'Remove', '⌫')}
      <span class="sep" aria-hidden="true"></span>
      ${items.length ? `<label class="arr-op" title="Opacity of the selected clip${items.length > 1 ? 's' : ''}"><span>Opacity</span><input type="range" id="arrOp" min="0" max="100" step="1" value="${opv}" aria-label="Clip opacity"><output id="arrOpV">${opv}%</output></label>
        <span class="readout">${one ? `${esc(c1 ? c1.name : 'Missing clip')} · ${one.dur.toFixed(1)} s${L1 ? ` · ×${(one.dur / L1).toFixed(2)} loop` : ''}${one.off > 0.01 ? ' · cropped' : ''}` : `${items.length} clips`}</span>
        ${one ? `<span class="quick"><button class="btn sm ghost" data-a="q-head" data-tip="Region over the start of this clip">Head</button><button class="btn sm ghost" data-a="q-tail" data-tip="Region over the end of this clip">Tail</button><button class="btn sm ghost" data-a="q-cut" data-tip="Region across the cut to the next clip">Cut</button></span>` : ''}` : '<span class="readout dim">Select a clip · drag edges to crop or loop</span>'}
      <span class="sep" aria-hidden="true"></span>
      <label class="arr-tr"><span>Transition</span><select id="arrStyle" aria-label="Transition style"${can ? '' : ' disabled'}>${fx ? '' : '<option value="" selected disabled>Choose…</option>'}${T.TRANSITIONS.map(t => `<option value="${t.v}"${fx && fx.style === t.v ? ' selected' : ''}>${t.l}</option>`).join('')}</select></label>
      ${can ? `<span class="readout">${regTxt}</span>${fx ? '<button class="btn sm" data-a="fx-remove">Remove</button>' : '<button class="btn sm ghost" data-a="region-clear">Clear</button>'}` : '<span class="readout dim">Region tool: drag across clips</span>'}
      </div>`;
  }
  function itemHtml(it, pps) {
    const c = clipById(it.clip), L = c ? clipLoop(c) : it.dur, sel = arrUi.sel.has(it.id);
    let seams = ''; for (let k = 1; k * L - it.off < it.dur - 0.02; k++) { const sx = (k * L - it.off) * pps; if (sx > 3) seams += `<i class="seam" style="left:${sx.toFixed(1)}px"></i>`; }
    const loops = it.dur / L;
    const meta = `${it.dur.toFixed(1)} s${loops > 1.02 ? ` · ×${loops.toFixed(1)}` : ''}${it.off > 0.01 ? ' · crop' : ''}${it.opacity < 0.995 ? ` · ${Math.round(it.opacity * 100)}%` : ''}`;
    return `<div class="arr-item${c ? '' : ' missing'}" data-item="${it.id}" data-sel="${sel}" role="button" tabindex="0" aria-label="${esc(c ? c.name : 'Missing clip')}, ${meta}" aria-pressed="${sel}" style="left:${(it.start * pps).toFixed(1)}px;width:${Math.max(6, it.dur * pps).toFixed(1)}px;--c:${arrColor(it.clip)}"><i class="hd l" data-h="l"></i>${seams}<span class="an"><b>${esc(c ? c.name : 'Missing clip')}</b><small>${meta}</small></span><span class="opl" style="--o:${it.opacity}"></span><i class="hd r" data-h="r"></i></div>`;
  }
  function arrBodyHtml() {
    const pps = arrUi.pps, dur = arrDuration(), sc = $('arrScroll'), avail = sc ? sc.clientWidth - LBL_W : 0;
    const laneW = Math.ceil(Math.max((dur + 8) * pps, avail));
    const step = tick(pps); let ticks = '';
    for (let s = 0; s * pps < laneW; s += step) { ticks += `<span class="tk" style="left:${(s * pps).toFixed(1)}px">${fmtT(s)}</span>`; for (let m = 1; m < 5; m++) { const x = (s + step * m / 5) * pps; if (x < laneW) ticks += `<i class="mt" style="left:${x.toFixed(1)}px"></i>`; } }
    const r = arrUi.region;
    const rows = [];
    for (let tr = T.ARR_TRACKS - 1; tr >= 0; tr--) {
      const its = project.arrange.items.filter(i => i.track === tr).map(i => itemHtml(i, pps)).join('');
      const fxs = project.arrange.fx.filter(f => f.track === tr).map(f => `<div class="arr-fxspan" style="left:${(f.a * pps).toFixed(1)}px;width:${((f.b - f.a) * pps).toFixed(1)}px"></div><div class="arr-fx" data-fx="${f.id}" data-sel="${arrUi.fx === f.id}" role="button" tabindex="0" aria-label="${esc((T.TRANSITIONS.find(t => t.v === f.style) || {}).l)} transition" style="left:${(f.a * pps).toFixed(1)}px;width:${Math.max(8, (f.b - f.a) * pps).toFixed(1)}px"><i class="hd l" data-h="fl"></i><span>${esc((T.TRANSITIONS.find(t => t.v === f.style) || {}).l)}</span><i class="hd r" data-h="fr"></i></div>`).join('');
      const reg = r && tr >= r.t0 && tr <= r.t1 ? `<div class="arr-reg" style="left:${(r.a * pps).toFixed(1)}px;width:${((r.b - r.a) * pps).toFixed(1)}px"></div>` : '';
      rows.push(`<div class="arr-row" data-track="${tr}"><div class="arr-lbl"><span class="vid">${trName(tr)}</span><small>${tr === 0 ? 'base' : tr === 1 ? 'mid' : 'top'}</small></div><div class="arr-lane" data-track="${tr}" style="width:${laneW}px">${its}${fxs}${reg}</div></div>`);
    }
    const empty = project.arrange.items.length ? '' : `<div class="arr-empty" style="left:${LBL_W}px"><span>Drag clips here from the <b>Clips</b> tab, or press <b>+</b> on a clip.<br>Drag a clip’s edges to crop or loop it. Use the Region tool to add transitions.</span></div>`;
    return `<div class="arr-inner" style="--pps:${pps}px;width:${LBL_W + laneW}px;height:${ROW_H * T.ARR_TRACKS + 26}px">
      <div class="arr-row arr-ruler"><div class="arr-lbl"><span class="readout">${timecode(0).slice(0, 8)}</span></div><div class="arr-lane" data-ruler="1" style="width:${laneW}px">${ticks}</div></div>
      ${rows.join('')}${empty}<i class="arr-line" id="arrLine"></i></div>`;
  }
  let arrBound = false;
  function ensureArrShell() {
    if (arrBound) return; arrBound = true;
    $('arrange').innerHTML = '<div class="arr-head" id="arrHead"></div><div class="arr-scroll" id="arrScroll" tabindex="-1"></div>';
    bindArrange();
  }
  function renderArrHead() {
    const h = $('arrHead'); if (!h) return;
    const ae = document.activeElement, fid = ae && h.contains(ae) && ae.id ? ae.id : null;
    h.innerHTML = arrHeadHtml();
    if (fid) { const n = document.getElementById(fid); if (n && n !== document.activeElement) n.focus({ preventScroll: true }); }
  }
  function renderArrBody() {
    const sc = $('arrScroll'); if (!sc) return;
    const l = sc.scrollLeft, tp = sc.scrollTop, ae = document.activeElement, key = ae && sc.contains(ae) ? (ae.dataset.item ? `[data-item="${ae.dataset.item}"]` : ae.dataset.fx ? `[data-fx="${ae.dataset.fx}"]` : null) : null;
    sc.innerHTML = arrBodyHtml(); sc.scrollLeft = l; sc.scrollTop = tp;
    if (key) { const n = sc.querySelector(key); if (n) n.focus({ preventScroll: true }); }
    updateArrPlayhead(stage.time);
  }
  function renderArrange() {
    if (!arrMode) return; ensureArrShell();
    const ids = new Set(project.arrange.items.map(i => i.id)); arrUi.sel = new Set([...arrUi.sel].filter(id => ids.has(id)));
    if (arrUi.fx && !project.arrange.fx.some(f => f.id === arrUi.fx)) arrUi.fx = null;
    renderArrHead(); renderArrBody();
  }
  function updateArrPlayhead(t) {
    const ln = $('arrLine'); if (!ln) return; const x = LBL_W + t * arrUi.pps; ln.style.transform = `translateX(${x.toFixed(1)}px)`;
    const sc = $('arrScroll');
    if (sc && stage.playing && !arrDrag && (x < sc.scrollLeft + LBL_W || x > sc.scrollLeft + sc.clientWidth - 48)) sc.scrollLeft = Math.max(0, x - LBL_W - 48);
  }
  function renderArrangeNotice() {
    const id = { layer: 'panel-layer', colour: 'panel-colour', finish: 'panel-finish', audio: 'panel-audio' }[tab]; if (!id) return;
    $(id).innerHTML = `<div class="panel-head"><div class="lbl">Arrange</div><h1>Sequence view</h1></div><div class="arr-note"><p>The viewer is playing your arrangement, so this page, which edits the working project, is paused.</p><p>Drag clips from <b>Clips</b> onto the tracks, crop and loop them by their edges, then choose a transition for a region. To change a clip itself, double-click it on a track: it opens in Animate.</p><div class="btnrow"><button class="btn primary" data-arr-act="exit">Back to Timeline</button><button class="btn" data-arr-act="clips">Open Clips</button></div></div>`;
  }
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-arr-act]'); if (!b) return; if (b.dataset.arrAct === 'exit') { setArrange(false); laneCollapsed = false; layoutChanged(); } else setTab('clips'); });
  function setArrange(on) {
    on = !!on; if (on === arrMode) return;
    if (on && evolveOpen) closeEvolve();
    if (on && moveTool) setMoveTool(false);
    arrMode = on; app.dataset.arrange = on ? 'on' : 'off'; $('arrange').hidden = !on;
    if (on) {
      if (player.playing) player.stop();
      ensureArrShell(); stage.setOverride(arrSource);
      if (['layer', 'colour', 'finish', 'audio'].includes(tab)) tab = 'clips';
    } else { closeMenu(); stage.setOverride(null); }
    applyLayout(); setTab(tab); renderArrange(); renderClips(); updateHud(); stage.invalidate();
    if (on) toast('Arrange · drag clips onto the tracks');
  }

  // -- interaction --
  let arrDrag = null, lastTap = { id: null, t: 0, x: 0, y: 0 };
  const arrLaneLeft = () => { const l = $('arrScroll').querySelector('.arr-lane'); return l ? l.getBoundingClientRect().left : 0; };
  const arrTimeAt = x => Math.max(0, (x - arrLaneLeft()) / arrUi.pps);
  function arrTrackAt(y) {
    const rows = [...$('arrScroll').querySelectorAll('.arr-row[data-track]')]; if (!rows.length) return 0;
    for (const r of rows) { const b = r.getBoundingClientRect(); if (y >= b.top && y < b.bottom) return +r.dataset.track; }
    return y < rows[0].getBoundingClientRect().top ? T.ARR_TRACKS - 1 : 0;
  }
  function snapPts(skip) {
    const pts = [0, stage.time]; for (const i of project.arrange.items) if (!skip.includes(i.id)) { pts.push(i.start, itemEnd(i)); }
    for (const f of project.arrange.fx) pts.push(f.a, f.b); return pts;
  }
  const nearest = (v, pts, tol) => { let b = v, bd = tol; for (const p of pts) { const d = Math.abs(p - v); if (d <= bd) { b = p; bd = d; } } return b; };
  // Snap a clip's start or its end to the nearest edge / playhead, whichever is closer.
  function snapSpan(ns, dur, pts, tol) {
    let best = ns, bd = tol + 1e-9;
    for (const p of pts) { let d = Math.abs(p - ns); if (d <= bd) { best = p; bd = d; } d = Math.abs(p - (ns + dur)); if (d <= bd) { best = p - dur; bd = d; } }
    return best;
  }
  const liveArr = arr => { live({ ...project, arrange: arr }); stage.invalidate(); renderArrBody(); };
  function bindArrange() {
    const sc = $('arrScroll'), head = $('arrHead');
    const seekTo = e => { stage.seekTime(Math.min(arrTimeAt(e.clientX), arrDuration() - 1e-3)); };
    sc.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const hd = e.target.closest('.hd'), itEl = e.target.closest('.arr-item'), fxEl = e.target.closest('.arr-fx'), lane = e.target.closest('.arr-lane[data-track]'), ruler = e.target.closest('.arr-lane[data-ruler]');
      const cap = () => { try { sc.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ } };
      const base = clone(project.arrange);
      if (ruler) { arrDrag = { kind: 'scrub', id: e.pointerId }; seekTo(e); cap(); document.body.classList.add('scrubbing'); return; }
      if (fxEl && hd) { arrUi.fx = fxEl.dataset.fx; arrUi.sel.clear(); arrDrag = { kind: hd.dataset.h, id: e.pointerId, fx: fxEl.dataset.fx, base, moved: false }; cap(); renderArrHead(); return; }
      if (fxEl) { arrUi.fx = fxEl.dataset.fx; arrUi.sel.clear(); arrUi.region = null; renderArrHead(); renderArrBody(); const n = sc.querySelector(`[data-fx="${arrUi.fx}"]`); if (n) n.focus({ preventScroll: true }); return; }
      const regionMode = (arrUi.tool === 'region' || e.shiftKey) && lane;
      if (regionMode) { const tr = arrTrackAt(e.clientY); let a = arrTimeAt(e.clientX); if (arrUi.snap) a = nearest(a, snapPts([]), 8 / arrUi.pps); arrDrag = { kind: 'region', id: e.pointerId, a0: a, tr0: tr, moved: false }; arrUi.fx = null; cap(); return; }
      if (itEl && hd) {
        const it = base.items.find(i => i.id === itEl.dataset.item); if (!it) return;
        arrUi.sel = new Set([it.id]); arrUi.fx = null; arrDrag = { kind: hd.dataset.h, id: e.pointerId, item: it.id, x0: e.clientX, base, moved: false }; cap(); renderArrHead(); return;
      }
      if (itEl) {
        const id = itEl.dataset.item, now = performance.now();
        // double-click opens the clip in the Timeline (tracked here because the body re-renders on pointer-down, which swallows native click events)
        if (lastTap.id === id && now - lastTap.t < 420 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 8) {
          lastTap = { id: null, t: 0, x: 0, y: 0 }; const its = project.arrange.items.find(i => i.id === id), c = its && clipById(its.clip); if (c) { loadClip(c); return; }
        }
        lastTap = { id, t: now, x: e.clientX, y: e.clientY };
        if (e.shiftKey || e.metaKey || e.ctrlKey) { if (arrUi.sel.has(id)) arrUi.sel.delete(id); else arrUi.sel.add(id); } else if (!arrUi.sel.has(id)) arrUi.sel = new Set([id]);
        arrUi.fx = null; arrUi.region = null;
        arrDrag = { kind: 'move', id: e.pointerId, primary: id, ids: [...arrUi.sel], x0: e.clientX, base, moved: false }; cap(); renderArrHead(); renderArrBody();
        const n = sc.querySelector(`[data-item="${id}"]`); if (n) n.focus({ preventScroll: true }); return;
      }
      if (lane) { arrUi.sel.clear(); arrUi.fx = null; arrUi.region = null; arrDrag = { kind: 'scrub', id: e.pointerId }; seekTo(e); cap(); renderArrHead(); renderArrBody(); }
    });
    sc.addEventListener('pointermove', e => {
      const d = arrDrag; if (!d || e.pointerId !== d.id) return; const pps = arrUi.pps;
      if (d.kind === 'scrub') { seekTo(e); return; }
      if (d.kind === 'region') {
        let b = arrTimeAt(e.clientX); if (arrUi.snap && !e.altKey) b = nearest(b, snapPts([]), 8 / pps); const tr = arrTrackAt(e.clientY);
        if (Math.abs(b - d.a0) * pps > 3 || tr !== d.tr0) d.moved = true;
        arrUi.region = d.moved ? { a: Math.min(d.a0, b), b: Math.max(d.a0, b) + (Math.abs(b - d.a0) < 0.05 ? 0.05 : 0), t0: Math.min(d.tr0, tr), t1: Math.max(d.tr0, tr) } : null; renderArrBody(); return;
      }
      const dt = d.x0 !== undefined ? (e.clientX - d.x0) / pps : 0;
      if (d.kind === 'move') {
        d.moved = d.moved || Math.abs(e.clientX - d.x0) > 3 || d.trackMoved; const ids = d.ids, prim = d.base.items.find(i => i.id === d.primary), others = d.base.items.filter(i => !ids.includes(i.id));
        let ns = Math.max(0, prim.start + dt);
        if (arrUi.snap && !e.shiftKey) ns = Math.max(0, snapSpan(ns, prim.dur, snapPts(ids), 8 / pps));
        const items = d.base.items.map(i => ({ ...i }));
        if (ids.length === 1) {
          const tr = arrTrackAt(e.clientY); if (tr !== prim.track) d.trackMoved = true; d.moved = d.moved || !!d.trackMoved;
          if (!d.moved) return;
          const it = items.find(i => i.id === prim.id); it.track = tr; it.start = fitStart(others, tr, ns, prim.dur);
        } else {
          if (!d.moved) return; const delta = ns - prim.start;
          for (const it of items) if (ids.includes(it.id)) it.start = Math.max(0, it.start + delta);
          const moved = items.filter(i => ids.includes(i.id)), rest = items.filter(i => !ids.includes(i.id));
          if (moved.some(m => rest.some(o => o.track === m.track && m.start < itemEnd(o) - 1e-6 && itemEnd(m) > o.start + 1e-6))) return;
        }
        liveArr({ ...d.base, items }); return;
      }
      if (d.kind === 'l' || d.kind === 'r') {
        d.moved = true; const it0 = d.base.items.find(i => i.id === d.item), same = d.base.items.filter(i => i.id !== it0.id && i.track === it0.track), c = clipById(it0.clip), L = c ? clipLoop(c) : it0.dur;
        const pts = snapPts([it0.id]), tol = e.shiftKey || !arrUi.snap ? 0 : 8 / pps;
        const items = d.base.items.map(i => ({ ...i })), it = items.find(i => i.id === it0.id);
        if (d.kind === 'r') {
          const room = Math.min(Infinity, ...same.filter(o => o.start >= itemEnd(it0) - 1e-6).map(o => o.start));
          const ne = clamp(nearest(itemEnd(it0) + dt, pts, tol), it0.start + 0.2, room); it.dur = ne - it0.start;
        } else {
          const prevEnd = Math.max(0, ...same.filter(o => itemEnd(o) <= it0.start + 1e-6).map(itemEnd));
          const ns = clamp(nearest(it0.start + dt, pts, tol), prevEnd, itemEnd(it0) - 0.2), dl = ns - it0.start;
          it.start = ns; it.dur = it0.dur - dl; it.off = wrapPos(it0.off + dl, L);
        }
        liveArr({ ...d.base, items }); return;
      }
      if (d.kind === 'fl' || d.kind === 'fr') {
        d.moved = true; let tt = arrTimeAt(e.clientX); if (arrUi.snap && !e.shiftKey) tt = nearest(tt, snapPts([]), 8 / pps);
        const fx = d.base.fx.map(f => ({ ...f })), f = fx.find(x => x.id === d.fx);
        if (d.kind === 'fl') f.a = clamp(tt, 0, f.b - 0.1); else f.b = Math.max(f.a + 0.1, tt);
        liveArr({ ...d.base, fx }); return;
      }
    });
    const end = e => {
      const d = arrDrag; if (!d || (e && e.pointerId !== d.id)) return; arrDrag = null; document.body.classList.remove('scrubbing');
      if (d.kind === 'region') { if (!d.moved) arrUi.region = null; renderArrHead(); renderArrBody(); return; }
      if (d.moved && d.kind !== 'scrub') { commit(project); return; }
      if (d.kind !== 'scrub') { renderArrHead(); renderArrBody(); }
    };
    sc.addEventListener('pointerup', end); sc.addEventListener('pointercancel', end);
    sc.addEventListener('keydown', e => {
      const el = e.target.closest('.arr-item, .arr-fx'); if (!el) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (el.dataset.item) { arrUi.sel = new Set([el.dataset.item]); arrUi.fx = null; } else { arrUi.fx = el.dataset.fx; arrUi.sel.clear(); } renderArrHead(); renderArrBody(); }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.altKey && el.dataset.item) {
        e.preventDefault(); e.stopPropagation(); const next = clone(project), it = next.arrange.items.find(i => i.id === el.dataset.item); const dt = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : 0.1); it.start = fitStart(next.arrange.items.filter(i => i.id !== it.id), it.track, Math.max(0, it.start + dt), it.dur); commit(next);
      }
    });
    // drop clips from the Clips tab
    const laneAt = e => e.target.closest && e.target.closest('.arr-lane[data-track]');
    sc.addEventListener('dragover', e => { if (!e.dataTransfer || ![...e.dataTransfer.types].includes('application/x-motif-clip')) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; sc.querySelectorAll('.arr-lane.drop').forEach(x => x.classList.remove('drop')); const l = laneAt(e); if (l) l.classList.add('drop'); });
    sc.addEventListener('dragleave', e => { if (!sc.contains(e.relatedTarget)) sc.querySelectorAll('.arr-lane.drop').forEach(x => x.classList.remove('drop')); });
    sc.addEventListener('drop', e => {
      sc.querySelectorAll('.arr-lane.drop').forEach(x => x.classList.remove('drop'));
      const id = e.dataTransfer && e.dataTransfer.getData('application/x-motif-clip'); if (!id) return; e.preventDefault();
      let start = arrTimeAt(e.clientX); const c = clipById(id); if (arrUi.snap && c) start = snapSpan(start, clipLoop(c), snapPts([]), 8 / arrUi.pps);
      addClipToArrange(id, { track: arrTrackAt(e.clientY), start: Math.max(0, start) });
    });
    // Zoom: trackpad pinch (arrives as ctrl + wheel), Safari gestures and two-finger touch all zoom the sequence, and only here.
    // Page zoom stays locked everywhere else. Requests are folded into one re-render per frame, anchored on the pointer.
    let zoomRaf = 0, zoomPps = null, zoomX = 0;
    const zoomTo = (pps, clientX) => {
      zoomPps = clamp(pps, 12, 480); zoomX = clientX;
      if (zoomRaf) return;
      zoomRaf = requestAnimationFrame(() => {
        zoomRaf = 0; if (zoomPps == null) return; const next = zoomPps; zoomPps = null; if (Math.abs(next - arrUi.pps) < 0.01) return;
        const r = sc.getBoundingClientRect(), tAt = (sc.scrollLeft + zoomX - r.left - LBL_W) / arrUi.pps;
        arrUi.pps = next; renderArrBody(); sc.scrollLeft = Math.max(0, tAt * arrUi.pps - (zoomX - r.left - LBL_W));
      });
    };
    const zoomFactor = (f, clientX) => zoomTo((zoomPps == null ? arrUi.pps : zoomPps) * f, clientX);
    sc.addEventListener('wheel', e => {
      if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault();
      zoomFactor(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.06 : e.ctrlKey ? 0.02 : 0.01)), e.clientX);
    }, { passive: false });
    let gs = null;
    sc.addEventListener('gesturestart', e => { e.preventDefault(); gs = { pps: arrUi.pps }; });
    sc.addEventListener('gesturechange', e => { e.preventDefault(); if (gs) zoomTo(gs.pps * e.scale, e.clientX); });
    sc.addEventListener('gestureend', e => { e.preventDefault(); gs = null; });
    let pinch = null;
    const tdist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    sc.addEventListener('touchstart', e => {
      if (e.touches.length !== 2) return;
      if (arrDrag) { if (arrDrag.base) live({ ...project, arrange: arrDrag.base }); arrDrag = null; document.body.classList.remove('scrubbing'); renderArrBody(); } // the first finger was a drag; the second makes it a pinch
      pinch = { d: Math.max(1, tdist(e.touches)), pps: arrUi.pps }; sc.classList.add('pinching');
    }, { passive: true });
    sc.addEventListener('touchmove', e => {
      if (!pinch || e.touches.length !== 2) return; e.preventDefault();
      zoomTo(pinch.pps * tdist(e.touches) / pinch.d, (e.touches[0].clientX + e.touches[1].clientX) / 2);
    }, { passive: false });
    const pinchEnd = e => { if (e.touches.length < 2 && pinch) { pinch = null; sc.classList.remove('pinching'); } };
    sc.addEventListener('touchend', pinchEnd); sc.addEventListener('touchcancel', pinchEnd);
    // header controls
    const zoomBy = f => { const r = sc.getBoundingClientRect(); zoomFactor(f, r.left + LBL_W + (r.width - LBL_W) / 2); };
    head.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
      if (a === 'tool-select' || a === 'tool-region') { arrUi.tool = a === 'tool-select' ? 'select' : 'region'; renderArrHead(); }
      else if (a === 'split') splitAtPlayhead(); else if (a === 'dup') duplicateSelected(); else if (a === 'del') { if (!arrUi.sel.size && !arrUi.fx) toast('Select a clip or a transition first'); deleteSelected(); }
      else if (a === 'snap') { arrUi.snap = !arrUi.snap; renderArrHead(); toast(arrUi.snap ? 'Snap on' : 'Snap off'); }
      else if (a === 'zoomin') zoomBy(1.4); else if (a === 'zoomout') zoomBy(1 / 1.4);
      else if (a === 'fit') { arrUi.pps = clamp((sc.clientWidth - LBL_W - 48) / arrDuration(), 12, 480); renderArrBody(); sc.scrollLeft = 0; }
      else if (a === 'addcur') addCurrentToArrange();
      else if (a === 'q-head' || a === 'q-tail' || a === 'q-cut') quickRegion(a.slice(2));
      else if (a === 'region-clear') { arrUi.region = null; renderArrHead(); renderArrBody(); }
      else if (a === 'fx-remove') deleteSelected();
    });
    head.addEventListener('input', e => {
      if (e.target.id !== 'arrOp') return; const v = Number(e.target.value) / 100; $('arrOpV').textContent = Math.round(v * 100) + '%';
      const ids = [...arrUi.sel]; const items = project.arrange.items.map(i => (ids.includes(i.id) ? { ...i, opacity: v } : i)); liveArr({ ...project.arrange, items });
    });
    head.addEventListener('change', e => { if (e.target.id === 'arrOp') commit(project); else if (e.target.id === 'arrStyle' && e.target.value) applyTransition(e.target.value); });
    addEventListener('resize', () => { if (arrMode) renderArrBody(); });
  }
  // keys while Arrange is open: B split, D duplicate, Delete remove, V select tool, Esc clear; layer-editing keys are held back
  function arrKey(e) {
    const k = e.key;
    if (k === 'b' || k === 'B') { e.preventDefault(); splitAtPlayhead(); return true; }
    if (k === 'd' || k === 'D') { e.preventDefault(); duplicateSelected(); return true; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); if (arrUi.sel.size || arrUi.fx) deleteSelected(); return true; }
    if (k === 'v' || k === 'V') { arrUi.tool = 'select'; renderArrHead(); return true; }
    if (k === 'Escape' && (arrUi.region || arrUi.sel.size || arrUi.fx)) { arrUi.region = null; arrUi.sel.clear(); arrUi.fx = null; renderArrHead(); renderArrBody(); return true; }
    if (/^[maerAMER]$/.test(k)) { toast('Mutate, Evolve, Random and Add work on layers · press Alt A to leave Arrange'); return true; }
    if (k === '[' || k === ']') return true;
    return false;
  }

  // ---------- refresh ----------
  let lastStyle = null, lastPalKey = '';
  function refresh() {
    if (audition) setAudition(null);
    autosave(); updateHud(); renderPanel(); renderLane(); renderArrange(); updateNameUi(); updateReticle(); stage.invalidate();
    $('undoBtn').disabled = cursor <= 0; $('redoBtn').disabled = cursor >= history.length - 1;
    const st = getStyle(active().styleId); if (stage.canvas) stage.canvas.setAttribute('aria-label', `${project.layers.map(l => getStyle(l.styleId).name).join(' + ')} animation preview`);
    const palKey = active().shared.palette + project.palettes.length;
    if (lastStyle !== active().styleId || palKey !== lastPalKey) {
      lastStyle = active().styleId; lastPalKey = palKey;
      $('libList').querySelectorAll('.style-row').forEach(r => r.setAttribute('aria-selected', r.id === 'opt-' + st.id)); $('libList').setAttribute('aria-activedescendant', 'opt-' + st.id); drawThumbs();
    }
    const at = $('tabs').querySelector('[data-tab=audio]'), dot = at.querySelector('.dot'), wantDot = !!(project.audio && project.audio.maps.length);
    if (dot && !wantDot) dot.remove(); else if (!dot && wantDot) at.insertAdjacentHTML('beforeend', '<span class="dot" aria-hidden="true"></span>');
    const li = project.layers.indexOf(active());
    $('vClip').textContent = `· V${li + 1}  ${st.name}${st.kit ? `  ·  ${st.kitName} kit` : ''}`;
    $('ctxInfo').innerHTML = `<span>Selected</span><b>V${li + 1} · ${esc(st.name)}</b>${st.engine === 'glsl' ? '<span class="tag">GLSL</span>' : st.gpu ? '<span class="tag">GPU</span>' : ''}`;
    updateGpuChip();
    updateBpmChip();
  }
  renderLibrary(); refresh(); renderClips();
  // A saved session that uses an imported kit is picked up once the kit has come back from IndexedDB.
  K.ready.then(() => {
    const sv = pendingSv; pendingSv = null;
    if (!sv || dirty || cursor > 0 || K.missingKits(sv.project).length) return;
    project = T.sanitizeProject(sv.project, C.sanitizeCustom); if (typeof sv.name === 'string' && sv.name) projectName = sv.name.slice(0, 60); if (typeof sv.id === 'string' && sv.id) projectId = sv.id.slice(0, 40);
    if (ASPECTS.some(a => a.id === sv.aspect)) setAspect(sv.aspect);
    history.length = 0; history.push(JSON.stringify(project)); cursor = 0; stage.setSpace(project.output.space); syncAudioRegion(); refresh(); toast('Restored your last session');
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { stage.invalidate(); drawThumbs(); });

  // ---------- kits ----------
  let kitMsg = null; // { kind: 'ok' | 'error' | 'info', text }
  // motif-kit@2 install review: kitReview = a kit waiting for capability approval; kitDiags = line-numbered diagnostics
  // of the last failed install. Installs go through kit-host (validate → background compile → canary).
  let kitReview = null, kitDiags = [];
  const H = __m_kit_host;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const kindsText = k => [k.styles && plural(k.styles, 'style'), k.effects && plural(k.effects, 'effect'), k.transitions && plural(k.transitions, 'transition'), k.exporters && plural(k.exporters, 'export preset')].filter(Boolean).join(' · ') || 'no entries';
  const diagList = ds => (ds && ds.length ? `<ul class="kit-diags" aria-label="Diagnostics">${ds.slice(0, 24).map(d => `<li data-sev="${d.severity === 'warning' ? 'warning' : 'error'}"><code>${esc((d.file || 'manifest.json') + (d.line ? ':' + d.line : ''))}</code> ${esc(d.message)}${d.entry ? ` <small class="info">(${esc(d.entry)})</small>` : ''}</li>`).join('')}${ds.length > 24 ? `<li data-sev="warning">…and ${ds.length - 24} more</li>` : ''}</ul>` : '');
  function focusKit(sel) { requestAnimationFrame(() => { const el = $('panel-kits').querySelector(sel); if (el) el.focus(); }); }
  const kitUsers = id => project.layers.map((l, i) => ({ l, i })).filter(({ l }) => K.kitOfStyle(l.styleId) === id);
  function kitStatus(kind, text) { kitMsg = { kind, text }; if (tab === 'kits') renderKitsPanel(); else toast(text.split('\n')[0]); }
  async function saveFile(filename, blob) {
    const dl = await getDownloads();
    if (dl) { try { await dl.save({ filename, data: blob }); return true; } catch (e) { if (e && e.code === 'declined') return false; } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); return true;
  }
  async function installRaw(raw, source, label, approved) {
    kitReview = null; kitDiags = [];
    // Lightweight status while checking: update the live region only (a full panel render redraws every kit thumbnail).
    const live = tab === 'kits' && $('kitStatus'), checking = `Checking ${label}: validating, compiling in the background and test-rendering small frames…`;
    if (live) { kitMsg = { kind: 'info', text: checking }; live.hidden = false; live.className = 'kit-status'; live.dataset.kind = 'info'; live.textContent = checking; } else kitStatus('info', checking);
    let r;
    try { r = await H.install(raw, { source, approved }); } catch (err) { kitStatus('error', `Couldn’t install ${label}. ${err.message || err}`); return false; }
    if (r.needsApproval) { kitReview = { raw, source, label, r }; kitMsg = null; if (tab === 'kits') renderKitsPanel(); else setTab('kits'); focusKit('#kitReview'); return false; }
    if (!r.ok) { kitDiags = r.diagnostics || []; kitStatus('error', `Couldn’t install ${label}.\n${r.errors.slice(0, 12).join('\n')}${r.errors.length > 12 ? `\n…and ${r.errors.length - 12} more` : ''}`); return false; }
    const n = r.kit.styles.length, q = r.quarantined || [];
    kitStatus(q.length ? 'error' : 'ok', `${r.replaced ? `Updated ${r.kit.name} ${r.replaced} → ${r.kit.version}` : `Installed ${r.kit.name} ${r.kit.version}`}: ${kindsText({ styles: n, effects: r.kit.effects.length, transitions: r.kit.transitions.length, exporters: r.kit.exporters.length })}, ${plural(r.kit.palettes.length, 'palette')}.${r.kit.migration ? `\nRead as ${r.kit.format} (migrated from ${r.kit.sourceFormat}).` : ''}${q.length ? `\nQuarantined ${q.length}: ${q.map(id => id.split('/')[1]).join(', ')}. ${q.length === 1 ? 'It draws' : 'They draw'} a placeholder; see the kit card to retry.` : ''}${r.warnings.length ? `\nNotes:\n${r.warnings.slice(0, 6).join('\n')}` : ''}${r.skippedCompile ? '\nWebGL2 is unavailable here, so shaders were not test-compiled.' : ''}`);
    if (n) { catFilter = 'kit:' + r.kit.id; renderChips(); renderLibrary(); }
    return true;
  }
  async function importFiles(files) {
    for (const f of files) {
      try { const raw = await K.readFile(f); installRaw(raw, 'file', f.name); }
      catch (err) { kitStatus('error', `Couldn’t read ${f.name}. ${err.message || err}`); }
    }
  }
  function kitThumbs(root) {
    root.querySelectorAll('canvas[data-style]').forEach(c => {
      const st = getStyle(c.dataset.style); if (st.id !== c.dataset.style) return;
      const base = T.newLayer(st.id);
      renderThumb(pipeline, c, { styleId: st.id, params: base.params, shared: { ...base.shared, palette: st.palette || 'signal', loop: project.finish.loop } }, 0.3, project.palettes);
    });
  }
  function kitBadges(k) {
    const fmt = k.sourceFormat && k.sourceFormat !== k.format ? `${k.sourceFormat} → ${k.format}` : k.format;
    const b = [`<span title="${esc(k.migration ? 'Migrated on load: ' + k.migration.steps.join('; ') : 'Kit format')}">${esc(fmt || '')}</span>`];
    for (const [n, w] of [[k.styles.length, 'style'], [k.effects.length, 'effect'], [k.transitions.length, 'transition'], [k.exporters.length, 'export preset']]) if (n) b.push(`<span>${plural(n, w)}</span>`);
    for (const c of k.capabilities) b.push(`<span data-cap title="${esc(c.text)}">${k.approved.includes(c.id) ? '✓ ' : ''}${esc(c.id)}</span>`);
    if (!k.capabilities.length) b.push('<span title="Pixels from its own parameters only">no extra access</span>');
    return `<div class="kit-badges" aria-label="Format, contents and capabilities">${b.join('')}</div>`;
  }
  function kitQuarantine(k) {
    const all = [...k.styles, ...k.effects, ...k.transitions];
    return all.filter(s => s.quarantine || s.checking).map(s => s.checking
      ? `<div class="kit-q" data-checking role="status"><span>Checking <b>${esc(s.name)}</b>…</span></div>`
      : `<div class="kit-q" role="alert"><span><b>${esc(s.name)}</b> is quarantined: ${esc(s.quarantine.reason)}.<br><small>${esc(s.quarantine.detail || '')}</small></span><button class="btn sm" data-retry="${esc(s.id)}">Retry</button></div>`).join('');
  }
  function kitReport(k) {
    const r = k.report; if (!r) return '';
    const rows = (r.entries || []).map(e => `<tr><td>${esc(e.localId)}</td><td>${esc(e.kind)}</td><td class="n">${e.executions}</td><td class="n">${r.analyzed ? Math.round(e.iterations) : '–'}</td><td class="n">${r.analyzed ? Math.round(e.fetches) : '–'}</td><td class="n">${r.canary && r.canary[e.id] ? r.canary[e.id].ms64 + ' ms' : '–'}</td></tr>`).join('');
    const mig = k.migration ? `<p class="info">Migrated ${esc(k.migration.from)} → ${esc(k.migration.to)}:</p><ol>${k.migration.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '';
    const legacy = k.legacyApproval ? '<p class="info">Installed before capability approval existed; its access was kept.</p>' : '';
    return `<details class="kit-report"><summary>Validation report · ${k.warnings.length ? plural(k.warnings.length, 'note') : 'no notes'}</summary>
      ${mig}${legacy}${rows ? `<table><thead><tr><th>Entry</th><th>Kind</th><th class="n">Passes run</th><th class="n">Loop iters / px</th><th class="n">Fetches / px</th><th class="n">64² canary</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
      ${r.analyzed ? '' : '<p class="info">Bundled with this build: audited by the test suite, not re-analysed at load.</p>'}
      ${k.warnings.length ? `<ul>${k.warnings.slice(0, 12).map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      ${k.exporters.length ? `<p class="info">Export presets: ${k.exporters.map(x => `${esc(x.name)} (${esc(Object.entries(x.preset).map(([a, b]) => a + ' ' + b).join(', '))})`).join('; ')}</p>` : ''}
    </details>`;
  }
  function kitReviewCard() {
    if (!kitReview) return '';
    const { r, label } = kitReview, k = r.kit;
    return `<section class="kit-card kit-review" id="kitReview" tabindex="-1" aria-labelledby="kitReviewTitle"><div class="kit-body">
      <div class="lbl">Review before installing</div>
      <h2 id="kitReviewTitle">${esc(k.name)} ${esc(k.version)}</h2>
      <p class="info">${esc(label)} · ${esc(k.sourceFormat && k.sourceFormat !== k.format ? `${k.sourceFormat} → ${k.format}` : k.format)} · ${kindsText(k.kinds)}${k.author ? ` · by ${esc(k.author)}` : ''}</p>
      <p class="info">${esc(k.description || '')}</p>
      <p style="margin:0">This kit asks to:</p>
      <ul class="kit-caps">${r.capabilities.map(c => `<li><b>${esc(c.id)}</b>: ${esc(c.text)}</li>`).join('')}</ul>
      <p class="info">Kits are data and GLSL only: they cannot run scripts, reach the network or read the page. Shaders were checked for unbounded loops and will be test-rendered on one small frame before they draw.</p>
      ${diagList((r.diagnostics || []).filter(d => d.severity === 'warning'))}
      <div class="btnrow"><button class="btn primary sm" data-approve>Install and allow</button><button class="btn sm" data-cancel>Cancel</button></div>
    </div></section>`;
  }
  // Version and provenance show on hover of the kit name, so the card itself stays quiet.
  const kitMeta = k => `v${k.version} · ${esc0(k.author || 'Unknown author')}\n${k.styles.length} styles · ${k.styles.filter(s => s.passes > 1).length} multi-pass\n${k.source === 'catalog' ? 'Bundled' : k.source === 'url' ? 'From URL' : 'Imported'} · ${(k.bytes / 1024).toFixed(0)} KB`;
  const esc0 = v => String(v);
  function renderKitsPanel() {
    const kits = K.list(), cat = K.catalog().filter(c => !c.installed);
    const pal = p => `<i title="${esc(p.name)}"><s style="background:${p.bg}"></s><s style="background:${p.ink}"></s>${p.a.map(c => `<s style="background:${c}"></s>`).join('')}</i>`;
    const card = k => `<article class="kit-card" data-kit="${k.id}" data-off="${!k.enabled}">
        <div class="kit-strip" aria-hidden="true">${k.styles.slice(0, 6).map(s => `<canvas width="96" height="60" data-style="${s.id}"></canvas>`).join('')}</div>
        <div class="kit-body">
          <div class="kit-top"><span class="kd" style="--kd:${k.accent || 'var(--accent)'}" aria-hidden="true"></span><b tabindex="0" data-tip="${esc(k.name)}" data-tip-meta="${esc(kitMeta(k))}">${esc(k.name)}</b><input type="checkbox" class="switch" role="switch" data-toggle="${k.id}" aria-label="${esc(k.name)} kit enabled"${k.enabled ? ' checked' : ''}></div>
          ${kitBadges(k)}
          <p class="info">${esc(k.description)}</p>
          ${kitQuarantine(k)}
          <div class="kit-pals" aria-label="Kit palettes">${k.palettes.map(pal).join('')}</div>
          ${kitReport(k)}
          <div class="btnrow"><button class="btn sm" data-show="${k.id}"${k.enabled && k.styles.length ? '' : ' disabled'}>Show in library</button><button class="btn sm" data-export="${k.id}">Export .motifkit</button>${k.canRollback ? `<button class="btn sm" data-rollback="${k.id}">Roll back to v${esc(k.previousVersion)}</button>` : ''}<button class="btn sm" data-remove="${k.id}">Remove</button></div>
        </div></article>`;
    $('panel-kits').innerHTML = `
      <div class="panel-head"><div class="lbl">Library · ${STYLES.length} styles · ${kits.filter(k => k.enabled).length} of ${kits.length} kits on</div><h1>Kits</h1><p>Add shader styles and palettes to the library.</p></div>
      <div class="kits">
        <div class="kit-drop">
          <b>Import a kit</b><p>Drop a <b>.motifkit</b> anywhere, or choose a file.</p>
          <div class="btnrow"><button class="btn primary sm" id="kitImport">Choose file…</button><button class="btn sm" id="kitStarter">Get the starter kit</button></div>
          <form class="btnrow" id="kitUrlForm" style="width:100%"><input type="url" id="kitUrl" placeholder="https://…/my-kit.motifkit" aria-label="Kit URL" style="flex:1 1 12em;min-height:var(--target);padding:0 var(--space-2);border:var(--hairline) solid var(--line);border-radius:var(--radius-m);background:var(--surface-1)"><button class="btn sm" type="submit">Load from URL</button></form>
        </div>
        ${kitMsg ? `<div class="kit-status" id="kitStatus" role="status" data-kind="${kitMsg.kind}">${esc(kitMsg.text)}</div>` : '<div id="kitStatus" role="status" hidden></div>'}
        ${kitMsg && kitMsg.kind === 'error' ? diagList(kitDiags) : ''}
        ${kitReviewCard()}
        <label class="kit-row"><span>Photosensitive-safe limiter<br><small class="info">Caps flashes at 3 per second (WCAG 2.3.1)</small></span><input type="checkbox" class="switch" role="switch" id="kitSafe"${K.safe ? ' checked' : ''}></label>
        ${kits.length ? kits.map(card).join('') : '<p class="kit-empty">No kits installed yet. Import a <b>.motifkit</b> above, or install a bundled kit below. Kits add shader styles, effects, transitions and export presets.</p>'}
        ${cat.length ? `<div class="lbl">Bundled, not installed</div>${cat.map(c => `<div class="kit-row"><span><b>${esc(c.name)}</b> · ${c.styles} styles<br><small class="info">${esc(c.description)}</small></span><button class="btn sm" data-install="${c.id}">Install</button></div>`).join('')}` : ''}
        <p class="info">Format <b>${K.KIT_FORMAT}</b> (reads ${K.KIT_FORMATS.join(', ')}) · see the SDK for the spec</p>
      </div>`;
    kitThumbs($('panel-kits'));
  }
  $('panel-kits').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'kitImport') { $('kitFile').click(); return; }
    if (b.hasAttribute('data-approve') && kitReview) { const { raw, source, label, r } = kitReview; kitReview = null; installRaw(raw, source, label, r.capabilities.map(c => c.id)); return; }
    if (b.hasAttribute('data-cancel') && kitReview) { kitStatus('info', `Didn’t install ${kitReview.r.kit.name}.`); kitReview = null; renderKitsPanel(); focusKit('#kitImport'); return; }
    if (b.dataset.retry) { const id = b.dataset.retry; b.disabled = true; const r = await H.retry(id); kitStatus(r.ok ? 'ok' : 'error', r.ok ? `${id.split('/')[1]} passed its test frame and is back.` : `${id.split('/')[1]} is still quarantined: ${r.quarantine.reason}.`); stage.invalidate(); drawThumbs(); return; }
    if (b.dataset.rollback) { const id = b.dataset.rollback, k = K.list().find(x => x.id === id); kitStatus('info', `Rolling ${k.name} back to v${k.previousVersion}…`); const r = await H.rollback(id); if (r.ok) kitStatus('ok', `Rolled ${r.kit.name} back to v${r.kit.version}. Roll forward from the same button.`); else { kitDiags = r.diagnostics || []; kitStatus('error', `Couldn’t roll back.\n${(r.errors || []).join('\n')}`); } return; }
    if (b.id === 'kitStarter') {
      const raw = K.starterKit();
      if (typeof fflate === 'undefined') { kitStatus('error', 'The ZIP library did not load, so the starter kit cannot be packaged here.'); return; }
      const readme = `# ${raw.manifest.name}\n\nA Motif kit (${K.KIT_FORMAT}). Edit manifest.json and styles/*.glsl, zip the folder with manifest.json at the root, rename it to .motifkit and drop it on Motif Style Lab.\n\nEach pass defines \`vec4 motif(vec2 uv, vec2 fc)\` and returns premultiplied linear RGBA. Params arrive as \`p_<key>\` uniforms (range → float, int → int, toggle → bool, select → int with #defines such as MODE_RINGS). Time enters only through \`u_p\` (loop phase 0–1): use integer frequencies (lc, lsin, pulse, ln2, lfbm) so the loop closes. Use tslot() and strobe() for flicker so the photosensitive limiter can cap it.\n`;
      const zin = { 'manifest.json': fflate.strToU8(JSON.stringify(raw.manifest, null, 2)), 'README.md': fflate.strToU8(readme) };
      for (const [k, t] of Object.entries(raw.files)) zin[k] = fflate.strToU8(t);
      const ok = await saveFile('my-kit-starter.motifkit', new Blob([fflate.zipSync(zin, { level: 9 })], { type: 'application/zip' }));
      if (ok) kitStatus('info', 'Saved my-kit-starter.motifkit. Unzip it, edit the shader, zip it again and drop it here.');
      return;
    }
    const id = b.dataset.show || b.dataset.export || b.dataset.remove || b.dataset.install;
    if (b.dataset.show) { catFilter = 'kit:' + id; renderChips(); renderLibrary(); if (!mqDesktop.matches) setTab('library'); else $('libList').scrollTop = 0; return; }
    if (b.dataset.export) {
      const bytes = K.exportBytes(id); const k = K.list().find(x => x.id === id);
      if (!bytes) { kitStatus('error', 'The ZIP library did not load, so the kit cannot be exported here.'); return; }
      if (await saveFile(`${id}-${k.version}.motifkit`, new Blob([bytes], { type: 'application/zip' }))) kitStatus('info', `Saved ${id}-${k.version}.motifkit.`);
      return;
    }
    if (b.dataset.remove) {
      const users = kitUsers(id); if (users.length) { kitStatus('error', `Layer ${users.map(u => u.i + 1).join(', ')} uses this kit. Change ${users.length > 1 ? 'those layers' : 'that layer'} to another style first.`); return; }
      const k = K.list().find(x => x.id === id); K.remove(id); kitStatus('info', `Removed ${k.name}.${k.source === 'catalog' ? ' It stays in the bundled list below.' : ''}`); return;
    }
    if (b.dataset.install) { const r = K.installCatalog(id); if (!r.ok) kitStatus('error', r.errors.join('\n')); else { kitStatus('ok', `Installed ${r.kit.name} ${r.kit.version}: ${r.kit.styles.length} styles.`); catFilter = 'kit:' + id; renderChips(); renderLibrary(); } }
  });
  $('panel-kits').addEventListener('keydown', e => { if (e.key === 'Escape' && kitReview) { e.stopPropagation(); kitStatus('info', `Didn’t install ${kitReview.r.kit.name}.`); kitReview = null; renderKitsPanel(); focusKit('#kitImport'); } });
  $('panel-kits').addEventListener('change', e => {
    if (e.target.id === 'kitSafe') { K.setSafe(e.target.checked); stage.invalidate(); drawThumbs(); toast(K.safe ? 'Photosensitive limiter on' : 'Photosensitive limiter off: flashing styles run at full rate'); return; }
    const id = e.target.dataset.toggle; if (!id) return;
    if (!e.target.checked) { const users = kitUsers(id); if (users.length) { e.target.checked = true; kitStatus('error', `Layer ${users.map(u => u.i + 1).join(', ')} uses this kit. Change ${users.length > 1 ? 'those layers' : 'that layer'} to another style first.`); return; } }
    K.setEnabled(id, e.target.checked);
  });
  $('panel-kits').addEventListener('submit', async e => {
    e.preventDefault(); const url = $('kitUrl').value.trim(); if (!url) return;
    kitStatus('info', `Loading ${url}…`);
    try { const res = await fetch(url); if (!res.ok) throw new Error(`HTTP ${res.status}`); const raw = K.parseBytes(new Uint8Array(await res.arrayBuffer()), url); installRaw(raw, 'url', url.split('/').pop()); }
    catch (err) { kitStatus('error', `Couldn’t load that URL. ${err.message || err}. The host may block cross-origin downloads; download the file and drop it here instead.`); }
  });
  $('kitFile').addEventListener('change', e => { const fs = [...e.target.files]; e.target.value = ''; importFiles(fs); });
  // Drag and drop anywhere on the page installs kits.
  let dragDepth = 0;
  const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; dragDepth++; $('dropzone').hidden = false; });
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('dropzone').hidden = true; });
  window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', e => {
    if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; $('dropzone').hidden = true;
    const all = [...e.dataTransfer.files];
    const med = all.find(f => media.kindOf(f));
    if (med) { document.querySelectorAll('.mslot.over').forEach(x => x.classList.remove('over')); const slot = e.target.closest && e.target.closest('.mslot'); attachMedia(med, slot ? slot.dataset.input : null).then(ok => { if (ok && tab !== 'layer') setTab('layer'); }); return; }
    const fs = all.filter(f => /\.(motifkit|zip|json)$/i.test(f.name));
    if (!fs.length) { toast('Drop a .motifkit file to install a kit, or an image or video onto a MEDIA style'); return; }
    setTab('kits'); importFiles(fs);
  });
  K.on(ev => {
    if (ev.type === 'gpu') {
      updateGpuChip(); stage.invalidate();
      if (ev.gpu === 'restored') drawThumbs();
      if (ev.gpu === 'compiled') { for (const id of ev.ids) { const c = thumbs.get(id); if (c) renderThumb(pipeline, c, thumbLook(getStyle(id)), 0.3, project.palettes); } if (tab === 'kits') renderKitsPanel(); else if (tab === 'layer') renderPanel(); }
      return;
    }
    renderChips(); renderLibrary(); stage.invalidate();
    if (ev.type !== 'safe' && tab === 'kits') renderKitsPanel();
    if (tab === 'layer') renderPanel();
  });

  // ---------- accessibility: roving tabindex + arrow keys (tablists, radiogroups) and splitter values ----------
  // Additive and delegated so dynamically rendered groups are covered. Evidence: tests/browser/a11y.mjs, docs/a11y-findings.md.
  (() => {
    const G = '[role=tablist],[role=radiogroup]', shown = e => e.getClientRects().length > 0;
    const itemsOf = g => [...g.querySelectorAll(g.getAttribute('role') === 'tablist' ? '[role=tab]' : '[role=radio]')].filter(b => !b.disabled && shown(b));
    const stateOf = g => (g.getAttribute('role') === 'tablist' ? 'aria-selected' : 'aria-checked');
    const rove = g => { const its = itemsOf(g), cur = its.find(b => b.getAttribute(stateOf(g)) === 'true') || its[0]; its.forEach(b => { b.tabIndex = b === cur ? 0 : -1; }); };
    let queued = 0; const syncAll = () => { queued = 0; document.querySelectorAll(G).forEach(rove); };
    new MutationObserver(recs => { if (recs.some(r => r.attributeName === 'hidden' || r.attributeName === 'open' || (r.target.closest && r.target.closest(G)) || [...r.addedNodes].some(n => n.nodeType === 1 && (n.matches(G) || n.querySelector(G))))) syncAll(); })
      .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-checked', 'aria-selected', 'hidden', 'disabled', 'open'] });
    syncAll(); addEventListener('resize', () => { if (!queued) queued = requestAnimationFrame(syncAll); });
    document.addEventListener('keydown', e => {
      if (e.altKey || e.ctrlKey || e.metaKey || !/^(Arrow(Left|Right|Up|Down)|Home|End)$/.test(e.key) || !e.target.closest) return;
      const g = e.target.closest(G), me = g && e.target.closest('[role=tab],[role=radio]'); if (!me) return;
      if (g.getAttribute('role') === 'tablist' && /Up|Down/.test(e.key)) return;
      const its = itemsOf(g), i = its.indexOf(me); if (i < 0) return;
      const n = e.key === 'Home' ? its[0] : e.key === 'End' ? its[its.length - 1] : its[(i + (/Right|Down/.test(e.key) ? 1 : -1) + its.length) % its.length];
      e.preventDefault(); e.stopPropagation(); n.focus(); n.click();
      if (!n.isConnected) requestAnimationFrame(() => { const g2 = [...document.querySelectorAll(G)].find(x => x.getAttribute('aria-label') === g.getAttribute('aria-label')), n2 = g2 && itemsOf(g2)[its.indexOf(n)]; if (n2) n2.focus(); }); // the click re-rendered the panel
    }, true);
    // Focusable separators need value semantics (ARIA 1.2): kept current on focus and after arrow keys.
    const splitVal = h => { const k = h.dataset.split, now = k === 'lib' ? $('panel-library').getBoundingClientRect().width : k === 'insp' ? $('insp').getBoundingClientRect().width : $('lane').getBoundingClientRect().height, [lo, hi] = k === 'lib' ? [216, 520] : k === 'insp' ? [296, 600] : [112, Math.max(160, Math.round(innerHeight * 0.62))]; h.setAttribute('aria-valuemin', lo); h.setAttribute('aria-valuemax', hi); h.setAttribute('aria-valuenow', Math.round(Math.min(hi, Math.max(lo, now)))); };
    document.querySelectorAll('.split').forEach(h => { h.addEventListener('focus', () => splitVal(h)); h.addEventListener('keyup', () => splitVal(h)); splitVal(h); });
  })();

  // Test and automation hooks (read-only views plus the same actions the UI offers).
  window.__lab = {
    media, attachMedia, bench: runBench, textAtlas: TA, importFontFile: (file, path) => useFontFile(file, { path, relink: false }), fontStore,
    get project() { return clone(project); }, setProject(p) { commit(p); stage.setSpace(project.output.space); }, get historySize() { return history.length; }, stage, gpu, pipeline, setAspect, setTab,
    selectStyle, addLayer, mutate: doMutate, randomize: doRandom, undo, redo, openEvolve, keep, get children() { return children.length; }, openExport, toggleKey,
    get styles() { return STYLES.map(s => ({ id: s.id, gpu: !!s.gpu, engine: s.engine || (s.gpu ? 'webgpu' : 'canvas'), kit: s.kit || null, params: Object.keys(s.params).length })); },
    renderAt(pr, t, w, h, opts = {}) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); const t0 = performance.now(); const info = pipeline.renderFrame(x, w, h, pr, t, { env: envFn, ...opts }); const ms = performance.now() - t0; return { data: x.getImageData(0, 0, w, h).data, ms, info }; },
    exportNow: (s) => X.runExport(clone(project), { aspect, time: stage.time, tier: 720, fps: 24, loops: 1, transparent: false, withAudio: true, ...s }, exportCtx()).then(async r => (window.__lab.lastBlob = r.blob, { head: Array.from(new Uint8Array(await r.blob.slice(0, 65536).arrayBuffer())), size: r.blob.size, type: r.blob.type, filename: r.filename, note: r.note || '', colorTag: r.colorTag || '', encoderTag: r.encoderTag || '', audio: !!r.audio, codec: r.codec || '', stats: r.stats || null })),
    probe: () => X.probeCapabilities(), queue: Q, capabilityMatrix: (a, f) => X.capabilityMatrix(a, f),
    loadAudio, get analysis() { return analysis ? { bpm: analysis.bpm, offset: analysis.beatOffset, confidence: analysis.confidence, duration: analysis.duration } : null },
    parsePreset: X.parsePreset, presetJSON: () => X.presetJSON(project, aspect),
    api: { timeline: T, colour: C, audio: A, kits: K },
    kits: K, kitHost: H, importKitBytes(bytes, name, opts = {}) { return installRaw(K.parseBytes(new Uint8Array(bytes), name), 'file', name || 'kit', opts.approve ? 'all' : undefined); }, get kitMsg() { return kitMsg; }, get kitReview() { return kitReview ? { name: kitReview.r.kit.name, capabilities: kitReview.r.capabilities.map(c => c.id) } : null; }, get kitDiags() { return kitDiags.slice(); }, renderKitsPanel,
    get env() { return envFn; }, get laneCollapsed() { return laneCollapsed; }, get tab() { return tab; },
    // Motif 6
    get clips() { return clips; }, get groups() { return groups; }, saveLook, addClipToArrange, setArrange, get arrMode() { return arrMode; }, arrUi, arrDraw, arrDuration, splitAtPlayhead, applyTransition, jumpKey, keyTimes,
    setMoveTool, setGrid, pickLayerAt, saveProject, loadProjectData, projectPayload, get dirty() { return dirty; }, get projectName() { return projectName; }, renderClips, newGroupPrompt, moveClipToGroup, FS_FILE,
  };
}

return { boot, use };

})();

