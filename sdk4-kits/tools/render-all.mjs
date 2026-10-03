#!/usr/bin/env node
// Final-asset renderer. usage: node tools/render-all.mjs stills|films|qa <kit-id ...>
//   stills: every style at 1440x2560 (JPEG, hero also at p=0.35 and 0.65 as PNG)    -> deliverables/stills/<kit>/
//   films : hero loop, two repeats, 360x640 @ 24 fps, 6 s loop (h264)               -> deliverables/films/<kit>-hero.mp4
//   qa    : tools/qa.mjs qa at 180x320 for every style                              -> qa/<kit>/qa.json
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
import { openHarness } from './harness.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const [task, ...kits] = process.argv.slice(2);
if (task === 'qa') { for (const k of kits) spawnSync('node', [path.join(root, 'tools/qa.mjs'), 'qa', k, 'all', '--w', '180', '--h', '320'], { stdio: 'inherit' }); process.exit(0); }
const h = await openHarness();
for (const id of kits) {
  const { kit } = await h.register(path.join(root, 'kits', id));
  if (task === 'stills') {
    const dir = path.join(root, 'deliverables/stills', id); fs.mkdirSync(dir, { recursive: true });
    for (const [i, st] of kit.styles.entries()) {
      const t0 = Date.now();
      fs.writeFileSync(path.join(dir, `${st.localId}.jpg`), await h.png(id, st.localId, { p: 0.1, set: { quality: 'export' } }, 1440, 2560, 'image/jpeg'));
      if (i === 0) for (const p of [0.35, 0.65]) fs.writeFileSync(path.join(dir, `${st.localId}-p${Math.round(p * 100)}.png`), await h.png(id, st.localId, { p, set: { quality: 'export' } }, 1440, 2560));
      console.log(id, st.localId, ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
  } else if (task === 'films') {
    const fps = 24, secs = 6, n = fps * secs, loops = 2; const tmp = fs.mkdtempSync('/tmp/film-' + id + '-');
    for (let i = 0; i < n * loops; i++) fs.writeFileSync(path.join(tmp, String(i).padStart(5, '0') + '.png'), await h.png(id, kit.styles[0].localId, { p: (i % n) / n, L: secs }, 360, 640));
    fs.mkdirSync(path.join(root, 'deliverables/films'), { recursive: true });
    const f = path.join(root, 'deliverables/films', `${id}-hero.mp4`);
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(tmp, '%05d.png'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', f], { stdio: 'inherit' });
    fs.rmSync(tmp, { recursive: true, force: true }); console.log('film', f);
  }
}
await h.close();
