// Compile + first-draw time per style (cold program), a proxy for code size / driver compile cost. SwiftShader numbers: relative only.
import fs from 'node:fs'; import path from 'node:path';
import { openHarness } from './harness.mjs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const only = process.argv.slice(2);
const h = await openHarness();
for (const id of fs.readdirSync(path.join(root, 'kits')).filter(k => !only.length || only.includes(k))) {
  const { kit } = await h.register(path.join(root, 'kits', id));
  for (const st of kit.styles) {
    const ms = await h.page.evaluate(({ id, l }) => { const a = performance.now(); const st = H.prep(id, l); H.grab(id, st, { p: 0.1 }, 32, 32); H.rt.canvas.getContext('webgl2').finish(); return performance.now() - a; }, { id, l: st.localId });
    console.log(id.padEnd(20), st.localId.padEnd(24), ms.toFixed(0).padStart(6), 'ms cold');
  }
}
await h.close();
