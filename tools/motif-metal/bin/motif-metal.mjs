#!/usr/bin/env node
// motif-metal — convert Motif web kits (motif-kit@1) into Metal Swift packages for macOS and iPadOS.
//   motif-metal convert <kit> [--out dir] [--runtime path|url] [--strict]   kit = folder, .motifkit or JSON bundle
//   motif-metal show <kit> <style> [--pass n]                                print the generated MSL for one pass
//   motif-metal check <kit…>                                                 convert, lint, type-check every pass (clang shim; + Metal if installed)
//   motif-metal parity <kit…> [--styles a,b] [--w 192 --h 108 --phase 0.37] [--sheet out.png]
//                                                                          render with WebGL and with the generated Metal source on the CPU, compare (sheet: web | metal)
import fs from 'node:fs';
import path from 'node:path';
import { readKit } from '../lib/kitio.mjs';
import { loadKitGl, convertKit, writeFiles } from '../lib/convert.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = {}, args = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith('--')) { args.push(a); continue; }
  const [k, v] = a.slice(2).split('=');
  if (v !== undefined) flags[k] = v; else if (['out', 'runtime', 'pass', 'kit-gl', 'sheet'].includes(k)) flags[k] = rest[++i]; else flags[k] = true;
}
const die = m => { console.error(m); process.exit(1); };
const KG = loadKitGl(flags['kit-gl']);

function load(kitPath) { try { return readKit(kitPath); } catch (e) { die(`${kitPath}: ${e.message}`); } }
function convert(raw, opts = {}) { try { return convertKit(KG, raw, opts); } catch (e) { die(e.message); } }

if (cmd === 'convert') {
  if (!args.length) die('usage: motif-metal convert <kit…> [--out dir] [--runtime path|url] [--strict]');
  let bad = 0;
  const root = path.resolve(flags.out || 'metal-out');
  for (const k of args) {
    const raw = load(k);
    const out = path.join(root, `${raw.manifest.id}-metal`);
    // The runtime package is a path dependency, relative to the generated package, unless the caller gave one.
    const runtime = flags.runtime || path.relative(out, path.resolve(path.dirname(new URL(import.meta.url).pathname), '../swift/MotifMetal')).split(path.sep).join('/');
    const r = convert(raw, { runtime });
    fs.rmSync(path.join(out, 'Metal'), { recursive: true, force: true });
    writeFiles(out, r.files);
    r.warnings.forEach(w => console.log(`  warn  ${w}`));
    console.log(`  ok    ${r.kit.id} ${r.kit.version}: ${r.kit.styles.length} styles, ${Object.keys(r.files).filter(f => f.endsWith('.metal')).length} passes → ${out}`);
    if (r.failed) bad++;
  }
  process.exit(bad && flags.strict ? 1 : 0);
} else if (cmd === 'show') {
  const r = convert(load(args[0])); const st = r.kit.styles.find(s => s.localId === args[1]); if (!st) die(`no style "${args[1]}"`);
  const key = Object.keys(r.files).filter(f => f.endsWith('.metal'))[0] && `Metal/${r.kit.id.replace(/[^A-Za-z0-9]+/g, '_')}_${st.localId.replace(/[^A-Za-z0-9]+/g, '_')}_p${flags.pass || 0}.metal`;
  process.stdout.write(r.files[key] || die(`no such pass: ${key}`));
} else if (cmd === 'parity') {
  const { parityKit, report, sheet } = await import('../test/parity.mjs');
  let bad = 0;
  for (const k of args) { const r = await parityKit(KG, k, flags); bad += report(r); if (flags.sheet) sheet(r, flags.sheet); }
  process.exit(bad ? 1 : 0);
} else if (cmd === 'check') {
  const { checkKit } = await import('../test/check.mjs');
  process.exit(await checkKit(KG, args, flags));
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 6).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
}
