import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { load } from './load.mjs';
const root = path.resolve(import.meta.dirname, '..');

test('motif7.html is built from src-v5', () => { execFileSync('python3', [path.join(root, 'src-v5/build.py'), '--check']); });

test('every module is wrapped and versioned', () => {
  for (const f of fs.readdirSync(path.join(root, 'src-v5/modules')).filter(f => /^\d\d[a-z]?-/.test(f))) {
    const s = fs.readFileSync(path.join(root, 'src-v5/modules', f), 'utf8');
    assert.match(s, /^\/\/ ---- (module: [\w-]+|boot)/, f);
  }
});

test('engine-core is deterministic', () => {
  const { __m_engine_core: E } = load('engine-core');
  assert.ok(E.mulberry32, 'exports mulberry32');
  const a = E.mulberry32(42), b = E.mulberry32(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('timeline sanitizes and round-trips a new project', () => {
  const m = load('tokens', 'engine-core', 'style-library', 'kit-gl', 'kit-sandbox', 'kits', 'colour', 'timeline');
  assert.ok(m.__m_timeline.newProject);
});

test('budgets.json is well formed', () => {
  const b = JSON.parse(fs.readFileSync(path.join(root, 'tools/budgets.json'), 'utf8'));
  assert.equal(typeof b.default, 'number'); assert.equal(typeof b.styles, 'object');
});

test('engine modules are embedded once, as worker-loadable text', () => {
  const html = fs.readFileSync(path.join(root, 'motif7.html'), 'utf8');
  const a = html.indexOf('<script type="text/plain" id="motif-engine-src">'), b = html.indexOf('</script>', a);
  assert.ok(a > 0 && b > a, 'engine source block present');
  for (const name of ['__m_tokens', '__m_kits', '__m_renderer', '__m_worker_shim', '__m_render_worker']) {
    const decl = `const ${name} = (`, at = html.indexOf(decl);
    assert.equal(html.split(decl).length - 1, 1, `${name} declared once`); assert.ok(at > a && at < b, `${name} inside the engine block`);
  }
  assert.ok(html.indexOf('const __m_shell = (') > b, 'shell stays outside the engine block');
});

test('worker shim stands in for the engine DOM touchpoints', () => {
  // Stringified and re-evaluated, exactly as the worker blob does: it must not depend on anything outside its body.
  const install = (0, eval)('(' + load('worker-shim').__m_worker_shim.install.toString() + ')');
  class OffscreenCanvas { constructor(w, h) { this.width = w; this.height = h; } }
  const scope = { fonts: {} }; globalThis.OffscreenCanvas = OffscreenCanvas;
  try {
    install(scope, { 'motif-kits-v3': '{"v":1}' });
    assert.equal(scope.window, scope);
    assert.equal(scope.localStorage.getItem('motif-kits-v3'), '{"v":1}'); scope.localStorage.setItem('x', 1); assert.equal(scope.localStorage.getItem('x'), '1'); assert.equal(scope.localStorage.getItem('none'), null);
    const c = scope.document.createElement('canvas'); assert.ok(c instanceof OffscreenCanvas); assert.equal(c.width, 300);
    assert.throws(() => scope.document.createElement('div'));
  } finally { delete globalThis.OffscreenCanvas; }
});

test('kit registry mirrors into a second realm (render worker) via snapshot', () => {
  const names = ['tokens', 'engine-core', 'style-library', 'kit-gl', 'kit-sandbox', 'kits'];
  const page = load(...names), worker = load(...names);
  const raw = JSON.parse(execFileSync('python3', ['-c', 'import zipfile,json,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({"manifest":json.loads(z.read("manifest.json")),"files":{n:z.read(n).decode() for n in z.namelist() if n!="manifest.json" and not n.endswith("/")}}))', path.join(root, 'kits/param-lab-0.1.0.motifkit')], { encoding: 'utf8' }));
  const r = page.__m_kits.install(raw, { source: 'file' }); assert.ok(r.ok, (r.errors || []).join('; '));
  const ids = K => K.list().map(k => k.id + ':' + k.enabled).sort().join(',');
  const has = (m, id) => m.__m_style_library.STYLES.some(s => s.id === id);
  assert.ok(!has(worker, 'param-lab/ripple-field'));
  worker.__m_kits.applySnapshot(JSON.parse(JSON.stringify(page.__m_kits.snapshot())));
  assert.equal(ids(worker.__m_kits), ids(page.__m_kits)); assert.ok(has(worker, 'param-lab/ripple-field'));
  const rev = worker.__m_kits.revision; worker.__m_kits.applySnapshot(page.__m_kits.snapshot()); assert.equal(worker.__m_kits.revision, rev, 'unchanged snapshot is a no-op');
  page.__m_kits.setEnabled('param-lab', false); page.__m_kits.setSafe(false);
  worker.__m_kits.applySnapshot(page.__m_kits.snapshot());
  assert.ok(!has(worker, 'param-lab/ripple-field')); assert.equal(worker.__m_kits.safe, false);
  page.__m_kits.remove('param-lab'); worker.__m_kits.applySnapshot(page.__m_kits.snapshot());
  assert.ok(!worker.__m_kits.list().some(k => k.id === 'param-lab'));
});
