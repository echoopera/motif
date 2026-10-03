// GLSL ES 3.00 (Motif kit dialect) → Metal Shading Language.
//
// The translator works on the same source the web runtime compiles (prelude + params + media inputs + kit common +
// pass), so the Metal build is generated from the web build, not rewritten by hand. A pass becomes one C++ struct:
//
//   struct MPass_x { <uniform fields>  <mutable globals>  <every function as a member> };
//
// Member functions read uniforms (u_res, u_p, p_<param> …) as plain identifiers, so shader bodies need no rewriting
// to thread state through. Program-scope `const` data, structs and macros are hoisted above the struct.

const TYPE_MAP = {
  vec2: 'float2', vec3: 'float3', vec4: 'float4',
  ivec2: 'int2', ivec3: 'int3', ivec4: 'int4',
  uvec2: 'uint2', uvec3: 'uint3', uvec4: 'uint4',
  bvec2: 'bool2', bvec3: 'bool3', bvec4: 'bool4',
  mat2: 'float2x2', mat3: 'float3x3', mat4: 'float4x4',
  mat2x2: 'float2x2', mat2x3: 'float2x3', mat2x4: 'float2x4',
  mat3x2: 'float3x2', mat3x3: 'float3x3', mat3x4: 'float3x4',
  mat4x2: 'float4x2', mat4x3: 'float4x3', mat4x4: 'float4x4',
  sampler2D: 'MTex',
};
const MAT_DIM = { mat2: [2, 2], mat3: [3, 3], mat4: [4, 4] };
// Function renames. Metal has no scalar/vector mixing for these (GLSL does), no mod, and a different atan2.
const FN_MAP = {
  min: 'M_min', max: 'M_max', clamp: 'M_clamp', mix: 'M_mix', step: 'M_step', smoothstep: 'M_smoothstep', mod: 'M_mod',
  radians: 'M_radians', degrees: 'M_degrees', inversesqrt: 'rsqrt', roundEven: 'rint', dFdx: 'dfdx', dFdy: 'M_dFdy',
  texture: 'M_tex', textureLod: 'M_texLod', texelFetch: 'M_texelFetch', textureSize: 'M_texSize',
  lessThan: 'M_lessThan', lessThanEqual: 'M_lessThanEqual', greaterThan: 'M_greaterThan', greaterThanEqual: 'M_greaterThanEqual',
  equal: 'M_equal', notEqual: 'M_notEqual', matrixCompMult: 'M_matrixCompMult', inverse: 'M_inverse',
  // bit casts live in the Metal prelude under the GLSL names.
};
// GLSL identifiers that are legal in GLSL but reserved in C++ / MSL.
const RESERVED = new Set(['half', 'short', 'long', 'char', 'auto', 'register', 'operator', 'new', 'delete', 'class', 'this', 'template',
  'typename', 'namespace', 'using', 'public', 'private', 'protected', 'friend', 'virtual', 'explicit', 'mutable', 'static', 'extern',
  'typedef', 'union', 'enum', 'catch', 'try', 'throw', 'asm', 'export', 'signed', 'unsigned', 'kernel', 'fragment', 'vertex', 'constant',
  'device', 'thread', 'threadgroup', 'metal', 'simd', 'and', 'or', 'xor', 'not', 'bitand', 'bitor', 'compl', 'volatile', 'inline', 'goto',
  'sizeof', 'double', 'ray', 'visible', 'sampler', 'ushort', 'uchar', 'size_t', 'ptrdiff_t']);
const RESERVED_OUT = n => n + '_';

const TOK = /0[xX][0-9a-fA-F]+[uU]?|\d+\.?\d*(?:[eE][+-]?\d+)?[uUfF]?|\.\d+(?:[eE][+-]?\d+)?[fF]?|[A-Za-z_]\w*|\s+|[\s\S]/g;
const tokenize = s => s.match(TOK) || [];
const isIdent = t => /^[A-Za-z_]/.test(t);
const isSpace = t => /^\s+$/.test(t);

export function stripComments(s) {
  let out = '', i = 0;
  while (i < s.length) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++; }
    else if (c === '/' && d === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) { if (s[i] === '\n') out += '\n'; i++; } i += 2; out += ' '; }
    else out += s[i++];
  }
  return out;
}

function matchClose(tk, open) { // index of the bracket that closes tk[open]
  const o = tk[open], c = o === '(' ? ')' : o === '[' ? ']' : '}';
  let d = 0;
  for (let i = open; i < tk.length; i++) { if (tk[i] === o) d++; else if (tk[i] === c && --d === 0) return i; }
  throw new Error(`Unbalanced ${o} in shader source.`);
}
function splitArgs(tk) { // top-level comma split of a token slice
  const args = []; let cur = [], d = 0;
  for (const t of tk) {
    if (t === '(' || t === '[' || t === '{') d++; else if (t === ')' || t === ']' || t === '}') d--;
    if (t === ',' && d === 0) { args.push(cur); cur = []; } else cur.push(t);
  }
  if (cur.some(t => !isSpace(t)) || args.length) args.push(cur);
  return args;
}
const nextSig = (tk, i) => { let j = i + 1; while (j < tk.length && isSpace(tk[j])) j++; return j; };

// Per-translate() context: struct names count as types; names declared with a vector type drive == / != rewriting.
let CTX = { types: new Set(), vecNames: new Set() };
const VEC_TYPES = new Set(['vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4', 'uvec2', 'uvec3', 'uvec4', 'bvec2', 'bvec3', 'bvec4']);
const isTypeTok = t => !!TYPE_MAP[t] || t === 'float' || t === 'int' || t === 'uint' || t === 'bool' || CTX.types.has(t);
const SWZ = /^[xyzwrgbastpq]{2,4}$/;

// Rewrite  a == b  /  a != b  when an operand is a vector: GLSL compares whole vectors to one bool, Metal yields a bool vector.
function rewriteVectorEq(tk) {
  const out = [];
  const operand = (i, dir) => { // simple operand: ident or ident.swizzle; returns [startIdx, endIdx, isVector] or null
    let j = i;
    while (j >= 0 && j < tk.length && isSpace(tk[j])) j += dir;
    if (j < 0 || j >= tk.length) return null;
    if (dir < 0) {
      let end = j, base = j, swz = false;
      if (isIdent(tk[j]) && SWZ.test(tk[j]) && tk[j - 1] === '.' && isIdent(tk[j - 2] || '')) { swz = true; base = j - 2; }
      else if (!isIdent(tk[j])) return null;
      const before = tk[base - 1]; if (before === '.' || /\d/.test(before || '')) return null;
      return [base, end, swz || CTX.vecNames.has(tk[base])];
    }
    if (!isIdent(tk[j]) || isTypeTok(tk[j]) || tk[j + 1] === '(') return null;
    let end = j, swz = false;
    if (tk[j + 1] === '.' && isIdent(tk[j + 2] || '') && SWZ.test(tk[j + 2])) { end = j + 2; swz = true; }
    else if (tk[j + 1] === '.' || tk[j + 1] === '[') return null;
    return [j, end, swz || CTX.vecNames.has(tk[j])];
  };
  for (let i = 0; i < tk.length; i++) {
    const eq = tk[i] === '=' && tk[i + 1] === '=' && !/^[=!<>+\-*\/%&|^]$/.test(tk[i - 1] || ''), ne = tk[i] === '!' && tk[i + 1] === '=';
    if (!(eq || ne)) { out.push(tk[i]); continue; }
    // left operand lives in `out` already
    let k = out.length - 1; while (k >= 0 && isSpace(out[k])) k--;
    const L = operand_out(out, k), R = operand(i + 2, 1);
    if (L && R && (L[2] || R[2])) {
      const left = out.splice(L[0]).join('').trim();
      out.push(`${eq ? 'M_eq' : 'M_ne'}(${left}, ${tk.slice(R[0], R[1] + 1).join('')})`);
      i = R[1]; continue;
    }
    out.push(tk[i]);
  }
  return out;
  function operand_out(arr, k) {
    if (k < 0) return null;
    let base = k, swz = false;
    if (isIdent(arr[k]) && SWZ.test(arr[k]) && arr[k - 1] === '.' && isIdent(arr[k - 2] || '')) { swz = true; base = k - 2; }
    else if (!isIdent(arr[k])) return null;
    const before = arr[base - 1]; if (before === '.' ) return null;
    return [base, k, swz || CTX.vecNames.has(arr[base])];
  }
}

// Translate a run of tokens (an expression, statement list or whole function body).
function xl(tk, warn) {
  tk = rewriteVectorEq(tk);
  let out = '', prev = '';
  for (let i = 0; i < tk.length; i++) {
    const t = tk[i];
    if (isSpace(t)) { out += t; continue; }
    if (!isIdent(t)) { out += t; prev = t; continue; }
    if (prev === '.') {                                       // swizzle or member; arr.length() → arr.size()
      out += t === 'length' && tk[nextSig(tk, i)] === '(' ? 'size' : t; prev = t; continue;
    }
    const nj = nextSig(tk, i), nx = tk[nj];
    // array constructor:  float[3](a, b)  →  array<float,3>{a, b}      float[](a, b)  →  array<float,2>{a, b}
    if (isTypeTok(t) && nx === '[') {
      const cb = matchClose(tk, nj), after = nextSig(tk, cb);
      if (tk[after] === '(') {
        const cp = matchClose(tk, after);
        const args = splitArgs(tk.slice(after + 1, cp)).map(a => xl(a, warn));
        const sz = tk.slice(nj + 1, cb);
        const n = sz.some(x => !isSpace(x)) ? xl(sz, warn).trim() : String(args.length);
        out += `array<${xl([t], warn)},${n}>{${args.join(',')}}`;
        i = cp; prev = '}'; continue;
      }
    }
    // array declaration:  float a[3]  →  array<float,3> a   (metal::array copies and assigns by value, like GLSL)
    if (isTypeTok(t) && nx && isIdent(nx) && !QUAL.has(nx) && nx !== 'in' && nx !== 'out') {
      const nk = nextSig(tk, nj);
      if (tk[nk] === '[') {
        const cb = matchClose(tk, nk);
        if (tk.slice(nk + 1, cb).some(x => !isSpace(x))) {
          out += `array<${xl([t], warn)},${xl(tk.slice(nk + 1, cb), warn).trim()}> ${RESERVED.has(nx) ? RESERVED_OUT(nx) : nx}`;
          i = cb; prev = ']'; continue;
        }
        warn(`unsized array "${t} ${nx}[]": give it an explicit size.`);
      }
    }
    // out / inout parameters outside function heads (inside macro bodies) become thread references
    if ((t === 'out' || t === 'inout') && nx && isTypeTok(nx)) {
      const nm = nextSig(tk, nj);
      out += `thread ${xl([nx], warn)} &${tk[nm]}`; i = nm; prev = tk[nm]; continue;
    }
    if (t === 'in' && nx && (isTypeTok(nx) || nx === 'const')) continue;
    if (nx === '(') {
      const cp = matchClose(tk, nj);
      const argTk = tk.slice(nj + 1, cp);
      if (t === 'atan') {
        const args = splitArgs(argTk).map(a => xl(a, warn));
        out += (args.length === 2 ? 'atan2' : 'atan') + '(' + args.join(',') + ')';
        i = cp; prev = ')'; continue;
      }
      if (MAT_DIM[t]) {
        const [c, r] = MAT_DIM[t], args = splitArgs(argTk).map(a => xl(a, warn));
        if (args.length === c * r && c * r > 1) { // scalar form: group into column vectors
          const cols = []; for (let k = 0; k < c; k++) cols.push(`float${r}(${args.slice(k * r, k * r + r).join(',')})`);
          out += `${TYPE_MAP[t]}(${cols.join(',')})`;
        } else out += `${TYPE_MAP[t]}(${args.join(',')})`;
        i = cp; prev = ')'; continue;
      }
      if (FN_MAP[t]) { out += FN_MAP[t]; prev = t; continue; }
    }
    if (t === 'not' && nx === '(') { out += '!'; prev = '!'; continue; }       // GLSL not(bvec)
    if (t === 'discard') { out += 'discard_fragment()'; prev = t; continue; }
    if (TYPE_MAP[t]) { out += TYPE_MAP[t]; prev = t; continue; }
    if (RESERVED.has(t)) { out += RESERVED_OUT(t); prev = t; continue; }
    out += t; prev = t;
  }
  return out;
}

const QUAL = new Set(['highp', 'mediump', 'lowp', 'flat', 'smooth', 'invariant', 'precise']);
function stripQual(tk) { return tk.filter((t, i) => !(isIdent(t) && QUAL.has(t))); }

// "float f(in float a, out vec2 b) { … }" head → MSL head. `out`/`inout` become thread references.
function translateFuncHead(headTk, warn) {
  const op = headTk.indexOf('(');
  const cp = matchClose(headTk, op);
  const pre = xl(stripQual(headTk.slice(0, op)), warn).trim();
  const params = splitArgs(headTk.slice(op + 1, cp)).map(a => {
    const sig = stripQual(a).filter(t => !isSpace(t));
    if (sig.length === 1 && sig[0] === 'void') return null;
    let q = '', isConst = false, k = 0;
    for (; k < sig.length; k++) {
      if (sig[k] === 'in') continue;
      if (sig[k] === 'out' || sig[k] === 'inout') { q = 'ref'; continue; }
      if (sig[k] === 'const') { isConst = true; continue; }
      break;
    }
    const rest = sig.slice(k);          // type … name [N]
    const br = rest.indexOf('[');
    const nameAt = br < 0 ? rest.length - 1 : br - 1;
    const rawName = rest[nameAt], name = RESERVED.has(rawName) ? RESERVED_OUT(rawName) : rawName;
    if (br >= 0) {   // array parameter: metal::array is passed by value, like GLSL
      const cb = rest.lastIndexOf(']');
      return `${isConst ? 'const ' : ''}array<${xl(rest.slice(0, nameAt), warn)},${xl(rest.slice(br + 1, cb), warn).trim()}> ${name}`;
    }
    const type = xl(rest.slice(0, nameAt), warn);
    return q === 'ref' ? `thread ${isConst ? 'const ' : ''}${type} &${name}` : `${isConst ? 'const ' : ''}${type} ${name}`;
  }).filter(x => x != null);
  return `${pre}(${params.join(', ')})`;
}

// Split a GLSL translation unit into ordered top-level chunks.
function chunk(src) {
  const s = stripComments(src), n = s.length, out = [];
  let i = 0;
  while (i < n) {
    while (i < n && /\s/.test(s[i])) i++;
    if (i >= n) break;
    if (s[i] === '#') {
      let j = i;
      while (j < n && (s[j] !== '\n' || s[j - 1] === '\\')) j++;
      out.push({ kind: 'pp', text: s.slice(i, j) }); i = j; continue;
    }
    let j = i, d = 0, isStruct = /^struct\b/.test(s.slice(i, i + 7)), sawBrace = false;
    for (; j < n; j++) {
      const c = s[j];
      if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--;
      else if (c === '{') { d++; sawBrace = true; }
      else if (c === '}') { d--; if (d === 0 && !isStruct) { j++; break; } }
      else if (c === ';' && d === 0) { j++; break; }
    }
    const text = s.slice(i, j).trim();
    out.push({ kind: isStruct ? 'struct' : sawBrace && !/^[^{=]*=/.test(text) ? 'func' : 'decl', text });
    i = j;
  }
  return out;
}

export function translate(glsl, { warn = () => {} } = {}) {
  const hoisted = [], members = [];
  const chunks = chunk(glsl);
  CTX = { types: new Set([...stripComments(glsl).matchAll(/\bstruct\s+(\w+)/g)].map(m => m[1])), vecNames: new Set() };
  for (const c of chunks) { // names declared with a vector type, for == / != rewriting
    const tk = tokenize(c.text);
    for (let i = 0; i < tk.length; i++) {
      if (!VEC_TYPES.has(tk[i])) continue;
      let j = nextSig(tk, i), d = 0;
      while (j < tk.length) {
        if (isIdent(tk[j]) && d === 0) CTX.vecNames.add(tk[j]);
        // skip to the next top-level comma of this declaration
        let depth = 0, k = j + 1;
        for (; k < tk.length; k++) { const q = tk[k]; if (q === '(' || q === '[' || q === '{') depth++; else if (q === ')' || q === ']' || q === '}') { if (depth === 0) break; depth--; } else if (depth === 0 && (q === ',' || q === ';')) break; }
        if (tk[k] === ',') { j = nextSig(tk, k); continue; }
        break;
      }
    }
  }
  const both = t => { hoisted.push(t); members.push(t); };
  for (const c of chunks) {
    if (c.kind === 'pp') {
      const m = /^#\s*(\w+)/.exec(c.text), dir = m ? m[1] : '';
      if (/^(if|ifdef|ifndef|elif|else|endif)$/.test(dir)) both(c.text);
      else if (/^(define|undef|error)$/.test(dir)) hoisted.push(dir === 'define' ? '#define ' + xl(tokenize(c.text.replace(/^#\s*define\s*/, '')), warn).replace(/\\\n/g, ' \\\n') : c.text);
      continue; // #version, #extension, #line, #pragma are web-only
    }
    const tk = stripQual(tokenize(c.text));
    if (c.kind === 'struct') { hoisted.push(xl(tk, warn)); continue; }
    if (c.kind === 'func') {
      const bo = tk.indexOf('{');
      const head = translateFuncHead(tk.slice(0, bo), warn);
      members.push(head + ' ' + xl(tk.slice(bo), warn));
      continue;
    }
    // declaration
    const sig = tk.filter(t => !isSpace(t));
    if (sig[0] === 'precision') continue;
    if (sig[0] === 'uniform') {
      const body = tk.slice(tk.findIndex(t => t === 'uniform') + 1);
      if (body.includes('[')) warn(`uniform array "${body.join('').trim()}" is not settable from the Metal runtime.`);
      members.push(xl(body, warn).trim()); continue;
    }
    if (sig[0] === 'in' || sig[0] === 'out') { warn(`global "${sig.join(' ')}" dropped (stage I/O is supplied by the Metal entry point).`); continue; }
    if (sig.includes('(') && !sig.includes('=') && /\)\s*;$/.test(c.text)) continue; // forward declaration: members need none
    if (sig[0] === 'const') {
      const body = tk.slice(tk.findIndex(t => t === 'const') + 1);
      hoisted.push('constant ' + xl(body, warn).trim()); continue;
    }
    members.push(zeroInit(xl(tk, warn).trim()));
  }
  return { hoisted: hoisted.join('\n'), members: members.join('\n') };
}

// GLSL globals that have no initialiser: web drivers hand them zeros, and a Metal struct member would start as garbage.
function zeroInit(decl) {
  const m = /^(array<[^>]*>|\w+)\s+([^;=]+);$/.exec(decl);          // "TYPE a, b;" (no '=' anywhere)
  if (!m) return decl;
  const ty = m[1];
  const zero = /^(float|half)$/.test(ty) ? '0.0' : /^uint$/.test(ty) ? '0u' : /^int$/.test(ty) ? '0' : ty === 'bool' ? 'false'
    : /^(float|int|uint|bool)\d(x\d)?$/.test(ty) ? `${ty}(0)` : '{}';
  const names = m[2].split(',').map(x => x.trim()).filter(Boolean);
  return `${ty} ${names.map(n => `${n} = ${zero}`).join(', ')};`;
}

// Fast structural lint of generated MSL: GLSL leftovers and unbalanced delimiters.
export function lintMsl(msl) {
  const problems = [];
  const body = stripComments(msl).replace(/"(?:[^"\\]|\\.)*"/g, '""');
  const leftovers = [/\bvec[234]\b/, /\bmat[234]\b/, /\bivec[234]\b/, /\buvec[234]\b/, /\bbvec[234]\b/, /\bsampler2D\b/, /(?<!\[\[)\btexture\s*\(/, /\bgl_FragColor\b/, /\buniform\b/, /\bhighp\b|\bmediump\b|\blowp\b/, /\binout\b/, /\blayout\s*\(/, /\bfloatBitsTo(Int|Uint)\s*\(\s*\)/];
  for (const re of leftovers) { const m = re.exec(body); if (m) problems.push(`GLSL leftover "${m[0]}"`); }
  for (const [o, c] of ['()', '[]', '{}']) { const a = body.split(o).length - 1, b = body.split(c).length - 1; if (a !== b) problems.push(`unbalanced ${o}${c} (${a} vs ${b})`); }
  return problems;
}
