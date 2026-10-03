#!/usr/bin/env node
// Builds agent-motif/showcase/index.html: a self-contained live viewer that runs a kit through Motif's own
// kit-gl runtime (WebGL2), with the style's inspector, palettes, tempo, resolution and media drop.
//   node agent-motif/tools/build-showcase.mjs [kitDir] [--out file]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(here, '..');
const kitDir = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(ROOT, 'kits/agent-motif'));
const oi = process.argv.indexOf('--out'); const out = oi > 0 ? process.argv[oi + 1] : path.join(ROOT, 'showcase/index.html');
const SDK = path.resolve(process.env.AM_SDK || path.join(ROOT, '../Motif3/sdk/motif-kit-sdk-4.0.0'));
const KG_SRC = fs.readFileSync(path.join(SDK, 'lib/kit-gl.js'), 'utf8');
const APP = fs.readFileSync(path.join(here, 'showcase.app.js'), 'utf8');
const files = {}; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(glsl|svg)$/.test(f) || (/\.json$/.test(f) && f !== 'manifest.json')) files[path.relative(kitDir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
walk(kitDir);
const manifest = JSON.parse(fs.readFileSync(path.join(kitDir, 'manifest.json'), 'utf8'));
const tpl = fs.readFileSync(path.join(here, 'showcase.template.html'), 'utf8');
const html = tpl.replace('/*KIT_GL*/', () => `window.KG = (function(){ ${KG_SRC} })();`).replace('/*APP*/', () => APP).replace('/*KIT_DATA*/', () => `window.KIT = ${JSON.stringify({ manifest, files }).replace(/<\/script/gi, '<\\/script')};`);
fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html);
console.log(`  wrote ${out} (${(html.length / 1024).toFixed(0)} KB, ${manifest.styles.length} styles)`);
