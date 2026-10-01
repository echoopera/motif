// Hostile and malformed kits. Each must be REJECTED by validation (static: expect 'reject' + diagnostic code) or,
// when it is statically within limits but pathologically slow, QUARANTINED by the runtime canary (browser test).
// None of them may freeze the page: tests/browser/kits.browser.mjs installs them in a real page and measures the
// longest main-thread stall.
const PARAMS = { a: { type: 'range', label: 'A', min: 0, max: 1, def: 0.5 }, b: { type: 'range', label: 'B', min: 0, max: 1, def: 0.5 }, c: { type: 'range', label: 'C', min: 0, max: 1, def: 0.5 }, d: { type: 'range', label: 'D', min: 0, max: 1, def: 0.5 } };
export function kitOf(id, src, { format = 'motif-kit@1', params = PARAMS, extra = {}, style = {}, files = {} } = {}) {
  return { manifest: { format, id, name: id.slice(0, 32), version: '1.0.0', palettes: [{ id: 'pal', bg: '#000000', ink: '#FFFFFF', a: ['#FF0000', '#00FF00', '#0000FF'] }], styles: [{ id: 'main', name: 'Main', passes: [{ src: 'styles/main.glsl' }], params, ...style }], ...extra }, files: { 'styles/main.glsl': src, ...files } };
}
const motif = body => `vec4 motif(vec2 uv, vec2 fc) {\n  vec3 col = vec3(0.0);\n${body}\n  return vec4(col, 1.0);\n}\n`;
let bomb = '#define M0 col.r += 1.0;\n'; for (let i = 1; i <= 22; i++) bomb += `#define M${i} M${i - 1} M${i - 1}\n`;
let nest = ''; for (let i = 0; i < 40; i++) nest += '{ '; nest += 'col.r += 1.0; '; for (let i = 0; i < 40; i++) nest += '} ';

export const HOSTILE = [
  { name: 'infinite-for', expect: 'reject', code: 'unbounded-loop', line: 3, raw: kitOf('h-infinite-for', motif('  for (;;) { col.r += 0.1; }')) },
  { name: 'while-true', expect: 'reject', code: 'unbounded-loop', line: 3, raw: kitOf('h-while-true', motif('  while (true) { col.r += 0.1; }')) },
  { name: 'do-while', expect: 'reject', code: 'unbounded-loop', line: 3, raw: kitOf('h-do-while', motif('  int i = 0;\n  do { col.r += 0.1; i++; } while (i < 10);').replace('  int i = 0;\n', '')) },
  { name: 'counter-reset', expect: 'reject', code: 'unbounded-loop', line: 3, raw: kitOf('h-counter-reset', motif('  for (int i = 0; i < 8; i++) { col.r += 0.1; if (col.r > 0.5) i = 0; }')) },
  { name: 'param-bound-too-big', expect: 'reject', code: 'loop-trip', line: 3, raw: kitOf('h-param-bound', motif('  for (int i = 0; i < p_n; i++) { col.r += 1e-6; }'), { params: { ...PARAMS, n: { type: 'int', label: 'N', min: 1, max: 100000000, def: 4 } } }) },
  { name: 'giant-loop', expect: 'reject', code: 'loop-trip', line: 3, raw: kitOf('h-giant-loop', motif('  for (int i = 0; i < 100000000; i++) { col.r += 1e-9; }')) },
  { name: 'nested-product', expect: 'reject', code: 'budget', raw: kitOf('h-nested', motif('  for (int i = 0; i < 64; i++) for (int j = 0; j < 64; j++) for (int k = 0; k < 64; k++) { col.r += 1e-9; }')) },
  { name: 'fetch-flood', expect: 'reject', code: 'budget', raw: kitOf('h-fetch-flood', motif('  for (int i = 0; i < 1024; i++) { vec2 q = fc / u_res + float(i) * 0.001; col += texture(u_buf0, q).rgb + texture(u_buf1, q).rgb + texture(u_buf2, q).rgb + texture(u_buf3, q).rgb; }')) },
  { name: 'bad-pragma', expect: 'reject', code: 'pragma', line: 1, raw: kitOf('h-bad-pragma', '#pragma STDGL invariant(all)\n' + motif('  col.r = 1.0;')) },
  { name: 'bad-extension', expect: 'reject', code: 'extension', line: 1, raw: kitOf('h-bad-extension', '#extension GL_EXT_shader_framebuffer_fetch : require\n' + motif('  col.r = 1.0;')) },
  { name: 'version-directive', expect: 'reject', code: 'directive', line: 1, raw: kitOf('h-version', '#version 100\n' + motif('  col.r = 1.0;')) },
  { name: 'recursion', expect: 'reject', code: 'recursion', raw: kitOf('h-recursion', 'float f(float x) { return x > 0.0 ? f(x - 1.0) : 0.0; }\n' + motif('  col.r = f(3.0);')) },
  { name: 'huge-array', expect: 'reject', code: 'array', line: 3, raw: kitOf('h-huge-array', motif('  float big[100000];\n  big[0] = 1.0; col.r = big[0];')) },
  { name: 'macro-bomb', expect: 'reject', code: 'macro', raw: kitOf('h-macro-bomb', bomb + motif('  M22')) },
  { name: 'deep-nesting', expect: 'reject', code: 'nesting', raw: kitOf('h-deep-nesting', motif('  ' + nest)) },
  { name: 'non-ascii', expect: 'reject', code: 'syntax', line: 3, raw: kitOf('h-non-ascii', motif('  col.r = 1.0; é')) },
  { name: 'oversized-source', expect: 'reject', code: 'manifest', match: /larger than 96 KB/, raw: kitOf('h-oversized', motif('  col.r = 1.0;') + '// ' + 'x'.repeat(200 * 1024) + '\n') },
  { name: 'manifest-null', expect: 'reject', code: 'manifest', match: /missing or not an object/, raw: { manifest: null, files: {} } },
  { name: 'manifest-array', expect: 'reject', code: 'manifest', match: /missing or not an object/, raw: { manifest: [], files: {} } },
  { name: 'unknown-format', expect: 'reject', code: 'manifest', match: /format must be/, raw: { ...kitOf('h-format', motif('')), manifest: { ...kitOf('h-format', motif('')).manifest, format: 'motif-kit@99' } } },
  { name: 'styles-not-array', expect: 'reject', code: 'manifest', match: /styles must be an array/, raw: { manifest: { format: 'motif-kit@2', id: 'h-styles', name: 'x', version: '1.0.0', styles: 'nope' }, files: {} } },
  { name: 'missing-pass-file', expect: 'reject', code: 'manifest', match: /is not in the package/, raw: { ...kitOf('h-missing', motif('')), files: {} } },
  { name: 'proto-top-level', expect: 'reject', code: 'manifest', match: /__proto__/, json: true, raw: null, text: '{"manifest":{"__proto__":{"polluted":true},"format":"motif-kit@1","id":"h-proto","name":"P","version":"1.0.0","styles":[{"id":"main","name":"M","passes":[{"src":"s.glsl"}],"params":{}}]},"files":{"s.glsl":"vec4 motif(vec2 uv, vec2 fc){return vec4(1.0);}"}}' },
  { name: 'proto-in-params', expect: 'reject', code: 'manifest', match: /__proto__/, json: true, raw: null, text: '{"manifest":{"format":"motif-kit@1","id":"h-proto2","name":"P","version":"1.0.0","styles":[{"id":"main","name":"M","passes":[{"src":"s.glsl"}],"params":{"__proto__":{"type":"range","min":0,"max":1,"def":0,"polluted":true}}}]},"files":{"s.glsl":"vec4 motif(vec2 uv, vec2 fc){return vec4(1.0);}"}}' },
  { name: 'constructor-key', expect: 'reject', code: 'manifest', match: /constructor/, json: true, raw: null, text: '{"manifest":{"format":"motif-kit@1","id":"h-ctor","name":"P","version":"1.0.0","palettes":[{"constructor":{"prototype":{"polluted":true}},"id":"p","bg":"#000000","ink":"#FFFFFF","a":["#FF0000","#00FF00","#0000FF"]}],"styles":[{"id":"main","name":"M","passes":[{"src":"s.glsl"}],"params":{}}]},"files":{"s.glsl":"vec4 motif(vec2 uv, vec2 fc){return vec4(1.0);}"}}' },
  { name: 'proto-file-name', expect: 'reject', code: 'manifest', match: /File name/, json: true, raw: null, text: '{"manifest":{"format":"motif-kit@1","id":"h-protofile","name":"P","version":"1.0.0","styles":[{"id":"main","name":"M","passes":[{"src":"s.glsl"}],"params":{}}]},"files":{"s.glsl":"vec4 motif(vec2 uv, vec2 fc){return vec4(1.0);}","__proto__":"x"}}' },
  { name: 'capability-network', expect: 'reject', code: 'manifest', match: /never network, DOM or script/, raw: kitOf('h-cap-net', motif('  col.r = 1.0;'), { format: 'motif-kit@2', extra: { capabilities: ['network'] } }) },
  { name: 'undeclared-media', expect: 'reject', code: 'capability', raw: kitOf('h-undeclared-media', motif('  col = m_src(fc / u_res).rgb;'), { format: 'motif-kit@2', style: { inputs: [{ id: 'src', type: 'image' }] } }) },
  { name: 'undeclared-audio', expect: 'reject', code: 'capability', raw: kitOf('h-undeclared-audio', motif('  col.r = 1.0;') + 'float lvl() { return u_audio[0]; }\n', { format: 'motif-kit@2' }) },
  { name: 'exporter-with-code', expect: 'reject', code: 'manifest', match: /cannot run code|exporters hold only/, raw: { manifest: { format: 'motif-kit@2', id: 'h-exporter', name: 'X', version: '1.0.0', exporters: [{ id: 'evil', name: 'Evil', preset: { format: 'mp4', script: 'fetch("https://example.com")' }, onExport: 'alert(1)' }] }, files: {} } },
  { name: 'graph-unbounded-iterate', expect: 'reject', code: 'manifest', match: /iterate must be an integer 1–16/, raw: kitOf('h-graph-iter', motif('  col.r = 1.0;'), { format: 'motif-kit@2', extra: { capabilities: ['feedback'] }, style: { passes: undefined, graph: { buffers: { a: {} }, passes: [{ src: 'styles/main.glsl', reads: ['a'], writes: 'a', iterate: 1000 }, { src: 'styles/main.glsl', reads: ['a'] }] } } }) },
  { name: 'graph-read-before-write', expect: 'reject', code: 'manifest', match: /before any pass writes it/, raw: kitOf('h-graph-order', motif('  col.r = 1.0;'), { format: 'motif-kit@2', style: { passes: undefined, graph: { buffers: { a: {}, b: {} }, passes: [{ src: 'styles/main.glsl', reads: ['b'], writes: 'a' }, { src: 'styles/main.glsl', reads: ['a'], writes: 'b' }, { src: 'styles/main.glsl', reads: ['b'] }] } } }) },
];
// Passes every static check (≈32k loop iterations per pixel, just under the 32,768 limit) but does heavy transcendental work
// per iteration: the runtime canary must quarantine it instead of letting it reach the stage.
export const SLOW_KIT = kitOf('h-slow-canary', motif(`  float acc = 0.0;
  for (int i = 0; i < 31; i++) for (int j = 0; j < 32; j++) for (int k = 0; k < 32; k++) {
    float x = uv.x * float(i) + uv.y * float(j) + float(k) * 0.37 + acc;
    acc += sin(x) * cos(x * 1.3) + exp(-abs(x) * 0.01) * pow(abs(sin(x * 0.7)) + 0.1, 1.7) + sqrt(abs(cos(x * 2.1)) + 1.0) * 1e-3;
    acc += sin(x * 1.7 + acc) * cos(x * 2.3) + exp(-abs(x) * 0.02) * pow(abs(cos(x * 0.9)) + 0.2, 1.3) + log(abs(sin(x * 3.1)) + 1.0);
    acc += sin(x * 2.9 - acc) * cos(x * 3.7) + exp(-abs(x) * 0.03) * pow(abs(sin(x * 1.1)) + 0.3, 2.1) + atan(sin(x * 4.3), cos(x * 0.3));
    acc += sin(x * 4.1 + acc) * cos(x * 5.3) + exp(-abs(x) * 0.05) * pow(abs(cos(x * 1.9)) + 0.4, 1.9) + sinh(sin(x * 0.11)) * cosh(cos(x * 0.13));
    acc += tan(sin(x * 6.1 + acc)) * exp(sin(x * 0.17)) + pow(abs(sin(x * 7.3)) + 0.5, 1.1) * log2(abs(cos(x * 2.7)) + 2.0) + asin(sin(x * 0.19)) * acos(cos(x * 0.23));
    acc = fract(acc * 1.0001 + tan(x * 0.0007));
  }
  col = vec3(fract(acc));`));
// Draws instantly and passes every check: used for approval, rollback, context-loss and XSS tests.
export const NICE_KIT = (id, { version = '1.0.0', name, extra = {}, style = {} } = {}) => {
  const k = kitOf(id, motif('  col = mix(u_bg, u_a0, 0.5 + 0.5 * lsin(1.0, uv.x));'), { format: 'motif-kit@2', extra, style });
  k.manifest.version = version; if (name) k.manifest.name = name; return k;
};
