# Engine patches: kit-gl (svg inputs, data textures), kit-sandbox (motif-kit@4), kits (registry, svg resolve).
import re
def apply(P, mods):
    # --- 0. new module, before the sandbox -------------------------------------------------------------------
    P.before('// ---- module: kit-sandbox v1.1.0', mods['kit-v4'] + '\n', 'insert kit-v4')

    P.rep("__m_kit_gl, __m_kit_sandbox, __m_text_atlas, __m_kits, __m_kit_host, __m_colour, __m_timeline, __m_audio, __m_gpu_engine, __m_compositor, __m_finish, __m_grade, __m_scopes, __m_renderer, __m_worker_shim, __m_render_worker }", "__m_kit_gl, __m_kit_v4, __m_kit_sandbox, __m_text_atlas, __m_kits, __m_kit_host, __m_colour, __m_timeline, __m_audio, __m_gpu_engine, __m_compositor, __m_finish, __m_grade, __m_scopes, __m_renderer, __m_worker_shim, __m_render_worker }", 2, label='engine exports')
    # --- 1. kit-gl: inputs ------------------------------------------------------------------------------------
    P.rep("""  if (list.length > KIT_LIMITS.inputs) err(`${where}inputs: at most ${KIT_LIMITS.inputs} media inputs.`);
  const out = [], seen = new Set();
  list.slice(0, KIT_LIMITS.inputs).forEach((x, i) => {""",
"""  // motif-kit@4 (opts.v4): up to 2 media + 2 svg + 2 text inputs. Earlier formats keep their single limit of 2.
  const cap = opts.v4 ? 6 : KIT_LIMITS.inputs;
  if (list.length > cap) err(`${where}inputs: at most ${cap} inputs.`);
  const out = [], seen = new Set(), kinds = { media: 0, svg: 0, text: 0 };
  list.slice(0, cap).forEach((x, i) => {""", label='normInputs head')
    P.rep("""    const type = x.type == null ? 'media' : x.type;
    if (type === 'text') {
      if (!opts.text) return err(`${w}.type "text" needs "format": "motif-kit@3".`);
      const t = normTextInput(x, w, err); if (t) out.push(t); return;
    }
    if (!INPUT_TYPES.includes(type)) return err(`${w}.type must be image, video or media${opts.text ? ', or text' : ''}.`);""",
"""    const type = x.type == null ? 'media' : x.type;
    if (opts.v4 && ++kinds[type === 'text' ? 'text' : type === 'svg' ? 'svg' : 'media'] > 2) return err(`${where}inputs: at most 2 ${type === 'text' ? 'text' : type === 'svg' ? 'svg' : 'media'} inputs.`);
    if (type === 'text') {
      if (!opts.text) return err(`${w}.type "text" needs "format": "motif-kit@3".`);
      const t = normTextInput(x, w, err); if (!t) return;
      if (x.sdf != null) { if (!opts.v4) return err(`${w}.sdf needs "format": "motif-kit@4".`); if (typeof x.sdf !== 'boolean') return err(`${w}.sdf must be true or false.`); const sp = x.sdfSpread == null ? 12 : Number(x.sdfSpread); if (!(sp >= 4 && sp <= 32)) return err(`${w}.sdfSpread must be 4-32 (pixels of a 1024-wide distance field).`); t.sdf = x.sdf; t.sdfSpread = sp; }
      out.push(t); return;
    }
    if (type === 'svg') {
      if (!opts.v4) return err(`${w}.type "svg" needs "format": "motif-kit@4".`);
      const s = normSvgInput(x, w, err); if (s) out.push(s); return;
    }
    if (!INPUT_TYPES.includes(type)) return err(`${w}.type must be image, video or media${opts.text ? ', text' : ''}${opts.v4 ? ' or svg' : ''}.`);""", label='normInputs types')
    P.before("// opts.text: the manifest format allows text inputs (motif-kit@3).",
"""// Svg inputs (motif-kit@4): a vector file bundled in the kit, baked by the host into a signed-distance texture. The shader reads
// it through vec_<id>(uv) (see kit-v4). Kits only ever ship the file as text; it is parsed as data, never rendered by the browser.
function normSvgInput(x, w, err) {
  if (typeof x.src !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.\\/-]{0,127}\\.svg$/i.test(x.src) || x.src.includes('..')) { err(`${w}.src must be the path of an .svg file in the kit, e.g. "assets/mark.svg".`); return null; }
  const spread = x.spread == null ? 24 : Number(x.spread), margin = x.margin == null ? 0.08 : Number(x.margin);
  if (!(spread >= 8 && spread <= 64)) { err(`${w}.spread must be 8-64 (pixels of distance stored around the edge).`); return null; }
  if (!(margin >= 0 && margin <= 0.4)) { err(`${w}.margin must be 0-0.4 (fraction of the frame kept clear).`); return null; }
  for (const k of ['fit', 'required']) if (x[k] != null) { err(`${w}.${k} does not apply to an svg input.`); return null; }
  return { id: x.id, type: 'svg', label: String(x.label || x.id[0].toUpperCase() + x.id.slice(1)).slice(0, 24), hint: String(x.hint || '').slice(0, 120), src: x.src, spread, margin };
}
""", label='normSvgInput')

    P.rep("SDK_VERSION: '3.0.0',", "SDK_VERSION: '4.0.0',")
    P.rep("RESERVED_KITS };\n\n})();", "RESERVED_KITS, INPUT_FITS };\n\n})();", label='kit-gl exports')
    # --- 2. kit-gl: GLSL declarations, uploads, uniforms -----------------------------------------------------
    P.rep("""    s += `uniform sampler2D u_${n};\\nuniform float u_${n}On;\\nuniform vec2 u_${n}Size;\\nuniform float u_${n}Time;\\n`;
    s += `vec4 m_${n}(vec2 q)""",
"""    s += `uniform sampler2D u_${n};\\nuniform float u_${n}On;\\nuniform vec2 u_${n}Size;\\nuniform float u_${n}Time;\\n`;
    if (q.type === 'svg' || q.type === 'sdf') s += `uniform float u_${n}Spread; // distance stored around the edge, in uv units\\n`;
    s += `vec4 m_${n}(vec2 q)""", label='inputSource svg')
    P.rep("u_${q.id}(On|Size|Time)?\\\\s*;", "u_${q.id}(On|Size|Time|Spread)?\\\\s*;", label='stripInputDecls')
    P.rep("""      if (U['u_' + q.id + 'Time']) gl.uniform1f(U['u_' + q.id + 'Time'], m ? m.time || 0 : 0);
      if (!loc) return;""",
"""      if (U['u_' + q.id + 'Time']) gl.uniform1f(U['u_' + q.id + 'Time'], m ? m.time || 0 : 0);
      if (U['u_' + q.id + 'Spread']) gl.uniform1f(U['u_' + q.id + 'Spread'], m && m.spread ? m.spread / Math.max(1, Math.min(m.w, m.h)) : 0);
      if (!loc) return;""", label='Spread uniform')
    P.rep("""        if (U['u_' + q.id + 'Time']) gl.uniform1f(U['u_' + q.id + 'Time'], m ? m.time || 0 : 0);
        if (!loc) return;
        // An SDK 1.0 kit""", """        if (U['u_' + q.id + 'Time']) gl.uniform1f(U['u_' + q.id + 'Time'], m ? m.time || 0 : 0);
        if (U['u_' + q.id + 'Spread']) gl.uniform1f(U['u_' + q.id + 'Spread'], m && m.spread ? m.spread / Math.max(1, Math.min(m.w, m.h)) : 0);
        if (!loc) return;
        // An SDK 1.0 kit""", label='Spread uniform (draw)')
    a = P.t.index('  function mediaTexture(m) {'); b = P.t.index('  function init() {', a)
    P.t = P.t[:a] + """  function mediaTexture(m) {
    const key = m.key || m.canvas;
    let e = mediaTex.get(key);
    if (e) { mediaTex.delete(key); mediaTex.set(key, e); } // true LRU, including unchanged frames
    const lin = !!m.linear || !!m.data, w = m.data ? m.w : m.canvas.width, h = m.data ? m.h : m.canvas.height;
    if (e && e.rev === m.rev && e.w === w && e.h === h && e.lin === lin) return e.tex;
    if (!e) {
      e = { tex: gl.createTexture(), rev: -1 }; mediaTex.set(key, e);
      if (mediaTex.size > 24) { const [k0, e0] = mediaTex.entries().next().value; gl.deleteTexture(e0.tex); mediaTex.delete(k0); }
    }
    if (e.w != null && (e.w !== w || e.h !== h || e.lin !== lin)) { gl.deleteTexture(e.tex); e.tex = gl.createTexture(); e.w = null; }
    gl.activeTexture(gl.TEXTURE0 + SCRATCH_UNIT); gl.bindTexture(gl.TEXTURE_2D, e.tex);
    if (e.w == null) {
      // m.data (motif-kit@4 svg input): a baked distance field, raw RGBA8, bilinear, no mipmaps.
      gl.texStorage2D(gl.TEXTURE_2D, m.data ? 1 : 1 + Math.floor(Math.log2(Math.max(w, h))), lin ? gl.RGBA8 : gl.SRGB8_ALPHA8, w, h);
      e.w = w; e.h = h; e.lin = lin;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, m.data ? gl.LINEAR : gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    if (m.data) {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      try { gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, m.data); } finally { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); }
    } else {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      try { gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, m.canvas); }
      finally { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); }
      gl.generateMipmap(gl.TEXTURE_2D); // Preserve minification quality, including rotated/scaled media.
    }
    e.rev = m.rev; uploads++; return e.tex;
  }
""" + P.t[b:]
    P.rep("  const MEDIA_UNIT = 4;", "  const MEDIA_UNIT = 4, SCRATCH_UNIT = 15; // units 0-3: earlier passes; 4-12: the entry's inputs; 15: uploads", label='SCRATCH_UNIT')

    # --- 3. sandbox: format @4 --------------------------------------------------------------------------------
    P.rep("KIT_FORMAT_3 = 'motif-kit@3', FORMATS = [KIT_FORMAT_1, KIT_FORMAT_2, KIT_FORMAT_3];", "KIT_FORMAT_3 = 'motif-kit@3', KIT_FORMAT_4 = 'motif-kit@4', FORMATS = [KIT_FORMAT_1, KIT_FORMAT_2, KIT_FORMAT_3, KIT_FORMAT_4];")
    P.rep("const KG = __m_kit_gl;\nconst KIT_FORMAT_1", "const KG = __m_kit_gl, KV = __m_kit_v4;\nconst KIT_FORMAT_1")
    P.rep("  text: 'Draws text you type into the layer, rasterized with fonts on this device (no font files or text leave it).',\n",
          "  text: 'Draws text you type into the layer, rasterized with fonts on this device (no font files or text leave it).',\n  vector: 'Draws vector shapes from SVG files bundled in the kit, converted to distance fields on this device (no network, no scripts).',\n")
    P.rep("if (typeof t !== 'string' || !/\\.(glsl|json|md|txt)$/i.test(n)) { errors.push(`${n}: only GLSL, JSON, Markdown and text files can be in a kit; nothing in a kit is ever run as code.`); continue; }",
          "if (typeof t !== 'string' || !/\\.(glsl|json|md|txt|svg)$/i.test(n)) { errors.push(`${n}: only GLSL, JSON, SVG, Markdown and text files can be in a kit; nothing in a kit is ever run as code.`); continue; }")
    P.rep("  const v3 = m.format === KIT_FORMAT_3;\n", "  const v4 = m.format === KIT_FORMAT_4, v3 = v4 || m.format === KIT_FORMAT_3;\n")
    P.rep("known = Object.keys(CAPABILITIES).filter(c => v3 || c !== 'text');", "known = Object.keys(CAPABILITIES).filter(c => (v3 || c !== 'text') && (v4 || c !== 'vector'));")
    P.rep("    if (c === 'text' && !v3) { err('capability \"text\" needs \"format\": \"motif-kit@3\".'); continue; }\n",
          "    if (c === 'text' && !v3) { err('capability \"text\" needs \"format\": \"motif-kit@3\".'); continue; }\n    if (c === 'vector' && !v4) { err('capability \"vector\" needs \"format\": \"motif-kit@4\".'); continue; }\n")
    P.rep("const kitInputs = KG.normInputs(m.inputs, '', err, { text: v3 });", "const kitInputs = KG.normInputs(m.inputs, '', err, { text: v3, v4 });")
    P.rep("      const inputs = KG.resolveInputs(s, where, kitInputs, [common || '', ...passes.map(x => x.src || '')].join('\\n'), [...out.style, ...out.effect, ...out.transition], params, err, warn, { text: v3 });",
"""      let inputs = KG.resolveInputs(s, where, kitInputs, [common || '', ...passes.map(x => x.src || '')].join('\\n'), [...out.style, ...out.effect, ...out.transition], params, err, warn, { text: v3, v4 });
      // motif-kit@4: layer stack + generated controls for the stack layers and svg inputs; svg files travel inside the input.
      let stack = null; const blocks = [];
      if (v4 && kind === 'style') {
        if (s.stack != null) {
          const st = s.stack, sw = `${where}.stack`;
          if (!st || typeof st !== 'object' || Array.isArray(st)) err(`${sw} must be an object like { "layers": 3 }.`);
          else {
            const n = st.layers == null ? 3 : st.layers, sid = st.id == null ? 'layer' : String(st.id), fit = st.fit == null ? 'fill' : st.fit;
            if (!Number.isInteger(n) || n < 1 || n > KV.LIMITS.layers) err(`${sw}.layers must be 1-${KV.LIMITS.layers}.`);
            else if (!/^[a-z][a-zA-Z0-9]{0,9}$/.test(sid)) err(`${sw}.id must be camelCase letters/digits (max 10).`);
            else if (!KG.INPUT_FITS.includes(fit)) err(`${sw}.fit must be fill, fit or stretch.`);
            else {
              const defs = Array.isArray(st.defaults) ? st.defaults : [], labels = Array.isArray(st.labels) ? st.labels : [];
              stack = { id: sid, layers: n, fit, ids: [], labels: [] };
              for (let i = 1; i <= n; i++) {
                const d = defs[i - 1] || {}, id = sid + i;
                if (d.blend != null && !KV.BLEND_MODES.includes(d.blend)) { err(`${sw}.defaults[${i - 1}].blend must be one of ${KV.BLEND_MODES.join(', ')}.`); continue; }
                if (inputs.some(q => q.id === id)) { err(`${sw}: input "${id}" already exists.`); continue; }
                const label = String(labels[i - 1] || `Layer ${i}`).slice(0, 20);
                inputs = [...inputs, { id, type: 'media', label, hint: '', fit, required: false, stack: i, blend: d.blend || 'normal' }];
                stack.ids.push(id); stack.labels.push(label);
              }
            }
          }
        }
        for (const q of inputs) {
          if (q.type === 'svg') {
            const t = fileText(q.src); if (t == null) { err(`${where}: input "${q.id}" src "${q.src}" is not in the package.`); continue; }
            const pr = KV.svgProblem(t); if (pr) { err(`${where}: ${q.src}: ${pr}`); continue; }
            try { const doc = KV.parseSvg(t); if (!doc.shapes.length) warn(`${where}: ${q.src} has no shapes Motif can draw (paths, rects, circles, ellipses, lines, polylines and polygons; no text, gradients or <use>).`); } catch (x) { err(`${where}: ${q.src}: ${x.message}`); continue; }
            inputs = inputs.map(x => x === q ? { ...q, svg: t } : x); q.svg = t;
          }
          const kk = q.stack ? 'layer' : q.type === 'svg' ? 'svg' : null; if (!kk) continue;
          const gp = KV.blockParams(q, kk, q.stack ? { i: q.stack, blend: q.blend } : null); let bad = false;
          for (const key of Object.keys(gp)) { if (key.length > 24) { err(`${where}: input id "${q.id}" is too long for its generated controls (${key}).`); bad = true; break; } if (params[key]) { err(`${where}: param "${key}" clashes with the generated controls of input "${q.id}".`); bad = true; break; } }
          if (bad) continue;
          Object.assign(params, gp); blocks.push({ id: q.id, kind: kk, label: q.label, group: Object.values(gp)[0].group });
        }
        for (const q of inputs.filter(x => x.type === 'text' && x.sdf)) inputs = [...inputs, { id: q.id + 'Sdf', type: 'sdf', label: q.label + ' distance', hint: '', from: q.id, spread: q.sdfSpread || 12 }];
        if (Object.keys(params).length > KV.LIMITS.uniforms) err(`${where}: at most ${KV.LIMITS.uniforms} uniforms in total (generated controls included).`);
        if (inputs.length > KV.LIMITS.samplers) err(`${where}: at most ${KV.LIMITS.samplers} textures per style.`);
      } else if (!v4 && s.stack != null) err(`${where}: "stack" needs "format": "motif-kit@4".`);""")
    P.rep("      const e = { ...base, cost, flash: !!s.flash, passes, params, inputs };",
          "      const e = { ...base, cost, flash: !!s.flash, passes, params, inputs, ...(stack ? { stack } : {}), ...(blocks.length ? { blocks } : {}) };")
    # kit object: format, sequences
    P.rep("  const ok = errors.length === 0;\n  const fmt = v3 ? KIT_FORMAT_3 : KIT_FORMAT_2;\n",
"""  // Sequences (motif-kit@4): cue lists that call this kit's styles (or installed styles of other kits) at points of the loop.
  const sequences = [], sdeps = new Set(), localIds = new Set(out.style.map(x => x.localId));
  if (m.sequences != null && !v4) err('"sequences" needs "format": "motif-kit@4".');
  else if (m.sequences != null && !Array.isArray(m.sequences)) err('sequences must be an array.');
  else if (v4) (m.sequences || []).slice(0, KV.SEQ.sequences).forEach((e, i) => {
    const w = `sequences[${i}]`; let raw = e;
    if (e && typeof e.file === 'string') { const t = fileText(e.file); if (t == null) return err(`${w}: file "${e.file}" is not in the package.`); try { raw = { ...JSON.parse(t), ...(e.id ? { id: e.id } : {}), ...(e.name ? { name: e.name } : {}) }; } catch (x) { return err(`${w}: ${e.file} is not valid JSON.`); } }
    const r = KV.validateSequence(raw, { kitId: m.id, local: localIds });
    r.warnings.forEach(x => warn(`${w} (${raw && raw.id}): ${x}`)); r.errors.forEach(x => err(`${w} (${raw && raw.id}): ${x}`));
    if (r.ok) { if (sequences.some(x => x.id === r.seq.id)) return err(`${w}: duplicate sequence id "${r.seq.id}".`); sequences.push(r.seq); r.deps.forEach(d => sdeps.add(d)); }
  });
  const ok = errors.length === 0;
  const fmt = v4 ? KIT_FORMAT_4 : v3 ? KIT_FORMAT_3 : KIT_FORMAT_2;
""")
    P.rep("exporters: out.exporter, migration: null } : null };", "exporters: out.exporter, ...(v4 ? { sequences, requires: [...sdeps] } : {}), migration: null } : null };")
    # dispatch
    P.rep("else if (manifest.format === KIT_FORMAT_2 || manifest.format === KIT_FORMAT_3) v = validateV2(manifest, files);", "else if (manifest.format === KIT_FORMAT_2 || manifest.format === KIT_FORMAT_3 || manifest.format === KIT_FORMAT_4) v = validateV2(manifest, files);")
    P.rep("const e = [`format must be \"${KIT_FORMAT_1}\", \"${KIT_FORMAT_2}\" or \"${KIT_FORMAT_3}\" (got ${JSON.stringify(manifest.format)}).`];", "const e = [`format must be \"${KIT_FORMAT_1}\", \"${KIT_FORMAT_2}\", \"${KIT_FORMAT_3}\" or \"${KIT_FORMAT_4}\" (got ${JSON.stringify(manifest.format)}).`];")
    # runtime extra
    P.rep("""function runtimeOf(kit, e) {
  const caps = kit.capabilities || [];
  if (!e.graph) { const extra = runtimeDecls(e.kind, caps, null); return extra ? { extra } : null; }
  return { graph: { ...e.graph, passes: e.graph.passes.map(p => ({ src: p.src, file: p.file, reads: p.reads, writes: p.writes, iterate: p.iterate, extra: runtimeDecls(e.kind, caps, p.reads) })) } };""",
"""function runtimeOf(kit, e) {
  const caps = kit.capabilities || [], v4 = kit.format === KIT_FORMAT_4 && e.kind === 'style' ? KV.extraFor(e.inputs) : '';
  if (!e.graph) { const extra = runtimeDecls(e.kind, caps, null) + v4; return extra ? { extra } : null; }
  return { graph: { ...e.graph, passes: e.graph.passes.map(p => ({ src: p.src, file: p.file, reads: p.reads, writes: p.writes, iterate: p.iterate, extra: runtimeDecls(e.kind, caps, p.reads) + v4 })) } };""", label='runtimeOf')
    # capability checks
    P.rep("if (e.inputs.some(q => q.type !== 'text') && kit.sourceFormat !== KIT_FORMAT_1 && !kit.capabilities.includes('media'))", "if (e.inputs.some(q => q.type !== 'text' && q.type !== 'svg' && q.type !== 'sdf') && kit.sourceFormat !== KIT_FORMAT_1 && !kit.capabilities.includes('media'))")
    P.rep("    if (e.inputs.some(q => q.type === 'text') && !kit.capabilities.includes('text')) errors.push(`${e.localId}: has a text input but the kit does not declare the \"text\" capability.`);\n",
          "    if (e.inputs.some(q => q.type === 'text') && !kit.capabilities.includes('text')) errors.push(`${e.localId}: has a text input but the kit does not declare the \"text\" capability.`);\n    if (e.inputs.some(q => q.type === 'svg') && !kit.capabilities.includes('vector')) errors.push(`${e.localId}: has an svg input but the kit does not declare the \"vector\" capability.`);\n")
    P.rep("c === 'media' ? renderables(kit).some(e => e.inputs.some(q => q.type !== 'text')) : c === 'text' ? renderables(kit).some(e => e.inputs.some(q => q.type === 'text')) :",
          "c === 'media' ? renderables(kit).some(e => e.inputs.some(q => q.type !== 'text' && q.type !== 'svg' && q.type !== 'sdf')) : c === 'text' ? renderables(kit).some(e => e.inputs.some(q => q.type === 'text')) : c === 'vector' ? renderables(kit).some(e => e.inputs.some(q => q.type === 'svg')) :")
    P.rep("return { KIT_FORMAT_1, KIT_FORMAT_2, KIT_FORMAT_3, FORMATS,", "return { KIT_FORMAT_1, KIT_FORMAT_2, KIT_FORMAT_3, KIT_FORMAT_4, FORMATS,")
    P.rep("if (e.kind !== 'style' && inputs.some(q => q.type === 'text'))", "if (kind !== 'style' && inputs.some(q => q.type === 'text'))") if False else None

    # --- 4. kits registry -------------------------------------------------------------------------------------
    P.rep("const APP_KIT_API = 3; // motif-kit@3 (reads motif-kit@1 and @2 unchanged)", "const APP_KIT_API = 4; // motif-kit@4 (reads motif-kit@1, @2 and @3 unchanged)")
    P.rep("KIT_FORMAT: SB.KIT_FORMAT_3,", "KIT_FORMAT: SB.KIT_FORMAT_4,")
    P.rep("const TA = __m_text_atlas;  // motif-kit@3 text inputs: the host-built glyph atlas", "const TA = __m_text_atlas;  // motif-kit@3 text inputs: the host-built glyph atlas\nconst KV = __m_kit_v4;      // motif-kit@4: svg inputs, layer stacks, sequences")
    P.rep("""      if (hasText) { const tm = TA.resolve(st.inputs, S); if (tm) u.media = { ...(u.media || {}), ...tm }; }""",
"""      if (hasText) { const tm = TA.resolve(st.inputs, S); if (tm) u.media = { ...(u.media || {}), ...tm }; }
      // Svg inputs (motif-kit@4): baked engine-side into a distance field from the file the kit shipped (cached by content and size).
      if (hasSvg) { const vm = KV.resolveSvg(st.inputs, S); if (vm) u.media = { ...(u.media || {}), ...vm }; }
      if (hasSdf && u.media) { const dm = KV.resolveTextSdf(st.inputs, u.media, S); if (dm) u.media = { ...u.media, ...dm }; }""")
    P.rep("  const hasText = (st.inputs || []).some(q => q.type === 'text');\n", "  const hasText = (st.inputs || []).some(q => q.type === 'text'), hasSvg = (st.inputs || []).some(q => q.type === 'svg'), hasSdf = (st.inputs || []).some(q => q.type === 'sdf');\n")
    # media-resolver must skip text/svg inputs: it already does (S.media lacks them); also fix the guard so svg-only styles don't call it
    P.rep("media: st.inputs && st.inputs.length && mediaResolver && S.media ? mediaResolver(st.inputs, S, { preview }) : null,", "media: st.inputs && st.inputs.some(q => q.type !== 'text' && q.type !== 'svg' && q.type !== 'sdf') && mediaResolver && S.media ? mediaResolver(st.inputs.filter(q => q.type !== 'text' && q.type !== 'svg' && q.type !== 'sdf'), S, { preview }) : null,")
    P.rep("else if (/\\.(glsl|json|md|txt)$/i.test(rel)) files[rel] = fflate.strFromU8(un[n]);", "else if (/\\.(glsl|json|md|txt|svg)$/i.test(rel)) files[rel] = fflate.strFromU8(un[n]);")
    # canary: bake the svg inputs for a realistic cost
    P.rep("  for (const q of TA.textInputs(e.inputs)) (media || (media = {}))[q.id] = TA.defaultAtlas(q, 1024);\n",
          "  for (const q of TA.textInputs(e.inputs)) (media || (media = {}))[q.id] = TA.defaultAtlas(q, 1024);\n  const sv = __m_kit_v4.resolveSvg(e.inputs, { w: 1024, h: 576 }); if (sv) media = { ...(media || {}), ...sv };\n  const sd = media && __m_kit_v4.resolveTextSdf(e.inputs, media, { w: 1024, h: 576 }); if (sd) media = { ...media, ...sd };\n")
