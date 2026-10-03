  // ---------- sequencer layer (motif-kit@4) ----------
  // A Sequencer layer holds a cue list (layer.seq). Each cue invokes a style from the library for part of the loop, so one layer can
  // use dozens of looks while never running more than `maxActive` shaders at once. The compositor renders it (see renderSequencer);
  // this is its inspector: a lane timeline (drag to move, drag an edge to resize, arrow keys when focused), a cue list and a cue editor.
  const KV = __m_kit_v4;
  let seqSel = null, seqDrag = null;
  const SQ_LH = 56, SQ_W = 1000, SQ_SNAP = 1 / 32; // svg user units: the timeline scales to the panel width, keeping its aspect
  { const st = document.createElement('style'); st.textContent = `
    .seqtl{display:block;width:100%;height:auto;background:var(--surface-0);border:var(--hairline) solid var(--grid);border-radius:var(--radius-sm,6px);touch-action:none;user-select:none}
    .seqtl .lane{fill:none;stroke:var(--grid);stroke-width:2}.seqtl .lane:nth-of-type(odd){fill:var(--surface-1,transparent)}
    .seqtl .cue{fill:var(--lc);fill-opacity:.78;stroke:var(--lc);cursor:grab}.seqtl .cue.mute{fill-opacity:.2;stroke-dasharray:4 3}
    .seqtl .cue.sel{stroke:var(--text);stroke-width:4;fill-opacity:.95}.seqtl g:focus-visible .cue{stroke:var(--text);stroke-width:5}.seqtl g:focus{outline:none}
    .seqtl .cl{fill:var(--bg,#000);font:600 24px var(--font-ui);pointer-events:none}.seqtl .head{stroke:var(--accent);stroke-width:4;pointer-events:none}
    .sqmeter{font-size:var(--text-xs);color:var(--text-dim,var(--text))}.sqmeter[data-over="true"]{color:var(--danger,#ff6b6b);font-weight:600}
    .sqlist{list-style:none;margin:var(--space-2) 0;padding:0;display:grid;gap:2px}
    .sqlist button{width:100%;display:flex;gap:var(--space-2);align-items:center;text-align:left;padding:4px 8px;border-radius:6px;border:var(--hairline) solid transparent;background:transparent;color:var(--text);font:var(--text-sm) var(--font-ui);cursor:pointer}
    .sqlist button[aria-pressed="true"]{border-color:var(--accent);background:var(--surface-1,transparent)}.sqlist i{width:10px;height:10px;border-radius:3px;background:var(--lc);flex:none}
    .sqlist .m{margin-left:auto;color:var(--text-dim,var(--text));font-size:var(--text-xs)}.sqlist [data-missing="true"] .nm{text-decoration:line-through;opacity:.6}
    .sqcard{display:grid;gap:6px;margin-top:var(--space-2)}.sqcard .r{display:grid;grid-template-columns:96px 1fr 56px;gap:8px;align-items:center}.sqcard label{font-size:var(--text-xs)}
    .sqcard select,.sqcard input[type=number]{min-width:0;width:100%}.sqcard input[type=range]{width:100%}.sqcard .pp{border-top:var(--hairline) solid var(--grid);padding-top:6px;margin-top:2px}`; document.head.appendChild(st); }
  const seqCol = i => `var(--clip-${i % 4 + 1})`, seqPct = v => `${Math.round(v * 100)}%`;
  const seqOf = l => (l && l.seq) || T.newLayer('sequencer').seq;
  const seqStyleOptions = sel => CATEGORIES.map(cat => {
    const items = STYLES.filter(s => s.category === cat.id && s.id !== 'sequencer'); if (!items.length) return '';
    return `<optgroup label="${esc(cat.name)}">${items.map(s => `<option value="${esc(s.id)}"${s.id === sel ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`;
  }).join('');
  function sequencerHtml(l) {
    const seq = seqOf(l), an = KV.analyzeSequence(seq), lanes = Math.min(KV.SEQ.lanes, Math.max(3, seq.cues.reduce((m, c) => Math.max(m, c.lane), 0) + 2)), H = lanes * SQ_LH;
    if (seqSel && !seq.cues.some(c => c.id === seqSel)) seqSel = null;
    if (openGroups.sequencer === undefined) openGroups.sequencer = true;
    const cues = seq.cues.map(c => {
      const segs = c.at + c.len > 1 + 1e-9 ? [[c.at, 1 - c.at], [0, c.at + c.len - 1]] : [[c.at, c.len]], st = getStyle(c.style), miss = !STYLES.some(s => s.id === c.style);
      const rects = segs.map(([a, w], k) => `<rect class="cue${c.mute ? ' mute' : ''}${c.id === seqSel ? ' sel' : ''}" x="${(a * SQ_W).toFixed(1)}" y="${c.lane * SQ_LH + 5}" width="${Math.max(6, w * SQ_W).toFixed(1)}" height="${SQ_LH - 10}" rx="8"/>`).join('');
      return `<g role="button" tabindex="0" data-cue="${esc(c.id)}" style="--lc:${seqCol(c.lane)}" aria-pressed="${c.id === seqSel}" aria-label="${esc(`${miss ? 'Missing style' : st.name}, lane ${c.lane + 1}, ${seqPct(c.at)} to ${seqPct((c.at + c.len) % 1 || 1)}${c.mute ? ', muted' : ''}`)}">${rects}<text class="cl" x="${(c.at * SQ_W + 14).toFixed(1)}" y="${c.lane * SQ_LH + SQ_LH / 2 + 8}">${esc(miss ? '?' : st.name).slice(0, 18)}</text></g>`;
    }).join('');
    const laneRows = Array.from({ length: lanes }, (_, i) => `<rect class="lane" x="0" y="${i * SQ_LH}" width="${SQ_W}" height="${SQ_LH}"/>`).join('');
    const grid = Array.from({ length: 7 }, (_, i) => `<line x1="${(i + 1) * SQ_W / 8}" x2="${(i + 1) * SQ_W / 8}" y1="0" y2="${H}" stroke="var(--grid)" stroke-width="2" stroke-dasharray="4 10"/>`).join('');
    const list = seq.cues.map(c => { const st = getStyle(c.style), miss = !STYLES.some(s => s.id === c.style); return `<li><button data-sqpick="${esc(c.id)}" aria-pressed="${c.id === seqSel}" data-missing="${miss}" style="--lc:${seqCol(c.lane)}"><i></i><span class="nm">${esc(miss ? c.style : st.name)}</span><span class="m">${seqPct(c.at)}–${seqPct((c.at + c.len) % 1 || 1)}${c.mute ? ' · muted' : ''}${c.chance < 1 ? ' · ' + seqPct(c.chance) : ''}</span></button></li>`; }).join('');
    const kitSeqs = K.sequences ? K.sequences() : [];
    const load = `<select data-sq="load" aria-label="Load a sequence"><option value="">Load a sequence…</option><option value="~starter">Starter</option>${kitSeqs.map(s => `<option value="${esc(s.kit + ':' + s.seq.id)}">${esc(s.kitName)} · ${esc(s.seq.name || s.seq.id)}</option>`).join('')}</select>`;
    const over = an.peak > seq.maxActive;
    return group('sequencer', 'Sequencer · cues', `
      <p class="info">Each cue plays a style for part of the loop. Only ${seq.maxActive} run at once, however many cues you add.</p>
      <svg class="seqtl" id="seqTl" viewBox="0 0 ${SQ_W} ${H}" role="group" aria-label="Cue timeline, one loop wide. On a focused cue: Left and Right move it, Shift with them resizes it, Up and Down change its lane, Delete removes it." >${laneRows}${grid}${cues}<line class="head" id="seqHead" x1="0" x2="0" y1="0" y2="${H}"/></svg>
      <div class="sqmeter" data-over="${over}" role="status">${an.styles.length} style${an.styles.length === 1 ? '' : 's'} · ${an.peak} at once (max ${seq.maxActive})${over ? ' · too many overlap: move or shorten a cue' : ''}</div>
      <div class="btnrow"><button class="btn sm" data-sq="add">+ Cue</button>${load}<button class="btn sm" data-sq="copy" title="Copy this sequence as JSON, ready for a kit's sequences/ folder">Copy JSON</button></div>
      <ul class="sqlist" aria-label="Cues">${list}</ul>${seqCardHtml(seq)}`);
  }
  function seqCardHtml(seq) {
    const c = seq.cues.find(x => x.id === seqSel); if (!c) return seq.cues.length ? '<p class="info">Select a cue to edit it.</p>' : '<p class="info">No cues yet. Add one.</p>';
    const row = (lab, id, ctl, val) => `<div class="r"><label for="sq-${id}">${lab}</label>${ctl}<span class="rv" id="sq-${id}-v" aria-hidden="true">${val == null ? '' : val}</span></div>`;
    const rng = (f, lo, hi, step, fmt) => row(f.label, f.k, `<input type="range" id="sq-${f.k}" data-sqf="${f.k}" min="${lo}" max="${hi}" step="${step}" value="${c[f.k]}">`, fmt(c[f.k]));
    const sel = (f, opts) => row(f.label, f.k, `<select id="sq-${f.k}" data-sqf="${f.k}">${opts.map(([v, l]) => `<option value="${v}"${String(c[f.k]) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`);
    const st = getStyle(c.style), sp = Object.entries(st.params || {}).filter(([, p]) => ['range', 'int', 'toggle', 'select'].includes(p.type) && !p.part).slice(0, 24);
    const pv = (k, p) => (k in c.params ? c.params[k] : p.def);
    const prow = ([k, p]) => {
      const id = `sqp-${k}`, v = pv(k, p), lab = `<label for="${id}">${esc(p.label || k)}</label>`;
      if (p.type === 'toggle') return `<div class="r">${lab}<input type="checkbox" id="${id}" data-sqp="${k}"${v ? ' checked' : ''}><span></span></div>`;
      if (p.type === 'select') return `<div class="r">${lab}<select id="${id}" data-sqp="${k}">${p.options.map(o => `<option value="${esc(o.v)}"${o.v === v ? ' selected' : ''}>${esc(o.l)}</option>`).join('')}</select><span></span></div>`;
      return `<div class="r">${lab}<input type="range" id="${id}" data-sqp="${k}" data-pt="${p.type}" min="${p.min}" max="${p.max}" step="${p.step || (p.type === 'int' ? 1 : 0.01)}" value="${v}"><span class="rv" id="${id}-v" aria-hidden="true">${typeof v === 'number' ? +v.toFixed(3) : v}</span></div>`;
    };
    return `<div class="sqcard" role="group" aria-label="Cue editor">
      <div class="r"><label for="sq-style">Style</label><select id="sq-style" data-sqf="style">${seqStyleOptions(c.style)}</select><span></span></div>
      ${rng({ label: 'Start', k: 'at' }, 0, 0.995, 0.005, seqPct)}${rng({ label: 'Length', k: 'len' }, 0.01, 1, 0.005, seqPct)}
      ${sel({ label: 'Lane', k: 'lane' }, Array.from({ length: KV.SEQ.lanes }, (_, i) => [i, `Lane ${i + 1}`]))}
      ${sel({ label: 'Plays', k: 'cycles' }, Array.from({ length: KV.SEQ.cycles }, (_, i) => [i + 1, `${i + 1}× per cue`]))}
      ${sel({ label: 'Direction', k: 'dir' }, KV.PLAY_MODES.map((v, i) => [v, KV.PLAY_LABELS[i]]))}
      ${sel({ label: 'Blend', k: 'blend' }, KV.BLEND_MODES.map((v, i) => [v, KV.BLEND_LABELS[i]]))}
      ${rng({ label: 'Opacity', k: 'opacity' }, 0, 1, 0.01, seqPct)}${rng({ label: 'Fade in', k: 'fadeIn' }, 0, 0.5, 0.01, seqPct)}${rng({ label: 'Fade out', k: 'fadeOut' }, 0, 0.5, 0.01, seqPct)}
      ${rng({ label: 'Chance', k: 'chance' }, 0, 1, 0.05, seqPct)}
      <div class="r"><label for="sq-seed">Seed</label><input type="number" id="sq-seed" data-sqf="seed" min="0" max="9999" step="1" value="${c.seed}" aria-describedby="sq-seed-h"><span></span></div><p class="info" id="sq-seed-h">0 uses the layer's seed.</p>
      <div class="r"><label for="sq-mute">Muted</label><input type="checkbox" id="sq-mute" data-sqf="mute"${c.mute ? ' checked' : ''}><span></span></div>
      <div class="btnrow"><button class="btn sm" data-sq="dup">Duplicate</button><button class="btn sm" data-sq="del">Delete cue</button>${Object.keys(c.params).length ? '<button class="btn sm" data-sq="resetp">Reset style settings</button>' : ''}</div>
      ${sp.length ? `<div class="pp"><div class="lbl">${esc(st.name)} settings</div>${sp.map(prow).join('')}</div>` : ''}</div>`;
  }
  function seqMutate(fn, msg, isLive) {
    const next = clone(project), nl = T.layerById(next, active().id); if (!nl) return null;
    nl.seq = KV.sanitizeSeq(nl.seq) || T.newLayer('sequencer').seq; fn(nl.seq);
    if (isLive) { nl.seq = KV.sanitizeSeq(nl.seq); live(next); } else commit(next, msg);
    return nl.seq;
  }
  const snapQ = (v, on) => (on ? Math.round(v / SQ_SNAP) * SQ_SNAP : v);
  function updateSeqHead(t) {
    const h = document.getElementById('seqHead'); if (!h || tab !== 'layer') return;
    const l = active(); if (!l || l.styleId !== 'sequencer') return;
    const L = project.finish.loop, sh = l.shared || {}, x = (((t / L) * (sh.tempo || 1) + (sh.phase || 0)) % 1 + 1) % 1 * SQ_W;
    h.setAttribute('x1', x.toFixed(1)); h.setAttribute('x2', x.toFixed(1));
  }
  const tlPanel = $('panel-layer');
  tlPanel.addEventListener('click', e => {
    const pick = e.target.closest('[data-sqpick]'); if (pick) { seqSel = pick.dataset.sqpick; renderLayerPanel(); return; }
    const btn = e.target.closest('[data-sq]'); if (!btn || btn.tagName === 'SELECT') return; const act = btn.dataset.sq;
    if (act === 'add') seqMutate(s => { if (s.cues.length >= KV.SEQ.cues) return; const used = new Set(s.cues.map(c => c.style)); const st = STYLES.find(x => x.id !== 'sequencer' && !used.has(x.id)) || STYLES.find(x => x.id !== 'sequencer'); const id = 'c' + (s.cues.reduce((m, c) => Math.max(m, parseInt(String(c.id).slice(1)) || 0), 0) + 1); s.cues.push({ id, style: st.id, at: 0, len: 0.25, lane: 0, fadeIn: 0.1, fadeOut: 0.1, cycles: 1, dir: 'forward', blend: 'normal', opacity: 1, chance: 1, mute: false, seed: 0, palette: null, params: {}, label: '' }); seqSel = id; }, 'Cue added');
    else if (act === 'del' && seqSel) seqMutate(s => { s.cues = s.cues.filter(c => c.id !== seqSel); seqSel = null; }, 'Cue deleted');
    else if (act === 'dup' && seqSel) seqMutate(s => { const c = s.cues.find(x => x.id === seqSel); if (!c || s.cues.length >= KV.SEQ.cues) return; const id = 'c' + (s.cues.reduce((m, x) => Math.max(m, parseInt(String(x.id).slice(1)) || 0), 0) + 1); s.cues.push({ ...clone(c), id, at: (c.at + c.len) % 1 }); seqSel = id; }, 'Cue duplicated');
    else if (act === 'resetp' && seqSel) seqMutate(s => { const c = s.cues.find(x => x.id === seqSel); if (c) c.params = {}; }, 'Style settings reset');
    else if (act === 'copy') { const s = seqOf(active()); const json = JSON.stringify({ format: KV.SEQ.format, id: s.id || 'my-sequence', name: s.name || 'My sequence', seed: s.seed, maxActive: s.maxActive, cues: s.cues.map(({ i, ...c }) => ({ ...c, params: Object.keys(c.params).length ? c.params : undefined })) }, null, 2); (navigator.clipboard ? navigator.clipboard.writeText(json) : Promise.reject()).then(() => toast('Sequence copied as JSON'), () => toast('Could not copy to the clipboard')); }
    else {
      const g = e.target.closest('[data-cue]'); if (g) { seqSel = g.dataset.cue; renderLayerPanel(); }
    }
  });
  tlPanel.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset && el.dataset.sq === 'load') {
      const v = el.value; el.value = ''; if (!v) return;
      const s = v === '~starter' ? T.newLayer('sequencer').seq : (() => { const [kid, sid] = v.split(':'); const hit = (K.sequences() || []).find(x => x.kit === kid && x.seq.id === sid); return hit && KV.sanitizeSeq(hit.seq); })();
      if (s) { seqSel = null; seqMutate(q => { q.cues = s.cues; q.name = s.name; q.id = s.id; q.seed = s.seed; q.maxActive = s.maxActive; }, `Loaded ${s.name || 'sequence'}`); }
    } else if (el.dataset && el.dataset.sqf && seqSel) {
      const k = el.dataset.sqf; seqMutate(s => { const c = s.cues.find(x => x.id === seqSel); if (!c) return; c[k] = el.type === 'checkbox' ? el.checked : (k === 'style' || k === 'dir' || k === 'blend') ? el.value : Number(el.value); if (k === 'style') c.params = {}; }, null);
    } else if (el.dataset && el.dataset.sqp && seqSel) {
      const k = el.dataset.sqp; seqMutate(s => { const c = s.cues.find(x => x.id === seqSel); if (!c) return; const p = (getStyle(c.style).params || {})[k]; if (!p) return; c.params[k] = el.type === 'checkbox' ? el.checked : p.type === 'select' ? el.value : p.type === 'int' ? Math.round(Number(el.value)) : Number(el.value); }, null);
    }
  });
  tlPanel.addEventListener('input', e => {
    const el = e.target; if (!el.dataset || !(el.dataset.sqf || el.dataset.sqp) || el.type !== 'range') return;
    const out = $(el.id + '-v'); const v = Number(el.value);
    if (el.dataset.sqf) { const k = el.dataset.sqf; if (out) out.textContent = seqPct(v); seqMutate(s => { const c = s.cues.find(x => x.id === seqSel); if (c) c[k] = v; }, null, true); }
    else { if (out) out.textContent = String(+v.toFixed(3)); const k = el.dataset.sqp; seqMutate(s => { const c = s.cues.find(x => x.id === seqSel); if (c) c.params[k] = el.dataset.pt === 'int' ? Math.round(v) : v; }, null, true); }
  });
  // Timeline: drag a cue to move it (and across lanes), drag its left or right edge to resize. Shift turns snapping off.
  tlPanel.addEventListener('pointerdown', e => {
    const tl = e.target.closest('#seqTl'); const g = e.target.closest('[data-cue]'); if (!tl || !g || e.button !== 0) return;
    const l = active(), s = seqOf(l), c = s.cues.find(x => x.id === g.dataset.cue); if (!c) return;
    const r = tl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, edge = Math.min(0.02, c.len * 0.3);
    const inCue = (x - c.at + 1) % 1, mode = inCue < edge ? 'start' : inCue > c.len - edge ? 'end' : 'move';
    seqSel = c.id; seqDrag = { id: c.id, mode, x0: e.clientX, y0: e.clientY, w: r.width, h: r.height, lanes: Math.max(1, Math.round(tl.viewBox.baseVal.height / SQ_LH)), at: c.at, len: c.len, lane: c.lane, moved: false, tl };
    try { tl.setPointerCapture(e.pointerId); } catch (er) { /* no capture: moves still arrive over the svg */ }
    e.preventDefault();
  });
  tlPanel.addEventListener('pointermove', e => {
    if (!seqDrag) return; const d = seqDrag, dx = (e.clientX - d.x0) / d.w; if (!d.moved && Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < 3) return; d.moved = true;
    const snap = !e.shiftKey, dl = (e.clientY - d.y0) / (d.h / d.lanes);
    seqMutate(s => {
      const c = s.cues.find(x => x.id === d.id); if (!c) return;
      if (d.mode === 'move') { c.at = ((snapQ(d.at + dx, snap) % 1) + 1) % 1; c.lane = Math.max(0, Math.min(KV.SEQ.lanes - 1, Math.round(d.lane + dl))); }
      else if (d.mode === 'end') c.len = Math.max(0.01, Math.min(1, snapQ(d.len + dx, snap)));
      else { const end = d.at + d.len, na = Math.min(end - 0.01, snapQ(d.at + dx, snap)); c.at = ((na % 1) + 1) % 1; c.len = Math.max(0.01, Math.min(1, end - na)); }
    }, null, true);
  });
  const endDrag = () => { if (!seqDrag) return; const d = seqDrag; seqDrag = null; if (d.moved) commit(clone(project), null); else renderLayerPanel(); };
  tlPanel.addEventListener('pointerup', endDrag); tlPanel.addEventListener('pointercancel', endDrag);
  tlPanel.addEventListener('keydown', e => {
    const g = e.target.closest && e.target.closest('[data-cue]'); if (!g) return; const id = g.dataset.cue;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); seqSel = id; renderLayerPanel(); const n = tlPanel.querySelector(`[data-cue="${CSS.escape(id)}"]`); if (n) n.focus(); return; }
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Backspace']; if (!keys.includes(e.key)) return; e.preventDefault(); e.stopPropagation(); seqSel = id; // the timeline's own keys must not also step the playhead or delete a layer
    seqMutate(s => {
      const c = s.cues.find(x => x.id === id); if (!c) return; const st = SQ_SNAP;
      if (e.key === 'Delete' || e.key === 'Backspace') { s.cues = s.cues.filter(x => x.id !== id); seqSel = null; }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const d = e.key === 'ArrowLeft' ? -st : st; if (e.shiftKey) c.len = Math.max(0.01, Math.min(1, c.len + d)); else c.at = (((c.at + d) % 1) + 1) % 1; }
      else c.lane = Math.max(0, Math.min(KV.SEQ.lanes - 1, c.lane + (e.key === 'ArrowDown' ? 1 : -1)));
    }, null);
    const n = tlPanel.querySelector(`[data-cue="${CSS.escape(id)}"]`); if (n) n.focus();
  });
