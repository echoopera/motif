// ---- module: graph-page v1.1.0
const __m_graph_page = (() => {
// graph-page — the MotifGraph page in the inspector: a stack for the active layer or for the whole composite. Built on the shell's own
// parts (rows with scrub labels, keys and audio mapping; groups; commit/undo; the command palette; the hover-audition overlay), so it
// reads and behaves like the rest of Motif: audition, don't commit · modes and faults are loud · palette-first · keyboard complete.
// UI only: the engine is __m_graph, rendering is the compositor's. Design record: design-harness/design/motifgraph-ui-pass/.
const MG = __m_graph, { mutate, mulberry32 } = __m_engine_core;
const ICON = '<svg class="i" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 17.5h7M17.5 14v7"/></svg>';
const PREFS = 'motif9-graph-ui';
const st = { scope: 'layer', menu: '', open: new Set(), fault: '', focus: '' };
let api = null, host = null, audTimer = 0, auditing = false, seeded = '';
try { const p = JSON.parse(localStorage.getItem(PREFS) || 'null'); if (p && (p.scope === 'layer' || p.scope === 'composite')) st.scope = p.scope; } catch (e) { /* per-viewer convenience only */ }
const savePrefs = () => { try { localStorage.setItem(PREFS, JSON.stringify({ scope: st.scope })); } catch (e) { /* per-viewer convenience only */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const proj = () => api.project;
const layerOf = pr => pr.layers.find(l => l.id === pr.active) || pr.layers[0];
const scopeId = () => (st.scope === 'composite' ? MG.COMPOSITE : layerOf(proj()).id);
const holderOf = pr => (st.scope === 'composite' ? pr : layerOf(pr));
const graph = (pr = proj()) => holderOf(pr).graph || null;
const FAMILY_ORDER = ['stage', 'cloner', 'field', 'effector', 'deformer'];
const nodeSel = id => `[data-node="${id}"] > summary`;
function edit(fn, msg) {
  auditionOff();
  const next = api.clone(proj()), h = holderOf(next); if (!h.graph) h.graph = MG.newGraph(scopeId());
  const r = fn(h.graph, next, h); api.commit(next, msg); return r;
}
function insertSorted(g, node) {
  const rank = n => FAMILY_ORDER.indexOf(MG.kindOf(n.type)); let at = g.nodes.length;
  for (let i = g.nodes.length - 1; i >= 0; i--) { if (rank(g.nodes[i]) <= rank(node)) { at = i + 1; break; } if (i === 0) at = 0; }
  g.nodes.splice(at, 0, node);
}
// What adding a node would do, as data: used by the real add and by the audition preview.
function withNode(pr, type) {
  const h = holderOf(pr); if (!h.graph) h.graph = MG.newGraph(scopeId()); const g = h.graph;
  if (g.nodes.length >= MG.MAX_NODES) return { err: `A graph holds up to ${MG.MAX_NODES} nodes` };
  if (MG.kindOf(type) === 'cloner' && g.nodes.some(n => MG.kindOf(n.type) === 'cloner')) return { err: 'A graph holds one Cloner; change its layout instead' };
  const n = MG.newNode(type, g.nodes.map(x => x.id)); g.on = true; insertSorted(g, n); return { id: n.id };
}
function addNode(type) {
  const probe = withNode(api.clone(proj()), type); if (probe.err) { api.toast(probe.err); return null; }
  let id = null; edit((gr, next) => { const r = withNode(next, type); id = r.id; }, `Added ${MG.TYPES[type].name}`);
  st.open = new Set([id]); st.focus = nodeSel(id); return id;
}
function removeNode(id) {
  auditionOff();
  const next = api.clone(proj()), g = holderOf(next).graph; if (!g) return;
  const i = g.nodes.findIndex(n => n.id === id); g.nodes = g.nodes.filter(n => n.id !== id); for (const n of g.nodes) if (n.ref === id) n.ref = '';
  for (const k of Object.keys(next.keys)) if (k.startsWith(`M:${scopeId()}:${id}:`)) delete next.keys[k];
  if (next.audio) next.audio.maps = next.audio.maps.filter(m => !m.path.startsWith(`M:${scopeId()}:${id}:`));
  st.open.delete(id); const nb = g.nodes[Math.min(i, g.nodes.length - 1)]; st.focus = nb && nb.type !== 'stage' ? nodeSel(nb.id) : '[data-mg=menu][data-id=add]';
  api.commit(next, 'Node removed');
}
function toggleNode(id) { edit(g => { const n = MG.nodeById(g, id); if (n) n.on = !n.on; }, 'Node toggled'); st.focus = nodeSel(id); }
function moveNode(id, d) {
  edit(g => {
    const i = g.nodes.findIndex(n => n.id === id), kind = MG.kindOf(g.nodes[i].type); let j = i + d;
    while (j >= 0 && j < g.nodes.length && MG.kindOf(g.nodes[j].type) !== kind && MG.kindOf(g.nodes[j].type) !== 'stage') j += d;
    if (j < 1 || j >= g.nodes.length || MG.kindOf(g.nodes[j].type) !== kind) return;
    const [n] = g.nodes.splice(i, 1); g.nodes.splice(j, 0, n);
  }, d < 0 ? 'Node moved earlier' : 'Node moved later'); st.focus = nodeSel(id);
}
function resetNode(id) {
  auditionOff();
  const next = api.clone(proj()), g = holderOf(next).graph, n = MG.nodeById(g, id); if (!n) return;
  n.params = MG.typeDefaults(n.type);
  for (const k of Object.keys(next.keys)) if (k.startsWith(`M:${scopeId()}:${id}:`)) delete next.keys[k];
  api.commit(next, `${MG.TYPES[n.type].name} reset`); st.focus = nodeSel(id);
}
function duplicateNode(id) {
  const g = graph(), n = MG.nodeById(g, id); if (!n || MG.kindOf(n.type) === 'cloner' || MG.kindOf(n.type) === 'stage') return;
  if (g.nodes.length >= MG.MAX_NODES) { api.toast(`A graph holds up to ${MG.MAX_NODES} nodes`); return; }
  let nid = null; edit(gr => { const c = JSON.parse(JSON.stringify(n)); c.id = MG.newNode(n.type, gr.nodes.map(x => x.id)).id; nid = c.id; gr.nodes.splice(gr.nodes.findIndex(x => x.id === id) + 1, 0, c); }, 'Node duplicated');
  st.open = new Set([nid]); st.focus = nodeSel(nid);
}
function setRef(id, ref) { edit(g => { const n = MG.nodeById(g, id); if (n) { n.ref = ref; } const s = MG.sanitizeGraph(g, scopeId()); g.nodes = s.nodes; }, 'Field changed'); }
function setPlace(v) { edit(g => { g.place = v === 'post' ? 'post' : 'pre'; }, v === 'post' ? 'Graph after finishing' : 'Graph before finishing'); }
function setOn(on) { edit(g => { g.on = !!on; }, on ? 'MotifGraph on' : 'MotifGraph bypassed'); }
function clearGraph() {
  auditionOff();
  const next = api.clone(proj()), h = holderOf(next); if (!h.graph) return; delete h.graph;
  for (const k of Object.keys(next.keys)) if (k.startsWith(`M:${scopeId()}:`)) delete next.keys[k];
  if (next.audio) next.audio.maps = next.audio.maps.filter(m => !m.path.startsWith(`M:${scopeId()}:`));
  st.open = new Set(); api.commit(next, 'MotifGraph cleared');
}
// Vary: nudge every unlocked, un-keyed value of the stack (and new seeds), the way Mutate does for a style. Undo restores.
function vary() {
  const g = graph(); if (!g || !MG.active(g)) { api.toast('Add a node to vary'); return; }
  auditionOff();
  const next = api.clone(proj()), h = holderOf(next), rng = mulberry32((Date.now() ^ 0x5bd1e995) >>> 0); let changed = 0;
  for (const n of h.graph.nodes) {
    if (n.unknown || !MG.TYPES[n.type]) continue;
    const pre = `M:${scopeId()}:${n.id}:`, lk = new Set(); for (const k of Object.keys(next.keys)) if (k.startsWith(pre)) lk.add(k.slice(pre.length));
    const r = mutate(n.params, MG.schemaFor(n.type), 0.35, lk, rng); n.params = r.values; changed += r.changed.length;
  }
  api.commit(next, changed ? `Varied ${changed} graph values · keyed values kept` : 'Everything is keyed');
}
function presetProject(pr, id) {
  const g = MG.applyPreset(id, scopeId()); if (!g) return null;
  const h = holderOf(pr), old = h.graph;
  if (old) { g.place = old.place; for (const k of Object.keys(pr.keys)) if (k.startsWith(`M:${scopeId()}:`)) delete pr.keys[k]; if (pr.audio) pr.audio.maps = pr.audio.maps.filter(m => !m.path.startsWith(`M:${scopeId()}:`)); }
  h.graph = g; return pr;
}
function usePreset(id) {
  const p = MG.PRESETS.find(x => x.id === id); if (!p) return;
  auditionOff(); const next = presetProject(api.clone(proj()), id); if (!next) return;
  const first = graph(next).nodes.find(n => n.type !== 'stage'); st.open = new Set(first ? [first.id] : []);
  api.commit(next, `Preset · ${p.name}`);
}

// ---------- audition: preview on the stage without touching the project (the shell's overlay; never enters undo) ----------
function auditionOff() { clearTimeout(audTimer); if (auditing) { auditing = false; api.audition(null); } }
function previewOf(it) {
  const act = it.dataset.mg, next = api.clone(proj());
  if (act === 'preset') { const p = MG.PRESETS.find(x => x.id === it.dataset.id); return p && presetProject(next, p.id) ? { project: next, label: `Preset · ${p.name}` } : null; }
  if (act === 'add') { const r = withNode(next, it.dataset.type); return r.err ? null : { project: next, label: `Add · ${MG.TYPES[it.dataset.type].name}` }; }
  return null;
}
function auditionItem(it, now) {
  if (!api || !api.auditionOn()) return; clearTimeout(audTimer);
  const run = () => { const p = previewOf(it); if (p) { auditing = true; api.audition(p.project, p.label, 'Enter or click to apply · Esc to leave'); } };
  if (now) run(); else audTimer = setTimeout(run, 260);
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
// The values the user sees (keyed values at the playhead), so conditional rows and read-outs follow what is on screen.
function shownParams(n) { const out = { ...n.params }; for (const k of Object.keys(n.params)) { const p = `M:${scopeId()}:${n.id}:${k}`; if (proj().keys[p]) out[k] = api.shownValue(p); } return out; }
const rowsFor = (n) => {
  const sc = MG.schemaFor(n.type), base = `M:${scopeId()}:${n.id}:`, kind = MG.kindOf(n.type);
  const keys = (KEY_ORDER[kind] ? KEY_ORDER[kind](shownParams(n)) : Object.keys(sc)).filter(k => sc[k]);
  return keys.map(k => api.rowHtml(base + k)).join('');
};
const refSelect = (n, g) => {
  const fields = g.nodes.filter(x => MG.kindOf(x.type) === 'field' && x.id !== n.id), kind = MG.kindOf(n.type);
  const label = kind === 'field' ? 'Combine with' : kind === 'effector' ? 'Weighted by field' : 'Fall off with field';
  if (!fields.length && !n.ref) return `<div class="row mgref"><label>${label}</label><span></span><span></span><span class="mg-none">add a field to use one</span></div>`;
  return `<div class="row mgref"><label for="mgref-${n.id}">${label}</label><span></span><span></span><select id="mgref-${n.id}" data-mgref="${n.id}">${[`<option value="">None</option>`, ...fields.map(f => `<option value="${f.id}"${f.id === n.ref ? ' selected' : ''}>${esc(MG.nodeLabel(g, f))}</option>`)].join('')}</select></div>`;
};
// One line that says what the node is doing, shown when it is folded.
const optL = (kind, key, v) => { const o = MG.KINDS[kind].layout[key].options.find(x => x.v === v); return o ? o.l : v; };
function readout(n, g) {
  const p = shownParams(n), kind = MG.kindOf(n.type), f = x => (Math.round(x * 100) / 100).toString();
  if (kind === 'stage') return `${p.camera === 'persp' ? 'Perspective' : 'Flat'} · detail ${p.detail}${p.mix < 1 ? ` · mix ${f(p.mix)}` : ''}`;
  if (kind === 'cloner') return `${optL('cloner', 'mode', p.mode)} ${p.mode === 'grid' || p.mode === 'honeycomb' ? `${p.cols}×${p.rows}` : p.count} · ${optL('cloner', 'content', p.content).toLowerCase()}`;
  if (kind === 'field') { const r = MG.nodeById(g, n.ref); return `${p.motion && p.motion !== 'none' ? optL('field', 'motion', p.motion).toLowerCase() : 'still'}${r ? ` · with ${MG.nodeLabel(g, r)}` : ''}`; }
  if (kind === 'effector') { const ch = [['posX', 'x'], ['posY', 'y'], ['posZ', 'z'], ['rotX', 'rot x'], ['rotY', 'rot y'], ['rotZ', 'rot'], ['scale', 'scale'], ['scaleX', 'scale x'], ['scaleY', 'scale y'], ['opacity', 'fade'], ['tint', 'colour']].filter(([k]) => Math.abs(p[k]) > 0.001).map(([, l]) => l).slice(0, 3); const r = MG.nodeById(g, n.ref); return `${ch.join(', ') || 'no channel'}${r ? ` · by ${MG.nodeLabel(g, r)}` : ''}`; }
  if (kind === 'deformer') { const r = MG.nodeById(g, n.ref); return `${p.space === 'object' ? 'each clone' : 'whole array'} · ${f(p.strength)}${r ? ` · by ${MG.nodeLabel(g, r)}` : ''}`; }
  return '';
}
const BTN = (act, id, label, svg, extra = '') => `<button type="button" class="ib mg-b" data-mg="${act}" data-id="${id}" aria-label="${label}" title="${label}"${extra}>${svg}</button>`;
const I = {
  up: '<svg class="i" viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg>', down: '<svg class="i" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
  dup: '<svg class="i" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/></svg>', del: '<svg class="i" viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  rst: '<svg class="i" viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 1 2.5 5.8"/><path d="M4 18v-5h5"/></svg>', eye: '<svg class="i" viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
};
function nodeHtml(n, g) {
  if (n.unknown || !MG.TYPES[n.type]) return `<details class="group mg-node" data-off="true"><summary><span class="lbl"><b class="mg-tag">?</b> ${esc(n.type || 'Unknown')} <small class="mg-read">from a newer Motif; kept, not drawn</small></span></summary></details>`;
  const T = MG.TYPES[n.type], kind = T.kind;
  const locked = kind === 'stage', open = st.open.has(n.id) ? ' open' : '';
  const head = `<span class="mg-acts">${BTN('on', n.id, n.on ? 'Disable' : 'Enable', I.eye, ` aria-pressed="${!!n.on}"`)}${locked ? '' : BTN('up', n.id, 'Move up', I.up) + BTN('down', n.id, 'Move down', I.down)}${BTN('rst', n.id, 'Reset to defaults', I.rst)}${kind === 'cloner' || locked ? '' : BTN('dup', n.id, 'Duplicate', I.dup)}${locked ? '' : BTN('del', n.id, 'Remove', I.del)}</span>`;
  const ref = kind === 'field' || kind === 'effector' || kind === 'deformer' ? refSelect(n, g) : '';
  return `<details class="group mg-node" data-node="${n.id}" data-kind="${kind}" data-off="${!n.on}"${open}><summary aria-keyshortcuts="Delete Alt+ArrowUp Alt+ArrowDown Alt+D Alt+E"><span class="lbl"><b class="mg-tag">${T.short}</b><span class="mg-name">${esc(MG.nodeLabel(g, n))}</span><small class="mg-read">${esc(readout(n, g))}</small></span>${head}</summary><div class="rows">${T.hint ? `<p class="info mg-hint">${esc(T.hint)}</p>` : ''}${rowsFor(n)}${ref}</div></details>`;
}
function mapHtml(g) {
  if (!g || g.nodes.length < 2) return '';
  return `<ol class="mg-map" aria-label="Stack order: cloner, fields, effectors, deformers">${g.nodes.filter(n => !n.unknown).map(n => `<li><button type="button" class="mg-chip" data-mg="goto" data-id="${n.id}" data-kind="${MG.kindOf(n.type)}" data-off="${!n.on}" aria-label="${esc(MG.nodeLabel(g, n))}, ${n.on ? 'on' : 'off'}" title="${esc(MG.nodeLabel(g, n))}">${MG.TYPES[n.type].short}</button></li>`).join('')}</ol>`;
}
const MENU = () => {
  const sec = (title, types) => `<li class="mg-h" role="presentation">${title}</li>${types.map(t => `<li role="menuitem" tabindex="0" data-mg="add" data-type="${t}"><b>${MG.TYPES[t].name}</b><small>${esc(MG.TYPES[t].hint)}</small></li>`).join('')}`;
  const by = k => MG.TYPE_IDS.filter(t => MG.TYPES[t].kind === k);
  return sec('Cloner', by('cloner')) + sec('Effectors', by('effector')) + sec('Fields', by('field')) + sec('Deformers', by('deformer'));
};
const PMENU = () => MG.PRESETS.map(p => `<li role="menuitem" tabindex="0" data-mg="preset" data-id="${p.id}"><b>${esc(p.name)}</b><small>${esc(p.blurb)}</small></li>`).join('');
function costHtml(g) {
  if (!g || !MG.active({ ...g, on: true })) return '';
  const e = MG.estimate(MG.evalCopy(g)), f = n => n.toLocaleString('en-US');
  return `<p class="mg-cost" role="status"><b>${f(e.instances)}</b> ${e.instances === 1 ? 'mesh' : 'clones'} · <b>${f(e.vertices)}</b> vertices · ${e.effectors} effector${e.effectors === 1 ? '' : 's'} · ${e.deformers} deformer${e.deformers === 1 ? '' : 's'}${e.capped ? ' · <span class="mg-warn">mesh detail lowered to stay in budget</span>' : ''}</p>`;
}
function webgl2Ok() { if (webgl2Ok.v === undefined) { try { webgl2Ok.v = !!document.createElement('canvas').getContext('webgl2'); } catch (e) { webgl2Ok.v = false; } } return webgl2Ok.v; }
function faultOf(a) { const gs = a && a.stage && a.stage.info && a.stage.info.graph; return gs && gs.failed ? (gs.error || 'GPU error') : ''; }

function render() {
  if (!host) return;
  const g = graph(), comp = st.scope === 'composite', l = layerOf(proj()), on = !g || g.on !== false, active = !!(g && MG.active({ ...g, on: true })); // active: has real nodes, whether or not it is bypassed
  // first visit to this graph: open its first real node, fold the rest
  if (g && seeded !== scopeId() && !st.open.size) { const f = g.nodes.find(n => n.type !== 'stage'); if (f) st.open = new Set([f.id]); } seeded = scopeId();
  const seg = `<div class="seg" role="radiogroup" aria-label="MotifGraph applies to">${[['layer', 'Layer'], ['composite', 'Composite']].map(([v, t]) => `<button type="button" role="radio" aria-checked="${st.scope === v}" data-mg="scope" data-id="${v}">${t}</button>`).join('')}</div>`;
  const where = comp ? `<div class="row"><label for="mgplace">Runs</label><span></span><span></span><select id="mgplace" data-mgplace><option value="pre"${g && g.place === 'post' ? '' : ' selected'}>Before the finishing stack</option><option value="post"${g && g.place === 'post' ? ' selected' : ''}>After the finishing stack</option></select></div>` : '';
  const sub = comp ? 'The whole frame: every layer composited, then deformed and cloned.' : `Layer ${proj().layers.indexOf(l) + 1} · ${esc(__m_style_library.getStyle(l.styleId).name)}. The layer is deformed before its mask and blend.`;
  const body = g && g.nodes.length ? g.nodes.map(n => nodeHtml(n, g)).join('') : '';
  const empty = !active ? `<div class="mg-empty"><p>${g && g.nodes.length > 0 ? 'Add a Cloner, Deformer or Effector to start.' : 'Clone, bend, ripple and drive this ' + (comp ? 'whole frame' : 'layer') + ' in real time. Hover a preset to see it on the stage.'}</p><div class="btnrow"><button type="button" class="btn sm" data-mg="menu" data-id="presets">Presets…</button><button type="button" class="btn sm" data-mg="menu" data-id="add">Add node…</button></div></div>` : '';
  const alerts = [
    !webgl2Ok() ? '<p class="mg-alert" role="alert"><b>WebGL2 is unavailable here.</b> MotifGraph needs it; the picture passes through unchanged.</p>' : '',
    st.fault && webgl2Ok() && active && on ? `<p class="mg-alert" role="alert"><b>MotifGraph is paused: ${esc(st.fault)}.</b> The picture passes through unchanged and the graph resumes by itself when the GPU does.</p>` : '',
    g && active && !on ? '<p class="mg-mode" role="status"><b>Bypassed.</b> The picture is untouched. Turn On to bring the graph back.</p>' : '',
  ].join('');
  const toolbar = `<div class="mg-tools"><button type="button" class="btn sm" data-mg="menu" data-id="add" aria-haspopup="menu" aria-expanded="${st.menu === 'add'}">+ Add node</button><button type="button" class="btn sm" data-mg="menu" data-id="presets" aria-haspopup="menu" aria-expanded="${st.menu === 'presets'}">Presets</button>${active ? '<button type="button" class="btn sm" data-mg="vary" title="Nudge every unkeyed value">Vary</button>' : ''}${g ? '<button type="button" class="btn sm" data-mg="clear">Clear</button>' : ''}
      ${st.menu ? `<ul class="mg-menu" role="menu" id="mgMenu" aria-label="${st.menu === 'add' ? 'Add node' : 'Presets'}">${st.menu === 'add' ? MENU() : PMENU()}</ul>` : ''}</div>`;
  host.innerHTML = `<div class="mg">
    <div class="mg-bar">${seg}<span class="mg-sw"><label for="mgOn">On</label><input type="checkbox" class="switch" role="switch" id="mgOn" data-mgon${on ? ' checked' : ''}></span></div>
    <p class="info mg-sub">${sub}</p>${where}${alerts}${toolbar}
    ${costHtml(g)}${empty}${mapHtml(g)}<div class="mg-stack" data-bypass="${!on}" role="group" aria-label="Graph stack">${body}</div>
    ${active ? '<p class="info mg-keys"><kbd>Delete</kbd> remove · <kbd>Alt</kbd>+<kbd>↑↓</kbd> reorder · <kbd>Alt</kbd>+<kbd>E</kbd> on/off · <kbd>Alt</kbd>+<kbd>D</kbd> duplicate, on a focused node</p>' : ''}</div>`;
  const m = host.querySelector('#mgMenu'); if (m && st.menuFocus) { const f = m.querySelector('[role=menuitem]'); if (f) f.focus({ preventScroll: true }); st.menuFocus = false; }
  if (st.focus) { const el = host.querySelector(st.focus); if (el) el.focus({ preventScroll: false }); st.focus = ''; }
}

// ---------- events ----------
function onClick(e) {
  const b = e.target.closest('[data-mg]'); if (!b) { if (st.menu && !e.target.closest('#mgMenu')) { st.menu = ''; auditionOff(); render(); } return; }
  const act = b.dataset.mg, id = b.dataset.id;
  if (act === 'scope') { st.scope = id; savePrefs(); st.menu = ''; auditionOff(); render(); return; }
  if (act === 'menu') { st.menu = st.menu === id ? '' : id; st.menuFocus = true; auditionOff(); render(); return; }
  if (act === 'add') { st.menu = ''; auditionOff(); const nid = addNode(b.dataset.type); render(); if (nid) { const el = host.querySelector(`[data-node="${nid}"]`); if (el) el.scrollIntoView({ block: 'nearest' }); } return; }
  if (act === 'preset') { st.menu = ''; usePreset(id); render(); const t = host.querySelector('[data-mg=menu][data-id=presets]'); if (t) t.focus(); return; }
  if (act === 'clear') { clearGraph(); render(); return; }
  if (act === 'vary') { vary(); render(); return; }
  if (act === 'goto') { st.open = new Set([id]); st.focus = nodeSel(id); render(); return; }
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
  if (e.key === 'Escape' && st.menu) { st.menu = ''; auditionOff(); render(); const b = host.querySelector('[data-mg=menu]'); if (b) b.focus(); return; }
  const it = e.target.closest && e.target.closest('[role=menuitem]');
  if (it) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); it.click(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const all = [...host.querySelectorAll('#mgMenu [role=menuitem]')], i = all.indexOf(it); all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length].focus(); }
    return;
  }
  // On a focused node header: Delete removes, Alt+Up/Down reorders, Alt+E toggles, Alt+D duplicates.
  const sm = e.target.matches && e.target.matches('.mg-node > summary') ? e.target : null; if (!sm) return;
  const id = sm.parentElement.dataset.node, kind = sm.parentElement.dataset.kind; if (!id) return;
  const lockedKey = kind === 'stage' && !(e.altKey && (e.key === 'e' || e.key === 'E')); if (lockedKey) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && !e.altKey) { e.preventDefault(); removeNode(id); render(); }
  else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveNode(id, e.key === 'ArrowUp' ? -1 : 1); render(); }
  else if (e.altKey && (e.key === 'e' || e.key === 'E')) { e.preventDefault(); toggleNode(id); render(); }
  else if (e.altKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicateNode(id); render(); }
}
// Audition: dwell on a menu item with the pointer, or arrow to it with the keyboard.
function onOver(e) { const it = e.target.closest && e.target.closest('#mgMenu [role=menuitem]'); if (it) auditionItem(it, false); }
function onFocusIn(e) { const it = e.target.closest && e.target.closest('#mgMenu [role=menuitem]'); if (it) auditionItem(it, true); }
function onLeave(e) { if (e.target && e.target.id === 'mgMenu') auditionOff(); }

const CSS = `
.mg{display:flex;flex-direction:column;gap:var(--space-2);padding-bottom:var(--space-4)}
.mg-bar{display:flex;align-items:center;justify-content:space-between;gap:var(--space-2)}
.mg-bar .seg button{min-width:0;padding:0 var(--space-3)}
.mg-sw{display:inline-flex;align-items:center;gap:var(--space-2);font-size:var(--text-sm);color:var(--text-muted)}
.mg-sub{margin:0}
.mg-tools{display:flex;flex-wrap:wrap;gap:var(--space-2);position:relative}
.mg-menu{position:absolute;z-index:6;top:calc(100% + var(--space-1));left:0;width:min(22rem,100%);max-height:60vh;overflow:auto;margin:0;padding:var(--space-1);list-style:none;background:var(--surface-2);border:var(--hairline) solid var(--line-strong);border-radius:var(--radius-s);box-shadow:0 .5rem 1.5rem var(--scrim)}
.mg-menu li{display:grid;gap:0;padding:var(--space-1) var(--space-2);border-radius:var(--radius-s);cursor:pointer;min-height:var(--target)}
.mg-menu li b{font-weight:600;color:var(--text-strong);font-size:var(--text-sm)}
.mg-menu li small{color:var(--text-muted);font-size:var(--text-xs);line-height:1rem}
.mg-menu li:hover,.mg-menu li:focus{background:var(--surface-3);outline:none}
.mg-menu li:focus-visible{box-shadow:inset 0 0 0 var(--focus-w) var(--focus)}
.mg-menu li.mg-h{cursor:default;min-height:0;padding:var(--space-2) var(--space-2) .125rem;font:600 var(--text-xs)/1rem var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--text-dim)}
.mg-menu li.mg-h:hover{background:none}
.mg-cost{margin:0;font-size:var(--text-xs);line-height:1rem;color:var(--text-muted)}.mg-cost b{color:var(--text);font-weight:500}
.mg-warn{color:var(--danger)}
.mg-empty{display:flex;flex-direction:column;gap:var(--space-2);padding:var(--space-3);border:var(--hairline) dashed var(--line-strong);border-radius:var(--radius-s)}
.mg-empty p{margin:0;font-size:var(--text-sm);line-height:1.25rem;color:var(--text-muted)}
.mg-alert{margin:0;padding:var(--space-2) var(--space-3);border:var(--hairline) solid var(--danger);border-radius:var(--radius-s);font-size:var(--text-sm);line-height:1.25rem}.mg-alert b{color:var(--danger)}
.mg-mode{margin:0;padding:var(--space-2) var(--space-3);border:var(--hairline) solid var(--accent-line);background:var(--accent-soft);border-radius:var(--radius-s);font-size:var(--text-sm);line-height:1.25rem}.mg-mode b{color:var(--accent)}
.mg-map{display:flex;flex-wrap:wrap;gap:var(--space-1);margin:0;list-style:none;position:sticky;top:0;z-index:2;background:var(--surface-1);padding:var(--space-1) 0}
.mg-chip{min-width:var(--target-sm);height:var(--target-sm);padding:0 var(--space-2);border:var(--hairline) solid var(--line);border-radius:var(--radius-s);background:var(--surface-0);color:var(--text-muted);font:600 var(--text-xs)/1rem var(--font-mono);cursor:pointer}
.mg-chip:hover{background:var(--surface-3);color:var(--text-strong)}
.mg-chip:focus-visible{outline:var(--focus-w) solid var(--focus);outline-offset:var(--hairline)}
.mg-chip[data-kind="field"]{color:var(--data)}
.mg-chip[data-off="true"]{text-decoration:line-through;opacity:.5}
.mg-stack{display:flex;flex-direction:column;gap:var(--space-1)}
.mg-stack[data-bypass="true"]{opacity:.5}
.mg-node>summary{display:flex;align-items:center;justify-content:space-between;gap:var(--space-2)}
.mg-node>summary .lbl{display:flex;align-items:baseline;gap:var(--space-1);min-width:0}
.mg-name{white-space:nowrap}
.mg-read{min-width:0;margin-left:var(--space-2);text-transform:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 var(--text-xs)/1rem var(--font-mono);color:var(--text-dim)}
.mg-node[open]>summary .mg-read{display:none}
.mg-node[data-off="true"]>summary .lbl{text-decoration:line-through;opacity:.6}
.mg-node[data-kind="field"] .mg-tag{color:var(--data)}
.mg-tag{display:inline-block;min-width:2.25rem;font:600 var(--text-xs)/1rem var(--font-mono);color:var(--text-dim)}
.mg-acts{display:inline-flex;gap:0;flex:none}
.mg-b{width:var(--ib);height:var(--ib)}
.mg-b[aria-pressed="false"]{opacity:.45}
@media (pointer:coarse){.mg-b,.mg-chip{min-width:var(--target);min-height:var(--target)}}
.mg-hint{margin:0 0 var(--space-1)}
.mg-keys{margin:0}.mg-keys kbd{font:500 var(--text-xs)/1rem var(--font-mono);color:var(--text-muted)}
.mg-none{grid-column:4;font-size:var(--text-xs);color:var(--text-dim)}
.mgref select{grid-column:4}
`;
function ensureCss() { if (typeof document === 'undefined') return; let s = document.getElementById('graph-css'); if (!s) { s = document.createElement('style'); s.id = 'graph-css'; document.head.appendChild(s); } if (s.textContent !== CSS) s.textContent = CSS; }

function init(sec, a) {
  api = a; host = sec; ensureCss();
  sec.addEventListener('click', onClick); sec.addEventListener('change', onChange); sec.addEventListener('keydown', onKey);
  sec.addEventListener('pointerover', onOver); sec.addEventListener('focusin', onFocusIn); sec.addEventListener('pointerleave', onLeave, true);
  sec.addEventListener('toggle', e => { const d = e.target; if (d.classList && d.classList.contains('mg-node') && d.dataset.node) { if (d.open) st.open.add(d.dataset.node); else st.open.delete(d.dataset.node); } }, true);
  setTimeout(() => { if (window.__lab) window.__lab.graph = automation(); }, 0);
}
function panel(sec, a) { api = a; host = sec; ensureCss(); st.fault = faultOf(a); render(); }
// A GPU fault reaches the page through the frame info (also from the render Worker): say so, loudly, and clear it when it ends.
function tick(t, a) { api = a; if (a.tab !== 'graph' || !host) return; const f = faultOf(a); if (f !== st.fault) { st.fault = f; if (!st.menu) render(); } }
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
    render, get auditioning() { return auditing; },
  };
}
if (typeof __m_shell !== 'undefined') __m_shell.use({ id: 'graph', name: 'Graph', icon: ICON, init, panel, tick, commands });
return { st, render, addNode, usePreset, automation };

})();
