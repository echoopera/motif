import json, os, re, sys
ROOT = os.path.dirname(os.path.abspath(__file__))  # src/ folder: motif-2.1-base.html, catalog.json, parts/
src = open(f'{ROOT}/motif-2.1-base.html').read()
src = src[src.index('\n') + 1:]  # drop the publish wrapper line
def rep(s, old, new, count=1):
    n = s.count(old)
    if n != count: raise SystemExit(f'patch mismatch ({n}x, want {count}): {old[:90]!r}')
    return s.replace(old, new)
def between(s, a, b, new, inclusive_b=False):
    i = s.index(a); j = s.index(b, i)
    if inclusive_b: j += len(b)
    return s[:i] + new + s[j:]

css = open(f'{ROOT}/parts/style.css').read()
body = open(f'{ROOT}/parts/body.html').read()
tail = open(f'{ROOT}/parts/body_tail.html').read()
tail = tail.replace('<dt>← →</dt><dd>Step one frame (Shift: ten)</dd>', '<dt>← →</dt><dd>Step one frame (Shift: ten)</dd><dt>Home</dt><dd>Go to the first frame</dd>')
tail = tail.replace('<h2 id="exportTitle">Export</h2>', '<h2 id="exportTitle">Deliver</h2>')

# ---------- head ----------
src = rep(src, '<title>Motif Style Lab 2.1</title>', '<title>Motif 3</title>')
src = rep(src, '<meta name="color-scheme" content="light dark">', '<meta name="color-scheme" content="dark">')
FONT_OLD = 'https://fonts.googleapis.com/css2?family=Anybody:wdth,wght@50..150,100..900&family=Fraunces:opsz,wght@9..144,300..900&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;700;800&display=swap'
FONT_NEW = 'https://fonts.googleapis.com/css2?family=Anybody:wdth,wght@50..150,100..900&family=Fraunces:opsz,wght@9..144,300..900&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;700;800&display=swap'
src = rep(src, f'<link rel="stylesheet" href="{FONT_OLD}">', f'<link rel="stylesheet" href="{FONT_NEW}">')
i = src.index('<style>'); j = src.index('</style>', i)
src = src[:i] + '<style>\n' + css + '\n' + src[j:]
i = src.index('<div class="app" id="app"'); j = src.index('<input type="file" id="kitFile"', i)
k = src.index('<script', j)
src = src[:i] + body + tail + src[k:]

# ---------- JS copies of the shell markup and styles ----------
i = src.index('const shellCss = `'); j = src.index('`;', i)
src = src[:i] + 'const shellCss = `\n' + css + src[j:]
i = src.index('const shellHtml = `'); j = src.index('`;', i)
src = src[:i] + 'const shellHtml = `\n' + body + tail + src[j:]

# ---------- kit catalog ----------
cat = json.load(open(f'{ROOT}/catalog.json'))
i = src.index('const KIT_CATALOG = ') + len('const KIT_CATALOG = ')
_, end = json.JSONDecoder().raw_decode(src[i:])
src = src[:i] + json.dumps(cat, separators=(',', ':')) + src[i + end:]

# ---------- kit-gl runtime ----------
i = src.index('function createGlRuntime() {'); j = src.index('return { KIT_FORMAT, KIT_LIMITS', i)
src = src[:i] + open(f'{ROOT}/parts/glrt.js').read() + '\n' + src[j:]
src = rep(src, "styles.push({ id: `${m.id}/${s.id}`, localId: s.id,", "const cost = Math.max(0.25, Math.min(24, Number(s.cost) || 1));\n    styles.push({ id: `${m.id}/${s.id}`, localId: s.id, cost,")
src = rep(src, "// kit-gl — WebGL2 runtime for Motif Kit shader styles (motif-kit@1).", "// kit-gl v2 (Motif 3) — WebGL2 runtime for Motif Kit shader styles (motif-kit@1): adaptive internal\n// resolution, banded submission for heavy frames, LRU render targets and context-loss recovery.")

# ---------- kits registry ----------
src = rep(src, """function drawProblem(ctx, S, msg) {
  const { w, h, pal } = S;
  ctx.save(); ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = pal.accent(0); ctx.lineWidth = Math.max(1, S.u * 0.004); ctx.setLineDash([S.u * 0.02, S.u * 0.02]);
  ctx.strokeRect(S.u * 0.04, S.u * 0.04, w - S.u * 0.08, h - S.u * 0.08); ctx.setLineDash([]);""", """function drawProblem(ctx, S, msg, soft) {
  const { w, h, pal } = S;
  ctx.save(); ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, w, h);
  if (!soft) {
    ctx.strokeStyle = pal.accent(0); ctx.lineWidth = Math.max(1, S.u * 0.004); ctx.setLineDash([S.u * 0.02, S.u * 0.02]);
    ctx.strokeRect(S.u * 0.04, S.u * 0.04, w - S.u * 0.08, h - S.u * 0.08); ctx.setLineDash([]);
  }""")
i = src.index('    render(ctx, S) {\n      const c = rt.compile(st.id, def);'); j = src.index('\n  };\n}\n\nfunction register(entry)', i)
src = src[:i] + open(f'{ROOT}/parts/kitrender.js').read().rstrip('\n').rstrip(',') + src[j:]
src = rep(src, "kit: kit.id, kitName: kit.name, palette: st.palette, flash: st.flash, engine: 'glsl', passes: st.passes.length, params,",
               "kit: kit.id, kitName: kit.name, palette: st.palette, flash: st.flash, engine: 'glsl', passes: st.passes.length, cost: st.cost || 1, params,")
src = rep(src, "function persist() {\n  const kits = [...installed.values()]", open(f'{ROOT}/parts/governor.js').read() + "\nfunction persist() {\n  const kits = [...installed.values()]")
src = rep(src, "  KIT_FORMAT: KG.KIT_FORMAT, APP_KIT_API, LOWPASS_BELOW, runtime: rt, install,", "  KIT_FORMAT: KG.KIT_FORMAT, APP_KIT_API, LOWPASS_BELOW, runtime: rt, setPreview, reportFrame, gpuStatus, install,")
src = rep(src, "const STORE_KEY = 'motif-kits-v1';", "const STORE_KEY = 'motif-kits-v3';")

src = rep(src, '    const r = rt.compile(st.id, def);', '    const r = rt.compile(st.id, def, true);')

# ---------- renderer: stage preview flag + frame governor ----------
src = rep(src, """    const pr = getProject(); const t0 = performance.now();
    try { lastInfo = pipeline.renderFrame(""", """    const pr = getProject(); const t0 = performance.now();
    __m_kits.setPreview(true);
    try { lastInfo = pipeline.renderFrame(""")
src = rep(src, """    catch (e) { if (onError) onError(e); }
    timings.push(performance.now() - t0);""", """    catch (e) { if (onError) onError(e); }
    finally { __m_kits.setPreview(false); }
    timings.push(performance.now() - t0);""")
src = rep(src, "    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;",
               "    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;\n    if (last && playing && !document.hidden) __m_kits.reportFrame(now - last);\n    last = now;")

# ---------- cooperative export ----------
src = rep(src, "runtime: rt, setPreview, reportFrame, gpuStatus, install,", "runtime: rt, setPreview, reportFrame, gpuStatus, job: JOB, install,")
# compositor must not swallow the suspend signal
src = rep(src, "    } catch (e) { if (opts.onError) opts.onError(e); }\n    ctx.restore(); ctx.setLineDash && ctx.setLineDash([]);\n    return { p: S.p, engine };",
               "    } catch (e) { if (e && e.isSuspend) { ctx.restore(); throw e; } if (opts.onError) opts.onError(e); }\n    ctx.restore(); ctx.setLineDash && ctx.setLineDash([]);\n    return { p: S.p, engine };")
# renderFrame: resumable shutter loop
src = rep(src, "    const comp = compositor.scratch('comp', w, h, space);\n    const fps = out.fps || 30;\n    if (samples > 1) {\n      const acc = finisher.ok ? null : compositor.scratch('acc', w, h, space);\n      if (finisher.ok) { finisher.setSpace(space); finisher.beginAccum(w, h); }\n      else acc._ctx.clearRect(0, 0, w, h);\n      for (let k = 0; k < samples; k++) {",
               "    const comp = compositor.scratch('comp', w, h, space);\n    const fps = out.fps || 30;\n    const job = opts.job && opts.job.on ? opts.job : null;\n    if (samples > 1) {\n      const acc = finisher.ok ? null : compositor.scratch('acc', w, h, space);\n      const k0 = job ? job.k : 0;\n      if (k0 === 0) { if (finisher.ok) { finisher.setSpace(space); finisher.beginAccum(w, h); } else acc._ctx.clearRect(0, 0, w, h); }\n      else { pal = job.pal; engines = job.engines; if (finisher.ok) finisher.setSpace(space); }\n      for (let k = k0; k < samples; k++) {")
src = rep(src, "        if (k === 0) { pal = r.pal; engines = r.engines; }\n        if (finisher.ok) { if (r.engines.includes('gpu')) syncCanvas(comp); finisher.addAccum(comp, 1 / samples); }\n        else { acc._ctx.globalAlpha = 1 / (k + 1); acc._ctx.drawImage(comp, 0, 0); acc._ctx.globalAlpha = 1; }\n      }",
               "        if (k === 0) { pal = r.pal; engines = r.engines; if (job) { job.pal = pal; job.engines = engines; } }\n        if (finisher.ok) { if (r.engines.includes('gpu')) syncCanvas(comp); finisher.addAccum(comp, 1 / samples); }\n        else { acc._ctx.globalAlpha = 1 / (k + 1); acc._ctx.drawImage(comp, 0, 0); acc._ctx.globalAlpha = 1; }\n        if (job) { job.sampleDone(); if (k + 1 < samples && job.expired()) throw { isSuspend: true }; }\n      }")
# stage: never draw while an export job owns the shared pipeline
src = rep(src, "    if (dirty) draw();\n  }\n  makeCanvasEl();", "    if (dirty && !(__m_kits.job && __m_kits.job.on)) draw();\n  }\n  makeCanvasEl();")
# yield via MessageChannel (not throttled in background tabs like setTimeout)
src = rep(src, "const tick = () => new Promise(r => setTimeout(r, 0));", """const tick = (() => { try { const ch = new MessageChannel(), q = []; ch.port1.onmessage = () => { const f = q.shift(); f && f(); }; return () => new Promise(r => { q.push(r); ch.port2.postMessage(0); }); } catch (e) { return () => new Promise(r => setTimeout(r, 0)); } })();
// One frame, rendered in short slices so Cancel is honoured within ~100 ms even for very heavy frames.
async function frameCoop(pipeline, ctx, w, h, project, t, ropts, job, signal) {
  if (!job) { if (signal && signal.aborted) throw abortErr(); return pipeline.renderFrame(ctx, w, h, project, t, ropts); }
  job.begin();
  try {
    for (;;) {
      if (signal && signal.aborted) throw abortErr();
      job.arm();
      try { return pipeline.renderFrame(ctx, w, h, project, t, { ...ropts, job }); }
      catch (e) { if (!(e && e.isSuspend)) throw e; await tick(); }
    }
  } finally { job.end(); }
}""")
# exporter: video + png sequence + single png use frameCoop
src = rep(src, "async function encodeVideo(pipeline, project, s, caps, env, audio, onProgress, signal) {", "async function encodeVideo(pipeline, project, s, caps, env, audio, onProgress, signal, job) {")
src = rep(src, "  pipeline.renderFrame(ctx, w, h, project, 0, ropts); // warm-up", "  await frameCoop(pipeline, ctx, w, h, project, 0, ropts, job, signal); // warm-up")
src = rep(src, "    pipeline.renderFrame(ctx, w, h, project, frameTime(project, s.fps, i), ropts);\n    const img", "    await frameCoop(pipeline, ctx, w, h, project, frameTime(project, s.fps, i), ropts, job, signal);\n    const img")
src = rep(src, "async function pngSequence(pipeline, project, s, env, onProgress, signal) {", "async function pngSequence(pipeline, project, s, env, onProgress, signal, job) {")
src = rep(src, "  pipeline.renderFrame(ctx, w, h, project, 0, { transparent: s.transparent, env });\n  for (let i = 0; i < N; i++) {\n    if (signal && signal.aborted) throw abortErr();\n    pipeline.renderFrame(ctx, w, h, project, frameTime(project, s.fps, i), { transparent: s.transparent, env });",
               "  await frameCoop(pipeline, ctx, w, h, project, 0, { transparent: s.transparent, env }, job, signal);\n  for (let i = 0; i < N; i++) {\n    if (signal && signal.aborted) throw abortErr();\n    await frameCoop(pipeline, ctx, w, h, project, frameTime(project, s.fps, i), { transparent: s.transparent, env }, job, signal);")
src = rep(src, "async function runExport(project, s, { pipeline, env, audio, onProgress, signal } = {}) {", "async function runExport(project, s, { pipeline, env, audio, onProgress, signal, job } = {}) {")
src = rep(src, "    pipeline.renderFrame(ctx, w, h, project, s.time || 0, { transparent: s.transparent, env });\n    return { blob: await canvasPng(c)", "    await frameCoop(pipeline, ctx, w, h, project, s.time || 0, { transparent: s.transparent, env }, job, signal);\n    return { blob: await canvasPng(c)")
src = rep(src, "return { blob: await pngSequence(pipeline, project, s, env, onProgress, signal),", "return { blob: await pngSequence(pipeline, project, s, env, onProgress, signal, job),")
src = rep(src, "const r = await encodeVideo(pipeline, project, s, caps, env, s.withAudio ? audio : null, onProgress, signal);", "const r = await encodeVideo(pipeline, project, s, caps, env, s.withAudio ? audio : null, onProgress, signal, job);")

# ---------- export timing: where does each frame go? ----------
src = rep(src, "    await frameCoop(pipeline, ctx, w, h, project, frameTime(project, s.fps, i), ropts, job, signal);\n    const img = ctx.getImageData(0, 0, w, h);\n    const yuv = toI420(img.data, w, h, space.video.fullRange, alpha);",
"""    const T0 = performance.now();
    await frameCoop(pipeline, ctx, w, h, project, frameTime(project, s.fps, i), ropts, job, signal);
    const T1 = performance.now();
    const img = ctx.getImageData(0, 0, w, h);
    const T2 = performance.now();
    const yuv = toI420(img.data, w, h, space.video.fullRange, alpha);
    const T3 = performance.now();""")
src = rep(src, "    while (enc.encodeQueueSize > 4) await tick();\n    onProgress && onProgress((i + 1) / N * (acodec ? 0.95 : 1), `Rendering frame ${i + 1} of ${N}`);",
"""    const T4 = performance.now();
    // Bounded backpressure: some encoders (Safari's) hold frames until more arrive, so never wait on the queue forever.
    for (let w0 = performance.now(); enc.encodeQueueSize > 4 && (enc.encodeQueueSize > 40 ? performance.now() - w0 < 20000 : performance.now() - w0 < 30); ) { if (signal && signal.aborted) break; if (failure) throw failure; await tick(); }
    if (enc.encodeQueueSize > 40) throw new Error('The video encoder stopped responding. Try WebM, or a smaller size.');
    const T5 = performance.now();
    const tm = (g.__exportTiming = g.__exportTiming || { n: 0, draw: 0, read: 0, conv: 0, enc: 0, wait: 0 });
    tm.n++; tm.draw += T1 - T0; tm.read += T2 - T1; tm.conv += T3 - T2; tm.enc += T4 - T3; tm.wait += T5 - T4;
    const av = k => Math.round(tm[k] / tm.n);
    onProgress && onProgress((i + 1) / N * (acodec ? 0.95 : 1), `Rendering frame ${i + 1} of ${N} · draw ${av('draw')} ms · read ${av('read')} · convert ${av('conv')} · encode ${av('enc') + av('wait')}`);""")
src = rep(src, "  await frameCoop(pipeline, ctx, w, h, project, 0, ropts, job, signal); // warm-up", "  g.__exportTiming = null;\n  await frameCoop(pipeline, ctx, w, h, project, 0, ropts, job, signal); // warm-up")

exec(open(f'{ROOT}/parts/kitgl_media.py').read())
exec(open(f'{ROOT}/parts/kitgl_params.py').read())
# ---------- shell ----------
exec(open(f'{ROOT}/parts/shell_patch.py').read())
exec(open(f'{ROOT}/parts/media_shell.py').read())
exec(open(f'{ROOT}/parts/params_shell.py').read())
src = rep(src, "bitrate: Math.round(w * h * s.fps * 0.16)", "bitrate: Math.round(w * h * s.fps * 0.3)")
# Safari's H.264 encoder never drains in 'quality' mode (it holds frames until flush); realtime works, so give it more bits to compensate.
src = rep(src, "latencyMode: 'quality', ...(alpha", "latencyMode: /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ? 'realtime' : 'quality', ...(alpha")
src = rep(src, "bitrate: Math.round(w * h * s.fps * 0.3)", "bitrate: Math.round(w * h * s.fps * ({ standard: 0.3, high: 0.55, max: 1.0 }[s.quality] || 0.55))")
src = src.replace('<div class="field"><span class="lbl">Motion blur</span><span class="summary" id="exBlur"></span></div>', '<div class="field"><span class="lbl">Motion blur</span><span class="summary" id="exBlur"></span></div>\n      <label class="field"><span class="lbl">Video quality</span><select id="exQuality"><option value="standard">Standard · smaller file</option><option value="high" selected>High</option><option value="max">Maximum · large file</option></select></label>')
src = rep(src, "const ex = { format: 'mp4', tier: 1080, loops: 1, transparent: false, withAudio: true };", "const ex = { format: 'mp4', tier: 1080, loops: 1, transparent: false, withAudio: true, quality: 'high' };")
src = rep(src, "  $('exLoops').addEventListener('change', e => { ex.loops = Number(e.target.value); exSummary(); });", "  $('exLoops').addEventListener('change', e => { ex.loops = Number(e.target.value); exSummary(); });\n  $('exQuality').addEventListener('change', e => { ex.quality = e.target.value; });")
src = rep(src, "['exFps', 'exLoops'].forEach(id => { $(id).disabled = still; });", "['exFps', 'exLoops'].forEach(id => { $(id).disabled = still; }); $('exQuality').disabled = !(ex.format === 'mp4' || ex.format === 'webm');")
# ---------- Check speed: also time the real export path ----------
src = rep(src, "    try {\n      const rows = []; const vis = project.layers.filter(l => l.visible !== false);",
"""    try {
      // The real export path: cooperative render, full readback, colour convert, on the export canvas. Two frames at the loop start.
      const xp = { draw: 0, read: 0, conv: 0 }; let xn = 0;
      try {
        const { c: xc, ctx: xctx } = makeExportCanvas(w, h, project.output.space); const sp = spaceById(project.output.space);
        for (let i = 0; i < 3; i++) {
          const T0 = performance.now(); await frameCoop(pipeline, xctx, w, h, project, frameTime(project, fps, i), { env: envFn, space: sp.id }, K.job, null);
          const T1 = performance.now(); const im = xctx.getImageData(0, 0, w, h); const T2 = performance.now(); toI420(im.data, w, h, sp.video.fullRange, false); const T3 = performance.now();
          if (i > 0) { xp.draw += T1 - T0; xp.read += T2 - T1; xp.conv += T3 - T2; xn++; }
        }
        for (const k in xp) xp[k] /= xn || 1;
      } catch (e) { xn = 0; }
      const rows = []; const vis = project.layers.filter(l => l.visible !== false);""")
src = rep(src, "      const perFrame = total * shutter + 60; // + readback and colour conversion allowance",
"      const measured = xn ? xp.draw + xp.read + xp.conv : 0;\n      const perFrame = Math.max(total * shutter + 60, measured);")
src = rep(src, "        `<i class=\"rule\"></i><span class=\"sum\">One frame at ${w}×${h}</span>",
"        (xn ? `<span>Export path: draw / read / convert</span><b>${fmt(xp.draw)} / ${fmt(xp.read)} / ${fmt(xp.conv)}</b>` : '') +\n        `<i class=\"rule\"></i><span class=\"sum\">One frame at ${w}×${h}</span>")

open(f'{ROOT}/../Motif3.html', 'w').write(src)
print('built', len(src))
