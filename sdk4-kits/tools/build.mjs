#!/usr/bin/env node
// Build kit sources: src/<id>/kit.mjs + core.glsl  ->  kits/<id>/ (manifest.json, common.glsl, styles/*.glsl, README.md)
// usage: node tools/build.mjs [kit-id ...]   (no ids = every kit in src/)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { kitHelpers } from './helpers.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2);
const ids = fs.readdirSync(path.join(root, 'src')).filter(d => !d.startsWith('_') && fs.existsSync(path.join(root, 'src', d, 'kit.mjs')) && (!only.length || only.includes(d)));
const shared = n => fs.readFileSync(path.join(root, 'src/_shared', n), 'utf8');
const { merge } = kitHelpers;
// Per-style specialisation: blocks between  //@if 1 2 3  and  //@endif  are kept only for those variants (so the SDK's static
// worst-case loop analysis sees just the code a style runs), and the token VARIANT becomes the variant number.
function specialise(src, v) {
  const out = [], stack = [];
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*\/\/@if\s+([\d\s]+)$/);
    if (m) { stack.push(m[1].trim().split(/\s+/).map(Number).includes(v)); continue; }
    if (/^\s*\/\/@endif/.test(line)) { stack.pop(); continue; }
    if (stack.every(Boolean)) out.push(line);
  }
  return out.join('\n').replace(/\bVARIANT\b/g, String(v));
}

for (const id of ids) {
  const dir = path.join(root, 'src', id);
  const kit = (await import(pathToFileURL(path.join(dir, 'kit.mjs')).href + '?t=' + Date.now())).default;
  const out = path.join(root, 'kits', kit.id); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'styles'), { recursive: true });
  const core = fs.readFileSync(path.join(dir, 'core.glsl'), 'utf8');
  const luminous = kit.post === 'luminous';
  const common = shared('lib.glsl');
  fs.writeFileSync(path.join(out, 'common.glsl'), common);
  if (luminous) for (const f of ['glowA', 'glowB', 'out']) fs.writeFileSync(path.join(out, `styles/_${f}.glsl`), shared(f + '.glsl'));
  const styles = kit.styles.map((s, i) => {
    const file = `styles/${s.id}.glsl`;
    const vn = s.variant ?? i;
    fs.writeFileSync(path.join(out, file), `// ${kit.name}: ${s.name}. ${s.fingerprint}\n` + specialise(core, vn) + `\nvec4 motif(vec2 uv, vec2 fc) {\n  return ${kit.entry || 'scene_main'}(uv, fc, ${vn});\n}\n`);
    const e = { id: s.id, name: s.name, group: kit.name, tags: s.tags, blurb: s.blurb, palette: s.palette, flash: !!s.flash, cost: s.cost ?? kit.cost ?? 1.5 };
    if (luminous) e.graph = { buffers: { scene: { scale: kit.sceneScale ?? 0.75 }, glowA: { scale: 0.25 }, glowB: { scale: 0.125 } }, passes: [
      { src: file, reads: [], writes: 'scene' }, { src: 'styles/_glowA.glsl', reads: ['scene'], writes: 'glowA' },
      { src: 'styles/_glowB.glsl', reads: ['glowA'], writes: 'glowB' }, { src: 'styles/_out.glsl', reads: ['scene', 'glowA', 'glowB'], writes: 'output' }] };
    else e.passes = [{ src: file }];
    e.params = merge(kit.params, s.over);
    return e;
  });
  const manifest = { format: 'motif-kit@4', id: kit.id, name: kit.name, version: kit.version || '1.0.0', author: 'Motif', description: kit.description, license: '', accent: kit.accent, common: 'common.glsl', palettes: kit.palettes, styles };
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const md = [`# ${kit.name} ${manifest.version}`, '', kit.description, '', '## Styles', '', ...kit.styles.map((s, i) => `${i + 1}. **${s.name}** (\`${s.id}\`): ${s.fingerprint}`), ''].join('\n');
  fs.writeFileSync(path.join(out, 'README.md'), md);
  console.log(`built ${kit.id}: ${styles.length} styles, ${Object.keys(styles[0].params).length} params each`);
}
