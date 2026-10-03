#!/usr/bin/env node
// motif-kit — validate, pack, inspect and preview Motif kits (motif-kit@1, SDK 1.2.5: vector + type, layer stacks, playhead, sequencer).
//   motif-kit validate <kit-folder | file.motifkit>   schema + static checks (+ sequences)
//   motif-kit pack <kit-folder> [--out dir]            validate, then write <id>-<version>.motifkit
//   motif-kit new <folder> [--id my-kit]               copy the starter template
//        [--example stack|vector|sequence]             start from a 1.2.5 reference kit instead
//   motif-kit preview <kit-folder> [style ...]         contact sheet PNG + compile/loop/timing report (needs playwright)
//        [--media photo.jpg]                           image fed to media inputs and stack layers (default: test cards)
//        [--sequence id]                               also render a sequence (default: every sequence in the kit)
//   motif-kit seq <seq.json | kit-folder> [--at 0.25 | --steps 16]
//                                                      validate a sequence and print which cues play when
//   motif-kit prelude [--125]                          print the GLSL prelude every pass is compiled with (--125: with the 1.2.5 additions)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
const KG = new Function(fs.readFileSync(path.join(here, '../lib/kit-gl.js'), 'utf8'))();
const require = createRequire(import.meta.url);
const [cmd, ...rest] = process.argv.slice(2);
const flags = {}, args = [];
const VALUE_FLAGS = ['out', 'id', 'name', 'w', 'h', 'chromium', 'media', 'example', 'at', 'steps', 'sequence'];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith('--')) { args.push(a); continue; }
  const [k, v] = a.slice(2).split('=');
  if (v !== undefined) flags[k] = v; else if (rest[i + 1] && !rest[i + 1].startsWith('--') && VALUE_FLAGS.includes(k)) flags[k] = rest[++i]; else flags[k] = true;
}
const die = m => { console.error(m); process.exit(1); };
function fflate() { try { return require('fflate'); } catch (e) { die('This command needs fflate: npm i fflate'); } }
const TEXT_EXT = /\.(glsl|json|md|txt|svg)$/i, BIN_EXT = /\.(woff2|woff|ttf|otf)$/i;
function readDir(dir) {
  const files = {};
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'node_modules') walk(p); } else if (!f.startsWith('.')) { const k = path.relative(dir, p).split(path.sep).join('/'); if (TEXT_EXT.test(f)) files[k] = fs.readFileSync(p, 'utf8'); else if (BIN_EXT.test(f)) files[k] = new Uint8Array(fs.readFileSync(p)); } } };
  walk(dir);
  if (!files['manifest.json']) die(`No manifest.json in ${dir}`);
  const manifest = JSON.parse(files['manifest.json']); delete files['manifest.json'];
  return { manifest, files };
}
function readKit(p) {
  if (fs.statSync(p).isDirectory()) return readDir(p);
  const { unzipSync, strFromU8 } = fflate(); const un = unzipSync(new Uint8Array(fs.readFileSync(p)));
  const files = {}; let manifest = null;
  for (const [n, b] of Object.entries(un)) { if (n.endsWith('/')) continue; if (n === 'manifest.json') manifest = JSON.parse(strFromU8(b)); else files[n] = BIN_EXT.test(n) ? b : strFromU8(b); }
  return { manifest, files };
}
function report(v) {
  v.warnings.forEach(w => console.log(`  warn  ${w}`));
  v.errors.forEach(e => console.log(`  error ${e}`));
  if (v.ok) {
    const k = v.kit, mi = k.styles.filter(x => x.inputs && x.inputs.length).length, st = k.styles.filter(x => x.stack).length, vt = k.styles.filter(x => (x.inputs || []).some(q => q.type === 'svg' || q.type === 'text')).length;
    const extra = [mi ? `${mi} with media input` : '', st ? `${st} with layer stack` : '', vt ? `${vt} with vector/type input` : '', k.sequences.length ? `${k.sequences.length} sequence${k.sequences.length > 1 ? 's' : ''}` : '', k.fonts.length ? `${k.fonts.length} font${k.fonts.length > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ');
    console.log(`  ok    ${k.name} ${k.version}${k.sdk ? ` (sdk ${k.sdk})` : ''}: ${k.styles.length} styles, ${k.palettes.length} palettes, ${k.styles.reduce((s, x) => s + Object.keys(x.params).length, 0)} params${extra ? ', ' + extra : ''}`);
  }
  return v.ok;
}
if (cmd === 'validate') {
  if (!args[0]) die('usage: motif-kit validate <kit-folder | file.motifkit>');
  const raw = readKit(args[0]); const ok = report(KG.validateKit(raw.manifest, raw.files)); process.exit(ok ? 0 : 1);
} else if (cmd === 'pack') {
  if (!args[0]) die('usage: motif-kit pack <kit-folder> [--out dir]');
  const raw = readDir(args[0]); const v = KG.validateKit(raw.manifest, raw.files); if (!report(v)) process.exit(1);
  const { zipSync, strToU8 } = fflate();
  const zin = { 'manifest.json': strToU8(JSON.stringify(raw.manifest, null, 2)) }; for (const [k, t] of Object.entries(raw.files)) zin[k] = typeof t === 'string' ? strToU8(t) : t;
  const out = path.join(flags.out || '.', `${raw.manifest.id}-${raw.manifest.version}.motifkit`);
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, zipSync(zin, { level: 9 })); console.log(`  wrote ${out}`);
} else if (cmd === 'new') {
  const dest = args[0] || 'my-kit'; if (fs.existsSync(dest)) die(`${dest} already exists`);
  const ex = flags.example, map = { stack: 'stack-lab', vector: 'vector-type', sequence: 'sequence-demo' };
  if (ex && !map[ex]) die('--example takes stack, vector or sequence');
  fs.cpSync(path.join(here, ex ? `../examples/${map[ex]}` : '../template'), dest, { recursive: true });
  if (flags.id) { const mp = path.join(dest, 'manifest.json'); const m = JSON.parse(fs.readFileSync(mp, 'utf8')); m.id = String(flags.id); m.name = String(flags.name || flags.id); fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n'); }
  console.log(`  created ${dest}. Edit manifest.json and styles/*.glsl, then: motif-kit preview ${dest}`);
} else if (cmd === 'prelude') {
  process.stdout.write(KG.PRELUDE + (flags['125'] ? KG.PRELUDE_125 : '') + '\n// ---- your params become: uniform <float|int|bool> p_<key>; select options also #define KEY_OPTION <index>\n' + KG.MAIN_FINAL);
} else if (cmd === 'seq') {
  if (!args[0]) die('usage: motif-kit seq <seq.json | kit-folder> [--at 0.25 | --steps 16]');
  const target = args[0], list = [];
  if (fs.statSync(target).isDirectory() || /\.motifkit$/.test(target)) { const raw = readKit(target), v = KG.validateKit(raw.manifest, raw.files); if (!report(v)) process.exit(1); list.push(...v.kit.sequences.map(seq => ({ seq, warn: [] }))); }
  else { const r = KG.validateSequence(JSON.parse(fs.readFileSync(target, 'utf8')), {}); r.warnings.forEach(w => console.log(`  warn  ${w}`)); r.errors.forEach(e => console.log(`  error ${e}`)); if (!r.ok) process.exit(1); list.push({ seq: r.seq }); }
  for (const { seq } of list) {
    const an = KG.analyzeSequence(seq);
    console.log(`\n  ${seq.id}: ${seq.cues.length} cues, ${an.styles.length} styles, peak ${an.peak} at once (max ${seq.maxActive}), ${(an.coverage * 100).toFixed(0)}% of the loop covered${seq.loop ? `, loop ${seq.loop}s` : ''}`);
    const at = flags.at != null && flags.at !== true ? [+flags.at] : Array.from({ length: +(flags.steps || 16) }, (_, i) => i / +(flags.steps || 16));
    for (const p of at) {
      const { active, dropped } = KG.planSequence(seq, p, { L: seq.loop || 6 });
      console.log(`  ${p.toFixed(3)}  ${active.length ? active.map(a => `${a.cue.id}:${a.cue.style.split('/').pop()}@${a.innerP.toFixed(2)}×${a.alpha.toFixed(2)}`).join('  ') : '·'}${dropped ? `  (${dropped} dropped)` : ''}`);
    }
  }
} else if (cmd === 'preview') {
  if (!args[0]) die('usage: motif-kit preview <kit-folder> [style ...]');
  const { runPreview } = await import('../lib/preview.mjs'); await runPreview(KG, readDir(args[0]), args.slice(1), flags);
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 15).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
}
