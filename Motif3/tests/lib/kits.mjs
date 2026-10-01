// Bundled-kit fixtures for tests: every kit shipped under Motif3/kits/** (zipped .motifkit, .motifkit.json bundles,
// source folders), the SDK template/examples, and the catalog compiled into src-v5/modules/05-kits.js.
// Package readers (minimal ZIP on node:zlib, so tests need no packages) live in tools/lib/kit-files.mjs.
import fs from 'node:fs'; import path from 'node:path';
import { unzip, rawFromZip, rawFromDir } from '../../tools/lib/kit-files.mjs';
export { unzip, rawFromZip, rawFromDir };
export const root = path.resolve(import.meta.dirname, '../..');

export function catalogFromModule() {
  const src = fs.readFileSync(path.join(root, 'src-v5/modules/05-kits.js'), 'utf8');
  const line = src.split('\n').find(l => l.startsWith('const KIT_CATALOG = '));
  return JSON.parse(line.slice('const KIT_CATALOG = '.length, line.lastIndexOf('];') + 1));
}
// [{ label, raw: { manifest, files } }]
export function bundledKits() {
  const out = [];
  const kitsDir = path.join(root, 'kits');
  const walk = d => {
    for (const f of fs.readdirSync(d).sort()) {
      const p = path.join(d, f), rel = path.relative(root, p);
      if (fs.statSync(p).isDirectory()) { if (fs.existsSync(path.join(p, 'manifest.json'))) out.push({ label: rel, raw: rawFromDir(p) }); else walk(p); continue; }
      if (f.endsWith('.motifkit')) out.push({ label: rel, raw: rawFromZip(fs.readFileSync(p)) });
      else if (f.endsWith('.motifkit.json')) { const j = JSON.parse(fs.readFileSync(p, 'utf8')); out.push({ label: rel, raw: { manifest: j.manifest, files: j.files } }); }
      else if (f.endsWith('.zip')) { for (const [n, b] of Object.entries(unzip(fs.readFileSync(p)))) if (n.endsWith('.motifkit')) out.push({ label: `${rel}!${n}`, raw: rawFromZip(b) }); }
    }
  };
  walk(kitsDir);
  const sdk = path.join(root, 'sdk/motif-kit-sdk');
  out.push({ label: 'sdk/motif-kit-sdk/template', raw: rawFromDir(path.join(sdk, 'template')) });
  for (const e of fs.readdirSync(path.join(sdk, 'examples')).sort()) out.push({ label: `sdk/motif-kit-sdk/examples/${e}`, raw: rawFromDir(path.join(sdk, 'examples', e)) });
  for (const raw of catalogFromModule()) out.push({ label: `catalog:${raw.manifest.id}`, raw });
  return out;
}
