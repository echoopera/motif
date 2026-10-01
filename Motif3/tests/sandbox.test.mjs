// Plugin API (motif-kit@2) and kit sandbox: format, migration, schemas, static GLSL analysis, hostile kits, SDK CLI.
// Browser-side guards (background compile, canary, quarantine, context loss, UI) are in tests/browser/kits.browser.mjs.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { load } from './load.mjs';
import { bundledKits, rawFromDir, root } from './lib/kits.mjs';
import { validator } from './lib/json-schema.mjs';
import { HOSTILE, SLOW_KIT, NICE_KIT } from './lib/hostile.mjs';

const mods = path.join(root, 'src-v5/modules');
const M = load('tokens', 'engine-core', 'style-library', 'kit-gl', 'kit-sandbox', 'kits', 'colour', 'timeline');
const KG = M.__m_kit_gl, SB = M.__m_kit_sandbox, K = M.__m_kits, T = M.__m_timeline;
const kitSchema = validator(JSON.parse(fs.readFileSync(path.join(root, 'schemas/motif-kit-2.schema.json'), 'utf8')));
const projectSchema = validator(JSON.parse(fs.readFileSync(path.join(root, 'schemas/motif-project.schema.json'), 'utf8')));
const KITS = bundledKits();
const LUMEN = rawFromDir(path.join(root, 'sdk/motif-kit-sdk/examples/lumen-fx'));
const cli = path.join(root, 'sdk/motif-kit-sdk/bin/motif-kit.mjs');
const j = x => JSON.parse(JSON.stringify(x)); // values from the module VM live in another realm: compare as JSON

test('every bundled kit (Motif3/kits/**, SDK template/examples, built-in catalog) matches the published kit schema', () => {
  assert.ok(KITS.length >= 30, `found ${KITS.length} bundled kits`);
  for (const k of [...KITS, { label: 'lumen-fx', raw: LUMEN }]) assert.deepEqual(kitSchema(k.raw.manifest), [], k.label);
});

test('every bundled kit passes motif-kit@2 validation including static GLSL analysis', () => {
  for (const k of KITS) {
    const v = SB.validate(k.raw.manifest, k.raw.files);
    assert.ok(v.ok, `${k.label}: ${v.errors.slice(0, 3).join(' | ')}`);
    for (const e of v.report.entries) {
      assert.ok(e.iterations <= SB.LIMITS.iterationsPerPixel / 4, `${k.label} ${e.id}: ${e.iterations} iterations is within a quarter of the limit`);
      assert.ok(e.fetches <= SB.LIMITS.fetchesPerPixel / 2, `${k.label} ${e.id}: ${e.fetches} fetches is within half of the limit`);
    }
  }
});

test('motif-kit@1 kits install unchanged, with a recorded migration to @2', () => {
  const v1Kits = KITS.filter(k => k.raw.manifest.format === 'motif-kit@1');
  assert.ok(v1Kits.length >= 30, `${v1Kits.length} motif-kit@1 kits`);
  for (const k of v1Kits) {
    const v1 = KG.validateKit(k.raw.manifest, k.raw.files), v2 = SB.validate(k.raw.manifest, k.raw.files);
    assert.equal(k.raw.manifest.format, 'motif-kit@1');
    assert.equal(v2.kit.format, 'motif-kit@2'); assert.equal(v2.kit.sourceFormat, 'motif-kit@1');
    assert.equal(v2.kit.migration.from, 'motif-kit@1'); assert.ok(v2.kit.migration.steps.length >= 2);
    // Styles, params, inputs, passes and shader text are exactly what motif-kit@1 produced.
    const strip = s => { const { kind, runtime, ...rest } = s; return rest; };
    assert.deepEqual(j(v2.kit.styles.map(strip)), j(v1.kit.styles), k.label);
    for (const s of v2.kit.styles) assert.equal(s.runtime, null, `${k.label} ${s.id}: no extra runtime declarations for @1 styles`);
    const media = v1.kit.styles.some(s => s.inputs.length);
    assert.deepEqual(j(v2.kit.capabilities), media ? ['media'] : [], k.label);
    assert.deepEqual(j(v2.warnings.filter(w => !/iterations per pixel|texture reads per pixel/.test(w))), j(v1.warnings), `${k.label}: same author warnings`);
  }
});

test('motif-kit@2 reference kit: graph style with feedback, effect, transition, exporter', () => {
  const v = SB.validate(LUMEN.manifest, LUMEN.files);
  assert.ok(v.ok, v.errors.join('\n'));
  assert.deepEqual(j(v.report.kinds), { styles: 1, effects: 1, transitions: 1, exporters: 1 });
  assert.deepEqual(j(v.kit.capabilities), ['feedback']);
  const ink = v.kit.styles[0];
  assert.equal(ink.graph.feedback, true); assert.equal(ink.graph.executions, 9);
  assert.match(ink.runtime.graph.passes[0].extra, /uniform sampler2D g_field;/);
  assert.match(ink.runtime.graph.passes[0].extra, /uniform int u_iter;/);
  const iris = v.kit.transitions[0];
  assert.equal(iris.graph.linear, true); assert.deepEqual(j(iris.graph.externals), ['from', 'to']);
  assert.match(iris.runtime.graph.passes[0].extra, /uniform float u_progress;/);
  assert.deepEqual(j(v.kit.exporters[0].preset), { format: 'mp4', aspect: '9x16', tier: 1080, fps: 30, loops: 3, quality: 'high' });
  // The feedback capability is required, not optional.
  const m = { ...LUMEN.manifest, capabilities: [] };
  assert.match(SB.validate(m, LUMEN.files).errors.join('\n'), /feedback/);
});

test('hostile and malformed kits are rejected with located diagnostics, quickly', () => {
  for (const h of HOSTILE) {
    const raw = h.raw || JSON.parse(h.text);
    const t0 = performance.now(); const v = SB.validate(raw && raw.manifest, raw && raw.files); const ms = performance.now() - t0;
    assert.equal(v.ok, false, `${h.name} must be rejected`);
    const hit = v.diagnostics.find(d => d.severity === 'error' && d.code === h.code && (!h.match || h.match.test(d.message)));
    assert.ok(hit, `${h.name}: expected a "${h.code}" error, got ${JSON.stringify(v.diagnostics.slice(0, 2))}`);
    if (h.line) { assert.equal(hit.file, 'styles/main.glsl', h.name); assert.equal(hit.line, h.line, `${h.name} line`); }
    assert.ok(ms < 1500, `${h.name} validated in ${ms.toFixed(0)} ms`);
    // The app path rejects it too and installs nothing.
    const r = K.install(raw, { source: 'file', approved: 'all' });
    assert.equal(r.ok, false, h.name); assert.ok(!K.list().some(k => raw && raw.manifest && k.id === raw.manifest.id), h.name);
  }
  assert.equal(({}).polluted, undefined, 'no prototype pollution');
  assert.equal(Object.prototype.polluted, undefined);
});

test('statically valid kits: the slow canary kit passes static analysis (the runtime quarantines it); capabilities need approval', () => {
  const v = SB.validate(SLOW_KIT.manifest, SLOW_KIT.files);
  assert.ok(v.ok, v.errors.join('\n'));
  assert.ok(v.report.entries[0].iterations > SB.LIMITS.iterationsSoft, 'flagged heavy');
  assert.ok(v.warnings.some(w => /iterations per pixel/.test(w)));
  const nice = NICE_KIT('cap-check', { extra: { capabilities: ['media'] }, style: { inputs: [{ id: 'src', type: 'image' }] } });
  const r = K.install(nice, { source: 'file' });
  assert.equal(r.ok, false); assert.equal(r.needsApproval, true); assert.deepEqual(j(r.missing), ['media']);
  const ok = K.install(nice, { source: 'file', approved: ['media'], compile: false });
  assert.ok(ok.ok, (ok.errors || []).join('\n'));
  assert.deepEqual(j(K.list().find(k => k.id === 'cap-check').approved), ['media']);
  K.remove('cap-check');
});

test('kits are data + GLSL only: the kit path never evaluates code or touches network/DOM', () => {
  const src = f => fs.readFileSync(path.join(mods, f), 'utf8');
  const code = s => s.replace(/\/\/[^\n]*/g, '').replace(/`(?:\\.|[^`\\])*`/g, '``').replace(/'(?:\\.|[^'\\\n])*'/g, "''");
  const EXEC = /\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(|\bimport\s*\(|\bimportScripts\b|\bsetTimeout\s*\(\s*['"`]|\bWorker\s*\(|\bReflect\.construct/;
  const NET = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon|\bimport\s*\(/;
  const DOM = /\bdocument\b|\bwindow\b|\binnerHTML\b|\blocalStorage\b|\bpostMessage\b/;
  for (const f of ['04-kit-gl.js', '04a-kit-sandbox.js', '05-kits.js', '05a-kit-host.js']) {
    const c = code(src(f)); assert.doesNotMatch(c, EXEC, `${f} must not evaluate code`); assert.doesNotMatch(c, NET, `${f} must not reach the network`);
  }
  // The sandbox and host modules are engine-side: they must run in a Worker (no DOM, no window).
  for (const f of ['04a-kit-sandbox.js', '05a-kit-host.js']) assert.doesNotMatch(code(src(f)), DOM, `${f} must stay DOM-free`);
  // A kit cannot smuggle script through any manifest field: every string reaches the UI as text (escaped by the
  // shell, see the browser test), exporters are enumerated values, and only .glsl/.json/.md/.txt files are read.
  const parse = K.parseBytes(new TextEncoder().encode(JSON.stringify({ manifest: NICE_KIT('xx-kit').manifest, files: { ...NICE_KIT('xx-kit').files, 'evil.js': 'alert(1)' } })));
  const v = SB.validate(parse.manifest, parse.files); assert.equal(v.ok, false, 'a .js file in a JSON bundle is refused'); assert.match(v.errors.join('\n'), /evil\.js: only GLSL, JSON, Markdown and text files/);
});

test('graph rules: ordering, ping-pong, output, executions', () => {
  const base = (graph, kind = 'effect', caps = ['feedback']) => ({ manifest: { format: 'motif-kit@2', id: 'g-test', name: 'G', version: '1.0.0', capabilities: caps, [kind + 's']: [{ id: 'fx', name: 'Fx', graph }] }, files: { 'a.glsl': 'vec4 motif(vec2 uv, vec2 fc) { return g_inputPx(fc); }', 'b.glsl': 'vec4 motif(vec2 uv, vec2 fc) { return vec4(1.0); }' } });
  const ok = g => SB.validate(base(g).manifest, base(g).files);
  assert.ok(ok({ buffers: { t: { scale: 0.5 } }, passes: [{ src: 'a.glsl', reads: ['input'], writes: 't' }, { src: 'b.glsl', reads: ['t', 'input'] }] }).ok);
  assert.match(ok({ passes: [{ src: 'b.glsl', reads: ['output'] }] }).errors.join(), /read "output"/);
  assert.match(ok({ buffers: { t: {} }, passes: [{ src: 'b.glsl', writes: 'output' }, { src: 'b.glsl', writes: 't' }] }).errors.join(), /only the last pass|last pass must write/);
  assert.match(ok({ buffers: { t: {} }, passes: [{ src: 'b.glsl', reads: ['t'], writes: 't', iterate: 16 }, { src: 'b.glsl', reads: ['t'], writes: 't', iterate: 16 }, { src: 'b.glsl', reads: ['t'] }] }).errors.join(), /already written|executions/);
  assert.match(ok({ buffers: { input: {} }, passes: [{ src: 'b.glsl' }] }).errors.join(), /not input, from, to or output/);
  assert.match(ok({ passes: [{ src: 'b.glsl', reads: ['from'] }] }).errors.join(), /reads "from"/, 'an effect has no "from" input');
  const tr = base({ passes: [{ src: 'b.glsl', reads: ['from', 'to'] }] }, 'transition', []);
  assert.ok(SB.validate(tr.manifest, tr.files).ok);
});

test('published project schema is generated from the timeline and matches sanitizeProject output', () => {
  execFileSync(process.execPath, [path.join(root, 'tools/gen-project-schema.mjs'), '--check']);
  const p = T.newProject();
  assert.deepEqual(projectSchema(T.sanitizeProject(JSON.parse(JSON.stringify(p)))), []);
  // A messy document (old fields, out-of-range numbers, junk) sanitizes into a valid project.
  const messy = { ...p, layers: [...p.layers, { styleId: 'nope', params: { x: 'y' }, shared: { zoom: 99 }, comp: { opacity: -3 }, junk: 1 }], finish: { loop: 9999, grain: 'x' }, output: { fps: 7, space: 'cmyk' }, keys: { 'F:glow': [{ u: 2, v: 5, e: 'zz' }] }, extra: true };
  const s = T.sanitizeProject(messy);
  assert.deepEqual(projectSchema(s), []);
  assert.equal(s.format, T.FORMAT);
  assert.ok(projectSchema({ ...s, format: 'motif-style-lab/preset@1' }).length > 0, 'old format is not a current document');
});

test('SDK: lib/kit-gl.js is generated from the app modules; CLI validate/migrate/pack speak motif-kit@2', () => {
  execFileSync(process.execPath, [path.join(root, 'tools/sdk-sync.mjs'), '--check']);
  const ok = spawnSync(process.execPath, [cli, 'validate', path.join(root, 'sdk/motif-kit-sdk/examples/lumen-fx')], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr); assert.match(ok.stdout, /motif-kit@2/); assert.match(ok.stdout, /feedback/);
  const js = spawnSync(process.execPath, [cli, 'validate', path.join(root, 'kits/source/wallcast'), '--json'], { encoding: 'utf8' });
  assert.equal(js.status, 0, js.stderr); assert.equal(JSON.parse(js.stdout).report.migration.from, 'motif-kit@1');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'motif-kit-test-'));
  const bad = HOSTILE.find(h => h.name === 'while-true').raw;
  fs.mkdirSync(path.join(dir, 'bad/styles'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'bad/manifest.json'), JSON.stringify(bad.manifest)); fs.writeFileSync(path.join(dir, 'bad/styles/main.glsl'), bad.files['styles/main.glsl']);
  const no = spawnSync(process.execPath, [cli, 'validate', path.join(dir, 'bad')], { encoding: 'utf8' });
  assert.equal(no.status, 1); assert.match(no.stdout, /styles\/main\.glsl:3 +while loops cannot be bounded/);
  fs.cpSync(path.join(root, 'sdk/motif-kit-sdk/examples/param-lab'), path.join(dir, 'pl'), { recursive: true });
  const mg = spawnSync(process.execPath, [cli, 'migrate', path.join(dir, 'pl')], { encoding: 'utf8' });
  assert.equal(mg.status, 0, mg.stdout + mg.stderr);
  const migrated = JSON.parse(fs.readFileSync(path.join(dir, 'pl/manifest.json'), 'utf8'));
  assert.equal(migrated.format, 'motif-kit@2'); assert.deepEqual(kitSchema(migrated), []);
  const pl = rawFromDir(path.join(dir, 'pl')), orig = rawFromDir(path.join(root, 'sdk/motif-kit-sdk/examples/param-lab'));
  assert.deepEqual(j(SB.validate(pl.manifest, pl.files).kit.styles.map(s => s.params)), j(SB.validate(orig.manifest, orig.files).kit.styles.map(s => s.params)), 'migration keeps params');
  fs.rmSync(dir, { recursive: true, force: true });
});
