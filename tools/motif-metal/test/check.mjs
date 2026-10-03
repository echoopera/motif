// Compile-check generated MSL with clang against the CPU shim (type-checks every pass), and with the real Metal
// compiler (xcrun metal) when it exists.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readKit } from '../lib/kitio.mjs';
import { convertKit } from '../lib/convert.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SHIM = path.join(here, 'shim');

// MSL → C++ for the shim: vector/matrix constructors become mk_*, float literals become float32.
export function toCxx(msl) {
  // Clang's vector comparisons yield -1 for true; Metal's bool vectors convert to 1.0. Normalise at the source.
  msl = msl.replace(/return (a (?:<|<=|>|>=|==|!=) b); \}/g, 'return metal::bool_norm($1); }');
  return msl
    .replace(/\b(float|int|uint|bool)([234])(x[234])?\s*\(/g, (m, t, n, x) => `mk_${t}${n}${x || ''}(`)
    .replace(/(?<![\w.])((?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+)(?![\w.])/g, '$1f');
}
export function cxxCompile(src, outFile, extra = []) {
  const f = outFile.replace(/\.[^.]*$/, '') + '.cpp';
  fs.writeFileSync(f, src);
  return spawnSync('clang++', ['-std=c++17', '-fsyntax-only', '-Wno-unknown-attributes', '-Wno-c++20-extensions', '-Wno-unused-value', '-Wno-vla-extension', '-I', SHIM, ...extra, f], { encoding: 'utf8' });
}

export async function checkKit(KG, kits, flags = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motif-metal-'));
  let bad = 0, total = 0;
  const hasMetal = !flags['no-metal'] && spawnSync('xcrun', ['-f', 'metal']).status === 0;
  for (const k of kits) {
    let kitBad = 0;
    const r = convertKit(KG, readKit(k));
    r.warnings.forEach(w => console.log(`  warn  ${w}`));
    const passes = Object.entries(r.files).filter(([n]) => n.endsWith('.metal'));
    for (const [name, msl] of passes) {
      total++;
      const out = path.join(tmp, path.basename(name));
      const c = cxxCompile(toCxx(msl), out);
      let ok = c.status === 0, log = c.stderr;
      if (hasMetal) { fs.writeFileSync(out, msl); const m = spawnSync('xcrun', ['metal', '-std=metal3.0', '-fno-fast-math', '-c', out, '-o', out + '.air'], { encoding: 'utf8' }); ok = ok && m.status === 0; log += m.stderr; }
      if (!ok) { bad++; kitBad++; console.log(`  ✖ ${name}\n${log.split('\n').slice(0, 14).map(l => '      ' + l).join('\n')}`); }
      else if (flags.verbose) console.log(`  ✓ ${name}`);
    }
    console.log(`  ${kitBad ? '✖' : '✓'} ${r.kit.id}: ${passes.length} passes type-checked${hasMetal ? ' (clang shim + Metal)' : ' (clang shim; no Metal compiler on this machine)'}`);
  }
  return bad ? 1 : 0;
}
