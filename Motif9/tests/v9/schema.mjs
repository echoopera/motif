// motif-graph-1 and the project schema accept what the app writes and reject what it must not: node tests/v9/schema.mjs
// Needs Ajv (npm i ajv, or AJV_MODULE=/path/to/ajv/dist/2020.js) and Playwright for the project JSON the app itself produces.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url';
import { root, launch, openApp, suite } from './lib.mjs';
const { t, done } = suite('MotifGraph schemas');
const require = createRequire(import.meta.url); let Ajv;
try { Ajv = process.env.AJV_MODULE ? (await import(pathToFileURL(process.env.AJV_MODULE).href)).default : require(require.resolve('ajv/dist/2020', { paths: [root, process.cwd(), ...(process.env.AJV_PATH ? [process.env.AJV_PATH] : [])] })); } catch (e) { console.log('schema checks skipped: Ajv not found (npm i ajv, or set AJV_MODULE).'); process.exit(0); }
Ajv = Ajv.default || Ajv;
const read = f => JSON.parse(fs.readFileSync(path.join(root, 'schemas', f), 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true }); ajv.addSchema(read('motif-graph-1.schema.json')); const vProject = ajv.compile(read('motif-project.schema.json')), vGraph = ajv.getSchema('https://motif.local/schemas/motif-graph-1.schema.json');
const browser = await launch(); const { page, errors } = await openApp(browser);
const data = await page.evaluate(() => { const T = __lab.api.timeline, G = __m_graph, out = { graphs: [], projects: [] };
  for (const p of G.PRESETS) for (const sc of ['layer', '@']) out.graphs.push({ id: p.id + ':' + sc, g: G.applyPreset(p.id, sc) });
  let pr = T.newProject('type-stagger'); pr.layers[0].graph = G.applyPreset('radial-array', 'layer'); pr.graph = G.applyPreset('lens-ripple', '@'); pr.graph.place = 'post';
  const id = pr.layers[0].graph.nodes[2].id; pr = T.setKey(pr, `M:${pr.layers[0].id}:${id}:scale`, 0, 0.2); pr.layers[0].graph.nodes.push({ id: 'gq', type: 'future-node', on: true, unknown: true, params: { a: 1 } });
  out.projects.push(T.sanitizeProject(JSON.parse(JSON.stringify(pr)))); return out; });
const bad = []; for (const { id, g } of data.graphs) if (!vGraph(g)) bad.push(id + ' ' + JSON.stringify(vGraph.errors.slice(0, 2)));
t(`all ${data.graphs.length} preset graphs (layer and composite) validate against motif-graph@1`, bad.length === 0, bad.slice(0, 3));
const pv = data.projects.map(p => vProject(p) || JSON.stringify(vProject.errors.slice(0, 3))); t('a project with layer and composite graphs, a graph keyframe and an unknown node validates', pv.every(x => x === true), pv);
const g0 = JSON.parse(JSON.stringify(data.graphs[0].g)); g0.nodes[1].params.cols = 9999; t('an out-of-range parameter is rejected', !vGraph(g0));
const g1 = JSON.parse(JSON.stringify(data.graphs[0].g)); g1.nodes[1].params.nope = 1; t('an unknown parameter on a known node is rejected', !vGraph(g1));
const g2 = JSON.parse(JSON.stringify(data.graphs[0].g)); g2.v = 2; t('a different graph version is rejected', !vGraph(g2));
t('no console errors', errors.length === 0, errors); await browser.close(); done();
