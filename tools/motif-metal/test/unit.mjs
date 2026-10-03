import test from 'node:test';
import assert from 'node:assert/strict';
import { translate, lintMsl } from '../lib/translate.mjs';

const t = src => { const warns = []; const r = translate(src, { warn: w => warns.push(w) }); return { ...r, warns }; };
const squash = x => x.replace(/\s+/g, ' ').replace(/, /g, ',').trim();   // compare modulo spacing after commas
const member = src => squash(t(src).members);

test('types, constructors and swizzles', () => {
  assert.equal(member('vec3 f(vec2 p) { return vec3(p.xy, 1.0); }'), 'float3 f(float2 p) { return float3(p.xy,1.0); }');
  assert.match(member('ivec2 g(uvec3 a, bvec4 b) { return ivec2(0); }'), /^int2 g\(uint3 a,bool4 b\)/);
});

test('GLSL maths that Metal spells differently', () => {
  const m = member('float f(float a, vec3 v) { return mod(a, 2.0) + atan(v.y, v.x) + atan(a) + inversesqrt(a) + dFdy(a) + float(floatBitsToUint(a)); }');
  assert.match(m, /M_mod\(a,2\.0\)/);
  assert.match(m, /atan2\(v\.y,v\.x\)/);
  assert.match(m, /\+ atan\(a\)/);
  assert.match(m, /rsqrt\(a\)/);
  assert.match(m, /M_dFdy\(a\)/);                 // fc.y is flipped, so dFdy changes sign
  for (const fn of ['min', 'max', 'clamp', 'mix', 'step', 'smoothstep']) assert.match(member(`float f(float a){ return ${fn}(a, a, a); }`), new RegExp(`M_${fn}\\(`));
});

test('matrices: scalar constructor becomes columns', () => {
  assert.match(member('mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }'), /float2x2\(float2\(c,s\),float2\( ?-s,c\)\)/);
  assert.match(member('mat3 m() { return mat3(1.0); }'), /float3x3\(1\.0\)/);
});

test('arrays become metal::array: declarations, constructors, parameters, assignment', () => {
  const m = member('int f(int w[4]) { int c[3] = int[3](1, 2, 3); c = int[3](4, 5, 6); const float k[2] = float[](1.0, 2.0); return w[0] + c[1]; }');
  assert.match(m, /int f\(array<int,4> w\)/);
  assert.match(m, /array<int,3> c = array<int,3>\{1,2,3\}/);
  assert.match(m, /c = array<int,3>\{4,5,6\}/);
  assert.match(m, /const array<float,2> k = array<float,2>\{1\.0,2\.0\}/);
});

test('out / inout parameters are thread references; in is dropped', () => {
  assert.match(member('void f(in float a, out vec2 b, inout float c) { b = vec2(a); }'), /^void f\(float a,thread float2 &b,thread float &c\)/);
  assert.match(t('#define STUB float g(int i, out float s) { s = 1.0; return 0.0; }').hoisted, /thread float &s/);
});

test('global const and structs are hoisted; mutable globals and uniforms become members', () => {
  const r = t('struct Hit { float d; vec3 n; };\nconst float K = 3.0;\nconst int T[2] = int[2](1, 2);\nfloat state = 1.0;\nuniform float p_gain;\nfloat f() { return K * p_gain + state; }');
  assert.match(r.hoisted, /struct Hit \{ float d; float3 n; \};/);
  assert.match(r.hoisted, /constant float K = 3\.0;/);
  assert.match(squash(r.hoisted), /constant array<int,2> T = array<int,2>\{1,2\};/);
  assert.match(r.members, /float state = 1\.0;/);
  assert.match(r.members, /float p_gain;/);
  assert.doesNotMatch(r.members, /struct Hit|const float K/);
});

test('forward declarations are dropped (members need none); #version/precision/#extension are web-only', () => {
  const r = t('#version 300 es\nprecision highp float;\n#extension GL_OES_foo : enable\nfloat f(float x);\nfloat g() { return f(1.0); }\nfloat f(float x) { return x; }');
  assert.doesNotMatch(r.members + r.hoisted, /version|precision|extension/);
  assert.equal((r.members.match(/float f\(/g) || []).length, 1);
});

test('textures: texture/texelFetch use GL orientation helpers; sampler2D params become MTex', () => {
  const m = member('vec4 f(sampler2D s, vec2 uv) { return texture(s, uv) + texelFetch(s, ivec2(1, 2), 0) + textureLod(s, uv, 1.0); }');
  assert.match(m, /f\(MTex s,float2 uv\)/);
  assert.match(m, /M_tex\(s,uv\)/);
  assert.match(m, /M_texelFetch\(s,int2\(1,2\),0\)/);
  assert.match(m, /M_texLod\(/);
});

test('vector == and != compare whole vectors (all / any), scalars are untouched', () => {
  const m = member('bool f(ivec2 a, ivec2 b, float x, float y, vec3 v) { if (a == b) return true; if (x == y) return false; if (v.xy != b) return true; return a != b; }');
  assert.match(m, /M_eq\(a,b\)/);
  assert.match(m, /M_ne\(v\.xy,b\)/);
  assert.match(m, /M_ne\(a,b\)/);
  assert.match(m, /x == y/);
});

test('identifiers legal in GLSL but reserved in C++/MSL are renamed; swizzles are not', () => {
  const m = member('float f(float half, vec2 v) { float new = half + v.x; return new; }');
  assert.match(m, /float half_/);
  assert.match(m, /float new_ = half_ \+ v\.x/);
});

test('macros are hoisted with translated bodies; conditionals are mirrored', () => {
  const r = t('#define SQ(x) ((x)*(x))\n#define V vec3(1.0)\n#ifdef FOO\nfloat f() { return 1.0; }\n#endif');
  assert.match(r.hoisted, /#define V float3\(1\.0\)/);
  assert.match(r.hoisted, /#ifdef FOO\s+#endif/);
  assert.match(r.members, /#ifdef FOO[\s\S]*float f\(\)[\s\S]*#endif/);
});

test('lint finds GLSL leftovers', () => {
  assert.deepEqual(lintMsl('float4 x; // vec3 in comment\n'), []);
  assert.ok(lintMsl('vec3 x;').length > 0);
  assert.ok(lintMsl('float4 f( { }').length > 0);
});

test('mutable globals without an initialiser start at zero, like on web drivers', () => {
  const m = member('vec3 G_dom, G_acc; float G_gs = 1.0; int n; bool b; mat2 m; int a[3]; float f() { return G_gs; }');
  assert.match(m, /float3 G_dom = float3\(0\),G_acc = float3\(0\);/);
  assert.match(m, /float G_gs = 1\.0;/);
  assert.match(m, /int n = 0;/);
  assert.match(m, /bool b = false;/);
  assert.match(m, /array<int,3> a = \{\};/);
});

test('not(bvec) becomes !, other reserved words are renamed', () => {
  assert.match(member('bool f(bvec2 b) { return all(not(b)); }'), /all\(!\(b\)\)/);
});
