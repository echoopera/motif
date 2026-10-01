#!/usr/bin/env node
'use strict';
// Enforces module isolation.
//  1. every modules/<x>/ has module.json + README.md + CONTRACT.md + its entry file
//  2. module.json validates
//  3. dependency graph is acyclic and every dependsOn exists
//  4. no source file imports another module except through its public entry ("@modules/<name>" or "import <Name>Module")
//  5. no source file reaches outside its module except via @modules/*
//  6. fan-out ≤ 4 dependencies per module (configurable)
const L = require('./lib');
const MAX_DEPS = 4;
let okAll = true; const bad = m => { okAll = false; L.fail(m); };
const dirs = L.exists(L.P.modules) ? L.fs.readdirSync(L.P.modules, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name) : [];
if (!dirs.length) { L.warn('no modules yet'); process.exit(0); }
const mods = {};
for (const d of dirs) {
  const base = L.path.join(L.P.modules, d);
  for (const f of ['module.json', 'README.md', 'CONTRACT.md']) if (!L.exists(L.path.join(base, f))) bad(`modules/${d}: missing ${f}`);
  if (!L.exists(L.path.join(base, 'module.json'))) continue;
  const m = L.readJson(L.path.join(base, 'module.json'));
  const e = L.validateAgainst('module', m); if (e.length) bad(`modules/${d}/module.json: ${e.join('; ')}`);
  if (m.name !== d) bad(`modules/${d}: module.json name "${m.name}" ≠ directory`);
  if (!L.exists(L.path.join(base, m.entry))) bad(`modules/${d}: entry ${m.entry} missing`);
  if ((m.dependsOn || []).length > MAX_DEPS) bad(`modules/${d}: ${m.dependsOn.length} dependencies (max ${MAX_DEPS}) — split it`);
  mods[d] = m;
}
// graph
const state = {}; const visit = (n, stack = []) => { if (state[n] === 2) return; if (state[n] === 1) return bad(`dependency cycle: ${[...stack, n].join(' → ')}`); state[n] = 1; for (const d of mods[n].dependsOn || []) { if (!mods[d]) bad(`modules/${n} depends on unknown module "${d}"`); else visit(d, [...stack, n]); } state[n] = 2; };
for (const n of Object.keys(mods)) visit(n);
// imports
const IMPORT_RE = /(?:import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+([A-Za-z_][A-Za-z0-9_]*)\s*$)/gm;
for (const [n, m] of Object.entries(mods)) {
  for (const f of L.walk(L.path.join(L.P.modules, n, 'src'))) {
    if (!/\.(ts|tsx|js|jsx|mjs|swift)$/.test(f)) continue;
    const src = L.fs.readFileSync(f, 'utf8'); let hit;
    while ((hit = IMPORT_RE.exec(src))) {
      const spec = hit[1] || hit[2] || hit[3]; const rel = L.path.relative(L.P.root, f);
      if (spec.startsWith('@modules/')) {
        const parts = spec.slice(9).split('/'); const target = parts[0];
        if (parts.length > 1) bad(`${rel}: deep import "${spec}" — import "@modules/${target}" only`);
        else if (target !== n && !(m.dependsOn || []).includes(target)) bad(`${rel}: imports "${target}" but module.json does not declare it in dependsOn`);
      } else if (spec.startsWith('.')) {
        const abs = L.path.resolve(L.path.dirname(f), spec); if (!abs.startsWith(L.path.join(L.P.modules, n))) bad(`${rel}: relative import escapes module: "${spec}"`);
      } else if (/^[A-Z][A-Za-z0-9]*Module$/.test(spec)) {
        const target = spec.replace(/Module$/, '').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
        if (mods[target] && target !== n && !(m.dependsOn || []).includes(target)) bad(`${rel}: imports ${spec} but module.json does not declare "${target}" in dependsOn`);
      }
    }
  }
}
if (okAll) L.ok(`${Object.keys(mods).length} modules isolated: manifests valid, graph acyclic, no deep or undeclared imports`);
process.exit(okAll ? 0 : 1);
