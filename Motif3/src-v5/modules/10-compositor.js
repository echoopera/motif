// ---- module: compositor v1.0.0
const __m_compositor = (() => {
// compositor — draws one evaluated project frame: each layer's style (Canvas 2D or the WebGPU
// engine), layer masks (shapes and track mattes), native blend modes and opacity.
// Pure in (evaluated project, t): no timers, no randomness.
const { TAU, clamp, makeCanvas } = __m_engine_core;
const { frameState, fontCss } = __m_style_library;
const { resolvePalette } = __m_colour;
const { evaluate } = __m_timeline;

function createCompositor({ gpu } = {}) {
  const pool = new Map();
  // Scratch canvases per slot, sized on demand, created in the output colour space.
  function scratch(slot, w, h, space) {
    const key = `${slot}|${space}`; let c = pool.get(key);
    if (!c) { c = document.createElement('canvas'); c.width = w; c.height = h; c._ctx = c.getContext('2d', { colorSpace: space === 'p3' ? 'display-p3' : 'srgb', willReadFrequently: slot === 'mask' }); pool.set(key, c); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  // One style ("look" = styleId + params + shared) into ctx. bg: fill the palette background.
  function renderLook(ctx, w, h, look, t, pal, opts = {}) {
    const { style, S } = frameState(look, w, h, t);
    S.pal = pal; S.media = look.media || null; S.font = (weight, size) => `${weight} ${size}px ${fontCss(look.params.font)}`;
    const sh = look.shared;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    if (opts.clear !== false) ctx.clearRect(0, 0, w, h);
    if (opts.bg) { ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, w, h); }
    ctx.translate(w * (sh.posX || 0), h * (sh.posY || 0)); ctx.translate(w / 2, h / 2); ctx.rotate((sh.rotate * Math.PI) / 180); ctx.scale(sh.zoom, sh.zoom); ctx.translate(-w / 2, -h / 2);
    let engine = 'cpu';
    try {
      if (gpu && style.gpu && gpu.ready && !opts.cpu) {
        gpu.pre(style.id, ctx, S);
        const c = gpu.render(style.id, S, w, h);
        if (c) { ctx.drawImage(c, 0, 0, w, h); if (c.close) c.close(); engine = 'gpu'; } else style.render(ctx, S);
      } else { const used = style.render(ctx, S); if (used === 'webgl' || used === 'software-gl') engine = used; }
    } catch (e) { if (e && e.isSuspend) { ctx.restore(); throw e; } if (opts.onError) opts.onError(e); }
    ctx.restore(); ctx.setLineDash && ctx.setLineDash([]);
    return { p: S.p, engine };
  }

  // Shape mask into canvas m (white = keep). Coordinates relative to the frame.
  function drawMask(m, w, h, c) {
    const x = m._ctx, u = Math.min(w, h), cx = w * (0.5 + c.maskX), cy = h * (0.5 + c.maskY), ang = (c.maskAngle * Math.PI) / 180;
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, w, h);
    x.fillStyle = 'white'; // token-lint-ignore (mask only)
    const feather = c.maskFeather;
    if (c.mask === 'circle') {
      const r = Math.max(1, c.maskSize * 0.5 * Math.hypot(w, h) * 0.75);
      const g = x.createRadialGradient(cx, cy, r * (1 - feather), cx, cy, r);
      g.addColorStop(0, 'white'); g.addColorStop(1, 'rgba(255,255,255,0)'); // token-lint-ignore (mask only)
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    } else if (c.mask === 'rect' || c.mask === 'band') {
      const bw = c.mask === 'band' ? Math.hypot(w, h) * 2 : Math.max(1, c.maskSize * w), bh = Math.max(1, c.maskSize * (c.mask === 'band' ? u * 0.5 : h));
      const blur = feather * u * 0.12, off = 20000;
      x.translate(cx, cy); x.rotate(ang);
      if (blur > 0.5) { x.shadowColor = 'white'; x.shadowBlur = blur; x.shadowOffsetX = off; x.fillRect(-bw / 2 - off, -bh / 2, bw, bh); } // token-lint-ignore (mask only)
      else x.fillRect(-bw / 2, -bh / 2, bw, bh);
    } else if (c.mask === 'gradient') {
      const L = Math.hypot(w, h) / 2, dx = Math.cos(ang), dy = Math.sin(ang), ramp = Math.max(0.01, feather) * L;
      const shift = (c.maskSize - 0.75) * L;
      const g = x.createLinearGradient(cx + dx * (shift - ramp), cy + dy * (shift - ramp), cx + dx * (shift + ramp), cy + dy * (shift + ramp));
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'white'); // token-lint-ignore (mask only)
      x.fillStyle = g; x.fillRect(0, 0, w, h);
    }
    x.restore();
  }
  // Luma of `src` into alpha of canvas m (track matte · luma).
  function lumaToAlpha(m, src, w, h) {
    const x = m._ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'copy'; x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-over';
    const img = x.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] / 255; const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * a; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = l; }
    x.putImageData(img, 0, 0);
  }

  // Draw the evaluated project `ev` (from timeline.evaluate) into ctx.
  // opts: { transparent, space, customs, cpu, onError }
  function renderEvaluated(ctx, w, h, ev, t, opts = {}) {
    const space = opts.space || 'srgb', customs = opts.customs || [];
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, w, h);
    const layers = ev.layers; const needed = layers.map((l, i) => l.visible || (layers[i + 1] && layers[i + 1].visible && /^matte/.test(layers[i + 1].comp.mask)));
    const rendered = []; const engines = []; let firstPal = null;
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i]; if (!needed[i]) { rendered.push(null); continue; }
      const pal = resolvePalette(l.shared.palette, l.shared.invert, customs, l.pmix && l.pmix.to, l.pmix && l.pmix.t);
      if (!firstPal) firstPal = pal;
      const c = l.comp, bottom = i === 0 || !layers.slice(0, i).some((x, j) => x.visible && needed[j]);
      const fillBg = bottom ? !opts.transparent : c.fill;
      const direct = bottom && fillBg && c.blend === 'source-over' && c.opacity >= 0.999 && c.mask === 'none' && l.visible && !(layers[i + 1] && /^matte/.test(layers[i + 1].comp.mask));
      if (direct) { const r = renderLook(ctx, w, h, l, t, pal, { bg: true, cpu: opts.cpu, onError: opts.onError }); engines.push(r.engine); rendered.push(null); continue; }
      const lc = scratch(`L${i}`, w, h, space);
      const r = renderLook(lc._ctx, w, h, l, t, pal, { bg: fillBg, cpu: opts.cpu, onError: opts.onError }); engines.push(r.engine);
      if (c.mask !== 'none') {
        const m = scratch('mask', w, h, space);
        if (/^matte/.test(c.mask)) {
          const below = rendered[i - 1];
          if (below) { if (c.mask === 'matte-luma') lumaToAlpha(m, below, w, h); else { m._ctx.setTransform(1, 0, 0, 1, 0, 0); m._ctx.globalCompositeOperation = 'copy'; m._ctx.drawImage(below, 0, 0); m._ctx.globalCompositeOperation = 'source-over'; } }
          else { m._ctx.clearRect(0, 0, w, h); if (c.maskInvert) { /* no matte: invert keeps all */ } }
        } else drawMask(m, w, h, c);
        const x = lc._ctx; x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = c.maskInvert ? 'destination-out' : 'destination-in'; x.drawImage(m, 0, 0); x.restore();
      }
      rendered.push(lc);
      if (l.visible) { ctx.globalCompositeOperation = c.blend; ctx.globalAlpha = clamp(c.opacity); ctx.drawImage(lc, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    }
    // A matte source that is itself hidden was rendered into a scratch canvas only — nothing to undo.
    ctx.restore();
    return { pal: firstPal || resolvePalette('signal', false, customs), engines };
  }

  function renderProject(ctx, w, h, project, t, opts = {}) {
    const ev = evaluate(project, t, opts.env);
    const r = renderEvaluated(ctx, w, h, ev, t, { ...opts, customs: project.palettes, space: opts.space || project.output.space });
    return { ...r, ev };
  }
  return { renderLook, renderEvaluated, renderProject, scratch };
}

return { createCompositor };

})();

