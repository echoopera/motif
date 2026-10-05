# Sequencer style, layer data, compositor, media playhead, inspector.
def apply(P, mods):
    # --- style library: the built-in Sequencer style ---------------------------------------------------------
    P.rep("""const STYLES = [
  staggerRise,""", """// The Sequencer is a layer type: its cue list lives on the layer (layer.seq) and the compositor renders it by calling the styles of its
// cues (see compositor.renderSequencer). This entry gives it a library tile, a category and a placeholder for contexts without a layer.
const sequencer = {
  id: 'sequencer', name: 'Sequencer', category: 'sequence',
  blurb: 'Calls styles from your library at points of the loop: more looks than four layers, never more than four shaders at once.',
  params: {},
  render(ctx, S) {
    const { w, h, pal, p } = S, lanes = [[0.0, 0.5], [0.3, 0.45], [0.55, 0.45], [0.15, 0.3]];
    ctx.save(); ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, w, h);
    lanes.forEach(([a, l], i) => { ctx.fillStyle = pal.pick(i); ctx.globalAlpha = 0.85; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(w * (0.08 + a * 0.84), h * (0.16 + i * 0.2), w * l * 0.84, h * 0.13, h * 0.03); else ctx.rect(w * (0.08 + a * 0.84), h * (0.16 + i * 0.2), w * l * 0.84, h * 0.13); ctx.fill(); });
    ctx.globalAlpha = 1; ctx.fillStyle = pal.ink; ctx.fillRect(w * (0.08 + p * 0.84) - 1, h * 0.1, 2, h * 0.8); ctx.restore();
  },
};

const STYLES = [
  staggerRise,""", label='sequencer style')
    P.rep("  ridgelines, halftone, metaballs, kaleidoscope,\n];", "  ridgelines, halftone, metaballs, kaleidoscope, sequencer,\n];", label='STYLES push')
    P.rep("  { id: 'generative', name: 'Generative' },\n];", "  { id: 'generative', name: 'Generative' },\n  { id: 'sequence', name: 'Sequencer' },\n];", label='CATEGORIES')

    # --- timeline: layer data ----------------------------------------------------------------------------------
    P.rep("const TA = () => (typeof __m_text_atlas !== 'undefined' ? __m_text_atlas : null); // text inputs (04b); absent in minimal test loads\n",
          "const TA = () => (typeof __m_text_atlas !== 'undefined' ? __m_text_atlas : null); // text inputs (04b); absent in minimal test loads\nconst KV = () => (typeof __m_kit_v4 !== 'undefined' ? __m_kit_v4 : null); // motif-kit@4: sequences, stacks\n"
          "// Starter cue list for a new Sequencer layer: a bed in lane 1 and an accent over it, both closing on themselves.\n"
          "function defaultSeq() {\n  const c = (id, i, style, at, len, lane, o) => ({ id, i, style, at, len, lane, fadeIn: 0.12, fadeOut: 0.12, cycles: 1, dir: 'forward', blend: 'normal', opacity: 1, chance: 1, mute: false, seed: 0, palette: null, params: {}, label: '', ...o });\n"
          "  return { id: '', name: 'Starter', seed: 1, maxActive: 4, cues: [c('c1', 0, 'orbit-rings', 0, 0.55, 0, {}), c('c2', 1, 'grid-pulse', 0.5, 0.5, 0, {}), c('c3', 2, 'halftone', 0.25, 0.45, 1, { blend: 'screen', opacity: 0.6 })] };\n}\n", label='KV accessor + defaultSeq')
    P.rep("  const text = TA() && TA().defaults(inputsOf(look.styleId)); if (text) l.text = text;\n  return l;",
          "  const text = TA() && TA().defaults(inputsOf(look.styleId)); if (text) l.text = text;\n  if (look.styleId === 'sequencer') l.seq = defaultSeq();\n  return l;", label='newLayer seq')
    P.rep("  const text = TA() && TA().sanitizeState(l.text, inputsOf(look.styleId)); if (text) out.text = text;\n  return out;",
          "  const text = TA() && TA().sanitizeState(l.text, inputsOf(look.styleId)); if (text) out.text = text;\n  // Sequencer layers keep a bounded cue list (motif-kit@4); every other style drops it.\n  if (look.styleId === 'sequencer') out.seq = (KV() && KV().sanitizeSeq(l.seq)) || defaultSeq();\n  return out;", label='sanitizeLayer seq')
    P.rep("slice(0, 4)) {\n    if (!/^[a-z][a-zA-Z0-9]{0,15}$/.test(k)", "slice(0, 6)) {\n    if (!/^[a-z][a-zA-Z0-9]{0,15}$/.test(k)", label='sanitizeMedia limit')
    P.rep("media: l.media || null, text: l.text ? clone(l.text) : null }));\n  const finish = { ...pr.finish };", "media: l.media || null, text: l.text ? clone(l.text) : null, seq: l.seq ? clone(l.seq) : null }));\n  const finish = { ...pr.finish };", label='evaluate seq')

    # --- compositor ----------------------------------------------------------------------------------------------
    P.rep("const { frameState, fontCss } = __m_style_library;\nconst { resolvePalette } = __m_colour;", "const { frameState, fontCss, getStyle, sanitizeLook, STYLES } = __m_style_library;\nconst { resolvePalette } = __m_colour;\nconst KV = __m_kit_v4;", label='compositor imports')
    P.rep("  function renderLook(ctx, w, h, look, t, pal, opts = {}) {\n    const { style, S } = frameState(look, w, h, t);",
"""  // Sequencer layer (motif-kit@4): plan the cues at this loop phase, render each active cue's style at its own inner phase into a
  // scratch canvas, and layer them with their blend mode and fade. Pure in (look, t): the plan is deterministic, so scrubbing, the
  // render cache and exports agree. Never more than maxActive (<= 4) styles run for one frame.
  function renderSequencer(ctx, w, h, look, t, pal, opts) {
    const sh = look.shared, L = sh.loop || 6, tempo = sh.tempo || 1, p = (((t / L) * tempo + sh.phase) % 1 + 1) % 1, seq = look.seq;
    const plan = KV.planSequence(seq, p, { L: L / tempo, seed: sh.seed, maxActive: seq.maxActive });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    if (opts.clear !== false) ctx.clearRect(0, 0, w, h);
    if (opts.bg) { ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, w, h); }
    ctx.translate(w * (sh.posX || 0), h * (sh.posY || 0)); ctx.translate(w / 2, h / 2); ctx.rotate((sh.rotate * Math.PI) / 180); ctx.scale(sh.zoom, sh.zoom); ctx.translate(-w / 2, -h / 2);
    const space = ctx.getContextAttributes && ctx.getContextAttributes().colorSpace === 'display-p3' ? 'p3' : 'srgb';
    let engine = 'cpu', fill = !!opts.bg; // like the base layer, the lowest cue draws on the palette background when this layer fills it
    plan.active.forEach((a, n) => {
      const c = a.cue; if (c.style === 'sequencer' || !STYLES.some(s => s.id === c.style)) return; // a missing style (kit removed) draws nothing; a cue never nests a sequencer
      const sl = sanitizeLook({ styleId: c.style, params: c.params, shared: { palette: c.palette || sh.palette, invert: sh.invert, seed: c.seed || sh.seed } });
      const sub = { id: `${look.id || 'seq'}:${c.id}`, styleId: sl.styleId, params: sl.params, shared: { ...sl.shared, loop: a.innerL, tempo: 1, phase: 0, zoom: 1, rotate: 0, posX: 0, posY: 0 }, media: null, text: null };
      const cpal = resolvePalette(sub.shared.palette, sub.shared.invert, opts.customs || []);
      const cv = scratch(`Q${n}`, w, h, space);
      const r = renderLook(cv._ctx, w, h, sub, a.innerP * a.innerL, cpal, { bg: fill, cpu: opts.cpu, onError: opts.onError, customs: opts.customs }); fill = false;
      if (r.engine !== 'cpu') engine = r.engine;
      ctx.globalCompositeOperation = KV.BLEND_CANVAS[c.blend] || 'source-over'; ctx.globalAlpha = clamp(a.alpha); ctx.drawImage(cv, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    });
    ctx.restore();
    return { p, engine };
  }

  function renderLook(ctx, w, h, look, t, pal, opts = {}) {
    if (look.styleId === 'sequencer' && look.seq) return renderSequencer(ctx, w, h, look, t, pal, opts);
    const { style, S } = frameState(look, w, h, t);""", label='renderSequencer')
    P.rep("renderLook(ctx, w, h, l, t, pal, { bg: true, cpu: opts.cpu, onError: opts.onError })", "renderLook(ctx, w, h, l, t, pal, { bg: true, cpu: opts.cpu, onError: opts.onError, customs })", label='direct renderLook')
    P.rep("renderLook(lc._ctx, w, h, l, t, pal, { bg: fillBg, cpu: opts.cpu, onError: opts.onError })", "renderLook(lc._ctx, w, h, l, t, pal, { bg: fillBg, cpu: opts.cpu, onError: opts.onError, customs })", label='layer renderLook')

    # --- media: stack layers drive video through the playhead ---------------------------------------------------
    P.rep("          if (opts.preview && !passive) steer(a, m, videoTime(a, m, S.t || 0, L), L);",
"""          // motif-kit@4 stack layer with Cycles/loop > 0: the playhead (forward, backward, ping-pong, random) picks the clip position.
          const sp = q.stack ? __m_kit_v4.stackPlayheads([q], S.P || {}, S.p, S.seed)[q.id] : null;
          if (opts.preview && !passive) steer(a, m, sp == null ? videoTime(a, m, S.t || 0, L) : Math.min(sp * (a.dur || 0), Math.max(0, (a.dur || 0) - 0.001)), L, sp != null);""", label='resolve playhead')
    P.rep("    function steer(a, m, vt, L) {\n      const v = a.el;\n      if (isPlaying()) {", "    function steer(a, m, vt, L, scrub) {\n      const v = a.el;\n      if (isPlaying() && !scrub) {", label='steer scrub')
    P.rep("""      for (const l of project.layers) {
        if (l.visible === false || !l.media) continue;
        for (const m of Object.values(l.media)) {
          if (!m || !m.asset) continue;
          const a = ensure(m.asset); await a.ready; if (a.state !== 'ready') continue;
          if (a.kind === 'video') {
            a.el.pause(); const vt = videoTime(a, m, t, L); await a.decP;""",
"""      const ev = T.evaluate(project, t, null);
      for (const l of project.layers) {
        if (l.visible === false || !l.media) continue;
        for (const [mk, m] of Object.entries(l.media)) {
          if (!m || !m.asset) continue;
          const a = ensure(m.asset); await a.ready; if (a.state !== 'ready') continue;
          if (a.kind === 'video') {
            a.el.pause(); let vt = videoTime(a, m, t, L); await a.decP;
            // motif-kit@4 stack layer: the same playhead as the shader and the preview, from the layer's evaluated params.
            { const q = (getStyle(l.styleId).inputs || []).find(x => x.id === mk && x.stack), el = ev.layers.find(x => x.id === l.id);
              if (q && el) { const sh = el.shared, p = ((((t / L) * (sh.tempo || 1) + (sh.phase || 0)) % 1) + 1) % 1, sp = __m_kit_v4.stackPlayheads([q], el.params, p, sh.seed)[q.id]; if (sp != null) vt = Math.min(sp * (a.dur || 0), Math.max(0, (a.dur || 0) - 0.001)); } }""", label='prepare playhead')

    # --- kits: sequences list, creation of layers --------------------------------------------------------------
    P.rep("  KIT_FORMAT: SB.KIT_FORMAT_4, APP_KIT_API,", "  sequences() { const out = []; for (const e of installed.values()) if (e.enabled && e.kit.sequences) for (const s of e.kit.sequences) out.push({ kit: e.kit.id, kitName: e.kit.name, seq: s }); return out; },\n  KIT_FORMAT: SB.KIT_FORMAT_4, APP_KIT_API,", label='K.sequences')

    # --- shell: inspector ----------------------------------------------------------------------------------------
    P.rep("    nl.styleId = id; nl.params = T.newLayer(id).params;\n", "    nl.styleId = id; nl.params = T.newLayer(id).params;\n    if (id === 'sequencer') nl.seq = T.newLayer('sequencer').seq; else delete nl.seq;\n", label='selectStyle seq')
    P.rep("      ${styleGroups(st)}\n      ${group('comp', 'Composite',", "      ${st.id === 'sequencer' ? sequencerHtml(l) : styleGroups(st)}\n      ${group('comp', 'Composite',", label='panel sequencer')
    P.rep("  const mediaInputsOf = st => (st.inputs || []).filter(q => q.type !== 'text');", "  const mediaInputsOf = st => (st.inputs || []).filter(q => q.type !== 'text' && q.type !== 'svg' && q.type !== 'sdf');", label='mediaInputsOf')
    P.rep("  // ---- text inputs (motif-kit@3) ----\n  // One group per text input;", mods['shell-sequencer'] + "  // ---- text inputs (motif-kit@3) ----\n  // One group per text input;", label='insert sequencer ui')
    P.rep("    if (!arrMode) updateAnimatedRows(t);", "    if (!arrMode) { updateAnimatedRows(t); updateSeqHead(t); }", label='seq head tick')

    # --- missing-kit detection and duplicate layer cover sequencer data ------------------------------------------------
    P.rep("function missingKits(project) { const ids = new Set(); for (const l of (project && project.layers) || []) { const k = kitOfStyle(String(l.styleId || '')); if (k && !STYLES.some(s => s.id === l.styleId)) ids.add(k); } return [...ids]; }",
          "function missingKits(project) {\n  const ids = new Set(), chk = id => { const k = kitOfStyle(String(id || '')); if (k && !STYLES.some(s => s.id === id)) ids.add(k); };\n  // A Sequencer layer also needs the kits of the styles its cues call.\n  for (const l of (project && project.layers) || []) { chk(l.styleId); if (l.seq && Array.isArray(l.seq.cues)) for (const c of l.seq.cues) chk(c && c.style); }\n  return [...ids];\n}", label='missingKits')
    P.rep("if (src.media) copy.media = clone(src.media); if (src.text) copy.text = clone(src.text);", "if (src.media) copy.media = clone(src.media); if (src.text) copy.text = clone(src.text); if (src.seq) copy.seq = clone(src.seq);", label='dupLayer seq')

    # --- library tags: svg and distance-field inputs are not media ---------------------------------------------------
    P.rep("${st.inputs && st.inputs.some(q => q.type !== 'text') ? '<span class=\"medtag\" title=\"Takes an image or video\">MEDIA</span>' : ''}",
          "${st.inputs && st.inputs.some(q => q.type !== 'text' && q.type !== 'svg' && q.type !== 'sdf') ? '<span class=\"medtag\" title=\"Takes an image or video\">MEDIA</span>' : ''}${st.inputs && st.inputs.some(q => q.type === 'svg') ? '<span class=\"medtag\" title=\"Draws vector artwork as a distance field\">VECTOR</span>' : ''}", label='library tags')
