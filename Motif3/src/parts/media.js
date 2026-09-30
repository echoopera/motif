  // ---------- media inputs (images and video for kit styles that declare `inputs`) ----------
  // Assets are kept by content hash. Bytes live in IndexedDB (per browser, never uploaded); the project only stores
  // { asset, name, kind, w, h, dur, fit, timing } per layer input, so autosave, undo and saved looks stay small.
  // Rendering bakes each asset into a canvas with the frame's aspect ratio (fit applied), which the kit runtime
  // uploads as an sRGB texture. Video: preview plays and drifts back into sync; export seeks every frame exactly.
  function createMediaStore({ onChange, isPlaying }) {
    const MAX_IMAGE = 60 * 1048576, MAX_VIDEO = 1024 * 1048576, MAX_BAKE = 4096;
    const assets = new Map();
    let passive = false;
    const dbP = (async () => {
      try {
        if (!window.indexedDB) return null;
        return await new Promise((res, rej) => { const r = indexedDB.open('motif3-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('assets', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      } catch (e) { return null; }
    })();
    const idb = async (mode, fn) => { const d = await dbP; if (!d) return null; return new Promise(res => { try { const tx = d.transaction('assets', mode); const q = fn(tx.objectStore('assets')); tx.oncomplete = () => res(q ? q.result : true); tx.onerror = () => res(null); tx.onabort = () => res(null); } catch (e) { res(null); } }); };
    async function hashId(buf) {
      try { const h = await crypto.subtle.digest('SHA-256', buf); return 'm_' + [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join(''); }
      catch (e) { return 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
    }
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
        }
        a.state = 'ready';
      })().catch(e => { a.state = 'error'; a.error = e.message || String(e); }).finally(() => onChange(a.id));
      return a.ready;
    }
    function ensure(id) {
      let a = assets.get(id); if (a) return a;
      a = { id, state: 'loading', bakes: new Map() }; assets.set(id, a);
      a.ready = idb('readonly', s => s.get(id)).then(rec => { if (!rec || !rec.blob) { a.state = 'missing'; onChange(id); return; } Object.assign(a, { name: rec.name, kind: rec.kind, mime: rec.mime, blob: rec.blob }); return decode(a); });
      return a;
    }
    // Add a File/Blob. Returns the layer-input metadata to store in the project.
    async function add(file) {
      const kind = kindOf(file); if (!kind) throw new Error(`${file.name || 'That file'} isn’t an image or video.`);
      if (file.size > (kind === 'image' ? MAX_IMAGE : MAX_VIDEO)) throw new Error(`${file.name} is larger than ${kind === 'image' ? '60 MB' : '1 GB'}.`);
      const buf = await file.arrayBuffer(); const id = await hashId(buf);
      let a = assets.get(id);
      if (!a || a.state === 'missing' || a.state === 'error') {
        a = { id, state: 'loading', bakes: new Map(), name: String(file.name || kind).slice(0, 80), kind, mime: file.type || '', blob: new Blob([buf], { type: file.type || '' }) };
        assets.set(id, a); await decode(a);
        if (a.state !== 'ready') throw new Error(a.error || 'That file could not be decoded.');
        a.stored = await idb('readwrite', s => s.put({ id, name: a.name, kind, mime: a.mime, blob: a.blob, w: a.w, h: a.h, dur: a.dur, added: Date.now() }));
      } else await a.ready;
      return { asset: id, name: a.name, kind: a.kind, w: a.w, h: a.h, dur: a.dur ? Math.round(a.dur * 1000) / 1000 : 0, stored: !!a.stored || a.stored === undefined };
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
      if (b.fit === 'stretch') x.drawImage(a.el, 0, 0, c.width, c.height);
      else { const s = b.fit === 'fill' ? Math.max(c.width / a.w, c.height / a.h) : Math.min(c.width / a.w, c.height / a.h); const dw = a.w * s, dh = a.h * s; x.drawImage(a.el, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh); }
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
        const rate = m.timing === 'free' ? 1 : Math.max(0.0625, Math.min(16, (a.dur || 1) / L));
        if (Math.abs(v.playbackRate - rate) > 1e-3) v.playbackRate = rate;
        if (v.paused) v.play().catch(() => {});
        const drift = Math.abs(v.currentTime - vt);
        if (!v.seeking && drift > 0.2 && drift < a.dur - 0.2) v.currentTime = vt;
      } else {
        if (!v.paused) v.pause();
        if (!v.seeking && Math.abs(v.currentTime - vt) > 1e-3) v.currentTime = vt;
      }
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
          time = a.el.currentTime;
          const frame = a.frameCallbacks ? a.frameRev : time;
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
          if (a.kind === 'video') { a.el.pause(); await seekTo(a.el, videoTime(a, m, t, L)); }
        }
      }
    }
    function release() { passive = false; onChange(null); }
    function info(id) { const a = assets.get(id); return a ? { state: a.state, error: a.error, el: a.el, w: a.w, h: a.h, kind: a.kind } : { state: 'unknown' }; }
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
    return { add, ensure, resolve, prepare, release, info, used, kindOf, pauseAll, syncPlayback, get persistent() { return dbP.then(d => !!d); } };
  }
