#!/usr/bin/env node
// Builds the standalone one-page showcase: showcase/index.html (SDK runtime + all nine kits + thumbnails + QA results inline).
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { loadKit, readKitDir } from './harness.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const order = fs.readdirSync(path.join(root, 'src')).filter(d => /^\d\d-/.test(d)).map(d => d.replace(/^\d\d-/, ''));
const data = { order, kits: {}, thumbs: {}, fingerprints: {}, qa: {}, budgets: {} };
for (const id of order) {
  const raw = readKitDir(path.join(root, 'kits', id)); data.kits[id] = { manifest: raw.manifest, files: Object.fromEntries(Object.entries(raw.files).filter(([k]) => /\.(glsl|json)$/.test(k))) };
  const src = (await import(path.join(root, 'src', String(order.indexOf(id) + 1).padStart(2, '0') + '-' + id, 'kit.mjs') + '?t=' + Date.now())).default;
  for (const s of src.styles) data.fingerprints[id + '/' + s.id] = s.fingerprint;
  const { report } = loadKit(path.join(root, 'kits', id)); data.budgets[id] = Object.fromEntries(report.entries.map(e => [e.localId, { iterations: e.iterations, fetches: e.fetches }]));
  const qf = path.join(root, 'qa', id, 'qa.json'); if (fs.existsSync(qf)) data.qa[id] = JSON.parse(fs.readFileSync(qf, 'utf8'));
  for (const s of raw.manifest.styles) {
    const still = path.join(root, 'deliverables/stills', id, s.id + '.jpg'); if (!fs.existsSync(still)) continue;
    const r = spawnSync('ffmpeg', ['-v', 'error', '-i', still, '-vf', 'scale=180:-2', '-q:v', '5', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-'], { maxBuffer: 1 << 24 });
    if (r.status === 0) data.thumbs[id + '/' + s.id] = 'data:image/jpeg;base64,' + r.stdout.toString('base64');
  }
}
const sdk = fs.readFileSync(path.join(root, 'sdk/lib/kit-gl.js'), 'utf8');
let html = fs.readFileSync(path.join(root, 'src/_showcase/template.html'), 'utf8');
html = html.replace('/*SDK*/', () => 'window.KG = (function(){ ' + sdk.replace(/<\/script/gi, '<\\/script') + ' })();').replace('/*DATA*/null', () => JSON.stringify(data).replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--'));
fs.mkdirSync(path.join(root, 'showcase'), { recursive: true }); fs.writeFileSync(path.join(root, 'showcase/index.html'), html);
console.log('wrote showcase/index.html', (html.length / 1024).toFixed(0) + ' KB', Object.keys(data.thumbs).length + ' thumbs');
