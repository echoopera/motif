# Inspector support for custom kit parameters (Motif 3.2): groups, hints, show/hide, colour picker, XY pad.
src = rep(src, "      ${group('style', 'Style', Object.keys(st.params).map(k => rowHtml(lpath('p', k))).join('') + '<div class=\"btnrow\"><button class=\"btn sm\" id=\"resetStyle\">Reset style parameters</button></div>')}",
               "      ${styleGroups(st)}")
src = rep(src, "  function renderLayerPanel() {", r"""  // ---- style parameters: grouped sections, colour / point compounds, show conditions ----
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
    const reset = '<div class="btnrow"><button class="btn sm" id="resetStyle">Reset style parameters</button></div>';
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
  function renderLayerPanel0() {""")

# events: colour input / pad / group key + lock, show refresh
src = rep(src, "    root.addEventListener('input', e => {\n      const el = e.target; if (!el.dataset || !el.dataset.path) return;",
r"""    const padMove = (el, e) => {
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
      if (!el.dataset || !el.dataset.path) return;""")
src = rep(src, "    root.addEventListener('change', e => { const el = e.target; if (!el.dataset || !el.dataset.path) return; const v = readInput(el); if (v === undefined) return; commit(applyValue(el.dataset.path, v)); });",
               "    root.addEventListener('change', e => { const el = e.target; if (el.dataset && el.dataset.comp === 'color') { commit(setComp(el, compVals(el))); return; } if (!el.dataset || !el.dataset.path) return; const v = readInput(el); if (v === undefined) return; commit(applyValue(el.dataset.path, v)); });")
src = rep(src, "      const kb = e.target.closest('[data-key]');\n      if (kb) toggleKey(kb.dataset.key);",
               "      const lc = e.target.closest('[data-lockc]');\n      if (lc) { const ps = lc.dataset.lockc.split(','), on = !ps.every(p => locks.has(p)); ps.forEach(p => on ? locks.add(p) : locks.delete(p)); lc.setAttribute('aria-pressed', on); lc.closest('.row').classList.toggle('locked', on); return; }\n      const kc = e.target.closest('[data-keyc]');\n      if (kc) { toggleKeyGroup(kc.dataset.keyc.split(',')); return; }\n      const kb = e.target.closest('[data-key]');\n      if (kb) toggleKey(kb.dataset.key);")
# animated refresh
src = rep(src, "    for (const path of new Set(paths)) {\n      const el = $(rid(path)); if (!el || el === document.activeElement) continue;",
               "    root.querySelectorAll('[data-comp]').forEach(el => { if (el === document.activeElement || el._drag) return; const ps = el.dataset.paths.split(','); const vs = ps.map(p => valueFromEval(ev, p)); if (vs.every(v => v !== undefined)) paintComp(el, vs); const kb = el.closest('.row').querySelector('.kb'); if (kb) { const ks = ps.map(keyState); kb.dataset.state = ks.every(x => x === 'on') ? 'on' : ks.some(x => x !== 'none') ? 'anim' : 'none'; } });\n    applyShow(root);\n    for (const path of new Set(paths)) {\n      const el = $(rid(path)); if (!el || el === document.activeElement) continue;")
