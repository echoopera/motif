// Relative cost of every style: median time of a 32x32 (canary-size) frame at default params, then at quality=live. SwiftShader (CPU) numbers: relative only.
import fs from 'node:fs'; import path from 'node:path';
import { openHarness } from './harness.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const only = process.argv.slice(2);
const h = await openHarness(); const out = [];
for (const id of fs.readdirSync(path.join(root, 'kits')).filter(k => !only.length || only.includes(k))) {
  const { kit } = await h.register(path.join(root, 'kits', id));
  for (const st of kit.styles) {
    const r = await h.page.evaluate(({ id, l }) => {
      const st = H.prep(id, l); const gl = H.rt.canvas.getContext('webgl2'); const t = set => { const xs = []; for (let i = 0; i < 7; i++) { const a = performance.now(); H.grab(id, st, { p: 0.1 + i * 0.07, set }, 32, 32); gl.finish(); xs.push(performance.now() - a); } xs.sort((a, b) => a - b); return xs[3]; };
      t({}); return { def: t({}), live: st.params.quality ? t({ quality: 'live' }) : null, bal: st.params.quality ? t({ quality: 'balanced' }) : null };
    }, { id, l: st.localId });
    out.push({ kit: id, style: st.localId, ...r }); console.log(id.padEnd(20), st.localId.padEnd(24), 'default', r.def.toFixed(1), 'balanced', r.bal && r.bal.toFixed(1), 'live', r.live && r.live.toFixed(1));
  }
}
fs.writeFileSync(path.join(root, 'qa/cost.json'), JSON.stringify(out, null, 2)); await h.close();
