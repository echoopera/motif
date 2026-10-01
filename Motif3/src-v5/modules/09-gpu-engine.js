// ---- module: gpu-engine v1.0.0
const __m_gpu_engine = (() => {
// gpu-engine — WebGPU renderers for the four heavy styles (Particle Form, Flow Field,
// Orbital Swarm, Metaballs). Same seeded hash and simplex permutation table as the CPU path,
// so looks match closely; counts reach 200,000. Renders into a private canvas the compositor
// draws from. Falls back (returns false) when WebGPU is unavailable or the device is lost.
const { TAU, clamp, lerp, local, ease, spring, hash, mulberry32, createNoise, memo, makeCanvas, fitFont } = __m_engine_core;
const { fontCss } = __m_style_library;

const GPU_STYLES = new Set(['particle-form', 'flow-field', 'orbital-swarm', 'metaballs']);
const TRAIL_MAX = 40;

const COMMON = /* wgsl */`
struct U { v: array<vec4f, 12> };
@group(0) @binding(0) var<uniform> U0: U;
@group(0) @binding(1) var<storage, read> perm: array<u32>;
const TAU = 6.283185307179586;
fn mixh(h: u32, n: u32) -> u32 { var x = h ^ (n * 1000003u); x = x * 16777619u; return x ^ (x >> 13u); }
fn finh(h: u32) -> f32 { var x = (h ^ (h >> 16u)) * 2246822507u; x = x ^ (x >> 13u); return f32(x) / 4294967296.0; }
fn hash2(a: u32, b: u32) -> f32 { return finh(mixh(mixh(2166136261u, a), b)); }
fn hash3(a: u32, b: u32, c: u32) -> f32 { return finh(mixh(mixh(mixh(2166136261u, a), b), c)); }
var<private> GR: array<vec3f, 12> = array<vec3f, 12>(vec3f(1,1,0),vec3f(-1,1,0),vec3f(1,-1,0),vec3f(-1,-1,0),vec3f(1,0,1),vec3f(-1,0,1),vec3f(1,0,-1),vec3f(-1,0,-1),vec3f(0,1,1),vec3f(0,-1,1),vec3f(0,1,-1),vec3f(0,-1,-1));
fn contrib(p: vec3f, gi: u32) -> f32 { var t = 0.6 - dot(p, p); if (t <= 0.0) { return 0.0; } t = t * t; return t * t * dot(GR[gi], p); }
fn n3(xin: f32, yin: f32, zin: f32) -> f32 {
  let s = (xin + yin + zin) / 3.0;
  let i = floor(xin + s); let j = floor(yin + s); let k = floor(zin + s);
  let t = (i + j + k) / 6.0;
  let p0 = vec3f(xin - (i - t), yin - (j - t), zin - (k - t));
  var o1 = vec3u(0u); var o2 = vec3u(0u);
  if (p0.x >= p0.y) {
    if (p0.y >= p0.z) { o1 = vec3u(1u,0u,0u); o2 = vec3u(1u,1u,0u); }
    else if (p0.x >= p0.z) { o1 = vec3u(1u,0u,0u); o2 = vec3u(1u,0u,1u); }
    else { o1 = vec3u(0u,0u,1u); o2 = vec3u(1u,0u,1u); }
  } else {
    if (p0.y < p0.z) { o1 = vec3u(0u,0u,1u); o2 = vec3u(0u,1u,1u); }
    else if (p0.x < p0.z) { o1 = vec3u(0u,1u,0u); o2 = vec3u(0u,1u,1u); }
    else { o1 = vec3u(0u,1u,0u); o2 = vec3u(1u,1u,0u); }
  }
  let p1 = p0 - vec3f(o1) + vec3f(1.0 / 6.0);
  let p2 = p0 - vec3f(o2) + vec3f(2.0 / 6.0);
  let p3 = p0 - vec3f(0.5);
  let ii = u32(i32(i) & 255); let jj = u32(i32(j) & 255); let kk = u32(i32(k) & 255);
  let g0 = perm[ii + perm[jj + perm[kk]]] % 12u;
  let g1 = perm[ii + o1.x + perm[jj + o1.y + perm[kk + o1.z]]] % 12u;
  let g2 = perm[ii + o2.x + perm[jj + o2.y + perm[kk + o2.z]]] % 12u;
  let g3 = perm[ii + 1u + perm[jj + 1u + perm[kk + 1u]]] % 12u;
  return 32.0 * (contrib(p0, g0) + contrib(p1, g1) + contrib(p2, g2) + contrib(p3, g3));
}
fn nloop(x: f32, y: f32, ph: f32, r: f32) -> f32 { return n3(x + cos(TAU * ph) * r, y + sin(TAU * ph) * r, 7.31); }
fn toClip(p: vec2f) -> vec4f { let w = U0.v[0].x; let h = U0.v[0].y; return vec4f(p.x / w * 2.0 - 1.0, 1.0 - p.y / h * 2.0, 0.0, 1.0); }
fn corner(vi: u32) -> vec2f { var c = array<vec2f, 6>(vec2f(-0.5,-0.5), vec2f(0.5,-0.5), vec2f(-0.5,0.5), vec2f(-0.5,0.5), vec2f(0.5,-0.5), vec2f(0.5,0.5)); return c[vi % 6u]; }
struct VOut { @builtin(position) pos: vec4f, @location(0) col: vec4f, @location(1) uv: vec2f, @location(2) rnd: f32 };
fn seg(a: vec2f, b: vec2f, width: f32, c: vec2f) -> vec2f {
  let d = b - a; let len = max(length(d), 1e-4); let dir = d / len; let n = vec2f(-dir.y, dir.x);
  return a + dir * ((c.x + 0.5) * len) + n * (c.y * width);
}
@fragment fn fs(i: VOut) -> @location(0) vec4f {
  var m = 1.0;
  if (i.rnd > 0.5) { let d = length(i.uv) * 2.0; m = clamp((1.0 - d) * 3.0, 0.0, 1.0); }
  let a = i.col.a * m;
  return vec4f(i.col.rgb * a, a);
}
`;

const PARTICLE_FORM = /* wgsl */`
@group(0) @binding(2) var<storage, read> tg: array<vec2f>;
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  let w = U0.v[0].x; let h = U0.v[0].y; let u = U0.v[0].z; let p = U0.v[0].w;
  let seed = u32(U0.v[1].x); let E = U0.v[1].z;
  let burst = U0.v[2].x; let turb = U0.v[2].y; let dotS = U0.v[2].z; let shape = U0.v[2].w;
  let scale = U0.v[3].x; let N = u32(U0.v[3].y); let jit = U0.v[3].z;
  let r = hash2(seed, ii);
  var t = tg[ii % N];
  if (ii >= N) { t = t + (vec2f(hash3(seed, ii, 7u), hash3(seed, ii, 8u)) - 0.5) * jit; }
  var x = t.x; var y = t.y;
  let idle = u * 0.002;
  x = x + nloop(t.x * 0.01, t.y * 0.01, p, 0.3) * idle; y = y + nloop(t.y * 0.01 + 9.0, t.x * 0.01, p, 0.3) * idle;
  if (E != 0.0) {
    let dx = t.x - w * 0.5; let dy = t.y - h * 0.5; let dl = max(length(vec2f(dx, dy)), 1.0);
    let pw = burst * u * 0.55 * (0.35 + r); let tn = turb * u * 0.3;
    let ax = n3(t.x * 0.006, t.y * 0.006, 1.7); let ay = n3(t.x * 0.006 + 40.0, t.y * 0.006, 3.1);
    x = x + E * (dx / dl * pw + ax * tn); y = y + E * (dy / dl * pw + ay * tn);
  }
  var col = U0.v[5];
  if (r < 0.14) { col = U0.v[6]; } else if (r < 0.2) { col = U0.v[7]; }
  var ds = max(1.2, u * 0.0032 * dotS) * scale;
  var alpha = 1.0;
  if (ds < 1.0) { alpha = ds; ds = 1.0; }
  let c = corner(vi);
  var o: VOut; o.uv = c; o.rnd = 0.0;
  var pos = vec2f(x, y) + c * ds;
  if (shape > 0.5 && shape < 1.5) { o.rnd = 1.0; pos = vec2f(x, y) + c * ds * 1.2; }
  if (shape > 1.5 && abs(E) > 0.02) { pos = seg(vec2f(x, y), mix(vec2f(x, y), t, 0.25), max(1.0, ds * 0.6), c); }
  o.pos = toClip(pos); o.col = vec4f(col.rgb, col.a * alpha);
  return o;
}`;

const ORBITAL = /* wgsl */`
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  let w = U0.v[0].x; let h = U0.v[0].y; let u = U0.v[0].z; let p = U0.v[0].w;
  let seed = u32(U0.v[1].x);
  let arms = U0.v[2].x; let twist = U0.v[2].y; let spin = U0.v[2].z; let spread = U0.v[2].w;
  let tilt = U0.v[3].x; let scale = U0.v[3].y; let R = U0.v[3].z;
  let r = pow(hash3(seed, ii, 11u), 0.6);
  let arm = f32(ii % u32(arms));
  let g1 = max(1e-9, hash3(seed, ii, 12u)); let g2 = hash3(seed, ii, 13u);
  let gz = sqrt(-2.0 * log(g1)) * cos(TAU * g2);
  let sz = hash3(seed, ii, 14u); let wob = hash3(seed, ii, 15u);
  let base = arm / arms * TAU + r * twist * TAU + gz * spread * (1.1 - r * 0.6);
  let m = spin * (1.0 + floor((1.0 - r) * 3.0));
  let ang = base + TAU * p * m;
  let rr = r * R * (1.0 + 0.03 * sin(TAU * (p * 2.0 + wob)));
  let x = w * 0.5 + cos(ang) * rr; let y = h * 0.5 + sin(ang) * rr * tilt;
  var s = u * (0.0015 + sz * 0.0035) * scale; var alpha = 0.35 + 0.65 * (1.0 - r * 0.6);
  if (s < 1.0) { alpha = alpha * s; s = 1.0; }
  var col = U0.v[5];
  if (r < 0.25) { col = U0.v[7]; } else if (sz > 0.92) { col = U0.v[6]; }
  let c = corner(vi);
  var o: VOut; o.uv = c; o.rnd = 0.0; o.pos = toClip(vec2f(x, y) + c * s); o.col = vec4f(col.rgb, alpha);
  return o;
}`;

const FLOW_COMPUTE = /* wgsl */`
@group(0) @binding(2) var<storage, read_write> pts: array<vec4f>;
@compute @workgroup_size(64) fn cs(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x; let count = u32(U0.v[1].y); if (i >= count) { return; }
  let w = U0.v[0].x; let h = U0.v[0].y; let p = U0.v[0].w; let seed = u32(U0.v[1].x);
  let fsc = U0.v[2].x; let st = U0.v[2].y; let trail = i32(U0.v[2].z);
  let a = fract(p + hash3(seed, i, 1u));
  var x = hash3(seed, i, 2u) * w; var y = hash3(seed, i, 3u) * h;
  let steps = i32(floor(a * 56.0)); let start = steps - trail;
  var k = 0u; let base = i * ${TRAIL_MAX}u;
  for (var s = 0; s < steps; s = s + 1) {
    let th = nloop(x * fsc, y * fsc, p, 0.25) * TAU * 1.3;
    x = x + cos(th) * st; y = y + sin(th) * st;
    if (s >= start && k < ${TRAIL_MAX}u) { pts[base + k] = vec4f(x, y, 0.0, 0.0); k = k + 1u; }
  }
  // Slot 0.z carries the point count, 0.w the alpha.
  let first = pts[base];
  pts[base] = vec4f(first.x, first.y, f32(k), sin(3.141592653589793 * a));
}`;

const FLOW_DRAW = /* wgsl */`
@group(0) @binding(2) var<storage, read> pts: array<vec4f>;
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VOut {
  let segs = u32(U0.v[3].y); let seg_ = ii % segs; let i = ii / segs; let base = i * ${TRAIL_MAX}u;
  let head = pts[base]; let n = u32(head.z);
  var o: VOut; o.uv = vec2f(0.0); o.rnd = 0.0;
  if (n < 2u || seg_ + 1u >= n) { o.pos = vec4f(2.0, 2.0, 0.0, 1.0); o.col = vec4f(0.0); return o; }
  let a = pts[base + seg_].xy; let b = pts[base + seg_ + 1u].xy;
  let lw = U0.v[2].w; let mode = U0.v[3].x; let st = U0.v[2].y; let trail = U0.v[2].z;
  var col = U0.v[5];
  if (mode > 0.5 && mode < 1.5) {
    let k = u32(floor(hash2(i, 5u) * 4.0));
    if (k == 1u) { col = U0.v[6]; } else if (k == 2u) { col = U0.v[7]; } else if (k == 3u) { col = U0.v[8]; }
  } else if (mode > 1.5) {
    let last = pts[base + n - 1u].xy;
    col = mix(U0.v[5], U0.v[6], clamp(length(last - head.xy) / (st * trail), 0.0, 1.0));
  }
  var width = lw; var alpha = head.w * 0.9;
  if (width < 1.0) { alpha = alpha * width; width = 1.0; }
  o.pos = toClip(seg(a, b, width, corner(vi))); o.col = vec4f(col.rgb, alpha);
  return o;
}`;

const METABALLS = /* wgsl */`
@group(0) @binding(2) var<uniform> B: array<vec4f, 16>;
@vertex fn vs(@builtin(vertex_index) vi: u32) -> VOut {
  var c = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var o: VOut; o.pos = vec4f(c[vi], 0.0, 1.0); o.col = vec4f(0.0); o.uv = c[vi]; o.rnd = 0.0; return o;
}
fn fract1(x: f32) -> f32 { return x - floor(x); }
fn sstep(a: f32, b: f32, x: f32) -> f32 { let t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
@fragment fn fm(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let w = U0.v[0].x; let h = U0.v[0].y; let gw = U0.v[3].x; let gh = U0.v[3].y;
  let n = i32(U0.v[2].x); let th = U0.v[2].y; let soft = U0.v[2].z; let look = U0.v[2].w;
  let gx = fc.x / w * gw - 0.5; let gy = fc.y / h * gh - 0.5;
  var f = 0.0;
  for (var i = 0; i < n; i = i + 1) { let b = B[i]; let dx = gx - b.x; let dy = gy - b.y; f = f + b.z / (dx * dx + dy * dy + 1.0); }
  var a = 0.0; var col = U0.v[6].rgb;
  if (look < 0.5) { a = sstep(th - soft, th + soft, f); }
  else if (look < 1.5) { let band = abs(fract1(f * 3.0) - 0.5); if (f > th * 0.4) { a = sstep(0.18 + soft * 0.3, 0.1, band); } if (f <= th) { col = U0.v[5].rgb; } }
  else { a = sstep(th * 0.6 - soft, th * 0.6 + soft, f); if (f > th * 1.25) { col = U0.v[7].rgb; } }
  return vec4f(col * a, a);
}`;

function createGpuEngine() {
  let device = null, format = null, canvas = null, gctx = null, state = 'idle', reason = '', ubuf = null, permBuf = null, permSeed = -1;
  const pipes = {}; let tgCache = { key: '', buf: null, n: 0 }; let flowBuf = null, flowCap = 0; let blobBuf = null;
  let forceCpu = false;

  async function init() {
    if (state === 'ready' || state === 'init') return state === 'ready';
    state = 'init';
    try {
      if (!navigator.gpu) throw new Error('WebGPU isn’t available in this browser');
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('No GPU adapter');
      device = await adapter.requestDevice();
      device.lost.then(info => { state = 'lost'; reason = `GPU device lost (${info.reason || 'unknown'})`; device = null; });
      device.addEventListener && device.addEventListener('uncapturederror', e => { console.error('WebGPU:', e.error && e.error.message); state = 'error'; reason = 'GPU error — using Canvas 2D'; });
      format = navigator.gpu.getPreferredCanvasFormat();
      // OffscreenCanvas + transferToImageBitmap gives every render its own immutable snapshot, so several
      // GPU renders in one task (layers, motion-blur sub-frames) never overwrite a texture still being drawn.
      canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(2, 2) : document.createElement('canvas');
      canvas.width = 2; canvas.height = 2;
      gctx = canvas.getContext('webgpu');
      gctx.configure({ device, format, alphaMode: 'premultiplied' });
      ubuf = device.createBuffer({ size: 12 * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      permBuf = device.createBuffer({ size: 512 * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      blobBuf = device.createBuffer({ size: 16 * 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      const blend = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' } };
      const mk = (code, vsE = 'vs', fsE = 'fs') => { const m = device.createShaderModule({ code: COMMON + code }); return device.createRenderPipeline({ layout: 'auto', vertex: { module: m, entryPoint: vsE }, fragment: { module: m, entryPoint: fsE, targets: [{ format, blend }] }, primitive: { topology: 'triangle-list' } }); };
      device.pushErrorScope('validation');
      pipes.pf = mk(PARTICLE_FORM); pipes.orb = mk(ORBITAL); pipes.flow = mk(FLOW_DRAW); pipes.mb = mk(METABALLS, 'vs', 'fm');
      const cm = device.createShaderModule({ code: COMMON + FLOW_COMPUTE });
      pipes.flowC = device.createComputePipeline({ layout: 'auto', compute: { module: cm, entryPoint: 'cs' } });
      const verr = await device.popErrorScope(); if (verr) throw new Error(verr.message);
      // Surface compile errors now rather than at first draw.
      const errs = []; for (const m of [cm, device.createShaderModule({ code: COMMON + PARTICLE_FORM })]) { const info = m.getCompilationInfo ? await m.getCompilationInfo() : { messages: [] }; for (const x of info.messages) if (x.type === 'error') errs.push(x.message); }
      if (errs.length) throw new Error(errs.join('; '));
      state = 'ready'; return true;
    } catch (e) { state = 'unavailable'; reason = e && e.message ? e.message : String(e); device = null; return false; }
  }

  const rgba = hex => { const n = hex.replace('#', ''); return [parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255, 1]; };
  function writeUniforms(w, h, S, style, extra) {
    const f = new Float32Array(48); const u = Math.min(w, h);
    f.set([w, h, u, S.p], 0); f.set([S.seed, extra.count || 0, extra.E || 0, S.t], 4);
    f.set(extra.a || [0, 0, 0, 0], 8); f.set(extra.b || [0, 0, 0, 0], 12);
    f.set(rgba(S.pal.bg), 16); f.set(rgba(S.pal.ink), 20); f.set(rgba(S.pal.accent(0)), 24); f.set(rgba(S.pal.accent(1)), 28); f.set(rgba(S.pal.accent(2)), 32);
    device.queue.writeBuffer(ubuf, 0, f);
    if (permSeed !== S.seed) { device.queue.writeBuffer(permBuf, 0, Uint32Array.from(createNoise(S.seed).perm)); permSeed = S.seed; }
  }
  function sizeTo(w, h) { if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } }
  function pass(enc, fn) {
    const view = gctx.getCurrentTexture().createView();
    const rp = enc.beginRenderPass({ colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' }] });
    fn(rp); rp.end();
  }
  const bg = (pipe, map) => device.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: Object.entries(map).map(([b, buf]) => ({ binding: Number(b), resource: { buffer: buf } })) });

  // Dense, shuffled text targets for Particle Form (up to ~250k points), cached per text/size.
  function targets(q, w, h) {
    const key = `${q.text}|${q.font}|${w}|${h}`;
    if (tgCache.key === key) return tgCache;
    const S = 1000 / Math.max(w, h), cw = Math.max(8, Math.round(w * S)), ch = Math.max(8, Math.round(h * S));
    const c = makeCanvas(cw, ch), x = c.getContext('2d', { willReadFrequently: true }); const css = fontCss(q.font);
    const size = fitFont(x, q.text || ' ', css, 800, cw * 0.8, ch * 0.8 * 0.9);
    x.font = `800 ${size}px ${css}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'white'; // token-lint-ignore (mask only)
    const lines = String(q.text || ' ').split('\n'); lines.forEach((l, i) => x.fillText(l, cw / 2, ch / 2 + (i - (lines.length - 1) / 2) * size * 1.02));
    const d = x.getImageData(0, 0, cw, ch).data; const pts = [];
    for (let yy = 0; yy < ch; yy++) for (let xx = 0; xx < cw; xx++) if (d[(yy * cw + xx) * 4 + 3] > 140) pts.push(xx / S, yy / S);
    const n = Math.max(1, pts.length / 2); const rng = mulberry32(n);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); let t = pts[2 * i]; pts[2 * i] = pts[2 * j]; pts[2 * j] = t; t = pts[2 * i + 1]; pts[2 * i + 1] = pts[2 * j + 1]; pts[2 * j + 1] = t; }
    const arr = new Float32Array(pts.length ? pts : [w / 2, h / 2]);
    if (tgCache.buf) tgCache.buf.destroy();
    const buf = device.createBuffer({ size: Math.max(16, arr.byteLength), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(buf, 0, arr);
    tgCache = { key, buf, n, jit: 1 / S }; return tgCache;
  }

  // Render `styleId` at w×h for frame state S. Returns the canvas to draw, or null to fall back.
  function render(styleId, S, w, h) {
    if (forceCpu || state !== 'ready' || !device || !GPU_STYLES.has(styleId)) return null;
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h)); sizeTo(w, h);
    const q = S.P, u = Math.min(w, h), enc = device.createCommandEncoder();
    if (styleId === 'particle-form') {
      const p = S.p; let E = 0;
      if (p >= 0.45 && p < 0.6) E = ease.outCubic(local(p, 0.45, 0.6)); else if (p >= 0.6 && p < 0.97) E = 1 - spring(local(p, 0.6, 0.97), 0.35);
      const tg = targets(q, w, h); const count = q.count;
      writeUniforms(w, h, S, styleId, { count, E, a: [q.burst, q.turbulence, q.dot, { square: 0, circle: 1, streak: 2 }[q.shape] || 0], b: [clamp(Math.sqrt(4000 / Math.max(count, 4000)), 0.22, 1), tg.n, tg.jit, 0] });
      const g = bg(pipes.pf, { 0: ubuf, 1: permBuf, 2: tg.buf });
      pass(enc, rp => { rp.setPipeline(pipes.pf); rp.setBindGroup(0, g); rp.draw(6, count); });
    } else if (styleId === 'orbital-swarm') {
      const R = Math.min(u * 0.48, w * 0.46), count = q.count;
      writeUniforms(w, h, S, styleId, { count, a: [q.arms, q.twist, q.spin, q.spread], b: [q.tilt, clamp(Math.sqrt(5000 / Math.max(count, 5000)), 0.25, 1), R, 0] });
      const g = bg(pipes.orb, { 0: ubuf });
      pass(enc, rp => { rp.setPipeline(pipes.orb); rp.setBindGroup(0, g); rp.draw(6, count); });
    } else if (styleId === 'flow-field') {
      const count = q.count, fsc = 0.0035 * q.scale * (600 / u), st = u * 0.005 * q.step;
      const lw = u * 0.0018 * q.weight * clamp(Math.sqrt(2500 / Math.max(count, 2500)), 0.35, 1);
      if (flowCap < count) { if (flowBuf) flowBuf.destroy(); flowCap = Math.ceil(count / 4096) * 4096; flowBuf = device.createBuffer({ size: flowCap * TRAIL_MAX * 16, usage: GPUBufferUsage.STORAGE }); }
      const trail = Math.min(q.trail, TRAIL_MAX);
      writeUniforms(w, h, S, styleId, { count, a: [fsc, st, trail, lw], b: [{ mono: 0, palette: 1, speed: 2 }[q.colour] || 0, trail - 1, 0, 0] });
      const gc = bg(pipes.flowC, { 0: ubuf, 1: permBuf, 2: flowBuf });
      const cp = enc.beginComputePass(); cp.setPipeline(pipes.flowC); cp.setBindGroup(0, gc); cp.dispatchWorkgroups(Math.ceil(count / 64)); cp.end();
      const gd = bg(pipes.flow, { 0: ubuf, 2: flowBuf });
      pass(enc, rp => { rp.setPipeline(pipes.flow); rp.setBindGroup(0, gd); rp.draw(6, count * (trail - 1)); });
    } else if (styleId === 'metaballs') {
      const gw = 250, gh = Math.max(8, Math.round(gw * h / w)), m = Math.min(gw, gh), blobs = new Float32Array(64);
      for (let i = 0; i < q.blobs; i++) {
        const mx = 1 + (i % q.cycles), my = 1 + ((i + 1) % (q.cycles + 1));
        const cx = gw / 2 + Math.sin(TAU * (S.p * mx + hash(S.seed, i))) * gw * (0.18 + 0.2 * hash(i, 2));
        const cy = gh / 2 + Math.cos(TAU * (S.p * my + hash(S.seed, i, 3))) * gh * (0.16 + 0.2 * hash(i, 4));
        const r = m * 0.09 * q.size * (0.6 + 0.8 * hash(S.seed, i, 5)); blobs.set([cx, cy, r * r, 0], i * 4);
      }
      device.queue.writeBuffer(blobBuf, 0, blobs);
      writeUniforms(w, h, S, styleId, { count: q.blobs, a: [q.blobs, q.threshold, 0.02 + q.softness * 0.35, { fill: 0, rings: 1, duotone: 2 }[q.look] || 0], b: [gw, gh, 0, 0] });
      const g = bg(pipes.mb, { 0: ubuf, 2: blobBuf });
      pass(enc, rp => { rp.setPipeline(pipes.mb); rp.setBindGroup(0, g); rp.draw(3); });
    }
    device.queue.submit([enc.finish()]);
    if (canvas.transferToImageBitmap) return canvas.transferToImageBitmap();
    return canvas;
  }
  // CPU work a GPU style still needs underneath the particles (Orbital Swarm's core glow).
  function pre(styleId, ctx, S) {
    if (styleId !== 'orbital-swarm' || !S.P.core) return;
    const { w, h, pal, u } = S, R = Math.min(u * 0.48, w * 0.46);
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, R * 0.45);
    g.addColorStop(0, pal.alpha(pal.accent(1), 0.55)); g.addColorStop(1, pal.alpha(pal.accent(1), 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  return {
    init, render, pre, supports: id => GPU_STYLES.has(id),
    get ready() { return state === 'ready' && !forceCpu; }, get state() { return forceCpu && state === 'ready' ? 'off' : state; }, get reason() { return reason; },
    setForceCpu(v) { forceCpu = !!v; }, get forceCpu() { return forceCpu; },
  };
}

return { GPU_STYLES, createGpuEngine };

})();

