// Loads Motif modules into a Node vm context so pure logic can be unit-tested without a browser.
// DOM-free modules only (tokens, engine-core, timeline, colour, audio analysis helpers); GL/Canvas modules need tests/browser/*.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
const dir = path.resolve(import.meta.dirname, '../src-v5/modules');
export function load(...names) {
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, performance, structuredClone, TextEncoder, TextDecoder, localStorage: { getItem: () => null, setItem() {} }, document: undefined, OffscreenCanvas: undefined });
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  const want = new Set(names);
  const code = files.filter(f => want.has(f.replace(/^\d+-|\.js$/g, ''))).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const exportsList = names.map(n => `__m_${n.replace(/-/g, '_')}`);
  return vm.runInContext(`"use strict";\n${code}\n({ ${exportsList.join(', ')} })`, ctx, { filename: 'motif-modules.js' });
}
