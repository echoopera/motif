
// ---- GPU budget (Motif 3) ----------------------------------------------------------------
// Heavy shader styles (ray-marched black holes, volumetric nebulae) can take far longer per frame
// than a browser allows before it resets the GPU, which blanks every kit style at once. Two guards:
//  · Preview: each kit draw gets a time budget. The style's measured cost (GPU timer queries when the
//    browser has them, the kit's declared `cost` otherwise) sets an internal render scale, and a frame-time
//    governor lowers every budget when the stage runs slow. The blit upsamples with high-quality smoothing.
//  · Export and thumbnails: always full resolution, but heavy frames are split into flushed bands.
const PREVIEW_MS = 9;           // per kit draw, per sample, at budget 1
const BAND_MS = 35;             // max predicted GPU time per band on export
const MS_PER_MPX = 3.2;         // assumed GPU ms per megapixel for a cost-1 style on an integrated GPU
let preview = false, budget = 1, lastScale = 1, lostEvents = 0, scaleSeen = 1;
const frameTimes = [];
function predictMs(st, px) { const m = rt.costOf(st.id); return (m != null ? m : MS_PER_MPX * (st.cost || 1)) * (px / 1e6); }
function drawPlan(st, w, h) {
  const ms = predictMs(st, w * h);
  if (preview) {
    let s = Math.sqrt((PREVIEW_MS * budget) / Math.max(0.01, ms));
    s = Math.max(0.3, Math.min(1, s)); s = Math.round(s * 20) / 20; // quantize so targets are not re-allocated every frame
    return { scale: s, bands: 1 };
  }
  return { scale: 1, bands: Math.max(1, Math.min(32, Math.ceil(ms / BAND_MS))) };
}
function noteScale(s) { if (preview) scaleSeen = Math.min(scaleSeen, s); }
function setPreview(on) { preview = !!on; if (on) scaleSeen = 1; else lastScale = scaleSeen; }
// Stage reports its real frame interval; sustained slow frames shrink every kit budget, fast frames restore it.
function reportFrame(ms) {
  frameTimes.push(ms); if (frameTimes.length > 20) frameTimes.shift();
  if (frameTimes.length < 8) return;
  const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
  if (avg > 50) budget = Math.max(0.12, budget * 0.85);
  else if (avg < 24) budget = Math.min(4, budget * 1.04);
}
rt.on(ev => { if (ev.type === 'lost') { lostEvents++; budget = Math.max(0.12, budget * 0.5); } emit({ type: 'gpu', gpu: ev.type }); });
function gpuStatus() { return { ok: rt.ok, lost: rt.lost, resets: lostEvents, budget, scale: lastScale, timer: rt.timer, renderer: rt.renderer, software: rt.software }; }
// Background shader compiles: poll until they finish, then tell the shell to redraw what used them.
let compileTimer = 0;
function watchCompiles() {
  if (compileTimer) return;
  const tick = () => {
    const done = rt.poll();
    if (done.length) emit({ type: 'gpu', gpu: 'compiled', ids: done });
    compileTimer = rt.pendingCompiles ? setTimeout(tick, 40) : 0;
  };
  compileTimer = setTimeout(tick, 40);
}

// ---- Cooperative export (Motif 3) ---------------------------------------------------------
// A full-resolution export frame can be hundreds of GPU draws (shutter samples x low-pass taps). Run as one
// block, the page cannot even process a click on Cancel until it ends. In job mode the renderer works in short
// slices: when a slice's time is up it throws SUSPEND at a safe point (after a tap or a shutter sample), the
// exporter yields to the browser (so Cancel, progress and repaint work), then re-enters and resumes from the
// saved state. Nothing drawn is repeated.
const SUSPEND = { isSuspend: true };
const JOB = {
  on: false, deadline: 0, slice: 80, k: 0, pal: null, engines: null, kits: new Map(), pool: [],
  begin() { this.on = true; this.k = 0; this.pal = null; this.engines = null; this.clear(); },
  arm() { this.deadline = performance.now() + this.slice; },
  expired() { return this.on && performance.now() > this.deadline; },
  canvas(w, h) { const c = this.pool.pop() || document.createElement('canvas'); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; },
  clear() { for (const e of this.kits.values()) this.pool.push(e.cv); this.kits.clear(); },
  sampleDone() { this.k++; this.clear(); },
  end() { this.on = false; this.clear(); },
};
