// ---- module: scopes v1.0.0
const __m_scopes = (() => {
// scopes — waveform (luma), RGB parade, vectorscope (graticule, 75% targets, skin-tone line) and histogram,
// computed on the GPU from a finished frame: mip-downsample to a sample grid, scatter one point per sample
// (gl_VertexID, no vertex buffers) into float accumulation targets with additive blending, then shade the
// result. The only readback is the 256-bin histogram (4 KB) that feeds the numeric readout.
// Engine-side: takes any canvas (HTMLCanvasElement or OffscreenCanvas) and any TexImageSource; no DOM.
// Labels are returned as data for the caller to place in DOM — no text is ever drawn into the canvas.

const MODES = [{ id: 'wave', l: 'Waveform' }, { id: 'parade', l: 'Parade' }, { id: 'vector', l: 'Vector' }, { id: 'hist', l: 'Histogram' }];
const SPACES = [{ id: 'rec709', l: 'Rec.709', K: [0.2126, 0.7152, 0.0722] }, { id: 'p3', l: 'P3', K: [0.2289746, 0.6917385, 0.0792869] }];
const VR = 0.6; // vectorscope: graticule radius = chroma magnitude 0.6 (100% red sits at 0.86 of the radius)
const SKIN_DEG = 123; // conventional flesh-tone (I) line, degrees counter-clockwise from +Cb
const BARS = [['R', [0.75, 0, 0]], ['Yl', [0.75, 0.75, 0]], ['G', [0, 0.75, 0]], ['Cy', [0, 0.75, 0.75]], ['B', [0, 0, 0.75]], ['Mg', [0.75, 0, 0.75]]];
const spaceOf = id => SPACES.find(s => s.id === id) || SPACES[0];
const modeIndex = id => Math.max(0, MODES.findIndex(m => m.id === id));
// Vectorscope position of an RGB colour, in plot units (−1..1, +y up) for a colour interpretation.
function vecPos(space, r, g, b) { const [kr, kg, kb] = spaceOf(space).K; const y = kr * r + kg * g + kb * b; return { x: (b - y) / (2 * (1 - kb)) / VR, y: (r - y) / (2 * (1 - kr)) / VR }; }
function targets(space) { return BARS.map(([id, c]) => ({ id, ...vecPos(space, ...c) })); }
// Plot rectangle in canvas pixels (GL convention: y from the bottom). Padding leaves room for DOM labels.
function plotRect(mode, w, h, dpr = 1) {
  const t = 8 * dpr, b = (mode === 'hist' ? 20 : 8) * dpr, l = (mode === 'hist' ? 8 : 32) * dpr, r = 8 * dpr;
  if (mode === 'vector') { const s = Math.max(8, Math.min(w - 2 * r, h - t - b)); return { x: Math.round((w - s) / 2), y: Math.round((h - s) / 2), w: Math.round(s), h: Math.round(s) }; }
  return { x: Math.round(l), y: Math.round(b), w: Math.max(8, Math.round(w - l - r)), h: Math.max(8, Math.round(h - t - b)) };
}
// Label layout for the caller's DOM overlay, in CSS pixels from the top-left.
function labels(mode, space, cssW, cssH) {
  const r = plotRect(mode, cssW, cssH, 1), top = v => cssH - (r.y + v * r.h), out = [];
  if (mode === 'wave' || mode === 'parade') {
    for (const v of [0, 25, 50, 75, 100]) out.push({ text: String(v), x: r.x - 6, y: top(v / 100), align: 'end' });
    if (mode === 'parade') ['R', 'G', 'B'].forEach((t, i) => out.push({ text: t, x: r.x + r.w * (i + 0.5) / 3, y: top(1) + 10, align: 'mid' }));
  } else if (mode === 'hist') {
    for (const v of [0, 25, 50, 75, 100]) out.push({ text: String(v), x: r.x + r.w * v / 100, y: cssH - 10, align: v === 0 ? 'start' : v === 100 ? 'end' : 'mid' });
  } else {
    const cx = r.x + r.w / 2, cy = cssH - (r.y + r.h / 2), R = r.w / 2;
    for (const t of targets(space)) { const d = Math.hypot(t.x, t.y) || 1, k = (d + 0.17) / d; out.push({ text: t.id, x: cx + t.x * k * R, y: cy - t.y * k * R, align: 'mid' }); }
    const a = SKIN_DEG * Math.PI / 180; out.push({ text: 'Skin', x: cx + Math.cos(a) * 1.1 * R, y: cy - Math.sin(a) * 1.1 * R, align: 'mid' });
  }
  return { rect: { x: r.x, y: cssH - r.y - r.h, w: r.w, h: r.h }, labels: out };
}

const VS_QUAD = `#version 300 es
void main(){ vec2 a = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0; gl_Position = vec4(a, 0.0, 1.0); }`;
const FS_DOWN = `#version 300 es
precision highp float; uniform sampler2D T; uniform vec2 gs; out vec4 o; void main(){ o = vec4(texture(T, gl_FragCoord.xy / gs).rgb, 1.0); }`;
// One point per sample. mode 0 luma, 1 parade (instance = channel), 2 vector, 3 histogram (instance = R,G,B,Y).
const VS_SCATTER = `#version 300 es
precision highp float; uniform sampler2D T; uniform ivec2 grid; uniform int mode, stride; uniform vec3 K; uniform vec2 acc; out vec4 col;
void main(){
  int id = gl_VertexID * stride + gl_VertexID % stride; ivec2 q = ivec2(id % grid.x, id / grid.x); vec3 c = clamp(texelFetch(T, q, 0).rgb, 0.0, 1.0); float Y = dot(c, K);
  int ch = gl_InstanceID; vec2 pos; float u = (float(q.x) + 0.5) / float(grid.x), lv = acc.y - 1.0;
  if (mode == 0) { pos = vec2(u, (floor(Y * lv + 0.5) + 0.5) / acc.y); col = vec4(1.0, 0.0, 0.0, 0.0); }
  else if (mode == 1) { float v = ch == 0 ? c.r : ch == 1 ? c.g : c.b; pos = vec2((float(ch) + u) / 3.0, (floor(v * lv + 0.5) + 0.5) / acc.y); col = vec4(ch == 0 ? 1.0 : 0.0, ch == 1 ? 1.0 : 0.0, ch == 2 ? 1.0 : 0.0, 0.0); }
  else if (mode == 2) { float cb = (c.b - Y) / (2.0 * (1.0 - K.b)), cr = (c.r - Y) / (2.0 * (1.0 - K.r)); pos = vec2(cb, cr) / ${VR.toFixed(3)} * 0.5 + 0.5; col = vec4(c, 1.0); }
  else { float v = ch == 0 ? c.r : ch == 1 ? c.g : ch == 2 ? c.b : Y; pos = vec2((floor(v * 255.0 + 0.5) + 0.5) / 256.0, 0.5); col = vec4(ch == 0 ? 1.0 : 0.0, ch == 1 ? 1.0 : 0.0, ch == 2 ? 1.0 : 0.0, ch == 3 ? 1.0 : 0.0); }
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0); gl_PointSize = 1.0;
}`;
const FS_SCATTER = `#version 300 es
precision highp float; in vec4 col; out vec4 o; void main(){ o = col; }`;
// Shading: graticule lines are geometry (not text); trace intensity = 1 − exp(−hits·k).
const FS_SHOW = `#version 300 es
precision highp float; out vec4 o;
uniform sampler2D A; uniform int mode; uniform vec4 rect; uniform float k, dpr; uniform vec4 hmax;
uniform vec3 bg, well, grid, gridHi, cY, cR, cG, cB, cSkin; uniform vec2 tg[6]; uniform vec2 skin;
float ln(float d){ return 1.0 - smoothstep(0.35 * dpr, 0.85 * dpr, abs(d)); }
void main(){
  vec2 f = gl_FragCoord.xy; vec2 l = (f - rect.xy) / rect.zw; vec3 c = bg; ivec2 as = textureSize(A, 0);
  bool inside = l.x >= 0.0 && l.x <= 1.0 && l.y >= 0.0 && l.y <= 1.0;
  ivec2 t = ivec2(clamp(floor(l * vec2(as)), vec2(0.0), vec2(as) - 1.0));
  if (mode <= 1) {
    if (inside) c = well;
    if (l.x >= -0.002 && l.x <= 1.002) for (int i = 0; i <= 10; i++) { float g = ln(f.y - (rect.y + float(i) * 0.1 * rect.w)); c = mix(c, (i == 0 || i == 10) ? gridHi : grid, g * ((i == 0 || i == 10) ? 0.9 : i == 5 ? 0.7 : 0.4)); }
    if (mode == 1 && inside) { c = mix(c, gridHi, ln(f.x - (rect.x + rect.z / 3.0)) * 0.8); c = mix(c, gridHi, ln(f.x - (rect.x + rect.z * 2.0 / 3.0)) * 0.8); }
    if (inside) { vec4 a = texelFetch(A, t, 0); vec3 e = 1.0 - exp(-a.rgb * k); c += mode == 0 ? cY * e.r : cR * e.r + cG * e.g + cB * e.b; }
  } else if (mode == 2) {
    vec2 q = l * 2.0 - 1.0; float r = length(q), px = 2.0 / rect.z;
    if (r <= 1.0) c = well;
    c = mix(c, gridHi, ln((r - 1.0) / px) * 0.9);
    c = mix(c, grid, ln((r - 0.5) / px) * 0.35);
    if (r <= 1.0) { c = mix(c, grid, ln(q.x / px) * 0.4); c = mix(c, grid, ln(q.y / px) * 0.4); }
    if (r <= 1.0 && dot(q, skin) > 0.0) c = mix(c, cSkin, ln((q.x * skin.y - q.y * skin.x) / px) * 0.85);
    for (int i = 0; i < 6; i++) { vec2 d = abs(q - tg[i]); float bx = max(d.x, d.y) - 0.055; c = mix(c, gridHi, ln(bx / px) * 0.9); }
    if (inside && r <= 1.02) { vec4 a = texelFetch(A, t, 0); if (a.a > 0.0) { vec3 h = a.rgb / a.a; h = h / max(max(h.r, max(h.g, h.b)), 0.08); float e = 1.0 - exp(-a.a * k); c += mix(vec3(1.0), clamp(h, 0.0, 1.0), 0.75) * e; } }
  } else {
    if (inside) {
      c = well;
      for (int i = 1; i < 4; i++) c = mix(c, grid, ln(f.x - (rect.x + float(i) * 0.25 * rect.z)) * 0.4);
      vec4 a = texelFetch(A, ivec2(t.x, 0), 0); vec4 h = a / max(hmax, vec4(1e-6));
      c += 0.55 * (cR * step(l.y, h.r) + cG * step(l.y, h.g) + cB * step(l.y, h.b));
      c = mix(c, cY, ln((l.y - h.a) * rect.w) * 0.9);
    }
    c = mix(c, gridHi, ln(f.y - rect.y) * 0.8);
  }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const hex3 = h => { const s = String(h || '#000000').trim().replace('#', ''); const v = parseInt(s.length === 3 ? s.split('').map(x => x + x).join('') : s.slice(0, 6), 16) || 0; return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; };
const DEFAULT_STYLE = { bg: '#0A0A0C', well: '#101014', grid: '#3A3A44', gridHi: '#6A6A76', cY: '#59DCFF', cR: '#FF5C5C', cG: '#4FE08A', cB: '#5C8CFF', cSkin: '#F0A23B' };

function createScopes(canvas) {
  let gl = null, reason = '';
  try { gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
  if (!gl) return { ok: false, reason: 'Scopes need WebGL2, which this browser has turned off.' };
  const cbf = gl.getExtension('EXT_color_buffer_float'), fblend = gl.getExtension('EXT_float_blend');
  if (!cbf) return { ok: false, reason: 'Scopes need floating-point render targets, which this GPU does not offer.' };
  const accFmt = fblend ? gl.RGBA32F : gl.RGBA16F;
  const mk = (vs, fs) => {
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p, u };
  };
  let P;
  try { P = { down: mk(VS_QUAD, FS_DOWN), scatter: mk(VS_SCATTER, FS_SCATTER), show: mk(VS_QUAD, FS_SHOW) }; }
  catch (e) { return { ok: false, reason: 'The scope shaders failed to compile: ' + (e.message || e) }; }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const tex = (w, h, fmt, type, filter) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
    return t;
  };
  const target = (w, h, fmt) => { const t = tex(w, h, fmt, 0, gl.NEAREST); const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; };
  const free = r => { if (r) { gl.deleteTexture(r.t); gl.deleteFramebuffer(r.f); } };
  const src = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, src);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  let grid = null, acc = null, accKey = '', hist = target(256, 1, accFmt);
  let style = { ...DEFAULT_STYLE }; let last = null; const histBuf = new Float32Array(256 * 4);
  let lastMode = 'wave', lastSpace = 'rec709';

  function setStyle(s) { style = { ...style, ...s }; }
  // src: canvas / ImageBitmap / video. opt: { mode, space, exact }. Returns { ms, grid:[w,h], samples, stats }.
  function update(source, opt = {}) {
    const t0 = performance.now();
    const mode = MODES.some(m => m.id === opt.mode) ? opt.mode : 'wave', space = spaceOf(opt.space).id; lastMode = mode; lastSpace = space;
    const sw = source.width || source.videoWidth || 0, sh = source.height || source.videoHeight || 0; if (!sw || !sh) return null;
    const cap = opt.exact ? 1024 : 320; const gw = Math.max(16, Math.min(sw, cap)), gh = Math.max(9, Math.round(gw * sh / sw));
    // upload: interpret the frame in the chosen space (P3 keeps P3-encoded values; Rec.709 converts to sRGB primaries)
    gl.bindTexture(gl.TEXTURE_2D, src);
    try { if ('unpackColorSpace' in gl) gl.unpackColorSpace = space === 'p3' ? 'display-p3' : 'srgb'; } catch (e) { /* unsupported */ }
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source); gl.generateMipmap(gl.TEXTURE_2D);
    if (!grid || grid.w !== gw || grid.h !== gh) { free(grid); grid = target(gw, gh, gl.RGBA8); }
    gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, grid.f); gl.viewport(0, 0, gw, gh); gl.useProgram(P.down.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform1i(P.down.u.T, 0); gl.uniform2f(P.down.u.gs, gw, gh); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // accumulate
    const aw = mode === 'vector' ? 256 : mode === 'hist' ? 256 : gw, ah = mode === 'vector' ? 256 : mode === 'hist' ? 1 : 256, key = `${mode}|${aw}x${ah}`;
    if (key !== accKey) { if (mode !== 'hist') { free(acc); acc = target(aw, ah, accFmt); } accKey = key; }
    const N = gw * gh; gl.useProgram(P.scatter.p); gl.bindTexture(gl.TEXTURE_2D, grid.t); gl.uniform1i(P.scatter.u.T, 0); gl.uniform2i(P.scatter.u.grid, gw, gh);
    gl.uniform3fv(P.scatter.u.K, spaceOf(space).K); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.blendEquation(gl.FUNC_ADD); gl.clearColor(0, 0, 0, 0);
    const scatter = (r, m, inst, stride) => { gl.bindFramebuffer(gl.FRAMEBUFFER, r.f); gl.viewport(0, 0, r.w, r.h); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1i(P.scatter.u.mode, m); gl.uniform1i(P.scatter.u.stride, stride); gl.uniform2f(P.scatter.u.acc, r.w, r.h); gl.drawArraysInstanced(gl.POINTS, 0, Math.floor(N / stride), inst); };
    if (mode !== 'hist') scatter(acc, modeIndex(mode), mode === 'parade' ? 3 : 1, 1);
    // The histogram feeds the readout in every mode; outside histogram mode every 4th sample is enough for the numbers.
    const hs = mode === 'hist' ? 1 : 4; scatter(hist, 3, 4, hs);
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, hist.f); gl.readPixels(0, 0, 256, 1, gl.RGBA, gl.FLOAT, histBuf);
    const stats = statsOf(histBuf, Math.floor(N / hs));
    last = { mode, space, gw, gh, N, stats };
    show();
    return { ms: performance.now() - t0, grid: [gw, gh], samples: N, stats, acc: fblend ? 'float32' : 'float16' };
  }
  function show() {
    if (!last) return;
    const { mode, space, gw, gh, N, stats } = last, W = canvas.width, H = canvas.height, dpr = Math.max(1, W / Math.max(1, (canvas.clientWidth || W)));
    const r = plotRect(mode, W, H, dpr);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(P.show.p); gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mode === 'hist' ? hist.t : acc.t); gl.uniform1i(P.show.u.A, 0);
    const u = P.show.u; gl.uniform1i(u.mode, modeIndex(mode)); gl.uniform4f(u.rect, r.x, r.y, r.w, r.h); gl.uniform1f(u.dpr, dpr);
    // brightness: a column spread evenly over every level reads ~45%; a tight trace saturates
    const k = mode === 'wave' ? 256 / gh * 0.6 : mode === 'parade' ? 256 / (3 * gh) * 0.6 * 3 : mode === 'vector' ? 65536 / N * 0.35 : 1;
    gl.uniform1f(u.k, k);
    const mx = Math.max(stats.max[0], stats.max[1], stats.max[2], 1); gl.uniform4f(u.hmax, mx, mx, mx, Math.max(stats.max[3], 1));
    for (const n of ['bg', 'well', 'grid', 'gridHi', 'cY', 'cR', 'cG', 'cB', 'cSkin']) if (u[n]) gl.uniform3fv(u[n], hex3(style[n]));
    if (u['tg[0]']) gl.uniform2fv(u['tg[0]'], new Float32Array(targets(space).flatMap(t => [t.x, t.y])));
    const a = SKIN_DEG * Math.PI / 180; if (u.skin) gl.uniform2f(u.skin, Math.cos(a), Math.sin(a));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  // Test/automation hook: the raw accumulation (small textures only).
  function read(kind = 'acc') {
    const r = kind === 'hist' ? hist : acc; if (!r) return null;
    const out = new Float32Array(r.w * r.h * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, r.f); gl.readPixels(0, 0, r.w, r.h, gl.RGBA, gl.FLOAT, out); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { w: r.w, h: r.h, data: out };
  }
  function destroy() { free(grid); free(acc); free(hist); gl.deleteTexture(src); for (const p of Object.values(P)) gl.deleteProgram(p.p); const lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext(); }
  return { ok: true, reason, accFormat: fblend ? 'float32' : 'float16', update, show, read, setStyle, destroy, get last() { return last; }, get mode() { return lastMode; }, get space() { return lastSpace; }, get lost() { return gl.isContextLost(); } };
}
// Readout numbers from the 256-bin histogram (R, G, B, Y per bin).
function statsOf(h, N) {
  const max = [0, 0, 0, 0], tot = [0, 0, 0, 0]; for (let i = 0; i < 256; i++) for (let c = 0; c < 4; c++) { const v = h[i * 4 + c]; tot[c] += v; if (v > max[c]) max[c] = v; }
  const n = tot[3] || N || 1, pct = q => { let s = 0; for (let i = 0; i < 256; i++) { s += h[i * 4 + 3]; if (s >= q * n) return i / 255; } return 1; };
  const lo = Math.max(h[0], h[1], h[2]) / n, hi = Math.max(h[255 * 4], h[255 * 4 + 1], h[255 * 4 + 2]) / n;
  let mean = 0; for (let i = 0; i < 256; i++) mean += h[i * 4 + 3] * i / 255; mean /= n;
  return { samples: n, max, low: pct(0.005), high: pct(0.995), median: pct(0.5), mean, clipLow: lo, clipHigh: hi };
}

return { MODES, SPACES, VR, SKIN_DEG, targets, vecPos, plotRect, labels, statsOf, createScopes, DEFAULT_STYLE };

})();

