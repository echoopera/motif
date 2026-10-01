// ---- module: text-atlas v1.0.0 (motif-kit@3 text inputs: typography state, font registry, atlas rasterizer)
const __m_text_atlas = (() => {
// text-atlas — turns a layer's editable text into ONE glyph-coverage texture per text input. Engine-side: it never
// touches the DOM at load and draws on OffscreenCanvas, so the render Worker builds the same atlas from the same
// posted project as the page (pixel parity), and exports rebuild it at their own resolution.
//
// State (on the layer, sanitised by timeline):  layer.text[inputId] = { lines: { <lineId>: { text, font: { family,
// weight, source? }, size, tracking, align } } }. `source` names an imported font file (content hash) registered with
// registerFont(); `family` is what the user sees and the next fallback.
//
// Atlas contract (documented for kit authors in sdk/motif-kit-sdk/docs/text-inputs.md):
//   · width W = smallest of 1024 / 2048 / 4096 px that covers the frame width; one band per declared line, each W/aspect
//     tall, line 1 in the TOP band (sampled with origin bottom-left, like every Motif texture).
//   · each line is drawn CENTRED in its band (horizontally per `align`, vertically on its cap height) and
//     UNTRANSFORMED: no position, rotation or scale. The kit's shader applies those exactly once.
//   · `size` is the em size as a fraction of the band height; a line wider than the band (minus a 3 % margin each side)
//     or taller than it (minus 12 % top and bottom) is scaled down to fit. `tracking` is extra spacing in em.
//   · alpha format: premultiplied white. Every glyph (emoji too) is reduced to coverage, so rgb == a. Transparent
//     elsewhere, including a gutter around every band, so mipmaps never bleed between lines.
//   · fallback: a family that is not installed or not loaded falls back to the app's UI fonts, then system sans.
//     fontStatus() reports it so the inspector can say so.
// Rebuilds happen only when the text state, the fonts' load state (epoch) or the atlas size changes; motion and colour
// never rebuild it. stats().builds counts rebuilds (tests assert on it).
const KG = __m_kit_gl, TX = KG.TEXT;
const TIERS = [1024, 2048, 4096];
const FIELDS = ['text', 'font', 'size', 'tracking', 'align'];
const FALLBACK = '"Instrument Sans", "Anybody", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const FALLBACK_NAMES = ['Instrument Sans', 'Anybody', 'system-ui', 'sans-serif'];
const FONT_ID_RE = /^f_[a-f0-9]{8,40}$/;
const PATH_RE = /^([a-z][a-zA-Z0-9]{0,15})\.([a-z][a-zA-Z0-9]{0,15})\.(text|font|size|tracking|align)$/;
const CTRL_G = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
const clampN = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

// ---------- sanitizers (pure; shared by timeline, the inspector and the rasterizer) ----------
// One line of text: no control characters or line breaks, at most `max` UTF-16 units, never a split surrogate pair.
// Work is bounded by `max` whatever the input size.
function cleanText(v, max) {
  max = Math.max(1, Math.min(TX.chars, Math.round(Number(max) || TX.defChars)));
  let s = typeof v === 'string' ? v : v == null ? '' : String(v);
  s = s.slice(0, max * 2 + 8).replace(/[\r\n\t]+/g, ' ').replace(CTRL_G, '').slice(0, max);
  if (/[\uD800-\uDBFF]$/.test(s)) s = s.slice(0, -1);
  return s;
}
function cleanFamily(v, d) {
  const s = typeof v === 'string' && v.length <= TX.family * 4 ? v.trim() : ''; // an overlong name is rejected, never truncated into another family
  return s && KG.FAMILY_RE.test(s) ? s : d;
}
function cleanFont(f, def) {
  def = def || { family: TX.defFamily, weight: TX.defWeight };
  if (!f || typeof f !== 'object' || Array.isArray(f)) return { family: def.family, weight: def.weight };
  const w = Math.round(clampN(f.weight, 100, 900, def.weight) / 100) * 100;
  const out = { family: cleanFamily(f.family, def.family), weight: w };
  if (typeof f.source === 'string' && FONT_ID_RE.test(f.source)) out.source = f.source;
  return out;
}
// spec: a normalized line from the manifest (KG.normTextLine) or null (structural defaults).
function lineSpec(spec) { return spec || { def: '', maxLength: TX.defChars, font: { family: TX.defFamily, weight: TX.defWeight }, size: TX.defSize, tracking: TX.defTracking, align: 'center' }; }
function cleanLine(v, spec) {
  const s = lineSpec(spec); v = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  return {
    text: cleanText(v.text == null ? s.def : v.text, s.maxLength),
    font: cleanFont(v.font, s.font),
    size: clampN(v.size, TX.size[0], TX.size[1], s.size),
    tracking: clampN(v.tracking, TX.tracking[0], TX.tracking[1], s.tracking),
    align: TX.aligns.includes(v.align) ? v.align : s.align,
  };
}
const textInputs = inputs => (Array.isArray(inputs) ? inputs : []).filter(q => q && q.type === 'text' && Array.isArray(q.lines));
// A layer's text block against its style's text inputs: declared inputs and lines only (defaults filled in), so
// switching to a style of another kit drops the old text and every stored value is bounded. Returns null when empty.
function sanitizeState(raw, inputs) {
  const qs = textInputs(inputs); if (!qs.length) return null;
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}, out = {};
  for (const q of qs) {
    const r = Object.prototype.hasOwnProperty.call(src, q.id) && src[q.id] && typeof src[q.id] === 'object' ? src[q.id] : {};
    const rl = r.lines && typeof r.lines === 'object' && !Array.isArray(r.lines) ? r.lines : {};
    const lines = {};
    for (const l of q.lines) lines[l.id] = cleanLine(Object.prototype.hasOwnProperty.call(rl, l.id) ? rl[l.id] : null, l);
    out[q.id] = { lines };
  }
  return out;
}
function defaults(inputs) { return sanitizeState(null, inputs); }

// ---------- value paths: L:<layer>:t:<inputId>.<lineId>.<field> ----------
function parseKey(key) { const m = PATH_RE.exec(String(key || '')); return m ? { input: m[1], line: m[2], field: m[3] } : null; }
function lineOf(inputs, k) { const q = textInputs(inputs).find(x => x.id === k.input); const l = q && q.lines.find(x => x.id === k.line); return l ? { q, l } : null; }
const ALIGN_OPTS = [{ v: 'left', l: 'Left' }, { v: 'center', l: 'Centre' }, { v: 'right', l: 'Right' }];
// Schema of one field, in the engine's parameter model (engine-core sanitize honours `clean`). Strings, fonts and
// alignment hold between keys; size and tracking interpolate like any other range.
function fieldSchema(inputs, key) {
  const k = parseKey(key); if (!k) return null; const hit = lineOf(inputs, k); if (!hit) return null;
  const l = hit.l, base = { group: hit.q.label, line: l.label, mutate: 0 };
  if (k.field === 'text') return { ...base, type: 'text', label: 'Text', def: l.def, max: l.maxLength, clean: v => cleanText(v, l.maxLength) };
  if (k.field === 'font') return { ...base, type: 'font', label: 'Font', def: { ...l.font }, clean: v => cleanFont(v, l.font) };
  if (k.field === 'size') return { ...base, type: 'range', label: 'Size', min: TX.size[0], max: TX.size[1], def: l.size, step: 0.01 };
  if (k.field === 'tracking') return { ...base, type: 'range', label: 'Tracking', min: TX.tracking[0], max: TX.tracking[1], def: l.tracking, step: 0.005, unit: ' em' };
  return { ...base, type: 'select', label: 'Align', options: ALIGN_OPTS, def: l.align };
}
function paths(inputs) { const out = []; for (const q of textInputs(inputs)) for (const l of q.lines) for (const f of FIELDS) out.push(`${q.id}.${l.id}.${f}`); return out; }
function getField(state, key) { const k = parseKey(key); const l = k && state && state[k.input] && state[k.input].lines && state[k.input].lines[k.line]; return l ? l[k.field] : undefined; }
// Writes into `state` (a layer's text block, already cloned by the caller). Missing input/line blocks are created.
function setField(state, key, v) {
  const k = parseKey(key); if (!k || !state) return state;
  const b = state[k.input] || (state[k.input] = { lines: {} }); b.lines = b.lines || {};
  const l = b.lines[k.line] || (b.lines[k.line] = {}); l[k.field] = v; return state;
}

// ---------- fonts ----------
const listeners = new Set();
let epoch = 0, builds = 0;
const emit = ev => listeners.forEach(fn => { try { fn(ev); } catch (e) { /* a listener never breaks rendering */ } });
const fontSet = () => { try { return typeof document !== 'undefined' && document && document.fonts && typeof document.fonts.check === 'function' ? document.fonts : null; } catch (e) { return null; } };
const fonts = new Map();   // imported font id -> { id, family, state: 'loading'|'ready'|'error', face, data?, promise, error? }
const pending = new Map(); // css font string -> load promise (installed / web fonts that are not loaded yet)
const settled = new Set(); // css font strings already loaded once (or that failed): never re-requested, so no loop
const internalFamily = id => `Motif Font ${id}`;
function bump(kind) { epoch++; availCache.clear(); emit({ type: 'fonts', kind, epoch }); }
// Register an imported font file (TTF, OTF, WOFF, WOFF2) under its content id. The page keeps the bytes (keep: true)
// so they can be posted to the render worker once; the worker registers the same bytes. Resolves to the record.
function registerFont(id, data, opts = {}) {
  if (!FONT_ID_RE.test(String(id || ''))) return Promise.resolve(null);
  const cur = fonts.get(id); if (cur && cur.state !== 'error') return cur.promise;
  const rec = { id, family: cleanFamily(opts.family, 'Imported font'), state: 'loading', face: null, data: opts.keep ? data : null, error: '' };
  fonts.set(id, rec);
  rec.promise = (async () => {
    try {
      if (typeof FontFace === 'undefined') throw new Error('this browser cannot load font files');
      const bytes = data instanceof ArrayBuffer ? data.slice(0) : ArrayBuffer.isView(data) ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : null;
      if (!bytes || bytes.byteLength < 12) throw new Error('not a font file');
      const face = new FontFace(internalFamily(id), bytes);
      await face.load();
      const set = fontSet(); if (set) set.add(face);
      Object.assign(rec, { face, state: 'ready' });
    } catch (e) { Object.assign(rec, { state: 'error', error: String((e && e.message) || e).slice(0, 120) }); }
    bump('register');
    return rec;
  })();
  return rec.promise;
}
function fontInfo(id) { const r = fonts.get(id); return r ? { id, family: r.family, state: r.state, error: r.error } : null; }
// Imported fonts whose bytes this side holds (the page), for the worker protocol: [{ id, family, data }].
function fontPayload(skip) { const out = []; for (const r of fonts.values()) if (r.data && r.state !== 'error' && !(skip && skip.has(r.id))) out.push({ id: r.id, family: r.family, data: r.data }); return out; }
function quoteFamily(f) { return /^(serif|sans-serif|monospace|system-ui|cursive|fantasy)$/.test(f) ? f : `"${f}"`; }
// CSS font shorthand for a line at px: the imported face (when registered), the chosen family, then the fallback stack.
function cssFont(font, px) {
  const r = font.source ? fonts.get(font.source) : null;
  const fams = (r && r.state === 'ready' ? `"${internalFamily(font.source)}", ` : '') + `${quoteFamily(font.family)}, ${FALLBACK}`;
  return `${font.weight} ${Math.max(1, px).toFixed(2)}px ${fams}`;
}
// Ask the font system for a face that is not loaded yet. Returns true when nothing is outstanding.
function ensureLoaded(font, text) {
  const set = fontSet(); if (!set) return true;
  const str = cssFont(font, 64);
  if (settled.has(str)) return true;
  let ok = true; try { ok = set.check(str, text || 'A'); } catch (e) { ok = true; }
  if (ok) { settled.add(str); return true; }
  if (!pending.has(str)) {
    const p = Promise.resolve().then(() => set.load(str, text || 'A')).catch(() => null).then(() => { pending.delete(str); settled.add(str); bump('load'); });
    pending.set(str, p);
  }
  return false;
}
// Fonts settle: resolves when every requested load and imported file registration has finished (exports await it).
// With a project, first requests every font its text layers use.
async function whenReady(project) {
  if (project && Array.isArray(project.layers)) for (const l of project.layers) for (const b of Object.values((l && l.text) || {})) for (const ln of Object.values((b && b.lines) || {})) if (ln && ln.font) ensureLoaded(cleanFont(ln.font), cleanText(ln.text, TX.chars) || 'A');
  for (let i = 0; i < 4 && (pending.size || [...fonts.values()].some(r => r.state === 'loading')); i++) await Promise.allSettled([...pending.values(), ...[...fonts.values()].map(r => r.promise)]);
  return { epoch, pending: pending.size };
}
// Is `family` available to canvas text right now? Width probe against generic families (cached per epoch).
const availCache = new Map();
let probe = null;
function available(family) {
  if (/^(serif|sans-serif|monospace|system-ui|cursive|fantasy)$/.test(family)) return true;
  if (availCache.has(family)) return availCache.get(family);
  let ok = false;
  try {
    probe = probe || makeCanvas(8, 8).getContext('2d');
    const s = 'mmmmmmmmmlli1WQ@#&gy';
    for (const base of ['monospace', 'serif', 'sans-serif']) {
      probe.font = `72px ${base}`; const w0 = probe.measureText(s).width;
      probe.font = `72px ${quoteFamily(family)}, ${base}`; const w1 = probe.measureText(s).width;
      if (Math.abs(w1 - w0) > 0.01) { ok = true; break; }
    }
  } catch (e) { ok = false; }
  availCache.set(family, ok); return ok;
}
// What a line will actually draw with: { state: 'ok' | 'loading' | 'fallback' | 'missing' | 'error', using, detail }.
function fontStatus(font) {
  font = cleanFont(font);
  const using = () => FALLBACK_NAMES.find(n => n === 'sans-serif' || available(n));
  if (font.source) {
    const r = fonts.get(font.source);
    if (!r) return { state: 'missing', using: available(font.family) ? font.family : using(), detail: 'The font file is not in this browser.' };
    if (r.state === 'loading') return { state: 'loading', using: r.family, detail: 'Loading the font file…' };
    if (r.state === 'error') return { state: 'error', using: using(), detail: r.error || 'The font file could not be read.' };
    return { state: 'ok', using: r.family, detail: '' };
  }
  const str = cssFont(font, 64);
  if (pending.has(str)) return { state: 'loading', using: font.family, detail: 'Loading…' };
  if (available(font.family)) return { state: 'ok', using: font.family, detail: '' };
  return { state: 'fallback', using: using(), detail: `“${font.family}” isn’t available in this browser.` };
}

// ---------- rasterizer ----------
function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
const tierFor = frameW => TIERS.find(t => t >= frameW) || TIERS[TIERS.length - 1];
// Width of a run with extra tracking (px per glyph) when ctx.letterSpacing is unavailable: per code point.
function trackedWidth(x, text, sp) { let w = 0; const cps = Array.from(text); for (const ch of cps) w += x.measureText(ch).width; return w + sp * Math.max(0, cps.length - 1); }
function drawLine(x, l, i, W, bh) {
  const text = l.text; if (!text) return;
  const y0 = i * bh, padX = Math.round(W * 0.03), padY = bh * 0.12;
  const native = 'letterSpacing' in x;
  let em = l.size * bh;
  const setFont = () => { x.font = cssFont(l.font, em); if (native) x.letterSpacing = `${(l.tracking * em).toFixed(3)}px`; };
  const measure = () => {
    const m = x.measureText(text), sp = l.tracking * em;
    // Native letterSpacing adds spacing after the last glyph too: the visible run is one spacing shorter.
    const w = native ? m.width - sp : trackedWidth(x, text, sp);
    return { w: Math.max(1, w), asc: m.actualBoundingBoxAscent || em * 0.75, desc: m.actualBoundingBoxDescent || 0, sp };
  };
  setFont(); let m = measure();
  const fit = Math.min(1, (W - 2 * padX) / m.w, (bh - 2 * padY) / Math.max(1, m.asc + m.desc));
  if (fit < 1) { em *= fit; setFont(); m = measure(); }
  const cap = x.measureText('H').actualBoundingBoxAscent || em * 0.7;
  // Optical centre on the cap height (stable when the text changes), kept inside the band's padding.
  let base = y0 + bh / 2 + cap / 2;
  base = Math.min(y0 + bh - padY - m.desc, Math.max(y0 + padY + m.asc, base));
  const left = l.align === 'left' ? padX : l.align === 'right' ? W - padX - m.w : (W - m.w) / 2;
  x.textBaseline = 'alphabetic'; x.textAlign = 'left';
  if (native || !m.sp) x.fillText(text, left, base);
  else { let at = left; for (const ch of Array.from(text)) { x.fillText(ch, at, base); at += x.measureText(ch).width + m.sp; } }
}
const slots = new Map(); // slot (layer|input) -> { canvas, ctx, sig, rev, out }
function atlasFor(q, state, frameW, slot) {
  const N = q.lines.length, W = tierFor(Math.max(1, Math.round(frameW || 1))), bh = Math.max(8, Math.round(W / q.aspect)), H = N * bh;
  const lines = q.lines.map(spec => cleanLine(state && state.lines && Object.prototype.hasOwnProperty.call(state.lines, spec.id) ? state.lines[spec.id] : null, spec));
  for (const l of lines) if (l.text) ensureLoaded(l.font, l.text);
  const sig = JSON.stringify([W, H, epoch, lines]);
  const key = String(slot || '_') + '|' + q.id + '|' + W; // per size: a thumbnail never evicts the stage's atlas
  let s = slots.get(key);
  if (s && s.sig === sig) { slots.delete(key); slots.set(key, s); return s.out; }
  if (!s) {
    s = { canvas: makeCanvas(W, H), rev: 0 }; s.ctx = s.canvas.getContext('2d'); slots.set(key, s);
    if (slots.size > 16) slots.delete(slots.keys().next().value);
  } else { slots.delete(key); slots.set(key, s); }
  if (s.canvas.width !== W || s.canvas.height !== H) { s.canvas.width = W; s.canvas.height = H; s.ctx = s.canvas.getContext('2d'); }
  const x = s.ctx;
  x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, W, H);
  x.fillStyle = '#FFFFFF'; // token-lint-ignore (glyph coverage only, never shown)
  lines.forEach((l, i) => { try { drawLine(x, l, i, W, bh); } catch (e) { /* a hostile string or font never breaks the frame */ } });
  // Coverage only: every drawn pixel (colour emoji too) becomes premultiplied white, so rgb == a.
  x.globalCompositeOperation = 'source-in'; x.fillRect(0, 0, W, H);
  x.restore();
  s.sig = sig; s.rev++; builds++;
  s.out = { canvas: s.canvas, rev: s.rev, w: W, h: H, time: 0, linear: true };
  return s.out;
}
// Kit runtime hook: { <inputId>: atlas } for every text input of a style, from the frame state S (S.text, S.layerId, S.w).
function resolve(inputs, S) {
  let out = null;
  for (const q of textInputs(inputs)) (out || (out = {}))[q.id] = atlasFor(q, S && S.text ? S.text[q.id] : null, S ? S.w : 1024, S && S.layerId);
  return out;
}
// The declared default strings (canary, SDK preview, thumbnails without a layer).
function defaultAtlas(q, frameW) { return atlasFor(q, null, frameW || 1024, 'default'); }

return {
  TIERS, FIELDS, FALLBACK, FONT_ID_RE, PATH_RE, cleanText, cleanFamily, cleanFont, cleanLine, sanitizeState, defaults, textInputs, parseKey, fieldSchema, paths, getField, setField,
  registerFont, fontInfo, fontPayload, internalFamily, cssFont, ensureLoaded, whenReady, available, fontStatus, tierFor, atlasFor, resolve, defaultAtlas,
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  get epoch() { return epoch; }, stats() { return { builds, epoch, slots: slots.size, fonts: fonts.size, pending: pending.size }; },
};

})();
