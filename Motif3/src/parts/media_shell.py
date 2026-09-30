# Media inputs: timeline, compositor, kits runtime, exporter and shell wiring. Runs inside build.py.
MEDIA_JS = open(f'{ROOT}/parts/media.js').read()

# ---------- timeline: layers carry media metadata ----------
src = rep(src, """function sanitizeLayer(l) {
  const look = sanitizeLook(l);
  return { id: typeof l.id === 'string' && l.id ? l.id.slice(0, 24) : newLayerId(), styleId: look.styleId, params: look.params, shared: look.shared, comp: sanitize(l.comp, COMP_SCHEMA), visible: l.visible !== false };
}""", """// Media attached to a kit style's inputs: { <inputId>: { asset, name, kind, w, h, dur, fit, timing } }.
function sanitizeMedia(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  const out = {};
  for (const [k, v] of Object.entries(m).slice(0, 4)) {
    if (!/^[a-z][a-zA-Z0-9]{0,15}$/.test(k) || !v || typeof v !== 'object' || !/^m_[a-z0-9]{6,40}$/.test(String(v.asset || ''))) continue;
    out[k] = { asset: v.asset, name: String(v.name || '').slice(0, 80), kind: v.kind === 'video' ? 'video' : 'image', w: Math.max(0, Math.round(Number(v.w) || 0)), h: Math.max(0, Math.round(Number(v.h) || 0)), dur: Math.max(0, Number(v.dur) || 0),
      fit: ['fill', 'fit', 'stretch'].includes(v.fit) ? v.fit : 'fill', timing: v.timing === 'free' ? 'free' : 'loop' };
  }
  return Object.keys(out).length ? out : null;
}
function sanitizeLayer(l) {
  const look = sanitizeLook(l);
  const out = { id: typeof l.id === 'string' && l.id ? l.id.slice(0, 24) : newLayerId(), styleId: look.styleId, params: look.params, shared: look.shared, comp: sanitize(l.comp, COMP_SCHEMA), visible: l.visible !== false };
  const media = sanitizeMedia(l.media); if (media) out.media = media;
  return out;
}""")
src = rep(src, "  const layers = pr.layers.map(l => ({ id: l.id, styleId: l.styleId, params: { ...l.params }, shared: { ...l.shared, loop: L }, comp: { ...l.comp }, visible: l.visible, pmix: null }));",
               "  const layers = pr.layers.map(l => ({ id: l.id, styleId: l.styleId, params: { ...l.params }, shared: { ...l.shared, loop: L }, comp: { ...l.comp }, visible: l.visible, pmix: null, media: l.media || null }));")

# ---------- compositor: expose layer media to styles ----------
src = rep(src, "    S.pal = pal; S.font = (weight, size) => `${weight} ${size}px ${fontCss(look.params.font)}`;",
               "    S.pal = pal; S.media = look.media || null; S.font = (weight, size) => `${weight} ${size}px ${fontCss(look.params.font)}`;")

# ---------- kits runtime: resolver hook ----------
src = rep(src, "const SUSPEND = { isSuspend: true };", """const SUSPEND = { isSuspend: true };
// Host hook for media inputs: (inputs, S, { preview }) -> { <id>: { canvas, rev, w, h, time } } | null.
let mediaResolver = null;
function setMediaResolver(fn) { mediaResolver = typeof fn === 'function' ? fn : null; }""")
src = rep(src, "      const u = { p: S.p, L: Leff, seed: S.seed, safe, pal: S.pal, params: S.P, spec: params };",
               "      const u = { p: S.p, L: Leff, seed: S.seed, safe, pal: S.pal, params: S.P, spec: params, media: st.inputs && st.inputs.length && mediaResolver && S.media ? mediaResolver(st.inputs, S, { preview }) : null };")
src = rep(src, "runtime: rt, setPreview, reportFrame, gpuStatus, job: JOB, install,", "runtime: rt, setPreview, reportFrame, gpuStatus, job: JOB, setMediaResolver, install,")
# the low-pass tap signature must include media revs so a changed image isn't mixed with stale taps
src = rep(src, "const sig = `${st.id}|${S.p}|${S.w}x${S.h}|${S.seed}|${S.pal.bg}|${S.pal.ink}|${JSON.stringify(S.P)}`;",
               "const sig = `${st.id}|${S.p}|${S.w}x${S.h}|${S.seed}|${S.pal.bg}|${S.pal.ink}|${JSON.stringify(S.P)}|${u.media ? Object.values(u.media).map(x => x.rev).join(',') : ''}`;")

# ---------- exporter: seek media before every frame ----------
src = rep(src, "// One frame, rendered in short slices so Cancel is honoured within ~100 ms even for very heavy frames.\nasync function frameCoop(pipeline, ctx, w, h, project, t, ropts, job, signal) {\n",
"""// Media hook for the export in progress: awaited before each frame (loads assets, seeks videos to that frame).
let mediaPrep = null;
// One frame, rendered in short slices so Cancel is honoured within ~100 ms even for very heavy frames.
async function frameCoop(pipeline, ctx, w, h, project, t, ropts, job, signal) {
  if (mediaPrep) { await mediaPrep(project, t); if (signal && signal.aborted) throw abortErr(); }
""")
src = rep(src, "async function runExport(project, s, { pipeline, env, audio, onProgress, signal, job } = {}) {\n  const caps = await probeCapabilities();",
"""async function runExport(project, s, ctx = {}) {
  mediaPrep = ctx.media && ctx.media.prepare ? ctx.media.prepare : null;
  try { return await runExportInner(project, s, ctx); }
  finally { mediaPrep = null; if (ctx.media && ctx.media.release) ctx.media.release(); }
}
async function runExportInner(project, s, { pipeline, env, audio, onProgress, signal, job } = {}) {
  const caps = await probeCapabilities();""")

# ---------- shell ----------
src = rep(src, "  // ---------- state ----------\n  const AUTOSAVE", MEDIA_JS + """
  const media = createMediaStore({ isPlaying: () => stage.playing, onChange: () => { stage.invalidate(); if (tab === 'layer') paintMediaThumbs(); } });
  K.setMediaResolver(media.resolve);
  // ---------- state ----------
  const AUTOSAVE""")
src = rep(src, "const exportCtx = () => ({ pipeline, env: envFn, job: K.job, audio:", "const exportCtx = () => ({ pipeline, env: envFn, job: K.job, media, audio:")
src = rep(src, "    const wasPlaying = stage.playing; stage.pause(); if (player.playing) player.stop();",
               "    const wasPlaying = stage.playing; stage.pause(); media.pauseAll(); if (player.playing) player.stop();")

# library badge
src = rep(src, "${st.engine === 'glsl' ? ' · <span class=\"glsl\">GLSL</span>' : ''}",
               "${st.inputs && st.inputs.length ? ' · <span class=\"medtag\" title=\"Takes an image or video\">MEDIA</span>' : ''}${st.engine === 'glsl' && !(st.inputs && st.inputs.length) ? ' · <span class=\"glsl\">GLSL</span>' : ''}")

# layer panel: Media group for styles with inputs
src = rep(src, "      ${group('style', 'Style', Object.keys(st.params)",
               "      ${st.inputs && st.inputs.length ? group('media', 'Media', st.inputs.map(q => mediaSlotHtml(l, q)).join(''), (l.media && st.inputs.some(q => l.media[q.id])) ? ' <span class=\"count\">●</span>' : '') : ''}\n      ${group('style', 'Style', Object.keys(st.params)")
src = rep(src, "    $('panel-layer').querySelectorAll('#layerList canvas').forEach(c => {", "    paintMediaThumbs();\n    $('panel-layer').querySelectorAll('#layerList canvas').forEach(c => {")
src = rep(src, "  const openGroups = { style: true,", "  const openGroups = { media: true, style: true,")
src = rep(src, """  $('panel-layer').addEventListener('click', e => {
    const eye = e.target.closest('[data-eye]');""", """  // ---- media slots ----
  const fmtDur = s => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${s.toFixed(1)} s`;
  function mediaSlotHtml(l, q) {
    const m = l.media && l.media[q.id], info = m ? media.info(m.asset) : null;
    const accept = q.type === 'image' ? 'image' : q.type === 'video' ? 'video' : 'image or video';
    const seg = (name, opts, val) => `<div class="seg" role="radiogroup" aria-label="${name}">${opts.map(([v, lbl, tip]) => `<button role="radio" data-mset="${name}" data-input="${q.id}" data-v="${v}" aria-checked="${val === v}"${tip ? ` title="${tip}"` : ''}>${lbl}</button>`).join('')}</div>`;
    if (!m) return `<div class="mslot" data-input="${q.id}" data-kind="${q.type}">
        <button class="mdrop" data-mload="${q.id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l4.5-4.5 3 3L16 10l4 4"/><rect x="3" y="4" width="18" height="16" rx="2"/></svg><b>${esc(q.label)}</b><span>Drop or choose an ${accept}</span></button>
        ${q.hint ? `<p class="info">${esc(q.hint)}</p>` : ''}</div>`;
    const bad = info && (info.state === 'missing' || info.state === 'error');
    const meta = `${m.w}×${m.h} · ${m.kind === 'video' ? 'video · ' + fmtDur(m.dur) : 'image'}`;
    return `<div class="mslot" data-input="${q.id}" data-state="${bad ? 'bad' : info ? info.state : ''}">
      <div class="mhead"><canvas class="mthumb" data-mthumb="${q.id}" width="112" height="63" aria-hidden="true"></canvas>
        <div class="mmeta"><span class="lbl">${esc(q.label)}</span><b title="${esc(m.name)}">${esc(m.name || 'Untitled')}</b><span>${bad ? (info.state === 'missing' ? 'File not in this browser · relink' : esc(info.error || 'Can’t decode')) : meta}</span></div></div>
      <div class="mrow"><span class="nm">Fit</span>${seg('fit', [['fill', 'Fill', 'Cover the frame, cropping the edges'], ['fit', 'Fit', 'Show the whole image, letterboxed'], ['stretch', 'Stretch', 'Distort to the frame']], m.fit)}</div>
      ${m.kind === 'video' ? `<div class="mrow"><span class="nm">Timing</span>${seg('timing', [['loop', 'Fit to loop', 'Retime the clip to one Motif loop: seamless'], ['free', 'Real time', 'Play at normal speed; wraps at the clip length']], m.timing)}</div>` : ''}
      <div class="btnrow"><button class="btn sm" data-mload="${q.id}">${bad ? 'Relink…' : 'Replace…'}</button><button class="btn sm" data-mclear="${q.id}">Remove</button></div></div>`;
  }
  function paintMediaThumbs() {
    const l = active(); if (!l.media) return;
    $('panel-layer').querySelectorAll('[data-mthumb]').forEach(c => {
      const m = l.media[c.dataset.mthumb]; if (!m) return; const i = media.info(m.asset); if (i.state === 'unknown') media.ensure(m.asset);
      const x = c.getContext('2d'); x.fillStyle = '#16161A'; x.fillRect(0, 0, c.width, c.height);
      if (i.state !== 'ready' || !i.el) return;
      const s = Math.max(c.width / i.w, c.height / i.h); try { x.drawImage(i.el, (c.width - i.w * s) / 2, (c.height - i.h * s) / 2, i.w * s, i.h * s); } catch (e) { /* frame not ready */ }
    });
  }
  let mediaTarget = null;
  async function attachMedia(file, inputId, layerId = project.active) {
    const l = T.layerById(project, layerId), st = l && getStyle(l.styleId);
    const q = st && (st.inputs || []).find(x => x.id === inputId) || (st && st.inputs && st.inputs[0]);
    if (!q) { toast('This layer’s style has no media input. Pick a style marked MEDIA in the library.'); return false; }
    const kind = media.kindOf(file);
    if (!kind) { toast(`${file.name} isn’t an image or video.`); return false; }
    if (q.type !== 'media' && q.type !== kind) { toast(`${q.label} takes ${q.type === 'image' ? 'an image' : 'a video'}.`); return false; }
    toast(`Loading ${file.name}…`);
    try {
      const meta = await media.add(file);
      const next = clone(project), nl = T.layerById(next, layerId); if (!nl) return false;
      const prev = nl.media && nl.media[q.id];
      nl.media = { ...(nl.media || {}), [q.id]: { ...meta, fit: prev ? prev.fit : q.fit, timing: prev ? prev.timing : 'loop' } };
      commit(next, `${meta.kind === 'video' ? 'Video' : 'Image'} attached · ${meta.name}`);
      if (!(await media.persistent)) toast('Attached. This browser blocks local storage, so the file won’t survive a reload.');
      return true;
    } catch (err) { toast(err.message || String(err)); return false; }
  }
  function setMediaField(inputId, key, v) {
    const next = clone(project), nl = T.layerById(next, project.active); if (!nl.media || !nl.media[inputId]) return;
    nl.media[inputId][key] = v; commit(next);
  }
  $('mediaFile').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f && mediaTarget) await attachMedia(f, mediaTarget.input, mediaTarget.layer); mediaTarget = null; });
  $('panel-layer').addEventListener('dragover', e => { if (e.target.closest('.mslot') && hasFiles(e)) { e.preventDefault(); e.target.closest('.mslot').classList.add('over'); } });
  $('panel-layer').addEventListener('dragleave', e => { const s = e.target.closest('.mslot'); if (s) s.classList.remove('over'); });
  $('panel-layer').addEventListener('click', e => {
    const ld = e.target.closest('[data-mload]');
    if (ld) { const st = getStyle(active().styleId), q = (st.inputs || []).find(x => x.id === ld.dataset.mload); mediaTarget = { input: ld.dataset.mload, layer: project.active }; $('mediaFile').accept = q && q.type === 'image' ? 'image/*' : q && q.type === 'video' ? 'video/*' : 'image/*,video/*'; $('mediaFile').click(); return; }
    const cl = e.target.closest('[data-mclear]');
    if (cl) { const next = clone(project), nl = T.layerById(next, project.active); if (nl.media) { delete nl.media[cl.dataset.mclear]; if (!Object.keys(nl.media).length) delete nl.media; } commit(next, 'Media removed'); return; }
    const ms = e.target.closest('[data-mset]');
    if (ms) { setMediaField(ms.dataset.input, ms.dataset.mset, ms.dataset.v); return; }
  });
  $('panel-layer').addEventListener('click', e => {
    const eye = e.target.closest('[data-eye]');""")

# duplicate layer keeps media
src = rep(src, "Object.assign(copy, { params: clone(src.params), shared: clone(src.shared), comp: clone(src.comp), visible: true });",
               "Object.assign(copy, { params: clone(src.params), shared: clone(src.shared), comp: clone(src.comp), visible: true }); if (src.media) copy.media = clone(src.media);")

# drag and drop: images/videos attach to the active layer (or the slot they're dropped on); kits install
src = rep(src, """    const fs = [...e.dataTransfer.files].filter(f => /\\.(motifkit|zip|json)$/i.test(f.name));
    if (!fs.length) { toast('Drop a .motifkit file to install a kit'); return; }
    setTab('kits'); importFiles(fs);""", """    const all = [...e.dataTransfer.files];
    const med = all.find(f => media.kindOf(f));
    if (med) { document.querySelectorAll('.mslot.over').forEach(x => x.classList.remove('over')); const slot = e.target.closest && e.target.closest('.mslot'); attachMedia(med, slot ? slot.dataset.input : null).then(ok => { if (ok && tab !== 'layer') setTab('layer'); }); return; }
    const fs = all.filter(f => /\\.(motifkit|zip|json)$/i.test(f.name));
    if (!fs.length) { toast('Drop a .motifkit file to install a kit, or an image or video onto a MEDIA style'); return; }
    setTab('kits'); importFiles(fs);""")

# test hooks
src = rep(src, "  window.__lab = {\n", "  window.__lab = {\n    media, attachMedia,\n")
