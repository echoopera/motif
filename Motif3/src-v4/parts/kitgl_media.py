# Media inputs for motif-kit@1 (SDK 1.1 / Motif 3.1). Runs inside build.py with `src` and `rep` in scope.
# Backward compatible: kits without `inputs` compile exactly as before.

# ---------- validation ----------
src = rep(src, "const KIT_LIMITS = { styles: 40, params: 16, passes: 4, fileBytes: 96 * 1024, kitBytes: 3 * 1024 * 1024, palettes: 8 };",
"""const KIT_LIMITS = { styles: 40, params: 16, passes: 4, fileBytes: 96 * 1024, kitBytes: 3 * 1024 * 1024, palettes: 8, inputs: 2 };
// Media inputs (SDK 1.1): an image or video the user attaches to a layer, sampled in GLSL as u_<id>.
const INPUT_RE = /^[a-z][a-zA-Z0-9]{0,15}$/;
const INPUT_TYPES = ['image', 'video', 'media'];
const INPUT_FITS = ['fill', 'fit', 'stretch'];
const INPUT_RESERVED = new Set(['res', 'p', 'l', 'seed', 'safe', 'bg', 'ink', 'a0', 'a1', 'a2', 'buf0', 'buf1', 'buf2', 'buf3', 'out']);
function normInputs(list, where, err) {
  if (list == null) return null;
  if (!Array.isArray(list)) { err(`${where}inputs must be an array.`); return []; }
  if (list.length > KIT_LIMITS.inputs) err(`${where}inputs: at most ${KIT_LIMITS.inputs} media inputs.`);
  const out = [], seen = new Set();
  list.slice(0, KIT_LIMITS.inputs).forEach((x, i) => {
    const w = `${where}inputs[${i}]`;
    if (!x || !INPUT_RE.test(x.id || '')) return err(`${w}.id must be camelCase letters/digits (max 16), e.g. "source".`);
    if (INPUT_RESERVED.has(String(x.id).toLowerCase())) return err(`${w}.id "${x.id}" clashes with a built-in uniform.`);
    if (seen.has(x.id)) return err(`${w}: duplicate input id "${x.id}".`); seen.add(x.id);
    const type = x.type == null ? 'media' : x.type;
    if (!INPUT_TYPES.includes(type)) return err(`${w}.type must be image, video or media.`);
    const fit = x.fit == null ? 'fill' : x.fit;
    if (!INPUT_FITS.includes(fit)) return err(`${w}.fit must be fill, fit or stretch.`);
    out.push({ id: x.id, type, label: String(x.label || x.id[0].toUpperCase() + x.id.slice(1)).slice(0, 24), fit, required: !!x.required, hint: String(x.hint || '').slice(0, 120) });
  });
  return out;
}""")
src = rep(src, "  // Styles\n  const styles = [], seen = new Set();",
"""  const kitInputs = normInputs(m.inputs, '', err);
  // Styles
  const styles = [], seen = new Set();""")
src = rep(src, "    const pal = s.palette ? `${m.id}.${s.palette}` : null;\n    if (pal && !palettes.some(p => p.id === pal)) warn(",
"""    // Media inputs: the style's own list wins, else the kit-level list. Kits written before SDK 1.1 that declare
    // \\`uniform sampler2D u_<name>;\\` themselves get an implicit input so they work unchanged.
    let inputs = normInputs(s.inputs, `${where}.`, err);
    if (inputs == null) inputs = kitInputs;
    if (inputs == null) {
      inputs = []; const text = [common || '', ...passes.map(x => x.src || '')].join('\\n'); const re = /\\buniform\\s+sampler2D\\s+u_([A-Za-z][A-Za-z0-9]{0,15})\\s*;/g; let mm;
      while ((mm = re.exec(text)) && inputs.length < KIT_LIMITS.inputs) { const id = mm[1]; if (INPUT_RESERVED.has(id.toLowerCase()) || inputs.some(q => q.id === id)) continue; inputs.push({ id, type: 'media', label: id[0].toUpperCase() + id.slice(1), fit: 'fill', required: false, hint: '', implicit: true }); }
      if (inputs.length && !styles.some(x => x.inputs.some(q => q.implicit))) warn(`Declares ${inputs.map(q => 'u_' + q.id).join(', ')} without "inputs"; treated as media input${inputs.length > 1 ? 's' : ''}. Add "inputs": [{ "id": "${inputs[0].id}", "type": "media" }] to the manifest.`);
    }
    for (const q of inputs) if (params[q.id + 'On'] || params[q.id]) warn(`${where}: param "${q.id}" shares a name with media input "${q.id}".`);
    const pal = s.palette ? `${m.id}.${s.palette}` : null;
    if (pal && !palettes.some(p => p.id === pal)) warn(""")
src = rep(src, "flash: !!s.flash, passes, params });\n  });",
               "flash: !!s.flash, passes, params, inputs });\n  });")

# ---------- GLSL: uniforms + helpers per input ----------
src = rep(src, """function buildSource(passSrc, common, params, final) {
  const head = PRELUDE + '\\n// ---- params ----\\n' + paramUniforms(params) + '\\n// ---- kit common ----\\n' + (common || '') + '\\n// ---- pass ----\\n#line 1 1\\n';""",
"""// Media inputs. The host bakes each attached image/video into a texture with the frame's aspect ratio (fit
// already applied), so frame-normalized q = fc / u_res samples it directly with no distortion.
//   u_<id>        sampler2D  premultiplied, linear light (texture unit 4 + input index)
//   u_<id>On      float      1.0 when media is attached, else 0.0 (sampling then returns transparent black)
//   u_<id>Size    vec2       the media's own pixel size
//   u_<id>Time    float      video time in seconds (0 for images)
//   m_<id>(q)     vec4       sample at frame-normalized q (0..1, origin bottom-left), clamped
//   m_<id>UV(uv)  vec4       sample at the centred uv that motif() receives
//   m_<id>Px(fc)  vec4       sample at pixel coordinates
function inputSource(inputs) {
  let s = '';
  for (const q of inputs || []) {
    const n = q.id;
    s += `uniform sampler2D u_${n};\\nuniform float u_${n}On;\\nuniform vec2 u_${n}Size;\\nuniform float u_${n}Time;\\n`;
    s += `vec4 m_${n}(vec2 q) { return texture(u_${n}, clamp(q, vec2(0.0), vec2(1.0))); }\\n`;
    s += `vec4 m_${n}Px(vec2 fc) { return m_${n}(fc / u_res); }\\n`;
    s += `vec4 m_${n}UV(vec2 uv) { return m_${n}(uv * min(u_res.x, u_res.y) / u_res + 0.5); }\\n`;
  }
  return s;
}
// Kits may declare the input uniforms themselves (SDK 1.0 style); strip those so the runtime's declarations win.
// The declaration is blanked in place, so pass-local line numbers stay correct.
function stripInputDecls(text, inputs) {
  if (!text || !inputs || !inputs.length) return text || '';
  for (const q of inputs) text = text.replace(new RegExp(`\\\\buniform\\\\s+\\\\w+\\\\s+u_${q.id}(On|Size|Time)?\\\\s*;`, 'g'), '');
  return text;
}
function buildSource(passSrc, common, params, final, inputs) {
  passSrc = stripInputDecls(passSrc, inputs); common = stripInputDecls(common, inputs);
  const head = PRELUDE + '\\n// ---- params ----\\n' + paramUniforms(params) + (inputs && inputs.length ? '\\n// ---- media inputs ----\\n' + inputSource(inputs) : '') + '\\n// ---- kit common ----\\n' + (common || '') + '\\n// ---- pass ----\\n#line 1 1\\n';""")
src = rep(src, "return { KIT_FORMAT, KIT_LIMITS, validateKit, createGlRuntime, PRELUDE, MAIN_FINAL, MAIN_PASS, buildSource, paramUniforms, RESERVED, MAX_PASSES, hexToLin };",
               "return { KIT_FORMAT, KIT_LIMITS, SDK_VERSION: '1.1.0', validateKit, createGlRuntime, PRELUDE, MAIN_FINAL, MAIN_PASS, buildSource, paramUniforms, inputSource, RESERVED, MAX_PASSES, hexToLin };")
src = rep(src, "// ---- module: kit-gl v1.0.0", "// ---- module: kit-gl v1.1.0 (media inputs)")

# ---------- app: carry inputs into style defs ----------
src = rep(src, "  const def = { passes: st.passes.map(x => ({ src: x.src, scale: x.scale })), common: kit.common, params };",
               "  const def = { passes: st.passes.map(x => ({ src: x.src, scale: x.scale })), common: kit.common, params, inputs: st.inputs || [] };")
src = rep(src, "    const def = { passes: st.passes.map(x => ({ src: x.src, scale: x.scale })), common: kit.common, params: toStyle(kit, st).params };",
               "    const def = { passes: st.passes.map(x => ({ src: x.src, scale: x.scale })), common: kit.common, params: toStyle(kit, st).params, inputs: st.inputs || [] };")
src = rep(src, "kit: kit.id, kitName: kit.name, palette: st.palette, flash: st.flash, engine: 'glsl', passes: st.passes.length, cost: st.cost || 1, params,",
               "kit: kit.id, kitName: kit.name, palette: st.palette, flash: st.flash, engine: 'glsl', passes: st.passes.length, cost: st.cost || 1, inputs: st.inputs || [], params,")
