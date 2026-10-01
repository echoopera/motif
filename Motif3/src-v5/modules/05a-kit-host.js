// ---- module: kit-host v1.0.0 (guarded install: background compile budget, canary, quarantine, effects & transitions)
const __m_kit_host = (() => {
// kit-host — runs third-party kits so they cannot hang or crash the app. Engine-side: no document, no window
// (a Worker running the same modules can use it unchanged); only setTimeout, performance and the kit runtime.
//
//  install(raw, opts)     validate (kit-sandbox: schema + static GLSL analysis) → capability approval → background
//                         compile with a time budget → first-frame canary at 64×64 with a measured-time limit →
//                         register. Compile errors reject the kit with line-numbered diagnostics; a pathologically
//                         slow entry is installed QUARANTINED (it draws a designed placeholder, never its shader).
//  watchdog               preview draws that stay far over budget, and GPU resets that keep following one entry,
//                         quarantine that entry so the stage keeps playing. retry(id) re-runs the canary.
//  applyEffect / renderTransition   motif-kit@2 effect and transition entries on host canvases.
// Limits, stated honestly: the canary measures one small frame on this GPU; it bounds the damage of a slow shader,
// it does not prove a shader is safe. A driver can still hang inside a single draw call; the browser then resets
// the GPU context, which kit-gl recovers from (and this module quarantines a repeat offender).
const K = __m_kits, SB = __m_kit_sandbox, rt = K.runtime;
const { defaults } = __m_engine_core;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const now = () => performance.now();
// Canary budgets. hw = hardware GPU, sw = software GL (SwiftShader / llvmpipe, 20–100× slower).
// 64×64 is 4096 pixels: a shader that needs >250 ms there needs minutes per 1080p frame on the same device.
const CANARY = {
  ladder: [8, 32, 64, 128],               // test-frame sizes, smallest first
  floorMs: { hw: 8, sw: 40 },             // below this a reading is timer/queue noise, not shader cost
  hardMs: { hw: 120, sw: 1500 },          // any one test frame (≤ 64×64) → quarantine; also never START a frame predicted to exceed it
  frameMs: { hw: 3000, sw: 1000000 },     // extrapolated 1080p frame → quarantine (sw: ~3× the heaviest bundled kit)
  queueMs: { hw: 3000, sw: 20000 },       // extra wall time allowed for GPU work other contexts queued ahead of a test frame
  compileMs: 20000,                       // background compile budget per entry
};
const WATCH = { previewMs: { hw: 600, sw: 15000 }, strikes: 3, resets: 2 };
const PX_1080 = 1920 * 1080;
const tier = () => (rt.software ? 'sw' : 'hw');
let seq = 0, extRev = 0;
const DEFAULT_PAL = { bg: '#05060A', ink: '#F2F5FF', a: ['#35E0FF', '#FF3D9A', '#FFB547'] };

// "Pass 2: Error line 12: 'x' : undeclared identifier" → { file, line, message } diagnostics.
function compileDiagnostics(text, e, kit) {
  const out = []; let pass = 0;
  for (const raw of String(text || '').split('\n')) {
    let l = raw; const pm = /^Pass (\d+): /.exec(l); if (pm) { pass = +pm[1] - 1; l = l.slice(pm[0].length); }
    const file = (e.passes[pass] || e.passes[0] || {}).file || null;
    let m = /^(Error|Warning) line (\d+):\s*(.*)$/.exec(l);
    if (m) { out.push({ severity: m[1] === 'Error' ? 'error' : 'warning', code: 'compile', file, line: +m[2], message: m[3], entry: e.localId }); continue; }
    m = /^(Error|Warning) in common line (\d+):\s*(.*)$/.exec(l);
    if (m) { out.push({ severity: m[1] === 'Error' ? 'error' : 'warning', code: 'compile', file: kit.commonFile || 'common.glsl', line: +m[2], message: m[3], entry: e.localId }); continue; }
    if (l.trim()) out.push({ severity: 'error', code: 'compile', file, line: null, message: l.trim(), entry: e.localId });
  }
  return out;
}
function canaryUniforms(kit, e) {
  const spec = K.paramsOf(e), pal = (kit.palettes.find(p => p.id === e.palette) || kit.palettes[0] || DEFAULT_PAL);
  return { p: 0.37, L: 6, seed: 417, safe: true, pal, params: defaults(spec), spec, media: null, audio: null, progress: 0.5, ext: null };
}
// Compile one entry in the background (KHR_parallel_shader_compile when present) under a time budget, then canary it.
// Returns { ok, error?, diagnostics, quarantine?, canary }.
async function checkEntry(kit, e, signal) {
  const key = `chk~${kit.id}/${e.localId}~${++seq}`, def = K.defOf(kit, e);
  const res = { ok: true, diagnostics: [], canary: null };
  try {
    const t0 = now(); let r = rt.compile(key, def);
    while (r.pending) {
      if (signal && signal.aborted) return { ...res, ok: false, error: 'cancelled' };
      if (now() - t0 > CANARY.compileMs) return { ...res, quarantine: { code: 'compile-timeout', reason: 'shader compile took too long', detail: `The driver had not finished compiling after ${CANARY.compileMs / 1000} s.` } };
      await sleep(30); r = rt.compile(key, def);
    }
    const compileMs = now() - t0;
    if (!r.ok) {
      if (r.lost) return { ...res, quarantine: { code: 'gpu-reset', reason: 'GPU reset while compiling', detail: 'The graphics context was lost during the compile; retry once the GPU has recovered.' } };
      return { ...res, ok: false, error: r.error, diagnostics: compileDiagnostics(r.error, e, kit) };
    }
    await sleep(0);
    const u = canaryUniforms(kit, e), t = tier(), hard = CANARY.hardMs[t], floor = CANARY.floorMs[t];
    const where = t === 'sw' ? 'software renderer' : 'GPU';
    const reset = n => ({ ...res, quarantine: { code: 'gpu-reset', reason: `GPU reset on a ${n}×${n} test frame`, detail: `Drawing one ${n}×${n} frame reset the graphics context.` } });
    const slow = (n, ms, how) => ({ ...res, quarantine: { code: 'canary-slow', reason: `a ${n}×${n} test frame ${how} ${Math.round(ms)} ms`, detail: `A ${n}×${n} test frame ${how} ${Math.round(ms)} ms (limit ${hard} ms on this ${where}). At full size it would freeze playback.` } });
    // Polled from timers, so the main thread never blocks on the GPU. Readings are the GPU time of the test draw
    // (timer query) when the browser has one, else fence wall time, which also counts work other contexts queued
    // (stage frames): a reading that would quarantine is re-measured once and the faster one counts. Frames grow
    // 8 → 32 → 64 (→ 128) and a size whose predicted time exceeds the limit is never started, so a pathological
    // shader costs at most one small frame of GPU time.
    const probe = n => rt.probeAsync(key, n, n, u, hard + CANARY.queueMs[t]);
    const confirm = async (n, m) => { const m2 = await probe(n); return m2 && m2.done && m2.ms < m.ms ? m2 : m; };
    const pts = []; res.canary = { compileMs: Math.round(compileMs), tier: t };
    const w = await probe(1); // first use: drivers finish linking / JIT lazily; not timed
    if (!w || w.lost || rt.lost) return reset(1);
    if (!w.done) return slow(1, w.ms, 'was still running after');
    for (const n of CANARY.ladder) {
      const prev = pts[pts.length - 1];
      if (prev && prev.ms > floor && prev.ms * (n * n) / prev.px > hard) {
        if (n > 64) break; // 128 only refines the estimate
        const again = await confirm(prev.n, prev); prev.ms = again.ms;
        const pred = prev.ms * (n * n) / prev.px;
        if (prev.ms > floor && pred > hard) return slow(n, pred, 'was predicted to take');
      }
      let m = await probe(n);
      if (!m || m.lost || rt.lost) return reset(n);
      if (!m.done || m.ms > hard) { if (m.done) m = await confirm(n, m); if (!m.done || m.ms > hard) return slow(n, m.ms, m.done ? 'took' : 'was still running after'); }
      pts.push({ n, px: n * n, ms: m.ms }); res.canary['ms' + n] = +m.ms.toFixed(2); res.canary.timer = !!m.timer;
      if (n === 64 && m.ms <= floor) break; // cheap: nothing to extrapolate
    }
    // Per-pixel slope between the two largest frames removes fixed per-draw overhead from the 1080p estimate.
    const [p1, p2] = pts.slice(-2);
    if (p2 && p2.ms > floor) {
      const est = p1 && p2.ms > p1.ms ? ((p2.ms - p1.ms) / (p2.px - p1.px)) * PX_1080 : (p2.ms / p2.px) * PX_1080;
      res.canary.est1080 = Math.round(est);
      if (est > CANARY.frameMs[t]) return { ...res, quarantine: { code: 'canary-slow', reason: `about ${(est / 1000).toFixed(1)} s per 1080p frame`, detail: `Measured on test frames: about ${Math.round(est)} ms per 1080p frame (limit ${CANARY.frameMs[t]} ms on this ${where}).` } };
    }
    return res;
  } finally { rt.forget(key); }
}
// Background check of every renderable entry. Yields between entries so the page stays responsive.
async function checkKit(kit, opts = {}) {
  const out = { ok: true, errors: [], diagnostics: [], quarantine: {}, canary: {}, skipped: false };
  if (!rt.ok) { out.skipped = true; return out; }
  for (const e of SB.renderables(kit)) {
    if (opts.only && !opts.only.includes(e.id)) continue;
    if (opts.onProgress) opts.onProgress(e);
    const r = await checkEntry(kit, e, opts.signal);
    if (r.canary) out.canary[e.id] = r.canary;
    if (r.error) { out.ok = false; out.errors.push(`${e.localId}: ${r.error}`); out.diagnostics.push(...r.diagnostics); }
    if (r.quarantine) out.quarantine[e.id] = r.quarantine;
    await sleep(0);
  }
  return out;
}

// Guarded install. opts: { source, approved: [capability] | 'all', onProgress }.
// Resolves to { ok, kit, warnings, diagnostics, report, quarantined: [ids], canary } or { ok:false, needsApproval, capabilities, … }
// or { ok:false, errors, diagnostics }.
const busy = new Set();
async function install(raw, opts = {}) {
  const v = SB.validate(raw && raw.manifest, raw && raw.files);
  if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings, diagnostics: v.diagnostics || [], report: v.report };
  const kit = v.kit, source = opts.source || 'file';
  const approved = source === 'catalog' || opts.approved === 'all' ? kit.capabilities.slice() : (Array.isArray(opts.approved) ? opts.approved : []);
  const missing = kit.capabilities.filter(c => !approved.includes(c));
  if (missing.length) return { ok: false, needsApproval: true, missing, capabilities: SB.capabilityInfo(kit.capabilities), kit: summary(kit), errors: [], warnings: v.warnings, diagnostics: v.diagnostics, report: v.report };
  if (busy.has(kit.id)) return { ok: false, errors: [`${kit.name} is already being checked.`], warnings: [], diagnostics: [] };
  busy.add(kit.id);
  try {
    const c = await checkKit(kit, opts);
    if (!c.ok) return { ok: false, errors: c.errors.map(e => `Shader: ${e}`), warnings: v.warnings, diagnostics: [...c.diagnostics, ...v.diagnostics.filter(d => d.severity !== 'error')], report: v.report };
    const r = K.install(raw, { source, approved, compile: false, validated: { ...v, report: { ...v.report, canary: c.canary } }, quarantine: c.quarantine });
    if (!r.ok) return r;
    return { ...r, quarantined: Object.keys(c.quarantine), canary: c.canary, skippedCompile: c.skipped, report: { ...v.report, canary: c.canary } };
  } finally { busy.delete(kit.id); }
}
const summary = kit => ({ id: kit.id, name: kit.name, version: kit.version, author: kit.author, description: kit.description, format: kit.format, sourceFormat: kit.sourceFormat, migration: kit.migration, kinds: { styles: kit.styles.length, effects: kit.effects.length, transitions: kit.transitions.length, exporters: kit.exporters.length } });
// Roll back to the version this kit replaced (same guarded path; its approvals carry over).
async function rollback(id) {
  const p = K.previousRaw(id); if (!p) return { ok: false, errors: ['There is no earlier version to roll back to.'] };
  return install(p.raw, { source: p.source, approved: p.approved });
}
// Clear an entry's quarantine and re-run its check; it stays quarantined if the canary still fails.
async function retry(id) {
  const hit = K.entry(id); if (!hit) return { ok: false, errors: ['Not installed.'] };
  K.setChecking(id, true); K.setQuarantine(id, null);
  try {
    const c = await checkKit(hit.kit, { only: [id] });
    const q = c.quarantine[id] || (c.ok ? null : { code: 'compile', reason: 'shader does not compile', detail: c.errors.join('\n').slice(0, 400) });
    if (q) K.setQuarantine(id, q);
    return { ok: !q, quarantine: q, canary: c.canary[id] || null, diagnostics: c.diagnostics };
  } finally { K.setChecking(id, false); K.emit({ type: 'gpu', gpu: 'compiled', ids: [id] }); }
}

// ---- runtime watchdog ----
const strikes = new Map(), resets = new Map();
K.setDrawHook((id, ms, preview) => {
  if (!preview) return; // exports are banded and cooperative; only interactive playback is guarded here
  if (ms > WATCH.previewMs[tier()]) {
    const n = (strikes.get(id) || 0) + 1; strikes.set(id, n);
    if (n >= WATCH.strikes && !K.quarantine.has(id)) K.setQuarantine(id, { code: 'slow-runtime', reason: `preview frames took ${Math.round(ms)} ms`, detail: `${n} preview frames in a row took longer than ${WATCH.previewMs[tier()]} ms even at reduced resolution.` });
  } else strikes.delete(id);
});
rt.on(ev => {
  if (ev.type !== 'lost') return;
  const id = K.lastDrawn; if (!id) return;
  const n = (resets.get(id) || 0) + 1; resets.set(id, n);
  if (n >= WATCH.resets && !K.quarantine.has(id)) K.setQuarantine(id, { code: 'gpu-reset', reason: `the GPU reset ${n} times while drawing it`, detail: 'Each reset blanks every shader style for a moment. Retry after closing other GPU-heavy tabs.' });
});

// ---- motif-kit@2 effects and transitions ----
// S: { w, h, p, L, seed, pal: { bg, ink, a:[…] }, params?, audio? }. Draws into ctx (w×h). Returns 'ok' | 'pending' | an error string.
function runEntry(id, kind, ctx, S, ext, progress) {
  const hit = K.entry(id);
  if (!hit || (hit.entry.kind || 'style') !== kind) return `No installed ${kind} "${id}".`;
  if (!hit.enabled) return `${hit.kit.name} is turned off.`;
  const q = K.quarantine.get(id); if (q) return `quarantined · ${q.reason}`;
  if (K.isChecking(id)) return 'pending';
  const spec = K.paramsOf(hit.entry), c = rt.compile(id, K.defOf(hit.kit, hit.entry, spec));
  if (!c.ok) return c.pending ? 'pending' : c.lost ? 'GPU reset · recovering' : c.error;
  const u = { p: S.p || 0, L: S.L || 6, seed: S.seed || 1, safe: K.safe, pal: S.pal || DEFAULT_PAL, params: { ...defaults(spec), ...(S.params || {}) }, spec, media: null, audio: S.audio || null, progress, ext };
  if (!rt.draw(id, S.w, S.h, u, {})) return 'GPU reset · recovering';
  rt.blit(ctx, S.w, S.h); return 'ok';
}
const applyEffect = (id, ctx, src, S) => runEntry(id, 'effect', ctx, S, { input: { canvas: src, rev: ++extRev } }, 0);
const renderTransition = (id, ctx, from, to, progress, S) => runEntry(id, 'transition', ctx, S, { from: { canvas: from, rev: ++extRev }, to: { canvas: to, rev: ++extRev } }, progress);

return { CANARY, WATCH, install, rollback, retry, checkKit, compileDiagnostics, applyEffect, renderTransition, effects: K.effects, transitions: K.transitions, exporters: K.exporters };

})();
