#!/usr/bin/env node
// Renders every kit's hero (or a named style) at one phase and tiles them into one board PNG: node tools/board.mjs [phase] [w h] [out]
import fs from 'node:fs'; import path from 'node:path';
import { openHarness } from './harness.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const phase = +(process.argv[2] ?? 0.1), W = +(process.argv[3] ?? 360), Hh = +(process.argv[4] ?? 640), out = process.argv[5] || path.join(root, 'qa/board.png');
const h = await openHarness(); const imgs = [];
for (const id of fs.readdirSync(path.join(root, 'kits'))) { const { kit } = await h.register(path.join(root, 'kits', id)); imgs.push(await h.png(kit.id, kit.styles[0].localId, { p: phase }, W, Hh)); }
const b64 = imgs.map(b => 'data:image/png;base64,' + b.toString('base64'));
const png = await h.page.evaluate(async ({ b64, W, Hh }) => { const c = document.createElement('canvas'); c.width = W * b64.length; c.height = Hh; const x = c.getContext('2d');
  for (let i = 0; i < b64.length; i++) { const im = new Image(); im.src = b64[i]; await im.decode(); x.drawImage(im, i * W, 0); } return c.toDataURL('image/png').split(',')[1]; }, { b64, W, Hh });
fs.writeFileSync(out, Buffer.from(png, 'base64')); console.log('wrote', out); await h.close();
