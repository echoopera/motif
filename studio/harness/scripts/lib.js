'use strict';
// Design Harness 3.0 shared library. Node.js standard library only. No network.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const P = {
  root: ROOT,
  schemas: path.join(ROOT, 'harness', 'schemas'),
  workOrders: path.join(ROOT, 'harness', 'state', 'work-orders'),
  claims: path.join(ROOT, 'harness', 'state', 'claims'),
  ddm: path.join(ROOT, 'harness', 'state', 'ddm'),
  reviews: path.join(ROOT, 'harness', 'state', 'reviews'),
  corrections: path.join(ROOT, 'harness', 'state', 'corrections'),
  modules: path.join(ROOT, 'modules'),
  templates: path.join(ROOT, 'harness', 'templates'),
  handoff: path.join(ROOT, 'handoff'),
};

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n'); }
function exists(f) { return fs.existsSync(f); }
function listJson(dir) { if (!exists(dir)) return []; return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => ({ file: path.join(dir, f), data: readJson(path.join(dir, f)) })); }
function walk(dir, out = []) { if (!exists(dir)) return out; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.name === 'node_modules' || e.name.startsWith('.')) continue; if (e.isDirectory()) walk(p, out); else out.push(p); } return out; }

// ---------- glob ----------
// Supports **, *, ? — enough for path ownership.
function globToRegex(glob) {
  let re = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { i++; if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*'; }
      else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if ('.+^${}()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp(re + '$');
}
function globMatch(glob, file) { return globToRegex(glob).test(file.replace(/\\/g, '/')); }
// Do two ownership globs potentially match a common path? Segment-wise, with ** expansion.
function segOverlap(a, b) {
  if (a === '**' || b === '**') return true;
  if (!a.includes('*') && !b.includes('*')) return a === b;
  if (!a.includes('*')) return globToRegex(b).test(a);
  if (!b.includes('*')) return globToRegex(a).test(b);
  const pre = g => g.slice(0, g.indexOf('*')), suf = g => g.slice(g.lastIndexOf('*') + 1);
  const pa = pre(a), pb = pre(b), sa = suf(a), sb = suf(b);
  return (pa.startsWith(pb) || pb.startsWith(pa)) && (sa.endsWith(sb) || sb.endsWith(sa));
}
function globsOverlap(a, b) {
  const A = a.split('/').filter(Boolean), B = b.split('/').filter(Boolean);
  const memo = new Map();
  const rec = (i, j) => {
    const k = i + ':' + j; if (memo.has(k)) return memo.get(k);
    let r;
    if (i === A.length && j === B.length) r = true;
    else if (i === A.length) r = B.slice(j).every(s => s === '**');
    else if (j === B.length) r = A.slice(i).every(s => s === '**');
    else if (A[i] === '**') r = rec(i + 1, j) || rec(i, j + 1) || rec(i + 1, j + 1);
    else if (B[j] === '**') r = rec(i, j + 1) || rec(i + 1, j) || rec(i + 1, j + 1);
    else r = segOverlap(A[i], B[j]) && rec(i + 1, j + 1);
    memo.set(k, r); return r;
  };
  return rec(0, 0);
}

// ---------- validator (JSON Schema subset) ----------
function validate(schema, value, at = '$', errors = []) {
  const t = schema.type;
  const typeOk = (v, ty) => ty === 'array' ? Array.isArray(v) : ty === 'integer' ? Number.isInteger(v) : ty === 'object' ? (v !== null && typeof v === 'object' && !Array.isArray(v)) : typeof v === ty;
  if (t && !typeOk(value, t)) { errors.push(`${at}: expected ${t}`); return errors; }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${at}: must be one of ${schema.enum.join('|')}`);
  if (t === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${at}: shorter than ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: does not match ${schema.pattern}`);
  }
  if (t === 'integer' || t === 'number') {
    if (schema.minimum != null && value < schema.minimum) errors.push(`${at}: below ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) errors.push(`${at}: above ${schema.maximum}`);
  }
  if (t === 'array') {
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.items) value.forEach((v, i) => validate(schema.items, v, `${at}[${i}]`, errors));
  }
  if (t === 'object') {
    for (const r of schema.required || []) if (!(r in value)) errors.push(`${at}: missing required "${r}"`);
    for (const [k, sub] of Object.entries(schema.properties || {})) if (k in value) validate(sub, value[k], `${at}.${k}`, errors);
  }
  return errors;
}
function validateAgainst(schemaName, value) { return validate(readJson(path.join(P.schemas, schemaName + '.schema.json')), value); }

// ---------- output ----------
const c = { g: s => `\x1b[32m${s}\x1b[0m`, r: s => `\x1b[31m${s}\x1b[0m`, y: s => `\x1b[33m${s}\x1b[0m`, d: s => `\x1b[2m${s}\x1b[0m` };
function ok(msg) { console.log(c.g('PASS'), msg); }
function fail(msg) { console.log(c.r('FAIL'), msg); }
function warn(msg) { console.log(c.y('WARN'), msg); }
function info(msg) { console.log(c.d('  ' + msg)); }
function die(msg, code = 1) { fail(msg); process.exit(code); }
function nowIso() { return new Date().toISOString(); }

module.exports = { P, fs, path, readJson, writeJson, exists, listJson, walk, globMatch, globsOverlap, validate, validateAgainst, ok, fail, warn, info, die, nowIso };
