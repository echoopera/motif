#!/usr/bin/env node
// motif-kit — validate, pack, inspect and preview Motif kits (motif-kit@1, SDK 1.2: media inputs, custom params).
//   motif-kit validate <kit-folder | file.motifkit>   schema + static checks (+ shader compile with --gl)
//   motif-kit pack <kit-folder> [--out dir]            validate, then write <id>-<version>.motifkit
//   motif-kit new <folder> [--id my-kit]               copy the starter template
//   motif-kit preview <kit-folder> [style ...]         contact sheet PNG + compile/loop/timing report (needs playwright)
//        [--media photo.jpg]                           image fed to styles with media inputs (default: a test card)
//   motif-kit prelude                                  print the GLSL prelude every pass is compiled with
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const KG = new Function(fs.readFileSync(path.join(here, '../lib/kit-gl.js'), 'utf8'))();
const require = createRequire(import.meta.url);
const [cmd, ...rest] = process.argv.slice(2);
const flags = {}, args = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith('--')) { args.push(a); continue; }
  const [k, v] = a.slice(2).split('=');
  if (v !== undefined) flags[k] = v; else if (rest[i + 1] && !rest[i + 1].startsWith('--') && ['out', 'id', 'name', 'w', 'h', 'chromium', 'media'].includes(k)) flags[k] = rest[++i]; else flags[k] = true;
}
const die = m => { console.error(m); process.exit(1); };
function fflate() { try { return require('fflate'); } catch (e) { die('This command needs fflate: npm i fflate'); } }
function readDir(dir) {
  const files = {};
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (!f.startsWith('.') && /\.(glsl|json|md|txt)$/i.test(f)) files[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
  walk(dir);
  if (!files['manifest.json']) die(`No manifest.json in ${dir}`);
  const manifest = JSON.parse(files['manifest.json']); delete files['manifest.json'];
  return { manifest, files };
}
function readKit(p) {
  if (fs.statSync(p).isDirectory()) return readDir(p);
  const { unzipSync, strFromU8 } = fflate(); const un = unzipSync(new Uint8Array(fs.readFileSync(p)));
  const files = {}; let manifest = null;
  for (const [n, b] of Object.entries(un)) { if (n.endsWith('/')) continue; if (n === 'manifest.json') manifest = JSON.parse(strFromU8(b)); else files[n] = strFromU8(b); }
  return { manifest, files };
}
function report(v) {
  v.warnings.forEach(w => console.log(`  warn  ${w}`));
  v.errors.forEach(e => console.log(`  error ${e}`));
  if (v.ok) { const mi = v.kit.styles.filter(x => x.inputs && x.inputs.length).length; console.log(`  ok    ${v.kit.name} ${v.kit.version}: ${v.kit.styles.length} styles, ${v.kit.palettes.length} palettes, ${v.kit.styles.reduce((s, x) => s + Object.keys(x.params).length, 0)} params${mi ? `, ${mi} with media input` : ''}`); }
  return v.ok;
}
if (cmd === 'validate') {
  if (!args[0]) die('usage: motif-kit validate <kit-folder | file.motifkit>');
  const raw = readKit(args[0]); const ok = report(KG.validateKit(raw.manifest, raw.files)); process.exit(ok ? 0 : 1);
} else if (cmd === 'pack') {
  if (!args[0]) die('usage: motif-kit pack <kit-folder> [--out dir]');
  const raw = readDir(args[0]); const v = KG.validateKit(raw.manifest, raw.files); if (!report(v)) process.exit(1);
  const { zipSync, strToU8 } = fflate();
  const zin = { 'manifest.json': strToU8(JSON.stringify(raw.manifest, null, 2)) }; for (const [k, t] of Object.entries(raw.files)) zin[k] = strToU8(t);
  const out = path.join(flags.out || '.', `${raw.manifest.id}-${raw.manifest.version}.motifkit`);
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, zipSync(zin, { level: 9 })); console.log(`  wrote ${out}`);
} else if (cmd === 'new') {
  const dest = args[0] || 'my-kit'; if (fs.existsSync(dest)) die(`${dest} already exists`);
  fs.cpSync(path.join(here, '../template'), dest, { recursive: true });
  if (flags.id) { const mp = path.join(dest, 'manifest.json'); const m = JSON.parse(fs.readFileSync(mp, 'utf8')); m.id = String(flags.id); m.name = String(flags.name || flags.id); fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n'); }
  console.log(`  created ${dest}. Edit manifest.json and styles/*.glsl, then: motif-kit preview ${dest}`);
} else if (cmd === 'prelude') {
  process.stdout.write(KG.PRELUDE + '\n// ---- your params become: uniform <float|int|bool> p_<key>; select options also #define KEY_OPTION <index>\n' + KG.MAIN_FINAL);
} else if (cmd === 'preview') {
  const { runPreview } = await import('../lib/preview.mjs'); await runPreview(KG, readDir(args[0]), args.slice(1), flags);
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 8).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
}
