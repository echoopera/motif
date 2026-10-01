// Minimal JSON Schema (draft 2020-12 subset) validator for the published schemas, so tests need no packages.
// Supports: type, enum, const, properties, required, additionalProperties, propertyNames, maxProperties, items,
// prefixItems, contains, minItems, maxItems, uniqueItems, minLength, maxLength, pattern, minimum, maximum, exclusiveMinimum,
// exclusiveMaximum, $ref (local #/...), allOf, anyOf, oneOf, not, if/then/else. Unknown keywords are ignored.
export function validator(root) {
  const resolve = ref => { if (!ref.startsWith('#/')) throw new Error('only local $ref: ' + ref); return ref.slice(2).split('/').reduce((o, k) => o[decodeURIComponent(k)], root); };
  const typeOf = v => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
  const isType = (v, t) => (t === 'number' ? typeof v === 'number' : t === 'integer' ? Number.isInteger(v) : typeOf(v) === t || (t === 'number' && typeOf(v) === 'integer'));
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function check(s, v, path, errs) {
    if (s === true || s == null) return; if (s === false) { errs.push(`${path}: not allowed`); return; }
    if (s.$ref) check(resolve(s.$ref), v, path, errs);
    if (s.type) { const ts = [].concat(s.type); if (!ts.some(t => isType(v, t))) { errs.push(`${path}: expected ${ts.join('|')}, got ${typeOf(v)}`); return; } }
    if (s.enum && !s.enum.some(x => eq(x, v))) errs.push(`${path}: ${JSON.stringify(v)} not in enum`);
    if ('const' in s && !eq(s.const, v)) errs.push(`${path}: expected const ${JSON.stringify(s.const)}`);
    if (typeof v === 'string') {
      if (s.minLength != null && v.length < s.minLength) errs.push(`${path}: shorter than ${s.minLength}`);
      if (s.maxLength != null && v.length > s.maxLength) errs.push(`${path}: longer than ${s.maxLength}`);
      if (s.pattern && !new RegExp(s.pattern, 'u').test(v)) errs.push(`${path}: does not match ${s.pattern}`);
    }
    if (typeof v === 'number') {
      if (s.minimum != null && v < s.minimum) errs.push(`${path}: < ${s.minimum}`);
      if (s.maximum != null && v > s.maximum) errs.push(`${path}: > ${s.maximum}`);
      if (s.exclusiveMinimum != null && v <= s.exclusiveMinimum) errs.push(`${path}: <= ${s.exclusiveMinimum}`);
      if (s.exclusiveMaximum != null && v >= s.exclusiveMaximum) errs.push(`${path}: >= ${s.exclusiveMaximum}`);
    }
    if (Array.isArray(v)) {
      if (s.minItems != null && v.length < s.minItems) errs.push(`${path}: fewer than ${s.minItems} items`);
      if (s.maxItems != null && v.length > s.maxItems) errs.push(`${path}: more than ${s.maxItems} items`);
      if (s.uniqueItems && new Set(v.map(x => JSON.stringify(x))).size !== v.length) errs.push(`${path}: items not unique`);
      const pre = s.prefixItems || [];
      if (s.contains !== undefined && !v.some(x => { const e = []; check(s.contains, x, path, e); return !e.length; })) errs.push(`${path}: no item matches "contains"`);
      v.forEach((x, i) => { if (i < pre.length) check(pre[i], x, `${path}[${i}]`, errs); else if (s.items !== undefined) check(s.items, x, `${path}[${i}]`, errs); });
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const keys = Object.keys(v);
      if (s.maxProperties != null && keys.length > s.maxProperties) errs.push(`${path}: more than ${s.maxProperties} properties`);
      for (const r of s.required || []) if (!Object.prototype.hasOwnProperty.call(v, r)) errs.push(`${path}: missing ${r}`);
      for (const k of keys) {
        if (s.propertyNames) check(s.propertyNames, k, `${path}{${k}}`, errs);
        if (s.properties && Object.prototype.hasOwnProperty.call(s.properties, k)) check(s.properties[k], v[k], `${path}.${k}`, errs);
        else if (s.additionalProperties !== undefined) check(s.additionalProperties, v[k], `${path}.${k}`, errs);
      }
    }
    const sub = x => { const e = []; check(x, v, path, e); return e; };
    for (const x of s.allOf || []) check(x, v, path, errs);
    if (s.anyOf && !s.anyOf.some(x => !sub(x).length)) errs.push(`${path}: matches none of anyOf (${sub(s.anyOf[0]).slice(0, 2).join('; ')})`);
    if (s.oneOf) { const n = s.oneOf.filter(x => !sub(x).length).length; if (n !== 1) errs.push(`${path}: matches ${n} of oneOf`); }
    if (s.not && !sub(s.not).length) errs.push(`${path}: matches a forbidden schema`);
    if (s.if) { const ok = !sub(s.if).length; if (ok && s.then) check(s.then, v, path, errs); if (!ok && s.else) check(s.else, v, path, errs); }
  }
  return v => { const errs = []; check(root, v, '$', errs); return errs; };
}
