// Builds motifKits/posterflow-viewer.html: one self-contained page (SDK runtime + the kit) that renders the shaders live.
// Run: node build-viewer.mjs [path/to/motif-kit-sdk/lib/kit-gl.js]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(HERE, '../../src/posterflow');
const KG = path.resolve(process.argv[2] || path.join(HERE, '../../../Motif3/sdk/motif-kit-sdk-4.0.0/lib/kit-gl.js'));
const files = {};
const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'previews') walk(p); } else if (/\.(glsl|json|md|txt|svg)$/i.test(f)) files[path.relative(KIT, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
walk(KIT);
const esc = s => s.replace(/<\//g, '<\\/');
const html = fs.readFileSync(path.join(HERE, 'viewer.template.html'), 'utf8')
  .replace('__KIT__', () => esc(JSON.stringify({ manifest: JSON.parse(files['manifest.json']), files })))
  .replace('__KG__', () => esc(JSON.stringify(fs.readFileSync(KG, 'utf8'))));
const out = path.resolve(HERE, '../../posterflow-viewer.html');
fs.writeFileSync(out, html); console.log('wrote', out, (html.length / 1024).toFixed(0) + ' KB');
