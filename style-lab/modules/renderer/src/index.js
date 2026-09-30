// renderer — composes one frame (background, global transform, style, finish),
// runs the stage loop, draws thumbnails and defines export sizes.
import { frameState, getStyle } from '@modules/style-library';
import { resolvePalette, FONTS, ASPECTS } from '@modules/tokens';
import { mulberry32, hash, memo, makeCanvas, TAU } from '@modules/engine-core';

const fontCss = id => (FONTS.find(f => f.id === id) || FONTS[0]).css;

function grainTile(light, dark) {
  return memo(`grain|${light}|${dark}`, () => {
    const c = makeCanvas(256, 256), x = c.getContext('2d'), rng = mulberry32(99);
    for (let i = 0; i < 9000; i++) {
      x.globalAlpha = 0.25 + rng() * 0.75; x.fillStyle = rng() < 0.5 ? light : dark;
      x.fillRect(Math.floor(rng() * 256), Math.floor(rng() * 256), 1, 1);
    }
    return c;
  });
}

// Render one complete frame into ctx at w × h canvas pixels. Pure in (look, t).
export function renderFrame(ctx, w, h, look, t, opts = {}) {
  const { style, S } = frameState(look, w, h, t);
  const sh = look.shared, pal = resolvePalette(sh.palette, sh.invert);
  S.pal = pal; S.font = (weight, size) => `${weight} ${size}px ${fontCss(look.params.font)}`;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  if (!opts.transparent) { ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, w, h); }
  ctx.translate(w / 2, h / 2); ctx.rotate((sh.rotate * Math.PI) / 180); ctx.scale(sh.zoom, sh.zoom); ctx.translate(-w / 2, -h / 2);
  try { style.render(ctx, S); } catch (e) { if (opts.onError) opts.onError(e); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.setLineDash([]);
  if (sh.vignette > 0 && !opts.transparent) {
    const D = Math.hypot(w, h) / 2, g = ctx.createRadialGradient(w / 2, h / 2, D * 0.35, w / 2, h / 2, D);
    g.addColorStop(0, pal.alpha(pal.shade, 0)); g.addColorStop(1, pal.alpha(pal.shade, sh.vignette * 0.7));
    ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  if (sh.grain > 0) {
    const tile = grainTile(pal.grainLight, pal.grainDark), sc = Math.max(1, Math.min(w, h) / 720);
    const fi = Math.floor(S.p * sh.loop * 24), ox = hash(fi, 1) * 256, oy = hash(fi, 2) * 256;
    ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = sh.grain * 0.55;
    ctx.save(); ctx.scale(sc, sc);
    for (let y = -oy; y < h / sc; y += 256) for (let x = -ox; x < w / sc; x += 256) ctx.drawImage(tile, x, y);
    ctx.restore();
  }
  ctx.restore();
  return S.p;
}

export function exportSize(aspectId, tier) {
  const a = ASPECTS.find(x => x.id === aspectId) || ASPECTS[0];
  const short = tier; const even = v => Math.round(v / 2) * 2;
  return a.w >= a.h ? { w: even((short * a.w) / a.h), h: short } : { w: short, h: even((short * a.h) / a.w) };
}
export function aspectRatio(aspectId) { const a = ASPECTS.find(x => x.id === aspectId) || ASPECTS[0]; return a.w / a.h; }
export function frameCount(look, fps, loops) { return Math.max(1, Math.round(look.shared.loop * fps * loops)); }

// Static or animated thumbnail at phase p.
export function renderThumb(canvas, look, p) {
  const ctx = canvas.getContext('2d');
  const t = ((p - look.shared.phase + 4) / look.shared.tempo) * look.shared.loop;
  renderFrame(ctx, canvas.width, canvas.height, look, t);
}

// Stage: owns the main canvas loop.
export function createStage({ canvas, host, getLook, onTick, onError }) {
  const ctx = canvas.getContext('2d');
  let aspect = '16x9', quality = 'auto', playing = true, t = 0, last = 0, raf = 0, cssW = 0, cssH = 0, dirty = true;
  const timings = [];
  const dprFor = () => { const d = window.devicePixelRatio || 1; return quality === 'draft' ? 0.6 : quality === 'high' ? Math.min(d, 2) : Math.min(d, 1.5); };
  function layout() {
    const r = host.getBoundingClientRect(); const ar = aspectRatio(aspect);
    let w = r.width, h = w / ar; if (h > r.height) { h = r.height; w = h * ar; }
    cssW = Math.max(1, Math.floor(w)); cssH = Math.max(1, Math.floor(h));
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    const d = dprFor(); canvas.width = Math.max(2, Math.round(cssW * d)); canvas.height = Math.max(2, Math.round(cssH * d));
    dirty = true;
  }
  const ro = new ResizeObserver(layout); ro.observe(host);
  function draw() {
    const look = getLook(); const t0 = performance.now();
    const p = renderFrame(ctx, canvas.width, canvas.height, look, t, { onError });
    timings.push(performance.now() - t0); if (timings.length > 60) timings.shift();
    dirty = false; if (onTick) onTick(t, p);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0; last = now;
    if (playing) { t = (t + dt) % getLook().shared.loop; dirty = true; }
    if (dirty) draw();
  }
  layout(); raf = requestAnimationFrame(frame);
  const loopLen = () => getLook().shared.loop;
  return {
    setAspect(a) { aspect = a; layout(); },
    get aspect() { return aspect; },
    setQuality(q) { quality = q; layout(); },
    play() { playing = true; last = 0; },
    pause() { playing = false; },
    toggle() { playing = !playing; last = 0; return playing; },
    get playing() { return playing; },
    get time() { return t; },
    seek(frac) { t = Math.min(0.999999, Math.max(0, frac)) * loopLen(); dirty = true; },
    step(frames, fps = 30) { const L = loopLen(); t = (((t + frames / fps) % L) + L) % L; dirty = true; },
    invalidate() { dirty = true; },
    frameMs() { return timings.length ? timings.reduce((a, b) => a + b, 0) / timings.length : 0; },
    size() { return { w: canvas.width, h: canvas.height, cssW, cssH }; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); },
  };
}

export { getStyle, TAU };
