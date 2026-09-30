# Custom parameters for motif-kit@1 (SDK 1.2 / Motif 3.2). Runs inside build.py after kitgl_media.py; `src` and `rep` in scope.
# Adds: up to 32 params, `group`, `hint`, `show`, `log`, `randMax`, and the compound types `color` and `point`,
# which expand into ordinary scalar params so keyframes, Mutate, locks, audio mapping and presets work unchanged.

src = rep(src, "styles: 40, params: 16, passes: 4,", "styles: 40, params: 32, passes: 4,")
src = rep(src, "palettes: 8, inputs: 2 };", "palettes: 8, inputs: 2, expanded: 48 };")

# ---------- validation ----------
a = src.index("      const label = String(p.label || k).slice(0, 24), o = { label };")
b = src.index("      params[k] = o;\n    }", a) + len("      params[k] = o;\n    }")
new_block = r"""      const label = String(p.label || k).slice(0, 24), o = { label };
      if (p.unit) o.unit = String(p.unit).slice(0, 4);
      if (p.mutate != null) o.mutate = Math.max(0, Math.min(1, Number(p.mutate) || 0));
      if (p.group != null && String(p.group).trim()) o.group = String(p.group).trim().slice(0, 20);
      if (p.hint != null && String(p.hint).trim()) o.hint = String(p.hint).trim().slice(0, 90);
      if (p.show != null) { const sh = normShow(p.show, raw, k); if (typeof sh === 'string') { err(`${pw}.show: ${sh}`); } else o.show = sh; }
      if (p.type === 'color') {
        if (!/^#[0-9a-fA-F]{6}$/.test(p.def || '')) { err(`${pw}: color needs def like "#FF8800".`); continue; }
        const rgb = [1, 3, 5].map(i => parseInt(p.def.slice(i, i + 1 + 1), 16) / 255);
        if (['R', 'G', 'B'].some(c => k.length + 1 > 24 || raw[k + c])) { err(`${pw}: "${k}R/G/B" would clash with another param or exceed 24 characters.`); continue; }
        ['R', 'G', 'B'].forEach((c, i) => { params[k + c] = { ...o, label: `${label} ${c}`.slice(0, 24), type: 'range', min: 0, max: 1, def: +rgb[i].toFixed(4), step: 0.001, mutate: o.mutate == null ? 0.5 : o.mutate, part: { of: k, kind: 'color', i, label } }; });
        continue;
      }
      if (p.type === 'point') {
        const lo = p.min == null ? -1 : Number(p.min), hi = p.max == null ? 1 : Number(p.max), d = p.def == null ? [0, 0] : p.def;
        if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(lo < hi)) { err(`${pw}: point needs numeric min < max.`); continue; }
        if (!Array.isArray(d) || d.length !== 2 || !d.every(x => Number.isFinite(Number(x)) && Number(x) >= lo && Number(x) <= hi)) { err(`${pw}: point def must be [x, y] within ${lo}–${hi}.`); continue; }
        if (['X', 'Y'].some(c => k.length + 1 > 24 || raw[k + c])) { err(`${pw}: "${k}X/Y" would clash with another param or exceed 24 characters.`); continue; }
        ['X', 'Y'].forEach((c, i) => { params[k + c] = { ...o, label: `${label} ${c}`.slice(0, 24), type: 'range', min: lo, max: hi, def: Number(d[i]), step: +((hi - lo) / 400).toPrecision(2), part: { of: k, kind: 'point', i, label } }; });
        continue;
      }
      if (p.type === 'range' || p.type === 'int') {
        const min = Number(p.min), max = Number(p.max), def = Number(p.def);
        if (![min, max, def].every(Number.isFinite) || !(min < max)) { err(`${pw}: needs numeric min < max and def.`); continue; }
        if (def < min || def > max) { err(`${pw}: def ${def} is outside ${min}–${max}.`); continue; }
        if (p.type === 'int' && ![min, max, def].every(Number.isInteger)) { err(`${pw}: int min, max and def must be integers.`); continue; }
        Object.assign(o, { type: p.type, min, max, def, step: p.type === 'int' ? 1 : Number(p.step) > 0 ? Number(p.step) : 0.01 });
        if (p.log) { if (min > 0) o.log = true; else warn(`${pw}: "log" needs min > 0; ignored.`); }
        if (p.randMax != null) { if (Number(p.randMax) > min && Number(p.randMax) <= max) o.randMax = Number(p.randMax); else warn(`${pw}: randMax must be within min–max; ignored.`); }
      } else if (p.type === 'toggle') Object.assign(o, { type: 'toggle', def: !!p.def });
      else if (p.type === 'select') {
        const opts = (Array.isArray(p.options) ? p.options : []).map(x => (typeof x === 'string' ? { v: x, l: x[0].toUpperCase() + x.slice(1) } : x && typeof x.v === 'string' ? { v: x.v, l: String(x.l || x.v) } : null)).filter(Boolean);
        if (opts.length < 2 || opts.length > 12) { err(`${pw}: select needs 2–12 options.`); continue; }
        if (!opts.every(x => /^[a-z][a-z0-9-]{0,23}$/.test(x.v))) { err(`${pw}: option values must be lowercase ids.`); continue; }
        Object.assign(o, { type: 'select', options: opts, def: opts.some(x => x.v === p.def) ? p.def : opts[0].v });
      } else { err(`${pw}: type must be range, int, toggle, select, color or point.`); continue; }
      params[k] = o;
    }
    if (Object.keys(params).length > KIT_LIMITS.expanded) err(`${where}: colour and point params count as 3 and 2 uniforms; at most ${KIT_LIMITS.expanded} in total.`);"""
src = src[:a] + new_block + src[b:]
src = rep(src, "if (keys.length > KIT_LIMITS.params) err(`${where}: at most ${KIT_LIMITS.params} params.`);",
               "if (keys.length > KIT_LIMITS.params) err(`${where}: at most ${KIT_LIMITS.params} params (a colour counts as one, a point as one).`);")

# show-condition normaliser (defined next to normInputs)
src = rep(src, "function normInputs(list, where, err) {", r"""// A `show` condition hides a control unless another control has a given value.
//   { "param": "mode", "is": "ripple" }   { "param": "mode", "is": ["a","b"] }   { "param": "mode", "not": "off" }
//   { "param": "count", "gt": 3 }   { "param": "glow", "lt": 0.5 }   toggles use true / false.
function normShow(sh, raw, self) {
  if (!sh || typeof sh !== 'object' || Array.isArray(sh)) return 'must be an object like { "param": "mode", "is": "ripple" }.';
  const t = raw[sh.param];
  if (!t || sh.param === self) return `"${sh.param}" is not another param of this style.`;
  if (!['range', 'int', 'toggle', 'select'].includes(t.type)) return `"${sh.param}" is a ${t.type}; a condition can only read a range, int, toggle or select.`;
  const out = { param: sh.param };
  if ('is' in sh) out.is = Array.isArray(sh.is) ? sh.is.slice(0, 12) : sh.is;
  else if ('not' in sh) out.not = Array.isArray(sh.not) ? sh.not.slice(0, 12) : sh.not;
  else if (Number.isFinite(Number(sh.gt))) out.gt = Number(sh.gt);
  else if (Number.isFinite(Number(sh.lt))) out.lt = Number(sh.lt);
  else return 'needs one of is, not, gt or lt.';
  if (t.type === 'select' && ('is' in out || 'not' in out)) { const vals = [].concat(out.is !== undefined ? out.is : out.not); const known = (t.options || []).map(x => (typeof x === 'string' ? x : x && x.v)); if (vals.some(v => !known.includes(v))) return `value not among ${sh.param}'s options.`; }
  return out;
}
function normInputs(list, where, err) {""")

# ---------- GLSL helpers for colour and point ----------
src = rep(src, "    if (p.type === 'text') continue;\n    const t = p.type === 'range'",
"""    if (p.type === 'text') continue;
    if (p.part && p.part.i === 0) helpers += p.part.kind === 'color'
      ? `vec3 s_${p.part.of}() { return vec3(p_${p.part.of}R, p_${p.part.of}G, p_${p.part.of}B); }\\nvec3 c_${p.part.of}() { vec3 c = s_${p.part.of}(); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }\\n`
      : `vec2 v_${p.part.of}() { return vec2(p_${p.part.of}X, p_${p.part.of}Y); }\\n`;
    const t = p.type === 'range'""")
src = rep(src, "function paramUniforms(params) {\n  let s = '';", "function paramUniforms(params) {\n  let s = '', helpers = '';")
src = rep(src, "    if (p.type === 'select') p.options.forEach((o, i) => { s += `#define ${k.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}_${String(o.v).toUpperCase().replace(/[^A-Z0-9]/g, '_')} ${i}\\n`; });\n  }\n  return s;",
               "    if (p.type === 'select') p.options.forEach((o, i) => { s += `#define ${k.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()}_${String(o.v).toUpperCase().replace(/[^A-Z0-9]/g, '_')} ${i}\\n`; });\n  }\n  return s + helpers;")

# ---------- app: carry the new fields into the style's schema ----------
src = rep(src, "    const o = { mutate: p.mutate, unit: p.unit };\n    if (p.type === 'range') params[k] = P.range(p.label, p.min, p.max, p.def, p.step, o);",
               "    const o = { mutate: p.mutate, unit: p.unit, group: p.group, hint: p.hint, show: p.show, part: p.part, log: p.log, randMax: p.randMax };\n    if (p.type === 'range') params[k] = P.range(p.label, p.min, p.max, p.def, p.step, o);")
src = rep(src, "    for (const x of ['mutate', 'unit']) if (params[k][x] === undefined) delete params[k][x];",
               "    for (const x of ['mutate', 'unit', 'group', 'hint', 'show', 'part', 'log', 'randMax']) if (params[k][x] === undefined) delete params[k][x];")
src = rep(src, "return { KIT_FORMAT, KIT_LIMITS, SDK_VERSION: '1.1.0',", "return { KIT_FORMAT, KIT_LIMITS, SDK_VERSION: '1.2.0',")
src = rep(src, "// ---- module: kit-gl v1.1.0 (media inputs)", "// ---- module: kit-gl v1.2.0 (media inputs, custom params)")
