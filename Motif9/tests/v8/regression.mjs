// Motif 7.1.1 vs Motif 8: nothing that existed may change. node tests/v8/regression.mjs [path-to-7.1.1.html]
//  1. every kit in kits/ validates to byte-identical normalized output, warnings and static-analysis reports;
//  2. every style of 7.1.1 renders the same pixels (two frames each, 96x54).
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { root, launch, openApp, suite, readKit } from './lib.mjs';
const old = process.argv[2] || path.join(root, 'src-v8/Motif-7.1.1.html'); const { t, done } = suite('7.1.1 vs 8 regression');
const require = createRequire(import.meta.url); let fflate; try { fflate = require(require.resolve('fflate', { paths: [root, path.join(root, 'sdk/motif-kit-sdk')] })); } catch (e) { console.error('regression.mjs reads .motifkit files with fflate: run  npm i  in sdk/motif-kit-sdk first.'); process.exit(1); }
const { unzipSync, strFromU8 } = fflate;
const kits = []; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (fs.existsSync(path.join(p, 'manifest.json'))) kits.push(p); else walk(p); } else if (/\.motifkit$/.test(f) || /\.motifkit\.json$/.test(f)) kits.push(p); } }; walk(path.join(root, 'kits'));
const NEW = /(stack-lab|vector-type|sequence-demo)/;
const load = p => { if (fs.statSync(p).isDirectory()) return readKit(p); if (p.endsWith('.json')) { const j = JSON.parse(fs.readFileSync(p, 'utf8')); return { manifest: j.manifest || j, files: j.files || {} }; } const un = unzipSync(new Uint8Array(fs.readFileSync(p))); const files = {}; let manifest; for (const [n, b] of Object.entries(un)) { if (n.endsWith('/')) continue; if (n === 'manifest.json') manifest = JSON.parse(strFromU8(b)); else if (/\.(glsl|json|md|txt|svg)$/.test(n)) files[n] = strFromU8(b); } return { manifest, files }; };
const raws = kits.filter(p => !NEW.test(p)).map(p => ({ name: path.relative(path.join(root, 'kits'), p), ...load(p) }));
const browser = await launch(); const A = await openApp(browser, { file: old }), B = await openApp(browser);
const val = (pg, rs) => pg.evaluate(rs => rs.map(r => { const v = __m_kit_sandbox.validate(r.manifest, r.files); return { n: r.name, ok: v.ok, errors: v.errors, warnings: v.warnings, kit: v.kit ? JSON.stringify(v.kit) : null, rep: v.report ? JSON.stringify({ ...v.report, limits: undefined }) : null }; }), rs);
const a = await val(A.page, raws), b = await val(B.page, raws); let bad = 0;
a.forEach((x, i) => { const y = b[i]; if (!(x.ok === y.ok && JSON.stringify(x.errors) === JSON.stringify(y.errors) && JSON.stringify(x.warnings) === JSON.stringify(y.warnings) && x.kit === y.kit && x.rep === y.rep)) { bad++; console.log('  DIFF', x.n); } });
t(`validation is byte-identical for ${a.length} kits (@1, @2, @3: output, warnings, analysis report)`, bad === 0, bad);
const ids = await A.page.evaluate(() => __lab.styles.map(s => s.id));
const render = (pg, list) => pg.evaluate(list => { const T = __lab.api.timeline, out = {}; for (const id of list) { try { let pr = T.newProject(id); pr.finish = { ...pr.finish, loop: 6 }; const st = __m_style_library.getStyle(id); if (st.palette) pr.layers[0].shared.palette = st.palette; const h = []; for (const tt of [0.7, 2.4]) { const r = __lab.renderAt(pr, tt, 96, 54); let x = 2166136261 >>> 0; const d = new Uint8Array(r.data); for (let i = 0; i < d.length; i++) { x ^= d[i]; x = Math.imul(x, 16777619) >>> 0; } h.push(x.toString(36)); } out[id] = h.join('.'); } catch (e) { out[id] = 'ERR ' + e.message; } } return out; }, list);
const ra = {}, rb = {}; for (let i = 0; i < ids.length; i += 12) { Object.assign(ra, await render(A.page, ids.slice(i, i + 12))); Object.assign(rb, await render(B.page, ids.slice(i, i + 12))); }
const diff = ids.filter(id => ra[id] !== rb[id]);
t(`all ${ids.length} styles of 7.1.1 render identical pixels in 8`, diff.length === 0, diff); t('no console errors in either build', A.errors.length + B.errors.length === 0, [...A.errors, ...B.errors]);
await browser.close(); done();
