#!/usr/bin/env node
// motif-kit — validate, pack, migrate, bench and preview Motif kits (motif-kit@4; reads motif-kit@1, @2 and @3 unchanged).
//   motif-kit validate <kit-folder | file.motifkit> [--json]   schema, static GLSL analysis, capability checks
//   motif-kit pack <kit-folder> [--out dir]                     validate, then write <id>-<version>.motifkit
//   motif-kit migrate <kit-folder>                              rewrite a motif-kit@1 manifest as motif-kit@2
//   motif-kit bench <kit-folder | file.motifkit> [--app Motif.html] [--size 1280x720] [--frames 60]
//                                                               headless benchmark (tools/bench.mjs) vs. declared cost
//   motif-kit new <folder> [--id my-kit]                        copy the starter template
//        [--example stack|vector|sequence]                      start from a motif-kit@4 reference kit instead
//   motif-kit seq <kit-folder | file.motifkit | seq.json> [--at 0.25 | --steps 16]
//                                                               validate sequences and print which cues play when
//   motif-kit preview <kit-folder> [entry ...] [--media a.jpg] [--text "A|B|C"]  contact sheet + compile/loop/timing (playwright)
//   motif-kit prelude [--v4]                                    print the GLSL prelude and runtime declarations (--v4: with the motif-kit@4 additions)
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module'; import { spawnSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const KG = new Function(fs.readFileSync(path.join(here, '../lib/kit-gl.js'), 'utf8'))();
const require = createRequire(import.meta.url);
const [cmd, ...rest] = process.argv.slice(2);
const flags = {}, args = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith('--')) { args.push(a); continue; }
  const [k, v] = a.slice(2).split('=');
  if (v !== undefined) flags[k] = v; else if (rest[i + 1] && !rest[i + 1].startsWith('--') && ['out', 'id', 'name', 'w', 'h', 'chromium', 'media', 'app', 'size', 'frames', 'harness', 'text', 'example', 'at', 'steps', 'sequence'].includes(k)) flags[k] = rest[++i]; else flags[k] = true;
}
const die = m => { console.error(m); process.exit(1); };
function fflate() { try { return require('fflate'); } catch (e) { die('This command needs fflate: npm i fflate'); } }
function readDir(dir) {
  const files = {};
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (!f.startsWith('.') && /\.(glsl|json|md|txt|svg)$/i.test(f)) files[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
  walk(dir);
  if (!files['manifest.json']) die(`No manifest.json in ${dir}`);
  let manifest; try { manifest = JSON.parse(files['manifest.json']); } catch (e) { die(`manifest.json is not valid JSON: ${e.message}`); }
  delete files['manifest.json'];
  return { manifest, files };
}
function readKit(p) {
  if (!fs.existsSync(p)) die(`${p} does not exist`);
  if (fs.statSync(p).isDirectory()) return readDir(p);
  const buf = new Uint8Array(fs.readFileSync(p));
  if (buf[0] !== 0x50 || buf[1] !== 0x4B) { const j = JSON.parse(Buffer.from(buf).toString('utf8')); if (j && j.manifest && j.files) return { manifest: j.manifest, files: j.files }; die(`${p} is not a .motifkit package or kit bundle`); }
  const { unzipSync, strFromU8 } = fflate(); const un = unzipSync(buf);
  const files = {}; let manifest = null;
  for (const [n, b] of Object.entries(un)) { if (n.endsWith('/')) continue; if (n === 'manifest.json') manifest = JSON.parse(strFromU8(b)); else if (/\.(glsl|json|md|txt|svg)$/i.test(n)) files[n] = strFromU8(b); }
  return { manifest, files };
}
const loc = d => `${d.file || 'manifest.json'}${d.line ? `:${d.line}` : ''}`;
function report(v) {
  const diags = v.diagnostics || [];
  for (const d of diags) console.log(`  ${d.severity === 'error' ? 'error' : 'warn '} ${loc(d)}  ${d.message}${d.entry ? `  (${d.entry})` : ''}`);
  // Messages without a structured diagnostic (older shapes) still print.
  for (const e of v.errors) if (!diags.some(d => e.endsWith(d.message))) console.log(`  error ${e}`);
  if (v.ok) {
    const k = v.kit, r = v.report;
    const kinds = [['styles', k.styles.length], ['effects', k.effects.length], ['transitions', k.transitions.length], ['exporters', k.exporters.length]].filter(x => x[1]).map(([n, c]) => `${c} ${n}`).join(', ');
    console.log(`  ok    ${k.name} ${k.version} (${k.sourceFormat}${k.migration ? ` → ${k.format}` : ''}): ${kinds}, ${k.palettes.length} palettes`);
    if (k.migration) console.log(`  migr  ${k.migration.steps.join(' · ')}`);
    const st4 = k.styles.filter(x => x.stack).length, vc = k.styles.filter(x => (x.inputs || []).some(q => q.type === 'svg' || q.type === 'sdf')).length;
    if (st4 || vc || (k.sequences && k.sequences.length)) console.log(`  v4    ${[st4 ? `${st4} with layer stack` : '', vc ? `${vc} with vector input` : '', k.sequences && k.sequences.length ? `${k.sequences.length} sequence${k.sequences.length > 1 ? 's' : ''}` : '', k.requires && k.requires.length ? `needs kits: ${k.requires.join(', ')}` : ''].filter(Boolean).join(', ')}`);
    console.log(`  caps  ${k.capabilities.length ? k.capabilities.map(c => `${c} (${KG.CAPABILITIES[c]})`).join('; ') : 'none: pixels from its own params only'}`);
    for (const e of r.entries) console.log(`        ${(e.kind + ' ' + e.localId).padEnd(32)} passes run ${String(e.executions).padStart(2)} · ≤ ${Math.round(e.iterations)} loop iterations/px · ≤ ${Math.round(e.fetches)} fetches/px · declared cost ${e.cost}`);
  }
  return v.ok;
}
if (cmd === 'validate') {
  if (!args[0]) die('usage: motif-kit validate <kit-folder | file.motifkit> [--json]');
  const raw = readKit(args[0]); const v = KG.validateKit(raw.manifest, raw.files);
  if (flags.json) { console.log(JSON.stringify({ ok: v.ok, errors: v.errors, warnings: v.warnings, diagnostics: v.diagnostics, report: v.report }, null, 2)); process.exit(v.ok ? 0 : 1); }
  process.exit(report(v) ? 0 : 1);
} else if (cmd === 'pack') {
  if (!args[0]) die('usage: motif-kit pack <kit-folder> [--out dir]');
  const raw = readDir(args[0]); const v = KG.validateKit(raw.manifest, raw.files); if (!report(v)) process.exit(1);
  const { zipSync, strToU8 } = fflate();
  const zin = { 'manifest.json': strToU8(JSON.stringify(raw.manifest, null, 2)) }; for (const [k, t] of Object.entries(raw.files)) zin[k] = strToU8(t);
  const out = path.join(flags.out || '.', `${raw.manifest.id}-${raw.manifest.version}.motifkit`);
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, zipSync(zin, { level: 9 })); console.log(`  wrote ${out}`);
} else if (cmd === 'migrate') {
  if (!args[0]) die('usage: motif-kit migrate <kit-folder>');
  const raw = readDir(args[0]);
  if (raw.manifest.format === KG.KIT_FORMAT_2 || raw.manifest.format === KG.KIT_FORMAT_3 || raw.manifest.format === KG.KIT_FORMAT_4) { console.log(`  ${raw.manifest.id} is already ${raw.manifest.format} (no migration needed; @3 added text inputs, @4 adds layer stacks, svg inputs and sequences)`); process.exit(0); }
  const v = KG.validateKit(raw.manifest, raw.files); if (!report(v)) process.exit(1);
  // Same result the app records on load: format bump + capabilities inferred; styles, params and shaders unchanged.
  const m = { ...raw.manifest, format: KG.KIT_FORMAT_2 };
  if (v.kit.capabilities.length) m.capabilities = v.kit.capabilities.slice();
  const keys = Object.keys(m), at = keys.indexOf('format');
  const ordered = Object.fromEntries([...keys.slice(0, at + 1).map(k => [k, m[k]]), ...(m.capabilities ? [['capabilities', m.capabilities]] : []), ...keys.slice(at + 1).filter(k => k !== 'capabilities').map(k => [k, m[k]])]);
  const v2 = KG.validateKit(ordered, raw.files); if (!v2.ok) { report(v2); die('  migrated manifest does not validate; nothing written'); }
  fs.writeFileSync(path.join(args[0], 'manifest.json'), JSON.stringify(ordered, null, 2) + '\n');
  console.log(`  wrote ${path.join(args[0], 'manifest.json')} as ${KG.KIT_FORMAT_2}\n  ${v.kit.migration.steps.join('\n  ')}`);
} else if (cmd === 'bench') {
  if (!args[0]) die('usage: motif-kit bench <kit-folder | file.motifkit> [--app Motif.html] [--size 1280x720] [--frames 60]');
  const raw = readKit(args[0]); const v = KG.validateKit(raw.manifest, raw.files); if (!report(v)) process.exit(1);
  // The headless harness lives with the app (tools/bench.mjs); the SDK ships inside sdk/motif-kit-sdk.
  const harness = path.resolve(flags.harness || path.join(here, '../../../tools/bench.mjs'));
  if (!fs.existsSync(harness)) die(`bench needs the app's benchmark harness: pass --harness <tools/bench.mjs> (looked at ${harness})`);
  const app = flags.app ? path.resolve(flags.app) : path.join(path.dirname(harness), '..', 'Motif.html');
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'motif-kit-')), `${raw.manifest.id}.json`);
  fs.writeFileSync(tmp, JSON.stringify(raw));
  const a = ['--kit', tmp, '--file', app, '--size', String(flags.size || '1280x720'), '--frames', String(flags.frames || 60)];
  const r = spawnSync(process.execPath, [harness, ...a], { stdio: 'inherit', env: process.env });
  process.exit(r.status == null ? 1 : r.status);
} else if (cmd === 'new') {
  const dest = args[0] || 'my-kit'; if (fs.existsSync(dest)) die(`${dest} already exists`);
  const ex = flags.example, map = { stack: 'stack-lab', vector: 'vector-type', sequence: 'sequence-demo' };
  if (ex && !map[ex]) die('--example takes stack, vector or sequence');
  fs.cpSync(path.join(here, ex ? `../examples/${map[ex]}` : '../template'), dest, { recursive: true });
  if (flags.id) { const mp = path.join(dest, 'manifest.json'); const m = JSON.parse(fs.readFileSync(mp, 'utf8')); m.id = String(flags.id); m.name = String(flags.name || flags.id); fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n'); }
  console.log(`  created ${dest}. Edit manifest.json and styles/*.glsl, then: motif-kit preview ${dest}`);
} else if (cmd === 'seq') {
  if (!args[0]) die('usage: motif-kit seq <kit-folder | file.motifkit | seq.json> [--at 0.25 | --steps 16]');
  const list = [];
  if (/\.json$/i.test(args[0]) && !fs.statSync(args[0]).isDirectory()) { const r = KG.v4.validateSequence(JSON.parse(fs.readFileSync(args[0], 'utf8')), {}); r.warnings.forEach(w => console.log(`  warn  ${w}`)); r.errors.forEach(e => console.log(`  error ${e}`)); if (!r.ok) process.exit(1); list.push(r.seq); }
  else { const raw = readKit(args[0]), v = KG.validateKit(raw.manifest, raw.files); if (!report(v)) process.exit(1); list.push(...(v.kit.sequences || [])); if (!list.length) console.log('  this kit has no sequences'); }
  for (const seq of list) {
    const an = KG.v4.analyzeSequence(seq);
    console.log(`\n  ${seq.id}: ${seq.cues.length} cues, ${an.styles.length} styles, peak ${an.peak} at once (max ${seq.maxActive}), ${(an.coverage * 100).toFixed(0)}% of the loop covered${seq.loop ? `, loop ${seq.loop}s` : ''}`);
    const at = flags.at != null && flags.at !== true ? [+flags.at] : Array.from({ length: +(flags.steps || 16) }, (_, i) => i / +(flags.steps || 16));
    for (const p of at) { const { active, dropped } = KG.v4.planSequence(seq, p, { L: seq.loop || 6 }); console.log(`  ${p.toFixed(3)}  ${active.length ? active.map(a => `${a.cue.id}:${a.cue.style.split('/').pop()}@${a.innerP.toFixed(2)}x${a.alpha.toFixed(2)}`).join('  ') : '.'}${dropped ? `  (${dropped} dropped)` : ''}`); }
  }
} else if (cmd === 'prelude') {
  process.stdout.write(KG.PRELUDE + (flags.v4 ? '\n// ---- motif-kit@4 additions (added to every pass of a motif-kit@4 style):\n' + KG.v4.PRELUDE_V4 : '') + '\n// ---- your params become: uniform <float|int|bool> p_<key>; select options also #define KEY_OPTION <index>\n'
    + '// ---- motif-kit@3 text input "type" with 3 lines (strings never reach GLSL; see docs/text-inputs.md):\n' + KG.textSource({ id: 'type', lines: [{}, {}, {}], aspect: 8 }).replace(/^/gm, '//   ') + '\n'
    + '// ---- motif-kit@2 runtime declarations (added per pass when they apply):\n' + KG.runtimeDecls('transition', ['audio'], ['input']).replace(/^/gm, '//   ') + '\n' + KG.MAIN_FINAL);
} else if (cmd === 'preview') {
  const { runPreview } = await import('../lib/preview.mjs'); await runPreview(KG, readDir(args[0]), args.slice(1), flags);
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
}
