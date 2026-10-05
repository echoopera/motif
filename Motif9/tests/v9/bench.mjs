// Frame times for representative MotifGraph scenes: node tests/v9/bench.mjs [width] [height]
// Software GL (SwiftShader) in CI: the numbers are relative, not budgets; on a real GPU run the same file with MOTIF_CHROMIUM pointing at Chrome.
import { launch, openApp } from './lib.mjs';
const W = +process.argv[2] || 960, Hh = +process.argv[3] || 540; const browser = await launch(); const { page, errors } = await openApp(browser);
const rows = await page.evaluate(async ([W, Hh]) => {
  const T = __lab.api.timeline, G = __m_graph, out = [];
  const mk = (specs, scope) => { const g = G.newGraph(scope); const used = new Set(['stage']); for (const [type, params] of specs) { const n = G.newNode(type, used); used.add(n.id); Object.assign(n.params, params || {}); g.nodes.push(n); } return G.sanitizeGraph(g, scope); };
  const scenes = {
    'no graph': null,
    'wave + bulge (single mesh)': [['wave', { strength: 0.05 }], ['bulge', { strength: 0.5 }]],
    '10k tiles, delay': [['cloner', { mode: 'grid', cols: 128, rows: 78, detail: 1, content: 'tiles' }], ['delay', { scale: 0.5, posY: 0.2 }]],
    '2k clones, 3 effectors, 2 fields': [['cloner', { mode: 'phyllo', count: 2000, size: 0.06, content: 'whole', detail: 2 }], ['sphere', { motion: 'sweep' }], ['noisef', {}], ['random', { rotZ: 90, posX: 0.2 }], ['delay', { scale: 0.6 }], ['noise', { posY: 0.2 }]],
    '3k dots (halftone)': [['cloner', { mode: 'grid', cols: 80, rows: 45, content: 'dots', detail: 1 }], ['noise', { scale: 0.2 }]],
    'twist + lighting + perspective': [['stage', { camera: 'persp', light: 0.6 }], ['twist', {}], ['taper', {}]],
  };
  for (const [name, specs] of Object.entries(scenes)) for (const scope of ['layer', 'composite']) {
    if (!specs && scope === 'composite') continue;
    let pr = T.newProject('type-stagger'); pr.finish = { ...pr.finish, loop: 6, grain: 0, vignette: 0, shutter: 0 };
    if (specs) { const sp = specs.map(s => s.slice()), st = sp.findIndex(s => s[0] === 'stage'); const g = mk(sp.filter(s => s[0] !== 'stage'), scope === 'layer' ? 'layer' : '@'); if (st >= 0) Object.assign(g.nodes[0].params, sp[st][1]); if (scope === 'layer') pr.layers[0].graph = g; else pr.graph = g; }
    pr = T.sanitizeProject(pr); const c = document.createElement('canvas'); c.width = W; c.height = Hh; const x = c.getContext('2d');
    for (let i = 0; i < 2; i++) __lab.pipeline.renderFrame(x, W, Hh, pr, 0.2 * i, {});
    const ts = []; for (let i = 0; i < 6; i++) { const t0 = performance.now(); __lab.pipeline.renderFrame(x, W, Hh, pr, 0.3 + i * 0.17, {}); x.getImageData(0, 0, 1, 1); ts.push(performance.now() - t0); }
    ts.sort((a, b) => a - b); const e = specs ? G.estimate(G.evalCopy(pr.layers[0].graph || pr.graph)) : null;
    out.push({ scene: name, scope: specs ? scope : '-', ms: +ts[2].toFixed(1), vertices: e ? e.vertices : 0, clones: e ? e.instances : 0 });
  }
  return out;
}, [W, Hh]);
console.log(`MotifGraph frame time at ${W}x${Hh}, median of 6 (includes the Canvas 2D layer render and readback):`);
for (const r of rows) console.log(`  ${r.scene.padEnd(36)} ${r.scope.padEnd(10)} ${String(r.ms).padStart(8)} ms   ${String(r.clones).padStart(6)} clones ${String(r.vertices).padStart(8)} vertices`);
console.log('errors', errors); await browser.close();
