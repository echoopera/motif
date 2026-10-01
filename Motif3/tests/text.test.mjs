// Text inputs (motif-kit@3): validator, JSON schema, GLSL contract, sanitizers / typography clamps, timeline paths and
// keys, project schema, older hosts. Browser behaviour (atlas pixels, worker parity, UI) is in tests/browser/text.browser.mjs.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { load } from './load.mjs';
import { rawFromDir, rawFromZip, unzip, root } from './lib/kits.mjs';
import { validator } from './lib/json-schema.mjs';
import { tinyFont } from './lib/tiny-font.mjs';

const M = load('tokens', 'engine-core', 'style-library', 'kit-gl', 'kit-sandbox', 'text-atlas', 'kits', 'colour', 'timeline');
const KG = M.__m_kit_gl, SB = M.__m_kit_sandbox, TA = M.__m_text_atlas, K = M.__m_kits, T = M.__m_timeline;
const j = x => JSON.parse(JSON.stringify(x));
const kit3 = validator(JSON.parse(fs.readFileSync(path.join(root, 'schemas/motif-kit-3.schema.json'), 'utf8')));
const projectSchema = validator(JSON.parse(fs.readFileSync(path.join(root, 'schemas/motif-project.schema.json'), 'utf8')));
const FACETYPE = rawFromDir(path.join(root, 'kits/source/facetype'));

// The product owner's contract example, as a complete kit.
const PO_INPUT = { id: 'type', type: 'text', label: 'Type', lines: [{ id: 'line1', label: 'Line 1', def: 'FORM FOLLOWS' }, { id: 'line2', label: 'Line 2', def: 'FREQUENCY' }, { id: 'line3', label: 'Line 3', def: 'TYPE IS SIGNAL' }] };
const SHADER = 'vec4 motif(vec2 uv, vec2 fc) { float a = 0.0; for (int i = 0; i < 3; i++) a = max(a, textLine(i, uv - vec2(0.0, 0.1 * float(i - 1))).a); return vec4(u_ink * a, a); }';
const kit = (patch = {}, input = PO_INPUT) => ({ manifest: { format: 'motif-kit@3', id: 'txt-kit', name: 'Txt', version: '1.0.0', capabilities: ['text'], inputs: [input], styles: [{ id: 'main', name: 'Main', passes: [{ src: 'styles/main.glsl' }], params: { a: { type: 'range', min: 0, max: 1, def: 0.5 }, b: { type: 'range', min: 0, max: 1, def: 0.5 }, c: { type: 'range', min: 0, max: 1, def: 0.5 }, d: { type: 'range', min: 0, max: 1, def: 0.5 } } }], ...patch }, files: { 'styles/main.glsl': SHADER } });
const val = raw => SB.validate(raw.manifest, raw.files);
const line = (over = {}) => ({ ...PO_INPUT, lines: [{ ...PO_INPUT.lines[0], ...over }] });

test('validator: the contract example validates as motif-kit@3 with normalized lines and defaults', () => {
  const v = val(kit());
  assert.ok(v.ok, v.errors.join('\n'));
  assert.equal(v.kit.format, 'motif-kit@3'); assert.equal(v.kit.sourceFormat, 'motif-kit@3'); assert.deepEqual(j(v.kit.capabilities), ['text']);
  const q = v.kit.styles[0].inputs[0];
  assert.equal(q.type, 'text'); assert.equal(q.aspect, 8); assert.equal(q.lines.length, 3);
  assert.deepEqual(j(q.lines[0]), { id: 'line1', label: 'Line 1', def: 'FORM FOLLOWS', maxLength: 64, font: { family: 'Instrument Sans', weight: 700 }, size: 0.72, tracking: 0, align: 'center' });
  assert.deepEqual(kit3(kit().manifest), [], 'schema accepts it');
});

test('validator + schema reject malformed text and font declarations', () => {
  const bad = [
    ['@2 cannot declare text', kit({ format: 'motif-kit@2' }), /needs "format": "motif-kit@3"/],
    ['text capability on @2', { ...kit({ format: 'motif-kit@2', inputs: [] }) }, /capability "text" needs/],
    ['no lines', kit({}, { ...PO_INPUT, lines: [] }), /lines must list 1–3/],
    ['four lines', kit({}, { ...PO_INPUT, lines: [1, 2, 3, 4].map(i => ({ id: 'l' + i, def: 'x' })) }), /lines must list 1–3/],
    ['duplicate line id', kit({}, { ...PO_INPUT, lines: [{ id: 'a' }, { id: 'a' }] }), /duplicate line id/],
    ['bad line id', kit({}, line({ id: 'Line 1' })), /id must be camelCase/],
    ['def not a string', kit({}, line({ def: 42 })), /def must be a string/],
    ['def with newline', kit({}, line({ def: 'A\nB' })), /one line of text/],
    ['def with control char', kit({}, line({ def: 'A\u0007' })), /control characters/],
    ['def longer than maxLength', kit({}, line({ def: 'ABCDEFGHIJ', maxLength: 4 })), /maxLength is 4/],
    ['maxLength too big', kit({}, line({ maxLength: 1000 })), /maxLength must be an integer 1–128/],
    ['family with quote', kit({}, line({ font: { family: 'Arial", serif' } })), /font.family must be/],
    ['family with semicolon', kit({}, line({ font: { family: 'A;B' } })), /font.family must be/],
    ['family too long', kit({}, line({ font: { family: 'F'.repeat(65) } })), /font.family must be/],
    ['weight 450', kit({}, line({ font: { weight: 450 } })), /font.weight must be one of/],
    ['font url', kit({}, line({ font: { family: 'X', src: 'https://evil/x.woff2' } })), /declares only family and weight/],
    ['size 2', kit({}, line({ size: 2 })), /size must be/],
    ['tracking 5', kit({}, line({ tracking: 5 })), /tracking must be/],
    ['align justify', kit({}, line({ align: 'justify' })), /align must be left, center or right/],
    ['aspect 40', kit({}, { ...PO_INPUT, aspect: 40 }), /aspect must be 2–16/],
    ['fit on text', kit({}, { ...PO_INPUT, fit: 'fill' }), /fit does not apply/],
    ['missing text capability', kit({ capabilities: [] }), /does not declare the "text" capability/],
  ];
  for (const [name, raw, re] of bad) {
    const v = val(raw);
    assert.equal(v.ok, false, `${name} must be rejected`);
    assert.match(v.errors.join('\n'), re, name);
  }
  // Schema-level rejections for structural cases.
  for (const [name, raw] of bad.slice(2, 21)) if (!/longer than maxLength|control char|newline|duplicate/.test(name)) assert.ok(kit3(raw.manifest).length > 0, `schema rejects: ${name}`);
  // A media capability with only a text input is declared but unused: a warning, not an error.
  const extra = val(kit({ capabilities: ['text', 'media'] })); assert.ok(extra.ok); assert.ok(extra.warnings.some(w => /"media" capability but does not use it/.test(w)));
  // Text inputs belong to styles.
  const fx = kit(); fx.manifest.effects = [{ id: 'fx', name: 'Fx', inputs: [PO_INPUT], passes: [{ src: 'styles/main.glsl' }] }];
  assert.match(val(fx).errors.join('\n'), /text inputs belong to styles/);
});

test('GLSL contract: one sampler, textLine helpers, strings never reach the shader source', () => {
  const v = val(kit()), st = v.kit.styles[0];
  const def = K.defOf(v.kit, st);
  const { src } = KG.buildSource(st.passes[0].src, v.kit.common, def.params, true, st.inputs, def.extra);
  assert.match(src, /uniform sampler2D u_type;/); assert.match(src, /uniform float u_typeOn;/);
  assert.match(src, /const int textLines_type = 3;/); assert.match(src, /const float textAspect_type = 8\.0000;/);
  assert.match(src, /vec4 textLine_type\(int i, vec2 q\)/); assert.match(src, /vec4 textLine\(int i, vec2 q\) \{ return textLine_type\(i, q\); \}/);
  assert.match(src, /vec4 m_type\(vec2 q\)/);
  assert.equal((src.match(/uniform sampler2D u_type\b/g) || []).length, 1, 'exactly one atlas sampler per input');
  for (const s of ['FORM FOLLOWS', 'FREQUENCY', 'TYPE IS SIGNAL', 'Instrument Sans']) assert.ok(!src.includes(s), `"${s}" is not in GLSL`);
  // The analyzer counts the helper's fetch and stays far under budget.
  assert.ok(v.report.entries[0].fetches >= 3 && v.report.entries[0].fetches < 64);
});

test('sanitizers: text bounded (control chars, line breaks, split surrogates), fonts allowlisted, typography clamped', () => {
  assert.equal(TA.cleanText('A'.repeat(1e6), 48).length, 48);
  assert.equal(TA.cleanText('a\u0000b\u0007c\u001b[31m\r\nd e', 64), 'abc[31m de');
  assert.equal(TA.cleanText('x😀', 2), 'x', 'never splits a surrogate pair');
  assert.equal(TA.cleanText('😀👩‍👩‍👧', 64), '😀👩‍👩‍👧', 'emoji and ZWJ survive');
  assert.equal(TA.cleanText('שלום مرحبا​', 64), 'שלום مرحبا​', 'RTL and zero-width kept (not control characters)');
  assert.equal(TA.cleanText(null, 8), ''); assert.equal(TA.cleanText({ toString: () => 'obj' }, 8), 'obj');
  const d = { family: 'Instrument Sans', weight: 700 };
  assert.deepEqual(j(TA.cleanFont({ family: 'DejaVu Sans', weight: 349 }, d)), { family: 'DejaVu Sans', weight: 300 });
  assert.deepEqual(j(TA.cleanFont({ family: 'x", serif', weight: 1e9, source: 'javascript:1' }, d)), { family: 'Instrument Sans', weight: 900 });
  assert.deepEqual(j(TA.cleanFont({ family: 'F'.repeat(10000) }, d)), d, 'a 10k-character family is rejected, not truncated');
  assert.deepEqual(j(TA.cleanFont({ family: 'Mono', weight: 400, source: 'f_0123456789abcdef01234567' }, d)), { family: 'Mono', weight: 400, source: 'f_0123456789abcdef01234567' });
  assert.deepEqual(j(TA.cleanFont('Arial', d)), d);
  const spec = val(kit()).kit.styles[0].inputs[0];
  const l = TA.cleanLine({ text: 'Hi', size: 99, tracking: -9, align: 'justify', font: { family: 'Fraunces', weight: 500 } }, spec.lines[0]);
  assert.deepEqual(j(l), { text: 'Hi', font: { family: 'Fraunces', weight: 500 }, size: 1, tracking: -0.2, align: 'center' });
  assert.deepEqual(j(TA.cleanLine({ size: 'NaN', tracking: null }, spec.lines[0])), { text: 'FORM FOLLOWS', font: d, size: 0.72, tracking: 0, align: 'center' });
  // State: only declared inputs and lines; defaults filled; hostile shapes ignored.
  const st = TA.sanitizeState({ type: { lines: { line2: { text: 'B' }, evil: { text: 'x' } } }, other: { lines: {} }, constructor: 1 }, [spec]);
  assert.deepEqual(Object.keys(st), ['type']); assert.deepEqual(Object.keys(st.type.lines), ['line1', 'line2', 'line3']);
  assert.equal(st.type.lines.line1.text, 'FORM FOLLOWS'); assert.equal(st.type.lines.line2.text, 'B');
  assert.equal(TA.sanitizeState({ type: {} }, []), null, 'a style without text inputs stores no text');
  assert.equal(({}).polluted, undefined);
});

test('timeline: text paths, hold keys for strings and fonts, eased size, evaluate, sanitizeProject, project schema', () => {
  const r = K.install(FACETYPE, { source: 'file', approved: ['text'], compile: false });
  assert.ok(r.ok, (r.errors || []).join('\n'));
  try {
    let pr = T.newProject('facetype/rational-grid'); const id = pr.layers[0].id, P = (f, l = 'line1') => `L:${id}:t:type.${l}.${f}`;
    assert.equal(pr.layers[0].text.type.lines.line2.text, 'FREQUENCY', 'new layers carry the declared defaults');
    assert.equal(T.schemaAt(pr, P('text')).type, 'text'); assert.equal(T.schemaAt(pr, P('font')).type, 'font'); assert.equal(T.schemaAt(pr, P('size')).type, 'range');
    assert.equal(T.schemaAt(pr, `L:${id}:t:type.line9.text`), null); assert.equal(T.schemaAt(pr, `L:${id}:t:nope.line1.text`), null);
    pr = T.setBase(pr, P('text'), 'A\u0000B'.repeat(100)); assert.equal(pr.layers[0].text.type.lines.line1.text.length, 48);
    pr = T.setBase(pr, P('size'), 9); assert.equal(pr.layers[0].text.type.lines.line1.size, 1);
    pr = T.setBase(pr, P('align'), 'evil'); assert.equal(pr.layers[0].text.type.lines.line1.align, 'center');
    pr = T.setKey(pr, P('text'), 0, 'ONE'); pr = T.setKey(pr, P('text'), 0.5, 'TWO');
    pr = T.setKey(pr, P('font'), 0, { family: 'A', weight: 400 }); pr = T.setKey(pr, P('font'), 0.5, { family: 'B', weight: 900 });
    pr = T.setKey(pr, P('size'), 0, 0.2); pr = T.setKey(pr, P('size'), 0.5, 1);
    assert.deepEqual([...new Set([...pr.keys[P('text')], ...pr.keys[P('font')]].map(k => k.e))], ['hold']);
    assert.equal(pr.keys[P('size')][0].e, 'smooth');
    const at = u => T.evaluate(pr, u * pr.finish.loop, null).layers[0].text.type.lines.line1;
    assert.equal(at(0.49).text, 'ONE'); assert.equal(at(0.51).text, 'TWO'); assert.deepEqual(j(at(0.3).font), { family: 'A', weight: 400 });
    const s = at(0.25).size; assert.ok(s > 0.2 && s < 1, `size eases (${s})`);
    assert.equal(pr.layers[0].text.type.lines.line1.text.length, 48, 'evaluate never writes back');
    assert.ok(T.isNumericPath(pr, P('size')) && !T.isNumericPath(pr, P('text')));
    assert.ok(T.allPaths(pr, true).some(x => x.path === P('tracking', 'line3')));
    assert.match(T.pathLabel(pr, P('font', 'line2')), /^L1 Line 2 Font$/);
    // Round trip through a JSON document and the project schema.
    const doc = T.sanitizeProject(JSON.parse(JSON.stringify(pr)));
    assert.deepEqual(j(doc.layers[0].text), j(pr.layers[0].text)); assert.deepEqual(j(doc.keys), j(pr.keys));
    assert.deepEqual(projectSchema(j(doc)), []);
    // Another kit's style drops the text block and its keys on sanitize.
    const other = T.sanitizeProject({ ...j(doc), layers: [{ ...j(doc.layers[0]), styleId: 'plexus' }] });
    assert.equal(other.layers[0].text, undefined); assert.equal(Object.keys(other.keys).length, 0);
  } finally { K.remove('facetype'); }
});

test('FaceType 1.3.0: package == source, motif-kit@3, text instead of plate, every param/palette/style kept from 1.2.0', () => {
  const pkg = rawFromZip(fs.readFileSync(path.join(root, 'kits/facetype-1.3.0.motifkit')));
  assert.deepEqual(pkg.manifest, FACETYPE.manifest); assert.deepEqual(pkg.files, FACETYPE.files);
  const v = val(pkg); assert.ok(v.ok, v.errors.join('\n'));
  assert.deepEqual(kit3(pkg.manifest), []);
  const m = pkg.manifest;
  assert.equal(m.format, 'motif-kit@3'); assert.equal(m.version, '1.3.0'); assert.deepEqual(m.capabilities, ['text']);
  assert.deepEqual(m.inputs[0].lines.map(l => l.def), ['FORM FOLLOWS', 'FREQUENCY', 'TYPE IS SIGNAL']);
  assert.ok(!JSON.stringify(m).includes('typePlate'), 'no image plate'); assert.ok(!/u_typePlate/.test(pkg.files['common.glsl']));
  assert.match(pkg.files['common.glsl'], /textLine_type\(id,/);
  assert.equal(m.styles.length, 10);
  for (const s of m.styles) { assert.equal(Object.keys(s.params).length, 24, s.id); assert.ok(s.params.line1Pos && s.params.line3Ink && s.params.backdrop, s.id); }
  assert.deepEqual(m.palettes.map(p => p.id), ['graphite', 'paper', 'electric']);
  for (const s of v.report.entries) assert.ok(s.fetches < SB.LIMITS.fetchesSoft, `${s.localId}: ${s.fetches} fetches`);
});

test('schema: motif-kit-3 accepts every @1/@2 bundled kit shape and the @3 text input; older hosts reject @3 by format string', () => {
  const s3 = JSON.parse(fs.readFileSync(path.join(root, 'schemas/motif-kit-3.schema.json'), 'utf8'));
  assert.deepEqual(s3.properties.format.enum, ['motif-kit@1', 'motif-kit@2', 'motif-kit@3']);
  assert.ok(kit3({ ...kit().manifest, format: 'motif-kit@2' }).length > 0, 'schema: text input needs @3');
  // SDK 1.2 (motif-kit@1 hosts): the shipped zip's validator.
  const un = unzip(fs.readFileSync(path.join(root, 'sdk/motif-kit-sdk-1.2.0.zip')));
  const old = new Function(un['motif-kit-sdk/lib/kit-gl.js'].toString('utf8'))();
  const o = old.validateKit(kit().manifest, kit().files);
  assert.equal(o.ok, false); assert.match(o.errors.join('\n'), /format must be "motif-kit@1" \(got "motif-kit@3"\)/);
  // Motif 7.0 before text inputs (motif-kit@2 host), from git history when available.
  let src = null; try { src = execFileSync('git', ['show', 'b62b15e:Motif3/src-v5/modules/04a-kit-sandbox.js'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { /* shallow clone */ }
  if (src) {
    const gl = execFileSync('git', ['show', 'b62b15e:Motif3/src-v5/modules/04-kit-gl.js'], { cwd: root, encoding: 'utf8' });
    const V2 = new Function(gl + '\n' + src + '\nreturn __m_kit_sandbox;')();
    const r = V2.validate(kit().manifest, kit().files);
    assert.equal(r.ok, false); assert.match(r.errors[0], /format must be "motif-kit@1" or "motif-kit@2" \(got "motif-kit@3"\)/);
  }
});

test('@1 and @2 kits normalize exactly as before (format, styles, capabilities)', () => {
  const lumen = rawFromDir(path.join(root, 'sdk/motif-kit-sdk/examples/lumen-fx'));
  const v = val(lumen); assert.equal(v.kit.format, 'motif-kit@2'); assert.equal(v.kit.sourceFormat, 'motif-kit@2');
  const wall = rawFromZip(fs.readFileSync(path.join(root, 'kits/wallcast-1.0.0.motifkit'))); const w = val(wall);
  assert.equal(w.kit.format, 'motif-kit@2'); assert.equal(w.kit.sourceFormat, 'motif-kit@1');
  for (const s of [...v.kit.styles, ...w.kit.styles]) assert.ok(!s.inputs.some(q => q.type === 'text'));
});

test('tiny test font is a well-formed sfnt (table directory, checksums, head adjustment)', () => {
  const f = Buffer.from(tinyFont('Motif Test Block')); const n = f.readUInt16BE(4);
  const tags = []; for (let i = 0; i < n; i++) tags.push(f.toString('latin1', 12 + 16 * i, 16 + 16 * i));
  assert.deepEqual(tags, [...tags].sort()); for (const t of ['OS/2', 'cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post']) assert.ok(tags.includes(t), t);
  let sum = 0; for (let i = 0; i < f.length; i += 4) sum = (sum + f.readUInt32BE(i)) >>> 0; assert.equal(sum, 0xB1B0AFBA);
});
