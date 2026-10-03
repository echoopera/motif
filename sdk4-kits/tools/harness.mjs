// Headless WebGL2 harness around the SDK's own runtime (lib/kit-gl.js): renders kit styles exactly as `motif-kit preview` does.
// All timings produced here are SwiftShader (CPU) numbers: relative diagnostics only, never device performance.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const here = path.dirname(fileURLToPath(import.meta.url));
export const sdkDir = path.resolve(here, '../sdk');
export const KG = new Function(fs.readFileSync(path.join(sdkDir, 'lib/kit-gl.js'), 'utf8'))();
const require = createRequire(path.join(sdkDir, 'package.json'));

export function readKitDir(dir) {
  const files = {};
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(glsl|json|md|txt|svg)$/i.test(f)) files[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
  walk(dir);
  const manifest = JSON.parse(files['manifest.json']); delete files['manifest.json'];
  return { manifest, files };
}
export function loadKit(dir) {
  const raw = readKitDir(dir); const v = KG.validateKit(raw.manifest, raw.files);
  if (!v.ok) throw new Error('kit does not validate:\n' + v.errors.join('\n'));
  return { kit: v.kit, report: v.report, warnings: v.warnings };
}

export async function openHarness() {
  const { chromium } = require('playwright');
  const exe = process.env.MOTIF_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage(); await page.setContent('<canvas id="c"></canvas>');
  await page.addScriptTag({ content: `window.KG = (function(){ ${fs.readFileSync(path.join(sdkDir, 'lib/kit-gl.js'), 'utf8')} })();` });
  await page.evaluate(() => {
    window.H = { rt: KG.createGlRuntime(), kits: {}, tmp: document.createElement('canvas') };
    if (!H.rt.ok) throw new Error('WebGL2 unavailable: ' + H.rt.reason);
    // entry: compile, defaults, palette
    H.entry = (kitId, localId) => H.kits[kitId].renderables.find(s => s.localId === localId);
    H.prep = (kitId, localId) => {
      const k = H.kits[kitId], st = H.entry(kitId, localId); if (!st) throw new Error('no style ' + localId);
      const c = H.rt.compile(st.id, { passes: st.passes, common: k.kit.common, params: st.params, inputs: st.inputs || [], ...(st.runtime || {}) }, true);
      if (!c.ok) throw new Error('compile ' + localId + ': ' + c.error);
      return st;
    };
    H.u = (kitId, st, o) => {
      const k = H.kits[kitId];
      const pal = k.kit.palettes.find(p => p.id === (o.palette || st.palette)) || k.kit.palettes[0];
      const params = Object.fromEntries(Object.entries(st.params).map(([key, s]) => [key, s.def])); Object.assign(params, o.set || {});
      return { p: o.p, L: o.L ?? 12, seed: o.seed ?? 417, safe: o.safe ?? true, pal, params, spec: st.params, media: null };
    };
    H.grab = (kitId, st, o, W, Hh) => {
      const u = H.u(kitId, st, o); H.rt.draw(st.id, W, Hh, u);
      H.tmp.width = W; H.tmp.height = Hh; const x = H.tmp.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, W, Hh); H.rt.blit(x, W, Hh);
      return x.getImageData(0, 0, W, Hh).data;
    };
  });
  return {
    page, browser,
    async register(kitDir) {
      const { kit, report, warnings } = loadKit(kitDir);
      const renderables = KG.renderables(kit);
      await page.evaluate(({ kit, renderables }) => { H.kits[kit.id] = { kit, renderables }; }, { kit, renderables });
      return { kit, report, warnings };
    },
    // render one frame to a PNG buffer (width/height in px)
    async png(kitId, localId, o, W, Hh, mime = 'image/png') {
      const b64 = await page.evaluate(({ kitId, localId, o, W, Hh, mime }) => { const st = H.prep(kitId, localId); H.grab(kitId, st, o, W, Hh); return H.tmp.toDataURL(mime, 0.93).split(',')[1]; }, { kitId, localId, o, W, Hh, mime });
      return Buffer.from(b64, 'base64');
    },
    async close() { await browser.close(); },
  };
}
