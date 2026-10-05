# MotifGraph engine integration: the graph module, project model (timeline), compositor (layer scope + composite scope), pipeline hooks.
def apply(P, mods):
    # --- module registration -----------------------------------------------------------------------------------------------
    P.before("// ---- module: compositor v1.0.0\n", mods['graph-engine'] + "\n", label='insert graph module')
    P.rep("__m_timeline, __m_audio, __m_gpu_engine, __m_compositor, __m_finish, __m_grade, __m_scopes, __m_renderer, __m_worker_shim, __m_render_worker })\\n//# sourceURL=motif-engine.js'",
          "__m_timeline, __m_graph, __m_audio, __m_gpu_engine, __m_compositor, __m_finish, __m_grade, __m_scopes, __m_renderer, __m_worker_shim, __m_render_worker })\\n//# sourceURL=motif-engine.js'", label='engine tuple')
    P.rep("const { __m_tokens, __m_engine_core, __m_style_library, __m_kit_gl, __m_kit_v4, __m_kit_sandbox, __m_text_atlas, __m_kits, __m_kit_host, __m_colour, __m_timeline, __m_audio,",
          "const { __m_tokens, __m_engine_core, __m_style_library, __m_kit_gl, __m_kit_v4, __m_kit_sandbox, __m_text_atlas, __m_kits, __m_kit_host, __m_colour, __m_timeline, __m_graph, __m_audio,", label='engine destructure')

    # --- timeline: paths (M:<layerId|@>:<nodeId>:<key>), sanitize, evaluate ------------------------------------------------
    P.rep("const GR = () => (typeof __m_grade !== 'undefined' ? __m_grade : null); // resolved at call time (module loads later)",
          "const GR = () => (typeof __m_grade !== 'undefined' ? __m_grade : null); // resolved at call time (module loads later)\n"
          "const MG = () => (typeof __m_graph !== 'undefined' ? __m_graph : null); // MotifGraph: layer graphs (layer.graph) and the composite graph (project.graph)\n"
          "const gHolder = (pr, scope) => (scope === '@' ? pr.graph : (layerById(pr, scope) || {}).graph) || null;", label='MG accessor')
    P.rep("  const g = /^G:([^:]+):(.+)$/.exec(path); if (g) return { kind: 'G', node: g[1], key: g[2] };\n  return null;",
          "  const g = /^G:([^:]+):(.+)$/.exec(path); if (g) return { kind: 'G', node: g[1], key: g[2] };\n  const mg = /^M:([^:]+):([^:]+):(.+)$/.exec(path); if (mg) return { kind: 'M', scope: mg[1], node: mg[2], key: mg[3] };\n  return null;", label='parsePath M')
    P.rep("  if (p.kind === 'G') return GR() && pr.grade ? GR().schemaAt(pr.grade, p.node, p.key) : null;\n  const l = layerById(pr, p.layer); if (!l) return null;",
          "  if (p.kind === 'G') return GR() && pr.grade ? GR().schemaAt(pr.grade, p.node, p.key) : null;\n  if (p.kind === 'M') { const g = gHolder(pr, p.scope); return MG() && g ? MG().schemaAt(g, p.node, p.key) : null; }\n  const l = layerById(pr, p.layer); if (!l) return null;", label='schemaAt M')
    P.rep("  if (p.kind === 'G') { const n = GR() && GR().nodeById(pr.grade, p.node); return n ? n.params[p.key] : undefined; }\n  const l = layerById(pr, p.layer); if (!l) return undefined;",
          "  if (p.kind === 'G') { const n = GR() && GR().nodeById(pr.grade, p.node); return n ? n.params[p.key] : undefined; }\n  if (p.kind === 'M') { const g = gHolder(pr, p.scope), n = MG() && g && MG().nodeById(g, p.node), s = n && MG().schemaFor(n.type)[p.key]; return n ? (p.key in n.params ? n.params[p.key] : s && s.def) : undefined; }\n  const l = layerById(pr, p.layer); if (!l) return undefined;", label='getBase M')
    P.rep("  if (p.kind === 'F') next.finish[p.key] = v; else if (p.kind === 'G') GR().nodeById(next.grade, p.node).params[p.key] = v;\n  else if (p.scope === 't')",
          "  if (p.kind === 'F') next.finish[p.key] = v; else if (p.kind === 'G') GR().nodeById(next.grade, p.node).params[p.key] = v;\n  else if (p.kind === 'M') MG().nodeById(gHolder(next, p.scope), p.node).params[p.key] = v;\n  else if (p.scope === 't')", label='setBase M')
    P.rep("  if (p.kind === 'G') return `Grade ${pr.grade.nodes.findIndex(n => n.id === p.node) + 1} ${s.label}`;\n",
          "  if (p.kind === 'G') return `Grade ${pr.grade.nodes.findIndex(n => n.id === p.node) + 1} ${s.label}`;\n  if (p.kind === 'M') { const g = gHolder(pr, p.scope); return `${p.scope === '@' ? 'Composite' : 'L' + (pr.layers.findIndex(l => l.id === p.scope) + 1)} ${MG().nodeLabel(g, MG().nodeById(g, p.node))} ${s.label}`; }\n", label='pathLabel M')
    P.rep("    push('p', getStyle(l.styleId).params); push('s', SHARED_SCHEMA); push('c', COMP_SCHEMA);\n",
          "    push('p', getStyle(l.styleId).params); push('s', SHARED_SCHEMA); push('c', COMP_SCHEMA);\n    if (l.graph && MG()) out.push(...MG().paths(l.graph, l.id, numericOnly, `Layer ${i + 1} graph`));\n", label='allPaths layer graph')
    P.rep("  if (pr.grade && GR()) out.push(...GR().paths(pr.grade, numericOnly));\n  return out;",
          "  if (pr.grade && GR()) out.push(...GR().paths(pr.grade, numericOnly));\n  if (pr.graph && MG()) out.push(...MG().paths(pr.graph, '@', numericOnly, 'Composite graph'));\n  return out;", label='allPaths composite graph')
    P.rep("  if (look.styleId === 'sequencer') out.seq = (KV() && KV().sanitizeSeq(l.seq)) || defaultSeq();\n  return out;",
          "  if (look.styleId === 'sequencer') out.seq = (KV() && KV().sanitizeSeq(l.seq)) || defaultSeq();\n  if (l.graph && MG()) { const g = MG().sanitizeGraph(l.graph, 'layer'); if (g) out.graph = g; } // MotifGraph (motif-graph@1)\n  return out;", label='sanitizeLayer graph')
    P.rep("  if (pr.grade && GR()) { const g = GR().sanitizeGrade(pr.grade); if (g) out.grade = g; }\n",
          "  if (pr.grade && GR()) { const g = GR().sanitizeGrade(pr.grade); if (g) out.grade = g; }\n  if (pr.graph && MG()) { const g = MG().sanitizeGraph(pr.graph, '@'); if (g) out.graph = g; } // composite MotifGraph\n", label='sanitizeProject graph')
    P.rep("seq: l.seq ? clone(l.seq) : null }));\n  const finish = { ...pr.finish };", "seq: l.seq ? clone(l.seq) : null, graph: l.graph && MG() ? MG().evalCopy(l.graph) : null }));\n  const finish = { ...pr.finish };", label='evaluate graph copy')
    P.rep("  const grade = pr.grade && GR() ? GR().evalCopy(pr.grade) : null; if (grade) finish.grade = grade;\n",
          "  const grade = pr.grade && GR() ? GR().evalCopy(pr.grade) : null; if (grade) finish.grade = grade;\n  const cgraph = pr.graph && MG() ? MG().evalCopy(pr.graph) : null;\n", label='evaluate composite copy')
    P.rep("    if (p.kind === 'G') { const n = grade && grade.nodes.find(x => x.id === p.node), s = n && GR().schemaFor(n.type)[p.key]; if (s) n.params[p.key] = fn(n.params[p.key], s); return; }\n",
          "    if (p.kind === 'G') { const n = grade && grade.nodes.find(x => x.id === p.node), s = n && GR().schemaFor(n.type)[p.key]; if (s) n.params[p.key] = fn(n.params[p.key], s); return; }\n"
          "    if (p.kind === 'M') { const g = p.scope === '@' ? cgraph : (byId.get(p.scope) || {}).graph, n = g && g.nodes.find(x => x.id === p.node), s = n && MG().schemaFor(n.type)[p.key]; if (s) n.params[p.key] = fn(n.params[p.key], s); return; }\n", label='evaluate apply M')
    P.rep("      apply(m.path, (cur, s) => { if (!s || (s.type !== 'range' && s.type !== 'int')) return cur; let v = cur + m.amount * (s.max - s.min) * e; v = clamp(v, s.min, s.max); return s.type === 'int' ? Math.round(v) : v; });\n    }\n  }\n  return { layers, finish, u };",
          "      apply(m.path, (cur, s) => { if (!s || (s.type !== 'range' && s.type !== 'int')) return cur; let v = cur + m.amount * (s.max - s.min) * e; v = clamp(v, s.min, s.max); return s.type === 'int' ? Math.round(v) : v; });\n    }\n  }\n"
          "  // The Sound effector reads the eight audio bands at this time (loop-exact when the audio is a loop; zeros without audio).\n"
          "  let spec = null; if (MG() && ((cgraph && MG().usesSound(cgraph)) || layers.some(l => l.graph && MG().usesSound(l.graph)))) { const at = ((pr.audio && pr.audio.offset) || 0) + t; spec = BANDS.map(b => { const e = env ? env(b.id, at, 0.25) : null; return e == null ? 0 : e; }); }\n"
          "  return { layers, finish, u, graph: cgraph, spec };", label='evaluate spec + return')

    # --- compositor: layer scope (before blend, mask applies to the result) and composite scope (pre-finish) ------------------
    P.rep("const KV = __m_kit_v4;\nconst { evaluate } = __m_timeline;", "const KV = __m_kit_v4;\nconst MG = typeof __m_graph !== 'undefined' ? __m_graph : null; // MotifGraph\nconst { evaluate } = __m_timeline;", label='compositor MG')
    P.rep("  // Shape mask into canvas m (white = keep). Coordinates relative to the frame.",
"""  // ---- MotifGraph ---------------------------------------------------------------------------------------------------------
  // The graph reads `ctx`'s own canvas as its source texture and writes the result back into ctx (layer scope: the layer's scratch
  // canvas, before its mask and blend; composite scope: the whole frame). One WebGL2 context per page or Worker; it never touches
  // the kit engine's context. If WebGL2 is missing or the graph faults, the picture passes through unchanged.
  let grender = null;
  const rgb01 = hex => __m_colour.hexToRgb01(hex || '#000000');
  const palX = pal => ({ ink: rgb01(pal.ink), a0: rgb01(pal.a[0] || pal.ink), a1: rgb01(pal.a[1] || pal.a[0] || pal.ink), a2: rgb01(pal.a[2] || pal.a[1] || pal.a[0] || pal.ink), bg: rgb01(pal.bg) });
  function graphRenderer() { return grender || (grender = MG.createRenderer()); }
  function syncC(c) { try { (c._ctx || c.getContext('2d')).getImageData(0, 0, 1, 1); } catch (e) { /* tainted or unavailable */ } }
  const gstat = { used: false, failed: false, error: '' }; // per frame: did a graph run, did it fault (the Graph page shows it loudly)
  function applyGraph(ctx, w, h, graph, X, space, tag) {
    gstat.used = true; const r = graphRenderer(); if (!r.ok) { gstat.failed = true; gstat.error = r.error || 'WebGL2 is unavailable'; return false; }
    const stg = MG.stageOf(graph), mix = stg ? stg.params.mix : 1, src = ctx.canvas;
    r.setSpace(space);
    const out = r.render(src, graph, X, w, h); if (!out) { gstat.failed = true; gstat.error = r.error || 'GPU error'; return false; }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none';
    if (mix >= 0.999) { ctx.globalCompositeOperation = 'copy'; ctx.globalAlpha = 1; ctx.drawImage(out, 0, 0, w, h); }
    else { const cp = scratch('GM' + tag, w, h, space); cp._ctx.setTransform(1, 0, 0, 1, 0, 0); cp._ctx.globalCompositeOperation = 'copy'; cp._ctx.globalAlpha = 1; cp._ctx.drawImage(src, 0, 0);
      ctx.globalCompositeOperation = 'copy'; ctx.globalAlpha = 1 - mix; ctx.drawImage(cp, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = mix; ctx.drawImage(out, 0, 0, w, h); }
    ctx.restore(); return true;
  }
  const layerP = (l, t) => { const sh = l.shared, L = sh.loop || 6; return (((t / L) * (sh.tempo || 1) + (sh.phase || 0)) % 1 + 1) % 1; };
  // Composite graph placed after the finishing stack (graph.place === 'post'); called by the pipeline.
  function applyPost(ctx, w, h, ev, t, opts = {}) {
    if (!MG || opts.cpu || !ev.graph || ev.graph.place !== 'post' || !MG.active(ev.graph)) return false;
    const l0 = ev.layers[0], pal = resolvePalette(l0.shared.palette, l0.shared.invert, opts.customs || []);
    return applyGraph(ctx, w, h, ev.graph, { A: w / h, p: ev.u, pal: palX(pal), spec: ev.spec || [0, 0, 0, 0, 0, 0, 0, 0] }, opts.space || 'srgb', 'P');
  }

  // Shape mask into canvas m (white = keep). Coordinates relative to the frame.""", label='compositor helpers')
    P.rep("&& l.visible && !(layers[i + 1] && /^matte/.test(layers[i + 1].comp.mask));\n      if (direct)", "&& l.visible && !(layers[i + 1] && /^matte/.test(layers[i + 1].comp.mask)) && !(MG && !opts.cpu && MG.active(l.graph));\n      if (direct)", label='direct path skips graph layers')
    P.rep("      const r = renderLook(lc._ctx, w, h, l, t, pal, { bg: fillBg, cpu: opts.cpu, onError: opts.onError, customs }); engines.push(r.engine);\n",
          "      const r = renderLook(lc._ctx, w, h, l, t, pal, { bg: fillBg, cpu: opts.cpu, onError: opts.onError, customs }); engines.push(r.engine);\n"
          "      if (MG && !opts.cpu && MG.active(l.graph)) { if (r.engine === 'gpu') syncC(lc); applyGraph(lc._ctx, w, h, l.graph, { A: w / h, p: layerP(l, t), pal: palX(pal), spec: ev.spec || [0, 0, 0, 0, 0, 0, 0, 0] }, space, 'L' + i); }\n", label='layer scope hook')
    P.rep("    // A matte source that is itself hidden was rendered into a scratch canvas only — nothing to undo.\n    ctx.restore();\n    return { pal: firstPal || resolvePalette('signal', false, customs), engines };",
          "    // A matte source that is itself hidden was rendered into a scratch canvas only — nothing to undo.\n"
          "    const fp = firstPal || resolvePalette('signal', false, customs);\n"
          "    if (MG && !opts.cpu && ev.graph && ev.graph.place !== 'post' && MG.active(ev.graph)) { if (engines.includes('gpu')) syncC(ctx.canvas); applyGraph(ctx, w, h, ev.graph, { A: w / h, p: ev.u, pal: palX(fp), spec: ev.spec || [0, 0, 0, 0, 0, 0, 0, 0] }, space, 'C'); }\n"
          "    ctx.restore();\n    return { pal: fp, engines };", label='composite pre hook')
    P.rep("  return { renderLook, renderEvaluated, renderProject, scratch };", "  return { renderLook, renderEvaluated, renderProject, scratch, applyPost, graph: () => grender, graphReset: () => { gstat.used = false; gstat.failed = false; gstat.error = ''; }, graphState: () => ({ ...gstat }) };", label='compositor exports')

    # --- pipeline: composite graph after the finishing stack ---------------------------------------------------------------------
    P.rep("      cpuFinish(ctx, w, h, f, pal, t, opts.transparent);\n      return { u: ev0.u, engines, samples, post: 'cpu' };\n    }\n    const comp = compositor.scratch('comp', w, h, space);",
          "      cpuFinish(ctx, w, h, f, pal, t, opts.transparent); compositor.applyPost(ctx, w, h, ev0, t, common);\n      return { u: ev0.u, engines, samples, post: 'cpu' };\n    }\n    const comp = compositor.scratch('comp', w, h, space);", label='post graph (cpu finish)')
    P.rep("cpuFinish(ctx, w, h, f, pal, t, opts.transparent); return { u: ev0.u, engines, samples, post: 'cpu' }; }\n    } else {",
          "cpuFinish(ctx, w, h, f, pal, t, opts.transparent); compositor.applyPost(ctx, w, h, ev0, t, common); return { u: ev0.u, engines, samples, post: 'cpu' }; }\n    } else {", label='post graph (accumulate fallback)')
    P.rep("    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(glc, 0, 0, w, h); ctx.restore();\n    return { u: ev0.u, engines, samples, post: 'gpu' };",
          "    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'copy'; ctx.drawImage(glc, 0, 0, w, h); ctx.restore();\n    compositor.applyPost(ctx, w, h, ev0, t, common);\n    return { u: ev0.u, engines, samples, post: 'gpu' };", label='post graph (gpu finish)')

    # --- frame info: the Graph page reads stage.info.graph (works the same from the render Worker) ---------------------------------
    P.rep("    const ev0 = evaluate(project, t, opts.env), f = ev0.finish;\n", "    compositor.graphReset();\n    const ev0 = evaluate(project, t, opts.env), f = ev0.finish;\n", label='graph status reset')
    P.rep("samples, post: 'cpu' };", "samples, post: 'cpu', graph: compositor.graphState() };", count=2, label='graph status (cpu)')
    P.rep("samples, post: 'gpu' };", "samples, post: 'gpu', graph: compositor.graphState() };", label='graph status (gpu)')
