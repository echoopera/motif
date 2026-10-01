// ---- module: finish v1.0.0
const __m_finish = (() => {
// finish — the GPU finishing stack (WebGL2): motion-blur accumulation in half float, threshold
// glow, chromatic offset, depth blur (tilt / radial / luma depth), levels, gradient map,
// vignette, deterministic grain, broadcast-safe limiter and an illegal-colour zebra.
// Input is any canvas; output is this module's WebGL canvas (premultiplied), drawn by the caller.

const VS = `#version 300 es
in vec2 a; out vec2 uv; void main(){ uv = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }`;

const FS_COPY = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D T; uniform float W; out vec4 o;
void main(){ o = texture(T, vec2(uv.x, 1.0 - uv.y)) * W; }`;

// Bright pass (reads premultiplied input, writes straight glow colour).
const FS_BRIGHT = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D T; uniform float thr; out vec4 o;
void main(){ vec4 c = texture(T, uv); vec3 s = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  float l = dot(s, vec3(0.2126, 0.7152, 0.0722)); float k = smoothstep(thr, min(1.0, thr + 0.25), l);
  o = vec4(s * k * c.a, c.a * k); }`;

const FS_BLUR = `#version 300 es
precision highp float; in vec2 uv; uniform sampler2D T; uniform vec2 dir; out vec4 o;
void main(){ const float w0 = 0.2270270270, w1 = 0.3162162162, w2 = 0.0702702703;
  vec4 c = texture(T, uv) * w0;
  c += (texture(T, uv + dir * 1.3846153846) + texture(T, uv - dir * 1.3846153846)) * w1;
  c += (texture(T, uv + dir * 3.2307692308) + texture(T, uv - dir * 3.2307692308)) * w2;
  o = c; }`;

const FS_FINAL = `#version 300 es
precision highp float; in vec2 uv; out vec4 o;
uniform sampler2D I, G, D1, D2; uniform vec2 res;
uniform float glow, chroma, depth, focus, depthMode, black, white, gam, gmap, vig, grain, frame, legal, zebra, useG, useD;
uniform vec3 s0, s1, s2, shade;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 unp(vec4 c){ return c.a > 0.0 ? c.rgb / c.a : vec3(0.0); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 legalize(vec3 c){
  float Y = luma(c); vec3 d = c - Y; float knee = 0.92;
  if (Y > knee) Y = knee + (1.0 - knee) * (1.0 - exp(-(Y - knee) / (1.0 - knee)));
  float amp = max(max(abs(d.r), abs(d.g)), abs(d.b)); float room = min(1.1 - Y, Y + 0.1);
  float k = (amp > room && amp > 0.0) ? room / amp : 1.0; return clamp(Y + d * k, 0.0, 1.0); }
bool illegal(vec3 c){ float Y = luma(c); float amp = max(max(abs(c.r - Y), abs(c.g - Y)), abs(c.b - Y)); return Y > 0.99 || Y + amp > 1.1 || Y - amp < -0.1; }
void main(){
  vec2 p = uv; vec4 base = texture(I, p);
  vec3 c = unp(base); float a = base.a;
  if (chroma > 0.0) {
    vec2 dir = (p - 0.5) * chroma * 0.018;
    vec4 r = texture(I, p + dir), b = texture(I, p - dir);
    c = vec3(unp(r).r, c.g, unp(b).b); a = max(a, max(r.a, b.a));
  }
  if (useD > 0.5) {
    float dv = depthMode < 0.5 ? p.y : depthMode < 1.5 ? length((p - 0.5) * vec2(res.x / res.y, 1.0)) / 0.8 : 1.0 - luma(c);
    float coc = clamp(depth * abs((1.0 - dv) - focus) * 2.5, 0.0, 1.0);
    vec4 d1 = texture(D1, p), d2 = texture(D2, p);
    vec4 cc = mix(vec4(c * a, a), d1, smoothstep(0.0, 0.5, coc)); cc = mix(cc, d2, smoothstep(0.5, 1.0, coc));
    c = unp(cc); a = cc.a;
  }
  if (useG > 0.5) { vec4 g = texture(G, p); vec3 gl = g.rgb * glow * 2.2; c = 1.0 - (1.0 - c) * (1.0 - clamp(gl, 0.0, 1.0)); a = max(a, clamp(g.a * glow * 2.0, 0.0, 1.0)); }
  c = clamp((c - black) / max(0.001, white - black), 0.0, 1.0); c = pow(c, vec3(1.0 / gam));
  if (gmap > 0.0) { float l = luma(c); vec3 m = l < 0.5 ? mix(s0, s1, l * 2.0) : mix(s1, s2, (l - 0.5) * 2.0); c = mix(c, m, gmap); }
  if (vig > 0.0) { float r = length((p - 0.5) * res) / (0.5 * length(res)); float k = clamp((r - 0.35) / 0.65, 0.0, 1.0) * vig * 0.7; c = mix(c, shade, k); }
  if (grain > 0.0) {
    float sc = max(1.0, min(res.x, res.y) / 720.0); vec2 q = floor(gl_FragCoord.xy / sc) + vec2(frame * 17.0, frame * 31.0);
    float h = h21(q); if (h < 0.137) { float s = h21(q + 7.1); float al = (0.25 + 0.75 * h21(q + 3.3)) * grain * 0.55; c = mix(c, vec3(step(0.5, s)), al); }
  }
  if (legal > 0.5) c = legalize(c);
  if (zebra > 0.5 && illegal(c)) { float s = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 12.0)); c = mix(c, vec3(s), 0.65); }
  o = vec4(c * a, a);
}`;

function createFinisher() {
  let canvas, gl, ok = false, halfFloat = false, space = 'srgb';
  const prog = {}; let quad; let W = 0, H = 0; const tex = {}; const fbo = {};
  const init = () => { try {
    if (!canvas) { canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2; }
    gl = gl || canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true });
    if (gl) {
      halfFloat = !!gl.getExtension('EXT_color_buffer_float');
      gl.getExtension('OES_texture_float_linear');
      const mk = (fs) => {
        const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
        const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'a'); gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
        const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
        return { p, u };
      };
      prog.copy = mk(FS_COPY); prog.bright = mk(FS_BRIGHT); prog.blur = mk(FS_BLUR); prog.final = mk(FS_FINAL);
      quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      ok = true;
    }
  } catch (e) { console.error('finish:', e); ok = false; } }; init();
  // GPU reset / WEBGL_lose_context: fall back to the CPU finish while lost, then rebuild programs and targets on restore (was: stayed blank forever).
  if (canvas) { const lose = gl && gl.getExtension('WEBGL_lose_context'); canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ok = false; setTimeout(() => { try { if (lose && gl.isContextLost()) lose.restoreContext(); } catch (err) { /* the browser restores on its own */ } }, 1500); }); canvas.addEventListener('webglcontextrestored', () => { for (const k of Object.keys(tex)) delete tex[k]; W = H = 0; init(); if (ok) setSpace(space); }); }

  function mkTex(w, h, float) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (float && halfFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }
  function resize(w, h) {
    if (w === W && h === H) return; W = w; H = h; canvas.width = w; canvas.height = h;
    for (const k of Object.keys(tex)) { gl.deleteTexture(tex[k].t); gl.deleteFramebuffer(tex[k].f); delete tex[k]; }
    const h2 = [Math.max(1, w >> 1), Math.max(1, h >> 1)], h4 = [Math.max(1, w >> 2), Math.max(1, h >> 2)];
    tex.in = mkTex(w, h, true); tex.src = { t: gl.createTexture() };
    gl.bindTexture(gl.TEXTURE_2D, tex.src.t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    tex.a2 = mkTex(...h2, true); tex.b2 = mkTex(...h2, true); tex.a4 = mkTex(...h4, true); tex.b4 = mkTex(...h4, true);
    tex.d2 = mkTex(...h2, true); tex.d4 = mkTex(...h4, true); tex.e4 = mkTex(...h4, true);
  }
  function draw(pg, target, uniforms, textures) {
    gl.useProgram(pg.p); gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, target ? target.w : W, target ? target.h : H);
    let unit = 0; for (const [name, t] of Object.entries(textures || {})) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(pg.u[name], unit); unit++; }
    for (const [name, v] of Object.entries(uniforms || {})) { const loc = pg.u[name]; if (loc == null) continue; if (Array.isArray(v)) (v.length === 2 ? gl.uniform2fv : gl.uniform3fv).call(gl, loc, v); else gl.uniform1f(loc, v); }
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  function upload(src) {
    gl.bindTexture(gl.TEXTURE_2D, tex.src.t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }
  function setSpace(s) {
    space = s; if (!ok) return;
    const cs = s === 'p3' ? 'display-p3' : 'srgb';
    try { if ('drawingBufferColorSpace' in gl) gl.drawingBufferColorSpace = cs; if ('unpackColorSpace' in gl) gl.unpackColorSpace = cs; } catch (e) { /* unsupported */ }
  }
  // Motion blur: clear the half-float accumulator, then add sub-frames with weights summing to 1.
  function beginAccum(w, h) { resize(w, h); gl.bindFramebuffer(gl.FRAMEBUFFER, tex.in.f); gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  function addAccum(src, weight) {
    upload(src); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    draw(prog.copy, tex.in, { W: weight }, { T: tex.src.t }); gl.disable(gl.BLEND);
  }
  function loadInput(src, w, h) { resize(w, h); upload(src); gl.disable(gl.BLEND); draw(prog.copy, tex.in, { W: 1 }, { T: tex.src.t }); }
  function blur2(srcT, a, b, radius) { draw(prog.blur, a, { dir: [radius / a.w, 0] }, { T: srcT }); draw(prog.blur, b, { dir: [0, radius / a.h] }, { T: a.t }); }
  // f: finish values; x: { stops:[[r,g,b]×3], shade:[r,g,b], frame, legal, zebra }
  function process(f, x) {
    const useG = f.glow > 0.001, useD = f.depth > 0.001;
    if (useG) {
      draw(prog.bright, tex.a2, { thr: f.glowThreshold }, { T: tex.in.t });
      const r = 1 + f.glowRadius * 6;
      blur2(tex.a2.t, tex.b2, tex.a2, r);
      draw(prog.copy, tex.a4, { W: 1 }, { T: tex.a2.t });
      blur2(tex.a4.t, tex.b4, tex.a4, r * 1.5); blur2(tex.a4.t, tex.b4, tex.a4, r * 2.5);
    }
    if (useD) {
      blur2(tex.in.t, tex.b2, tex.d2, 2.5);
      draw(prog.copy, tex.e4, { W: 1 }, { T: tex.d2.t }); blur2(tex.e4.t, tex.b4, tex.d4, 4);
      if (!useG) { /* a4 unused */ }
    }
    draw(prog.final, null, {
      res: [W, H], glow: f.glow, chroma: f.chroma, depth: f.depth, focus: f.focus, depthMode: { tilt: 0, radial: 1, luma: 2 }[f.depthMode] || 0,
      black: f.black, white: f.white, gam: f.gamma, gmap: f.gmap, vig: f.vignette, grain: f.grain, frame: x.frame || 0,
      legal: x.legal ? 1 : 0, zebra: x.zebra ? 1 : 0, useG: useG ? 1 : 0, useD: useD ? 1 : 0,
      s0: x.stops[0], s1: x.stops[1], s2: x.stops[2], shade: x.shade,
    }, { I: tex.in.t, G: tex.a4 ? tex.a4.t : tex.in.t, D1: tex.d2.t, D2: tex.d4.t });
    return canvas;
  }
  return { get ok() { return ok; }, get halfFloat() { return halfFloat; }, get canvas() { return canvas; }, setSpace, get space() { return space; }, beginAccum, addAccum, loadInput, process };
}

// Is any GPU finishing needed for these values (besides grain/vignette, which the CPU can do)?
function needsGpu(f, out) { return f.glow > 0.001 || f.chroma > 0.001 || f.depth > 0.001 || f.black > 0.001 || f.white < 0.999 || Math.abs(f.gamma - 1) > 0.001 || f.gmap > 0.001 || f.shutter > 0 || (out && (out.broadcastSafe || out.zebra)); }

return { createFinisher, needsGpu };

})();

