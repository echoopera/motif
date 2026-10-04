#!/usr/bin/env node
// Build kit sources: src/<id>/kit.mjs + core.glsl  ->  kits/<id>/ (manifest.json, common.glsl, styles/*.glsl, README.md)
// usage: node tools/build.mjs [kit-id ...]   (no ids = every kit in src/)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
import { kitHelpers } from './helpers.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2);
const ids = fs.readdirSync(path.join(root, 'src')).filter(d => !d.startsWith('_') && fs.existsSync(path.join(root, 'src', d, 'kit.mjs')) && (!only.length || only.includes(d)));
const shared = n => fs.readFileSync(path.join(root, 'src/_shared', n), 'utf8');
const { merge } = kitHelpers;
// Per-style specialisation: blocks between  //@if 1 2 3  and  //@endif  are kept only for those variants (so the SDK's static
// worst-case loop analysis sees just the code a style runs), and the token VARIANT becomes the variant number.
function specialise(src, v) {
  const out = [], stack = [];
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*\/\/@if\s+([\d\s]+)$/);
    if (m) { stack.push(m[1].trim().split(/\s+/).map(Number).includes(v)); continue; }
    if (/^\s*\/\/@endif/.test(line)) { stack.pop(); continue; }
    if (stack.every(Boolean)) out.push(line);
  }
  return out.join('\n').replace(/\bVARIANT\b/g, String(v));
}

for (const id of ids) {
  const dir = path.join(root, 'src', id);
  const kit = (await import(pathToFileURL(path.join(dir, 'kit.mjs')).href + '?t=' + Date.now())).default;
  const out = path.join(root, 'kits', kit.id); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(path.join(out, 'styles'), { recursive: true });
  let core = fs.readFileSync(path.join(dir, 'core.glsl'), 'utf8');
  // Tiny-valued sliders (radii, widths) are exposed x100 / x1000 so the app shows readable numbers and usable steps;
  // the shader multiplies the uniform back so the maths is unchanged.
  const SCALE = {};
  for (const [k, p] of Object.entries(kit.params)) if (p.type === 'range' && p.max <= 0.2) SCALE[k] = p.max <= 0.02 ? 1000 : 100;
  for (const [k, sc] of Object.entries(SCALE)) core = core.replace(new RegExp('\\bp_' + k + '\\b', 'g'), `(p_${k}*${1 / sc})`);
  const rnd = x => +x.toPrecision(6);
  const scaleParam = (k, p) => { const sc = SCALE[k]; if (!sc || p.type !== 'range') return p; const q = { ...p, min: rnd(p.min * sc), max: rnd(p.max * sc), def: rnd(p.def * sc), step: rnd(Math.max((p.step ?? 0.01 / sc) * sc, 0.01)) }; if (p.randMax != null) q.randMax = rnd(p.randMax * sc); return q; };
  // LINT: pow() of a negative base is undefined in GLSL and yields NaN (black) on many GPUs; squares must use k_sq()
  if (/pow\([^;]*,\s*2(\.0)?\s*\)/.test(core)) throw new Error(kit.id + ': pow(x, 2.0) found; use k_sq(x)');
  const luminous = kit.post === 'luminous';
  const common = shared('lib.glsl');
  fs.writeFileSync(path.join(out, 'common.glsl'), common);
  if (luminous) for (const f of ['glowA', 'glowB', 'out', ...(kit.denoise ? ['denoise'] : [])]) fs.writeFileSync(path.join(out, `styles/_${f}.glsl`), shared(f + '.glsl'));
  const styles = kit.styles.map((s, i) => {
    const file = `styles/${s.id}.glsl`;
    const vn = s.variant ?? i;
    // Anti-aliasing: every style renders through a rotated-grid supersampling wrapper driven by the Quality control
    // (Live 1 sample, Balanced 2, Export 4, capped by the style's ssaa). The loop bound is the cap, so the SDK's static
    // worst-case analysis sees exactly the work the style can do.
    const ss = s.ssaa ?? kit.ssaa ?? 4;
    const wrap = ss <= 1 ? `\nvec4 motif(vec2 uv, vec2 fc) {\n  return ${kit.entry || 'scene_main'}(uv, fc, ${vn});\n}\n` : `
vec4 motif(vec2 uv, vec2 fc) {
  int want = p_quality == QUALITY_LIVE ? 1 : (p_quality == QUALITY_BALANCED ? 2 : 4);
  int n = min(want, ${ss});
  float px = 1.0 / min(u_res.x, u_res.y);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < ${ss}; i++) {
    if (i >= n) break;
    vec2 o = i == 0 ? vec2(-0.125, -0.375) : (i == 1 ? vec2(0.125, 0.375) : (i == 2 ? vec2(0.375, -0.125) : vec2(-0.375, 0.125)));
    acc += ${kit.entry || 'scene_main'}(uv + o * px, fc, ${vn}).rgb;
  }
  return vec4(acc / float(n), 1.0);
}
`;
    if (ss > 1 && !s.over?.quality && (s.drop || []).includes('quality')) throw new Error(s.id + ': quality dropped but ssaa > 1');
    fs.writeFileSync(path.join(out, file), `// ${kit.name}: ${s.name}. ${s.fingerprint}\n` + specialise(core, vn) + wrap);
    const e = { id: s.id, name: s.name, group: kit.name, tags: s.tags, blurb: s.blurb, palette: s.palette, flash: !!s.flash, cost: s.cost ?? kit.cost ?? 1.5 };
    if (luminous && kit.denoise) e.graph = { buffers: { raw: { scale: kit.sceneScale ?? 0.75 }, scene: { scale: kit.sceneScale ?? 0.75 }, glowA: { scale: 0.25 }, glowB: { scale: 0.125 } }, passes: [
      { src: file, reads: [], writes: 'raw' }, { src: 'styles/_denoise.glsl', reads: ['raw'], writes: 'scene' }, { src: 'styles/_glowA.glsl', reads: ['scene'], writes: 'glowA' },
      { src: 'styles/_glowB.glsl', reads: ['glowA'], writes: 'glowB' }, { src: 'styles/_out.glsl', reads: ['scene', 'glowA', 'glowB'], writes: 'output' }] };
    else if (luminous) e.graph = { buffers: { scene: { scale: kit.sceneScale ?? 0.75 }, glowA: { scale: 0.25 }, glowB: { scale: 0.125 } }, passes: [
      { src: file, reads: [], writes: 'scene' }, { src: 'styles/_glowA.glsl', reads: ['scene'], writes: 'glowA' },
      { src: 'styles/_glowB.glsl', reads: ['glowA'], writes: 'glowB' }, { src: 'styles/_out.glsl', reads: ['scene', 'glowA', 'glowB'], writes: 'output' }] };
    else e.passes = [{ src: file }];
    e.params = merge(kit.params, s.over); for (const k of s.drop || []) delete e.params[k]; for (const k of Object.keys(e.params)) e.params[k] = scaleParam(k, e.params[k]);
    return e;
  });
  const manifest = { format: 'motif-kit@4', id: kit.id, name: kit.name, version: kit.version || '1.0.0', author: 'Motif', description: kit.description, license: '', accent: kit.accent, common: 'common.glsl', palettes: kit.palettes, styles };
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const header = core.split('\n').filter((l, i, arr) => arr.slice(0, i + 1).every(x => x.startsWith('//'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n');
  const p0 = styles[0].params;
  const groups = {}; for (const [k, v] of Object.entries(p0)) (groups[v.group || 'Style'] ||= []).push(`${v.label} (\`${k}\`)`);
  const md = [`# ${kit.name} ${manifest.version}`, '', kit.description, '', `Format \`motif-kit@4\` - no capabilities declared - ${luminous ? 'pass graph: scene (' + (kit.sceneScale ?? 0.75) + ') > glow A (0.25) > glow B (0.125) > output (1.0)' : 'single full-resolution analytic pass'}.`, '', '## Styles', '', ...kit.styles.map((s, i) => `${i + 1}. **${s.name}** (\`${s.id}\`): ${s.fingerprint}`), '', '## Construction notes (field classes and loop rules)', '', '```', header, '```', '', '## Controls', '', ...Object.entries(groups).map(([g, l]) => `- **${g}**: ${l.join(', ')}`), '', '## Palettes', '', ...kit.palettes.map(p => `- ${p.name} (\`${p.id}\`): bg ${p.bg}, ink ${p.ink}, accents ${p.a.join(' ')}`), ''].join('\n');
  fs.writeFileSync(path.join(out, 'README.md'), md);
  console.log(`built ${kit.id}: ${styles.length} styles, ${Object.keys(styles[0].params).length} params each`);
}
