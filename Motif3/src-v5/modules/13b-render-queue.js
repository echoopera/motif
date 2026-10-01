// ---- module: render-queue v1.0.0
const __m_render_queue = (() => {
// render-queue — a persistent, sequential job queue for exports. Each job is { project snapshot, resolved settings, status, progress,
// output blob }. Jobs and outputs live in IndexedDB (outputs in OPFS when the browser allows), so the queue survives reloads: a job that was
// running becomes "interrupted" and can be retried. Rendering goes through a backend `(project, settings, ctx) => Promise<result>`, by default
// `__m_exporter.runExport`, so a worker-based render engine can replace it later with `queue.setBackend(fn)`.
// The host (shell) attaches a provider: { context(job) -> ctx for runExport, begin(job), end(job) } so the queue never touches the DOM or stage.
const X = __m_exporter;
const { frameCount, exportSize } = __m_renderer;
const { getStyle } = __m_style_library;
const g = typeof globalThis !== 'undefined' ? globalThis : window;

// ---------- presets ----------
// fps 0 = the project's frame rate, aspect '' = the project's aspect. bitrateMbps 0 = derive from quality.
const BUILTIN_PRESETS = [
  { id: 'youtube-1080', name: 'YouTube 1080p', note: 'Upload-ready 16:9 H.264', format: 'mp4', codec: 'avc', tier: 1080, fps: 0, aspect: '16x9', quality: 'high', bitrateMbps: 0, transparent: false, withAudio: true, loops: 1 },
  { id: 'hevc-4k', name: '4K HEVC', note: 'Smaller files than H.264 at 4K', format: 'mp4', codec: 'hevc', tier: 2160, fps: 0, aspect: '16x9', quality: 'high', bitrateMbps: 0, transparent: false, withAudio: true, loops: 1 },
  { id: 'social-vertical', name: 'Social vertical', note: 'Reels, Shorts and TikTok', format: 'mp4', codec: 'avc', tier: 1080, fps: 0, aspect: '9x16', quality: 'high', bitrateMbps: 0, transparent: false, withAudio: true, loops: 1 },
  { id: 'transparent-webm', name: 'Transparent WebM', note: 'Keeps the background clear, for overlays', format: 'webm', codec: 'vp9', tier: 1080, fps: 0, aspect: '', quality: 'high', bitrateMbps: 0, transparent: true, withAudio: false, loops: 1 },
  { id: 'png-sequence', name: 'PNG sequence', note: 'Lossless frames in a ZIP, with alpha', format: 'png-seq', codec: '', tier: 1080, fps: 0, aspect: '', quality: 'high', bitrateMbps: 0, transparent: true, withAudio: false, loops: 1 },
  { id: 'master', name: 'Master', note: 'High bitrate for editing and archive', format: 'mp4', codec: 'avc', tier: 2160, fps: 0, aspect: '', quality: 'max', bitrateMbps: 100, transparent: false, withAudio: true, loops: 1 },
];
const PRESET_KEY = 'motif.deliver.presets.v1';
const readPresetStore = () => { try { const v = JSON.parse(g.localStorage.getItem(PRESET_KEY)); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
const writePresetStore = v => { try { g.localStorage.setItem(PRESET_KEY, JSON.stringify(v)); return true; } catch (e) { return false; } };
const FORMATS = ['mp4', 'webm', 'png-seq'];
function cleanPreset(p, base = {}) {
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const out = { ...base, ...p };
  out.id = String(out.id || ''); out.name = String(out.name || 'Untitled preset').slice(0, 48); out.note = String(out.note || '').slice(0, 96);
  out.format = FORMATS.includes(out.format) ? out.format : 'mp4';
  out.codec = out.format === 'png-seq' ? '' : (X.CODECS[out.codec] ? out.codec : (out.format === 'mp4' ? 'avc' : 'vp9'));
  out.tier = X.TIERS.includes(Number(out.tier)) ? Number(out.tier) : 1080;
  out.fps = X.FPS.includes(Number(out.fps)) ? Number(out.fps) : 0;
  out.aspect = String(out.aspect || '');
  out.quality = ['standard', 'high', 'max'].includes(out.quality) ? out.quality : 'high';
  out.bitrateMbps = Math.max(0, Math.min(500, num(out.bitrateMbps, 0)));
  out.transparent = !!out.transparent; out.withAudio = !!out.withAudio && out.format !== 'png-seq';
  out.loops = Math.max(1, Math.min(8, Math.round(num(out.loops, 1))));
  return out;
}
// Built-ins can be edited (the override is stored) and reset; custom presets are added and deleted.
function listPresets() {
  const st = readPresetStore(), over = st.overrides || {}, custom = Array.isArray(st.custom) ? st.custom : [];
  return [...BUILTIN_PRESETS.map(b => ({ ...cleanPreset(over[b.id] || {}, b), builtin: true, edited: !!over[b.id] })), ...custom.map(c => ({ ...cleanPreset(c), builtin: false, edited: false }))];
}
function savePreset(p) {
  const st = readPresetStore(); st.overrides = st.overrides || {}; st.custom = Array.isArray(st.custom) ? st.custom : [];
  const builtin = BUILTIN_PRESETS.find(b => b.id === p.id);
  if (builtin) st.overrides[p.id] = { ...cleanPreset(p, builtin), id: p.id };
  else { const id = p.id && st.custom.some(c => c.id === p.id) ? p.id : 'custom-' + Date.now().toString(36); const next = { ...cleanPreset(p), id }; const i = st.custom.findIndex(c => c.id === id); if (i >= 0) st.custom[i] = next; else st.custom.push(next); p = next; }
  writePresetStore(st); return listPresets().find(x => x.id === p.id);
}
function deletePreset(id) { const st = readPresetStore(); if (BUILTIN_PRESETS.some(b => b.id === id)) { if (st.overrides) delete st.overrides[id]; } else st.custom = (st.custom || []).filter(c => c.id !== id); writePresetStore(st); }

// Turns a preset into the settings object `runExport` takes, for a given project and the viewer's aspect.
function resolveSettings(preset, project, aspect) {
  const p = cleanPreset(preset); const video = p.format === 'mp4' || p.format === 'webm';
  return { format: p.format, codec: video ? p.codec : undefined, tier: p.tier, fps: p.fps || project.output.fps, aspect: p.aspect || aspect || '16x9', loops: p.loops, quality: p.quality, bitrateMbps: video ? p.bitrateMbps : 0, transparent: p.transparent, withAudio: p.withAudio, hardware: true, time: 0 };
}
// Rough output size for the preset card: bitrate × duration for video (the same bitrate rule the exporter uses). null for frame sequences.
function estimateBytes(s, project) {
  if (s.format !== 'mp4' && s.format !== 'webm') return null;
  const { w, h } = exportSize(s.aspect, s.tier), cd = X.CODECS[s.codec] || X.CODECS.avc;
  const bitrate = s.bitrateMbps > 0 ? s.bitrateMbps * 1e6 : w * h * s.fps * ({ standard: 0.3, high: 0.55, max: 1.0 }[s.quality] || 0.55) * cd.bpp;
  return Math.round(bitrate / 8 * framesOf(project, s) / s.fps);
}
function framesOf(project, s) { return s.format === 'png' || s.format === 'json' ? 1 : frameCount(project, s.fps, s.loops); }

// ---------- stores ----------
function memoryStore() {
  const jobs = new Map(), blobs = new Map();
  return { kind: 'memory', persistent: false, async all() { return [...jobs.values()].map(j => ({ ...j })); }, async put(j) { jobs.set(j.id, JSON.parse(JSON.stringify(j))); }, async del(id) { jobs.delete(id); blobs.delete(id); }, async putBlob(id, blob) { blobs.set(id, blob); return 'memory'; }, async getBlob(id) { return blobs.get(id) || null; } };
}
const idbReq = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function openStore() {
  const nav = g.navigator;
  if (!g.indexedDB) return memoryStore();
  let db;
  try {
    db = await new Promise((res, rej) => { const r = g.indexedDB.open('motif-render-queue', 1); r.onupgradeneeded = () => { r.result.createObjectStore('jobs', { keyPath: 'id' }); r.result.createObjectStore('blobs'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked')); });
  } catch (e) { return memoryStore(); }
  const tx = (store, mode, fn) => new Promise((res, rej) => { const t = db.transaction(store, mode); let out; try { out = fn(t.objectStore(store)); } catch (e) { rej(e); return; } t.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  let opfs = null;
  const dir = async () => { if (opfs) return opfs; if (!(nav && nav.storage && nav.storage.getDirectory)) throw new Error('no opfs'); const root = await nav.storage.getDirectory(); opfs = await root.getDirectoryHandle('motif-renders', { create: true }); return opfs; };
  return {
    kind: 'indexeddb', persistent: true,
    all: () => tx('jobs', 'readonly', s => s.getAll()).then(a => a || []),
    put: j => tx('jobs', 'readwrite', s => s.put(JSON.parse(JSON.stringify(j)))),
    async del(id) { await tx('jobs', 'readwrite', s => s.delete(id)); await tx('blobs', 'readwrite', s => s.delete(id)).catch(() => {}); try { await (await dir()).removeEntry(id); } catch (e) { /* none */ } },
    async putBlob(id, blob) {
      try { const f = await (await dir()).getFileHandle(id, { create: true }); const w = await f.createWritable(); await w.write(blob); await w.close(); return 'opfs'; } catch (e) { /* fall back to IndexedDB */ }
      await tx('blobs', 'readwrite', s => s.put(blob, id)); return 'idb';
    },
    async getBlob(id, where) {
      if (where === 'opfs') { try { return await (await (await dir()).getFileHandle(id)).getFile(); } catch (e) { return null; } }
      return (await tx('blobs', 'readonly', s => s.get(id))) || null;
    },
  };
}

// ---------- notifications: tab title, app badge, optional system notification ----------
function makeNotifier() {
  const doc = g.document; if (!doc) return { update() {}, request: async () => 'unsupported' };
  const base = doc.title; let unseen = 0, lastDone = -1;
  const badge = n => { try { const nav = g.navigator; if (n > 0 && nav.setAppBadge) nav.setAppBadge(n); else if (nav.clearAppBadge) nav.clearAppBadge(); } catch (e) { /* unsupported */ } };
  const seen = () => { if (unseen) { unseen = 0; badge(0); } };
  g.addEventListener && g.addEventListener('focus', () => { seen(); });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) seen(); });
  return {
    update(snap) {
      const pct = Math.round((snap.running ? snap.running.progress : 0) * 100);
      const done = snap.jobs.filter(j => j.status === 'done').length;
      if (lastDone >= 0 && done > lastDone) { unseen += done - lastDone; badge(unseen); }
      lastDone = done;
      doc.title = snap.running ? `${snap.paused ? 'Paused' : pct + '%'} · rendering · ${base}` : unseen ? `${unseen} render${unseen > 1 ? 's' : ''} ready · ${base}` : base;
    },
    done(job) {
      try { if (g.Notification && g.Notification.permission === 'granted' && doc.hidden) new g.Notification(job.status === 'done' ? 'Render finished' : 'Render failed', { body: job.status === 'done' ? `${job.output.filename} is ready.` : (job.error || job.name), tag: 'motif-render' }); } catch (e) { /* not allowed */ }
    },
    async request() { try { if (!g.Notification) return 'unsupported'; return g.Notification.permission === 'default' ? await g.Notification.requestPermission() : g.Notification.permission; } catch (e) { return 'denied'; } },
  };
}

// ---------- the queue ----------
const uid = () => 'job-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
function createQueue({ backend, store, notifier } = {}) {
  let be = backend || ((p, s, c) => X.runExport(p, s, c)), provider = null, st = store || null;
  const jobs = [], listeners = new Set(), waiters = [];
  let paused = false, pauseReason = '', running = null, abort = null, pausedAt = 0, locks = 0, ready = null, pumping = false, loaded = false, lastSave = 0, rate = 0; // rate: ms per megapixel-frame, learnt from finished jobs
  const nt = notifier || makeNotifier();
  const now = () => (g.performance ? g.performance.now() : Date.now());

  const snapshot = () => ({ jobs: jobs.map(j => ({ ...j })), running: running ? { ...running } : null, paused, pauseReason, persistent: !!(st && st.persistent), storage: st ? st.kind : 'none', locked: locks > 0, ready: loaded });
  let emitT = 0;
  const emit = (force) => { const s = snapshot(); try { nt.update(s); } catch (e) { /* cosmetic */ } listeners.forEach(f => { try { f(s); } catch (e) { console.error(e); } }); return s; };
  const save = async (job, force) => { if (!st) return; const t = now(); if (!force && t - lastSave < 1000) return; lastSave = t; try { await st.put(job); } catch (e) { /* storage full or closed: the job still runs */ } };
  const releaseGates = () => { while (waiters.length) waiters.shift()(); };
  const gate = () => (paused ? new Promise(r => waiters.push(r)) : undefined);
  const mpx = j => (j.settings ? (() => { const { w, h } = exportSize(j.settings.aspect, j.settings.tier); return w * h / 1e6; })() : 1);
  const estimate = j => (rate && j.status !== 'done' ? Math.round(rate * mpx(j) * (j.frames || 1) * (1 - (j.status === 'running' ? j.progress : 0))) : null);

  async function init(opts = {}) {
    if (ready) return ready;
    ready = (async () => {
      if (!st) st = await openStore();
      let list = []; try { list = await st.all(); } catch (e) { st = memoryStore(); }
      list.sort((a, b) => a.createdAt - b.createdAt);
      for (const j of list) {
        if (j.status === 'running') { j.status = 'interrupted'; j.message = 'Interrupted: the page was closed or reloaded while this was rendering.'; j.finishedAt = Date.now(); await st.put(j).catch(() => {}); }
        jobs.push(j);
      }
      if (jobs.some(j => j.status === 'queued') && opts.autoResume !== true) { paused = true; pauseReason = 'reload'; }
      loaded = true; emit(); return true;
    })();
    return ready;
  }

  async function add(project, preset, { name, aspect, hasAudio } = {}) {
    await init();
    const p = typeof preset === 'string' ? listPresets().find(x => x.id === preset) : preset; if (!p) throw new Error('Unknown preset');
    const settings = resolveSettings(p, project, aspect); if (hasAudio === false) settings.withAudio = false;
    const first = project.layers[0] ? getStyle(project.layers[0].styleId).name : 'Motif';
    const job = { id: uid(), name: name || `${first}${project.layers.length > 1 ? ' +' + (project.layers.length - 1) : ''}`, presetId: p.id, presetName: p.name, createdAt: Date.now(), updatedAt: Date.now(), status: 'queued', progress: 0, message: 'Waiting', settings, project: JSON.parse(JSON.stringify(project)), frames: framesOf(project, settings), attempts: 0, error: '', output: null, elapsedMs: 0, etaMs: null, liveFps: 0 };
    jobs.push(job); await save(job, true); emit(); pump(); return job.id;
  }

  async function runJob(job) {
    running = job; abort = new AbortController(); pausedAt = 0;
    Object.assign(job, { status: 'running', progress: 0, message: 'Preparing', error: '', output: null, attempts: job.attempts + 1, startedAt: Date.now(), finishedAt: 0, pausedMs: 0, cancelRequested: false });
    await save(job, true); emit();
    const t0 = now(); let pausedMs = 0, pauseStart = 0;
    const active = () => now() - t0 - pausedMs - (pauseStart ? now() - pauseStart : 0);
    try {
      if (provider && provider.begin) await provider.begin(job);
      const base = provider && provider.context ? await provider.context(job) : {};
      const onProgress = (f, m) => {
        job.progress = Math.max(0, Math.min(1, f)); job.message = m || ''; job.elapsedMs = Math.round(active());
        job.liveFps = f > 0 && job.elapsedMs > 0 ? Math.round(f * job.frames / (job.elapsedMs / 1000) * 100) / 100 : 0;
        job.etaMs = f > 0.02 ? Math.round(job.elapsedMs * (1 - f) / f) : null; save(job); emit();
      };
      const mark = () => { if (paused && !pauseStart) pauseStart = now(); else if (!paused && pauseStart) { pausedMs += now() - pauseStart; pauseStart = 0; } };
      const myGate = () => { mark(); const r = gate(); return r ? r.then(mark) : undefined; };
      const result = await be(clone(job.project), { ...job.settings }, { ...base, signal: abort.signal, onProgress, gate: myGate });
      job.elapsedMs = Math.round(active());
      job.message = 'Saving the file'; emit();
      const where = await st.putBlob(job.id, result.blob).catch(e => { throw new Error('The render finished but the file could not be stored: ' + (e && e.message || e)); });
      const s = job.settings, seconds = job.frames / s.fps;
      job.output = { filename: result.filename, size: result.blob.size, type: result.blob.type, storage: where, codec: s.format === 'png-seq' ? 'PNG' : (result.codec ? (X.CODECS[result.codec] ? X.CODECS[result.codec].label : result.codec) : s.format.toUpperCase()), container: s.format === 'png-seq' ? 'ZIP' : s.format.toUpperCase(), width: exportSize(s.aspect, s.tier).w, height: exportSize(s.aspect, s.tier).h, fps: s.fps, frames: job.frames, durationSec: s.format === 'png-seq' ? seconds : Math.round(seconds * 1000) / 1000, note: result.note || '', colorTag: result.colorTag || '', audioCodec: result.audioCodec || null, stats: result.stats || null, renderMs: job.elapsedMs, renderFps: Math.round(job.frames / Math.max(0.001, job.elapsedMs / 1000) * 100) / 100 };
      job.status = 'done'; job.progress = 1; job.message = 'Done'; job.etaMs = 0;
      const r = job.elapsedMs / Math.max(1, mpx(job) * job.frames); rate = rate ? rate * 0.5 + r * 0.5 : r;
    } catch (e) {
      if (job.cancelRequested || (e && e.name === 'AbortError')) { job.status = 'cancelled'; job.message = 'Cancelled'; job.error = ''; }
      else { console.error(e); job.status = 'error'; job.error = e && e.message ? e.message : String(e); job.message = 'Failed'; }
    } finally {
      job.finishedAt = Date.now(); job.updatedAt = Date.now(); running = null; abort = null;
      if (provider && provider.end) { try { await provider.end(job); } catch (e) { /* host cleanup */ } }
      await save(job, true); emit(); if (job.status === 'done' || job.status === 'error') { try { nt.done && nt.done(job); } catch (e) { /* cosmetic */ } }
    }
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  async function pump() {
    if (pumping) return; pumping = true;
    try {
      await init();
      while (!paused && !locks) { const next = jobs.find(j => j.status === 'queued'); if (!next) break; await runJob(next); await new Promise(r => setTimeout(r, 0)); }
    } finally { pumping = false; }
  }

  const find = id => jobs.find(j => j.id === id);
  const api = {
    init, add, snapshot, estimate, setBackend(fn) { be = fn; }, setProvider(p) { provider = p; },
    subscribe(f) { listeners.add(f); return () => listeners.delete(f); },
    pause() { if (paused) return; paused = true; pauseReason = 'user'; emit(); },
    resume() { if (!paused) return; paused = false; pauseReason = ''; releaseGates(); emit(); pump(); },
    cancel(id) {
      const j = find(id); if (!j) return;
      if (j === running) { j.cancelRequested = true; abort && abort.abort(); releaseGates(); return; }
      if (j.status === 'queued' || j.status === 'interrupted') { j.status = 'cancelled'; j.message = 'Cancelled'; save(j, true); emit(); }
    },
    retry(id) { const j = find(id); if (!j || !['error', 'interrupted', 'cancelled'].includes(j.status)) return; Object.assign(j, { status: 'queued', progress: 0, message: 'Waiting', error: '', etaMs: null, liveFps: 0 }); save(j, true); emit(); pump(); },
    async remove(id) { const j = find(id); if (!j) return; if (j === running) { api.cancel(id); return; } jobs.splice(jobs.indexOf(j), 1); try { await st.del(id); } catch (e) { /* gone */ } emit(); },
    async clearFinished() { for (const j of jobs.filter(j => ['done', 'cancelled'].includes(j.status))) await api.remove(j.id); },
    async output(id) { const j = find(id); if (!j || !j.output) return null; return st.getBlob(id, j.output.storage); },
    move(id, dir) { const i = jobs.findIndex(j => j.id === id), k = i + dir, a = jobs[i], b = jobs[k]; if (!a || !b || a.status !== 'queued' || b.status !== 'queued') return; jobs[i] = b; jobs[k] = a; emit(); },
    // The quick-export dialog takes the lock so a queue job never renders at the same time. Returns a release function, or null while a job runs.
    lock() { if (running) return null; locks++; let done = false; return () => { if (done) return; done = true; locks--; emit(); pump(); }; },
    notifications: () => nt, requestNotifications: () => nt.request(),
    get running() { return running ? { ...running } : null; }, get paused() { return paused; },
  };
  return api;
}

let shared = null;
const getQueue = () => shared || (shared = createQueue());
return { BUILTIN_PRESETS, listPresets, savePreset, deletePreset, cleanPreset, resolveSettings, framesOf, estimateBytes, memoryStore, openStore, createQueue, getQueue };

})();
