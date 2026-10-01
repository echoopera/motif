// ---- module: colour-page v1.0.0
const __m_colour_page = (() => {
// colour-page — the Grade page (DaVinci-style colour page in the inspector): GPU scopes strip, node graph editor
// (keyboard-complete), colour wheels / curves / hue curves / qualifier / LUT / mixer inspectors built from the
// shell's own rows (scrub labels, keys, locks), A/B bypass, and a LUT slot with .cube / .3dl / HALD import and
// .cube export. UI only: every change goes through the shell's commit()/live(); rendering is the finisher's.
const G = __m_grade, S = __m_scopes;
const { clamp, mulberry32, mutate } = __m_engine_core;

const ICON = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v3M21 12h-3M12 21v-3M3 12h3"/></svg>';
const PREFS = 'motif5-grade-ui';
const NODE_W = 72, NODE_H = 40, COL_GAP = 24, ROW_GAP = 8, PAD = 8, IO_W = 32;
const st = { sel: 'levels', mode: 'wave', space: 'rec709', curveCh: 'y', hueCh: 's', lut: null, menu: false, lastScope: 0, liveMs: 0, scopeKey: '', exact: false, stats: null, lastMs: 0 };
let api = null, scopes = null, els = null, ro = null, pendingInvalidate = false;
try { const p = JSON.parse(localStorage.getItem(PREFS) || 'null'); if (p) { if (S.MODES.some(m => m.id === p.mode)) st.mode = p.mode; if (S.SPACES.some(s => s.id === p.space)) st.space = p.space; } } catch (e) { /* per-viewer convenience only */ }
const savePrefs = () => { try { localStorage.setItem(PREFS, JSON.stringify({ mode: st.mode, space: st.space })); } catch (e) { /* per-viewer convenience only */ } };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt2 = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);

// ---------- styles (tokens only, 8px grid) ----------
const STYLE = `
/* The shell's tab bar is a fixed 6-column grid; let extension pages add columns instead of wrapping over the inspector. */
.tabs:has(> [data-tab=grade]){grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}
#panel-grade .gr-scopes{padding:var(--space-2) var(--space-3) var(--space-3);background:var(--surface-0);border-bottom:var(--hairline) solid var(--gap);display:flex;flex-direction:column;gap:var(--space-2)}
#panel-grade .gr-bar{display:flex;gap:var(--space-2);align-items:center;justify-content:space-between;flex-wrap:wrap}
#panel-grade .gr-bar .seg button{min-width:0;padding:0 var(--space-2)}
#panel-grade .seg button[disabled]{opacity:.4;cursor:not-allowed;background:transparent;color:var(--text-muted)}
#panel-grade .gr-scope{position:relative;margin:0;height:176px;border:var(--hairline) solid var(--line);border-radius:var(--radius-s);overflow:hidden;background:var(--stage)}
#panel-grade .gr-scope canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#panel-grade .gr-lbls{position:absolute;inset:0;pointer-events:none}
#panel-grade .gr-lbls span{position:absolute;font:500 var(--text-xs)/16px var(--font-mono);color:var(--text-muted);white-space:nowrap;text-shadow:0 0 4px var(--stage),0 0 2px var(--stage)}
#panel-grade .gr-msg{position:absolute;inset:0;margin:0;display:grid;place-items:center;padding:var(--space-4);text-align:center;font-size:var(--text-sm);line-height:20px;color:var(--text-muted)}
#panel-grade .gr-readout{display:flex;flex-wrap:wrap;gap:0 var(--space-2);margin:0;min-height:16px}
#panel-grade .gr-readout b{color:var(--text);font-weight:500}
#panel-grade .gr-graph{position:relative;overflow-x:auto;overflow-y:hidden;background:var(--surface-0);border:var(--hairline) solid var(--line);border-radius:var(--radius-s);outline-offset:-2px}
#panel-grade .gr-graph[data-bypass="true"] .gr-net{opacity:.5}
#panel-grade .gr-net{position:relative}
#panel-grade .gr-wires{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
#panel-grade .gr-wires path{fill:none;stroke:var(--line-hover);stroke-width:1.5}
#panel-grade .gr-wires path.mx{stroke:var(--data-dim);stroke-dasharray:4 4}
#panel-grade .gr-wires circle{fill:var(--line-hover)}
#panel-grade .gr-io{position:absolute;width:${IO_W}px;height:24px;display:grid;place-items:center;font:600 var(--text-xs)/16px var(--font-mono);color:var(--text-dim);border:var(--hairline) dashed var(--line-strong);border-radius:var(--radius-s)}
#panel-grade .gr-node{position:absolute;width:${NODE_W}px;height:${NODE_H}px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:16px 16px;align-content:center;column-gap:var(--space-1);padding:0 var(--space-2);border:var(--hairline) solid var(--line-strong);border-radius:var(--radius-m);background:var(--surface-2);color:var(--text);text-align:left;cursor:pointer;font:600 var(--text-xs)/16px var(--font-mono);transition:border-color var(--dur-fast),background var(--dur-fast)}
#panel-grade .gr-node:hover{background:var(--surface-3);border-color:var(--line-hover)}
#panel-grade .gr-node b{grid-row:1/3;align-self:center;font-weight:600;color:var(--text-dim)}
#panel-grade .gr-node span{color:var(--text-strong)}
#panel-grade .gr-node small{font:500 var(--text-xs)/16px var(--font-mono);color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#panel-grade .gr-node[aria-current="true"]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent);background:var(--accent-soft)}
#panel-grade .gr-node[data-fixed="true"]{border-style:dashed}
#panel-grade .gr-node[data-off="true"] span,#panel-grade .gr-node[data-off="true"] small{text-decoration:line-through;opacity:.6}
#panel-grade .gr-node[data-warn="true"] small{color:var(--danger)}
#panel-grade .gr-node i{position:absolute;right:4px;top:4px;width:4px;height:4px;border-radius:50%;background:var(--accent)}
#panel-grade .gr-tools{display:flex;flex-wrap:wrap;gap:var(--space-2);position:relative}
#panel-grade .gr-menu{position:absolute;z-index:5;top:calc(100% + var(--space-1));left:0;min-width:240px;margin:0;padding:var(--space-1);list-style:none;background:var(--surface-2);border:var(--hairline) solid var(--line-strong);border-radius:var(--radius-l);box-shadow:var(--shadow)}
#panel-grade .gr-menu li{display:grid;gap:0;padding:var(--space-1) var(--space-2);border-radius:var(--radius-s);cursor:pointer;min-height:var(--target)}
#panel-grade .gr-menu li b{font-weight:600;color:var(--text-strong);font-size:var(--text-sm)}
#panel-grade .gr-menu li small{color:var(--text-muted);font-size:var(--text-xs);line-height:16px}
#panel-grade .gr-menu li:hover,#panel-grade .gr-menu li:focus{background:var(--surface-3);outline:none}
#panel-grade .gr-menu li:focus-visible{box-shadow:inset 0 0 0 var(--focus-w) var(--focus)}
#panel-grade .gr-hint{margin:0;font-size:var(--text-xs);line-height:16px;color:var(--text-dim)}
#panel-grade .gr-hint kbd{font:500 var(--text-xs)/16px var(--font-mono);color:var(--text-muted)}
#panel-grade .gr-empty{display:flex;flex-direction:column;gap:var(--space-2);padding:var(--space-3);border:var(--hairline) dashed var(--line-strong);border-radius:var(--radius-s)}
#panel-grade .gr-empty p{margin:0;font-size:var(--text-sm);line-height:20px;color:var(--text-muted)}
#panel-grade .gr-alert{padding:var(--space-2) var(--space-3);border:var(--hairline) solid var(--danger);border-radius:var(--radius-s);background:var(--surface-0);color:var(--text);font-size:var(--text-sm);line-height:20px;margin:0}
#panel-grade .gr-alert b{color:var(--danger)}
#panel-grade .gr-ok{margin:0;font-size:var(--text-xs);line-height:16px;color:var(--text-muted)}
#panel-grade .gr-wheels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--space-2);padding:var(--space-1) 0 var(--space-2)}
#panel-grade .gr-wheel{display:flex;flex-direction:column;align-items:center;gap:var(--space-1);min-width:0}
#panel-grade .gr-wheel .lbl{display:flex;align-items:center;gap:var(--space-1)}
#panel-grade .gr-pad{position:relative;width:100%;max-width:80px;aspect-ratio:1;border-radius:50%;border:var(--hairline) solid var(--line-strong);touch-action:none;cursor:crosshair}
#panel-grade .gr-pad::before{content:"";position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle,var(--surface-1) 0 22%,transparent 70%)}
#panel-grade .gr-pad::after{content:"";position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:var(--text-dim)}
#panel-grade .gr-pad i{position:absolute;z-index:1;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:var(--text-strong);box-shadow:0 0 0 2px var(--surface-1);pointer-events:none}
#panel-grade .gr-pad:focus-visible{outline:var(--focus-w) solid var(--focus);outline-offset:2px}
#panel-grade .gr-wheel output{font:400 var(--text-xs)/16px var(--font-mono);color:var(--text-muted);white-space:nowrap}
#panel-grade .gr-wheel .kb{width:var(--ib);height:var(--ib)}
#panel-grade .gr-curve{position:relative;height:160px;margin:var(--space-1) 0;border:var(--hairline) solid var(--line-strong);border-radius:var(--radius-s);background:linear-gradient(var(--line) 0 0) 0 25%/100% 1px no-repeat,linear-gradient(var(--line) 0 0) 0 50%/100% 1px no-repeat,linear-gradient(var(--line) 0 0) 0 75%/100% 1px no-repeat,linear-gradient(90deg,var(--line) 0 0) 25% 0/1px 100% no-repeat,linear-gradient(90deg,var(--line) 0 0) 50% 0/1px 100% no-repeat,linear-gradient(90deg,var(--line) 0 0) 75% 0/1px 100% no-repeat,var(--surface-0);touch-action:none}
#panel-grade .gr-curve svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
#panel-grade .gr-curve path{fill:none;stroke-width:2;vector-effect:non-scaling-stroke}
#panel-grade .gr-curve path.ref{stroke:var(--line-strong);stroke-width:1;stroke-dasharray:3 3}
#panel-grade .gr-pt{position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;padding:0;border-radius:50%;border:2px solid var(--surface-1);background:var(--text-strong);cursor:ns-resize}
#panel-grade .gr-pt::after{content:"";position:absolute;inset:-6px}
#panel-grade .gr-pt:focus-visible{outline:var(--focus-w) solid var(--focus);outline-offset:2px}
#panel-grade .gr-huebar{height:8px;border-radius:var(--radius-s);margin:var(--space-1) 0}
#panel-grade .gr-band{position:relative;height:16px;margin:var(--space-1) 0 var(--space-2);border-radius:var(--radius-s);overflow:hidden}
#panel-grade .gr-band i{position:absolute;top:0;bottom:0;background:var(--scrim)}
#panel-grade .gr-band b{position:absolute;top:0;bottom:0;border:var(--hairline) solid var(--text-strong);border-radius:var(--radius-s)}
#panel-grade .gr-lutinfo{display:grid;grid-template-columns:auto 1fr;gap:0 var(--space-3);margin:0;font-size:var(--text-xs);line-height:16px}
#panel-grade .gr-lutinfo dt{color:var(--text-dim)}#panel-grade .gr-lutinfo dd{margin:0;color:var(--text);font-family:var(--font-mono)}
#panel-grade .gr-vis{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`;
function ensureCss() { if (typeof document === 'undefined' || document.getElementById('grade-css')) return; const s = document.createElement('style'); s.id = 'grade-css'; s.textContent = STYLE; document.head.appendChild(s); }

// ---------- LUT persistence (IndexedDB, per browser; the project stores only { id, name, size }) ----------
const lutDb = (() => {
  let dbP = null;
  const open = () => dbP || (dbP = new Promise(res => { try { if (typeof indexedDB === 'undefined') return res(null); const r = indexedDB.open('motif5-luts', 1); r.onupgradeneeded = () => r.result.createObjectStore('luts', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (e) { res(null); } }));
  const tx = async (mode, fn) => { const d = await open(); if (!d) return null; return new Promise(res => { try { const t = d.transaction('luts', mode); const q = fn(t.objectStore('luts')); t.oncomplete = () => res(q ? q.result : true); t.onerror = () => res(null); t.onabort = () => res(null); } catch (e) { res(null); } }); };
  const plain = l => ({ id: l.id, name: l.name, title: l.title, size1: l.size1, size3: l.size3, min1: l.min1.slice(), max1: l.max1.slice(), min3: l.min3.slice(), max3: l.max3.slice(), data1: l.data1 ? l.data1.slice() : null, data3: l.data3 ? l.data3.slice() : null, added: Date.now() });
  const tried = new Set();
  return {
    put: l => tx('readwrite', s => s.put(plain(l))),
    async ensure(id) { if (!id || G.getLut(id) || tried.has(id)) return false; tried.add(id); const r = await tx('readonly', s => s.get(id)); if (r && r.id === id && (r.data1 || r.data3)) { G.registerLut(r); return true; } return false; },
    async prune(keep) { const all = await tx('readonly', s => s.getAll()); if (!all || all.length <= 24) return; const old = all.filter(r => !keep.has(r.id)).sort((a, b) => a.added - b.added).slice(0, all.length - 24); for (const r of old) await tx('readwrite', s => s.delete(r.id)); },
  };
})();
function usedLuts(pr) { return pr && pr.grade ? pr.grade.nodes.filter(n => n.type === 'lut' && n.lut).map(n => n.lut.id) : []; }
async function restoreLuts(pr) {
  let any = false; for (const id of usedLuts(pr)) if (await lutDb.ensure(id)) any = true;
  if (any) { if (api) { api.stage.invalidate(); if (api.tab === 'grade') render(); } else pendingInvalidate = true; }
}

// ---------- model helpers ----------
const proj = () => api.project;
const grade = () => proj().grade || null;
const nodes = () => (grade() ? grade().nodes : []);
const nodeIdx = id => nodes().findIndex(n => n.id === id);
const selNode = () => (st.sel === 'levels' ? null : G.nodeById(grade(), st.sel));
const applyOn = (pr, path, v) => (pr.keys[path] ? api.T.setKey(pr, path, api.uNow(), v) : api.T.setBase(pr, path, v));
function edit(fn, msg) { const next = api.clone(proj()); if (!next.grade) next.grade = G.newGrade(); const r = fn(next.grade, next); api.commit(next, msg); return r; }
function addNode(type, after = st.sel, extra = {}) {
  if (nodes().length >= G.MAX_NODES) { api.toast(`A grade holds up to ${G.MAX_NODES} nodes`); return null; }
  if (type === 'lut' && nodes().filter(n => n.type === 'lut').length >= G.MAX_LUT_NODES) { api.toast(`Up to ${G.MAX_LUT_NODES} LUT nodes per grade`); return null; }
  let id = null;
  edit((g) => { const n = G.newNode(type, g.nodes, extra); const i = after === 'levels' ? 0 : Math.max(0, g.nodes.findIndex(x => x.id === after) + 1) || g.nodes.length; g.nodes.splice(after == null ? g.nodes.length : i, 0, n); id = n.id; st.sel = id; if (!g.on && g.nodes.length === 1) g.on = true; }, `Added ${G.TYPES[type].name}`);
  return id;
}
function removeNode(id) {
  const i = nodeIdx(id); if (i < 0) return;
  const label = G.nodeLabel(grade(), nodes()[i]);
  edit(g => { g.nodes.splice(i, 1); }, `Removed ${label} · ${navigator.platform && /Mac/.test(navigator.platform) ? '⌘Z' : 'Ctrl Z'} to undo`);
  const ns = nodes(); st.sel = ns.length ? ns[Math.min(i, ns.length - 1)].id : 'levels';
}
function moveNode(id, d) {
  const i = nodeIdx(id), j = i + d; if (i < 0 || j < 0 || j >= nodes().length) return;
  edit(g => { const [n] = g.nodes.splice(i, 1); g.nodes.splice(j, 0, n); }, d < 0 ? 'Node moved earlier' : 'Node moved later');
}
function resetNode(id) {
  const n = G.nodeById(grade(), id); if (!n) return;
  const next = api.clone(proj()); const m = G.nodeById(next.grade, id); m.params = { ...__m_engine_core.defaults(G.schemaFor(m.type)) };
  for (const k of Object.keys(next.keys)) if (k.startsWith(`G:${id}:`)) delete next.keys[k];
  api.commit(next, `${G.TYPES[n.type].name} reset`);
}
function resetAll() {
  if (!nodes().length) return;
  const next = api.clone(proj()); for (const n of next.grade.nodes) n.params = { ...__m_engine_core.defaults(G.schemaFor(n.type)) };
  for (const k of Object.keys(next.keys)) if (k.startsWith('G:')) delete next.keys[k];
  api.commit(next, 'Grade reset · node structure kept');
}
function vary() {
  if (!nodes().length) { api.toast('Add a node to vary'); return; }
  const next = api.clone(proj()); const rng = mulberry32((Date.now() ^ 0x5bd1e995) >>> 0); let changed = 0;
  for (const n of next.grade.nodes) {
    const lk = new Set(); for (const p of api.locks) if (p.startsWith(`G:${n.id}:`)) lk.add(p.split(':')[2]); for (const p of Object.keys(next.keys)) if (p.startsWith(`G:${n.id}:`)) lk.add(p.split(':')[2]);
    const r = mutate(n.params, G.schemaFor(n.type), 0.35, lk, rng); n.params = r.values; changed += r.changed.length;
  }
  api.commit(next, changed ? `Varied ${changed} grade values · locked and keyed values kept` : 'Everything is locked or keyed');
}
function setBypass(off) { if (!nodes().length) return; edit(g => { g.on = !off; }, off ? 'B · grade bypassed' : 'A · grade on'); }
function togglePar(id) { const i = nodeIdx(id); if (i <= 0) { api.toast('The first node runs in series'); return; } const n = nodes()[i]; if (n.type === 'mixer') { api.toast('A mixer always runs in series'); return; } edit(g => { g.nodes[i].par = !g.nodes[i].par; }, n.par ? 'Node runs in series' : 'Node runs in parallel with the one before'); }
function toggleOn(id) { const n = G.nodeById(grade(), id); if (!n) return; const path = `G:${id}:on`; const next = applyOn(proj(), path, !n.params.on); api.commit(next, n.params.on ? 'Node disabled' : 'Node enabled'); }

// ---------- graph layout ----------
function columns() {
  const cols = [[{ id: 'levels' }]];
  nodes().forEach((n, i) => { if (n.par && i > 0) cols[cols.length - 1].push(n); else cols.push([n]); });
  return cols;
}
function layout() {
  const cols = columns(), mixers = nodes().some(n => n.type === 'mixer'), top = PAD + (mixers ? 16 : 0);
  const rows = Math.max(...cols.map(c => c.length)), H = top + rows * NODE_H + (rows - 1) * ROW_GAP + PAD;
  const pos = new Map(); const x0 = PAD + IO_W + COL_GAP;
  cols.forEach((c, ci) => c.forEach((n, ri) => { const cy = top + (rows * NODE_H + (rows - 1) * ROW_GAP) / 2 - (c.length * NODE_H + (c.length - 1) * ROW_GAP) / 2; pos.set(n.id, { x: x0 + ci * (NODE_W + COL_GAP), y: cy + ri * (NODE_H + ROW_GAP), col: ci, row: ri }); }));
  const W = x0 + cols.length * (NODE_W + COL_GAP) + IO_W + PAD;
  return { cols, pos, W, H, top, mid: top + (rows * NODE_H + (rows - 1) * ROW_GAP) / 2 };
}
function graphHtml() {
  const L = layout(), g = grade(), wires = [], ns = nodes();
  const mid = L.mid, inX = PAD + IO_W, outX = L.W - PAD - IO_W;
  let prevOut = { x: inX, y: mid };
  L.cols.forEach((c, ci) => {
    const xIn = PAD + IO_W + COL_GAP + ci * (NODE_W + COL_GAP), xOut = xIn + NODE_W;
    const jIn = { x: xIn - COL_GAP / 2, y: mid }, jOut = { x: xOut + COL_GAP / 2, y: mid };
    wires.push(`M${prevOut.x} ${prevOut.y}H${c.length > 1 ? jIn.x : xIn}`);
    for (const n of c) { const p = L.pos.get(n.id), y = p.y + NODE_H / 2; if (c.length > 1) { wires.push(`M${jIn.x} ${mid}C${jIn.x + 6} ${mid} ${jIn.x + 6} ${y} ${xIn} ${y}`); wires.push(`M${xOut} ${y}C${jOut.x - 6} ${y} ${jOut.x - 6} ${mid} ${jOut.x} ${mid}`); } }
    prevOut = c.length > 1 ? jOut : { x: xOut, y: mid };
  });
  wires.push(`M${prevOut.x} ${prevOut.y}H${outX}`);
  const mx = ns.filter(n => n.type === 'mixer').map(n => { const p = L.pos.get(n.id), s = n.src === 'in' ? { x: PAD + IO_W / 2, y: mid - 12 } : (() => { const q = L.pos.get(n.src); return q ? { x: q.x + NODE_W / 2, y: q.y } : null; })(); if (!s) return ''; const ty = p.y, tx = p.x + NODE_W / 2, top = PAD + 2; return `<path class="mx" d="M${s.x} ${s.y}C${s.x} ${top} ${tx} ${top} ${tx} ${ty}"/>`; }).join('');
  const dots = L.cols.filter(c => c.length > 1).map(c => { const p = L.pos.get(c[0].id); return `<circle cx="${p.x + NODE_W + COL_GAP / 2}" cy="${mid}" r="3"/>`; }).join('');
  const nodeBtn = (n, i) => {
    const p = L.pos.get(n.id), fixed = n.id === 'levels', t = fixed ? null : G.TYPES[n.type];
    const f = proj().finish, levelsMod = fixed && (f.black > 0.001 || f.white < 0.999 || Math.abs(f.gamma - 1) > 0.001 || f.gmap > 0.001);
    const off = !fixed && !n.params.on, warn = !fixed && n.type === 'lut' && !(n.lut && G.getLut(n.lut.id));
    const keyed = Object.keys(proj().keys).some(k => k.startsWith(fixed ? 'F:' : `G:${n.id}:`) && (!fixed || /^F:(black|white|gamma|gmap)$/.test(k)));
    const sub = fixed ? 'Finish' : off ? 'off' : n.type === 'lut' ? (n.lut ? n.lut.name : 'empty') : n.type === 'mixer' ? (n.src === 'in' ? 'over IN' : `over ${nodeIdx(n.src) + 1}`) : `${n.par ? '∥ ' : ''}${Math.round(n.params.mix * 100)}%`;
    const label = fixed ? 'Levels from Finish, node 0' : `Node ${i + 1}, ${t.name}${n.par ? ', parallel' : ''}${off ? ', disabled' : ''}${warn ? ', LUT missing' : ''}`;
    return `<button type="button" class="gr-node" data-node="${n.id}" data-fk="node:${n.id}" tabindex="${st.sel === n.id ? 0 : -1}" aria-current="${st.sel === n.id}" aria-label="${esc(label)}" data-off="${off}" data-warn="${warn}" data-fixed="${fixed}" style="left:${p.x}px;top:${p.y}px" title="${esc(fixed ? 'Black point, white point, gamma and gradient map from the Finish page' : t.hint)}"><b>${fixed ? 0 : i + 1}</b><span>${fixed ? 'LEV' : t.short}</span><small>${esc(sub)}</small>${keyed || levelsMod ? '<i aria-hidden="true"></i>' : ''}</button>`;
  };
  return `<div class="gr-graph" id="grGraph" role="group" aria-label="Node graph, ${ns.length} node${ns.length === 1 ? '' : 's'} after Levels" aria-describedby="grGraphHint" data-bypass="${!!(g && !g.on)}">
    <div class="gr-net" style="width:${L.W}px;height:${L.H}px">
      <svg class="gr-wires" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}" aria-hidden="true"><path d="${wires.join('')}"/>${mx}${dots}</svg>
      <span class="gr-io" style="left:${PAD}px;top:${mid - 12}px" aria-hidden="true">IN</span>
      ${nodeBtn({ id: 'levels' }, -1)}${ns.map(nodeBtn).join('')}
      <span class="gr-io" style="left:${outX}px;top:${mid - 12}px" aria-hidden="true">OUT</span>
    </div></div>`;
}
function menuHtml() {
  return `<ul class="gr-menu" id="grMenu" role="menu" aria-label="Add node">${G.TYPE_IDS.map((t, i) => `<li role="menuitem" tabindex="${i ? -1 : 0}" data-add="${t}"><b>${G.TYPES[t].name}</b><small>${G.TYPES[t].hint}</small></li>`).join('')}</ul>`;
}

// ---------- wheels ----------
// Puck (x, y) in the unit disc ↔ zero-luma RGB offsets along Rec.709 Cb / Cr, oriented like the vectorscope.
const U = [0, -0.1873, 1.8556], V = [1.5748, -0.4681, 0], KW = [0.2126, 0.7152, 0.0722];
const WHEELS = [{ k: 'lift', l: 'Lift', a: 0.25 }, { k: 'gamma', l: 'Gamma', a: 0.25 }, { k: 'gain', l: 'Gain', a: 0.25 }, { k: 'off', l: 'Offset', a: 0.25 }];
const wheelPaths = (id, k) => ['R', 'G', 'B'].map(c => `G:${id}:${k}${c}`);
function wheelXY(rgb, a) { const s = a / 1.8556, y0 = KW[0] * rgb[0] + KW[1] * rgb[1] + KW[2] * rgb[2]; return { x: clamp(((rgb[2] - y0) / 1.8556) / s, -1.2, 1.2), y: clamp(((rgb[0] - y0) / 1.5748) / s, -1.2, 1.2), y0 }; }
function xyRgb(x, y, a, y0 = 0) { const s = a / 1.8556; return [0, 1, 2].map(i => +(y0 + (x * U[i] + y * V[i]) * s).toFixed(4)); }
function wheelGradient() {
  const stops = S.targets('rec709').map(t => ({ a: ((90 - Math.atan2(t.y, t.x) * 180 / Math.PI) % 360 + 360) % 360, id: t.id })).sort((p, q) => p.a - q.a);
  const hue = { R: 25, Yl: 100, G: 145, Cy: 200, B: 265, Mg: 330 };
  const list = stops.map(s => `oklch(0.62 0.13 ${hue[s.id]}) ${s.a.toFixed(1)}deg`); const f = stops[0];
  return `conic-gradient(from 0deg, ${list.join(', ')}, oklch(0.62 0.13 ${hue[f.id]}) ${(f.a + 360).toFixed(1)}deg)`;
}
function wheelHtml(n, w) {
  const ps = wheelPaths(n.id, w.k), rgb = ps.map(p => api.shownValue(p)), xy = wheelXY(rgb, w.a);
  const ks = ps.map(p => api.keyState(p)), kst = ks.every(x => x === 'on') ? 'on' : ks.some(x => x !== 'none') ? 'anim' : 'none';
  const vt = `Red ${fmt2(rgb[0])}, green ${fmt2(rgb[1])}, blue ${fmt2(rgb[2])}`;
  return `<div class="gr-wheel"><div class="lbl">${w.l}<button class="ib kb" data-grkey="${ps.join(',')}" data-state="${kst}" aria-label="Key ${w.l} colour balance" title="Key this wheel at the playhead"><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M8 1.8 14.2 8 8 14.2 1.8 8Z" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.5"/></svg></button></div>
    <div class="gr-pad" role="slider" tabindex="0" data-wheel="${w.k}" data-fk="wheel:${n.id}:${w.k}" aria-label="${w.l} colour balance" aria-valuetext="${vt}" aria-describedby="grWheelHint" style="background:${wheelGradient()}"><i style="left:${(50 + xy.x * 50).toFixed(2)}%;top:${(50 - xy.y * 50).toFixed(2)}%"></i></div>
    <output aria-hidden="true">${rgb.map(v => (v * 100).toFixed(0)).join(' ')}</output></div>`;
}
function setWheel(pr, id, k, x, y) {
  const w = WHEELS.find(q => q.k === k), ps = wheelPaths(id, k); const r = Math.hypot(x, y); if (r > 1) { x /= r; y /= r; }
  const cur = ps.map(p => api.T.getBase(pr, p)), y0 = KW[0] * cur[0] + KW[1] * cur[1] + KW[2] * cur[2];
  const rgb = xyRgb(x, y, w.a, Math.abs(x) + Math.abs(y) < 1e-6 ? 0 : y0); ps.forEach((p, i) => { pr = applyOn(pr, p, rgb[i]); }); return pr;
}
function paintWheel(el, pr) {
  const n = selNode(); if (!n) return; const w = WHEELS.find(q => q.k === el.dataset.wheel), ps = wheelPaths(n.id, w.k), rgb = ps.map(p => api.T.getBase(pr, p)), xy = wheelXY(rgb, w.a);
  el.firstElementChild.style.left = (50 + xy.x * 50).toFixed(2) + '%'; el.firstElementChild.style.top = (50 - xy.y * 50).toFixed(2) + '%';
  el.setAttribute('aria-valuetext', `Red ${fmt2(rgb[0])}, green ${fmt2(rgb[1])}, blue ${fmt2(rgb[2])}`);
  const out = el.nextElementSibling; if (out) out.textContent = rgb.map(v => (v * 100).toFixed(0)).join(' ');
}

// ---------- curves (same maths as gCurve in the shader) ----------
function curveAt(x, y) {
  const d = [y[1] - y[0], y[2] - y[1], y[3] - y[2], y[4] - y[3]];
  const m = [d[0], d[0] * d[1] <= 0 ? 0 : (d[0] + d[1]) / 2, d[1] * d[2] <= 0 ? 0 : (d[1] + d[2]) / 2, d[2] * d[3] <= 0 ? 0 : (d[2] + d[3]) / 2, d[3]];
  const t = x * 4; if (t <= 0) return y[0] + m[0] * t; if (t >= 4) return y[4] + m[4] * (t - 4);
  const i = Math.min(3, Math.floor(t)), f = t - i, f2 = f * f, f3 = f2 * f;
  return (2 * f3 - 3 * f2 + 1) * y[i] + (f3 - 2 * f2 + f) * m[i] + (3 * f2 - 2 * f3) * y[i + 1] + (f3 - f2) * m[i + 1];
}
const cyc = (h, v) => { const t = ((h % 1) + 1) % 1 * 6, i = Math.floor(t) % 6, f = t - Math.floor(t), s = f * f * (3 - 2 * f); return v[i] + (v[(i + 1) % 6] - v[i]) * s; };
const CURVE_CH = [{ id: 'y', l: 'Luma', c: 'var(--text-strong)' }, { id: 'r', l: 'Red', c: 'var(--danger)' }, { id: 'g', l: 'Green', c: 'var(--ok)' }, { id: 'b', l: 'Blue', c: 'var(--clip)' }];
// Generic point editor: xs (0..1), paths, value range lo..hi, eval(x, values) → value for the drawn line.
function editorHtml(kind, xs, paths, lo, hi, evalFn, color, bg, names) {
  const vals = paths.map(p => api.shownValue(p)), yy = v => (1 - (v - lo) / (hi - lo)) * 100;
  let d = ''; for (let i = 0; i <= 96; i++) { const x = i / 96, v = clamp(evalFn(x, vals), lo - (hi - lo) * 0.1, hi + (hi - lo) * 0.1); d += `${i ? 'L' : 'M'}${(x * 100).toFixed(2)} ${yy(v).toFixed(2)}`; }
  const ref = kind === 'curve' ? 'M0 100L100 0' : `M0 ${yy((lo + hi) / 2)}L100 ${yy((lo + hi) / 2)}`;
  return `<div class="gr-curve" data-editor="${kind}"${bg ? ` style="background:${bg}"` : ''}><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="ref" d="${ref}"/><path d="${d}" style="stroke:${color}"/></svg>
    ${paths.map((p, i) => `<button type="button" class="gr-pt" role="slider" data-pt="${p}" data-lo="${lo}" data-hi="${hi}" data-fk="pt:${p}" aria-label="${esc(names[i])}" aria-valuemin="${lo}" aria-valuemax="${hi}" aria-valuenow="${vals[i].toFixed(3)}" aria-valuetext="${esc(names[i])} ${vals[i].toFixed(2)}" style="left:${(xs[i] * 100).toFixed(2)}%;top:${yy(vals[i]).toFixed(2)}%"></button>`).join('')}</div>`;
}

// ---------- inspectors ----------
const R = (path, o) => api.rowHtml(path, o);
function commonRows(n) { return R(`G:${n.id}:on`) + R(`G:${n.id}:mix`); }
function nodeTools(n) {
  const i = nodeIdx(n.id);
  return `<div class="btnrow"><button class="btn sm" data-gr="par" aria-pressed="${!!n.par}"${i === 0 || n.type === 'mixer' ? ' disabled' : ''} title="Run in parallel with the node before (P)">Parallel</button><button class="btn sm" data-gr="left"${i <= 0 ? ' disabled' : ''} aria-label="Move node earlier" title="Alt ←">← Earlier</button><button class="btn sm" data-gr="right"${i >= nodes().length - 1 ? ' disabled' : ''} aria-label="Move node later" title="Alt →">Later →</button><button class="btn sm" data-gr="reset-node">Reset node</button><button class="btn sm" data-gr="del" title="Delete">Delete</button></div>`;
}
function inspectorHtml() {
  if (st.sel === 'levels') {
    const F = k => R(`F:${k}`);
    return api.group('gr-node', 'Node 0 · Levels', `<p class="info">The Finish page's grade controls. They run before the node graph and travel with it into an exported .cube.</p>${F('black')}${F('white')}${F('gamma')}${F('gmap')}${F('gmapMode')}`);
  }
  const n = selNode(); if (!n) { st.sel = 'levels'; return inspectorHtml(); }
  const t = G.TYPES[n.type], i = nodeIdx(n.id), P = k => R(`G:${n.id}:${k}`);
  let body = '';
  if (n.type === 'primary') {
    body = `<div class="gr-wheels">${WHEELS.map(w => wheelHtml(n, w)).join('')}</div><p class="gr-hint" id="grWheelHint">Drag a wheel or use arrow keys (Shift ×5, Alt fine). Delete re-centres. Master values below.</p>
      ${P('liftY')}${P('gammaY')}${P('gainY')}${P('offY')}${P('contrast')}${P('pivot')}${P('sat')}${P('hue')}`
      + api.group('gr-ch', 'Channels', ['lift', 'gamma', 'gain', 'off'].map(k => P(k + 'R') + P(k + 'G') + P(k + 'B')).join(''));
  } else if (n.type === 'curves') {
    const ch = CURVE_CH.find(c => c.id === st.curveCh) || CURVE_CH[0], ps = [0, 1, 2, 3, 4].map(k => `G:${n.id}:${ch.id}${k}`);
    body = `<div class="seg" role="radiogroup" aria-label="Curve channel">${CURVE_CH.map(c => `<button role="radio" data-gr="curve-ch" data-v="${c.id}" aria-checked="${c.id === ch.id}" tabindex="${c.id === ch.id ? 0 : -1}">${c.l}</button>`).join('')}</div>
      ${editorHtml('curve', [0, 0.25, 0.5, 0.75, 1], ps, 0, 1, (x, v) => curveAt(x, v), ch.c, '', [0, 25, 50, 75, 100].map(p => `${ch.l} curve at ${p}%`))}
      <p class="gr-hint">Drag points or focus one and use ↑ ↓ (Shift ×5). The luma curve applies to all channels first.</p>` + api.group('gr-pts', `${ch.l} points`, ps.map(p => R(p)).join(''));
  } else if (n.type === 'huesat') {
    const sat = st.hueCh === 's', ks = [0, 1, 2, 3, 4, 5].map(k => `G:${n.id}:${sat ? 's' : 'h'}${k}`);
    // knots sit at the centre of each sixth (x = k/6 + 1/12), so the band starts at hue −30°
    const hueBg = `linear-gradient(90deg,${[0, 30, 90, 150, 210, 270, 330, 360].map(h => `hsl(${h - 30} 60% 45% / .22) ${(h / 3.6).toFixed(1)}%`).join(',')}),var(--surface-0)`;
    body = `<div class="seg" role="radiogroup" aria-label="Hue curve">${[['s', 'Hue vs sat'], ['h', 'Hue vs hue']].map(([v, l]) => `<button role="radio" data-gr="hue-ch" data-v="${v}" aria-checked="${v === st.hueCh}" tabindex="${v === st.hueCh ? 0 : -1}">${l}</button>`).join('')}</div>
      ${editorHtml('hue', [0, 1, 2, 3, 4, 5].map(k => k / 6 + 1 / 12), ks, sat ? 0 : -60, sat ? 2 : 60, (x, v) => cyc(x - 1 / 12, v), 'var(--accent)', hueBg, G.HUES.map(h => `${sat ? 'Saturation' : 'Hue shift'} for ${h}`))}
      <p class="gr-hint">Six hue points: red, yellow, green, cyan, blue, magenta. Greys are never affected.</p>` + api.group('gr-pts', sat ? 'Saturation points' : 'Hue points', ks.map(p => R(p)).join(''));
  } else if (n.type === 'qualifier') {
    const p = n.params, c = (p.hue % 360) / 3.6, w = Math.min(100, p.width / 3.6), a = c - w / 2, b = c + w / 2;
    // selected hue range (may wrap) outlined; the rest of the band dimmed
    const sel = w >= 100 ? [[0, 100]] : a < 0 ? [[0, b], [100 + a, 100]] : b > 100 ? [[0, b - 100], [a, 100]] : [[a, b]];
    const dim = []; let x = 0; for (const [l, r] of sel.sort((u, v) => u[0] - v[0])) { if (l > x) dim.push([x, l]); x = Math.max(x, r); } if (x < 100) dim.push([x, 100]);
    const seg = (r, cls) => `<${cls} style="left:${r[0].toFixed(2)}%;width:${(r[1] - r[0]).toFixed(2)}%"></${cls}>`;
    body = `<div class="subhead"><span>Key</span></div><div class="gr-band" aria-hidden="true" style="background:linear-gradient(90deg,${[0, 60, 120, 180, 240, 300, 360].map(h => `hsl(${h} 70% 50%) ${(h / 3.6).toFixed(1)}%`).join(',')})">${dim.map(r => seg(r, 'i')).join('')}${sel.map(r => seg(r, 'b')).join('')}</div>
      ${P('hue')}${P('width')}${P('satLo')}${P('satHi')}${P('lumLo')}${P('lumHi')}${P('soft')}${P('blur')}${P('invert')}
      ${p.blur > 0.001 && nodes().filter(x => x.type === 'qualifier' && x.params.blur > 0.001).indexOf(n) >= G.MAX_BLUR_KEYS ? `<p class="note warn">Only the first ${G.MAX_BLUR_KEYS} qualifiers get a blurred key; this one stays sharp.</p>` : ''}
      <div class="subhead"><span>Inside the key</span></div>${P('qHue')}${P('qSat')}${P('qGain')}${P('qOff')}`;
  } else if (n.type === 'lut') {
    const l = n.lut && G.getLut(n.lut.id), list = G.listLuts();
    body = `${n.lut && !l ? `<p class="gr-alert" role="alert"><b>LUT missing.</b> ${esc(n.lut.name)} isn't stored in this browser. Import it again to apply it; until then this node passes the image through.</p>` : ''}
      ${!n.lut ? '<div class="gr-empty"><p>This node has no LUT yet. Import a .cube, .3dl or HALD .png into it.</p></div>' : ''}
      ${l ? `<dl class="gr-lutinfo"><dt>File</dt><dd>${esc(l.name)}</dd>${l.title ? `<dt>Title</dt><dd>${esc(l.title)}</dd>` : ''}<dt>Table</dt><dd>${[l.size1 ? `1D ${l.size1}` : '', l.size3 ? `3D ${l.size3}³` : ''].filter(Boolean).join(' + ')}</dd><dt>Domain</dt><dd>${l.min3.map(v => +v.toFixed(3)).join(' ')} → ${l.max3.map(v => +v.toFixed(3)).join(' ')}</dd></dl>` : ''}
      <div class="row"><label for="grLutPick">Table</label><span></span><span></span><span></span><select id="grLutPick" data-gr="lut-pick"><option value="">${list.length ? 'Choose an imported LUT' : 'No LUTs imported yet'}</option>${list.map(x => `<option value="${x.id}"${n.lut && n.lut.id === x.id ? ' selected' : ''}>${esc(x.name)} · ${x.size3 ? x.size3 + '³' : x.size1}</option>`).join('')}</select></div>
      <div class="btnrow"><button class="btn sm" data-gr="import">Import into this node…</button></div>${P('interp')}`;
  } else if (n.type === 'mixer') {
    const opts = [{ v: 'in', l: 'Grade input (IN)' }, ...nodes().slice(0, i).map((m, j) => ({ v: m.id, l: `Node ${j + 1} · ${G.TYPES[m.type].name}` }))];
    body = `<div class="row"><label for="grMixSrc">Base</label><span></span><span></span><span></span><select id="grMixSrc" data-gr="mix-src">${opts.map(o => `<option value="${o.v}"${o.v === n.src ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select></div>${P('blend')}
      <p class="info">Blends the chain so far over the base. Normal at 50% opacity is a half-strength grade.</p>`;
  }
  return api.group('gr-node', `Node ${i + 1} · ${t.name}`, `${commonRows(n)}${body}${nodeTools(n)}`);
}
function lutSlotHtml() {
  const m = st.lut;
  const state = !m ? `<p class="gr-ok">Import a .cube (1D, 3D or shaper + 3D), .3dl or HALD .png. Files stay in this browser. Export bakes Levels and every node into a 33³ .cube.</p>`
    : m.kind === 'loading' ? `<p class="gr-ok" role="status">Reading ${esc(m.name)}…</p>`
    : m.kind === 'error' ? `<p class="gr-alert" role="alert"><b>Couldn’t use ${esc(m.name)}.</b> ${esc(m.text)}</p>`
    : `<p class="gr-ok" role="status">${esc(m.text)}</p>`;
  return api.group('gr-lut', 'LUT', `${state}<div class="btnrow"><button class="btn sm" data-gr="import">${m && m.kind === 'error' ? 'Choose another file…' : 'Import LUT…'}</button><button class="btn sm" data-gr="export"${api.pipeline.finisher.ok ? '' : ' disabled title="Export needs WebGL2"'}>Export .cube</button></div>`);
}
function headHtml() {
  const g = grade(), ns = nodes(), on = !!(g && g.on), keyed = Object.keys(proj().keys).filter(k => k.startsWith('G:')).length;
  const status = !ns.length ? 'No nodes yet. Levels from Finish runs first; add nodes after it.' : !on ? '<b>B · bypassed.</b> The stage, scopes and exports show the image without the node grade. Press B to compare.' : `${ns.length} node${ns.length > 1 ? 's' : ''}${keyed ? ` · ${keyed} keyed value${keyed > 1 ? 's' : ''}` : ''}${ns.some(n => n.type === 'lut' && n.lut && !G.getLut(n.lut.id)) ? ' · <b>a LUT is missing</b>' : ''} · B compares`;
  const gl = api.pipeline.finisher.ok ? (api.pipeline.finisher.grader && api.pipeline.finisher.grader.error ? `<p class="gr-alert" role="alert"><b>The grade shader failed.</b> The stage shows the ungraded image. ${esc(api.pipeline.finisher.grader.error.slice(0, 160))}</p>` : '') : '<p class="gr-alert" role="alert"><b>WebGL2 is unavailable.</b> You can build the graph, but it only renders where WebGL2 is on.</p>';
  return `<div class="panel-head"><div class="ph-row"><div><div class="lbl">Whole frame · after Finish</div><h1>Grade</h1></div>
    <div class="seg" role="radiogroup" aria-label="Compare graded and ungraded">${[['a', 'A · Grade', on], ['b', 'B · Bypass', !on && ns.length]].map(([v, l, c]) => `<button role="radio" data-gr="ab" data-v="${v}" aria-checked="${!!c}" tabindex="${c || (v === 'a' && !ns.length) ? 0 : -1}"${ns.length ? '' : ' disabled'}>${l}</button>`).join('')}</div></div>
    <p>${status}</p></div>${gl}`;
}
function graphGroupHtml() {
  const empty = !nodes().length ? `<div class="gr-empty"><p>Start with Primaries for balance and contrast, or bring in a LUT.</p><div class="btnrow"><button class="btn sm accent" data-gr="add-primary">+ Primaries</button><button class="btn sm" data-gr="import">Import LUT…</button></div></div>` : '';
  return api.group('gr-graph', 'Nodes', `${graphHtml()}
    <div class="gr-tools"><button class="btn sm" id="grAdd" data-gr="menu" aria-haspopup="menu" aria-expanded="${st.menu}" aria-controls="grMenu">+ Add node</button><button class="btn sm" data-gr="vary" title="Vary unlocked, unkeyed grade values"${nodes().length ? '' : ' disabled'}>Vary</button><button class="btn sm" data-gr="reset-all"${nodes().length ? '' : ' disabled'}>Reset all</button>${st.menu ? menuHtml() : ''}</div>
    <p class="gr-hint" id="grGraphHint"><kbd>←</kbd><kbd>→</kbd> move · <kbd>↑</kbd><kbd>↓</kbd> parallel · <kbd>Enter</kbd> edit · <kbd>N</kbd> add · <kbd>Del</kbd> remove · <kbd>D</kbd> disable · <kbd>P</kbd> parallel · <kbd>Alt</kbd>+arrows reorder</p>${empty}`, nodes().length ? ` <span class="count">${nodes().length}</span>` : '');
}

// ---------- scopes ----------
function buildScopes(host) {
  const wrap = document.createElement('div'); wrap.className = 'gr-scopes';
  wrap.innerHTML = `<div class="gr-bar"><div class="seg" role="radiogroup" aria-label="Scope" id="grMode">${S.MODES.map(m => `<button role="radio" data-gr="mode" data-v="${m.id}">${m.l}</button>`).join('')}</div>
    <div class="seg" role="radiogroup" aria-label="Interpret colour as" id="grSpace">${S.SPACES.map(s => `<button role="radio" data-gr="space" data-v="${s.id}" aria-label="${s.l}" title="Measure in ${s.l} (luma weights and gamut)">${s.id === 'p3' ? 'P3' : '709'}</button>`).join('')}</div></div>
    <figure class="gr-scope" role="img" aria-describedby="grReadout"><canvas></canvas><div class="gr-lbls" aria-hidden="true"></div><p class="gr-msg" hidden></p></figure>
    <p class="readout gr-readout" id="grReadout"></p>`;
  host.appendChild(wrap);
  const canvas = wrap.querySelector('canvas'), fig = wrap.querySelector('figure');
  els = { wrap, canvas, fig, lbls: wrap.querySelector('.gr-lbls'), msg: wrap.querySelector('.gr-msg'), readout: wrap.querySelector('#grReadout') };
  scopes = S.createScopes(canvas);
  if (scopes.ok) {
    const cs = getComputedStyle(document.documentElement), tok = n => cs.getPropertyValue(n).trim();
    scopes.setStyle({ bg: tok('--stage') || undefined, well: tok('--surface-0') || undefined, grid: tok('--line-strong') || undefined, gridHi: tok('--line-hover') || undefined, cY: tok('--data') || undefined, cSkin: tok('--accent') || undefined });
  } else { els.msg.hidden = false; els.msg.textContent = scopes.reason; }
  ro = new ResizeObserver(() => sizeScope()); ro.observe(fig);
}
function sizeScope() {
  if (!els) return; const r = els.fig.getBoundingClientRect(); if (!r.width) return;
  const d = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1), w = Math.round(r.width * d), h = Math.round(r.height * d);
  if (els.canvas.width !== w || els.canvas.height !== h) { els.canvas.width = w; els.canvas.height = h; st.scopeKey = ''; if (scopes && scopes.ok && scopes.last) { scopes.show(); placeLabels(); } }
}
function placeLabels() {
  const r = els.fig.getBoundingClientRect(), key = `${st.mode}|${st.space}|${Math.round(r.width)}x${Math.round(r.height)}`; if (key === st.scopeKey) return; st.scopeKey = key;
  const L = S.labels(st.mode, st.space, r.width, r.height);
  els.lbls.innerHTML = L.labels.map(l => `<span style="left:${l.x.toFixed(1)}px;top:${l.y.toFixed(1)}px;transform:translate(${l.align === 'end' ? '-100%' : l.align === 'start' ? '0' : '-50%'},-50%)">${esc(l.text)}</span>`).join('');
  const m = S.MODES.find(x => x.id === st.mode);
  els.fig.setAttribute('aria-label', `${m.l} scope, ${S.SPACES.find(s => s.id === st.space).l} interpretation`);
}
function syncScopeUi() {
  if (!els) return;
  els.wrap.querySelectorAll('[data-gr=mode]').forEach(b => { b.setAttribute('aria-checked', b.dataset.v === st.mode); b.tabIndex = b.dataset.v === st.mode ? 0 : -1; });
  els.wrap.querySelectorAll('[data-gr=space]').forEach(b => { b.setAttribute('aria-checked', b.dataset.v === st.space); b.tabIndex = b.dataset.v === st.space ? 0 : -1; });
}
const pct = v => `${Math.round(v * 100)}%`;
function runScope(exact) {
  if (!scopes || !scopes.ok || !api) return null;
  if (scopes.lost) { els.msg.hidden = false; els.msg.textContent = 'The GPU reset the scopes. They come back when you reopen this page.'; return null; }
  const c = api.stage.canvas; if (!c || !c.width) return null;
  sizeScope();
  let r; try { r = scopes.update(c, { mode: st.mode, space: st.space, exact }); } catch (e) { console.error(e); els.msg.hidden = false; els.msg.textContent = 'Scopes could not read this frame.'; return null; }
  if (!r) { els.msg.hidden = false; els.msg.textContent = 'Waiting for the first frame.'; return null; }
  els.msg.hidden = true; placeLabels(); st.stats = r.stats; st.lastMs = r.ms; st.exact = exact;
  const s = r.stats;
  els.readout.innerHTML = `<span>Luma <b>${pct(s.low)}–${pct(s.high)}</b></span><span>median <b>${pct(s.median)}</b></span><span>clip <b>${(s.clipLow * 100).toFixed(1)}%</b> low · <b>${(s.clipHigh * 100).toFixed(1)}%</b> high</span><span title="Sample grid">${r.grid[0]}×${r.grid[1]}${exact ? '' : ' · live'}</span>`;
  return r;
}

// ---------- render ----------
function render() {
  if (!api || !els) return;
  const host = els.host; const ae = document.activeElement, fk = ae && host.contains(ae) ? (ae.dataset && ae.dataset.fk) || (ae.id ? '#' + ae.id : null) : null;
  els.head.innerHTML = headHtml();
  els.dyn.innerHTML = graphGroupHtml() + inspectorHtml() + lutSlotHtml();
  api.paintRanges(host);
  const sel = host.querySelector(`.gr-node[data-node="${st.sel}"]`); if (sel && sel.scrollIntoView) { const g = host.querySelector('#grGraph'); if (g) { const l = sel.offsetLeft, r = l + NODE_W; if (l < g.scrollLeft || r > g.scrollLeft + g.clientWidth) g.scrollLeft = Math.max(0, l - 40); } }
  if (fk) { const el = fk[0] === '#' ? host.querySelector(fk) : host.querySelector(`[data-fk="${CSS.escape ? CSS.escape(fk) : fk}"]`); if (el) el.focus({ preventScroll: true }); }
  if (st.menu) { const first = host.querySelector('#grMenu [role=menuitem]'); if (first && !(fk && fk.startsWith('menu'))) first.focus(); }
}
function focusNode(id) { st.sel = id; render(); const b = els.host.querySelector(`.gr-node[data-node="${id}"]`); if (b) b.focus({ preventScroll: false }); }

// ---------- LUT import / export ----------
const MAX_FILE = 24 * 1048576;
async function importFile(file, intoNode) {
  st.lut = { kind: 'loading', name: file.name }; render();
  try {
    if (file.size > MAX_FILE) throw new G.LutError('too-large', `It is ${(file.size / 1048576).toFixed(1)} MB; LUT files up to 24 MB are supported.`);
    let lut;
    if (/\.png$/i.test(file.name) || /^image\//.test(file.type)) {
      let bmp; try { bmp = await createImageBitmap(file, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }); } catch (e) { throw new G.LutError('format', 'The image couldn’t be decoded.'); }
      if (bmp.width > 4096 || bmp.height > 4096) throw new G.LutError('too-large', 'HALD images up to 4096 px are supported.');
      const c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
      lut = G.parseHald(x.getImageData(0, 0, bmp.width, bmp.height).data, bmp.width, bmp.height, file.name);
    } else if (/\.(cube|3dl|txt)$/i.test(file.name) || !file.name.includes('.')) lut = G.parseLut(await file.text(), file.name);
    else throw new G.LutError('format', 'Use a .cube, .3dl or HALD .png file.');
    return useLut(lut, intoNode);
  } catch (e) {
    st.lut = { kind: 'error', name: file.name, text: e && e.name === 'LutError' ? e.message : 'The file could not be read.' }; if (!(e && e.name === 'LutError')) console.error(e);
    render(); const b = els.host.querySelector('details[data-g="gr-lut"] [data-gr=import]'); if (b) b.focus(); return null;
  }
}
function useLut(lut, intoNode) {
  G.registerLut(lut); lutDb.put(lut).then(() => lutDb.prune(new Set(usedLuts(proj()))));
  const ref = { id: lut.id, name: lut.name, size: lut.size3 || lut.size1 }, target = intoNode && G.nodeById(grade(), intoNode);
  const dims = [lut.size1 ? `1D ${lut.size1}` : '', lut.size3 ? `3D ${lut.size3}³` : ''].filter(Boolean).join(' + ');
  if (target && target.type === 'lut') { edit(g => { G.nodeById(g, intoNode).lut = ref; }, `${lut.name} in node ${nodeIdx(intoNode) + 1}`); st.sel = intoNode; }
  else { const id = addNode('lut', nodes().length ? nodes()[nodes().length - 1].id : 'levels', { lut: ref }); if (!id) { st.lut = { kind: 'error', name: lut.name, text: `This grade already has ${G.MAX_LUT_NODES} LUT nodes or ${G.MAX_NODES} nodes.` }; render(); return null; } }
  st.lut = { kind: 'ok', text: `${lut.name} · ${dims} · in node ${nodeIdx(st.sel) + 1}` }; render();
  return lut.id;
}
function bake(N = 33) {
  const gr = api.pipeline.finisher.grader; if (!gr) throw new Error('Export needs WebGL2.');
  const pr = proj(), ev = api.T.evaluate(pr, api.stage.time, null);
  const l0 = ev.layers.find(l => l.visible) || ev.layers[0];
  const pal = api.C.resolvePalette(l0.shared.palette, l0.shared.invert, pr.palettes, l0.pmix && l0.pmix.to, l0.pmix && l0.pmix.t);
  const stops = api.C.gradientStops(pal, ev.finish.gmapMode).map(api.C.hexToRgb01);
  return gr.lattice(ev.finish, { stops }, N);
}
function exportCube(N = 33) {
  const r = bake(N); const t = (api.stage.time).toFixed(2);
  return { text: G.serializeCube(r.data, N, `Motif grade @ ${t} s`), precision: r.precision, N };
}
function downloadCube() {
  try {
    const r = exportCube(33), name = `motif-grade-33.cube`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.text], { type: 'text/plain' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    st.lut = { kind: 'ok', text: `Exported ${name} · 33³ = 35,937 entries · ${r.precision} · at ${api.stage.time.toFixed(2)} s` }; render();
  } catch (e) { console.error(e); st.lut = { kind: 'error', name: 'the export', text: e.message || String(e) }; render(); }
}
function pickFile(intoNode) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.cube,.3dl,.png,image/png';
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (f) importFile(f, intoNode); }); inp.click();
}

// ---------- events ----------
function onClick(e) {
  const t = e.target.closest('[data-gr],[data-node],[data-add],[data-grkey]'); if (!t || !els.host.contains(t)) return;
  if (t.dataset.node) { st.sel = t.dataset.node; st.menu = false; render(); const b = els.host.querySelector(`.gr-node[data-node="${st.sel}"]`); if (b) b.focus(); return; }
  if (t.dataset.add) { st.menu = false; addNode(t.dataset.add); focusNode(st.sel); return; }
  if (t.dataset.grkey) { toggleKeys(t.dataset.grkey.split(',')); return; }
  const a = t.dataset.gr, n = selNode();
  if (a === 'mode' || a === 'space') { st[a] = t.dataset.v; savePrefs(); syncScopeUi(); st.scopeKey = ''; runScope(!api.stage.playing); return; }
  if (a === 'ab') { setBypass(t.dataset.v === 'b'); return; }
  if (a === 'menu') { st.menu = !st.menu; render(); if (!st.menu) els.host.querySelector('#grAdd').focus(); return; }
  if (a === 'add-primary') { addNode('primary'); focusNode(st.sel); return; }
  if (a === 'vary') return vary();
  if (a === 'reset-all') return resetAll();
  if (a === 'import') return pickFile(n && n.type === 'lut' ? n.id : null);
  if (a === 'export') return downloadCube();
  if (a === 'curve-ch') { st.curveCh = t.dataset.v; render(); return; }
  if (a === 'hue-ch') { st.hueCh = t.dataset.v; render(); return; }
  if (!n) return;
  if (a === 'par') return togglePar(n.id);
  if (a === 'left' || a === 'right') { moveNode(n.id, a === 'left' ? -1 : 1); return; }
  if (a === 'reset-node') return resetNode(n.id);
  if (a === 'del') { removeNode(n.id); focusNode(st.sel); }
}
function toggleKeys(paths) {
  let pr = proj(); const u = api.uNow(); const allOn = paths.every(p => pr.keys[p] && api.T.keyIndexAt(pr.keys[p], u) >= 0);
  for (const p of paths) { if (allOn) pr = api.T.removeKey(pr, p, api.T.keyIndexAt(pr.keys[p], u)); else pr = api.T.setKey(pr, p, u, api.shownValue(p)); }
  api.commit(pr, allOn ? 'Wheel key removed' : 'Wheel keyed at the playhead');
}
function onChange(e) {
  const t = e.target; const n = selNode();
  if (t.dataset.gr === 'lut-pick' && n) { const l = G.getLut(t.value); edit(g => { G.nodeById(g, n.id).lut = l ? { id: l.id, name: l.name, size: l.size3 || l.size1 } : null; }, l ? `${l.name} in node ${nodeIdx(n.id) + 1}` : 'LUT cleared'); return; }
  if (t.dataset.gr === 'mix-src' && n) { edit(g => { G.nodeById(g, n.id).src = t.value; }, 'Mixer base changed'); }
}
function radioKeys(e) {
  const g = e.target.closest('[role=radiogroup]'); if (!g || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return false;
  const bs = [...g.querySelectorAll('[role=radio]:not([disabled])')]; const i = bs.indexOf(e.target); if (i < 0) return false;
  const nb = bs[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length];
  e.preventDefault(); e.stopPropagation(); nb.click(); const fk = nb.dataset.gr, v = nb.dataset.v; const again = els.host.querySelector(`[data-gr="${fk}"][data-v="${v}"]`); if (again) again.focus(); return true;
}
function graphKeys(e) {
  const b = e.target.closest('.gr-node'); if (!b) return false;
  const L = layout(), id = b.dataset.node, p = L.pos.get(id); const k = e.key; let handled = true;
  const ordered = ['levels', ...nodes().map(n => n.id)];
  if ((k === 'ArrowRight' || k === 'ArrowLeft') && e.altKey) { if (id !== 'levels') moveNode(id, k === 'ArrowRight' ? 1 : -1); focusNode(id); }
  else if (k === 'ArrowRight' || k === 'ArrowLeft') { const c = L.cols[p.col + (k === 'ArrowRight' ? 1 : -1)]; if (c) focusNode(c[Math.min(p.row, c.length - 1)].id); }
  else if (k === 'ArrowUp' || k === 'ArrowDown') { const c = L.cols[p.col], q = c[p.row + (k === 'ArrowDown' ? 1 : -1)]; if (q) focusNode(q.id); }
  else if (k === 'Home' || k === 'End') focusNode(k === 'Home' ? ordered[0] : ordered[ordered.length - 1]);
  else if (k === 'Enter' || k === 'F2') { st.sel = id; render(); const first = els.host.querySelector('details[data-g="gr-node"]'); if (first) { first.open = true; api.openGroups['gr-node'] = true; const f = first.querySelector('.rows input, .rows select, .rows [tabindex="0"], .rows button'); if (f) f.focus(); } }
  else if ((k === 'Delete' || k === 'Backspace') && id !== 'levels') { removeNode(id); focusNode(st.sel); }
  else if (k === 'n' || k === 'N' || k === '+' || k === 'Insert') { st.sel = id; st.menu = true; render(); }
  else if ((k === 'd' || k === 'D') && id !== 'levels') { toggleOn(id); focusNode(id); }
  else if ((k === 'p' || k === 'P') && id !== 'levels') { togglePar(id); focusNode(id); }
  else handled = false;
  if (handled) { e.preventDefault(); e.stopPropagation(); }
  return handled;
}
function menuKeys(e) {
  const li = e.target.closest('#grMenu [role=menuitem]'); if (!li) return false;
  const items = [...els.host.querySelectorAll('#grMenu [role=menuitem]')], i = items.indexOf(li);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { const n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]; items.forEach(x => { x.tabIndex = -1; }); n.tabIndex = 0; n.focus(); }
  else if (e.key === 'Home' || e.key === 'End') items[e.key === 'Home' ? 0 : items.length - 1].focus();
  else if (e.key === 'Enter' || e.key === ' ') { st.menu = false; addNode(li.dataset.add); focusNode(st.sel); }
  else if (e.key === 'Escape' || e.key === 'Tab') { st.menu = false; render(); els.host.querySelector('#grAdd').focus(); if (e.key === 'Tab') return true; }
  else return false;
  e.preventDefault(); e.stopPropagation(); return true;
}
function padKeys(e) {
  const el = e.target.closest('.gr-pad'); if (!el) return false; const n = selNode(); if (!n) return false;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  const k = el.dataset.wheel, w = WHEELS.find(q => q.k === k), ps = wheelPaths(n.id, k), cur = wheelXY(ps.map(p => api.shownValue(p)), w.a);
  if (d) { const s = e.shiftKey ? 0.1 : e.altKey ? 0.005 : 0.02; api.commit(setWheel(proj(), n.id, k, cur.x + d[0] * s, cur.y + d[1] * s)); }
  else if (e.key === 'Delete' || e.key === 'Backspace' || e.key === '0' || e.key === 'Home') { let pr = proj(); ps.forEach(p => { pr = applyOn(pr, p, 0); }); api.commit(pr, `${w.l} balance re-centred`); }
  else return false;
  e.preventDefault(); e.stopPropagation(); return true;
}
function ptKeys(e) {
  const el = e.target.closest('.gr-pt'); if (!el) return false;
  const lo = +el.dataset.lo, hi = +el.dataset.hi, path = el.dataset.pt, s = api.T.schemaAt(proj(), path); const v = api.shownValue(path);
  const st0 = (hi - lo) / 100 * (e.shiftKey ? 5 : e.altKey ? 0.2 : 1);
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') api.commit(applyOn(proj(), path, clamp(+(v + (e.key === 'ArrowUp' ? st0 : -st0)).toFixed(4), lo, hi)));
  else if (e.key === 'Home' || e.key === 'Delete' || e.key === 'Backspace') api.commit(applyOn(proj(), path, s.def), `${s.label} reset`);
  else return false;
  e.preventDefault(); e.stopPropagation(); return true;
}
function onKey(e) {
  if (e.metaKey || e.ctrlKey) return;
  if (menuKeys(e) || graphKeys(e) || padKeys(e) || ptKeys(e) || radioKeys(e)) return;
  if (e.key === 'Escape' && st.menu) { st.menu = false; render(); els.host.querySelector('#grAdd').focus(); e.stopPropagation(); }
}
// Pointer: wheels (absolute position, Shift = fine relative) and curve points (vertical drag).
let drag = null;
function onDown(e) {
  if (e.button !== 0) return; const n = selNode();
  const pad = e.target.closest('.gr-pad'), pt = e.target.closest('.gr-pt');
  if (pad && n) { pad.setPointerCapture(e.pointerId); drag = { kind: 'wheel', el: pad, id: e.pointerId, n: n.id, k: pad.dataset.wheel }; padMove(e); pad.focus({ preventScroll: true }); e.preventDefault(); }
  else if (pt) { pt.setPointerCapture(e.pointerId); drag = { kind: 'pt', el: pt, id: e.pointerId, box: pt.parentElement.getBoundingClientRect(), y0: e.clientY, v0: api.shownValue(pt.dataset.pt) }; pt.focus({ preventScroll: true }); e.preventDefault(); }
}
function padMove(e) {
  const r = drag.el.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * 2 - 1, y = 1 - ((e.clientY - r.top) / r.height) * 2;
  let fx = x, fy = y; if (e.shiftKey && drag.last) { fx = drag.last.x + (x - drag.raw.x) * 0.2; fy = drag.last.y + (y - drag.raw.y) * 0.2; }
  drag.raw = { x, y }; drag.last = { x: fx, y: fy };
  const pr = setWheel(proj(), drag.n, drag.k, fx, fy); api.live(pr); paintWheel(drag.el, pr);
}
function onMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  if (drag.kind === 'wheel') return padMove(e);
  const el = drag.el, lo = +el.dataset.lo, hi = +el.dataset.hi, f = e.shiftKey ? 0.2 : 1;
  const v = clamp(drag.v0 - ((e.clientY - drag.y0) / drag.box.height) * (hi - lo) * f, lo, hi); drag.moved = true;
  const pr = applyOn(proj(), el.dataset.pt, +v.toFixed(4)); api.live(pr); el.style.top = ((1 - (v - lo) / (hi - lo)) * 100).toFixed(2) + '%'; el.setAttribute('aria-valuenow', v.toFixed(3));
}
function onUp(e) { if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; if (d.kind === 'wheel' || d.moved) api.commit(proj()); }
function onDbl(e) { const pad = e.target.closest('.gr-pad'), n = selNode(); if (pad && n) { let pr = proj(); wheelPaths(n.id, pad.dataset.wheel).forEach(p => { pr = applyOn(pr, p, 0); }); api.commit(pr, 'Balance re-centred'); } }

// ---------- page ----------
function init(host, a) {
  api = a; ensureCss();
  for (const [g, open] of [['gr-graph', true], ['gr-node', true], ['gr-lut', true], ['gr-ch', false], ['gr-pts', false]]) if (!(g in a.openGroups)) a.openGroups[g] = open;
  restoreLuts(a.project);
  // B toggles the A/B compare while the Grade page is open (outside text fields).
  document.addEventListener('keydown', e => {
    if (!api || api.tab !== 'grade' || e.metaKey || e.ctrlKey || e.altKey) return;
    const tg = e.target, tag = tg.tagName; if ((tag === 'INPUT' && ['text', 'search', 'number'].includes(tg.type)) || tag === 'TEXTAREA' || tag === 'SELECT' || document.querySelector('dialog[open]')) return;
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); if (nodes().length) setBypass(grade().on); else api.toast('Add a node to compare'); }
  });
}
function panel(host, a) {
  api = a; ensureCss();
  if (!host._grade) {
    host._grade = true; host.innerHTML = '';
    const head = document.createElement('div'); host.appendChild(head);
    buildScopes(host);
    const dyn = document.createElement('div'); host.appendChild(dyn);
    els.host = host; els.head = head; els.dyn = dyn;
    host.addEventListener('click', onClick); host.addEventListener('change', onChange); host.addEventListener('keydown', onKey);
    host.addEventListener('pointerdown', onDown); host.addEventListener('pointermove', onMove); host.addEventListener('pointerup', onUp); host.addEventListener('pointercancel', onUp); host.addEventListener('dblclick', onDbl);
    host.addEventListener('focusout', e => { const m = host.querySelector('#grMenu'), to = e.relatedTarget; if (st.menu && m && to && !m.contains(to) && host.contains(to) && to.id !== 'grAdd') { st.menu = false; render(); } });
  }
  if (st.sel !== 'levels' && !selNode()) st.sel = nodes().length ? nodes()[0].id : 'levels';
  if (pendingInvalidate) { pendingInvalidate = false; a.stage.invalidate(); }
  if (usedLuts(proj()).some(id => !G.getLut(id))) restoreLuts(proj());
  render(); syncScopeUi(); st.scopeKey = ''; requestAnimationFrame(() => runScope(!a.stage.playing));
}
// Scopes follow the stage. Playing: live grid at ≤10 Hz (1 Hz with reduced motion), and never more than ~25% of the
// time on a slow GPU (interval ≥ 4× the last update). Paused / scrubbing: a live update now, the exact grid once the
// frame has settled for 160 ms.
let exactTimer = 0;
function tick(t, a) {
  api = a; if (pendingInvalidate) { pendingInvalidate = false; a.stage.invalidate(); }
  if (a.tab !== 'grade' || !scopes || !scopes.ok) return;
  const now = performance.now(), playing = a.stage.playing;
  clearTimeout(exactTimer);
  if (now - st.lastScope < Math.max(playing ? (a.reduce ? 1000 : 100) : 0, st.liveMs * 4)) { if (!playing) exactTimer = setTimeout(() => runScope(true), 160); return; }
  st.lastScope = now; const r = runScope(false); if (r) st.liveMs = r.ms;
  if (!playing) exactTimer = setTimeout(() => runScope(true), 160);
}
function commands(a) {
  const go = fn => () => { a.setTab('grade'); fn(); };
  return [
    { id: 'grade-bypass', label: grade() && !grade().on ? 'Grade: turn the node grade back on (A)' : 'Grade: bypass the node grade (B)', kbd: 'B', run: go(() => setBypass(!!(grade() && grade().on))), kw: 'compare a/b colour' },
    ...G.TYPE_IDS.map(t => ({ id: 'grade-add-' + t, label: `Grade: add ${G.TYPES[t].name} node`, run: go(() => { addNode(t); render(); }), kw: 'colour node ' + G.TYPES[t].hint })),
    { id: 'grade-import', label: 'Grade: import LUT…', run: go(() => pickFile(null)), kw: 'cube 3dl hald colour' },
    { id: 'grade-export', label: 'Grade: export .cube (33³)', run: go(downloadCube), kw: 'lut bake colour' },
    ...S.MODES.map(m => ({ id: 'scope-' + m.id, label: `Scopes: ${m.l}`, run: go(() => { st.mode = m.id; savePrefs(); syncScopeUi(); st.scopeKey = ''; runScope(!a.stage.playing); }), kw: 'scope colour' })),
  ];
}
if (typeof __m_shell !== 'undefined') __m_shell.use({ id: 'grade', name: 'Grade', icon: ICON, init, panel, tick, commands });

// Test / automation surface.
return { st, get scopes() { return scopes; }, runScope, exportCube, bake, useLut, importFile, addNode, vary, render, curveAt };

})();

