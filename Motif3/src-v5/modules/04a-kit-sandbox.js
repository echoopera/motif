// ---- module: kit-sandbox v1.1.0 (motif-kit@3 text inputs, motif-kit@2 format, static GLSL analysis, capability manifest)
const __m_kit_sandbox = (() => {
// kit-sandbox — the trust boundary for third-party kits. Pure: no DOM, no window, no timers, no network; safe to
// run in a Worker or in the SDK CLI. Kits are DATA (JSON manifest) + GLSL ONLY. Nothing in a kit is ever
// evaluated as JavaScript: there is no eval, no Function, no dynamic import and no URL fetch on this path.
//
//  · validate(manifest, files)  motif-kit@1, @2 and @3 → one normalized kit (format "motif-kit@2", or "motif-kit@3" for
//                               an @3 manifest), with a recorded migration for @1, a capability manifest, and a report.
//                               @3 = @2 plus `text` inputs and the `text` capability (additive; @1/@2 kits are read as before).
//  · analyzeGlsl(...)           static analysis of every pass as it will be compiled (prelude + params + common +
//                               pass, macros expanded): unbounded loops, loop-iteration and texture-fetch budgets
//                               per pixel, recursion, huge arrays, nesting depth, extension / pragma allowlists.
// Static analysis bounds the work a shader can ask for; it is NOT a proof that a shader is fast or that a GPU
// driver cannot hang. The host adds a runtime canary and quarantine on top (kit-host).
const KG = __m_kit_gl;
const KIT_FORMAT_1 = KG.KIT_FORMAT, KIT_FORMAT_2 = 'motif-kit@2', KIT_FORMAT_3 = 'motif-kit@3', FORMATS = [KIT_FORMAT_1, KIT_FORMAT_2, KIT_FORMAT_3];
const KINDS = ['style', 'effect', 'transition', 'exporter'];
const CAPABILITIES = {
  media: 'Reads images or video you attach to a layer.',
  audio: 'Reads the loudness of your soundtrack (8 frequency bands).',
  feedback: 'Re-runs its own passes on their output within a frame (bounded), which multiplies GPU work.',
  text: 'Draws text you type into the layer, rasterized with fonts on this device (no font files or text leave it).',
};
// Hard limits reject a kit; soft limits warn. Calibrated against every bundled kit (tests/sandbox.test.mjs): the
// heaviest bundled passes reach ~6.3k iterations (cellula/image) and ~690 fetches (afterglow/night-drive) per pixel,
// under a quarter / a third of the hard limits.
const LIMITS = {
  fileBytes: KG.KIT_LIMITS.fileBytes, manifestBytes: 256 * 1024, files: 256, jsonDepth: 16, jsonNodes: 20000, jsonArray: 512, stringBytes: 16384,
  tokens: 60000,             // per pass, after macro expansion (prelude excluded)
  macros: 128, macroDepth: 32,
  braceDepth: 32, parenDepth: 48,
  loopTrip: 4096,            // iterations of any single loop
  iterationsPerPixel: 32768, iterationsSoft: 8192,  // all loop iterations one pixel can execute (nested products, summed)
  fetchesPerPixel: 2048, fetchesSoft: 768,           // texture reads one pixel can execute
  arrayElements: 1024, arrayComponents: 16384,       // per array / per pass (floats)
  entries: { style: KG.KIT_LIMITS.styles, effect: 24, transition: 24, exporter: 16 },
  graphPasses: 8, graphBuffers: 8, passReads: 6, iterate: 16, executions: 32,
};
const PRAGMA_ALLOW = /^(optimize|debug)\s*\(\s*(on|off)\s*\)\s*$/;
const EXTENSION_ALLOW = new Set(); // WebGL2 / GLSL ES 3.00 needs none; anything else is rejected.
const HOSTILE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const FILE_RE = /^[A-Za-z0-9_][A-Za-z0-9_.\/-]{0,127}$/;
const BUF_RE = /^[a-z][a-zA-Z0-9]{0,15}$/;
const EXTERNALS = { style: [], effect: ['input'], transition: ['from', 'to'] };
const EXPORT_PRESET = {
  format: ['webm', 'mp4', 'png', 'png-seq'], tier: [720, 1080, 1440, 2160], fps: [24, 25, 30, 50, 60], quality: ['standard', 'high', 'max'],
  loops: 'int:1:8', transparent: 'bool', withAudio: 'bool', aspect: /^(16x9|9x16|1x1|4x5|4x3|21x9)$/,
};

// ---------------------------------------------------------------------------------------------------------------
// Package structure (before any field is read): hostile keys, depth, size. JSON.parse keeps "__proto__" as an own
// key; code that later indexes by manifest-supplied names could otherwise reach Object.prototype.
function scanPackage(manifest, files) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return ['manifest.json is missing or not an object.'];
  let nodes = 0;
  const walk = (v, path, depth) => {
    if (errors.length > 8) return;
    if (++nodes > LIMITS.jsonNodes) { if (nodes === LIMITS.jsonNodes + 1) errors.push(`manifest.json has more than ${LIMITS.jsonNodes} values.`); return; }
    if (depth > LIMITS.jsonDepth) { errors.push(`${path}: nested deeper than ${LIMITS.jsonDepth} levels.`); return; }
    if (typeof v === 'string') { if (v.length > LIMITS.stringBytes) errors.push(`${path}: text longer than ${LIMITS.stringBytes} characters.`); return; }
    if (typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint') { errors.push(`${path}: not a JSON value.`); return; }
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { if (v.length > LIMITS.jsonArray) errors.push(`${path}: more than ${LIMITS.jsonArray} items.`); v.slice(0, LIMITS.jsonArray).forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1)); return; }
    // Plain objects only (from any realm: a Worker or test VM has its own Object.prototype).
    const proto = Object.getPrototypeOf(v);
    if (Object.prototype.toString.call(v) !== '[object Object]' || (proto !== null && Object.getPrototypeOf(proto) !== null)) { errors.push(`${path}: not a plain JSON object.`); return; }
    for (const k of Object.keys(v)) {
      if (HOSTILE_KEYS.has(k)) { errors.push(`${path}: key "${k}" is not allowed.`); continue; }
      if (k.length > 64) { errors.push(`${path}: a key is longer than 64 characters.`); continue; }
      walk(v[k], `${path}.${k}`, depth + 1);
    }
  };
  walk(manifest, 'manifest', 0);
  let bytes = 0; try { bytes = JSON.stringify(manifest).length; } catch (e) { errors.push('manifest.json cannot be serialized.'); }
  if (bytes > LIMITS.manifestBytes) errors.push(`manifest.json is larger than ${LIMITS.manifestBytes / 1024} KB.`);
  if (files != null && (typeof files !== 'object' || Array.isArray(files))) errors.push('files must be an object of path → text.');
  else {
    const names = Object.keys(files || {});
    if (names.length > LIMITS.files) errors.push(`The package holds more than ${LIMITS.files} files.`);
    for (const n of names.slice(0, LIMITS.files)) {
      if (HOSTILE_KEYS.has(n) || !FILE_RE.test(n) || n.includes('..') || n.includes('//')) { errors.push(`File name "${String(n).slice(0, 40)}" is not allowed.`); continue; }
      const t = files[n];
      if (typeof t !== 'string' || !/\.(glsl|json|md|txt)$/i.test(n)) { errors.push(`${n}: only GLSL, JSON, Markdown and text files can be in a kit; nothing in a kit is ever run as code.`); continue; }
      if (/\.glsl$/.test(n) && /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(t)) errors.push(`${n}: contains control characters.`);
    }
  }
  return errors.slice(0, 12);
}

// ---------------------------------------------------------------------------------------------------------------
// GLSL lexer + preprocessor. Tokens: { v, k: 'id' | 'num' | 'op', seg, line }. Directives are handled in order;
// #if/#ifdef branches are ALL treated as live (conservative: work in either branch counts).
const TOKEN_RE = /\s+|([A-Za-z_]\w*)|(0[xX][0-9a-fA-F]+[uU]?|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[uUfF]?)|(<<=|>>=|\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|==|!=|<=|>=|&&|\|\||\^\^|<<|>>|[-+*\/%<>=!&|^~?:;,.(){}\[\]])/y;
function stripComments(text, seg, diag) {
  let out = '', i = 0; const n = text.length;
  while (i < n) {
    const c = text[i], d = text[i + 1];
    if (c === '/' && d === '/') { while (i < n && text[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      const j = text.indexOf('*/', i + 2);
      if (j < 0) { diag('error', 'comment', seg, text.slice(0, i).split('\n').length, 'Unterminated /* comment.'); return out; }
      out += ' ' + text.slice(i, j + 2).replace(/[^\n]/g, ''); i = j + 2; continue;
    }
    out += c; i++;
  }
  return out;
}
function lexLine(s, seg, line, diag) {
  const toks = []; TOKEN_RE.lastIndex = 0; let m;
  while (TOKEN_RE.lastIndex < s.length) {
    const at = TOKEN_RE.lastIndex; m = TOKEN_RE.exec(s);
    if (!m) { diag('error', 'syntax', seg, line, `Unexpected character "${s[at] === '#' ? '#' : s.charCodeAt(at) > 126 ? 'non-ASCII' : s[at]}" (GLSL ES 3.00 accepts ASCII only; # and ## are not supported in macros).`); TOKEN_RE.lastIndex = at + 1; continue; }
    if (m[1]) toks.push({ v: m[1], k: 'id', seg, line }); else if (m[2]) toks.push({ v: m[2], k: 'num', seg, line }); else if (m[3]) toks.push({ v: m[3], k: 'op', seg, line });
  }
  return toks;
}
// Lexing is cached per (segment, text): a kit's common file is shared by every pass of every entry.
const lexCache = new Map();
function lexSegment(sg) {
  const key = sg.seg + '\u0000' + (sg.text || '');
  let c = lexCache.get(key);
  if (c) return c;
  const diags = [], diag = (...a) => diags.push(a), items = [];
  const lines = stripComments(sg.text || '', sg.seg, diag).split('\n');
  for (let li = 0; li < lines.length; li++) {
    let s = lines[li]; const line = li + 1;
    while (/\\\s*$/.test(s) && li + 1 < lines.length) { s = s.replace(/\\\s*$/, ' ') + lines[++li]; }
    const dm = /^\s*#\s*(\w*)\s*(.*)$/.exec(s);
    if (dm) items.push({ line, dir: dm[1], rest: dm[2] }); else { const toks = lexLine(s, sg.seg, line, diag); if (toks.length) items.push({ line, toks }); }
  }
  c = { items, diags, lines: lines.length };
  if (lexCache.size > 48) lexCache.delete(lexCache.keys().next().value);
  lexCache.set(key, c); return c;
}
// Preprocess segments [{ seg, text, trusted }] into a token list. macros carries over between segments
// (the prelude defines TAU / PI; params define select constants), exactly as the compiler sees one source.
function preprocess(segments, diag, macros = new Map()) {
  const out = []; let budget = LIMITS.tokens, over = false, kitMacros = 0;
  const spend = n => { budget -= n; if (budget < 0 && !over) { over = true; return false; } return !over; };
  // Expand macros in a token list (rescanning results), honouring the active set so a macro never expands itself.
  function expand(list, active, depth) {
    const res = [];
    for (let i = 0; i < list.length && !over; i++) {
      const t = list[i], mac = t.k === 'id' && macros.size && !active.has(t.v) ? macros.get(t.v) : null;
      if (!mac) { res.push(t); continue; }
      if (depth > LIMITS.macroDepth) { diag('error', 'macro', t.seg, t.line, `Macro "${t.v}" nests deeper than ${LIMITS.macroDepth} levels.`); over = true; break; }
      let body = mac.body;
      if (mac.params) {
        if (!list[i + 1] || list[i + 1].v !== '(') { res.push(t); continue; }
        const args = [[]]; let d = 0, j = i + 2;
        for (; j < list.length; j++) { const v = list[j].v; if (v === '(' || v === '[') d++; else if (v === ')' || v === ']') { if (d === 0 && v === ')') break; d--; } if (v === ',' && d === 0) args.push([]); else args[args.length - 1].push(list[j]); }
        i = j;
        body = []; for (const b of mac.body) { const ai = b.k === 'id' ? mac.params.indexOf(b.v) : -1; if (ai >= 0) { for (const x of expand(args[ai] || [], active, depth + 1)) body.push(x); } else body.push(b); }
      }
      const at = body.map(b => ({ v: b.v, k: b.k, seg: t.seg, line: t.line }));
      if (!spend(at.length)) { diag('error', 'macro', t.seg, t.line, `Macro expansion exceeds ${LIMITS.tokens} tokens.`); break; }
      active.add(t.v); const ex = expand(at, active, depth + 1); active.delete(t.v);
      for (const x of ex) res.push(x);
    }
    return res;
  }
  for (const sg of segments) {
    const lx = lexSegment(sg);
    for (const d of lx.diags) diag(...d);
    let cond = 0, pending = [];
    for (const it of lx.items) {
      const lineNo = it.line;
      if (it.toks) { for (const t of it.toks) pending.push(t); continue; }
      // A directive ends any run of ordinary tokens: expand them with the macros defined so far.
      if (pending.length) { const ex = expand(pending, new Set(), 0); for (const t of ex) out.push(t); if (!spend(0)) break; pending = []; }
      const name = it.dir, rest = it.rest;
      if (name === 'define') {
        const mm = /^([A-Za-z_]\w*)(\(([^)]*)\))?\s*(.*)$/.exec(rest);
        if (!mm) { diag('error', 'macro', sg.seg, lineNo, '#define needs a name.'); continue; }
        if (!sg.trusted && ++kitMacros > LIMITS.macros) { diag('error', 'macro', sg.seg, lineNo, `More than ${LIMITS.macros} macros.`); continue; }
        if (!sg.trusted && /^(u_|M_|gl_|GL_)/.test(mm[1])) diag('error', 'macro', sg.seg, lineNo, `#define ${mm[1]}: names starting with u_, M_ or gl_ belong to the runtime.`);
        const fnLike = !!mm[2] && rest[mm[1].length] === '(';
        macros.set(mm[1], { params: fnLike ? mm[3].split(',').map(x => x.trim()).filter(Boolean) : null, body: lexLine(fnLike ? mm[4] : (mm[2] || '') + ' ' + mm[4], sg.seg, lineNo, diag) });
      } else if (name === 'undef') macros.delete(rest.trim());
      else if (['if', 'ifdef', 'ifndef'].includes(name)) cond++;
      else if (name === 'elif' || name === 'else') { if (!cond) diag('error', 'syntax', sg.seg, lineNo, `#${name} without #if.`); }
      else if (name === 'endif') { if (!cond) diag('error', 'syntax', sg.seg, lineNo, '#endif without #if.'); else cond--; }
      else if (name === 'pragma') { if (!PRAGMA_ALLOW.test(rest)) diag('error', 'pragma', sg.seg, lineNo, `#pragma ${rest.slice(0, 40)} is not allowed (only optimize(on|off) and debug(on|off)).`); }
      else if (name === 'extension') { const ext = (/^(\w+)/.exec(rest) || [])[1] || ''; if (!sg.trusted && !EXTENSION_ALLOW.has(ext)) diag('error', 'extension', sg.seg, lineNo, `#extension ${ext || rest.slice(0, 40)} is not allowed: kits run on core WebGL2 (GLSL ES 3.00) only.`); }
      else if (name === 'version' || name === 'line') { if (!sg.trusted) diag('error', 'directive', sg.seg, lineNo, `#${name} is set by the runtime; remove it.`); }
      else if (name === 'error' || name === '') { /* allowed */ }
      else diag('error', 'directive', sg.seg, lineNo, `Unknown directive #${name}.`);
    }
    if (pending.length) { const ex = expand(pending, new Set(), 0); for (const t of ex) out.push(t); }
    if (cond && !sg.trusted) diag('error', 'syntax', sg.seg, lx.lines, '#if without #endif.');
    if (over) break;
  }
  return { tokens: out, macros, over };
}

// ---------------------------------------------------------------------------------------------------------------
// Analyzer. Upper-bounds, per pixel, the loop iterations and texture fetches of motif() including every function it
// calls. A loop must have a counter with a constant (or declared-param) start, a bound in the condition and a
// constant step, and must not change the counter in its body. `break` is ignored (the bound is what counts).
const TYPES = new Set(['void', 'bool', 'int', 'uint', 'float', 'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4', 'uvec2', 'uvec3', 'uvec4', 'bvec2', 'bvec3', 'bvec4', 'mat2', 'mat3', 'mat4', 'mat2x2', 'mat2x3', 'mat2x4', 'mat3x2', 'mat3x3', 'mat3x4', 'mat4x2', 'mat4x3', 'mat4x4', 'sampler2D', 'sampler3D', 'samplerCube', 'sampler2DArray', 'isampler2D', 'usampler2D']);
const COMPONENTS = { float: 1, int: 1, uint: 1, bool: 1, vec2: 2, vec3: 3, vec4: 4, ivec2: 2, ivec3: 3, ivec4: 4, uvec2: 2, uvec3: 3, uvec4: 4, bvec2: 2, bvec3: 3, bvec4: 4, mat2: 4, mat3: 9, mat4: 16 };
const QUALIFIERS = new Set(['const', 'highp', 'mediump', 'lowp', 'in', 'out', 'inout', 'flat', 'smooth', 'precise', 'invariant']);
const KEYWORDS = new Set(['for', 'while', 'do', 'if', 'else', 'switch', 'case', 'return', 'break', 'continue', 'discard', 'struct', 'uniform', 'precision', 'layout', ...TYPES, ...QUALIFIERS]);
const ASSIGN = new Set(['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '|=', '^=']);
const isFetch = v => /^(texture|texelFetch)/.test(v) && v !== 'textureSize';

function analyze(tokens, ctx, diag) {
  const T = tokens, N = T.length;
  const kitTok = t => t && !ctx.trustedSegs.has(t.seg);
  const at = (t, sev, code, msg) => diag(sev, code, t ? t.seg : null, t ? t.line : null, msg);
  // Bracket matching + nesting depth.
  const match = new Int32Array(N).fill(-1), stack = []; let maxBrace = 0, maxParen = 0, brace = 0, paren = 0, broken = false;
  for (let i = 0; i < N; i++) {
    const v = T[i].v;
    if (v === '(' || v === '[' || v === '{') { stack.push(i); if (v === '{') { brace++; if (brace > maxBrace) { maxBrace = brace; if (brace === LIMITS.braceDepth + 1) at(T[i], 'error', 'nesting', `Blocks nest deeper than ${LIMITS.braceDepth} levels.`); } } else { paren++; if (paren > maxParen) { maxParen = paren; if (paren === LIMITS.parenDepth + 1) at(T[i], 'error', 'nesting', `Brackets nest deeper than ${LIMITS.parenDepth} levels.`); } } }
    else if (v === ')' || v === ']' || v === '}') {
      const o = stack.pop(); const want = v === ')' ? '(' : v === ']' ? '[' : '{';
      if (o == null || T[o].v !== want) { if (!broken) at(T[i], 'error', 'syntax', `Unbalanced "${v}".`); broken = true; if (o != null) stack.push(o); continue; }
      match[o] = i; match[i] = o; if (v === '}') brace--; else paren--;
    }
  }
  if (stack.length && !broken) { at(T[stack[stack.length - 1]], 'error', 'syntax', `Unclosed "${T[stack[stack.length - 1]].v}".`); broken = true; }
  if (broken) return { iterations: 0, fetches: 0, maxTrip: 0, loops: 0, broken: true };
  const types = new Set(TYPES);
  // Argument / parameter count of the parenthesised list opening at o: overloads are told apart by arity.
  const arity = o => { const c = match[o]; if (c === o + 1 || (c === o + 2 && T[o + 1].v === 'void')) return 0; let n = 1; for (let k = o + 1; k < c; k++) { const v = T[k].v; if (v === '(' || v === '[' || v === '{') k = match[k]; else if (v === ',') n++; } return n; };
  // Top level: structs, functions (overloads merge), const declarations.
  const fns = new Map(), outFns = new Set(), consts = new Map();
  for (let i = 0; i < N; i++) {
    const t = T[i];
    if (t.v === '{') { i = match[i]; continue; }
    if (t.v === 'struct' && T[i + 1] && T[i + 1].k === 'id') types.add(T[i + 1].v);
    if (t.k === 'id' && !KEYWORDS.has(t.v) && T[i + 1] && T[i + 1].v === '(' && i > 0 && (types.has(T[i - 1].v) || T[i - 1].v === ']')) {
      const close = match[i + 1];
      if (close > 0 && T[close + 1] && T[close + 1].v === '{') {
        const body = [close + 2, match[close + 1]];
        (fns.get(t.v) || fns.set(t.v, []).get(t.v)).push({ body, tok: t, arity: arity(i + 1) });
        for (let j = i + 2; j < close; j++) if (T[j].v === 'out' || T[j].v === 'inout') outFns.add(t.v);
        i = match[close + 1];
      }
    }
  }
  // Constant intervals: number literals, consts, declared params (min..max), and simple arithmetic.
  const iv = (lo, hi) => [Math.min(lo, hi), Math.max(lo, hi)];
  function evalExpr(a, b, locals) {
    let i = a;
    const peek = () => (i < b ? T[i].v : null);
    function primary() {
      const t = T[i]; if (!t || i >= b) return null;
      if (t.k === 'num') { i++; const s = t.v.replace(/[uUfF]$/, ''); const n = /^0[xX]/.test(s) ? parseInt(s, 16) : parseFloat(s); return Number.isFinite(n) ? [n, n] : null; }
      if (t.v === '(') { const c = match[i]; if (c < 0 || c > b) return null; const r = evalExpr(i + 1, c, locals); i = c + 1; return r; }
      if (t.v === '-' || t.v === '+') { i++; const r = primary(); return r && (t.v === '-' ? iv(-r[1], -r[0]) : r); }
      if (t.k === 'id') {
        if (T[i + 1] && T[i + 1].v === '(' && i + 1 < b) {
          const c = match[i + 1]; if (c < 0 || c > b) return null;
          const args = []; let s = i + 2, d = 0;
          for (let j = i + 2; j < c; j++) { const v = T[j].v; if (v === '(' || v === '[') d++; else if (v === ')' || v === ']') d--; else if (v === ',' && d === 0) { args.push(evalExpr(s, j, locals)); s = j + 1; } }
          args.push(evalExpr(s, c, locals)); i = c + 1;
          if (args.some(x => !x)) return null;
          const [x, y, z] = args;
          switch (t.v) {
            case 'float': case 'highp': return x;
            case 'int': case 'uint': return iv(Math.trunc(x[0]), Math.trunc(x[1]));
            case 'min': return y ? [Math.min(x[0], y[0]), Math.min(x[1], y[1])] : null;
            case 'max': return y ? [Math.max(x[0], y[0]), Math.max(x[1], y[1])] : null;
            case 'clamp': return y && z ? [Math.min(Math.max(x[0], y[0]), z[1]), Math.min(Math.max(x[1], y[0]), z[1])] : null;
            case 'abs': return x[0] >= 0 ? x : x[1] <= 0 ? iv(-x[1], -x[0]) : [0, Math.max(-x[0], x[1])];
            case 'floor': return [Math.floor(x[0]), Math.floor(x[1])];
            case 'ceil': return [Math.ceil(x[0]), Math.ceil(x[1])];
            case 'round': return [Math.round(x[0]), Math.round(x[1])];
            default: return null;
          }
        }
        i++;
        if (locals && locals.has(t.v)) return locals.get(t.v);
        if (consts.has(t.v)) return consts.get(t.v);
        if (t.v.startsWith('p_') && ctx.params) { const p = ctx.params[t.v.slice(2)]; if (!p) return null; if (p.type === 'range' || p.type === 'int') return [p.min, p.max]; if (p.type === 'toggle') return [0, 1]; if (p.type === 'select') return [0, (p.options || []).length - 1]; }
        if (t.v === 'true') return [1, 1]; if (t.v === 'false') return [0, 0];
        return null;
      }
      return null;
    }
    function mul() {
      let l = primary();
      while (l && (peek() === '*' || peek() === '/')) {
        const op = T[i++].v, r = primary(); if (!r) return null;
        if (op === '*') { const p = [l[0] * r[0], l[0] * r[1], l[1] * r[0], l[1] * r[1]]; l = [Math.min(...p), Math.max(...p)]; }
        else { if (r[0] <= 0 && r[1] >= 0) return null; const p = [l[0] / r[0], l[0] / r[1], l[1] / r[0], l[1] / r[1]]; l = [Math.min(...p), Math.max(...p)]; }
      }
      return l;
    }
    function add() {
      let l = mul();
      while (l && (peek() === '+' || peek() === '-')) { const op = T[i++].v, r = mul(); if (!r) return null; l = op === '+' ? [l[0] + r[0], l[1] + r[1]] : [l[0] - r[1], l[1] - r[0]]; }
      return l;
    }
    const r = add();
    return r && i === b && r.every(Number.isFinite) ? r : null;
  }
  // Global/local `const` scalars (all scopes; same name twice → union, conservative).
  for (let i = 0; i < N; i++) {
    if (T[i].v !== 'const') continue;
    let j = i + 1; while (T[j] && QUALIFIERS.has(T[j].v)) j++;
    if (!T[j] || !['int', 'uint', 'float'].includes(T[j].v) || !T[j + 1] || T[j + 1].k !== 'id' || !T[j + 2] || T[j + 2].v !== '=') continue;
    let e = j + 3, d = 0; for (; e < N; e++) { const v = T[e].v; if (v === '(' || v === '[') d++; else if (v === ')' || v === ']') d--; else if ((v === ';' || v === ',') && d === 0) break; }
    const r = evalExpr(j + 3, e, null), name = T[j + 1].v, prev = consts.get(name);
    if (r) consts.set(name, prev ? [Math.min(prev[0], r[0]), Math.max(prev[1], r[1])] : r);
  }
  // Effectively-const locals of a function: scalar declarations with an initializer, never assigned again.
  const localsCache = new Map();
  function localsOf(fn) {
    if (localsCache.has(fn)) return localsCache.get(fn);
    const map = new Map(), bad = new Set(); localsCache.set(fn, map);
    const [s, e] = fn.body;
    for (let i = s; i < e; i++) {
      const t = T[i]; if (t.k !== 'id' || KEYWORDS.has(t.v)) continue;
      const prev = T[i - 1] ? T[i - 1].v : '', next = T[i + 1] ? T[i + 1].v : '';
      if (['int', 'uint', 'float'].includes(prev) && next === '=') {
        let j = i + 2, d = 0; for (; j < e; j++) { const v = T[j].v; if (v === '(' || v === '[') d++; else if (v === ')' || v === ']') d--; else if ((v === ';' || v === ',') && d === 0) break; }
        const r = evalExpr(i + 2, j, map);
        if (!r) bad.add(t.v); else { const p = map.get(t.v); map.set(t.v, p ? [Math.min(p[0], r[0]), Math.max(p[1], r[1])] : r); }
        i = j - 1; continue;
      }
      if (TYPES.has(prev) || prev === '.') continue;
      if (ASSIGN.has(next) || next === '++' || next === '--' || prev === '++' || prev === '--') bad.add(t.v);
    }
    for (const n of bad) map.delete(n);
    return map;
  }
  // Statement extent: [i, end).
  function stmtEnd(i) {
    const t = T[i]; if (!t) return i;
    const v = t.v;
    if (v === '{') return match[i] + 1;
    if ((v === 'for' || v === 'while') && T[i + 1] && T[i + 1].v === '(') return stmtEnd(match[i + 1] + 1);
    if (v === 'if' && T[i + 1] && T[i + 1].v === '(') { let e = stmtEnd(match[i + 1] + 1); if (T[e] && T[e].v === 'else') e = stmtEnd(e + 1); return e; }
    if (v === 'switch' && T[i + 1] && T[i + 1].v === '(') { const c = match[i + 1]; return T[c + 1] && T[c + 1].v === '{' ? match[c + 1] + 1 : c + 1; }
    if (v === 'do') { let e = stmtEnd(i + 1); if (T[e] && T[e].v === 'while' && T[e + 1] && T[e + 1].v === '(') { e = match[e + 1] + 1; if (T[e] && T[e].v === ';') e++; } return e; }
    for (let j = i; j < N; j++) { const w = T[j].v; if (w === '(' || w === '[' || w === '{') { j = match[j]; continue; } if (w === ')' || w === ']' || w === '}') return j; if (w === ';') return j + 1; }
    return N;
  }
  // Does [s, e) change counter `name`? Declarations of the same name shadow it (for-init: until the end of that
  // for statement; elsewhere: until the end of the enclosing block). Passing it to an out/inout function counts.
  function modifies(name, s, e) {
    let depth = 0, shadowUntil = -1, shadowDepth = -1;
    for (let j = s; j < e; j++) {
      const v = T[j].v;
      if (shadowUntil >= 0 && j >= shadowUntil) shadowUntil = -1;
      if (v === '{') depth++;
      else if (v === '}') { depth--; if (shadowDepth >= 0 && depth < shadowDepth) shadowDepth = -1; }
      if (shadowUntil >= 0 || shadowDepth >= 0) continue;
      if (T[j].k === 'id' && outFns.has(v) && T[j + 1] && T[j + 1].v === '(') { const c = match[j + 1]; let st = j + 2, d = 0; for (let k = j + 2; k <= c; k++) { const w = T[k].v; if (k < c && (w === '(' || w === '[')) d++; else if (k < c && (w === ')' || w === ']')) d--; else if (k === c || (w === ',' && d === 0)) { if (k - st === 1 && T[st].v === name) return true; st = k + 1; } } }
      if (v !== name || T[j].k !== 'id') continue;
      const prev = T[j - 1] ? T[j - 1].v : '', next = T[j + 1] ? T[j + 1].v : '';
      if (prev === '.') continue;
      if (types.has(prev) || (prev === ',' && declList(j))) {
        let k = j - 1; while (k >= s && (types.has(T[k].v) || QUALIFIERS.has(T[k].v))) k--;
        if (T[k] && T[k].v === '(' && T[k - 1] && T[k - 1].v === 'for') shadowUntil = stmtEnd(k - 1); else shadowDepth = depth;
        continue;
      }
      if (ASSIGN.has(next) || next === '++' || next === '--' || prev === '++' || prev === '--') return true;
    }
    return false;
  }
  // Is the name at j part of a declaration list (float a = 1.0, i = 2.0;)? Find the statement start at depth 0.
  function declList(j) {
    let k = j - 1, d = 0;
    for (; k >= 0; k--) { const v = T[k].v; if (v === ')' || v === ']') d++; else if (v === '(' || v === '[') { if (d === 0) break; d--; } else if (d === 0 && (v === ';' || v === '{' || v === '}')) break; }
    let s = k + 1; while (T[s] && QUALIFIERS.has(T[s].v)) s++;
    return !!T[s] && types.has(T[s].v) && !!T[s + 1] && T[s + 1].k === 'id';
  }
  // Trip count of `for (init; cond; step)` with header tokens (hs, he). Returns a number or { why }.
  function tripOf(hs, he, bodyS, bodyE, fn, env) {
    const parts = []; let s = hs, d = 0;
    for (let j = hs; j < he; j++) { const v = T[j].v; if (v === '(' || v === '[') d++; else if (v === ')' || v === ']') d--; else if (v === ';' && d === 0) { parts.push([s, j]); s = j + 1; } }
    parts.push([s, he]);
    if (parts.length !== 3) return { why: 'malformed header' };
    const [ini, cnd, stp] = parts, locals = new Map([...(fn ? localsOf(fn) : []), ...(env || [])]);
    let j = ini[0]; while (j < ini[1] && (types.has(T[j].v) || QUALIFIERS.has(T[j].v))) j++;
    if (j >= ini[1] || T[j].k !== 'id' || !T[j + 1] || T[j + 1].v !== '=') return { why: 'no counter is initialised in the loop header' };
    const name = T[j].v; let ie = j + 2, dd = 0; for (; ie < ini[1]; ie++) { const v = T[ie].v; if (v === '(' || v === '[') dd++; else if (v === ')' || v === ']') dd--; else if (v === ',' && dd === 0) break; }
    const start = evalExpr(j + 2, ie, locals);
    if (!start) return { why: `the start value of "${name}" is not a constant` };
    // Condition: conjuncts joined by && (any one bounding the counter suffices); || is not boundable.
    const conj = []; let cs = cnd[0]; d = 0;
    for (let k = cnd[0]; k < cnd[1]; k++) { const v = T[k].v; if (v === '(' || v === '[') d++; else if (v === ')' || v === ']') d--; else if (d === 0 && v === '||') return { why: 'the condition uses ||' }; else if (d === 0 && v === '&&') { conj.push([cs, k]); cs = k + 1; } }
    conj.push([cs, cnd[1]]);
    // Strip one layer of wrapping parentheses on a conjunct.
    const unwrap = ([a, b]) => (T[a] && T[a].v === '(' && match[a] === b - 1 ? [a + 1, b - 1] : [a, b]);
    // Step.
    let step = null, mode = 'add';
    { let k = stp[0], e = stp[1]; const segs = []; let ss = k; d = 0; for (; k < e; k++) { const v = T[k].v; if (v === '(' || v === '[') d++; else if (v === ')' || v === ']') d--; else if (v === ',' && d === 0) { segs.push([ss, k]); ss = k + 1; } } segs.push([ss, e]);
      for (const [a, b] of segs) {
        const v0 = T[a] && T[a].v, v1 = T[a + 1] && T[a + 1].v;
        if (b - a === 2 && ((v0 === name && (v1 === '++' || v1 === '--')) || ((v0 === '++' || v0 === '--') && v1 === name))) { step = (v0 === '--' || v1 === '--') ? [-1, -1] : [1, 1]; continue; }
        if (v0 === name && ['+=', '-=', '*=', '/='].includes(v1)) { const r = evalExpr(a + 2, b, locals); if (!r) return { why: 'the step is not a constant' }; if (v1 === '+=') step = r; else if (v1 === '-=') step = [-r[1], -r[0]]; else { step = v1 === '*=' ? r : [1 / r[1], 1 / r[0]]; mode = 'mul'; } continue; }
        if (v0 === name && v1 === '=' && T[a + 2] && T[a + 2].v === name && ['+', '-', '*'].includes(T[a + 3] && T[a + 3].v)) { const r = evalExpr(a + 4, b, locals); if (!r) return { why: 'the step is not a constant' }; const op = T[a + 3].v; if (op === '+') step = r; else if (op === '-') step = [-r[1], -r[0]]; else { step = r; mode = 'mul'; } continue; }
        if (segs.some(([x, y]) => { for (let q = x; q < y; q++) if (T[q].v === name) return true; return false; }) && !step) return { why: `"${name}" is not stepped by a constant` };
      }
    }
    if (!step) return { why: `"${name}" is never stepped in the header` };
    if (modifies(name, bodyS, bodyE)) return { why: `the body changes "${name}"` };
    let best = null, range = null;
    for (const c0 of conj) {
      const [a, b] = unwrap(c0); let opAt = -1; d = 0;
      for (let k = a; k < b; k++) { const v = T[k].v; if (v === '(' || v === '[') d++; else if (v === ')' || v === ']') d--; else if (d === 0 && ['<', '<=', '>', '>=', '!='].includes(v)) { opAt = k; break; } }
      if (opAt < 0) continue;
      let op = T[opAt].v, bound = null;
      if (opAt === a + 1 && T[a].v === name) bound = evalExpr(opAt + 1, b, locals);
      else if (opAt === b - 2 && T[b - 1].v === name) { bound = evalExpr(a, opAt, locals); op = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '!=': '!=' }[op]; }
      if (!bound) continue;
      let n = null;
      if (mode === 'add') {
        if (step[0] > 0 && (op === '<' || op === '<=' || op === '!=')) { const span = bound[1] - start[0]; n = span < 0 ? 0 : Math.floor(span / step[0]) + (op === '<=' || span % step[0] !== 0 ? 1 : 0); }
        else if (step[1] < 0 && (op === '>' || op === '>=' || op === '!=')) { const span = start[1] - bound[0], s = -step[1]; n = span < 0 ? 0 : Math.floor(span / s) + (op === '>=' || span % s !== 0 ? 1 : 0); }
      } else if (step[0] > 1 && start[0] > 0 && (op === '<' || op === '<=')) n = bound[1] <= start[0] ? 0 : Math.ceil(Math.log(bound[1] / start[0]) / Math.log(step[0])) + 1;
      else if (step[1] < 1 && step[0] > 0 && bound[0] > 0 && (op === '>' || op === '>=')) n = start[1] <= bound[0] ? 0 : Math.ceil(Math.log(start[1] / bound[0]) / Math.log(1 / step[1])) + 1;
      if (n != null && (best == null || n < best)) { best = n; range = step[0] > 0 && mode === 'add' || mode === 'mul' && step[0] > 1 ? [start[0], bound[1]] : [bound[0], start[1]]; }
    }
    if (best == null) return { why: `the condition does not bound "${name}" by a constant in the direction it steps` };
    return { n: Math.min(best, 1e9), name, range };
  }
  // Cost of a token range: { iters, fetches }.
  const memo = new Map(), visiting = new Set(); let loops = 0, maxTrip = 0;
  // Cost of calling name() with n arguments (overloads with the same arity are merged: their maximum).
  function fnCost(name, n, callTok) {
    const all = fns.get(name), list = all.filter(f => n == null || f.arity === n), use = list.length ? list : all;
    const key = name + '/' + (list.length ? n : '*');
    if (memo.has(key)) return memo.get(key);
    if (visiting.has(key)) { at(callTok || use[0].tok, 'error', 'recursion', `Recursion through ${name}() (GLSL does not allow it).`); return { iters: 0, fetches: 0 }; }
    visiting.add(key);
    let best = { iters: 0, fetches: 0 };
    for (const fn of use) { const c = rangeCost(fn.body[0], fn.body[1], fn); best = { iters: Math.max(best.iters, c.iters), fetches: Math.max(best.fetches, c.fetches) }; }
    visiting.delete(key); memo.set(key, best); return best;
  }
  function rangeCost(a, b, fn, env) {
    let iters = 0, fetches = 0;
    for (let i = a; i < b; i++) {
      const t = T[i]; if (t.k !== 'id') continue;
      if (t.v === 'for' && T[i + 1] && T[i + 1].v === '(') {
        const hc = match[i + 1], be = stmtEnd(hc + 1);
        const trip = tripOf(i + 2, hc, hc + 1, be, fn, env);
        // Inner loops may be bounded by this counter (for (int j = 0; j < i; j++)): pass its range down.
        const env2 = trip.name ? new Map([...(env || []), [trip.name, trip.range]]) : env;
        const inner = rangeCost(hc + 1, be, fn, env2), head = rangeCost(i + 2, hc, fn, env);
        let n = trip.n;
        loops++;
        if (trip.why) { if (kitTok(t)) at(t, 'error', 'unbounded-loop', `Loop has no constant bound: ${trip.why}. Use for (int i = 0; i < N; i++) with a constant N (or a declared int param) and break early.`); n = 1; }
        else if (n > LIMITS.loopTrip && kitTok(t)) at(t, 'error', 'loop-trip', `Loop runs up to ${n} times; the limit is ${LIMITS.loopTrip}.`);
        maxTrip = Math.max(maxTrip, n);
        iters += n * (1 + inner.iters) + (n + 1) * head.iters; fetches += n * inner.fetches + (n + 1) * head.fetches;
        i = be - 1; continue;
      }
      if (t.v === 'while' && T[i + 1] && T[i + 1].v === '(') {
        const be = stmtEnd(match[i + 1] + 1); const inner = rangeCost(match[i + 1] + 1, be, fn, env);
        loops++; if (kitTok(t)) at(t, 'error', 'unbounded-loop', 'while loops cannot be bounded statically; rewrite as for (int i = 0; i < N; i++) with a constant N and break early.');
        iters += 1 + inner.iters; fetches += inner.fetches; i = be - 1; continue;
      }
      if (t.v === 'do') {
        const be = stmtEnd(i); const inner = rangeCost(i + 1, stmtEnd(i + 1), fn, env);
        loops++; if (kitTok(t)) at(t, 'error', 'unbounded-loop', 'do … while loops cannot be bounded statically; rewrite as for (int i = 0; i < N; i++) with a constant N and break early.');
        iters += 1 + inner.iters; fetches += inner.fetches; i = be - 1; continue;
      }
      if (T[i + 1] && T[i + 1].v === '(') {
        if (isFetch(t.v)) { fetches += 1; continue; }
        if (fns.has(t.v) && !(T[i - 1] && types.has(T[i - 1].v))) { const c = fnCost(t.v, arity(i + 1), t); iters += c.iters; fetches += c.fetches; }
        else if (ctx.known && ctx.known.has(t.v)) { const c = ctx.known.get(t.v); iters += c.iters; fetches += c.fetches; }
      }
    }
    return { iters: Math.min(iters, 1e12), fetches: Math.min(fetches, 1e12) };
  }
  // Arrays: declarations and constructors, per-array element cap and a per-pass component budget.
  let components = 0;
  for (let i = 0; i < N; i++) {
    const t = T[i]; if (!types.has(t.v) || !kitTok(t)) continue;
    let lb = -1, comp = COMPONENTS[t.v] || 4;
    if (T[i + 1] && T[i + 1].v === '[') lb = i + 1;                                                        // float[N] name / float[N](…)
    else if (T[i + 1] && T[i + 1].k === 'id' && T[i + 2] && T[i + 2].v === '[') lb = i + 2;                 // float name[N]
    if (lb < 0) continue;
    const rb = match[lb]; if (rb < 0) continue;
    if (rb === lb + 1) continue; // unsized: float[](…) takes its size from the constructor
    const r = evalExpr(lb + 1, rb, null);
    if (!r) continue; // the compiler rejects non-constant sizes
    const n = r[1];
    if (n > LIMITS.arrayElements) at(t, 'error', 'array', `Array of ${n} elements; the limit is ${LIMITS.arrayElements}.`);
    // A constructor float[N](…) next to a declaration float name[N] = … describes the same array: count declarations only.
    if (!(lb === i + 1 && T[rb + 1] && T[rb + 1].v === '(')) components += n * comp;
  }
  if (components > LIMITS.arrayComponents) at(T.find(kitTok), 'error', 'array', `Arrays in this pass hold ${components} values; the limit is ${LIMITS.arrayComponents}.`);
  const entry = ctx.entry && fns.has(ctx.entry) ? fnCost(ctx.entry, null, null) : { iters: 0, fetches: 0 };
  // Unreachable functions are still compiled: analyse them for hazards (their cost is not counted).
  const costs = new Map();
  for (const [name, list] of fns) { if (!ctx.entry || list.some(f => kitTok(f.tok))) { const c = fnCost(name, null, null); costs.set(name, c); } }
  return { iterations: entry.iters, fetches: entry.fetches, maxTrip, loops, components, functions: fns.size, tokens: N, costs };
}

// Analyze one pass exactly as the runtime will compile it.
let preludeCache = null;
function analyzePass({ src, file, common, commonFile, params, inputs, extra, entry }) {
  const diagnostics = [];
  const diag = (severity, code, seg, line, message) => { if (diagnostics.length < 40) diagnostics.push({ severity, code, file: seg, line, message }); };
  // The prelude is trusted and parameter-free: analyse it once and reuse its per-function costs (lfbm = 8 noise
  // octaves, lvoro = 9 cells, buf() = 1 fetch …) for every kit.
  if (!preludeCache) {
    const d = [], r = preprocess([{ seg: 'prelude', text: KG.PRELUDE, trusted: true }], (...a) => d.push(a));
    const a = analyze(r.tokens, { trustedSegs: new Set(['prelude']), entry: null }, () => {});
    preludeCache = { macros: r.macros, known: a.costs };
  }
  const trusted = new Set(['prelude', 'params', 'inputs', 'runtime']);
  const bytes = (src || '').length + (common || '').length;
  if (bytes > LIMITS.fileBytes * 2) diag('error', 'size', file, null, `Pass and common together are ${Math.round(bytes / 1024)} KB; the limit is ${LIMITS.fileBytes * 2 / 1024} KB.`);
  const segs = [
    { seg: 'params', text: KG.paramUniforms(params || {}), trusted: true },
    { seg: 'inputs', text: inputs && inputs.length ? KG.inputSource(inputs) : '', trusted: true },
    { seg: 'runtime', text: extra || '', trusted: true },
    { seg: commonFile || 'common.glsl', text: common || '' },
    { seg: file, text: src || '' },
  ];
  const pp = preprocess(segs, diag, new Map(preludeCache.macros));
  const stats = analyze(pp.tokens, { trustedSegs: trusted, params, entry: entry || 'motif', known: preludeCache.known }, diag);
  if (!stats.broken) {
    if (stats.iterations > LIMITS.iterationsPerPixel) diag('error', 'budget', file, null, `Up to ${Math.round(stats.iterations)} loop iterations per pixel; the limit is ${LIMITS.iterationsPerPixel}. Lower loop bounds or move work to a lower-resolution pass.`);
    else if (stats.iterations > LIMITS.iterationsSoft) diag('warning', 'budget', file, null, `Up to ${Math.round(stats.iterations)} loop iterations per pixel: heavy on integrated GPUs.`);
    if (stats.fetches > LIMITS.fetchesPerPixel) diag('error', 'budget', file, null, `Up to ${Math.round(stats.fetches)} texture reads per pixel; the limit is ${LIMITS.fetchesPerPixel}.`);
    else if (stats.fetches > LIMITS.fetchesSoft) diag('warning', 'budget', file, null, `Up to ${Math.round(stats.fetches)} texture reads per pixel: bandwidth-heavy.`);
  }
  // Never report a trusted (runtime) segment as the author's fault.
  for (const d of diagnostics) if (trusted.has(d.file)) { d.file = file; d.line = null; d.message = `(in runtime declarations) ${d.message}`; }
  return { diagnostics, stats };
}

// ---------------------------------------------------------------------------------------------------------------
// motif-kit@2 manifest.
const strip = s => String(s || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const usesAudio = text => text.includes('u_audio') && /\bu_audio\b/.test(strip(text));
// Per-pass declarations the runtime adds for graph buffers, iteration, transition progress and audio.
function runtimeDecls(kind, caps, reads) {
  let s = '';
  for (const r of reads || []) s += `uniform sampler2D g_${r};\nvec4 g_${r}At(vec2 q) { return texture(g_${r}, q); }\nvec4 g_${r}Px(vec2 fc) { return texture(g_${r}, fc / u_res); }\n`;
  if (reads) s += 'uniform int u_iter;   // ping-pong step 0..u_iters-1\nuniform int u_iters;\n';
  if (kind === 'transition') s += 'uniform float u_progress; // 0 = from, 1 = to\n';
  if (caps && caps.includes('audio')) s += 'uniform float u_audio[8]; // sub, bass, lowmid, mid, highmid, high, level, onset (0..1)\nfloat audioBand(int b) { return u_audio[clamp(b, 0, 7)]; }\n';
  return s;
}
function normGraph(g, kind, where, fileText, err, warn) {
  const ext = EXTERNALS[kind] || [];
  if (!g || typeof g !== 'object' || Array.isArray(g)) { err(`${where}.graph must be an object with buffers and passes.`); return null; }
  const buffers = {};
  const rawB = g.buffers == null ? {} : g.buffers;
  if (typeof rawB !== 'object' || Array.isArray(rawB)) { err(`${where}.graph.buffers must be an object.`); return null; }
  const bnames = Object.keys(rawB);
  if (bnames.length > LIMITS.graphBuffers) err(`${where}.graph: at most ${LIMITS.graphBuffers} buffers.`);
  for (const n of bnames.slice(0, LIMITS.graphBuffers)) {
    const b = rawB[n] || {};
    if (!BUF_RE.test(n) || ['input', 'from', 'to', 'output'].includes(n)) { err(`${where}.graph.buffers.${n}: name must be camelCase (max 16) and not input, from, to or output.`); continue; }
    const scale = b.scale == null ? 1 : Number(b.scale);
    if (!(scale >= 0.125 && scale <= 1)) { err(`${where}.graph.buffers.${n}.scale must be 0.125–1.`); continue; }
    buffers[n] = { scale };
  }
  if (!Array.isArray(g.passes) || !g.passes.length || g.passes.length > LIMITS.graphPasses) { err(`${where}.graph.passes must list 1–${LIMITS.graphPasses} passes.`); return null; }
  const written = new Set(), passes = []; let executions = 0, feedback = false;
  g.passes.forEach((ps, i) => {
    const pw = `${where}.graph.passes[${i}]`;
    if (!ps || typeof ps !== 'object') return err(`${pw} must be an object.`);
    const src = fileText(ps.src);
    if (src == null) return err(`${pw}: file "${ps.src}" is not in the package.`);
    if (!/\bvec4\s+motif\s*\(\s*vec2\s+\w+\s*,\s*vec2\s+\w+\s*\)/.test(src)) err(`${pw}: ${ps.src} must define vec4 motif(vec2 uv, vec2 fc).`);
    if (/\bvoid\s+main\s*\(/.test(src)) err(`${pw}: ${ps.src} must not define main(); the runtime supplies it.`);
    const writes = ps.writes == null ? (i === g.passes.length - 1 ? 'output' : null) : String(ps.writes);
    if (writes !== 'output' && !buffers[writes]) return err(`${pw}.writes must be "output" or a declared buffer.`);
    if (writes !== 'output' && written.has(writes)) return err(`${pw}: buffer "${writes}" is already written by an earlier pass.`);
    const reads = ps.reads == null ? [] : ps.reads;
    if (!Array.isArray(reads) || reads.length > LIMITS.passReads) return err(`${pw}.reads must be an array of at most ${LIMITS.passReads} names.`);
    for (const r of reads) {
      if (ext.includes(r)) continue;
      if (r === 'output') return err(`${pw}: no pass can read "output".`);
      if (!buffers[r]) return err(`${pw}: reads "${r}", which is not ${ext.length ? ext.map(x => `"${x}"`).join(', ') + ' or ' : ''}a declared buffer.`);
      if (!written.has(r) && r !== writes) return err(`${pw}: reads "${r}" before any pass writes it.`);
    }
    const iterate = ps.iterate == null ? 1 : Number(ps.iterate);
    if (!Number.isInteger(iterate) || iterate < 1 || iterate > LIMITS.iterate) return err(`${pw}.iterate must be an integer 1–${LIMITS.iterate}.`);
    if (writes === 'output' && (iterate > 1 || reads.includes('output'))) return err(`${pw}: the output pass runs once and cannot read itself.`);
    if (writes === 'output' && i !== g.passes.length - 1) return err(`${pw}: only the last pass writes "output".`);
    if (reads.includes(writes) || iterate > 1) feedback = true;
    if (iterate > 1 && !reads.includes(writes)) warn(`${pw}: iterate ${iterate} without reading "${writes}" repeats identical work.`);
    executions += iterate; if (writes !== 'output') written.add(writes);
    passes.push({ file: ps.src, src, reads: reads.slice(), writes, iterate });
  });
  if (passes.length && passes[passes.length - 1].writes !== 'output') err(`${where}.graph: the last pass must write "output".`);
  if (executions > LIMITS.executions) err(`${where}.graph runs ${executions} pass executions per frame; the limit is ${LIMITS.executions}.`);
  for (const n of Object.keys(buffers)) if (!written.has(n)) warn(`${where}.graph: buffer "${n}" is never written.`);
  return { buffers, passes, externals: ext.slice(), linear: false, feedback, executions };
}
// v1-style linear `passes` on an effect or transition become a graph: pass i writes p<i>, reads every earlier pass
// and the external inputs; u_buf0..3 stay bound as in motif-kit@1.
function linearGraph(list, kind, where, fileText, err) {
  if (!Array.isArray(list) || !list.length || list.length > KG.MAX_PASSES) { err(`${where}: passes must list 1–${KG.MAX_PASSES} shader files (or use "graph").`); return null; }
  const ext = EXTERNALS[kind] || [], buffers = {}, passes = [];
  list.forEach((ps, i) => {
    const src = fileText(ps && ps.src);
    if (src == null) return err(`${where}: pass ${i + 1} file "${ps && ps.src}" is not in the package.`);
    if (!/\bvec4\s+motif\s*\(\s*vec2\s+\w+\s*,\s*vec2\s+\w+\s*\)/.test(src)) err(`${where}: ${ps.src} must define vec4 motif(vec2 uv, vec2 fc).`);
    if (/\bvoid\s+main\s*\(/.test(src)) err(`${where}: ${ps.src} must not define main(); the runtime supplies it.`);
    const scale = ps.scale == null ? 1 : Number(ps.scale);
    if (!(scale >= 0.125 && scale <= 1)) err(`${where}: pass ${i + 1} scale must be 0.125–1.`);
    const last = i === list.length - 1;
    if (!last) buffers['p' + i] = { scale };
    passes.push({ file: ps.src, src, reads: [...ext, ...passes.map((_, j) => 'p' + j)], writes: last ? 'output' : 'p' + i, iterate: 1 });
  });
  return { buffers, passes, externals: ext.slice(), linear: true, feedback: false, executions: passes.length };
}
function normPreset(p, where, err) {
  const out = {};
  if (!p || typeof p !== 'object' || Array.isArray(p)) { err(`${where}.preset must be an object of export settings.`); return out; }
  for (const [k, v] of Object.entries(p)) {
    const rule = EXPORT_PRESET[k];
    if (!rule) { err(`${where}.preset.${k}: not an export setting. Exporters are declarative presets (${Object.keys(EXPORT_PRESET).join(', ')}); they cannot run code.`); continue; }
    if (Array.isArray(rule)) { if (!rule.includes(v)) err(`${where}.preset.${k} must be one of ${rule.join(', ')}.`); else out[k] = v; }
    else if (rule instanceof RegExp) { if (typeof v !== 'string' || !rule.test(v)) err(`${where}.preset.${k} is not a known value.`); else out[k] = v; }
    else if (rule === 'bool') { if (typeof v !== 'boolean') err(`${where}.preset.${k} must be true or false.`); else out[k] = v; }
    else { const [, lo, hi] = rule.split(':').map(Number); if (!Number.isInteger(v) || v < lo || v > hi) err(`${where}.preset.${k} must be an integer ${lo}–${hi}.`); else out[k] = v; }
  }
  if (!out.format) err(`${where}.preset.format is required.`);
  return out;
}
// motif-kit@2 and @3 share one validator; @3 adds text inputs and the text capability.
function validateV2(m, files) {
  const v3 = m.format === KIT_FORMAT_3;
  const errors = [], warnings = [];
  const err = x => errors.push(x), warn = x => warnings.push(x);
  if (!KG.ID_RE.test(m.id || '')) err('id must be 2–32 chars: lowercase letters, digits and hyphens, starting with a letter.');
  else if (KG.RESERVED_KITS.has(m.id)) err(`id "${m.id}" is reserved.`);
  if (!m.name || String(m.name).length > 32) err('name is required (max 32 chars).');
  if (!KG.SEMVER_RE.test(m.version || '')) err('version must be semver, e.g. "1.0.0".');
  if (m.accent && !KG.HEX_RE.test(m.accent)) err('accent must be a #RRGGBB colour.');
  let total = 0; for (const [k, v] of Object.entries(files || {})) { const n = typeof v === 'string' ? v.length : 0; total += n; if (/\.glsl$/.test(k) && n > KG.KIT_LIMITS.fileBytes) err(`${k} is larger than ${KG.KIT_LIMITS.fileBytes / 1024} KB.`); }
  if (total > KG.KIT_LIMITS.kitBytes) err(`Kit is larger than ${KG.KIT_LIMITS.kitBytes / 1048576} MB.`);
  const fileText = p => { const v = files && typeof p === 'string' && Object.prototype.hasOwnProperty.call(files, p) ? files[p] : null; return typeof v === 'string' ? v : null; };
  const common = m.common ? fileText(m.common) : '';
  if (m.common && common == null) err(`common file "${m.common}" is not in the package.`);
  if (common && /\bvoid\s+main\s*\(/.test(common)) err('common.glsl must not define main().');
  // Capabilities: declared up front, shown at install, approved by the user.
  const caps = m.capabilities == null ? [] : m.capabilities;
  if (!Array.isArray(caps)) err('capabilities must be an array, e.g. ["media"].');
  const capabilities = [], known = Object.keys(CAPABILITIES).filter(c => v3 || c !== 'text');
  for (const c of Array.isArray(caps) ? caps : []) {
    if (c === 'text' && !v3) { err('capability "text" needs "format": "motif-kit@3".'); continue; }
    if (!CAPABILITIES[c]) { err(`capability "${String(c).slice(0, 24)}" does not exist. Kits can ask for ${known.join(', ')}; never network, DOM or script access.`); continue; }
    if (!capabilities.includes(c)) capabilities.push(c);
  }
  // Palettes (as motif-kit@1).
  const palettes = [];
  if (m.palettes != null && !Array.isArray(m.palettes)) err('palettes must be an array.');
  (Array.isArray(m.palettes) ? m.palettes : []).slice(0, KG.KIT_LIMITS.palettes).forEach((p, i) => {
    const where = `palettes[${i}]`;
    if (!p || !KG.ID_RE.test(p.id || '')) return err(`${where}.id is invalid.`);
    const cols = [p.bg, p.ink, ...(Array.isArray(p.a) ? p.a : [])];
    if (!Array.isArray(p.a) || p.a.length !== 3 || !cols.every(c => KG.HEX_RE.test(c || ''))) return err(`${where} needs bg, ink and exactly three accents as #RRGGBB.`);
    palettes.push({ id: `${m.id}.${p.id}`, name: String(p.name || p.id).slice(0, 24), bg: p.bg.toUpperCase(), ink: p.ink.toUpperCase(), a: p.a.map(c => c.toUpperCase()), kit: m.id });
  });
  if (Array.isArray(m.palettes) && m.palettes.length > KG.KIT_LIMITS.palettes) warn(`Only the first ${KG.KIT_LIMITS.palettes} palettes are used.`);
  const kitInputs = KG.normInputs(m.inputs, '', err, { text: v3 });
  const seen = new Set(), out = { style: [], effect: [], transition: [], exporter: [] };
  const lists = { style: m.styles, effect: m.effects, transition: m.transitions, exporter: m.exporters };
  for (const [kind, key] of [['style', 'styles'], ['effect', 'effects'], ['transition', 'transitions'], ['exporter', 'exporters']]) {
    const list = lists[kind];
    if (list == null) continue;
    if (!Array.isArray(list)) { err(`${key} must be an array.`); continue; }
    if (list.length > LIMITS.entries[kind]) err(`A kit can hold at most ${LIMITS.entries[kind]} ${key}.`);
    list.slice(0, LIMITS.entries[kind]).forEach((s, i) => {
      const where = `${key}[${i}]${s && s.id ? ` (${s.id})` : ''}`;
      if (!s || typeof s !== 'object' || !KG.ID_RE.test(s.id || '')) return err(`${where}: id is invalid.`);
      if (seen.has(s.id)) return err(`${where}: duplicate id (ids are unique across styles, effects, transitions and exporters).`); seen.add(s.id);
      if (!s.name || String(s.name).length > 32) err(`${where}: name is required (max 32 chars).`);
      const base = { id: `${m.id}/${s.id}`, localId: s.id, kind, name: String(s.name || s.id).slice(0, 32), blurb: String(s.blurb || '').slice(0, 160), group: String(s.group || '').slice(0, 24), tags: (Array.isArray(s.tags) ? s.tags : []).map(String).slice(0, 8) };
      if (kind === 'exporter') {
        for (const k of Object.keys(s)) if (!['id', 'name', 'blurb', 'group', 'tags', 'preset'].includes(k)) err(`${where}.${k}: exporters hold only id, name, blurb, group, tags and a declarative preset.`);
        out.exporter.push({ ...base, preset: normPreset(s.preset, where, err) }); return;
      }
      if (s.graph != null && s.passes != null) return err(`${where}: use either passes or graph, not both.`);
      let graph = null, passes = [];
      if (s.graph != null) { graph = normGraph(s.graph, kind, where, fileText, err, warn); if (!graph) return; passes = graph.passes.map(p => ({ file: p.file, src: p.src, scale: 1 })); }
      else if (kind === 'style') {
        if (!Array.isArray(s.passes) || !s.passes.length || s.passes.length > KG.MAX_PASSES) return err(`${where}: passes must list 1–${KG.MAX_PASSES} shader files (or use "graph").`);
        s.passes.forEach((ps, j) => {
          const src = fileText(ps && ps.src);
          if (src == null) return err(`${where}: pass ${j + 1} file "${ps && ps.src}" is not in the package.`);
          if (!/\bvec4\s+motif\s*\(\s*vec2\s+\w+\s*,\s*vec2\s+\w+\s*\)/.test(src)) err(`${where}: ${ps.src} must define vec4 motif(vec2 uv, vec2 fc).`);
          if (/\bvoid\s+main\s*\(/.test(src)) err(`${where}: ${ps.src} must not define main(); the runtime supplies it.`);
          const scale = ps.scale == null ? 1 : Number(ps.scale);
          if (!(scale >= 0.125 && scale <= 1)) err(`${where}: pass ${j + 1} scale must be 0.125–1.`);
          passes.push({ file: ps.src, src, scale });
        });
      } else { graph = linearGraph(s.passes, kind, where, fileText, err); if (!graph) return; passes = graph.passes.map(p => ({ file: p.file, src: p.src, scale: 1 })); }
      for (const p of passes) if (/\buniform\b/.test(strip(p.src))) warn(`${where}: ${p.file} declares its own uniforms; only params and u_ inputs are set by the runtime.`);
      const params = KG.normParams(s.params, where, err, kind === 'style' ? warn : x => { if (!/fewer than 4 params/.test(x)) warn(x); });
      const inputs = KG.resolveInputs(s, where, kitInputs, [common || '', ...passes.map(x => x.src || '')].join('\n'), [...out.style, ...out.effect, ...out.transition], params, err, warn, { text: v3 });
      if (kind !== 'style' && inputs.some(q => q.type === 'text')) err(`${where}: text inputs belong to styles (an ${kind} draws over host canvases).`);
      const cost = Math.max(0.25, Math.min(24, Number(s.cost) || 1));
      const e = { ...base, cost, flash: !!s.flash, passes, params, inputs };
      if (graph) e.graph = graph;
      if (kind === 'style') { const pal = s.palette ? `${m.id}.${s.palette}` : null; if (pal && !palettes.some(p => p.id === pal)) warn(`${where}: palette "${s.palette}" is not defined by the kit.`); e.palette = pal && palettes.some(p => p.id === pal) ? pal : null; }
      if (kind === 'effect') { const tg = s.target == null ? 'any' : s.target; if (!['layer', 'finish', 'any'].includes(tg)) err(`${where}.target must be layer, finish or any.`); e.target = tg; }
      if (kind === 'transition') { const d = s.duration == null ? 1 : Number(s.duration); if (!(d >= 0.1 && d <= 10)) err(`${where}.duration must be 0.1–10 seconds.`); e.duration = d; }
      out[kind].push(e);
    });
  }
  if (!out.style.length && !out.effect.length && !out.transition.length && !out.exporter.length) err('A kit needs at least one style, effect, transition or exporter.');
  const ok = errors.length === 0;
  const fmt = v3 ? KIT_FORMAT_3 : KIT_FORMAT_2;
  return { ok, errors, warnings, kit: ok ? { format: fmt, sourceFormat: fmt, id: m.id, name: String(m.name), version: m.version, author: String(m.author || '').slice(0, 48), description: String(m.description || '').slice(0, 280), accent: m.accent || null, license: String(m.license || '').slice(0, 32), palettes, common: common || '', commonFile: m.common || null, capabilities, styles: out.style, effects: out.effect, transitions: out.transition, exporters: out.exporter, migration: null } : null };
}
// motif-kit@1 → @2: the normalized @1 kit is already a valid @2 kit with styles only. Record what changed.
function upgradeV1(v, m) {
  if (!v.ok) return v;
  const k = v.kit, media = k.styles.filter(s => s.inputs && s.inputs.length);
  const capabilities = media.length ? ['media'] : [];
  const steps = [`format ${KIT_FORMAT_1} → ${KIT_FORMAT_2}`, media.length ? `capabilities inferred: media (${media.map(s => s.localId).slice(0, 4).join(', ')}${media.length > 4 ? '…' : ''} declare media inputs)` : 'capabilities inferred: none', 'styles, params and shaders are used exactly as authored'];
  const styles = k.styles.map(s => ({ ...s, kind: 'style' }));
  return { ...v, kit: { ...k, format: KIT_FORMAT_2, sourceFormat: KIT_FORMAT_1, commonFile: m.common || null, capabilities, styles, effects: [], transitions: [], exporters: [], migration: { from: KIT_FORMAT_1, to: KIT_FORMAT_2, steps } } };
}
// Runtime compile description for an entry ({ extra, graph }) — what rt.compile() needs beyond passes/params.
function runtimeOf(kit, e) {
  const caps = kit.capabilities || [];
  if (!e.graph) { const extra = runtimeDecls(e.kind, caps, null); return extra ? { extra } : null; }
  return { graph: { ...e.graph, passes: e.graph.passes.map(p => ({ src: p.src, file: p.file, reads: p.reads, writes: p.writes, iterate: p.iterate, extra: runtimeDecls(e.kind, caps, p.reads) })) } };
}
const renderables = kit => [...(kit.styles || []), ...(kit.effects || []), ...(kit.transitions || [])];

// The one entry point: package scan → format dispatch (+ migration) → static analysis → capability checks → report.
// opts.analyze === false skips GLSL analysis (bundled, already-audited catalog kits at boot).
function validate(manifest, files, opts = {}) {
  const pre = scanPackage(manifest, files);
  const asDiag = (list, severity) => list.map(message => ({ severity, code: 'manifest', file: 'manifest.json', line: null, message }));
  if (pre.length) return { ok: false, errors: pre, warnings: [], diagnostics: asDiag(pre, 'error'), kit: null, report: null };
  let v;
  if (manifest.format === KIT_FORMAT_1) v = upgradeV1(KG.validateKit(manifest, files), manifest);
  else if (manifest.format === KIT_FORMAT_2 || manifest.format === KIT_FORMAT_3) v = validateV2(manifest, files);
  else { const e = [`format must be "${KIT_FORMAT_1}", "${KIT_FORMAT_2}" or "${KIT_FORMAT_3}" (got ${JSON.stringify(manifest.format)}).`]; return { ok: false, errors: e, warnings: [], diagnostics: asDiag(e, 'error'), kit: null, report: null }; }
  const diagnostics = [...asDiag(v.errors, 'error'), ...asDiag(v.warnings, 'warning')];
  if (!v.ok) return { ...v, diagnostics, report: null };
  const kit = v.kit, errors = [], warnings = v.warnings.slice(), entries = [];
  for (const e of renderables(kit)) {
    const rtm = runtimeOf(kit, e); e.runtime = rtm;
    const gp = e.graph ? rtm.graph.passes : e.passes.map(p => ({ src: p.src, file: p.file, extra: rtm && rtm.extra }));
    const rep = { id: e.id, localId: e.localId, kind: e.kind, passes: gp.length, executions: e.graph ? e.graph.executions : gp.length, iterations: 0, fetches: 0, maxTrip: 0, cost: e.cost };
    const text = [kit.common, ...gp.map(p => p.src)].join('\n');
    if (usesAudio(text) && !kit.capabilities.includes('audio')) errors.push(`${e.localId}: reads u_audio but the kit does not declare the "audio" capability.`);
    if (e.inputs.some(q => q.type !== 'text') && kit.sourceFormat !== KIT_FORMAT_1 && !kit.capabilities.includes('media')) errors.push(`${e.localId}: has media inputs but the kit does not declare the "media" capability.`);
    if (e.inputs.some(q => q.type === 'text') && !kit.capabilities.includes('text')) errors.push(`${e.localId}: has a text input but the kit does not declare the "text" capability.`);
    if (e.graph && e.graph.feedback && !kit.capabilities.includes('feedback')) errors.push(`${e.localId}: iterates a pass on its own output but the kit does not declare the "feedback" capability.`);
    if (opts.analyze !== false) {
      for (const p of gp) {
        const a = analyzePass({ src: p.src, file: p.file, common: kit.common, commonFile: kit.commonFile || 'common.glsl', params: e.params, inputs: e.inputs, extra: p.extra, entry: 'motif' });
        const reps = e.graph ? (e.graph.passes.find(q => q.file === p.file && q.src === p.src) || {}).iterate || 1 : 1;
        rep.iterations = Math.max(rep.iterations, a.stats.iterations); rep.fetches = Math.max(rep.fetches, a.stats.fetches); rep.maxTrip = Math.max(rep.maxTrip, a.stats.maxTrip || 0);
        rep.work = (rep.work || 0) + reps * (1 + a.stats.iterations);
        for (const d of a.diagnostics) {
          const dd = { ...d, entry: e.localId };
          if (!diagnostics.some(x => x.severity === dd.severity && x.file === dd.file && x.line === dd.line && x.message === dd.message)) {
            diagnostics.push(dd);
            (d.severity === 'error' ? errors : warnings).push(`${e.localId}: ${d.file || ''}${d.line ? ` line ${d.line}` : ''}: ${d.message}`);
          }
        }
      }
    }
    entries.push(rep);
  }
  for (const c of kit.capabilities) {
    const used = c === 'audio' ? renderables(kit).some(e => usesAudio([kit.common, ...e.passes.map(p => p.src)].join('\n'))) : c === 'media' ? renderables(kit).some(e => e.inputs.some(q => q.type !== 'text')) : c === 'text' ? renderables(kit).some(e => e.inputs.some(q => q.type === 'text')) : renderables(kit).some(e => e.graph && e.graph.feedback);
    if (!used) warnings.push(`Declares the "${c}" capability but does not use it.`);
  }
  for (const m of errors) if (!diagnostics.some(d => m.endsWith(d.message))) diagnostics.push({ severity: 'error', code: 'capability', file: 'manifest.json', line: null, message: m });
  const ok = errors.length === 0;
  const report = { format: kit.format, sourceFormat: kit.sourceFormat, migration: kit.migration, capabilities: kit.capabilities.slice(), kinds: { styles: kit.styles.length, effects: kit.effects.length, transitions: kit.transitions.length, exporters: kit.exporters.length }, entries, analyzed: opts.analyze !== false, limits: { iterationsPerPixel: LIMITS.iterationsPerPixel, fetchesPerPixel: LIMITS.fetchesPerPixel, loopTrip: LIMITS.loopTrip } };
  return { ok, errors, warnings, diagnostics, kit: ok ? kit : null, report };
}
// Capabilities a user must approve for this kit (bundled kits are trusted by the app build itself).
function capabilityInfo(list) { return (list || []).map(c => ({ id: c, text: CAPABILITIES[c] || c })); }

return { KIT_FORMAT_1, KIT_FORMAT_2, KIT_FORMAT_3, FORMATS, KINDS, CAPABILITIES, LIMITS, PRAGMA_ALLOW, EXTENSION_ALLOW, validate, scanPackage, analyzePass, preprocess, runtimeDecls, runtimeOf, renderables, capabilityInfo, upgradeV1 };

})();
