// Motif 9.0.1 vs Motif-Shadcn: the interface layer must not change what Motif renders. node tests/regression.mjs
// Every style renders the same pixels (two frames each, 96x54), and the MotifGraph build is untouched (a graph scene is compared too).
import path from 'node:path';
import { launch, openApp, suite, here } from './lib.mjs';
const { t, done } = suite('9.0.1 vs Motif-Shadcn regression'); const browser = await launch();
const A = await openApp(browser, { file: path.join(here, 'src-shadcn/Motif-9.0.1.html') }), B = await openApp(browser, { file: path.join(here, 'Motif.html') });
const ids = await A.page.evaluate(() => __lab.styles.map(s => s.id));
const render = (pg, list) => pg.evaluate(list => { const T = __lab.api.timeline, out = {}; for (const id of list) { try { let pr = T.newProject(id); pr.finish = { ...pr.finish, loop: 6 }; const st = __m_style_library.getStyle(id); if (st.palette) pr.layers[0].shared.palette = st.palette; if (id === 'type-stagger') { pr.layers[0].graph = __m_graph.applyPreset('grid-cascade', 'layer'); pr = T.sanitizeProject(pr); } const h = []; for (const tt of [0.7, 2.4]) { const r = __lab.renderAt(pr, tt, 96, 54); let x = 2166136261 >>> 0; const d = new Uint8Array(r.data); for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619) >>> 0; } h.push(x.toString(36)); } out[id] = h.join('.'); } catch (e) { out[id] = 'ERR ' + e.message; } } return out; }, list);
const ra = {}, rb = {}; for (let i = 0; i < ids.length; i += 12) { Object.assign(ra, await render(A.page, ids.slice(i, i + 12))); Object.assign(rb, await render(B.page, ids.slice(i, i + 12))); }
const diff = ids.filter(id => ra[id] !== rb[id]);
t(`all ${ids.length} styles (and a MotifGraph scene) render identical pixels in Motif-Shadcn`, diff.length === 0, diff); t('no console errors in either build', A.errors.length + B.errors.length === 0, [...A.errors, ...B.errors]);
await browser.close(); done();
