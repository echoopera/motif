// ---- module: deliver-page v1.0.0
const __m_deliver_page = (() => {
// deliver page — an inspector page (via the shell seam) for the render queue: presets, add to queue, live queue with progress / ETA / fps,
// completed outputs with download, and the codec capability matrix. All text goes through textContent; the DOM is built once and updated by key
// so keyboard focus survives progress updates.
const RQ = __m_render_queue;
const { ASPECTS } = __m_tokens;
const { exportSize } = __m_renderer;

const ICON = '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/><path d="m10 8 4 2-4 2z"/></svg>';
const CSS = `
.dl{display:flex;flex-direction:column;padding-bottom:var(--space-6)}
.dl-sec{padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2);border-bottom:var(--hairline) solid var(--gap)}
.dl-sec-head{display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);min-height:var(--target-sm)}
.dl-sec-head h2{margin:0;font:600 var(--text-xs)/16px var(--font-ui);letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)}
.dl-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:var(--space-2)}
.dl-card,.dl-job,.dl-out,.dl-editor{border:var(--hairline) solid var(--line-strong);border-radius:var(--radius-m);background:var(--surface-0);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-1)}
.dl-job[data-status="running"]{border-color:var(--accent-line)}
.dl-job[data-status="error"]{border-color:var(--danger)}
.dl-job[data-status="interrupted"]{border-color:var(--accent-line);background:var(--accent-soft)}
.dl-job:focus-visible,.dl-out:focus-visible{outline:var(--focus-w) solid var(--focus);outline-offset:2px}
.dl-top{display:flex;align-items:baseline;justify-content:space-between;gap:var(--space-2);min-width:0}
.dl-top b{font:600 var(--text-md)/20px var(--font-ui);color:var(--text-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.dl-sub{margin:0;font:400 var(--text-xs)/16px var(--font-ui);color:var(--text-muted)}
.dl-meta{margin:0;font:400 var(--text-xs)/16px var(--font-mono);color:var(--text-muted);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.dl-warn{margin:0;font:400 var(--text-xs)/16px var(--font-ui);color:#F2C078;border-left:2px solid var(--accent);padding-left:var(--space-2)}
.dl-warn[data-level="block"]{color:var(--danger);border-left-color:var(--danger)}
.dl-warn[data-level="info"]{color:var(--text-muted);border-left-color:var(--line-hover)}
.dl-err{margin:0;font:400 var(--text-xs)/16px var(--font-ui);color:var(--danger)}
.dl-chip{flex:none;font:600 var(--text-xs)/16px var(--font-mono);letter-spacing:.04em;text-transform:uppercase;border:var(--hairline) solid var(--line-strong);border-radius:var(--radius-s);padding:0 var(--space-1);color:var(--text-muted)}
.dl-chip[data-s="running"]{color:var(--accent);border-color:var(--accent-line)}
.dl-chip[data-s="done"]{color:var(--ok);border-color:#2E5E48}
.dl-chip[data-s="error"]{color:var(--danger);border-color:var(--danger)}
.dl-chip[data-s="interrupted"]{color:#F2C078;border-color:var(--accent-line)}
.dl .btnrow{margin-top:var(--space-1)}
.dl progress{height:8px;margin:var(--space-1) 0}
.dl-banner{margin:0;padding:var(--space-2) var(--space-3);font:400 var(--text-xs)/16px var(--font-ui);color:var(--text);background:var(--accent-soft);border-bottom:var(--hairline) solid var(--accent-line);display:flex;align-items:center;justify-content:space-between;gap:var(--space-2)}
.dl-banner[data-kind="error"]{background:#F0625A1F;border-color:var(--danger)}
.dl-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--space-1);padding:var(--space-5) var(--space-3);border:var(--hairline) dashed var(--line-strong);border-radius:var(--radius-m);color:var(--text-muted);font:400 var(--text-xs)/16px var(--font-ui)}
.dl-empty b{font:600 var(--text-md)/20px var(--font-ui);color:var(--text)}
.dl-skel{height:64px;border-radius:var(--radius-m);background:var(--surface-2)}
@media (prefers-reduced-motion:no-preference){.dl-skel{animation:dl-pulse 1.2s ease-in-out infinite}@keyframes dl-pulse{50%{opacity:.5}}}
.dl-editor{border-color:var(--accent-line);gap:var(--space-2)}
.dl-editor .grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-2)}
.dl-editor input[type=text],.dl-editor input[type=number]{background:var(--surface-0);border:var(--hairline) solid var(--line-strong);border-radius:var(--radius-s);padding:0 var(--space-2);min-height:var(--target);font:400 var(--text-sm)/16px var(--font-ui);color:var(--text);min-width:0}
.dl-editor .toggles{display:flex;flex-wrap:wrap;gap:var(--space-2) var(--space-4)}
.dl-editor .toggles label{display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-sm)}
.dl-matrix{width:100%;border-collapse:collapse;font:400 var(--text-xs)/16px var(--font-mono);color:var(--text-muted)}
.dl-matrix th,.dl-matrix td{padding:var(--space-1) var(--space-1);text-align:center;border-bottom:var(--hairline) solid var(--line)}
.dl-matrix th:first-child,.dl-matrix td:first-child{text-align:left;color:var(--text)}
.dl-matrix td[data-v="hw"]{color:var(--ok)}
.dl-matrix td[data-v="no"]{color:var(--text-dim)}
.tabs{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}
`;

const h = (tag, props, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
const MB = b => (b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor(s / 60) % 60} min` : s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`; };
const STATUS = { queued: 'Queued', running: 'Rendering', done: 'Done', error: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted' };
const tierName = t => (t === 2160 ? '4K' : t + 'p');

const S = { built: false, api: null, snap: null, caps: null, matrix: null, matrixKey: '', editing: null, seen: new Map(), raf: 0, dirty: false, el: {}, notify: '' };
const Q = RQ.getQueue();
const codecLabel = id => (id && __m_exporter.CODECS[id] ? __m_exporter.CODECS[id].label : '');

// Keyed sync: reuses existing children so focus and scroll survive updates.
function syncList(ul, items, keyOf, create, update) {
  const have = new Map([...ul.children].map(li => [li.dataset.key, li]));
  const want = new Set(items.map(keyOf));
  for (const [k, li] of have) if (!want.has(k)) { if (li.contains(document.activeElement)) S.refocus = ul; li.remove(); }
  let prev = null;
  for (const it of items) {
    const k = keyOf(it); let li = have.get(k);
    if (!li) { li = create(it); li.dataset.key = k; }
    update(li, it);
    const at = prev ? prev.nextSibling : ul.firstChild; if (at !== li) ul.insertBefore(li, at); prev = li;
  }
}

// ---------- capability checks ----------
function settingsFor(preset) { return RQ.resolveSettings(preset, S.api.project, S.api.aspect); }
function checks(preset) {
  const out = [], caps = S.caps; if (!caps) return out;
  const s = settingsFor(preset), { w, h: ht } = exportSize(s.aspect, s.tier);
  if (s.format === 'png-seq') { if (!caps.zip) out.push({ level: 'block', text: 'The ZIP library is unavailable in this build.' }); return out; }
  if (!caps.webcodecs) return [{ level: 'block', text: 'This browser has no WebCodecs video encoder. Use PNG sequence, or Chrome, Edge or Safari 16.4+.' }];
  if (!caps.muxers) return [{ level: 'block', text: 'The MP4 / WebM writers did not load.' }];
  const label = codecLabel(s.codec);
  if (!caps.codecs[s.codec]) out.push({ level: 'block', text: `${label} is not available in this browser. Pick another codec in Edit.` });
  else if (S.matrix) {
    const row = S.matrix.rows.find(r => r.codec === s.codec && r.tier === s.tier);
    if (row && !row.supported) out.push({ level: 'block', text: `${label} can’t encode ${w} × ${ht} here. Try a smaller size.` });
    else if (row && !row.hardware) out.push({ level: 'info', text: `${label} will use a software encoder, so renders are slower.` });
  }
  if (s.transparent && s.format === 'webm' && (!caps.webmAlpha || !(__m_exporter.CODECS[s.codec] || {}).alpha)) out.push({ level: 'warn', text: 'Transparent video isn’t available here, so the background will be kept.' });
  const bytes = RQ.estimateBytes(s, S.api.project); if (bytes > 1e9) out.push({ level: 'warn', text: `About ${MB(bytes)}: the file is assembled in memory, so very large renders can fail.` });
  return out;
}
function gpuWarn() { try { const g = S.api.gpuStatus(); return g && g.ok && g.software ? 'WebGL is running on the CPU (software rendering): expect seconds per frame. Enable hardware acceleration and reload.' : (g && !g.ok ? 'WebGL2 is unavailable, so kit styles can’t render.' : ''); } catch (e) { return ''; } }

// ---------- presets ----------
function presetMeta(p) {
  const s = settingsFor(p), { w, h: ht } = exportSize(s.aspect, s.tier), frames = RQ.framesOf(S.api.project, s), bytes = RQ.estimateBytes(s, S.api.project);
  const kind = s.format === 'png-seq' ? 'PNG ZIP' : codecLabel(s.codec) + ' ' + s.format.toUpperCase();
  return `${kind} · ${w} × ${ht} · ${s.fps} fps · ${(frames / s.fps).toFixed(1)} s${bytes ? ' · about ' + MB(bytes) : ''}`;
}
function createCard(p) {
  const el = h('li', { class: 'dl-card' });
  el.append(h('div', { class: 'dl-top' }, h('b', { 'data-f': 'name' }), h('span', { class: 'dl-chip', 'data-f': 'chip', hidden: true })), h('p', { class: 'dl-sub', 'data-f': 'note' }), h('p', { class: 'dl-meta', 'data-f': 'meta' }), h('div', { 'data-f': 'warns' }),
    h('div', { class: 'btnrow' }, h('button', { class: 'btn primary sm', 'data-act': 'add', type: 'button' }, 'Add to queue'), h('button', { class: 'btn sm', 'data-act': 'edit', type: 'button' }, 'Edit')));
  return el;
}
function updateCard(el, p) {
  const f = k => el.querySelector(`[data-f="${k}"]`); el.dataset.id = p.id;
  f('name').textContent = p.name; f('note').textContent = p.note; f('meta').textContent = presetMeta(p);
  f('chip').hidden = !(p.edited); f('chip').textContent = 'edited';
  const ws = checks(p), box = f('warns'); box.replaceChildren(...ws.map((w, i) => h('p', { class: 'dl-warn', 'data-level': w.level, id: `dl-w-${p.id}-${i}` }, w.text)));
  const add = el.querySelector('[data-act="add"]'), blocked = ws.some(w => w.level === 'block'); add.disabled = blocked || !S.api.project; if (blocked) add.setAttribute('aria-describedby', `dl-w-${p.id}-0`); else add.removeAttribute('aria-describedby');
  add.setAttribute('aria-label', `Add ${p.name} to the queue`); el.querySelector('[data-act="edit"]').setAttribute('aria-label', `Edit ${p.name}`);
  el.querySelector('[data-act="edit"]').setAttribute('aria-expanded', String(S.editing && S.editing.id === p.id));
}
function renderPresets() { syncList(S.el.presets, RQ.listPresets(), p => p.id, createCard, updateCard); }

// ---------- preset editor ----------
function openEditor(p) { S.editing = p ? { ...p } : { id: '', name: 'My preset', note: '', format: 'mp4', codec: 'avc', tier: 1080, fps: 0, aspect: '', quality: 'high', bitrateMbps: 0, transparent: false, withAudio: true, loops: 1 }; S.editorOpener = document.activeElement; renderEditor(); const first = S.el.editor.querySelector('input'); first && first.focus(); renderPresets(); }
function closeEditor(restore = true) { S.editing = null; renderEditor(); renderPresets(); if (restore && S.editorOpener && S.editorOpener.isConnected) S.editorOpener.focus(); S.editorOpener = null; }
function codecChoices(format) { return format === 'mp4' ? ['avc', 'hevc', 'av1', 'vp9'] : format === 'webm' ? ['vp9', 'av1', 'vp8'] : []; }
function renderEditor() {
  const box = S.el.editor, p = S.editing; box.replaceChildren(); box.hidden = !p; if (!p) return;
  const id = k => 'dl-ed-' + k;
  const sel = (k, label, opts, value, dis) => { const s = h('select', { id: id(k), disabled: !!dis }, opts.map(([v, l]) => h('option', { value: String(v) }, l))); s.value = String(value); s.addEventListener('change', () => { p[k] = s.value; if (k === 'format') { const c = codecChoices(p.format); if (!c.includes(p.codec)) p.codec = c[0] || ''; if (p.format === 'png-seq') p.withAudio = false; renderEditor(); const f = box.querySelector('#' + id('format')); f && f.focus(); } }); return h('label', { class: 'field', for: id(k) }, h('span', { class: 'lbl' }, label), s); };
  const num = (k, label, min, max) => { const i = h('input', { id: id(k), type: 'number', min, max, step: 1, value: p[k] }); i.addEventListener('input', () => { p[k] = i.value; }); return h('label', { class: 'field', for: id(k) }, h('span', { class: 'lbl' }, label), i); };
  const chk = (k, label, dis) => { const i = h('input', { id: id(k), type: 'checkbox', class: 'switch', role: 'switch', checked: !!p[k], disabled: !!dis }); i.addEventListener('change', () => { p[k] = i.checked; }); return h('label', {}, h('span', {}, label), i); };
  const name = h('input', { id: id('name'), type: 'text', maxlength: 48, value: p.name, 'aria-required': 'true' }); name.addEventListener('input', () => { p.name = name.value; });
  const video = p.format !== 'png-seq';
  const cur = RQ.listPresets().find(x => x.id === p.id);
  box.append(
    h('div', { class: 'lbl', role: 'heading', 'aria-level': '3' }, p.id ? 'Edit preset' : 'New preset'),
    h('label', { class: 'field', for: id('name') }, h('span', { class: 'lbl' }, 'Name'), name),
    h('div', { class: 'grid2' },
      sel('format', 'Format', [['mp4', 'MP4'], ['webm', 'WebM'], ['png-seq', 'PNG sequence']], p.format),
      sel('codec', 'Codec', codecChoices(p.format).map(c => [c, codecLabel(c)]).concat(video ? [] : [['', 'PNG']]), p.codec, !video),
      sel('tier', 'Size', __m_exporter.TIERS.map(t => [t, tierName(t)]), p.tier),
      sel('fps', 'Frame rate', [[0, 'Project']].concat(__m_exporter.FPS.map(f => [f, f + ' fps'])), p.fps),
      sel('aspect', 'Aspect', [['', 'Current']].concat(ASPECTS.map(a => [a.id, a.label])), p.aspect),
      sel('quality', 'Quality', [['standard', 'Standard'], ['high', 'High'], ['max', 'Maximum']], p.quality, !video),
      num('bitrateMbps', 'Bitrate, Mbit/s (0 = auto)', 0, 500), sel('loops', 'Loops', [1, 2, 3, 4, 8].map(n => [n, String(n)]), p.loops)),
    h('div', { class: 'toggles' }, chk('transparent', 'Transparent background', p.format === 'mp4'), chk('withAudio', 'Include audio', !video)),
    h('div', { class: 'btnrow' },
      h('button', { class: 'btn primary sm', type: 'button', 'data-act': 'save-preset' }, 'Save preset'),
      h('button', { class: 'btn sm', type: 'button', 'data-act': 'cancel-edit' }, 'Cancel'),
      cur && !cur.builtin ? h('button', { class: 'btn sm', type: 'button', 'data-act': 'delete-preset' }, 'Delete') : null,
      cur && cur.builtin && cur.edited ? h('button', { class: 'btn sm', type: 'button', 'data-act': 'reset-preset' }, 'Reset to default') : null,
      cur ? h('button', { class: 'btn sm', type: 'button', 'data-act': 'copy-preset' }, 'Save as new') : null));
}

// ---------- queue + outputs ----------
function jobSummary(j) { const s = j.settings, { w, h: ht } = exportSize(s.aspect, s.tier); return `${j.presetName} · ${s.format === 'png-seq' ? 'PNG' : codecLabel(s.codec)} · ${w} × ${ht} · ${s.fps} fps · ${j.frames} frame${j.frames > 1 ? 's' : ''}`; }
function createJob() {
  return h('li', { class: 'dl-job', tabindex: '-1' },
    h('div', { class: 'dl-top' }, h('b', { 'data-f': 'name' }), h('span', { class: 'dl-chip', 'data-f': 'chip' })), h('p', { class: 'dl-sub', 'data-f': 'sub' }),
    h('progress', { max: 1, value: 0, 'data-f': 'bar' }), h('p', { class: 'dl-meta', 'data-f': 'line' }), h('p', { class: 'dl-err', 'data-f': 'err', role: 'alert' }),
    h('div', { class: 'btnrow' }, h('button', { class: 'btn sm', type: 'button', 'data-act': 'cancel' }, 'Cancel'), h('button', { class: 'btn sm', type: 'button', 'data-act': 'retry' }, 'Retry'), h('button', { class: 'btn sm', type: 'button', 'data-act': 'remove' }, 'Remove'), h('button', { class: 'btn sm', type: 'button', 'data-act': 'up', 'aria-label': 'Move earlier' }, '↑'), h('button', { class: 'btn sm', type: 'button', 'data-act': 'down', 'aria-label': 'Move later' }, '↓')));
}
function updateJob(el, j) {
  const f = k => el.querySelector(`[data-f="${k}"]`), snap = S.snap, isRun = snap.running && snap.running.id === j.id, paused = isRun && snap.paused;
  el.dataset.id = j.id; el.dataset.status = j.status; f('name').textContent = j.name; f('sub').textContent = jobSummary(j);
  const chip = f('chip'); chip.dataset.s = j.status; chip.textContent = paused ? 'Paused' : STATUS[j.status] || j.status;
  const bar = f('bar'); bar.hidden = !isRun; bar.value = j.progress || 0; bar.setAttribute('aria-label', `${j.name} progress`); bar.setAttribute('aria-valuetext', Math.round((j.progress || 0) * 100) + ' percent');
  let line = '';
  if (isRun) line = paused ? `Paused at ${Math.round(j.progress * 100)}%` : `${Math.round(j.progress * 100)}%${j.liveFps ? ` · ${j.liveFps} frames/s` : ''}${j.etaMs ? ` · about ${clock(j.etaMs)} left` : ''}`;
  else if (j.status === 'queued') { const e = Q.estimate(j); line = e ? `Waiting · about ${clock(e)} to render` : 'Waiting for its turn · estimate after the first render'; }
  else if (j.status === 'interrupted') line = j.message;
  else if (j.status === 'cancelled') line = 'Cancelled before it finished.';
  f('line').textContent = line; f('line').hidden = !line;
  const err = f('err'); err.textContent = j.status === 'error' ? j.error : ''; err.hidden = j.status !== 'error';
  const show = (a, on) => { const b = el.querySelector(`[data-act="${a}"]`); if (b.hidden === on) { if (!on && b.contains(document.activeElement)) el.focus(); } b.hidden = !on; };
  show('cancel', ['queued', 'running', 'interrupted'].includes(j.status)); show('retry', ['error', 'interrupted', 'cancelled'].includes(j.status)); show('remove', !isRun);
  show('up', j.status === 'queued'); show('down', j.status === 'queued');
  for (const b of el.querySelectorAll('[data-act]')) b.setAttribute('aria-label', b.dataset.act === 'up' ? `Move ${j.name} earlier` : b.dataset.act === 'down' ? `Move ${j.name} later` : `${b.textContent} ${j.name}`);
}
function createOut() {
  return h('li', { class: 'dl-out', tabindex: '-1' }, h('div', { class: 'dl-top' }, h('b', { 'data-f': 'name' }), h('span', { class: 'dl-chip', 'data-f': 'size', 'data-s': 'done' })), h('p', { class: 'dl-meta', 'data-f': 'spec' }), h('p', { class: 'dl-meta', 'data-f': 'stat' }), h('p', { class: 'dl-sub', 'data-f': 'note' }),
    h('div', { class: 'btnrow' }, h('button', { class: 'btn primary sm', type: 'button', 'data-act': 'download' }, 'Download'), h('button', { class: 'btn sm', type: 'button', 'data-act': 'remove' }, 'Remove')));
}
function updateOut(el, j) {
  const o = j.output, f = k => el.querySelector(`[data-f="${k}"]`); el.dataset.id = j.id;
  f('name').textContent = o.filename; f('size').textContent = MB(o.size);
  f('spec').textContent = `${o.codec} · ${o.container} · ${o.width} × ${o.height} · ${o.fps} fps · ${o.durationSec.toFixed(2)} s`;
  const st = o.stats; f('stat').textContent = `Rendered in ${clock(o.renderMs)} · ${o.renderFps} frames/s${st ? ` · ${st.framePath === 'canvas' ? 'direct canvas frames' : 'I420 frames'}${st.hardwareRequested ? ' · hardware preferred' : ' · software'}` : ''}${o.audioCodec ? ' · ' + o.audioCodec + ' audio' : ''}`;
  f('note').textContent = [o.note, o.colorTag ? 'Colour tag ' + o.colorTag + '.' : ''].filter(Boolean).join(' '); f('note').hidden = !f('note').textContent;
  el.querySelector('[data-act="download"]').setAttribute('aria-label', `Download ${o.filename}`); el.querySelector('[data-act="remove"]').setAttribute('aria-label', `Remove ${o.filename}`);
}

function renderQueue() {
  const snap = S.snap, el = S.el; if (!snap) return;
  el.loading.hidden = snap.ready; el.body.hidden = !snap.ready; if (!snap.ready) return;
  const active = snap.jobs.filter(j => j.status !== 'done'), done = snap.jobs.filter(j => j.status === 'done');
  syncList(el.jobs, active, j => j.id, createJob, updateJob); syncList(el.outs, done.slice().reverse(), j => j.id, createOut, updateOut);
  el.jobsEmpty.hidden = active.length > 0; el.outsEmpty.hidden = done.length > 0;
  const nRun = snap.running ? 1 : 0, nWait = snap.jobs.filter(j => j.status === 'queued').length;
  el.state.textContent = snap.running ? (snap.paused ? `Paused · ${nWait} waiting` : `Rendering · ${nWait} waiting`) : snap.paused ? `Paused · ${nWait} waiting` : nWait ? 'Starting…' : 'Idle';
  el.pause.hidden = !(nRun || nWait); el.pause.textContent = snap.paused ? 'Resume' : 'Pause'; el.pause.setAttribute('aria-pressed', String(snap.paused));
  el.clear.disabled = !snap.jobs.some(j => ['done', 'cancelled'].includes(j.status));
  // banners: storage, paused after reload, interrupted
  const msgs = [];
  if (!snap.persistent) msgs.push({ kind: 'error', text: 'This browser blocked storage for the queue. Jobs and files will be lost if you reload.' });
  if (snap.pauseReason === 'reload' && snap.paused) msgs.push({ kind: 'info', text: 'The queue was paused after a reload so nothing starts unexpectedly.', act: 'resume', label: 'Resume queue' });
  const ni = snap.jobs.filter(j => j.status === 'interrupted').length; if (ni) msgs.push({ kind: 'info', text: `${ni} render${ni > 1 ? 's were' : ' was'} interrupted by a reload. They start again from the first frame.`, act: 'retry-all', label: 'Retry all' });
  const gw = snap.jobs.some(j => j.status === 'queued' || j.status === 'running') ? gpuWarn() : ''; if (gw) msgs.push({ kind: 'info', text: gw });
  el.banners.replaceChildren(...msgs.map(m => h('p', { class: 'dl-banner', 'data-kind': m.kind, role: m.kind === 'error' ? 'alert' : 'status' }, h('span', {}, m.text), m.act ? h('button', { class: 'btn sm', type: 'button', 'data-act': m.act }, m.label) : null)));
  // announce transitions once
  for (const j of snap.jobs) { const was = S.seen.get(j.id); if (was && was !== j.status && (j.status === 'done' || j.status === 'error' || j.status === 'interrupted')) el.live.textContent = j.status === 'done' ? `${j.name} finished rendering.` : j.status === 'error' ? `${j.name} failed: ${j.error}` : `${j.name} was interrupted.`; S.seen.set(j.id, j.status); }
  if (S.refocus) { const t = S.refocus.querySelector('button:not([hidden])') || S.el.root; if (!document.activeElement || document.activeElement === document.body) t.focus(); S.refocus = null; }
  el.notify.hidden = !(typeof Notification !== 'undefined') || Notification.permission !== 'default';
}
const schedule = () => { if (S.raf) return; S.raf = requestAnimationFrame(() => { S.raf = 0; try { renderQueue(); } catch (e) { console.error(e); } }); };

// ---------- capability matrix ----------
async function loadMatrix() {
  const key = S.api.aspect + '@' + S.api.project.output.fps; if (S.matrixKey === key && S.matrix) return;
  if (!S.matrix) S.el.matrixBox.replaceChildren(h('p', { class: 'dl-sub', role: 'status' }, 'Checking which encoders this browser offers…'));
  try { const [caps, m] = await Promise.all([S.api.X.probeCapabilities(), S.api.X.capabilityMatrix(S.api.aspect, S.api.project.output.fps)]); S.caps = caps; S.matrix = m; S.matrixKey = key; S.el.root.dataset.caps = '1'; renderMatrix(); renderPresets(); renderQueue(); }
  catch (e) { S.el.matrixBox.replaceChildren(h('p', { class: 'dl-err', role: 'alert' }, 'Couldn’t read the encoder capabilities: ' + (e && e.message || e))); }
}
function renderMatrix() {
  const m = S.matrix, caps = S.caps; if (!m) return;
  if (!caps.webcodecs) { S.el.matrixBox.replaceChildren(h('p', { class: 'dl-warn', 'data-level': 'block' }, 'This browser has no WebCodecs video encoder, so MP4 and WebM export is unavailable. PNG sequence still works.')); return; }
  const cell = (r) => { if (!r || !r.supported) return h('td', { 'data-v': 'no', 'aria-label': 'not supported' }, '—'); return h('td', { 'data-v': r.hardware ? 'hw' : 'sw', 'aria-label': r.hardware ? 'hardware encoder accepted' : 'software encoder only' }, r.hardware ? 'HW' : 'SW'); };
  const t = h('table', { class: 'dl-matrix' }, h('caption', { class: 'dl-sub', style: 'text-align:left;padding-bottom:4px' }, `Aspect ${S.api.aspect.replace('x', ':')} · ${m.fps} fps`),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Codec'), __m_exporter.TIERS.map(t => h('th', { scope: 'col' }, tierName(t))), h('th', { scope: 'col' }, 'Alpha'))),
    h('tbody', {}, m.codecs.map(c => { const rows = __m_exporter.TIERS.map(t => m.rows.find(r => r.codec === c.id && r.tier === t)); const a = rows.find(r => r && r.tier === 1080); return h('tr', {}, h('th', { scope: 'row' }, c.label + ' · ' + c.containers.join('/').toUpperCase()), rows.map(cell), h('td', { 'data-v': a && a.alpha ? 'hw' : 'no', 'aria-label': a && a.alpha ? 'alpha supported' : 'alpha not supported' }, a && a.alpha ? 'Yes' : '—')); })));
  S.el.matrixBox.replaceChildren(t, h('p', { class: 'dl-sub' }, 'HW: the browser accepted a hardware encoder. SW: software encoder only. —: not supported. The browser doesn’t say which encoder actually runs, so HW means “preferred hardware was accepted”. Alpha is checked at 1080p.'));
}

// ---------- downloads ----------
async function save(blob, filename) {
  const dl = await (S.api.downloads ? S.api.downloads() : null);
  if (dl) { try { await dl.save({ filename, data: blob }); S.api.toast('Saved ' + filename); return; } catch (e) { const c = e && e.code; if (c === 'declined') { S.api.toast('Save cancelled'); return; } /* otherwise fall through to a normal download */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); S.api.toast('Saved ' + filename);
}

// ---------- actions ----------
async function onClick(e) {
  const b = e.target.closest('button[data-act]'); if (!b || b.disabled) return; const act = b.dataset.act, row = b.closest('[data-id]'), id = row && row.dataset.id;
  const api = S.api;
  if (act === 'add') { const p = RQ.listPresets().find(x => x.id === id); try { await Q.add(api.clone(api.project), p, { aspect: api.aspect, hasAudio: api.hasAudio }); api.toast(`Added ${p.name} to the queue`); } catch (er) { api.toast(er && er.message || 'Could not add to the queue'); } }
  else if (act === 'edit') { if (S.editing && S.editing.id === id) closeEditor(); else openEditor(RQ.listPresets().find(x => x.id === id)); }
  else if (act === 'new-preset') openEditor(null);
  else if (act === 'cancel-edit') closeEditor();
  else if (act === 'save-preset') { const p = S.editing; if (!String(p.name || '').trim()) { S.el.editor.querySelector('input').focus(); return; } RQ.savePreset({ ...p, name: String(p.name).trim() }); closeEditor(); api.toast('Preset saved'); }
  else if (act === 'copy-preset') { const p = { ...S.editing, id: '', name: S.editing.name + ' copy' }; RQ.savePreset(p); closeEditor(); api.toast('Saved as a new preset'); }
  else if (act === 'delete-preset' || act === 'reset-preset') { RQ.deletePreset(S.editing.id); closeEditor(false); renderPresets(); api.toast(act === 'delete-preset' ? 'Preset deleted' : 'Preset reset'); }
  else if (act === 'cancel') Q.cancel(id); else if (act === 'retry') Q.retry(id); else if (act === 'remove') Q.remove(id);
  else if (act === 'up') Q.move(id, -1); else if (act === 'down') Q.move(id, 1);
  else if (act === 'download') { const j = S.snap.jobs.find(x => x.id === id), blob = await Q.output(id); if (!blob) { api.toast('That file is no longer stored. Render it again.'); return; } save(blob, j.output.filename); }
  else if (act === 'resume') Q.resume();
  else if (act === 'retry-all') S.snap.jobs.filter(j => j.status === 'interrupted').forEach(j => Q.retry(j.id));
  else if (act === 'pause') { Q.paused ? Q.resume() : Q.pause(); }
  else if (act === 'clear') Q.clearFinished();
  else if (act === 'notify') { const r = await Q.requestNotifications(); S.el.live.textContent = r === 'granted' ? 'Notifications on. You will be told when a render finishes while this tab is in the background.' : 'Notifications are off.'; schedule(); }
}

// ---------- build ----------
function build(host, api) {
  S.built = true; S.api = api;
  if (!document.getElementById('deliver-css')) { const st = document.createElement('style'); st.id = 'deliver-css'; st.textContent = CSS; document.head.appendChild(st); }
  const e = S.el; e.root = h('div', { class: 'dl', tabindex: '-1' });
  e.live = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite', style: 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap' });
  e.banners = h('div', {});
  e.presets = h('ul', { class: 'dl-list', 'aria-label': 'Presets' }); e.editor = h('div', { class: 'dl-editor', hidden: true, role: 'group', 'aria-label': 'Preset editor' });
  e.state = h('span', { class: 'readout', role: 'status' }, 'Opening…');
  e.pause = h('button', { class: 'btn sm', type: 'button', 'data-act': 'pause', 'aria-pressed': 'false', hidden: true }, 'Pause');
  e.clear = h('button', { class: 'btn sm ghost', type: 'button', 'data-act': 'clear', disabled: true }, 'Clear finished');
  e.notify = h('button', { class: 'btn sm ghost', type: 'button', 'data-act': 'notify', hidden: true, title: 'Ask the browser for permission to notify you when a render finishes' }, 'Notify me');
  e.loading = h('div', { class: 'dl-sec', 'aria-busy': 'true' }, h('p', { class: 'dl-sub', role: 'status' }, 'Opening the render queue…'), h('div', { class: 'dl-skel' }), h('div', { class: 'dl-skel' }));
  e.jobs = h('ul', { class: 'dl-list', 'aria-label': 'Queue' }); e.outs = h('ul', { class: 'dl-list', 'aria-label': 'Completed renders' });
  e.jobsEmpty = h('div', { class: 'dl-empty' }, h('b', {}, 'Nothing waiting'), h('span', {}, 'Choose a preset above and press Add to queue. Renders run one at a time in the background and survive a reload.'));
  e.outsEmpty = h('div', { class: 'dl-empty' }, h('b', {}, 'No finished renders yet'), h('span', {}, 'Completed files appear here, ready to download.'));
  e.body = h('div', { hidden: true },
    h('section', { class: 'dl-sec', 'aria-labelledby': 'dl-h-queue' }, h('div', { class: 'dl-sec-head' }, h('h2', { id: 'dl-h-queue' }, 'Queue'), h('span', { style: 'display:flex;gap:8px;align-items:center' }, e.state, e.pause)), e.jobs, e.jobsEmpty, h('div', { class: 'btnrow' }, e.notify)),
    h('section', { class: 'dl-sec', 'aria-labelledby': 'dl-h-out' }, h('div', { class: 'dl-sec-head' }, h('h2', { id: 'dl-h-out' }, 'Completed'), e.clear), e.outs, e.outsEmpty));
  e.matrixBox = h('div', {}, h('p', { class: 'dl-sub' }, 'Open to check encoders.'));
  const det = h('details', { class: 'group dl-sec', style: 'padding:0' }, h('summary', {}, h('span', { class: 'lbl' }, 'Encoder capabilities')), h('div', { style: 'padding:12px;display:flex;flex-direction:column;gap:8px' }, e.matrixBox));
  det.addEventListener('toggle', () => { if (det.open) loadMatrix(); });
  e.root.append(
    h('div', { class: 'panel-head' }, h('div', { class: 'lbl' }, 'Render queue'), h('h1', {}, 'Deliver'), h('p', {}, 'Pick a preset, queue as many renders as you like, and keep working.')),
    e.live, e.banners,
    h('section', { class: 'dl-sec', 'aria-labelledby': 'dl-h-pre' }, h('div', { class: 'dl-sec-head' }, h('h2', { id: 'dl-h-pre' }, 'Presets'), h('button', { class: 'btn sm', type: 'button', 'data-act': 'new-preset' }, 'New preset')), e.presets, e.editor),
    e.loading, e.body, det);
  host.replaceChildren(e.root);
  host.addEventListener('click', onClick);
  host.addEventListener('keydown', ev => { if (ev.key === 'Escape' && S.editing && host.contains(document.activeElement)) { ev.preventDefault(); ev.stopPropagation(); closeEditor(); } });
  Q.subscribe(snap => { S.snap = snap; schedule(); });
  Q.init().then(() => { S.snap = Q.snapshot(); schedule(); });
}

function panel(host, api) {
  S.api = api;
  if (!S.built) build(host, api);
  renderPresets(); loadMatrix().catch(() => {});
  if (!S.snap) S.snap = Q.snapshot(); renderQueue();
}

__m_shell.use({ id: 'deliver', name: 'Deliver', icon: ICON, panel });
return { panel };

})();
