# Shell (workspace) patches for Motif 3. Runs inside build.py with `src` and `rep` in scope.
PLAY_SVG = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg>'
PAUSE_SVG = '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>'

src = rep(src, "// shell — the Style Lab 2 workspace:", "// shell — the Motif 3 workspace (finishing-suite layout):")

# timecode + readouts
src = rep(src, """    $('time').textContent = `${t.toFixed(2)} / ${L.toFixed(2)} s`;""", """    $('time').innerHTML = timecode(t) + `<small>/ ${timecode(L)}</small>`;""")
src = rep(src, """    $('frameRead').textContent = `f ${String(Math.floor(t * project.output.fps)).padStart(3, '0')}`;""",
               """    $('frameRead').textContent = `f ${String(Math.floor(t * project.output.fps + 1e-6)).padStart(3, '0')} / ${Math.round(L * project.output.fps)}`;
    updateGpuChip();""")
src = rep(src, "  // ---------- ticking ----------\n", """  // ---------- ticking ----------
  const pad2 = n => String(n).padStart(2, '0');
  function timecode(s) { const fps = project.output.fps; const f = Math.floor(s * fps + 1e-6); const ff = f % fps, ts = Math.floor(f / fps); return `${pad2(Math.floor(ts / 3600))}:${pad2(Math.floor(ts / 60) % 60)}:${pad2(ts % 60)}:${pad2(ff)}`; }
  // Kit shaders render at an adaptive internal scale on the stage; the page bar shows it.
  let gpuChipKey = '';
  function updateGpuChip() {
    const c = $('gpuChip'); if (!c) return;
    const kitLayers = project.layers.filter(l => l.visible !== false && getStyle(l.styleId).engine === 'glsl');
    const g = K.gpuStatus();
    let text, state, title;
    if (!g.ok) { text = 'Shaders off'; state = 'err'; title = 'WebGL2 is unavailable, so kit shader styles cannot render in this browser.'; }
    else if (g.lost) { text = 'GPU reset · recovering'; state = 'err'; title = 'The browser reset the GPU. Kit styles come back automatically at a lower render scale.'; }
    else if (!kitLayers.length) { text = 'Shaders idle'; state = ''; title = 'No kit shader style is on a visible layer.'; }
    else { const pct = Math.round(g.scale * 100); text = `Shaders ${pct}%`; state = pct >= 95 ? 'gpu' : 'warn'; title = `Kit shaders preview at ${pct}% internal resolution to hold the frame rate${g.timer ? ' (measured on the GPU)' : ''}. Exports always render at full resolution.${g.resets ? ` GPU resets this session: ${g.resets}.` : ''}`; }
    const key = text + state; if (key === gpuChipKey) return; gpuChipKey = key;
    c.textContent = text; c.dataset.state = state; c.title = title;
  }
  $('gpuChip').addEventListener('click', () => setTab('kits'));
""")

# transport
src = rep(src, "  function setPlayUi(on) { $('play').textContent = on ? '❚❚' : '▶'; $('play').setAttribute('aria-label', on ? 'Pause' : 'Play'); }",
               f"  function setPlayUi(on) {{ $('play').innerHTML = on ? '{PAUSE_SVG}' : '{PLAY_SVG}'; $('play').setAttribute('aria-label', on ? 'Pause' : 'Play'); }}")
src = rep(src, "  $('bpmChip').addEventListener('click', () => setTab('audio'));\n", """  $('bpmChip').addEventListener('click', () => setTab('audio'));
  function stepFrames(n) { if (stage.playing) togglePlay(); stage.step(n, project.output.fps); refreshRowsOnly(); }
  $('toStart').addEventListener('click', () => { seekFrac(0); if (!stage.playing) refreshRowsOnly(); });
  $('stepBack').addEventListener('click', () => stepFrames(-1));
  $('stepFwd').addEventListener('click', () => stepFrames(1));
""")
src = rep(src, "      case '[': stepStyle(-1); break;", "      case 'Home': e.preventDefault(); seekFrac(0); if (!stage.playing) refreshRowsOnly(); break;\n      case '[': stepStyle(-1); break;")

# library: view toggle + count
src = rep(src, "    $('search').placeholder = `Search ${STYLES.length} styles`;", "    $('search').placeholder = `Search ${STYLES.length} styles`;\n    $('libCount').textContent = `${STYLES.length}`;")
src = rep(src, "  $('search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderLibrary(); });", """  $('search').addEventListener('input', e => { query = e.target.value.trim().toLowerCase(); renderLibrary(); });
  const libViewKey = 'motif3-lib-view';
  function setLibView(v) { $('panel-library').dataset.view = v; $('libView').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.v === v)); try { localStorage.setItem(libViewKey, v); } catch (e) { /* per-viewer convenience only */ } }
  $('libView').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLibView(b.dataset.v); });
  try { const v = localStorage.getItem(libViewKey); if (v === 'list' || v === 'grid') setLibView(v); } catch (e) { /* storage unavailable */ }""")

# refresh: keep tab icons; viewer title; project meta; context strip
src = rep(src, """    $('tabs').querySelector('[data-tab=audio]').innerHTML = `Audio${project.audio && project.audio.maps.length ? '<span class="dot" aria-hidden="true"></span>' : ''}`;""",
"""    const at = $('tabs').querySelector('[data-tab=audio]'), dot = at.querySelector('.dot'), wantDot = !!(project.audio && project.audio.maps.length);
    if (dot && !wantDot) dot.remove(); else if (!dot && wantDot) at.insertAdjacentHTML('beforeend', '<span class="dot" aria-hidden="true"></span>');
    const li = project.layers.indexOf(active());
    $('vClip').textContent = `· V${li + 1}  ${st.name}${st.kit ? `  ·  ${st.kitName} kit` : ''}`;
    $('projMeta').textContent = `· ${project.layers.length} layer${project.layers.length > 1 ? 's' : ''} · ${project.finish.loop.toFixed(2)} s loop · ${project.output.fps} fps`;
    $('ctxInfo').innerHTML = `<span>Selected</span><b>V${li + 1} · ${esc(st.name)}</b>${st.engine === 'glsl' ? '<span class="tag">GLSL</span>' : st.gpu ? '<span class="tag">GPU</span>' : ''}`;
    updateGpuChip();""")

# timeline: ruler + layer clip tracks above key rows
src = rep(src, "    $('laneRows').innerHTML = rows + maps || '<p class=\"lane-empty\">Press ◇ beside any parameter to key it. Keys loop seamlessly: the last key eases back to the first.</p>';",
"""    const L = project.finish.loop, stepS = L <= 4 ? 0.5 : L <= 12 ? 1 : L <= 30 ? 2 : 5;
    let ticks = ''; for (let s = 0; s < L - 1e-6; s += stepS) ticks += `<span style="left:${(s / L * 100).toFixed(3)}%">${timecode(s).slice(3)}</span>`;
    const ruler = `<div class="lrow ruler"><span class="nm">${timecode(0).slice(0, 8)}</span><div class="track" data-ruler="1">${ticks}<i class="ph"></i></div><span></span></div>`;
    const clipCols = ['var(--clip)', 'var(--clip-2)', 'var(--clip-3)', 'var(--clip-4)'];
    const vts = project.layers.map((l, i) => ({ l, i })).reverse().map(({ l, i }) => { const st = getStyle(l.styleId); return `<div class="lrow vt" data-active="${l.id === project.active}" data-hidden="${l.visible === false}"><span class="nm"><span class="vid">V${i + 1}</span>${esc(st.name)}</span><div class="track" data-vlayer="${l.id}"><span class="clipbar" style="--cb:${clipCols[i % 4]}">${esc(st.name)}<small>${st.kit ? esc(st.kitName) + ' · GLSL' : esc(l.comp.blend === 'source-over' ? 'Normal' : l.comp.blend)} · ${Math.round(l.comp.opacity * 100)}%</small></span></div><span></span></div>`; }).join('');
    const keysPart = rows + maps || '<p class="lane-empty">Press ◇ beside any parameter to key it. Keys loop seamlessly: the last key eases back to the first.</p>';
    $('laneRows').innerHTML = ruler + vts + keysPart;""")
src = rep(src, """    const tr = e.target.closest('.track'); if (tr) { const r = tr.getBoundingClientRect(); seekFrac(clamp((e.clientX - r.left) / r.width, 0, 0.9999)); if (!stage.playing) refreshRowsOnly(); }""",
"""    const tr = e.target.closest('.track'); if (tr) { const r = tr.getBoundingClientRect(); seekFrac(clamp((e.clientX - r.left) / r.width, 0, 0.9999)); if (tr.dataset.vlayer) selectLayer(tr.dataset.vlayer); if (!stage.playing) refreshRowsOnly(); }""")
src = rep(src, "    const tr = e.target.closest('.track'); if (!tr || e.target.closest('.kf') || tr.dataset.env) return;",
               "    const tr = e.target.closest('.track'); if (!tr || e.target.closest('.kf') || tr.dataset.env || !tr.dataset.track) return;")
src = rep(src, "${laneCollapsed ? '▸' : '▾'} Keys</button>", "${laneCollapsed ? '▸' : '▾'} Timeline</button>")

# kit events also refresh the GPU chip
src = rep(src, "  K.on(ev => {\n    renderChips(); renderLibrary(); stage.invalidate();", """  K.on(ev => {
    if (ev.type === 'gpu') {
      updateGpuChip(); stage.invalidate();
      if (ev.gpu === 'restored') drawThumbs();
      if (ev.gpu === 'compiled') { for (const id of ev.ids) { const c = thumbs.get(id); if (c) renderThumb(pipeline, c, thumbLook(getStyle(id)), 0.3, project.palettes); } if (tab === 'kits') renderKitsPanel(); else if (tab === 'layer') renderPanel(); }
      return;
    }
    renderChips(); renderLibrary(); stage.invalidate();""")
src = rep(src, "  // ---------- kits (Style Lab 2.1) ----------", "  // ---------- kits ----------")
src = rep(src, "toast(`That file isn’t a Style Lab preset: ${err.message}.`)", "toast(`That file isn’t a Motif preset: ${err.message}.`)")

# thumbnails: visible ones first
src = rep(src, "    const job = ++thumbJob; const entries = [...thumbs.entries()]; let i = 0;",
"""    const job = ++thumbJob; let i = 0;
    const box = $('libList').getBoundingClientRect();
    const seen = c => { const r = c.getBoundingClientRect(); return r.bottom >= box.top && r.top <= box.bottom && r.width > 0; };
    const entries = [...thumbs.entries()].map(e => [e, seen(e[1]) ? 0 : 1]).sort((a, b) => a[1] - b[1]).map(x => x[0]);""")

# ---------- export: instant cancel, elapsed/ETA readout ----------
src = rep(src, "const exportCtx = () => ({ pipeline, env: envFn, audio:", "const exportCtx = () => ({ pipeline, env: envFn, job: K.job, audio:")
src = rep(src, """    exAbort = new AbortController(); $('exRender').disabled = true; $('exSave').hidden = true; $('exProgress').hidden = false; $('exProgress').value = 0; status('Preparing…');""",
"""    exAbort = new AbortController(); $('exRender').disabled = true; $('exSave').hidden = true; $('exProgress').hidden = false; $('exProgress').value = 0; status('Preparing…');
    $('exCancel').textContent = 'Stop render'; $('exCancel').classList.add('danger');
    const t0 = performance.now(); let msg = 'Preparing…', frac = 0, stopping = false;
    const clock = s => { s = Math.max(0, Math.round(s)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor(s / 60) % 60}m` : s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
    const paint = () => { if (stopping) return; const el = (performance.now() - t0) / 1000; status(`${msg} · ${clock(el)} elapsed${frac > 0.03 ? ` · about ${clock(el * (1 - frac) / frac)} left` : ''}`); };
    const ticker = setInterval(paint, 500);
    exStop = () => { if (!exAbort || stopping) return; stopping = true; exAbort.abort(); $('exCancel').disabled = true; $('exCancel').textContent = 'Stopping…'; status('Stopping…'); };""")
src = rep(src, "onProgress: (f, msg) => { $('exProgress').value = f; status(msg); } });",
               "onProgress: (f, m) => { frac = f; msg = m; $('exProgress').value = f; paint(); } });")
src = rep(src, "    finally { exAbort = null; $('exRender').disabled = false;",
               "    finally { clearInterval(ticker); exStop = null; exAbort = null; $('exCancel').disabled = false; $('exCancel').textContent = 'Cancel'; $('exCancel').classList.remove('danger'); $('exRender').disabled = false;")
src = rep(src, "let caps = null, exAbort = null, lastFile = null, downloadsP = null;", "let caps = null, exAbort = null, exStop = null, lastFile = null, downloadsP = null;")
src = rep(src, "function closeExport() { if (exAbort) { exAbort.abort(); return; } $('exportDlg').close(); }", "function closeExport() { if (exStop) { exStop(); return; } $('exportDlg').close(); }")
src = rep(src, "$('exportDlg').addEventListener('cancel', e => { if (exAbort) { e.preventDefault(); exAbort.abort(); } });", "$('exportDlg').addEventListener('cancel', e => { if (exStop) { e.preventDefault(); exStop(); } });")

# ---------- autosave / restore ----------
src = rep(src, "  let project = demoProject();\n  let aspect = '16x9',", """  const AUTOSAVE = 'motif3-autosave-v1';
  let project = demoProject(), restored = false;
  try {
    const sv = JSON.parse(localStorage.getItem(AUTOSAVE) || 'null');
    if (sv && sv.project && K.missingKits(sv.project).length === 0) { project = T.sanitizeProject(sv.project, C.sanitizeCustom); restored = true; }
  } catch (e) { /* no usable autosave */ }
  let aspect = '16x9',""")
src = rep(src, "  const history = [JSON.stringify(project)]; let cursor = 0;", """  const history = [JSON.stringify(project)]; let cursor = 0;
  // Autosave: the project is written shortly after every change and when the page is hidden or closed.
  let asTimer = 0;
  function saveNow() { try { localStorage.setItem(AUTOSAVE, JSON.stringify({ v: 1, at: Date.now(), aspect, project })); } catch (e) { /* storage full or unavailable */ } }
  function autosave() { clearTimeout(asTimer); asTimer = setTimeout(saveNow, 600); }
  addEventListener('pagehide', saveNow); document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });""")
src = rep(src, "  function live(next) { project = next; stage.invalidate(); }", "  function live(next) { project = next; autosave(); stage.invalidate(); }")
src = rep(src, "  function refresh() {\n    renderPanel(); renderLane(); stage.invalidate();", "  function refresh() {\n    autosave(); renderPanel(); renderLane(); stage.invalidate();")
src = rep(src, "    aspect = a; $('aspectSel').value = a;", "    aspect = a; autosave(); $('aspectSel').value = a;")

src = rep(src, "  setAspect(aspect);\n  aspectsEl.addEventListener", """  if (restored) { try { const sv = JSON.parse(localStorage.getItem(AUTOSAVE)); if (sv && ASPECTS.some(a => a.id === sv.aspect)) aspect = sv.aspect; } catch (e) { /* keep default */ } }
  setAspect(aspect);
  if (restored) setTimeout(() => toast('Restored your last session'), 700);
  aspectsEl.addEventListener""")
src = rep(src, "  $('undoBtn').addEventListener('click', undo);", """  $('newBtn').addEventListener('click', () => { commit(demoProject(), 'New project'); stage.setSpace(project.output.space); });
  $('undoBtn').addEventListener('click', undo);""")

# ---------- GPU renderer awareness + export speed check ----------
src = rep(src, "    else if (g.lost) { text = 'GPU reset · recovering'; state = 'err';", "    else if (g.software) { text = 'Software GL'; state = 'err'; title = `WebGL is running in software (${g.renderer}), so kit shaders render on the CPU: previews are low resolution and exports are very slow. Turn on hardware acceleration in the browser and reload.`; }\n    else if (g.lost) { text = 'GPU reset · recovering'; state = 'err';")
src = rep(src, "    status(''); $('exProgress').hidden = true; $('exSave').hidden = true; $('exRender').disabled = false;",
"""    status(''); $('exProgress').hidden = true; $('exSave').hidden = true; $('exRender').disabled = false; $('exSpeed').innerHTML = '';
    gpuLine();""")
src = rep(src, "  async function openExport() {", """  function gpuLine() {
    const g = K.gpuStatus(), el = $('exGpu'); if (!el) return;
    const usesKit = project.layers.some(l => l.visible !== false && getStyle(l.styleId).engine === 'glsl');
    if (!g.ok) { el.dataset.state = usesKit ? 'warn' : ''; el.innerHTML = 'WebGL2 unavailable' + (usesKit ? ': kit styles cannot render.' : '.'); return; }
    if (g.software) { el.dataset.state = 'warn'; el.innerHTML = `<b>Software rendering</b> (${esc(g.renderer)}). Kit shaders run on the CPU, so exports take seconds per frame. Enable hardware acceleration in the browser and reload, then use Check speed.`; return; }
    el.dataset.state = ''; el.innerHTML = `GPU <b>${esc(g.renderer || 'unknown')}</b>`;
  }
  // Times one export-size frame per visible layer (plus the finish stack) so you can see what a render will cost.
  async function checkSpeed() {
    const btn = $('exCheck'), out = $('exSpeed'); btn.disabled = true; out.innerHTML = '<span>Measuring…</span>';
    const { w, h } = exportSize(aspect, ex.tier), t = stage.time, fps = project.output.fps, n = frameCount(project, fps, ex.loops);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
    const timeOf = async pr => {
      const run = () => { const t0 = performance.now(); pipeline.renderFrame(x, w, h, pr, t, { env: envFn }); x.getImageData(0, 0, 1, 1); return performance.now() - t0; };
      run(); for (let i = 0; i < 60 && K.runtime.pendingCompiles; i++) await wait(100);
      await wait(0); return Math.min(run(), run());
    };
    try {
      const rows = []; const vis = project.layers.filter(l => l.visible !== false);
      const bare = clone(project); bare.finish = { ...bare.finish, glow: 0, chroma: 0, grain: 0, vignette: 0, gmap: 0, depth: 0, shutter: 0 };
      let total = await timeOf({ ...project, finish: { ...project.finish, shutter: 0 } });
      for (const l of vis) { const pr = clone(bare); pr.layers.forEach(q => { q.visible = q.id === l.id; }); rows.push([getStyle(l.styleId).name, await timeOf(pr)]); }
      const layersSum = rows.reduce((a, r) => a + r[1], 0);
      const shutter = project.finish.shutter > 0 ? project.finish.samples : 1;
      const perFrame = total * shutter + 60; // + readback and colour conversion allowance
      const fmt = ms => ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
      const top = rows.reduce((a, r) => (r[1] > a ? r[1] : a), 0);
      out.innerHTML = rows.map(r => `<span${r[1] === top && top > 50 ? ' class="hot"' : ''}>${esc(r[0])}</span><b${r[1] === top && top > 50 ? ' class="hot"' : ''}>${fmt(r[1])}</b>`).join('') +
        `<span>Finish stack and compositing</span><b>${fmt(Math.max(0, total - layersSum))}</b>` +
        (shutter > 1 ? `<span>Motion blur × ${shutter} samples</span><b>× ${shutter}</b>` : '') +
        `<i class="rule"></i><span class="sum">One frame at ${w}×${h}</span><b class="sum">${fmt(perFrame)}</b>` +
        `<span class="sum">${n} frames</span><b class="sum">about ${perFrame * n / 1000 >= 90 ? Math.round(perFrame * n / 60000) + ' min' : Math.round(perFrame * n / 1000) + ' s'}</b>`;
    } catch (e) { out.innerHTML = `<span>Couldn’t measure: ${esc(e.message || e)}</span>`; }
    btn.disabled = false; stage.invalidate();
  }
  $('exCheck').addEventListener('click', checkSpeed);
  async function openExport() {""")
# ETA from the first finished frame
src = rep(src, "${frac > 0.03 ? ` · about ${clock(el * (1 - frac) / frac)} left` : ''}", "${frac > 0 ? ` · about ${clock(el * (1 - frac) / frac)} left` : ''}")
