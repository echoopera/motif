// ---- module: graph-page v1.0.0
const __m_graph_page = (() => {
// graph-page — the MotifGraph page in the inspector: a stack for the active layer or for the whole composite. Rows are the shell's
// own (scrub labels, keys, audio mapping); every edit goes through the shell's commit(), so undo, save/open, autosave, the render
// cache and the render Worker all see it. UI only: the engine is __m_graph, rendering is the compositor's.
const MG = __m_graph, { clamp, mutate, mulberry32 } = __m_engine_core;
const ICON = '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/></svg>';
const PREFS = 'motif9-graph-ui';
const st = { scope: 'layer', menu: '', closed: {} };
let api = null, host = null;
try { const p = JSON.parse(localStorage.getItem(PREFS) || 'null'); if (p && (p.scope === 'layer' || p.scope === 'composite')) st.scope = p.scope; } catch (e) { /* per-viewer convenience only */ }
const savePrefs = () => { try { localStorage.setItem(PREFS, JSON.stringify({ scope: st.scope })); } catch (e) { /* per-viewer convenience only */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const proj = () => api.project;
const layerOf = pr => pr.layers.find(l => l.id === pr.active) || pr.layers[0];
const scopeId = () => (st.scope === 'composite' ? MG.COMPOSITE : layerOf(proj()).id);
const holderOf = pr => (st.scope === 'composite' ? pr : layerOf(pr));
const graph = (pr = proj()) => holderOf(pr).graph || null;
const nodes = () => (graph() ? graph().nodes : []);
const FAMILY_ORDER = ['stage', 'cloner', 'field', 'effector', 'deformer'];
function edit(fn, msg) {
  const next = api.clone(proj()), h = holderOf(next); if (!h.graph) h.graph = MG.newGraph(scopeId());
  const r = fn(h.graph, next, h); api.commit(next, msg); return r;
}
function insertSorted(g, node) {
  const rank = n => FAMILY_ORDER.indexOf(MG.kindOf(n.type)); let at = g.nodes.length;
  for (let i = g.nodes.length - 1; i >= 0; i--) { if (rank(g.nodes[i]) <= rank(node)) { at = i + 1; break; } if (i === 0) at = 0; }
  g.nodes.splice(at, 0, node);
}
function addNode(type) {
  const kind = MG.kindOf(type), g = graph();
  if (g && g.nodes.length >= MG.MAX_NODES) { api.toast(`A graph holds up to ${MG.MAX_NODES} nodes`); return null; }
  if (kind === 'cloner' && g && g.nodes.some(n => MG.kindOf(n.type) === 'cloner')) { api.toast('A graph holds one Cloner; change its layout instead'); return null; }
  let id = null;
  edit(gr => { const n = MG.newNode(type, gr.nodes.map(x => x.id)); if (!gr.on) gr.on = true; insertSorted(gr, n); id = n.id; st.closed[id] = false; }, `Added ${MG.TYPES[type].name}`);
  return id;
}
function removeNode(id) {
  const next = api.clone(proj()), g = holderOf(next).graph; if (!g) return;
  g.nodes = g.nodes.filter(n => n.id !== id); for (const n of g.nodes) if (n.ref === id) n.ref = '';
  for (const k of Object.keys(next.keys)) if (k.startsWith(`M:${scopeId()}:${id}:`)) delete next.keys[k];
  if (next.audio) next.audio.maps = next.audio.maps.filter(m => !m.path.startsWith(`M:${scopeId()}:${id}:`));
  api.commit(next, 'Node removed');
}
function toggleNode(id) { edit(g => { const n = MG.nodeById(g, id); if (n) n.on = !n.on; }, 'Node toggled'); }
function moveNode(id, d) {
  edit(g => {
    const i = g.nodes.findIndex(n => n.id === id), kind = MG.kindOf(g.nodes[i].type); let j = i + d;
    while (j >= 0 && j < g.nodes.length && MG.kindOf(g.nodes[j].type) !== kind && !(MG.kindOf(g.nodes[j].type) === 'stage')) j += d;
    if (j < 1 || j >= g.nodes.length || MG.kindOf(g.nodes[j].type) !== kind) return;
    const [n] = g.nodes.splice(i, 1); g.nodes.splice(j, 0, n);
  }, d < 0 ? 'Node moved earlier' : 'Node moved later');
}
function resetNode(id) {
  const next = api.clone(proj()), g = holderOf(next).graph, n = MG.nodeById(g, id); if (!n) return;
  n.params = MG.typeDefaults(n.type);
  for (const k of Object.keys(next.keys)) if (k.startsWith(`M:${scopeId()}:${id}:`)) delete next.keys[k];
  api.commit(next, `${MG.TYPES[n.type].name} reset`);
}
function duplicateNode(id) {
  const g = graph(), n = MG.nodeById(g, id); if (!n || MG.kindOf(n.type) === 'cloner' || MG.kindOf(n.type) === 'stage') return;
  if (g.nodes.length >= MG.MAX_NODES) { api.toast(`A graph holds up to ${MG.MAX_NODES} nodes`); return; }
  edit(gr => { const c = JSON.parse(JSON.stringify(n)); c.id = MG.newNode(n.type, gr.nodes.map(x => x.id)).id; gr.nodes.splice(gr.nodes.findIndex(x => x.id === id) + 1, 0, c); }, 'Node duplicated');
}
function setRef(id, ref) { edit(g => { const n = MG.nodeById(g, id); if (n) { n.ref = ref; } const s = MG.sanitizeGraph(g, scopeId()); g.nodes = s.nodes; }, 'Field changed'); }
function setPlace(v) { edit(g => { g.place = v === 'post' ? 'post' : 'pre'; }, v === 'post' ? 'Graph after finishing' : 'Graph before finishing'); }
function setOn(on) { edit(g => { g.on = !!on; }, on ? 'MotifGraph on' : 'MotifGraph bypassed'); }
function clearGraph() {
  const next = api.clone(proj()), h = holderOf(next); if (!h.graph) return; delete h.graph;
  for (const k of Object.keys(next.keys)) if (k.startsWith(`M:${scopeId()}:`)) delete next.keys[k];
  if (next.audio) next.audio.maps = next.audio.maps.filter(m => !m.path.startsWith(`M:${scopeId()}:`));
  api.commit(next, 'MotifGraph cleared');
}
// Vary: nudge every unlocked, un-keyed value of the stack (and new seeds), the way Mutate does for a style. Undo restores.
function vary() {
  const g = graph(); if (!g || !MG.active(g)) { api.toast('Add a node to vary'); return; }
  const next = api.clone(proj()), h = holderOf(next), rng = mulberry32((Date.now() ^ 0x5bd1e995) >>> 0); let changed = 0;
  for (const n of h.graph.nodes) {
    if (n.unknown || !MG.TYPES[n.type]) continue;
    const pre = `M:${scopeId()}:${n.id}:`, lk = new Set(); for (const k of Object.keys(next.keys)) if (k.startsWith(pre)) lk.add(k.slice(pre.length));
    const r = mutate(n.params, MG.schemaFor(n.type), 0.35, lk, rng); n.params = r.values; changed += r.changed.length;
  }
  api.commit(next, changed ? `Varied ${changed} graph values · keyed values kept` : 'Everything is keyed');
}
function usePreset(id) {
  const g = MG.applyPreset(id, scopeId()); if (!g) return;
  const next = api.clone(proj()), h = holderOf(next); const old = h.graph;
  if (old) { g.place = old.place; for (const k of Object.keys(next.keys)) if (k.startsWith(`M:${scopeId()}:`)) delete next.keys[k]; if (next.audio) next.audio.maps = next.audio.maps.filter(m => !m.path.startsWith(`M:${scopeId()}:`)); }
  h.graph = g; api.commit(next, `Preset · ${MG.PRESETS.find(p => p.id === id).name}`);
}

// ---------- rows ----------
const KEY_ORDER = {
  cloner: m => {
    const k = ['mode', 'content'], mode = m.mode, dots = m.content === 'dots';
    if (mode === 'grid' || mode === 'honeycomb') k.push('cols', 'rows', 'fill', 'width', 'height');
    else { k.push('count', 'size'); if (mode === 'linear') k.push('width', 'angle'); else if (mode === 'radial') k.push('width', 'height', 'angle', 'arc', 'align'); else if (mode === 'spiral') k.push('width', 'height', 'angle', 'turns'); else if (mode === 'phyllo') k.push('width', 'height', 'angle', 'align'); else k.push('width', 'height', 'seed'); }
    k.push('posX', 'posY', 'rotate', 'stepRot', 'scale', 'stepScale', 'detail', 'reverse'); if (dots) k.push('shape', 'dotMin', 'dotMax', 'dotInvert'); return k;
  },
  stage: m => ['detail', 'edge', 'camera', ...(m.camera === 'persp' ? ['fov', 'orbitX', 'orbitY', 'panX', 'panY'] : []), 'light', ...(m.light > 0 ? ['lightAngle'] : []), 'depth', 'mix'],
};
const rowsFor = (n, g) => {
  const sc = MG.schemaFor(n.type), base = `M:${scopeId()}:${n.id}:`;
  let keys = KEY_ORDER[MG.kindOf(n.type)] ? KEY_ORDER[MG.kindOf(n.type)](api.T.evaluate ? currentParams(n) : n.params) : Object.keys(sc);
  keys = keys.filter(k => sc[k]);
  return keys.map(k => api.rowHtml(base + k)).join('');
};
// The values the user sees (keyed values at the playhead), so conditional rows follow what is on screen.
function currentParams(n) { const out = { ...n.params }; for (const k of Object.keys(n.params)) { const p = `M:${scopeId()}:${n.id}:${k}`; if (proj().keys[p]) out[k] = api.shownValue(p); } return out; }
const refSelect = (n, g) => {
  const fields = g.nodes.filter(x => MG.kindOf(x.type) === 'field' && x.id !== n.id), kind = MG.kindOf(n.type);
  const label = kind === 'field' ? 'Combine with' : kind === 'effector' ? 'Weighted by field' : 'Fall off with field';
  if (!fields.length && !n.ref) return `<div class="row mgref"><label>${label}</label><span></span><span></span><span class="mg-none">add a field to use one</span></div>`;
  return `<div class="row mgref"><label for="mgref-${n.id}">${label}</label><span></span><span></span><select id="mgref-${n.id}" data-mgref="${n.id}">${[`<option value="">None</option>`, ...fields.map(f => `<option value="${f.id}"${f.id === n.ref ? ' selected' : ''}>${esc(MG.nodeLabel(g, f))}</option>`)].join('')}</select></div>`;
};
const BTN = (act, id, label, svg, extra = '') => `<button type="button" class="ib mg-b" data-mg="${act}" data-id="${id}" aria-label="${label}" title="${label}"${extra}>${svg}</button>`;
const I = {
  up: '<svg class="i" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>', down: '<svg class="i" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  dup: '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/></svg>', del: '<svg class="i" viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  rst: '<svg class="i" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 1 2.5 5.8"/><path d="M4 18v-5h5"/></svg>', eye: '<svg class="i" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
};
function nodeHtml(n, g) {
  const T = MG.TYPES[n.type], kind = T.kind, id = `mg-${scopeId()}-${n.id}`;
  if (n.unknown) return `<details class="group mg-node" data-off="true"><summary><span class="lbl"><b class="mg-tag">?</b> ${esc(n.type || 'Unknown')} <small>from a newer Motif; kept, not drawn</small></span></summary></details>`;
  const locked = kind === 'stage', open = (st.closed[n.id] === undefined ? !locked : !st.closed[n.id]) ? ' open' : '';
  const head = `<span class="mg-acts">${BTN('on', n.id, n.on ? 'Disable' : 'Enable', I.eye, ` aria-pressed="${!!n.on}"`)}${locked ? '' : BTN('up', n.id, 'Move up', I.up) + BTN('down', n.id, 'Move down', I.down)}${BTN('rst', n.id, 'Reset to defaults', I.rst)}${kind === 'cloner' || locked ? '' : BTN('dup', n.id, 'Duplicate', I.dup)}${locked ? '' : BTN('del', n.id, 'Remove', I.del)}</span>`;
  const ref = kind === 'field' || kind === 'effector' || kind === 'deformer' ? refSelect(n, g) : '';
  return `<details class="group mg-node" data-node="${n.id}" data-off="${!n.on}"${open}><summary><span class="lbl"><b class="mg-tag">${T.short}</b> ${esc(MG.nodeLabel(g, n))}</span>${head}</summary><div class="rows">${T.hint ? `<p class="info mg-hint">${esc(T.hint)}</p>` : ''}${rowsFor(n, g)}${ref}</div></details>`;
}
const MENU = () => {
  const sec = (title, types) => `<li class="mg-h" role="presentation">${title}</li>${types.map(t => `<li role="menuitem" tabindex="0" data-mg="add" data-type="${t}"><b>${MG.TYPES[t].name}</b><small>${esc(MG.TYPES[t].hint)}</small></li>`).join('')}`;
  const by = k => MG.TYPE_IDS.filter(t => MG.TYPES[t].kind === k);
  return sec('Cloner', by('cloner')) + sec('Effectors', by('effector')) + sec('Fields', by('field')) + sec('Deformers', by('deformer'));
};
const PMENU = () => MG.PRESETS.map(p => `<li role="menuitem" tabindex="0" data-mg="preset" data-id="${p.id}"><b>${esc(p.name)}</b><small>${esc(p.blurb)}</small></li>`).join('');
function costHtml(g) {
  if (!g || !MG.active(g)) return '';
  const e = MG.estimate(MG.evalCopy(g)), f = n => n.toLocaleString('en-US');
  return `<p class="mg-cost" role="status"><b>${f(e.instances)}</b> ${e.instances === 1 ? 'mesh' : 'clones'} · <b>${f(e.vertices)}</b> vertices · ${e.effectors} effector${e.effectors === 1 ? '' : 's'} · ${e.deformers} deformer${e.deformers === 1 ? '' : 's'}${e.capped ? ' · <span class="mg-warn">mesh detail lowered to stay in budget</span>' : ''}</p>`;
}
function webgl2Ok() { if (webgl2Ok.v === undefined) { try { webgl2Ok.v = !!document.createElement('canvas').getContext('webgl2'); } catch (e) { webgl2Ok.v = false; } } return webgl2Ok.v; }

function render() {
  if (!host) return;
  const g = graph(), comp = st.scope === 'composite', l = layerOf(proj()), on = !g || g.on !== false;
  const seg = `<div class="seg" role="radiogroup" aria-label="MotifGraph applies to">${[['layer', 'Layer'], ['composite', 'Composite']].map(([v, t]) => `<button type="button" role="radio" aria-checked="${st.scope === v}" data-mg="scope" data-id="${v}">${t}</button>`).join('')}</div>`;
  const where = comp ? `<div class="row"><label for="mgplace">Runs</label><span></span><span></span><select id="mgplace" data-mgplace><option value="pre"${g && g.place === 'post' ? '' : ' selected'}>Before the finishing stack</option><option value="post"${g && g.place === 'post' ? ' selected' : ''}>After the finishing stack</option></select></div>` : '';
  const sub = comp ? 'The whole frame: every layer composited, then deformed and cloned.' : `Layer ${proj().layers.indexOf(l) + 1} · ${esc(__m_style_library.getStyle(l.styleId).name)}. The layer is deformed before its mask and blend.`;
  const body = g && g.nodes.length ? g.nodes.map(n => nodeHtml(n, g)).join('') : '';
  const empty = !g || !MG.active(g) ? `<div class="mg-empty"><p>${g && g.nodes.length > 0 ? 'Add a Cloner, Deformer or Effector to start.' : 'Clone, bend, ripple and drive this ' + (comp ? 'whole frame' : 'layer') + ' in real time. Start with a preset, or add a node.'}</p><div class="btnrow"><button type="button" class="btn sm" data-mg="menu" data-id="presets">Presets…</button><button type="button" class="btn sm" data-mg="menu" data-id="add">Add node…</button></div></div>` : '';
  host.innerHTML = `<div class="mg">
    <div class="mg-bar">${seg}<span class="mg-sw"><label for="mgOn">On</label><input type="checkbox" class="switch" role="switch" id="mgOn" data-mgon${on ? ' checked' : ''}></span></div>
    <p class="info mg-sub">${sub}</p>${where}
    ${webgl2Ok() ? '' : '<p class="mg-alert" role="alert"><b>WebGL2 is unavailable here.</b> MotifGraph needs it; the picture passes through unchanged.</p>'}
    <div class="mg-tools"><button type="button" class="btn sm" data-mg="menu" data-id="add" aria-haspopup="menu" aria-expanded="${st.menu === 'add'}">+ Add node</button><button type="button" class="btn sm" data-mg="menu" data-id="presets" aria-haspopup="menu" aria-expanded="${st.menu === 'presets'}">Presets</button>${g && MG.active(g) ? '<button type="button" class="btn sm" data-mg="vary" title="Nudge every unkeyed value">Vary</button>' : ''}${g ? '<button type="button" class="btn sm" data-mg="clear">Clear</button>' : ''}
      ${st.menu ? `<ul class="mg-menu" role="menu" id="mgMenu" aria-label="${st.menu === 'add' ? 'Add node' : 'Presets'}">${st.menu === 'add' ? MENU() : PMENU()}</ul>` : ''}</div>
    ${costHtml(g)}${empty}<div class="mg-stack" data-bypass="${!on}">${body}</div></div>`;
  for (const n of (g ? g.nodes : [])) if (host.querySelector(`[data-node="${n.id}"]`)) { /* openness is the browser's, remembered below */ }
  const m = host.querySelector('#mgMenu'); if (m) { const f = m.querySelector('[role=menuitem]'); if (f && st.menuFocus) { f.focus(); st.menuFocus = false; } }
}

// ---------- events ----------
function onClick(e) {
  const b = e.target.closest('[data-mg]'); if (!b) { if (st.menu && !e.target.closest('#mgMenu')) { st.menu = ''; render(); } return; }
  const act = b.dataset.mg, id = b.dataset.id;
  if (act === 'scope') { st.scope = id; savePrefs(); st.menu = ''; render(); return; }
  if (act === 'menu') { st.menu = st.menu === id ? '' : id; st.menuFocus = true; render(); return; }
  if (act === 'add') { st.menu = ''; const nid = addNode(b.dataset.type); render(); if (nid) { const el = host.querySelector(`[data-node="${nid}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); } return; }
  if (act === 'preset') { st.menu = ''; usePreset(id); render(); return; }
  if (act === 'clear') { clearGraph(); render(); return; }
  if (act === 'vary') { vary(); render(); return; }
  if (act === 'on') { e.preventDefault(); toggleNode(id); render(); return; }
  if (act === 'up' || act === 'down') { e.preventDefault(); moveNode(id, act === 'up' ? -1 : 1); render(); return; }
  if (act === 'del') { e.preventDefault(); removeNode(id); render(); return; }
  if (act === 'dup') { e.preventDefault(); duplicateNode(id); render(); return; }
  if (act === 'rst') { e.preventDefault(); resetNode(id); render(); return; }
}
function onChange(e) {
  const t = e.target;
  if (t.dataset.mgref !== undefined) { setRef(t.dataset.mgref, t.value); render(); return; }
  if (t.dataset.mgplace !== undefined) { setPlace(t.value); render(); return; }
  if (t.dataset.mgon !== undefined) { setOn(t.checked); render(); return; }
  // Selects that change which rows apply (layout, content, camera, light) re-render the stack.
  if (t.dataset.path && /^M:/.test(t.dataset.path) && /:(mode|content|camera|light)$/.test(t.dataset.path)) queueMicrotask(render);
}
function onKey(e) {
  if (e.key === 'Escape' && st.menu) { st.menu = ''; render(); const b = host.querySelector('[data-mg=menu]'); if (b) b.focus(); return; }
  const it = e.target.closest && e.target.closest('[role=menuitem]'); if (!it) return;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); it.click(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const all = [...host.querySelectorAll('#mgMenu [role=menuitem]')], i = all.indexOf(it); all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length].focus(); }
}

const CSS = `
.mg{display:flex;flex-direction:column;gap:var(--space-2);padding-bottom:var(--space-4)}
.mg-bar{display:flex;align-items:center;justify-content:space-between;gap:var(--space-2)}
.mg-bar .seg button{min-width:0;padding:0 var(--space-3)}
.mg-sw{display:inline-flex;align-items:center;gap:var(--space-2);font-size:var(--text-sm);color:var(--text-muted)}
.mg-sub{margin:0}
.mg-tools{display:flex;flex-wrap:wrap;gap:var(--space-2);position:relative}
.mg-menu{position:absolute;z-index:6;top:calc(100% + var(--space-1));left:0;width:min(340px,100%);max-height:60vh;overflow:auto;margin:0;padding:var(--space-1);list-style:none;background:var(--surface-2);border:var(--hairline) solid var(--line-strong);border-radius:var(--radius-s);box-shadow:0 8px 24px var(--scrim)}
.mg-menu li{display:grid;gap:0;padding:var(--space-1) var(--space-2);border-radius:var(--radius-s);cursor:pointer;min-height:var(--target)}
.mg-menu li b{font-weight:600;color:var(--text-strong);font-size:var(--text-sm)}
.mg-menu li small{color:var(--text-muted);font-size:var(--text-xs);line-height:16px}
.mg-menu li:hover,.mg-menu li:focus{background:var(--surface-3);outline:none}
.mg-menu li:focus-visible{box-shadow:inset 0 0 0 var(--focus-w) var(--focus)}
.mg-menu li.mg-h{cursor:default;min-height:0;padding:var(--space-2) var(--space-2) 2px;font:600 var(--text-xs)/16px var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim)}
.mg-menu li.mg-h:hover{background:none}
.mg-cost{margin:0;font-size:var(--text-xs);line-height:16px;color:var(--text-muted)}.mg-cost b{color:var(--text);font-weight:500}
.mg-warn{color:var(--danger)}
.mg-empty{display:flex;flex-direction:column;gap:var(--space-2);padding:var(--space-3);border:var(--hairline) dashed var(--line-strong);border-radius:var(--radius-s)}
.mg-empty p{margin:0;font-size:var(--text-sm);line-height:20px;color:var(--text-muted)}
.mg-alert{margin:0;padding:var(--space-2) var(--space-3);border:var(--hairline) solid var(--danger);border-radius:var(--radius-s);font-size:var(--text-sm)}
.mg-stack{display:flex;flex-direction:column;gap:var(--space-1)}
.mg-stack[data-bypass="true"]{opacity:.5}
.mg-node>summary{display:flex;align-items:center;justify-content:space-between;gap:var(--space-2)}
.mg-node[data-off="true"]>summary .lbl{text-decoration:line-through;opacity:.6}
.mg-tag{display:inline-block;min-width:34px;margin-right:var(--space-1);font:600 var(--text-xs)/16px var(--font-mono);color:var(--text-dim)}
.mg-acts{display:inline-flex;gap:0}
.mg-b{width:var(--ib);height:var(--ib)}
.mg-b[aria-pressed="false"]{opacity:.45}
.mg-hint{margin:0 0 var(--space-1)}
.mg-none{grid-column:4;font-size:var(--text-xs);color:var(--text-dim)}
.mgref select{grid-column:4}
`;
function ensureCss() { if (typeof document === 'undefined' || document.getElementById('graph-css')) return; const s = document.createElement('style'); s.id = 'graph-css'; s.textContent = CSS; document.head.appendChild(s); }

function init(sec, a) {
  api = a; host = sec; ensureCss();
  sec.addEventListener('click', onClick); sec.addEventListener('change', onChange); sec.addEventListener('keydown', onKey);
  sec.addEventListener('toggle', e => { const d = e.target; if (d.classList && d.classList.contains('mg-node') && d.dataset.node) st.closed[d.dataset.node] = !d.open; }, true);
  setTimeout(() => { if (window.__lab) window.__lab.graph = automation(); }, 0);
}
function panel(sec, a) { api = a; host = sec; ensureCss(); render(); }
function commands(a) {
  const go = fn => () => { a.setTab('graph'); fn(); render(); };
  return [
    ...MG.PRESETS.map(p => ({ id: 'graph-preset-' + p.id, label: `MotifGraph: ${p.name} preset`, run: go(() => usePreset(p.id)), kw: 'graph mograph clone deform ' + p.blurb })),
    ...['cloner', 'delay', 'random', 'wave', 'ripple', 'bend', 'twist', 'noised', 'swirl', 'bulge', 'lens'].map(t => ({ id: 'graph-add-' + t, label: `MotifGraph: add ${MG.TYPES[t].name}`, run: go(() => addNode(t)), kw: 'graph mograph ' + MG.TYPES[t].hint })),
    { id: 'graph-vary', label: 'MotifGraph: vary the stack', run: go(vary), kw: 'graph mutate randomize explore' },
    { id: 'graph-scope-layer', label: 'MotifGraph: work on the layer', run: go(() => { st.scope = 'layer'; savePrefs(); }), kw: 'graph scope' },
    { id: 'graph-scope-composite', label: 'MotifGraph: work on the composite', run: go(() => { st.scope = 'composite'; savePrefs(); }), kw: 'graph scope' },
  ];
}
// Test / automation surface (also what an agent drives through the bridge): plain JSON in, plain JSON out.
function automation() {
  return {
    get scope() { return st.scope; }, setScope(s) { st.scope = s === 'composite' ? 'composite' : 'layer'; savePrefs(); render(); },
    add: type => addNode(type), preset: id => usePreset(id), clear: clearGraph, remove: removeNode, vary,
    set(nodeId, key, value) { const p = `M:${scopeId()}:${nodeId}:${key}`; const next = api.T.setBase(proj(), p, value); api.commit(next, 'Graph value set'); },
    setRef, setPlace, setOn,
    describe() { const g = graph(); return g ? { scope: st.scope, on: g.on !== false, place: g.place, nodes: g.nodes.map(n => ({ id: n.id, type: n.type, on: n.on, ref: n.ref || '', params: { ...n.params } })), cost: MG.active(g) ? MG.estimate(MG.evalCopy(g)) : null } : null; },
    render,
  };
}
if (typeof __m_shell !== 'undefined') __m_shell.use({ id: 'graph', name: 'Graph', icon: ICON, init, panel, commands });
return { st, render, addNode, usePreset, automation };

})();
