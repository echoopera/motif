function createGlRuntime() {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let gl = null, reason = '', halfFloat = false, lost = false, loseExt = null, timerExt = null, parExt = null, frameNo = 0, lostCount = 0;
  const compiling = new Map(); // key -> { def, passes:[{p, v, f, scale}] } while KHR_parallel_shader_compile works in the background
  const programs = new Map(); // key -> { passes:[{prog, uniforms, scale}], error }
  const targets = new Map();  // `${key}|${i}` -> { tex, fbo, w, h, used }
  const gpuMs = new Map();    // key -> EMA of GPU milliseconds per megapixel (when the timer extension exists)
  const pending = [];         // in-flight timer queries
  const listeners = new Set();
  let vao = null, vbo = null, last = { w: 0, h: 0 }, rendererName = '', software = false;
  // Media input textures (SDK 1.1). Keyed by the host's baked canvas; re-uploaded when its rev changes.
  let mediaTex = new Map(), blankTex = null;
  const MEDIA_UNIT = 4;
  const emit = ev => listeners.forEach(fn => { try { fn(ev); } catch (e) { /* listener errors never break rendering */ } });
  function setup() {
    halfFloat = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    gl.getExtension('OES_texture_float_linear');
    loseExt = gl.getExtension('WEBGL_lose_context');
    timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    parExt = gl.getExtension('KHR_parallel_shader_compile');
    try { const di = gl.getExtension('WEBGL_debug_renderer_info'); rendererName = String(gl.getParameter(di ? di.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); } catch (e) { rendererName = ''; }
    software = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|angle \(.*\bcpu\b/i.test(rendererName);
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    mediaTex = new Map();
    blankTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, blankTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  }
  // Upload (or refresh) a baked media canvas as an sRGB texture, so shaders sample linear light.
  function mediaTexture(m) {
    let e = mediaTex.get(m.canvas);
    if (e) { mediaTex.delete(m.canvas); mediaTex.set(m.canvas, e); } // true LRU, including unchanged frames
    if (e && e.rev === m.rev && e.w === m.canvas.width && e.h === m.canvas.height) return e.tex;
    if (!e) {
      e = { tex: gl.createTexture(), rev: -1 }; mediaTex.set(m.canvas, e);
      if (mediaTex.size > 12) { const [k0, e0] = mediaTex.entries().next().value; gl.deleteTexture(e0.tex); mediaTex.delete(k0); }
    }
    const w = m.canvas.width, h = m.canvas.height;
    if (e.w != null && (e.w !== w || e.h !== h)) { gl.deleteTexture(e.tex); e.tex = gl.createTexture(); e.w = null; }
    gl.activeTexture(gl.TEXTURE0 + MEDIA_UNIT + 3); gl.bindTexture(gl.TEXTURE_2D, e.tex);
    if (e.w == null) {
      gl.texStorage2D(gl.TEXTURE_2D, 1 + Math.floor(Math.log2(Math.max(w, h))), gl.SRGB8_ALPHA8, w, h);
      e.w = w; e.h = h;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    try { gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, m.canvas); }
    finally { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); }
    gl.generateMipmap(gl.TEXTURE_2D); // Preserve minification quality, including rotated/scaled media.
    e.rev = m.rev; return e.tex;
  }
  function init() {
    if (gl || !canvas) return !!gl;
    canvas.width = 2; canvas.height = 2;
    try { gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true, depth: false, stencil: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
    if (!gl) { reason = 'WebGL2 is not available in this browser.'; return false; }
    setup();
    // Context loss (a GPU reset, often a watchdog timeout on a long draw): keep the context object,
    // ask the browser to restore it, then rebuild programs lazily. Callers draw a placeholder meanwhile.
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault(); lost = true; lostCount++; pending.length = 0; emit({ type: 'lost', count: lostCount });
      const ext = loseExt; setTimeout(() => { if (lost && ext) { try { ext.restoreContext(); } catch (err) { /* browser restores on its own */ } } }, 1500);
    });
    canvas.addEventListener('webglcontextrestored', () => { lost = false; programs.clear(); targets.clear(); compiling.clear(); setup(); emit({ type: 'restored', count: lostCount }); });
    return true;
  }
  const VS = '#version 300 es\nin vec2 a_pos;\nvoid main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }\n';
  function shader(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  // Maps driver log lines back to pass-local line numbers (the pass source starts at #line 1 1).
  function cleanLog(log) {
    return String(log || '').split('\n').filter(Boolean).map(l => l.replace(/^(ERROR|WARNING): 1:(\d+):/, (m, k, n) => `${k === 'ERROR' ? 'Error' : 'Warning'} line ${n}:`).replace(/^(ERROR|WARNING): 0:(\d+):/, (m, k, n) => `${k === 'ERROR' ? 'Error' : 'Warning'} in prelude/common (line ${n}):`)).slice(0, 12).join('\n');
  }
  function startPass(src, final, common, params, inputs) {
    const { src: fs } = buildSource(src, common, params, final, inputs);
    const v = shader(gl.VERTEX_SHADER, VS), f = shader(gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram(); gl.attachShader(p, v); gl.attachShader(p, f); gl.bindAttribLocation(p, 0, 'a_pos'); gl.linkProgram(p);
    return { p, v, f };
  }
  function finishPass({ p, v, f }) {
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = cleanLog(gl.getShaderInfoLog(f)) || gl.getProgramInfoLog(p);
      gl.deleteProgram(p); gl.deleteShader(v); gl.deleteShader(f);
      if (gl.isContextLost()) return { error: 'lost' };
      return { error: log || 'Shader failed to compile.' };
    }
    gl.deleteShader(v); gl.deleteShader(f);
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), uniforms = {};
    for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); uniforms[u.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, u.name); }
    return { prog: p, uniforms };
  }
  function finalize(key, started) {
    const passes = [];
    for (let i = 0; i < started.length; i++) {
      const r = finishPass(started[i]);
      if (r.error) {
        passes.forEach(x => gl.deleteProgram(x.prog)); started.slice(i + 1).forEach(x => { gl.deleteProgram(x.p); gl.deleteShader(x.v); gl.deleteShader(x.f); });
        if (r.error === 'lost') return { ok: false, error: 'lost', lost: true };
        const e = { error: `Pass ${i + 1}: ${r.error}` }; programs.set(key, e); return { ok: false, error: e.error };
      }
      passes.push({ ...r, scale: started[i].scale });
    }
    programs.set(key, { passes, inputs: started.inputs || [] }); return { ok: true };
  }
  // def: { passes:[{src, scale}], common, params }. Returns { ok, error } or { ok:false, pending:true } while
  // the driver compiles in the background (KHR_parallel_shader_compile), so the UI never freezes on a big shader.
  // sync: true waits for the result (used when importing a kit, to report errors with line numbers).
  function compile(key, def, sync) {
    if (!init()) return { ok: false, error: reason };
    if (lost) return { ok: false, error: 'lost', lost: true };
    if (programs.has(key)) { const e = programs.get(key); return { ok: !e.error, error: e.error }; }
    let job = compiling.get(key);
    if (!job) {
      job = def.passes.map((ps, i) => ({ ...startPass(ps.src, i === def.passes.length - 1, def.common, def.params, def.inputs), scale: Math.min(1, Math.max(0.125, ps.scale || 1)) }));
      job.inputs = def.inputs || []; compiling.set(key, job);
    }
    if (!sync && parExt && !job.every(x => gl.getProgramParameter(x.p, parExt.COMPLETION_STATUS_KHR))) return { ok: false, pending: true };
    compiling.delete(key);
    return finalize(key, job);
  }
  // Finish any background compiles that are ready; returns the keys that completed.
  function poll() {
    const done = [];
    if (!gl || lost || !parExt) return done;
    for (const [key, job] of compiling) if (job.every(x => gl.getProgramParameter(x.p, parExt.COMPLETION_STATUS_KHR))) { compiling.delete(key); finalize(key, job); done.push(key); }
    return done;
  }
  function forget(prefix) {
    if (!gl) return;
    for (const [k, v] of programs) if (k.startsWith(prefix)) { (v.passes || []).forEach(x => gl.deleteProgram(x.prog)); programs.delete(k); }
    for (const [k, v] of targets) if (k.startsWith(prefix)) { gl.deleteTexture(v.tex); gl.deleteFramebuffer(v.fbo); targets.delete(k); }
  }
  function target(key, i, w, h) {
    const k = `${key}|${i}`; let t = targets.get(k);
    if (t && t.w === w && t.h === h) { t.used = frameNo; return t; }
    if (!t) { t = { tex: gl.createTexture(), fbo: gl.createFramebuffer() }; targets.set(k, t); }
    t.w = w; t.h = h; t.used = frameNo;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, halfFloat ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, halfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
    // Evict least-recently-used targets (never one written this frame) beyond 24.
    if (targets.size > 24) {
      let oldK = null, oldT = null;
      for (const [kk, tt] of targets) if (tt.used !== frameNo && (!oldT || tt.used < oldT.used)) { oldK = kk; oldT = tt; }
      if (oldT) { gl.deleteTexture(oldT.tex); gl.deleteFramebuffer(oldT.fbo); targets.delete(oldK); }
    }
    return t;
  }
  // Collect finished GPU timer queries into a per-style cost estimate (ms per megapixel).
  function pollTimers() {
    if (!timerExt) return;
    const disjoint = gl.getParameter(timerExt.GPU_DISJOINT_EXT);
    for (let i = pending.length - 1; i >= 0; i--) {
      const q = pending[i];
      if (!gl.getQueryParameter(q.q, gl.QUERY_RESULT_AVAILABLE)) continue;
      const ns = gl.getQueryParameter(q.q, gl.QUERY_RESULT); gl.deleteQuery(q.q); pending.splice(i, 1);
      if (disjoint || !(ns > 0)) continue;
      const perMpx = (ns / 1e6) / Math.max(0.01, q.px / 1e6);
      const prev = gpuMs.get(q.key); gpuMs.set(q.key, prev == null ? perMpx : prev * 0.75 + perMpx * 0.25);
    }
  }
  // Render style `key` at w×h. u: { p, L, seed, safe, pal:{bg,ink,a}, params, spec, media }.
  // media: { <inputId>: { canvas, rev, w, h, time } } — baked by the host at the frame's aspect (see inputSource).
  // opt.scale renders internally at w·scale × h·scale (blit upsamples); opt.bands splits every pass into
  // horizontal bands flushed separately, so one very heavy frame never becomes one long GPU submission.
  function draw(key, w, h, u, opt = {}) {
    if (!init() || lost) return null;
    const entry = programs.get(key); if (!entry || entry.error) return null;
    frameNo++;
    const sc = Math.min(1, Math.max(0.2, opt.scale || 1));
    w = Math.max(1, Math.round(w * sc)); h = Math.max(1, Math.round(h * sc));
    const bands = Math.max(1, Math.min(32, Math.round(opt.bands || 1)));
    if (canvas.width < w || canvas.height < h) { canvas.width = Math.max(canvas.width, w); canvas.height = Math.max(canvas.height, h); }
    const pal = [hexToLin(u.pal.bg), hexToLin(u.pal.ink), ...u.pal.a.slice(0, 3).map(hexToLin)];
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    pollTimers();
    let query = null;
    if (timerExt && pending.length < 4) { query = gl.createQuery(); gl.beginQuery(timerExt.TIME_ELAPSED_EXT, query); }
    // DOM uploads can flush the graphics pipeline. Finish them before submitting any shader passes.
    const inputs = entry.inputs.map(q => u.media && u.media[q.id] ? mediaTexture(u.media[q.id]) : blankTex);
    const texs = [];
    entry.passes.forEach((ps, i) => {
      const lastPass = i === entry.passes.length - 1;
      const pw = lastPass ? w : Math.max(1, Math.round(w * ps.scale)), ph = lastPass ? h : Math.max(1, Math.round(h * ps.scale));
      if (lastPass) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, pw, ph); }
      else { const t = target(key, i, pw, ph); gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo); gl.viewport(0, 0, pw, ph); texs.push(t.tex); }
      gl.useProgram(ps.prog); const U = ps.uniforms;
      if (U.u_res) gl.uniform2f(U.u_res, pw, ph);
      if (U.u_p) gl.uniform1f(U.u_p, u.p);
      if (U.u_L) gl.uniform1f(U.u_L, u.L);
      if (U.u_seed) gl.uniform1f(U.u_seed, u.seed);
      if (U.u_safe) gl.uniform1f(U.u_safe, u.safe ? 1 : 0);
      ['u_bg', 'u_ink', 'u_a0', 'u_a1', 'u_a2'].forEach((n, j) => { if (U[n]) gl.uniform3fv(U[n], pal[j]); });
      for (let b = 0; b < MAX_PASSES; b++) { const n = 'u_buf' + b; if (U[n]) { gl.activeTexture(gl.TEXTURE0 + b); gl.bindTexture(gl.TEXTURE_2D, b < i ? texs[b] || null : null); gl.uniform1i(U[n], b); } }
      entry.inputs.forEach((q, j) => {
        const loc = U['u_' + q.id]; const m = u.media && u.media[q.id];
        if (U['u_' + q.id + 'On']) gl.uniform1f(U['u_' + q.id + 'On'], m ? 1 : 0);
        if (U['u_' + q.id + 'Size']) gl.uniform2f(U['u_' + q.id + 'Size'], m ? m.w : 0, m ? m.h : 0);
        if (U['u_' + q.id + 'Time']) gl.uniform1f(U['u_' + q.id + 'Time'], m ? m.time || 0 : 0);
        if (!loc) return;
        // An SDK 1.0 kit that declared the sampler itself read u_buf0 (unit 0) when nothing was bound; keep that fallback.
        if (!m && q.implicit) { gl.uniform1i(loc, 0); return; }
        const tex = inputs[j];
        gl.activeTexture(gl.TEXTURE0 + MEDIA_UNIT + j); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(loc, MEDIA_UNIT + j);
      });
      for (const [k, sp] of Object.entries(u.spec)) {
        const loc = U['p_' + k]; if (!loc) continue; const v = u.params[k];
        if (sp.type === 'range') gl.uniform1f(loc, +v);
        else if (sp.type === 'int') gl.uniform1i(loc, Math.round(v));
        else if (sp.type === 'toggle') gl.uniform1i(loc, v ? 1 : 0);
        else if (sp.type === 'select') gl.uniform1i(loc, Math.max(0, sp.options.findIndex(o => o.v === v)));
      }
      gl.enable(gl.SCISSOR_TEST);
      if (lastPass) { gl.scissor(0, 0, pw, ph); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      const nb = Math.min(bands, ph);
      for (let b = 0; b < nb; b++) {
        const y0 = Math.floor((b * ph) / nb), y1 = Math.floor(((b + 1) * ph) / nb);
        gl.scissor(0, y0, pw, y1 - y0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (nb > 1) gl.flush();
      }
      gl.disable(gl.SCISSOR_TEST);
    });
    if (query) { gl.endQuery(timerExt.TIME_ELAPSED_EXT); pending.push({ q: query, key, px: w * h }); }
    last = { w, h };
    return canvas;
  }
  // Copy the last draw (bottom-left of the GL canvas) into a 2D context at 0,0, scaled to w×h.
  function blit(ctx, w, h) {
    const sw = last.w || Math.round(w), sh = last.h || Math.round(h);
    const up = sw !== Math.round(w) || sh !== Math.round(h);
    if (up) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
    ctx.drawImage(canvas, 0, canvas.height - sh, sw, sh, 0, 0, w, h);
  }
  return {
    init, compile, poll, forget, draw, blit, canvas, hexToLin, programs, get pendingCompiles() { return compiling.size; },
    get ok() { return init(); }, get reason() { return reason; }, get halfFloat() { return halfFloat; },
    get lost() { return lost; }, get lostCount() { return lostCount; }, get timer() { return !!timerExt; }, get renderer() { init(); return rendererName; }, get software() { init(); return software; },
    costOf(key) { return gpuMs.get(key); }, on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
