// AgentMotif Screening Room — runs a kit through Motif's SDK 4 kit-gl runtime: styles, effects (over a chosen style),
// transitions (between two styles) and sequences (the app's planner + blend modes). Startup follows the research's
// lifecycle: pending compiles are polled (never treated as failure), stale entries are ignored, a deadline offers Retry,
// and context loss stops drawing until every program and target is rebuilt on restore.
(() => {
  const $ = id => document.getElementById(id);
  const over = $('over');
  const say = (msg, retry) => { over.hidden = false; over.textContent = msg; if (retry) { const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = 'Retry'; b.addEventListener('click', retry); over.appendChild(document.createElement('br')); over.appendChild(b); } };
  const v = KG.validateKit(KIT.manifest, KIT.files);
  if (!v.ok) { say('Kit failed validation:\n' + v.errors.join('\n')); return; }
  const kit = v.kit, raw = KIT.manifest, V4 = KG.v4, TA = KG.textAtlas;
  const entries = KG.renderables(kit);
  const styles = entries.filter(e => e.kind === 'style' || !e.kind);
  const seqs = (kit.sequences || []).map(q => ({ kind: 'sequence', id: kit.id + '/seq/' + q.id, localId: 'seq-' + q.id, name: q.name || q.id, seq: q, blurb: `${q.cues.length} cues over a ${q.loop || 6} s loop, at most ${q.maxActive} at once, planned and blended exactly as Motif's Sequencer layer does.`, params: {} }));
  const all = [...entries, ...seqs];
  const rt = KG.createGlRuntime();
  if (!rt.ok) { say('WebGL2 is not available in this browser, so the live stage cannot run.'); return; }
  window.__am = { rt }; // debug handle (context-loss tests)
  const view = $('view'), ctx = view.getContext('2d');
  const S = { i: 0, playing: true, t: 0, last: performance.now(), L: 8, tempo: 1, scale: 0.75, seed: 417, pal: {}, vals: {}, text: {}, lost: false, fps: 0, started: {}, fxSource: 'silk-aurora', trFrom: 'liquid-chrome', trTo: 'cellspace' };
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, x) { try { localStorage.setItem(k, x); } catch (e) { /* storage unavailable */ } } };
  const defaults = st => Object.fromEntries(Object.entries(st.params || {}).map(([k, s]) => [k, s.def]));
  all.forEach(st => { S.vals[st.id] = defaults(st); });
  const palOf = st => S.pal[st.id] || kit.palettes.find(p => p.id === st.palette) || kit.palettes[0];
  const byLocal = id => styles.find(s => s.localId === id);
  const byId = new Map(styles.map(s => [s.id, s]));

  // ---- lifecycle: compile state per entry, polled every frame -----------------------------------------------
  const DEADLINE = 20000;
  function ensure(st) {
    const r = rt.compile(st.id, { passes: st.passes, common: kit.common, params: st.params, inputs: st.inputs || [], ...(st.runtime || {}) });
    if (r.pending) { rt.poll(); if (!S.started[st.id]) S.started[st.id] = performance.now(); return performance.now() - S.started[st.id] > DEADLINE ? 'slow' : 'pending'; }
    delete S.started[st.id];
    return r.ok ? 'ok' : (r.error || 'Shader failed to compile.');
  }
  function retry(st) { rt.forget(st.id); delete S.started[st.id]; over.hidden = true; }
  rt.on(ev => {
    if (ev.type === 'lost') { S.lost = true; say('The GPU context was lost. Waiting for the browser to restore it…'); }
    if (ev.type === 'restored') { S.lost = false; S.started = {}; over.hidden = true; } // the runtime cleared programs and targets; ensure() recompiles
  });

  // ---- reel ---------------------------------------------------------------------------------------------------
  const reel = $('reel');
  const sections = [['Styles', e => e.kind === 'style' || !e.kind], ['Effect', e => e.kind === 'effect'], ['Transition', e => e.kind === 'transition'], ['Sequence', e => e.kind === 'sequence']];
  const buttons = [];
  for (const [title, f] of sections) {
    const list = all.map((e, i) => [e, i]).filter(([e]) => f(e)); if (!list.length) continue;
    const h = document.createElement('h3'); h.textContent = title; reel.appendChild(h);
    for (const [e, i] of list) {
      const b = document.createElement('button'); b.type = 'button';
      const badges = [(e.inputs || []).some(q => q.type === 'text') ? 'TEXT' : '', (e.inputs || []).some(q => q.type === 'media' || q.type === 'image' || q.type === 'video') ? 'MEDIA' : ''].filter(Boolean).map(x => ` <span class="badge">${x}</span>`).join('');
      b.innerHTML = `<span class="nm">${e.name}${badges}</span><span class="grp">${e.group || (e.kind === 'sequence' ? 'Sequencer' : '')}</span>`;
      b.addEventListener('click', () => select(i)); reel.appendChild(b); buttons[i] = b;
    }
  }

  // ---- palettes ----------------------------------------------------------------------------------------------
  function drawPals() {
    const box = $('pals'); box.innerHTML = ''; const st = all[S.i]; if (st.kind === 'sequence') return; const cur = palOf(st);
    kit.palettes.forEach(p => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pal'; b.title = p.name; b.setAttribute('aria-label', 'Palette ' + p.name); b.setAttribute('aria-pressed', String(p === cur));
      [p.bg, p.a[0], p.a[1], p.a[2], p.ink].forEach(c => { const s = document.createElement('span'); s.style.background = c; b.appendChild(s); });
      b.addEventListener('click', () => { S.pal[st.id] = p; drawPals(); }); box.appendChild(b);
    });
  }

  // ---- inspector ---------------------------------------------------------------------------------------------
  const hex = (r, g, b) => '#' + [r, g, b].map(x => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('');
  function visible(spec, vals) { const c = spec.show; if (!c) return true; const x = vals[c.param]; if ('is' in c) return Array.isArray(c.is) ? c.is.includes(x) : x === c.is; if ('not' in c) return Array.isArray(c.not) ? !c.not.includes(x) : x !== c.not; if ('gt' in c) return x > c.gt; if ('lt' in c) return x < c.lt; return true; }
  const fmt = (s, x) => (s.type === 'int' ? String(x) : (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(Math.abs(x) < 0.1 && x !== 0 ? 3 : 2))) + (s.unit ? (s.unit.length > 1 ? ' ' : '') + s.unit : '');
  function rawSpec(st) {
    const list = st.kind === 'effect' ? raw.effects : st.kind === 'transition' ? raw.transitions : raw.styles;
    const r = (list || []).find(x => kit.id + '/' + x.id === st.id); return r ? r.params || {} : {};
  }
  function group(title, open) { const d = document.createElement('details'); d.className = 'grp'; d.open = open; const sm = document.createElement('summary'); sm.textContent = title; d.appendChild(sm); const rows = document.createElement('div'); rows.className = 'rows'; d.appendChild(rows); $('insp').appendChild(d); return rows; }
  function pickRow(rows, label, id, value, onChange) {
    const row = document.createElement('div'); row.className = 'row'; const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = label;
    const sel = document.createElement('select'); sel.id = id; styles.forEach(s => { const o = document.createElement('option'); o.value = s.localId; o.textContent = s.name; sel.appendChild(o); }); sel.value = value;
    sel.addEventListener('change', () => onChange(sel.value)); row.append(lab, sel); rows.appendChild(row);
  }
  function drawInspector() {
    const insp = $('insp'); insp.querySelectorAll('details').forEach(d => d.remove());
    const st = all[S.i];
    if (st.kind === 'effect') pickRow(group('Source', true), 'Effect applied to', 'fx-src', S.fxSource, x => { S.fxSource = x; });
    if (st.kind === 'transition') { const r = group('Shots', true); pickRow(r, 'From', 'tr-from', S.trFrom, x => { S.trFrom = x; }); pickRow(r, 'To', 'tr-to', S.trTo, x => { S.trTo = x; }); }
    for (const q of (st.inputs || []).filter(q => q.type === 'text')) {
      const rows = group(q.label || 'Text', true); const state = S.text[st.id] || (S.text[st.id] = {});
      q.lines.forEach(l => {
        const row = document.createElement('div'); row.className = 'row'; const id = `t-${st.localId}-${l.id}`;
        const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = l.label || l.id;
        const inp = document.createElement('input'); inp.type = 'text'; inp.id = id; inp.maxLength = l.maxLength || 64; inp.value = state[l.id] != null ? state[l.id] : l.def;
        inp.addEventListener('input', () => { state[l.id] = inp.value.replace(/[\u0000-\u001f]/g, ''); }); row.append(lab, inp); rows.appendChild(row);
      });
    }
    if (st.kind === 'sequence') { const r = group('Sequence', true); const n = document.createElement('div'); n.className = 'hint'; n.textContent = st.seq.cues.map(c => `${(byId.get(c.style) || { name: c.style }).name} @ ${(c.at * (st.seq.loop || 6)).toFixed(1)} s`).join(' · '); r.appendChild(n); return; }
    const rs = rawSpec(st), vals = S.vals[st.id], groups = new Map(), rowsByKey = {};
    for (const [k, spec] of Object.entries(rs)) { const g = spec.group || 'Style'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push([k, spec]); }
    for (const [g, items] of groups) {
      const rows = group(g, g !== 'Quality');
      for (const [k, spec] of items) {
        const row = document.createElement('div'); row.className = 'row'; const id = `p-${st.localId}-${k}`; rowsByKey[k] = row;
        const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = spec.label || k; if (spec.hint) lab.title = spec.hint;
        const out = document.createElement('output');
        if (spec.type === 'range' || spec.type === 'int') {
          const inp = document.createElement('input'); inp.type = 'range'; inp.id = id; const lg = spec.type === 'range' && spec.log && spec.min > 0;
          const to = x => lg ? Math.log(x / spec.min) / Math.log(spec.max / spec.min) * 1000 : x, from = u => lg ? spec.min * Math.pow(spec.max / spec.min, u / 1000) : +u;
          if (lg) { inp.min = 0; inp.max = 1000; inp.step = 1; } else { inp.min = spec.min; inp.max = spec.max; inp.step = spec.type === 'int' ? 1 : (spec.step || (spec.max - spec.min) / 500); }
          inp.value = to(vals[k]); out.textContent = fmt(spec, vals[k]);
          inp.addEventListener('input', () => { let x = from(inp.value); if (spec.type === 'int') x = Math.round(x); vals[k] = x; out.textContent = fmt(spec, x); refreshShow(); });
          lab.appendChild(out); row.append(lab, inp);
        } else if (spec.type === 'toggle') {
          const w = document.createElement('label'); w.className = 'tog'; w.htmlFor = id; const inp = document.createElement('input'); inp.type = 'checkbox'; inp.id = id; inp.checked = !!vals[k];
          inp.addEventListener('change', () => { vals[k] = inp.checked; refreshShow(); }); w.append(inp, document.createTextNode(spec.label || k)); row.append(w);
        } else if (spec.type === 'select') {
          const sel = document.createElement('select'); sel.id = id;
          spec.options.forEach(o => { const v2 = typeof o === 'string' ? o : o.v; const op = document.createElement('option'); op.value = v2; op.textContent = typeof o === 'string' ? o : (o.l || o.v); sel.appendChild(op); });
          sel.value = vals[k]; sel.addEventListener('change', () => { vals[k] = sel.value; refreshShow(); }); row.append(lab, sel);
        } else if (spec.type === 'color') {
          const inp = document.createElement('input'); inp.type = 'color'; inp.id = id; inp.value = hex(vals[k + 'R'], vals[k + 'G'], vals[k + 'B']);
          inp.addEventListener('input', () => { const h = inp.value; vals[k + 'R'] = parseInt(h.slice(1, 3), 16) / 255; vals[k + 'G'] = parseInt(h.slice(3, 5), 16) / 255; vals[k + 'B'] = parseInt(h.slice(5, 7), 16) / 255; });
          row.append(lab, inp);
        } else if (spec.type === 'point') {
          row.append(lab);
          ['X', 'Y'].forEach(ax => { const inp = document.createElement('input'); inp.type = 'range'; inp.id = ax === 'X' ? id : id + 'Y'; inp.setAttribute('aria-label', (spec.label || k) + ' ' + ax); inp.min = spec.min ?? -1; inp.max = spec.max ?? 1; inp.step = 0.005; inp.value = vals[k + ax]; inp.addEventListener('input', () => { vals[k + ax] = +inp.value; out.textContent = vals[k + 'X'].toFixed(2) + ', ' + vals[k + 'Y'].toFixed(2); }); row.append(inp); });
          out.textContent = vals[k + 'X'].toFixed(2) + ', ' + vals[k + 'Y'].toFixed(2); lab.appendChild(out);
        }
        if (spec.hint) { const h = document.createElement('div'); h.className = 'hint'; h.textContent = spec.hint; row.appendChild(h); }
        rows.appendChild(row);
      }
    }
    function refreshShow() { for (const [k, spec] of Object.entries(rs)) if (rowsByKey[k]) rowsByKey[k].hidden = !visible(spec, vals); }
    refreshShow();
    const rr = group('Reset', true); const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.textContent = 'Restore defaults'; rr.appendChild(b);
    b.addEventListener('click', () => { S.vals[st.id] = defaults(st); delete S.pal[st.id]; delete S.text[st.id]; drawInspector(); drawPals(); });
  }
  function drawAbout() {
    const st = all[S.i]; const tags = (st.tags || []).map(t => `<span>#${t}</span>`).join('');
    const passes = st.kind === 'sequence' ? 'Sequencer: planner + canvas blend modes' : (st.graph && st.graph.passes ? st.graph.passes : st.passes || []).map(p => `${String(p.file || p.src || '').split('/').pop().replace('.glsl', '')}`).filter(Boolean).join(' → ');
    const kind = st.kind === 'effect' ? 'Effect · runs over another picture' : st.kind === 'transition' ? 'Transition · progress 0 shows From, 1 shows To' : st.kind === 'sequence' ? 'Sequence' : 'Style';
    $('about').innerHTML = `<h3>${st.name}</h3><p>${st.blurb || ''}</p><div class="tags">${tags}</div><div class="hint">${kind}${passes ? ' · ' + passes : ''}${(st.inputs || []).some(q => q.type === 'media') ? ' · drop a photo or clip on the stage' : ''}</div>`;
  }
  function select(i) {
    S.i = i; store.set('am-entry', all[i].localId);
    buttons.forEach((b, j) => b && b.setAttribute('aria-current', String(j === i)));
    over.hidden = true; drawPals(); drawInspector(); drawAbout();
  }

  // ---- media + text ------------------------------------------------------------------------------------------
  let mediaEl = null, mediaKey = '', baked = null, rev = 1; const bakeC = document.createElement('canvas'), bakeX = bakeC.getContext('2d');
  function bake(src, w, h) {
    const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height; if (!sw || !sh) return null;
    const ar = w / h; let cw = sw, ch = sh; if (sw / sh > ar) cw = sh * ar; else ch = sw / ar;
    const tw = Math.min(1920, Math.round(cw)), th = Math.round(tw * ch / cw); if (bakeC.width !== tw || bakeC.height !== th) { bakeC.width = tw; bakeC.height = th; }
    bakeX.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, tw, th); return { canvas: bakeC, rev: ++rev, w: sw, h: sh, time: src.currentTime || 0 };
  }
  function setMedia(file) {
    if (!file) return; const url = URL.createObjectURL(file);
    if (file.type.startsWith('video')) { const vd = document.createElement('video'); vd.src = url; vd.muted = true; vd.loop = true; vd.playsInline = true; vd.play().catch(() => {}); mediaEl = vd; } else { const im = new Image(); im.src = url; mediaEl = im; }
    mediaKey = ''; $('mediaClear').hidden = false;
  }
  $('mediaBtn').addEventListener('click', () => $('mediaIn').click());
  $('mediaIn').addEventListener('change', e => setMedia(e.target.files[0]));
  $('mediaClear').addEventListener('click', () => { mediaEl = null; baked = null; $('mediaClear').hidden = true; });
  const stage = $('stage');
  stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('drag'); });
  stage.addEventListener('dragleave', () => stage.classList.remove('drag'));
  stage.addEventListener('drop', e => { e.preventDefault(); stage.classList.remove('drag'); setMedia(e.dataTransfer.files[0]); });
  function inputsFor(st, w, h) {
    const ins = st.inputs || []; if (!ins.length) return null; const m = {};
    for (const q of ins) {
      if (q.type === 'svg' || q.type === 'sdf') continue;
      if (q.type === 'text') { const txt = S.text[st.id] || {}; m[q.id] = TA.atlasFor(q, { lines: Object.fromEntries(q.lines.map(l => [l.id, { text: txt[l.id] != null ? txt[l.id] : l.def }])) }, Math.max(w, 1024), 'stage-' + st.localId); continue; }
      if (mediaEl) { const key = w + 'x' + h; if (mediaEl.tagName === 'VIDEO' || key !== mediaKey || !baked) { const b = bake(mediaEl, w, h); if (b) { baked = b; mediaKey = key; } } if (baked) m[q.id] = baked; }
    }
    Object.assign(m, V4.resolveSvg(ins, { w, h }) || {}, V4.resolveTextSdf(ins, m, { w, h }) || {});
    return m;
  }

  // ---- drawing -----------------------------------------------------------------------------------------------
  const offs = [0, 1].map(() => { const c = document.createElement('canvas'); return { c, x: c.getContext('2d'), rev: 1 }; });
  function drawStyle(st, w, h, p, L, target, params) {
    rt.draw(st.id, w, h, { p, L, seed: S.seed, safe: true, pal: palOf(st), params: params || S.vals[st.id], spec: st.params, media: inputsFor(st, w, h) });
    if (target) { if (target.c.width !== w || target.c.height !== h) { target.c.width = w; target.c.height = h; } target.x.fillStyle = palOf(st).bg; target.x.fillRect(0, 0, w, h); rt.blit(target.x, w, h); target.rev++; return { canvas: target.c, rev: target.rev, w, h, time: 0 }; }
    return null;
  }
  // Returns null when ready and drawn, or a status string ('pending', 'slow' or an error) to show.
  function render(st, w, h, p, L) {
    if (st.kind === 'sequence') {
      const plan = V4.planSequence(st.seq, p, { L: st.seq.loop || 6, seed: S.seed, maxActive: st.seq.maxActive });
      for (const a of plan.active) { const s2 = byId.get(a.cue.style); if (!s2) continue; const r = ensure(s2); if (r !== 'ok') return r === 'pending' || r === 'slow' ? r : s2.name + ': ' + r; }
      const pal0 = kit.palettes[0]; ctx.fillStyle = pal0.bg; ctx.fillRect(0, 0, w, h);
      for (const a of plan.active) {
        const s2 = byId.get(a.cue.style); if (!s2) continue; const params = { ...defaults(s2), ...(a.cue.params || {}) };
        rt.draw(s2.id, w, h, { p: a.innerP, L: a.innerL, seed: a.cue.seed || S.seed, safe: true, pal: palOf(s2), params, spec: s2.params, media: inputsFor(s2, w, h) });
        ctx.save(); ctx.globalCompositeOperation = V4.BLEND_CANVAS[a.cue.blend] || 'source-over'; ctx.globalAlpha = a.alpha; rt.blit(ctx, w, h); ctx.restore();
      }
      return null;
    }
    const need = [st]; if (st.kind === 'effect') need.push(byLocal(S.fxSource)); if (st.kind === 'transition') need.push(byLocal(S.trFrom), byLocal(S.trTo));
    for (const e of need) { if (!e) continue; const r = ensure(e); if (r !== 'ok') return r === 'pending' || r === 'slow' ? r : (e === st ? r : e.name + ': ' + r); }
    let ext = null, progress = p;
    if (st.kind === 'effect') ext = { input: drawStyle(byLocal(S.fxSource), w, h, p, L, offs[0]) };
    if (st.kind === 'transition') {
      // Hold From, transition, hold To, transition back: one loop shows both directions and both exact endpoints.
      const seg = (a, b) => Math.min(1, Math.max(0, (p - a) / (b - a))), ease = x => x * x * (3 - 2 * x);
      progress = p < 0.5 ? ease(seg(0.15, 0.4)) : 1 - ease(seg(0.65, 0.9));
      ext = { from: drawStyle(byLocal(S.trFrom), w, h, p, L, offs[0]), to: drawStyle(byLocal(S.trTo), w, h, p, L, offs[1]) };
    }
    rt.draw(st.id, w, h, { p, L, seed: S.seed, safe: true, pal: palOf(st), params: S.vals[st.id], spec: st.params, media: inputsFor(st, w, h), ext, progress });
    ctx.fillStyle = palOf(st).bg; ctx.fillRect(0, 0, w, h); rt.blit(ctx, w, h);
    S.progress = st.kind === 'transition' ? progress : null;
    return null;
  }

  // ---- transport ---------------------------------------------------------------------------------------------
  const play = $('play'), scrub = $('scrub');
  play.addEventListener('click', () => { S.playing = !S.playing; play.textContent = S.playing ? 'Pause' : 'Play'; });
  scrub.addEventListener('input', () => { S.playing = false; play.textContent = 'Play'; S.t = (+scrub.value / 1000) * loopLen(); });
  $('loopLen').addEventListener('change', e => { S.L = Math.max(1, +e.target.value || 8); });
  $('tempo').addEventListener('change', e => { S.tempo = +e.target.value; });
  $('res').addEventListener('change', e => { S.scale = +e.target.value; });
  $('seed').addEventListener('change', e => { S.seed = Math.max(1, Math.min(9999, Math.round(+e.target.value) || 1)); });
  document.addEventListener('keydown', e => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); play.click(); } });
  document.addEventListener('visibilitychange', () => { S.last = performance.now(); }); // no time jump after a hidden tab
  const loopLen = () => { const st = all[S.i]; return (st.kind === 'sequence' ? (st.seq.loop || S.L) : S.L) / S.tempo; };

  let frames = 0, fpsT = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (document.hidden || S.lost) return;                                   // no work while hidden or without a context
    const dt = Math.min(0.1, (now - S.last) / 1000); S.last = now; if (S.playing) S.t += dt;
    const st = all[S.i], L = loopLen(); const p = ((S.t / L) % 1 + 1) % 1; if (S.playing) scrub.value = Math.round(p * 1000);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(64, Math.round(stage.clientWidth * dpr * S.scale)), h = Math.max(36, Math.round(w * 9 / 16));
    if (view.width !== w || view.height !== h) { view.width = w; view.height = h; }
    const status = render(st, w, h, p, L);
    if (status === 'pending') { say('Preparing ' + st.name + '… (compiling in the background)'); return; }
    if (status === 'slow') { say('Still preparing ' + st.name + ' after 20 s. Your GPU may be busy.', () => { [st, byLocal(S.fxSource), byLocal(S.trFrom), byLocal(S.trTo)].forEach(e => e && retry(e)); }); return; }
    if (status) { say('Compile error\n' + status); return; }
    over.hidden = true;
    frames++; if (now - fpsT > 500) { S.fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; }
    $('hud').textContent = `${w}×${h} · ${S.fps.toFixed(0)} fps · p ${p.toFixed(3)}${S.progress != null ? ' · progress ' + S.progress.toFixed(2) : ''} · loop ${L.toFixed(1)} s${rt.software ? ' · software GL' : ''}`;
  }
  const want = location.hash.slice(1) || store.get('am-entry') || 'silk-aurora';
  const start = all.findIndex(e => e.localId === want);
  select(start >= 0 ? start : 0);
  window.addEventListener('hashchange', () => { const j = all.findIndex(e => e.localId === location.hash.slice(1)); if (j >= 0) select(j); });
  requestAnimationFrame(tick);
})();
