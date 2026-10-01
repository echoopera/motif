// ---- module: media-page v1.0.0
(() => {
// media-page — inspector page "Media": everything in the media pool (13a) in one place. Thumbnails, resolution, duration,
// codec, size, in-use badges, relink for files the project references but this browser lacks, delete, a storage meter,
// drag-and-drop import and a quota-exceeded recovery path. Text is DOM; the thumbnails are <img> data URLs.
// Keyboard: ↑/↓ (or ←/→) move through the list, Home/End jump, Enter uses the clip on the active layer, Delete removes it.
const { getStyle } = __m_style_library;

const CSS = `
[data-panel="media"]{padding-bottom:var(--space-6)}
.tabs:has([data-tab="media"]){grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}
.mp-body{display:grid;gap:var(--space-4);padding:var(--space-3)}
.mp-meter{display:grid;gap:var(--space-2);padding:var(--space-3);background:var(--surface-0);border:var(--hairline) solid var(--line);border-radius:var(--radius-l)}
.mp-meter .row1{display:flex;justify-content:space-between;gap:var(--space-2);align-items:baseline}
.mp-meter b{font:600 var(--text-md)/20px var(--font-ui);color:var(--text-strong)}
.mp-bar{height:var(--space-2);border-radius:var(--radius-s);background:var(--surface-3);overflow:hidden}
.mp-bar i{display:block;height:100%;width:calc(var(--v,0) * 100%);min-width:var(--space-1);background:var(--ok)}
.mp-meter[data-level="warn"] .mp-bar i{background:var(--accent)}
.mp-meter[data-level="full"] .mp-bar i{background:var(--danger)}
.mp-drop{display:grid;place-items:center;gap:var(--space-1);text-align:center;min-height:var(--space-8);padding:var(--space-4);border:var(--hairline) dashed var(--line-strong);border-radius:var(--radius-l);background:transparent;color:var(--text-muted);cursor:pointer;width:100%}
.mp-drop:hover,.mp-body.over .mp-drop{border-color:var(--accent-line);background:var(--accent-soft);color:var(--text)}
.mp-drop b{color:var(--text-strong);font:600 var(--text-md)/20px var(--font-ui)}
.mp-banner{display:grid;gap:var(--space-2);padding:var(--space-3);border:var(--hairline) solid var(--line-strong);border-radius:var(--radius-l);background:var(--surface-2)}
.mp-banner[data-kind="quota"],.mp-banner[data-kind="error"]{border-color:var(--danger)}
.mp-banner h2,.mp-sec h2{margin:0;font:600 var(--text-sm)/16px var(--font-ui);color:var(--text-strong)}
.mp-banner p{margin:0}
.mp-sec{display:grid;gap:var(--space-2)}
.mp-sec>.lbl{display:flex;justify-content:space-between}
.mp-list{list-style:none;margin:0;padding:0;display:grid;gap:var(--space-1)}
.mp-item{display:grid;grid-template-columns:80px minmax(0,1fr) auto;gap:var(--space-3);align-items:center;padding:var(--space-2);border:var(--hairline) solid transparent;border-radius:var(--radius-m);background:var(--surface-2);cursor:default}
.mp-item:hover{background:var(--surface-3)}
.mp-item[aria-selected="true"]{border-color:var(--accent);background:var(--accent-soft)}
.mp-item:focus-visible{outline:var(--focus-w) solid var(--focus);outline-offset:var(--space-1)}
.mp-thumb{width:80px;height:48px;border-radius:var(--radius-s);background:var(--stage);object-fit:cover;display:block}
.mp-thumb[data-empty]{display:grid;place-items:center;color:var(--text-dim)}
.mp-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-strong);font:500 var(--text-md)/20px var(--font-ui)}
.mp-meta{display:block;font:400 var(--text-xs)/16px var(--font-mono);color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mp-badge{font:600 var(--text-xs)/16px var(--font-mono);padding:0 var(--space-1);border-radius:var(--radius-s);border:var(--hairline) solid var(--line-strong);color:var(--text-muted);white-space:nowrap}
.mp-badge[data-on]{border-color:var(--accent-line);color:var(--accent);background:var(--accent-soft)}
.mp-badge[data-bad]{border-color:var(--danger);color:var(--danger)}
.mp-actions{display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center}
.mp-actions .sp{flex:1}
.mp-miss{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--space-2);align-items:center;padding:var(--space-2) var(--space-3);border:var(--hairline) solid var(--danger);border-radius:var(--radius-m);background:var(--surface-2)}
.mp-skel{height:calc(var(--space-6) + var(--space-4));border-radius:var(--radius-m);background:var(--surface-2)}
.mp-empty{display:grid;justify-items:center;gap:var(--space-2);text-align:center;padding:var(--space-5) var(--space-3);color:var(--text-muted)}
.mp-empty svg{width:var(--space-8);height:var(--space-8);fill:none;stroke:var(--text-dim);stroke-width:1.5}
.mp-empty b{color:var(--text-strong);font:600 var(--text-lg)/24px var(--font-ui)}
.mp-hint{margin:0;color:var(--text-dim);font:400 var(--text-xs)/16px var(--font-ui)}
.mp-hint kbd{font:500 var(--text-xs)/16px var(--font-mono);border:var(--hairline) solid var(--line-strong);border-radius:var(--radius-s);padding:0 var(--space-1)}
.mp-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
@media (prefers-reduced-motion:no-preference){.mp-skel{animation:mp-pulse 1.2s var(--ease-out) infinite alternate}@keyframes mp-pulse{from{opacity:.5}to{opacity:1}}.mp-bar i{transition:width var(--dur-base) var(--ease-out)}}
`;
const ICON = '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M8 5v4M16 5v4M10 14l4 2.5-4 2.5Z"/></svg>';
const EMPTY_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="10" width="36" height="28" rx="4"/><path d="M6 30l9-8 8 7 6-5 13 10"/><circle cx="32" cy="19" r="3"/></svg>';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtBytes = n => n >= 1073741824 ? (n / 1073741824).toFixed(n >= 10737418240 ? 0 : 1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(n >= 104857600 ? 0 : 1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
const fmtDur = s => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${s.toFixed(1)} s`;
const STALE_MS = 5000;
const BACKENDS = { opfs: 'Private file system', idb: 'IndexedDB', none: 'This session only' };

const ctx = { host: null, api: null, items: [], usage: null, status: 'loading', sel: null, confirm: null, busy: '', notice: null, errors: [], at: 0, live: '', thumbing: false, bound: false };

function usedMap(project) {   // asset id -> ['Layer 2 · Plexus', ...]
  const m = new Map();
  project.layers.forEach((l, i) => { for (const v of Object.values(l.media || {})) if (v && v.asset) { const a = m.get(v.asset) || []; a.push(`Layer ${i + 1} · ${getStyle(l.styleId).name}`); m.set(v.asset, a); } });
  return m;
}
function missingRefs(project, api) {   // assets the project references that the pool can't supply
  const have = new Set(ctx.items.map(x => x.id)), out = new Map();
  for (const l of project.layers) for (const v of Object.values(l.media || {})) {
    if (!v || !v.asset || have.has(v.asset) || out.has(v.asset)) continue;
    const i = api.media.info(v.asset);
    if (i.state === 'unknown') { api.media.ensure(v.asset).ready.then(() => { if (ctx.api === api) render(); }); continue; }
    if (i.state === 'missing') out.set(v.asset, v);
  }
  return [...out.values()];
}

async function refresh(force) {
  const { api } = ctx; if (!api) return;
  if (!force && ctx.status === 'ready' && Date.now() - ctx.at < STALE_MS) return;
  try {
    const pool = api.media.pool;
    const [items, usage] = await Promise.all([pool.list(), pool.usage()]);
    ctx.items = items; ctx.usage = usage; ctx.status = usage.backend === 'none' ? 'error' : 'ready'; ctx.at = Date.now();
    if (ctx.sel && !items.some(x => x.id === ctx.sel)) ctx.sel = null;
  } catch (e) { ctx.status = 'error'; }
  render(); fillThumbs();
}

// Assets stored before 5.1 (or by another route) have no thumbnail: decode them one at a time and keep the result.
async function fillThumbs() {
  if (ctx.thumbing) return; ctx.thumbing = true;
  try {
    for (const it of ctx.items.slice(0, 24)) {
      if (it.thumb || !ctx.api) continue;
      const a = ctx.api.media.ensure(it.id); await a.ready; const i = ctx.api.media.info(it.id);
      if (i.state !== 'ready' || !i.el) continue;
      const thumb = ctx.api.media.pool.thumbnail(i.el, i.w, i.h); if (!thumb) continue;
      await ctx.api.media.pool.update(it.id, { thumb, w: i.w, h: i.h, dur: i.dur || 0, codec: i.codec || '' });
      it.thumb = thumb; it.w = i.w; it.h = i.h; it.dur = i.dur || 0; it.codec = i.codec || ''; render();
    }
  } finally { ctx.thumbing = false; }
}

function announce(msg) { ctx.live = msg; const el = ctx.host && ctx.host.querySelector('.mp-live'); if (el) el.textContent = msg; }

function itemHtml(it, used, tabbable) {
  const u = used.get(it.id), codec = it.codec || (it.mime ? it.mime.split('/')[1] : '') || it.kind;
  const bits = [it.w && it.h ? `${it.w}×${it.h}` : '', it.kind === 'video' && it.dur ? fmtDur(it.dur) : it.kind, codec, fmtBytes(it.size)].filter(Boolean).join(' · ');
  const thumb = it.thumb ? `<img class="mp-thumb" alt="" src="${it.thumb}">` : `<span class="mp-thumb" data-empty aria-hidden="true">${ICON}</span>`;
  const label = `${it.name}, ${bits}${u ? ', in use by ' + u.join(', ') : ', not in use'}`;
  return `<li class="mp-item" role="option" id="mp-${it.id}" data-id="${it.id}" tabindex="${tabbable ? 0 : -1}" aria-selected="${ctx.sel === it.id}" aria-label="${esc(label)}">
    ${thumb}<span><span class="mp-name" title="${esc(it.name)}">${esc(it.name)}</span><span class="mp-meta">${esc(bits)}</span></span>
    <span class="mp-badge"${u ? ' data-on' : ''}>${u ? `In use${u.length > 1 ? ' ×' + u.length : ''}` : 'Unused'}</span></li>`;
}

function render() {
  const { host, api } = ctx; if (!host || !api) return;
  const prev = document.activeElement, keep = prev && host.contains(prev) ? (prev.dataset.id ? 'id:' + prev.dataset.id : prev.dataset.act ? 'act:' + prev.dataset.act : '') : '';
  const project = api.project, used = usedMap(project), items = ctx.items, u = ctx.usage, miss = ctx.status === 'ready' ? missingRefs(project, api) : [];
  const sel = items.find(x => x.id === ctx.sel), tabId = sel ? sel.id : items[0] && items[0].id;
  const frac = u && u.quota ? Math.min(1, u.usage / u.quota) : 0, level = frac > 0.9 ? 'full' : frac > 0.75 ? 'warn' : 'ok';
  const quotaHit = ctx.notice && ctx.notice.kind === 'quota';
  const unusedBytes = items.filter(x => !used.has(x.id)).reduce((s, x) => s + x.size, 0);

  const meter = ctx.status === 'loading' ? '' : `<div class="mp-meter" data-level="${level}">
      <div class="row1"><b>${u && u.quota ? `${fmtBytes(u.usage)} of ${fmtBytes(u.quota)}` : `${fmtBytes(u ? u.poolBytes : 0)} stored`}</b><span class="readout">${esc(BACKENDS[u ? u.backend : 'none'])}</span></div>
      <div class="mp-bar" role="meter" aria-label="Browser storage used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(frac * 100)}" style="--v:${frac}"><i></i></div>
      <p class="info">Media pool: <b>${items.length}</b> file${items.length === 1 ? '' : 's'}, <b>${fmtBytes(u ? u.poolBytes : 0)}</b>. Files stay in this browser and are never uploaded.${u && u.persisted === false ? ' Storage is not marked persistent, so the browser may clear it under pressure.' : ''}</p>
      ${u && u.persisted === false ? '<div class="mp-actions"><button class="btn sm" data-act="persist">Keep my media</button></div>' : ''}</div>`;

  let banner = '';
  if (ctx.status === 'error') banner = `<div class="mp-banner" data-kind="error" role="alert"><h2>Storage unavailable</h2><p class="info">This browser blocks local storage for this page, so imported files last only until you reload. Everything else works.</p></div>`;
  else if (quotaHit || level === 'full') banner = `<div class="mp-banner" data-kind="quota" role="alert"><h2>Browser storage is full</h2><p class="info">${quotaHit ? esc(ctx.notice.text) + ' ' : ''}${unusedBytes ? `${fmtBytes(unusedBytes)} belongs to clips no layer uses.` : 'Every stored clip is in use by a layer.'}</p>
      <div class="mp-actions"><button class="btn sm primary" data-act="free"${unusedBytes ? '' : ' disabled'}>Remove unused clips, oldest first</button></div></div>`;
  const errs = ctx.errors.length ? `<div class="mp-banner" data-kind="error" role="alert"><h2>${ctx.errors.length} file${ctx.errors.length === 1 ? '' : 's'} not imported</h2>${ctx.errors.map(e => `<p class="info">${esc(e)}</p>`).join('')}<div class="mp-actions"><button class="btn sm" data-act="dismiss">Dismiss</button></div></div>` : '';

  const missing = miss.length ? `<div class="mp-sec"><h2>Missing in this browser</h2>${miss.map(m => `<div class="mp-miss"><span><span class="mp-name">${esc(m.name || 'Untitled')}</span><span class="mp-meta">${m.w}×${m.h} · ${m.kind}${m.kind === 'video' ? ' · ' + fmtDur(m.dur) : ''} · choose the same file again</span></span><button class="btn sm" data-relink="${m.asset}">Relink…</button></div>`).join('')}</div>` : '';

  let list;
  if (ctx.status === 'loading') list = '<div class="mp-sec" aria-busy="true"><div class="mp-skel"></div><div class="mp-skel"></div><div class="mp-skel"></div></div>';
  else if (!items.length) list = `<div class="mp-empty">${EMPTY_SVG}<b>No media yet</b><span>Drop photos or video here, or import them. They are stored in this browser, and stay available after you reload.</span></div>`;
  else {
    const confirmBar = sel && ctx.confirm === sel.id
      ? `<div class="mp-actions" role="group" aria-label="Confirm removal"><span class="info grow">Remove <b>${esc(sel.name)}</b>${used.has(sel.id) ? `? It is used by ${esc(used.get(sel.id).join(', '))}; those slots will show Relink.` : '?'}</span><span class="sp"></span><button class="btn sm" data-act="cancel">Cancel</button><button class="btn sm primary" data-act="remove">Remove</button></div>`
      : `<div class="mp-actions" role="toolbar" aria-label="Selected clip actions"><button class="btn sm accent" data-act="use"${sel ? '' : ' disabled'}>Use on active layer</button><button class="btn sm" data-act="delete"${sel ? '' : ' disabled'}>Delete</button></div>`;
    list = `<div class="mp-sec"><div class="lbl"><span>Pool</span><span>${items.length}</span></div>
      <ul class="mp-list" role="listbox" aria-label="Media pool" aria-describedby="mp-hint">${items.map(it => itemHtml(it, used, it.id === tabId)).join('')}</ul>${confirmBar}
      <p class="mp-hint" id="mp-hint"><kbd>↑</kbd> <kbd>↓</kbd> move · <kbd>Enter</kbd> use on the active layer · <kbd>Delete</kbd> remove</p></div>`;
  }

  host.innerHTML = `<div class="panel-head"><div class="lbl">${ctx.status === 'ready' ? `${items.length} in pool` : ctx.status === 'loading' ? 'Loading' : 'Unavailable'}</div><h1>Media</h1></div>
    <div class="mp-body${ctx.dragging ? ' over' : ''}" aria-busy="${ctx.status === 'loading' || !!ctx.busy}">
      ${meter}${banner}${errs}
      <button class="mp-drop" data-act="import"><b>${ctx.busy ? esc(ctx.busy) : 'Import images or video'}</b><span class="info">Drop files here or choose them. MP4 and MOV get frame-accurate scrubbing.</span></button>
      ${missing}${list}
      <div class="mp-live" role="status" aria-live="polite">${esc(ctx.live)}</div></div>`;
  if (keep) { const el = keep.startsWith('id:') ? host.querySelector(`[data-id="${keep.slice(3)}"]`) : host.querySelector(`[data-act="${keep.slice(4)}"]`); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}

async function importFiles(files) {
  const { api } = ctx; files = [...files]; if (!files.length || ctx.busy) return;
  ctx.errors = []; ctx.notice = null; let ok = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i]; ctx.busy = `Importing ${i + 1} of ${files.length} · ${f.name}`; render();
    try {
      const est = ctx.usage && ctx.usage.quota ? ctx.usage.quota - ctx.usage.usage : Infinity;
      const meta = await api.media.add(f); ok++;
      if (meta.storeError === 'quota' || (est < f.size && !meta.stored)) { ctx.notice = { kind: 'quota', text: `${f.name} is open in this session but could not be saved.` }; }
      else if (meta.stored === false) ctx.errors.push(`${f.name} could not be saved: this browser refused the write.`);
    } catch (e) { ctx.errors.push(e.message || String(e)); }
  }
  ctx.busy = ''; announce(`${ok} file${ok === 1 ? '' : 's'} imported${ctx.errors.length ? `, ${ctx.errors.length} failed` : ''}`);
  await refresh(true);
  if (ctx.items.length && ok) { const last = ctx.items.find(x => x.used === Math.max(...ctx.items.map(y => y.used))); if (last) ctx.sel = last.id; render(); }
}

function useOnLayer(it) {
  const { api } = ctx, project = api.project, l = project.layers.find(x => x.id === project.active), st = l && getStyle(l.styleId);
  const q = st && (st.inputs || []).find(x => x.type === 'media' || x.type === it.kind);
  if (!q) { api.toast('The active layer’s style has no media input. Pick a style marked MEDIA in the library.'); announce('The active layer has no media input'); return; }
  const next = api.clone(project), nl = next.layers.find(x => x.id === next.active), prev = nl.media && nl.media[q.id];
  nl.media = { ...(nl.media || {}), [q.id]: { asset: it.id, name: it.name, kind: it.kind, w: it.w, h: it.h, dur: it.dur ? Math.round(it.dur * 1000) / 1000 : 0, fit: prev ? prev.fit : q.fit, timing: prev ? prev.timing : 'loop' } };
  api.commit(next, `${it.kind === 'video' ? 'Video' : 'Image'} attached · ${it.name}`); announce(`${it.name} attached to the active layer`);
}

async function removeItem(it) {
  const { api } = ctx; const items = ctx.items, i = items.findIndex(x => x.id === it.id);
  api.media.forget(it.id); await api.media.pool.remove(it.id);
  ctx.confirm = null; await refresh(true);
  const nxt = ctx.items[Math.min(i, ctx.items.length - 1)]; ctx.sel = nxt ? nxt.id : null; render();
  const el = nxt && ctx.host.querySelector(`[data-id="${nxt.id}"]`); if (el) el.focus(); else { const b = ctx.host.querySelector('[data-act="import"]'); if (b) b.focus(); }
  announce(`${it.name} removed`);
}

async function relink(oldId, file) {
  const { api } = ctx, project = api.project; let ref = null;
  for (const l of project.layers) for (const v of Object.values(l.media || {})) if (v && v.asset === oldId) ref = v;
  if (!ref) return;
  ctx.busy = `Relinking ${file.name}`; render();
  try {
    if (api.media.kindOf(file) !== ref.kind) throw new Error(`${ref.name || 'That slot'} needs ${ref.kind === 'video' ? 'a video' : 'an image'}.`);
    const meta = await api.media.add(file), next = api.clone(project);
    for (const l of next.layers) for (const [k, v] of Object.entries(l.media || {})) if (v && v.asset === oldId) l.media[k] = { ...meta, fit: v.fit, timing: v.timing };
    api.commit(next, `Relinked · ${meta.name}`); announce(`${meta.name} relinked`);
  } catch (e) { ctx.errors = [e.message || String(e)]; }
  ctx.busy = ''; await refresh(true);
}

// The file input lives outside the page DOM: the panel re-renders on project changes, which would orphan an input
// that is open in the browser's file dialog and silently drop the selection.
function pick(multiple, done) {
  const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*,video/*'; f.multiple = multiple;
  f.onchange = () => { if (f.files && f.files.length) done([...f.files]); };
  f.click();
}

function bind(host) {
  host.addEventListener('click', async e => {
    const rl = e.target.closest('[data-relink]'); if (rl) { const id = rl.dataset.relink; pick(false, fs => relink(id, fs[0])); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act, it = ctx.items.find(x => x.id === ctx.sel);
      if (a === 'import') pick(true, fs => importFiles(fs));
      else if (a === 'persist') { const ok = await ctx.api.media.pool.persist(); announce(ok ? 'Storage marked persistent' : 'The browser declined persistent storage'); await refresh(true); }
      else if (a === 'dismiss') { ctx.errors = []; render(); }
      else if (a === 'use' && it) useOnLayer(it);
      else if (a === 'delete' && it) { ctx.confirm = it.id; render(); const c = host.querySelector('[data-act="cancel"]'); if (c) c.focus(); }
      else if (a === 'cancel') { ctx.confirm = null; render(); const o = host.querySelector(`[data-id="${ctx.sel}"]`); if (o) o.focus(); }
      else if (a === 'remove' && it) removeItem(it);
      else if (a === 'free') {
        const used = new Set(usedMap(ctx.api.project).keys()), need = ctx.usage ? Math.max(ctx.usage.poolBytes * 0.5, 1) : 1;
        const r = await ctx.api.media.pool.evict(need, [...used]); r.removed.forEach(id => ctx.api.media.forget(id)); ctx.notice = null;
        announce(`Freed ${fmtBytes(r.freed)}`); await refresh(true);
      }
      return;
    }
    const opt = e.target.closest('.mp-item'); if (opt) { ctx.sel = opt.dataset.id; ctx.confirm = null; render(); const o = host.querySelector(`[data-id="${ctx.sel}"]`); if (o) o.focus(); }
  });
  host.addEventListener('dblclick', e => { const opt = e.target.closest('.mp-item'); const it = opt && ctx.items.find(x => x.id === opt.dataset.id); if (it) useOnLayer(it); });
  host.addEventListener('keydown', e => {
    const opt = e.target.closest && e.target.closest('.mp-item'); if (!opt) return;
    const rows = [...host.querySelectorAll('.mp-item')], i = rows.indexOf(opt); let to = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') to = Math.min(rows.length - 1, i + 1); else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') to = Math.max(0, i - 1);
    else if (e.key === 'Home') to = 0; else if (e.key === 'End') to = rows.length - 1;
    if (to >= 0) { e.preventDefault(); ctx.sel = rows[to].dataset.id; ctx.confirm = null; render(); host.querySelector(`[data-id="${ctx.sel}"]`).focus(); return; }
    const it = ctx.items.find(x => x.id === opt.dataset.id); if (!it) return;
    if (e.key === 'Enter') { e.preventDefault(); ctx.sel = it.id; useOnLayer(it); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); ctx.sel = it.id; ctx.confirm = it.id; render(); const c = host.querySelector('[data-act="cancel"]'); if (c) c.focus(); }
    else if (e.key === ' ') { e.preventDefault(); ctx.sel = it.id; ctx.confirm = null; render(); host.querySelector(`[data-id="${ctx.sel}"]`).focus(); }
  });
  const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
  host.addEventListener('dragover', e => { if (!hasFiles(e)) return; e.preventDefault(); if (!ctx.dragging) { ctx.dragging = true; host.querySelector('.mp-body').classList.add('over'); } });
  host.addEventListener('dragleave', e => { if (e.target === host || !host.contains(e.relatedTarget)) { ctx.dragging = false; const b = host.querySelector('.mp-body'); if (b) b.classList.remove('over'); } });
  host.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); ctx.dragging = false; importFiles(e.dataTransfer.files); });
}

__m_shell.use({
  id: 'media', name: 'Media', icon: ICON,
  panel(host, api) {
    if (!document.getElementById('mp-css')) { const s = document.createElement('style'); s.id = 'mp-css'; s.textContent = CSS; document.head.appendChild(s); }
    ctx.host = host; ctx.api = api;
    if (!ctx.bound) { ctx.bound = true; bind(host); }
    render(); refresh(false);
  },
});
})();
