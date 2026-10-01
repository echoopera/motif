// ---- module: media-pool v1.0.0
const __m_media_pool = (() => {
// media-pool — persistent, content-addressed storage for imported images and video. Never uploads anything.
// Backends, chosen per browser: the Origin Private File System (files on disk, read back lazily as File objects, so
// multi-gigabyte footage never has to sit in memory and survives reloads) with IndexedDB as the fallback and as the
// read-through source for assets stored by Motif 3–5.0 (migrated into OPFS the first time they are read).
//
// OPFS layout:  motif-media/<id>.bin  (the bytes)  +  motif-media/<id>.json  (metadata; written last, so it is the
// commit marker: a .bin without a .json is an interrupted import and is swept on the next list()).
// Metadata: { id, name, kind, mime, size, w, h, dur, codec, added, used, thumb }  (thumb = small JPEG data URL).
const DIR = 'motif-media';
const FULL_HASH_MAX = 256 * 1048576, SAMPLE = 4 * 1048576, TOUCH_MS = 60000;

// Content id. Files up to 256 MB are hashed in full (identical to the ids Motif 3–5.0 wrote, so old projects keep
// resolving). Larger files hash their size plus head, middle and tail 4 MB so a 4 GB import doesn't need 4 GB of RAM.
async function hashFile(file) {
  try {
    let buf;
    if (file.size <= FULL_HASH_MAX) buf = await file.arrayBuffer();
    else {
      const parts = [new TextEncoder().encode('s' + file.size)], mid = Math.floor(file.size / 2 - SAMPLE / 2);
      for (const at of [0, mid, file.size - SAMPLE]) parts.push(new Uint8Array(await file.slice(at, at + SAMPLE).arrayBuffer()));
      buf = await new Blob(parts).arrayBuffer();
    }
    const h = await crypto.subtle.digest('SHA-256', buf);
    return 'm_' + [...new Uint8Array(h)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { return 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}
const validId = id => typeof id === 'string' && /^m_[a-z0-9]{8,32}$/.test(id);
const isQuota = e => !!e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 'quota' || /quota/i.test(e.message || ''));
const poolError = (code, message) => Object.assign(new Error(message), { code });

// Safari and some embedded webviews have no FileSystemFileHandle.createWritable on the main thread; a tiny worker with
// a synchronous access handle writes the same bytes. The worker owns nothing: it opens, writes, closes, exits.
const WORKER_SRC = `onmessage = async e => { const { dir, name, blob } = e.data; try {
  const root = await navigator.storage.getDirectory(), d = await root.getDirectoryHandle(dir, { create: true });
  const fh = await d.getFileHandle(name, { create: true }), h = await fh.createSyncAccessHandle();
  try { h.truncate(0); let at = 0; for (let o = 0; o < blob.size; o += 8388608) { const b = new Uint8Array(await blob.slice(o, o + 8388608).arrayBuffer()); h.write(b, { at }); at += b.length; } h.flush(); } finally { h.close(); }
  postMessage({ ok: true });
} catch (err) { postMessage({ ok: false, name: err && err.name, message: err && err.message }); } };`;

function create(opts = {}) {
  const want = opts.backend || 'auto';            // 'auto' | 'opfs' | 'idb' | 'none' (tests force one)
  const noWritable = !!opts.forceWorker;
  const meta = new Map();                          // id -> metadata (both backends)
  const touched = new Map();
  let dirP = null, dbP = null, workerUrl = null;

  // ---------- OPFS ----------
  const opfsOk = () => want !== 'idb' && want !== 'none' && typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.getDirectory === 'function';
  const dir = () => dirP || (dirP = (async () => {
    if (!opfsOk()) return null;
    try { const root = await navigator.storage.getDirectory(); const d = await root.getDirectoryHandle(DIR, { create: true }); return d; } catch (e) { return null; }
  })());
  async function writeBlob(d, name, blob) {
    if (!noWritable) {
      const fh = await d.getFileHandle(name, { create: true });
      if (typeof fh.createWritable === 'function') {
        const w = await fh.createWritable();
        try { await blob.stream().pipeTo(w); } catch (e) { try { await w.abort(); } catch (_) { /* already closed */ } throw e; }
        return;
      }
    }
    if (typeof Worker === 'undefined') throw poolError('unavailable', 'This browser cannot write to its private file system.');
    workerUrl = workerUrl || URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' }));
    await new Promise((res, rej) => {
      const w = new Worker(workerUrl);
      w.onmessage = e => { w.terminate(); e.data.ok ? res() : rej(Object.assign(new Error(e.data.message || 'write failed'), { name: e.data.name || 'Error' })); };
      w.onerror = e => { w.terminate(); rej(new Error(e.message || 'worker failed')); };
      w.postMessage({ dir: DIR, name, blob });
    });
  }
  const dropFile = async (d, name) => { try { await d.removeEntry(name); } catch (e) { /* not there */ } };

  // ---------- IndexedDB (fallback + legacy) ----------
  const db = () => dbP || (dbP = (async () => {
    try {
      if (want === 'none' || !window.indexedDB) return null;
      return await new Promise((res, rej) => { const r = indexedDB.open('motif3-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('assets', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    } catch (e) { return null; }
  })());
  const idb = async (mode, fn) => {
    const d = await db(); if (!d) return { ok: false, value: null, error: null };
    return new Promise(res => {
      try { const tx = d.transaction('assets', mode); const q = fn(tx.objectStore('assets')); tx.oncomplete = () => res({ ok: true, value: q ? q.result : true }); tx.onerror = () => res({ ok: false, value: null, error: tx.error }); tx.onabort = () => res({ ok: false, value: null, error: tx.error }); }
      catch (e) { res({ ok: false, value: null, error: e }); }
    });
  };

  // ---------- backend choice ----------
  // 'opfs' when the origin private file system is usable, else 'idb' when IndexedDB opens, else 'none' (session only).
  const backendP = (async () => {
    if (want === 'none') return 'none';
    if (want !== 'idb' && await dir()) return 'opfs';
    return (await db()) ? 'idb' : 'none';
  })();

  const normalise = (m, backend) => ({ id: m.id, name: m.name || 'Untitled', kind: m.kind, mime: m.mime || '', size: m.size || 0, w: m.w || 0, h: m.h || 0, dur: m.dur || 0, codec: m.codec || '', added: m.added || 0, used: m.used || m.added || 0, thumb: m.thumb || '', backend });
  async function readMeta(d, id) { try { const f = await (await d.getFileHandle(id + '.json')).getFile(); return JSON.parse(await f.text()); } catch (e) { return null; } }

  // list(): every stored asset (OPFS + not-yet-migrated IndexedDB), newest-used first. Also sweeps interrupted imports.
  async function list() {
    const out = []; const seen = new Set(); const b = await backendP;
    const d = await dir();
    if (d) {
      const names = new Set(); try { for await (const [n] of d.entries()) names.add(n); } catch (e) { /* iteration unsupported */ }
      for (const n of names) {
        if (n.endsWith('.json')) { const m = await readMeta(d, n.slice(0, -5)); if (m && validId(m.id) && names.has(m.id + '.bin')) { const r = normalise(m, 'opfs'); out.push(r); seen.add(r.id); meta.set(r.id, r); } }
        else if (n.endsWith('.bin') && !names.has(n.slice(0, -4) + '.json')) await dropFile(d, n);
      }
    }
    const all = await idb('readonly', s => s.getAll());
    if (all.ok && Array.isArray(all.value)) for (const rec of all.value) if (rec && validId(rec.id) && !seen.has(rec.id)) { const r = normalise({ ...rec, size: rec.size || (rec.blob && rec.blob.size) || 0 }, 'idb'); out.push(r); meta.set(r.id, r); }
    out.sort((x, y) => y.used - x.used);
    return out;
  }

  // get(id): { ...metadata, blob } or null. Legacy IndexedDB records are copied into OPFS on first read.
  async function get(id) {
    if (!validId(id)) return null;
    const d = await dir();
    if (d) {
      const m = await readMeta(d, id);
      if (m) { try { const blob = await (await d.getFileHandle(id + '.bin')).getFile(); const r = normalise({ ...m, size: blob.size }, 'opfs'); meta.set(id, r); touch(id); return { ...r, blob }; } catch (e) { /* bytes gone: fall through */ } }
    }
    const rec = await idb('readonly', s => s.get(id));
    if (rec.ok && rec.value && rec.value.blob) {
      const r = rec.value, m = { ...r, size: r.blob.size, used: Date.now() };
      let backend = 'idb', blob = r.blob;
      if (d) { try { await putOpfs(d, id, m, r.blob); blob = (await (await d.getFileHandle(id + '.bin')).getFile()); backend = 'opfs'; await idb('readwrite', s => s.delete(id)); } catch (e) { /* keep IndexedDB copy */ } }
      const n = normalise(m, backend); meta.set(id, n); return { ...n, blob };
    }
    return null;
  }

  async function putOpfs(d, id, m, blob) {
    try { await writeBlob(d, id + '.bin', blob); const f = await (await d.getFileHandle(id + '.bin')).getFile(); if (f.size !== blob.size) throw poolError('short', 'The copy was cut short.'); await writeBlob(d, id + '.json', new Blob([JSON.stringify({ ...m, blob: undefined })])); }
    catch (e) { await dropFile(d, id + '.bin'); await dropFile(d, id + '.json'); throw isQuota(e) ? poolError('quota', 'Browser storage is full.') : e; }
  }

  // put(id, metadata, blob): stores the bytes. Resolves { ok, backend } or throws an Error with .code 'quota' | 'unavailable'.
  const inflight = new Map();
  async function put(id, m, blob) {
    if (!validId(id)) throw poolError('unavailable', 'Bad asset id.');
    while (inflight.has(id)) await inflight.get(id);
    const job = (async () => {
      const b = await backendP, now = Date.now();
      const full = { ...m, id, size: blob.size, mime: m.mime || blob.type || '', added: m.added || now, used: now };
      if (b === 'opfs') { const d = await dir(); await putOpfs(d, id, full, blob); meta.set(id, normalise(full, 'opfs')); return { ok: true, backend: 'opfs' }; }
      if (b === 'idb') {
        const r = await idb('readwrite', s => s.put({ ...full, blob }));
        if (!r.ok) throw isQuota(r.error) ? poolError('quota', 'Browser storage is full.') : poolError('unavailable', 'Browser storage refused the file.');
        meta.set(id, normalise(full, 'idb')); return { ok: true, backend: 'idb' };
      }
      return { ok: false, backend: 'none' };
    })();
    inflight.set(id, job.catch(() => {}));
    try { return await job; } finally { inflight.delete(id); }
  }

  // update(id, patch): merge metadata (decoded size, codec, thumbnail) without touching the bytes.
  async function update(id, patch) {
    const cur = meta.get(id); if (!cur) return false;
    const next = { ...cur, ...patch, id }; meta.set(id, next);
    const d = await dir();
    if (cur.backend === 'opfs' && d) { try { await writeBlob(d, id + '.json', new Blob([JSON.stringify(next)])); return true; } catch (e) { return false; } }
    if (cur.backend === 'idb') { const rec = await idb('readonly', s => s.get(id)); if (rec.ok && rec.value) { const w = await idb('readwrite', s => s.put({ ...rec.value, ...patch, id })); return w.ok; } }
    return false;
  }
  function touch(id) { const now = Date.now(); if (now - (touched.get(id) || 0) < TOUCH_MS) return; touched.set(id, now); const cur = meta.get(id); if (cur) update(id, { used: now }).catch(() => {}); }

  async function remove(id) {
    meta.delete(id);
    const d = await dir(); if (d) { await dropFile(d, id + '.bin'); await dropFile(d, id + '.json'); }
    await idb('readwrite', s => s.delete(id));
    return true;
  }

  // usage(): storage meter data. poolBytes is what Motif stores; usage/quota are the origin-wide browser estimate.
  async function usage() {
    const items = await list(); let est = {};
    try { est = (navigator.storage && navigator.storage.estimate && await navigator.storage.estimate()) || {}; } catch (e) { /* no estimate */ }
    let persisted = null; try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (e) { /* unknown */ }
    return { backend: await backendP, count: items.length, poolBytes: items.reduce((s, x) => s + x.size, 0), usage: est.usage || 0, quota: est.quota || 0, persisted };
  }
  async function persist() { try { return !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); } catch (e) { return false; } }

  // evict(bytes, protectedIds): delete least-recently-used assets not in protectedIds until `bytes` are freed.
  async function evict(bytes, protectedIds = []) {
    const keep = new Set(protectedIds), items = (await list()).filter(x => !keep.has(x.id)).sort((a, b) => a.used - b.used); let freed = 0; const removed = [];
    for (const it of items) { if (freed >= bytes) break; await remove(it.id); freed += it.size; removed.push(it.id); }
    return { freed, removed };
  }
  // thumbnail(source, w, h): small JPEG data URL for the media page; source is an ImageBitmap, <video> or <canvas>.
  function thumbnail(source, sw, sh, W = 160, H = 90) {
    try {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
      const s = Math.max(W / sw, H / sh); x.fillStyle = '#151519'; x.fillRect(0, 0, W, H); x.drawImage(source, (W - sw * s) / 2, (H - sh * s) / 2, sw * s, sh * s);
      return c.toDataURL('image/jpeg', 0.7);
    } catch (e) { return ''; }
  }
  return { get, put, update, remove, list, usage, persist, evict, thumbnail, hashFile, get backend() { return backendP; }, get ready() { return backendP.then(() => true); }, _meta: meta };
}

return { create, hashFile, validId };

})();
