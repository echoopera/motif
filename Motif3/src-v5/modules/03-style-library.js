// ---- module: style-library v2.1.0
const __m_style_library = (() => {
// style-library — 25 procedural animation styles, each a pure function of time.
// render(ctx, S): S = { w, h, u, t, p, L, P, pal, seed, noise, font(weight, size) }
// p is the loop phase 0..1; everything must be periodic in p so loops are seamless.
const { TAU, clamp, lerp, fract, smooth, local, hash, gauss, mulberry32, createNoise, ease, spring, P, defaults, sanitize, mutate, randomize, fitFont, sampleText, memo, makeCanvas } = __m_engine_core;
const { PALETTES, FONTS } = __m_tokens;
const CATEGORIES = [
  { id: 'type', name: 'Kinetic type' },
  { id: 'geometry', name: 'Geometry' },
  { id: 'particles', name: 'Particles & physics' },
  { id: 'generative', name: 'Generative' },
];

const FONT_OPTS = FONTS.map(f => ({ v: f.id, l: f.name }));
const fontCss = id => (FONTS.find(f => f.id === id) || FONTS[0]).css;
const setFont = (ctx, S, weight, size) => { ctx.font = `${Math.round(weight)} ${Math.max(1, size)}px ${fontCss(S.P.font || 'anybody')}`; };

// ---------- Shared groups: every style gets these ----------
const SHARED_SCHEMA = {
  palette: P.select('Palette', PALETTES.map(p => ({ v: p.id, l: p.name })), 'signal', { group: 'colour', mutate: 0, dynamic: true }),
  invert: P.toggle('Invert', false, { group: 'colour', mutate: 0 }),
  tempo: P.int('Tempo', 1, 4, 1, { group: 'motion', unit: '×', mutate: 0.4 }),
  phase: P.range('Phase', 0, 1, 0, 0.01, { group: 'motion', mutate: 0.5 }),
  seed: P.int('Seed', 1, 9999, 417, { group: 'motion', mutate: 0 }),
  zoom: P.range('Zoom', 0.5, 2, 1, 0.01, { group: 'motion', unit: '×', mutate: 0.3 }),
  rotate: P.range('Rotate', -180, 180, 0, 1, { group: 'motion', unit: '°', mutate: 0.15 }),
  posX: P.range('Position X', -1, 1, 0, 0.005, { group: 'motion', mutate: 0 }),
  posY: P.range('Position Y', -1, 1, 0, 0.005, { group: 'motion', mutate: 0 }),
};
// Loop length lives on the project (finish block); styles read it from S.L.

// ---------- Radial shape functions (used by morph) ----------
const polyR = n => th => { const a = TAU / n; const m = fract((th + Math.PI / 2) / a) * a - a / 2; return Math.cos(Math.PI / n) / Math.cos(m); };
const SHAPES = {
  circle: () => 1,
  square: th => 0.84 / Math.max(Math.abs(Math.cos(th)), Math.abs(Math.sin(th))),
  triangle: th => polyR(3)(th) * 0.9,
  hexagon: th => polyR(6)(th),
  star: (th, n) => { const s = fract((th + Math.PI / 2) * n / TAU); const f = Math.abs(s - 0.5) * 2; return 0.45 + 0.6 * Math.pow(f, 1.4); },
  flower: (th, n) => 0.72 + 0.28 * Math.cos(n * th),
  blob: (th, n, seed) => 1 + 0.12 * Math.sin(2 * th + seed) + 0.09 * Math.sin(3 * th + seed * 2.1) + 0.06 * Math.sin(5 * th + seed * 3.7),
};

// Glyph layout helper: returns [{ch, x, w}] centred on 0.
function layoutGlyphs(ctx, text) {
  const chars = [...text]; let x = 0; const out = [];
  for (const ch of chars) { const w = ctx.measureText(ch).width; out.push({ ch, x, w }); x += w; }
  const total = x; for (const g of out) g.x -= total / 2;
  return { glyphs: out, total };
}
function orderRank(order, i, n, seed) {
  if (n <= 1) return 0;
  if (order === 'right') return (n - 1 - i) / (n - 1);
  if (order === 'center') return Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
  if (order === 'random') return hash(seed, i, 3);
  return i / (n - 1);
}

// =====================================================================
// KINETIC TYPE
// =====================================================================
const staggerRise = {
  id: 'stagger-rise', name: 'Stagger Rise', category: 'type',
  blurb: 'Glyphs spring in one by one, hold, then leave with intent.',
  params: {
    text: P.text('Text', 'MOTIF', 24),
    font: P.select('Font', FONT_OPTS, 'anybody'),
    weight: P.range('Weight', 300, 900, 800, 100),
    stagger: P.range('Stagger', 0, 1, 0.45),
    overshoot: P.range('Overshoot', 0, 1, 0.55),
    travel: P.range('Travel', 0.2, 1.5, 0.8),
    order: P.select('Order', ['left', 'right', 'center', 'random'], 'left'),
    exit: P.select('Exit', ['up', 'down', 'fade', 'scale'], 'up'),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal } = S; const text = q.text || ' ';
    const size = fitFont(ctx, text, fontCss(q.font), q.weight, w * 0.84, h * 0.46);
    setFont(ctx, S, q.weight, size);
    const { glyphs } = layoutGlyphs(ctx, text); const n = glyphs.length;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const base = h / 2 + size * 0.35;
    glyphs.forEach((g, i) => {
      const r = orderRank(q.order, i, n, S.seed);
      const s0 = 0.03 + r * q.stagger * 0.3, e0 = 0.64 + r * q.stagger * 0.22;
      const inT = local(p, s0, s0 + 0.26), outT = ease.inCubic(local(p, e0, e0 + 0.2));
      if (inT <= 0 || outT >= 1) return;
      const sp = spring(inT, q.overshoot);
      let y = (1 - sp) * q.travel * size, a = clamp(inT * 4), sc = 1;
      if (q.exit === 'up') { y -= outT * q.travel * size * 1.2; a *= 1 - outT; }
      else if (q.exit === 'down') { y += outT * q.travel * size * 1.2; a *= 1 - outT; }
      else if (q.exit === 'fade') a *= 1 - outT;
      else sc = 1 - outT;
      ctx.save(); ctx.globalAlpha = a;
      ctx.translate(w / 2 + g.x + g.w / 2, base + y - size * 0.35); ctx.scale(sc, sc * lerp(1, 1.15, clamp((1 - inT) * 2) * q.overshoot));
      ctx.fillStyle = i === Math.floor(n / 2) ? pal.accent(0) : pal.ink;
      ctx.fillText(g.ch, -g.w / 2, size * 0.35); ctx.restore();
    });
  },
};

const widthWave = {
  id: 'width-wave', name: 'Width Wave', category: 'type',
  blurb: 'Letters breathe in width and weight while every row stays justified.',
  params: {
    text: P.text('Text', 'WAVEFORM', 24),
    font: P.select('Font', FONT_OPTS, 'anybody'),
    amplitude: P.range('Amplitude', 0, 1, 0.65),
    wavelength: P.range('Wavelength', 0.3, 4, 1.2),
    rows: P.int('Rows', 1, 8, 4),
    rowOffset: P.range('Row offset', 0, 1, 0.22),
    weightSwing: P.toggle('Weight swing', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal } = S; const chars = [...(q.text || ' ')]; const n = chars.length;
    const rowH = (h * 0.84) / q.rows; const size = rowH * 0.92;
    const y0 = h / 2 - (q.rows * rowH) / 2;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    // Advance widths per weight bucket, measured once per font/size.
    const adv = memo(`ww|${q.font}|${q.text}|${Math.round(size)}`, () => {
      const m = {};
      for (let wt = 300; wt <= 900; wt += 100) { setFont(ctx, S, wt, size); m[wt] = chars.map(c => ctx.measureText(c).width); }
      return m;
    });
    const bucket = v => Math.min(900, Math.max(300, Math.round(v / 100) * 100));
    let curFont = -1;
    for (let r = 0; r < q.rows; r++) {
      const items = []; let total = 0;
      for (let i = 0; i < n; i++) {
        const s = Math.sin(TAU * (p + (i / Math.max(1, n)) * q.wavelength + r * q.rowOffset));
        const sx = Math.max(0.18, 1 + q.amplitude * 0.85 * s);
        const wt = q.weightSwing ? bucket(300 + 300 * (1 + s)) : 800;
        const a = adv[wt][i] * sx; items.push({ ch: chars[i], sx, wt, a }); total += a;
      }
      const fit = (w * 0.9) / Math.max(1, total);
      let x = w / 2 - (total * fit) / 2; const y = y0 + (r + 0.5) * rowH;
      ctx.fillStyle = r % 2 ? pal.accent(r % 3) : pal.ink;
      for (const it of items) {
        if (it.wt !== curFont) { setFont(ctx, S, it.wt, size); curFont = it.wt; }
        ctx.save(); ctx.translate(x, y); ctx.scale(it.sx * fit, Math.min(1.2, fit)); ctx.fillText(it.ch, 0, 0); ctx.restore();
        x += it.a * fit;
      }
    }
  },
};

const typeTunnel = {
  id: 'type-tunnel', name: 'Type Tunnel', category: 'type',
  blurb: 'Rings of text rush toward the viewer through a twisting tunnel.',
  params: {
    text: P.text('Text', 'DEEPER', 20),
    font: P.select('Font', FONT_OPTS, 'mono'),
    rings: P.int('Rings', 6, 40, 18),
    twist: P.range('Twist', 0, 1, 0.35),
    depth: P.range('Depth curve', 0.6, 3, 1.7),
    size: P.range('Size', 0.4, 1.6, 0.9),
    direction: P.select('Direction', ['toward', 'away'], 'toward'),
    alternate: P.toggle('Alternate colour', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S; const text = (q.text || ' ') + ' ';
    const R = Math.hypot(w, h) * 0.55; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < q.rings; k++) {
      const d = fract(k / q.rings + (q.direction === 'toward' ? p : -p));
      const r = u * 0.04 + R * Math.pow(d, q.depth);
      const a = smooth(0, 0.18, d) * (1 - smooth(0.9, 1, d)); if (a <= 0.01) continue;
      const fs = Math.max(2, r * 0.16 * q.size); setFont(ctx, S, 700, fs);
      const adv = fs * 0.66; const count = Math.max(6, Math.floor((TAU * r) / adv));
      const rot = q.twist * d * TAU + k * 0.37;
      ctx.fillStyle = q.alternate && k % 2 ? pal.accent(k % 3) : pal.ink; ctx.globalAlpha = a;
      for (let i = 0; i < count; i++) {
        const th = rot + (i / count) * TAU; const ch = text[i % text.length];
        if (ch === ' ') continue;
        ctx.save(); ctx.translate(w / 2 + Math.cos(th) * r, h / 2 + Math.sin(th) * r); ctx.rotate(th + Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  },
};

const slitScan = {
  id: 'slit-scan', name: 'Slit Scan', category: 'type',
  blurb: 'Type sliced into strips that shear on a travelling wave with digital jitter.',
  params: {
    text: P.text('Text', 'SIGNAL', 20),
    font: P.select('Font', FONT_OPTS, 'anybody'),
    slices: P.int('Slices', 6, 90, 32),
    offset: P.range('Offset', 0, 1, 0.45),
    frequency: P.range('Frequency', 0.5, 6, 1.6),
    jitter: P.range('Jitter', 0, 1, 0.25),
    axis: P.select('Axis', ['horizontal', 'vertical'], 'horizontal'),
    split: P.toggle('Split colour', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal } = S;
    const key = `slit|${q.text}|${q.font}|${Math.round(w)}|${Math.round(h)}|${pal.ink}`;
    const src = memo(key, () => {
      const c = makeCanvas(w, h), x = c.getContext('2d');
      const size = fitFont(x, q.text || ' ', fontCss(q.font), 900, w * 0.86, h * 0.62);
      x.font = `900 ${size}px ${fontCss(q.font)}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = pal.ink; x.fillText(q.text || ' ', w / 2, h / 2 + size * 0.04); return c;
    });
    const tint = q.split ? memo(key + '|' + pal.a[0], () => {
      const c = makeCanvas(w, h), x = c.getContext('2d'); x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = pal.accent(0); x.fillRect(0, 0, w, h); return c;
    }) : null;
    const N = q.slices, vert = q.axis === 'vertical', span = vert ? w : h, step = span / N;
    const tick = Math.floor(p * 24) % 24;
    for (let i = 0; i < N; i++) {
      let off = q.offset * (vert ? h : w) * 0.22 * Math.sin(TAU * (p + (i / N) * q.frequency));
      if (hash(S.seed, i, tick) < q.jitter * 0.45) off += (hash(i, tick, 9) - 0.5) * (vert ? h : w) * 0.3 * q.jitter;
      const a = i * step, sz = step + 1;
      const draw = (img, dx) => vert ? ctx.drawImage(img, a, 0, sz, h, a, off + dx, sz, h) : ctx.drawImage(img, 0, a, w, sz, off + dx, a, w, sz);
      if (tint) draw(tint, S.u * 0.012 * Math.sin(TAU * (p + i / N)));
      draw(src, 0);
    }
  },
};

const marqueeStack = {
  id: 'marquee-stack', name: 'Marquee Stack', category: 'type',
  blurb: 'Poster-scale rows of type scroll in opposite directions on a skewed grid.',
  params: {
    text: P.text('Text', 'MOTION IS A LANGUAGE', 36),
    font: P.select('Font', FONT_OPTS, 'anybody'),
    rows: P.int('Rows', 2, 12, 6),
    speed: P.int('Speed', 1, 4, 1),
    skew: P.range('Skew', -0.5, 0.5, -0.12),
    outline: P.select('Outline', ['none', 'alternate', 'all'], 'alternate'),
    separator: P.select('Separator', [{ v: '—', l: 'Dash' }, { v: '•', l: 'Dot' }, { v: '/', l: 'Slash' }, { v: '✦', l: 'Star' }], '—'),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal } = S;
    const rowH = h / q.rows, fs = rowH * 0.9; setFont(ctx, S, 800, fs);
    const seg = `${q.text || ' '} ${q.separator} `; const segW = Math.max(10, ctx.measureText(seg).width);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.transform(1, 0, q.skew, 1, 0, 0); ctx.translate(-w / 2, -h / 2);
    const extra = Math.abs(q.skew) * h + segW;
    for (let r = 0; r < q.rows; r++) {
      const dir = r % 2 ? 1 : -1, k = q.speed * (1 + (r % 2));
      const off = fract(p * k + hash(S.seed, r)) * segW * dir;
      const y = (r + 0.5) * rowH;
      const stroke = q.outline === 'all' || (q.outline === 'alternate' && r % 2);
      if (stroke) { ctx.strokeStyle = r % 4 === 1 ? pal.accent(0) : pal.ink; ctx.lineWidth = Math.max(1, fs * 0.025); }
      else ctx.fillStyle = r % 3 === 2 ? pal.accent(1) : pal.ink;
      for (let x = -extra + off - segW; x < w + extra; x += segW) stroke ? ctx.strokeText(seg, x, y) : ctx.fillText(seg, x, y);
    }
    ctx.restore();
  },
};

const CHARSETS = { blocks: '▖▗▘▙▚▛▜▝▞▟█▓▒░', binary: '01', glyphs: '#%&@$*+=?!<>/\\|', hex: '0123456789ABCDEF' };
const scramble = {
  id: 'scramble-decode', name: 'Scramble Decode', category: 'type',
  blurb: 'Characters cycle through noise, lock into a message, then dissolve again.',
  params: {
    text: P.text('Text', 'DECODE THE SIGNAL', 40),
    charset: P.select('Charset', ['blocks', 'binary', 'glyphs', 'hex'], 'glyphs'),
    spread: P.range('Spread', 0, 1, 0.6),
    rate: P.range('Flicker rate', 4, 30, 14, 1, { unit: '/s' }),
    hold: P.range('Hold', 0.1, 0.6, 0.3),
    highlight: P.toggle('Highlight noise', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, L } = S; const text = (q.text || ' ').toUpperCase();
    const words = text.split(' '); const mono = fontCss('mono');
    const M = 100; ctx.font = `700 ${M}px ${mono}`; const cw100 = ctx.measureText('M').width;
    let perLine = Math.max(4, Math.ceil(Math.sqrt(text.length * 2.2 * (w / h))));
    const lines = []; let cur = '';
    for (const wd of words) { if ((cur + ' ' + wd).trim().length > perLine && cur) { lines.push(cur); cur = wd; } else cur = (cur + ' ' + wd).trim(); }
    if (cur) lines.push(cur);
    const maxLen = Math.max(...lines.map(l => l.length));
    const fs = Math.min((w * 0.84) / (maxLen * cw100 / 100), (h * 0.7) / (lines.length * 1.25));
    ctx.font = `700 ${fs}px ${mono}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const cw = (cw100 / 100) * fs, steps = Math.max(1, Math.round(q.rate * L)), tick = Math.floor(p * steps) % steps;
    const set = CHARSETS[q.charset]; let idx = 0;
    const inEnd = 0.08 + q.spread * 0.3, outStart = Math.min(0.92, inEnd + 0.12 + q.hold);
    lines.forEach((line, li) => {
      const y = h / 2 + (li - (lines.length - 1) / 2) * fs * 1.25; const x0 = w / 2 - (line.length * cw) / 2;
      [...line].forEach((ch, ci) => {
        const i = idx++; if (ch === ' ') return;
        const r = hash(S.seed, i, 5);
        const ri = 0.04 + r * (inEnd - 0.04), ui = outStart + hash(S.seed, i, 8) * (0.97 - outStart);
        const resolved = p >= ri && p < ui;
        const shown = resolved ? ch : set[Math.floor(hash(i, tick, S.seed) * set.length)];
        ctx.fillStyle = resolved ? pal.ink : (q.highlight ? pal.accent(i % 3) : pal.ink);
        ctx.globalAlpha = resolved ? 1 : 0.85;
        ctx.fillText(shown, x0 + ci * cw, y);
      });
    });
    ctx.globalAlpha = 1;
  },
};

// =====================================================================
// GEOMETRY
// =====================================================================
const orbitRings = {
  id: 'orbit-rings', name: 'Orbit Rings', category: 'geometry',
  blurb: 'Concentric arcs rotating at whole-number speed ratios for perfect loops.',
  params: {
    count: P.int('Rings', 3, 40, 14),
    arc: P.range('Arc length', 0.05, 1, 0.55),
    spread: P.int('Speed spread', 1, 5, 3),
    thickness: P.range('Thickness', 0.2, 3, 1),
    caps: P.select('Caps', ['round', 'butt'], 'round'),
    dashed: P.toggle('Dashed', false),
    colour: P.select('Colour', ['mono', 'accent', 'cycle'], 'accent'),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S; ctx.lineCap = q.caps;
    for (let k = 0; k < q.count; k++) {
      const r = u * (0.07 + 0.4 * (k / Math.max(1, q.count - 1)));
      const dir = k % 2 ? 1 : -1, sp = 1 + (k % q.spread);
      const a0 = dir * TAU * p * sp + hash(S.seed, k) * TAU;
      ctx.lineWidth = u * 0.006 * q.thickness * (0.7 + k / q.count);
      ctx.strokeStyle = q.colour === 'mono' ? pal.ink : q.colour === 'cycle' ? pal.pick(k) : (k % 5 === 2 ? pal.accent(0) : pal.ink);
      ctx.setLineDash(q.dashed ? [u * 0.01, u * 0.012] : []);
      ctx.beginPath(); ctx.arc(w / 2, h / 2, r, a0, a0 + TAU * q.arc * (0.6 + 0.4 * hash(S.seed, k, 2))); ctx.stroke();
    }
    ctx.setLineDash([]);
  },
};

const gridPulse = {
  id: 'grid-pulse', name: 'Grid Pulse', category: 'geometry',
  blurb: 'A field of shapes scaled by a travelling wave, like an effector falloff.',
  params: {
    cols: P.int('Columns', 4, 48, 18),
    shape: P.select('Shape', ['circle', 'square', 'diamond', 'cross', 'line'], 'circle'),
    wave: P.select('Wave', ['radial', 'linear', 'diagonal', 'noise', 'spiral'], 'radial'),
    frequency: P.range('Frequency', 0.3, 5, 1.4),
    minSize: P.range('Min size', 0, 1, 0.08),
    cycles: P.int('Cycles', 1, 4, 1),
    spin: P.toggle('Spin', false),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, noise } = S;
    const cols = q.cols, cell = w / cols, rows = Math.ceil(h / cell);
    const oy = (h - rows * cell) / 2;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const cx = (i + 0.5) * cell, cy = oy + (j + 0.5) * cell;
      const nx = (cx - w / 2) / (Math.max(w, h) / 2), ny = (cy - h / 2) / (Math.max(w, h) / 2);
      let d;
      if (q.wave === 'radial') d = Math.hypot(nx, ny);
      else if (q.wave === 'linear') d = nx * 0.5 + 0.5;
      else if (q.wave === 'diagonal') d = (nx + ny) * 0.5;
      else if (q.wave === 'noise') d = noise.loop(nx * 1.4, ny * 1.4, p, 0.4) * 0.8;
      else d = Math.atan2(ny, nx) / TAU + Math.hypot(nx, ny) * 0.5;
      const v = 0.5 + 0.5 * Math.cos(TAU * (p * q.cycles - d * q.frequency));
      const s = lerp(q.minSize, 1, v) * cell * 0.46;
      ctx.fillStyle = v > 0.82 ? pal.accent(0) : pal.ink; ctx.strokeStyle = ctx.fillStyle;
      ctx.save(); ctx.translate(cx, cy); if (q.spin) ctx.rotate(v * Math.PI / 2);
      if (q.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); }
      else if (q.shape === 'square') ctx.fillRect(-s, -s, s * 2, s * 2);
      else if (q.shape === 'diamond') { ctx.rotate(Math.PI / 4); ctx.fillRect(-s * 0.75, -s * 0.75, s * 1.5, s * 1.5); }
      else if (q.shape === 'cross') { const t = s * 0.3; ctx.fillRect(-s, -t, s * 2, t * 2); ctx.fillRect(-t, -s, t * 2, s * 2); }
      else { ctx.lineWidth = Math.max(1, cell * 0.08); ctx.lineCap = 'round'; ctx.rotate(v * Math.PI); ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke(); }
      ctx.restore();
    }
  },
};

const radialBurst = {
  id: 'radial-burst', name: 'Radial Burst', category: 'geometry',
  blurb: 'Spokes fire outward with trim-path reveals in a staggered sweep.',
  params: {
    spokes: P.int('Spokes', 6, 160, 72),
    inner: P.range('Inner radius', 0, 0.6, 0.12),
    length: P.range('Length', 0.1, 1, 0.85),
    stagger: P.range('Stagger', 0, 1, 0.5),
    thickness: P.range('Thickness', 0.2, 4, 1.2),
    pattern: P.select('Pattern', ['trim', 'pulse', 'dash'], 'trim'),
    twist: P.range('Twist', -1, 1, 0),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S; const N = q.spokes;
    const R0 = u * 0.5 * q.inner, R1 = Math.hypot(w, h) * 0.5 * q.length;
    ctx.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + q.twist * Math.sin(TAU * p) * 0.6;
      const lu = fract(p - (i / N) * q.stagger);
      let t0, t1;
      if (q.pattern === 'trim') { t1 = ease.outExpo(clamp(lu / 0.55)); t0 = ease.inCubic(clamp((lu - 0.2) / 0.6)); }
      else if (q.pattern === 'pulse') { const v = 0.5 + 0.5 * Math.sin(TAU * lu); t0 = 0; t1 = v; }
      else { t0 = fract(lu * 2) * 0.8; t1 = t0 + 0.2; }
      if (t1 <= t0) continue;
      ctx.strokeStyle = i % 6 === 0 ? pal.accent(0) : i % 6 === 3 ? pal.accent(1) : pal.ink;
      ctx.lineWidth = u * 0.004 * q.thickness;
      const r0 = lerp(R0, R1, t0), r1 = lerp(R0, R1, Math.min(1, t1));
      ctx.beginPath(); ctx.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0); ctx.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1); ctx.stroke();
    }
  },
};

const MORPH_SEQS = { 'circle-square-star': ['circle', 'square', 'star'], 'triangle-hexagon-circle': ['triangle', 'hexagon', 'circle'], 'star-flower-blob': ['star', 'flower', 'blob'] };
const shapeMorph = {
  id: 'shape-morph', name: 'Shape Morph', category: 'geometry',
  blurb: 'Layered outlines morph through a shape sequence with an echo delay.',
  params: {
    sequence: P.select('Sequence', [{ v: 'circle-square-star', l: 'Circle → square → star' }, { v: 'triangle-hexagon-circle', l: 'Triangle → hexagon → circle' }, { v: 'star-flower-blob', l: 'Star → flower → blob' }], 'circle-square-star'),
    points: P.int('Points', 3, 12, 5),
    layers: P.int('Layers', 1, 16, 7),
    echo: P.range('Echo delay', 0, 0.3, 0.035),
    shrink: P.range('Layer shrink', 0, 1, 0.55),
    fill: P.select('Fill', ['solid', 'outline', 'alternate'], 'alternate'),
    turns: P.int('Turns', 0, 3, 1),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S; const seq = MORPH_SEQS[q.sequence];
    const R = u * 0.36;
    for (let j = q.layers - 1; j >= 0; j--) {
      const pj = fract(p - j * q.echo); const sgt = pj * 3, idx = Math.floor(sgt) % 3;
      const m = ease.inOutCubic(smooth(0.3, 1, fract(sgt)));
      const A = SHAPES[seq[idx]], B = SHAPES[seq[(idx + 1) % 3]];
      const rr = R * (1 - (j / Math.max(1, q.layers)) * q.shrink);
      ctx.beginPath();
      for (let s = 0; s <= 200; s++) {
        const th = (s / 200) * TAU;
        const r = rr * lerp(A(th, q.points, S.seed % 7), B(th, q.points, S.seed % 7), m);
        const x = w / 2 + Math.cos(th + TAU * pj * q.turns) * r, y = h / 2 + Math.sin(th + TAU * pj * q.turns) * r;
        s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      const col = j === 0 ? pal.accent(0) : j % 2 ? pal.ink : pal.accent(1);
      const solid = q.fill === 'solid' || (q.fill === 'alternate' && j === 0);
      if (solid) { ctx.fillStyle = col; ctx.fill(); }
      else { ctx.strokeStyle = col; ctx.lineWidth = u * 0.004; ctx.stroke(); }
    }
  },
};

const lissajous = {
  id: 'lissajous', name: 'Lissajous', category: 'geometry',
  blurb: 'Harmonic figures traced by glowing heads with fading trails.',
  params: {
    freqA: P.int('Frequency A', 1, 9, 3),
    freqB: P.int('Frequency B', 1, 9, 4),
    drift: P.int('Phase drift', 0, 3, 1),
    lines: P.int('Lines', 1, 16, 6),
    spread: P.range('Spread', 0, 1, 0.3),
    trail: P.range('Trail', 0.05, 1, 0.35),
    thickness: P.range('Thickness', 0.2, 3, 1.2),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S;
    const rx = Math.min(w * 0.42, u * 0.62), ry = u * 0.42; ctx.lineCap = 'round';
    for (let j = 0; j < q.lines; j++) {
      const ph = TAU * p * q.drift + j * q.spread * 0.8;
      const pt = s => [w / 2 + rx * Math.sin(q.freqA * s * TAU + ph), h / 2 + ry * Math.sin(q.freqB * s * TAU)];
      ctx.globalAlpha = 0.08; ctx.strokeStyle = pal.ink; ctx.lineWidth = u * 0.0015;
      ctx.beginPath(); for (let s = 0; s <= 400; s++) { const [x, y] = pt(s / 400); s ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
      const head = fract(p + j / q.lines), seg = 90;
      ctx.strokeStyle = j === 0 ? pal.accent(0) : pal.pick(j + 1); ctx.lineWidth = u * 0.005 * q.thickness;
      let prev = pt(head - q.trail);
      for (let s = 1; s <= seg; s++) {
        const k = s / seg, cur = pt(head - q.trail * (1 - k));
        ctx.globalAlpha = k * k; ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(cur[0], cur[1]); ctx.stroke(); prev = cur;
      }
      ctx.globalAlpha = 1; ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(prev[0], prev[1], u * 0.006 * q.thickness + 1, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};

const moire = {
  id: 'moire', name: 'Moiré', category: 'geometry',
  blurb: 'Overlapping gratings drift against each other to make interference fields.',
  params: {
    pattern: P.select('Pattern', ['lines', 'circles', 'radial'], 'circles'),
    spacing: P.range('Spacing', 4, 40, 12, 0.5),
    weight: P.range('Line weight', 0.1, 0.9, 0.45),
    drift: P.range('Drift', 0, 30, 6, 0.5, { unit: '°' }),
    layers: P.int('Layers', 2, 3, 2),
    colour: P.toggle('Colour layer', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S; const sp = (u / 400) * q.spacing, D = Math.hypot(w, h);
    ctx.lineWidth = sp * q.weight;
    for (let L = 0; L < q.layers; L++) {
      ctx.strokeStyle = q.colour && L === 1 ? pal.accent(0) : q.colour && L === 2 ? pal.accent(1) : pal.ink;
      ctx.save(); ctx.translate(w / 2, h / 2);
      const ang = ((q.drift * Math.PI) / 180) * Math.sin(TAU * (p + L / 3)) * (L ? 1 : -1);
      if (q.pattern === 'lines') {
        ctx.rotate(ang); ctx.beginPath();
        for (let x = -D / 2; x <= D / 2; x += sp) { ctx.moveTo(x, -D / 2); ctx.lineTo(x, D / 2); }
        ctx.stroke();
      } else if (q.pattern === 'circles') {
        const o = u * 0.12 * (L ? 1 : 0.4);
        ctx.translate(Math.cos(TAU * (p + L / 3)) * o, Math.sin(TAU * (p + L / 3)) * o);
        for (let r = sp; r < D * 0.6; r += sp) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
      } else {
        ctx.rotate(ang); const n = Math.round((TAU * D * 0.3) / sp / 4) * 2;
        ctx.beginPath(); for (let i = 0; i < n; i++) { const a = (i / n) * TAU; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * D, Math.sin(a) * D); } ctx.stroke();
      }
      ctx.restore();
    }
  },
};

const isoBlocks = {
  id: 'iso-blocks', name: 'Iso Blocks', category: 'geometry',
  blurb: 'An isometric city of prisms rising and falling on a wave.',
  params: {
    grid: P.int('Grid', 4, 18, 9),
    height: P.range('Height', 0, 1, 0.6),
    wave: P.select('Wave', ['radial', 'diagonal', 'noise', 'ripple'], 'radial'),
    frequency: P.range('Frequency', 0.3, 4, 1.2),
    cycles: P.int('Cycles', 1, 3, 1),
    gap: P.range('Gap', 0, 0.5, 0.08),
    shading: P.range('Shading', 0, 1, 0.6),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, noise } = S; const n = q.grid;
    const tw = (Math.min(w, h * 1.7) * 0.78) / n, hw = tw / 2, hh = tw / 4;
    const ox = w / 2, oy = h / 2 - (n * hh) / 2 + h * 0.12;
    const g = 1 - q.gap;
    for (let s = 0; s <= 2 * (n - 1); s++) for (let i = 0; i < n; i++) {
      const j = s - i; if (j < 0 || j >= n) continue;
      const nx = (i - (n - 1) / 2) / n, ny = (j - (n - 1) / 2) / n;
      let d = q.wave === 'radial' ? Math.hypot(nx, ny) : q.wave === 'diagonal' ? (nx + ny) / 2 : q.wave === 'noise' ? noise.loop(nx * 2, ny * 2, p, 0.5) * 0.6 : Math.abs(Math.sin(Math.hypot(nx, ny) * 6)) * 0.3;
      const v = 0.5 + 0.5 * Math.cos(TAU * (p * q.cycles - d * q.frequency));
      const H = tw * (0.12 + q.height * 1.3 * v);
      const cx = ox + (i - j) * hw, cy = oy + (i + j) * hh;
      const top = pal.mix(pal.accent(1), pal.accent(0), v);
      const left = pal.mix(top, pal.ink, q.shading * 0.55), right = pal.mix(top, pal.ink, q.shading * 0.3);
      const a = hw * g, b = hh * g;
      ctx.fillStyle = left; ctx.beginPath(); ctx.moveTo(cx - a, cy); ctx.lineTo(cx, cy + b); ctx.lineTo(cx, cy + b - H); ctx.lineTo(cx - a, cy - H); ctx.fill();
      ctx.fillStyle = right; ctx.beginPath(); ctx.moveTo(cx + a, cy); ctx.lineTo(cx, cy + b); ctx.lineTo(cx, cy + b - H); ctx.lineTo(cx + a, cy - H); ctx.fill();
      ctx.fillStyle = top; ctx.beginPath(); ctx.moveTo(cx, cy - b - H); ctx.lineTo(cx + a, cy - H); ctx.lineTo(cx, cy + b - H); ctx.lineTo(cx - a, cy - H); ctx.fill();
    }
  },
};

const truchet = {
  id: 'truchet', name: 'Truchet Flow', category: 'geometry',
  blurb: 'Tiles rotate in seeded sequence so arcs reconnect into new maze paths.',
  params: {
    cells: P.int('Cells', 3, 30, 10),
    weight: P.range('Line weight', 0.05, 0.5, 0.2),
    motif: P.select('Motif', ['arcs', 'lines', 'mixed'], 'arcs'),
    flips: P.int('Flips', 1, 3, 1),
    snap: P.range('Snap', 0, 1, 0.7),
    colour: P.toggle('Colour paths', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal } = S; const cell = Math.max(w, h) / q.cells;
    const cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1;
    const ox = (w - cols * cell) / 2, oy = (h - rows * cell) / 2;
    ctx.lineWidth = cell * q.weight; ctx.lineCap = 'round';
    const turns = q.flips * 2, dur = lerp(0.3, 0.08, q.snap) / q.flips;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const base = hash(S.seed, i, j) < 0.5 ? 0 : 1;
      const off = hash(S.seed, i, j, 4) / turns;
      let rot = base * (Math.PI / 2);
      for (let k = 0; k < turns; k++) { const t0 = fract(off + k / turns); const lp = local(fract(p - t0 + 1), 0, dur); rot += ease.inOutCubic(lp) * (Math.PI / 2); }
      const kind = q.motif === 'mixed' ? (hash(i, j, S.seed, 7) < 0.5 ? 'arcs' : 'lines') : q.motif;
      ctx.strokeStyle = q.colour ? pal.pick(Math.floor(hash(i, j, 11) * 4)) : pal.ink;
      ctx.save(); ctx.translate(ox + (i + 0.5) * cell, oy + (j + 0.5) * cell); ctx.rotate(rot);
      const c = cell / 2; ctx.beginPath();
      if (kind === 'arcs') { ctx.arc(-c, -c, c, 0, Math.PI / 2); ctx.moveTo(0, c); ctx.arc(c, c, c, Math.PI, Math.PI * 1.5); }
      else { ctx.moveTo(-c, -c); ctx.lineTo(c, c); }
      ctx.stroke(); ctx.restore();
    }
  },
};

// =====================================================================
// PARTICLES & PHYSICS
// =====================================================================
const particleForm = {
  id: 'particle-form', gpu: true, name: 'Particle Form', category: 'particles',
  blurb: 'Thousands of particles assemble into type, burst on a beat, and re-form.',
  params: {
    text: P.text('Text', 'FORM', 20),
    font: P.select('Font', FONT_OPTS, 'anybody'),
    count: P.int('Count', 300, 200000, 2200, { log: true, randMax: 4000, cpuMax: 4000 }),
    burst: P.range('Burst', 0, 1, 0.6),
    turbulence: P.range('Turbulence', 0, 1, 0.5),
    dot: P.range('Dot size', 0.3, 3, 1),
    shape: P.select('Shape', ['square', 'circle', 'streak'], 'square'),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u, noise } = S;
    const pts = sampleText(q.text || ' ', fontCss(q.font), 800, w, h, Math.min(q.count, 4000), 0.8);
    let E = 0;
    if (p >= 0.45 && p < 0.6) E = ease.outCubic(local(p, 0.45, 0.6));
    else if (p >= 0.6 && p < 0.97) E = 1 - spring(local(p, 0.6, 0.97), 0.35);
    const ds = Math.max(1.2, u * 0.0032 * q.dot);
    for (let i = 0; i < pts.length; i++) {
      const [tx, ty] = pts[i]; const r = hash(S.seed, i);
      let x = tx, y = ty;
      const idle = u * 0.002; x += noise.loop(tx * 0.01, ty * 0.01, p, 0.3) * idle; y += noise.loop(ty * 0.01 + 9, tx * 0.01, p, 0.3) * idle;
      if (E !== 0) {
        const dx = tx - w / 2, dy = ty - h / 2, dl = Math.hypot(dx, dy) || 1;
        const pw = q.burst * u * 0.55 * (0.35 + r);
        const tn = q.turbulence * u * 0.3;
        const ax = noise.n3(tx * 0.006, ty * 0.006, 1.7), ay = noise.n3(tx * 0.006 + 40, ty * 0.006, 3.1);
        x += E * (dx / dl * pw + ax * tn); y += E * (dy / dl * pw + ay * tn);
      }
      ctx.fillStyle = r < 0.14 ? pal.accent(0) : r < 0.2 ? pal.accent(1) : pal.ink;
      if (q.shape === 'circle') { ctx.beginPath(); ctx.arc(x, y, ds * 0.6, 0, TAU); ctx.fill(); }
      else if (q.shape === 'streak' && Math.abs(E) > 0.02) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = ds * 0.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lerp(x, tx, 0.25), lerp(y, ty, 0.25)); ctx.stroke(); }
      else ctx.fillRect(x - ds / 2, y - ds / 2, ds, ds);
    }
  },
};

const flowField = {
  id: 'flow-field', gpu: true, name: 'Flow Field', category: 'particles',
  blurb: 'Particles trace curl-like currents through a slowly turning noise field.',
  params: {
    count: P.int('Count', 200, 60000, 700, { log: true, randMax: 2500, cpuMax: 2500 }),
    scale: P.range('Field scale', 0.2, 3, 1),
    step: P.range('Step length', 0.2, 2, 1),
    trail: P.int('Trail', 4, 40, 18),
    weight: P.range('Line weight', 0.2, 3, 1),
    colour: P.select('Colour', ['mono', 'palette', 'speed'], 'palette'),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u, noise } = S;
    const fs = 0.0035 * q.scale * (600 / u), st = u * 0.005 * q.step, maxSteps = 56;
    ctx.lineWidth = u * 0.0018 * q.weight; ctx.lineCap = 'round';
    const n = Math.min(q.count, 2500);
    for (let i = 0; i < n; i++) {
      const a = fract(p + hash(S.seed, i, 1));
      let x = hash(S.seed, i, 2) * w, y = hash(S.seed, i, 3) * h;
      const steps = Math.floor(a * maxSteps); const trailStart = steps - q.trail;
      const path = [];
      for (let s = 0; s < steps; s++) {
        const th = noise.loop(x * fs, y * fs, p, 0.25) * TAU * 1.3;
        x += Math.cos(th) * st; y += Math.sin(th) * st;
        if (s >= trailStart) path.push(x, y);
      }
      if (path.length < 4) continue;
      const alpha = Math.sin(Math.PI * a);
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = q.colour === 'mono' ? pal.ink : q.colour === 'palette' ? pal.pick(Math.floor(hash(i, 5) * 4)) : pal.mix(pal.ink, pal.accent(0), clamp(Math.hypot(path[path.length - 2] - path[0], path[path.length - 1] - path[1]) / (st * q.trail)));
      ctx.beginPath(); ctx.moveTo(path[0], path[1]); for (let k = 2; k < path.length; k += 2) ctx.lineTo(path[k], path[k + 1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },
};

const orbitalSwarm = {
  id: 'orbital-swarm', gpu: true, name: 'Orbital Swarm', category: 'particles',
  blurb: 'A spiral galaxy of particles with differential rotation and a glowing core.',
  params: {
    count: P.int('Count', 300, 200000, 2600, { log: true, randMax: 5000, cpuMax: 5000 }),
    arms: P.int('Arms', 1, 8, 3),
    twist: P.range('Twist', 0, 4, 1.6),
    spin: P.int('Spin', 1, 4, 1),
    spread: P.range('Spread', 0, 1, 0.35),
    tilt: P.range('Tilt', 0.2, 1, 0.55),
    core: P.toggle('Core glow', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S; const R = Math.min(u * 0.48, w * 0.46);
    if (q.core) {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, R * 0.45);
      g.addColorStop(0, pal.alpha(pal.accent(1), 0.55)); g.addColorStop(1, pal.alpha(pal.accent(1), 0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    const rng = mulberry32(S.seed);
    const n = Math.min(q.count, 5000);
    for (let i = 0; i < n; i++) {
      const r = Math.pow(rng(), 0.6), arm = i % q.arms, gz = gauss(rng), sz = rng(), wob = rng();
      const base = (arm / q.arms) * TAU + r * q.twist * TAU + gz * q.spread * (1.1 - r * 0.6);
      const m = q.spin * (1 + Math.floor((1 - r) * 3));
      const ang = base + TAU * p * m;
      const rr = r * R * (1 + 0.03 * Math.sin(TAU * (p * 2 + wob)));
      const x = w / 2 + Math.cos(ang) * rr, y = h / 2 + Math.sin(ang) * rr * q.tilt;
      const s = u * (0.0015 + sz * 0.0035);
      ctx.fillStyle = r < 0.25 ? pal.accent(1) : sz > 0.92 ? pal.accent(0) : pal.ink;
      ctx.globalAlpha = 0.35 + 0.65 * (1 - r * 0.6);
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  },
};

const fireworks = {
  id: 'fireworks', name: 'Fireworks', category: 'particles',
  blurb: 'Bursts of sparks with gravity and air drag, solved in closed form.',
  params: {
    bursts: P.int('Bursts', 1, 8, 4),
    sparks: P.int('Sparks', 20, 240, 110),
    gravity: P.range('Gravity', 0, 1, 0.5),
    drag: P.range('Drag', 0, 1, 0.45),
    power: P.range('Power', 0.2, 1.5, 0.8),
    trail: P.range('Trail', 0, 1, 0.5),
    flicker: P.toggle('Flicker', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S; const life = Math.min(0.85, 0.35 + 1.6 / q.bursts);
    const k = 0.4 + q.drag * 3, g = u * 0.9 * q.gravity;
    ctx.lineCap = 'round';
    for (let j = 0; j < q.bursts; j++) {
      const t0 = j / q.bursts + hash(S.seed, j) * 0.08;
      const a = fract(p - t0); if (a > life) continue;
      const cx = w * (0.18 + 0.64 * hash(S.seed, j, 1)), cy = h * (0.2 + 0.4 * hash(S.seed, j, 2));
      const T = a * 3, fade = 1 - a / life, col = pal.accent(j);
      const pos = (vx, vy, tt) => { const e = (1 - Math.exp(-k * tt)) / k; return [cx + vx * e, cy + vy * e + (g / k) * (tt - e)]; };
      for (let i = 0; i < q.sparks; i++) {
        const ang = hash(j, i, S.seed) * TAU, sp = q.power * u * 0.9 * (0.45 + 0.55 * Math.sqrt(hash(i, j, 3)));
        const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
        const [x1, y1] = pos(vx, vy, T), [x0, y0] = pos(vx, vy, Math.max(0, T - 0.05 - q.trail * 0.3));
        let al = fade; if (q.flicker) al *= 0.55 + 0.45 * hash(i, j, Math.floor(p * 90));
        ctx.globalAlpha = al; ctx.strokeStyle = i % 7 === 0 ? pal.ink : col; ctx.lineWidth = u * 0.003;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },
};

// Bounce: ball falls from above, bounces with restitution, settles, then shrinks away.
function bounceY(q, H) {
  const g = 2 * H / (0.2 * 0.2) * lerp(0.6, 1.4, q.gravity) * 0.75;
  let t = Math.sqrt(2 * H / g); const events = [{ t: 0, v0: 0, y0: H, fall: true }];
  let v = Math.sqrt(2 * g * H) * q.restitution, n = 0;
  while (v > 0.02 * Math.sqrt(2 * g * H) && t < 0.8 && n < 30) { events.push({ t, v0: v }); t += 2 * v / g; v *= q.restitution; n++; }
  return { g, events, settle: t };
}
const bounce = {
  id: 'bounce', name: 'Bounce', category: 'particles',
  blurb: 'Balls drop, squash on impact and settle with physically decaying bounces.',
  params: {
    count: P.int('Count', 1, 24, 7),
    gravity: P.range('Gravity', 0, 1, 0.6),
    restitution: P.range('Restitution', 0.2, 0.85, 0.6),
    squash: P.range('Squash', 0, 1, 0.6),
    size: P.range('Size', 0.2, 1.5, 0.7),
    shape: P.select('Shape', ['circle', 'square', 'ring'], 'circle'),
    floor: P.toggle('Floor line', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S; const floorY = h * 0.84;
    const r = Math.min((w / q.count) * 0.32, u * 0.07) * q.size;
    const H = floorY - r + r * 2.2, sim = bounceY(q, H);
    if (q.floor) { ctx.strokeStyle = pal.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = Math.max(1, u * 0.002); ctx.beginPath(); ctx.moveTo(w * 0.05, floorY); ctx.lineTo(w * 0.95, floorY); ctx.stroke(); ctx.globalAlpha = 1; }
    for (let i = 0; i < q.count; i++) {
      const lq = fract(p - (i / q.count) * 0.22);
      let hgt, vel = 0, impact = 0;
      if (lq < sim.events[1]?.t || sim.events.length === 1) { hgt = H - 0.5 * sim.g * lq * lq; vel = sim.g * lq; }
      else {
        let ev = sim.events[1];
        for (let e = 1; e < sim.events.length; e++) if (lq >= sim.events[e].t) ev = sim.events[e];
        const dt = lq - ev.t; hgt = ev.v0 * dt - 0.5 * sim.g * dt * dt; vel = Math.abs(ev.v0 - sim.g * dt);
        if (lq > sim.settle || hgt < 0) { hgt = 0; vel = 0; }
        impact = Math.exp(-dt * 40) * (ev.v0 / Math.sqrt(2 * sim.g * H));
      }
      hgt = Math.max(0, hgt);
      const vmax = Math.sqrt(2 * sim.g * H), stretch = q.squash * 0.35 * (vel / vmax) * (hgt > r * 0.2 ? 1 : 0);
      const sq = q.squash * 0.5 * impact;
      const sy = 1 + stretch - sq, sx = 1 / Math.sqrt(Math.max(0.3, sy));
      const leave = ease.inCubic(local(lq, 0.86, 0.98)); const sc = 1 - leave; if (sc <= 0) continue;
      const x = (i + 0.5) / q.count * w, y = floorY - hgt - r * sy * sc;
      ctx.globalAlpha = 0.18 * clamp(1 - hgt / H) * sc; ctx.fillStyle = pal.ink;
      ctx.beginPath(); ctx.ellipse(x, floorY + r * 0.12, r * sx * (1 - 0.5 * hgt / H) * sc, r * 0.14 * sc, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(x, y); ctx.scale(sx * sc, sy * sc);
      ctx.fillStyle = pal.pick(i + 1); ctx.strokeStyle = ctx.fillStyle;
      if (q.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); }
      else if (q.shape === 'square') ctx.fillRect(-r, -r, r * 2, r * 2);
      else { ctx.lineWidth = r * 0.3; ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
  },
};

const ropeChain = {
  id: 'rope-chain', name: 'Rope Chain', category: 'particles',
  blurb: 'Hanging chains swing with follow-through, each link lagging the one above.',
  params: {
    strands: P.int('Strands', 1, 16, 7),
    links: P.int('Links', 8, 60, 26),
    amplitude: P.range('Amplitude', 0, 1, 0.55),
    lag: P.range('Lag', 0, 1, 0.5),
    cycles: P.int('Cycles', 1, 3, 1),
    mode: P.select('Mode', ['pendulum', 'whip', 'wave'], 'pendulum'),
    taper: P.toggle('Taper', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S; const n = q.links; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let s = 0; s < q.strands; s++) {
      const wave = q.mode === 'wave';
      let x = wave ? w * 0.06 : (s + 0.5) / q.strands * w, y = wave ? (s + 0.5) / q.strands * h : h * 0.06;
      const seg = (wave ? w * 0.88 : h * 0.72) / n;
      const pts = [[x, y]];
      for (let j = 1; j <= n; j++) {
        const f = j / n, fall = q.mode === 'whip' ? f * f * 2.2 : q.mode === 'wave' ? 1 : 0.35 + f;
        const th = q.amplitude * 0.9 * fall * Math.sin(TAU * (p * q.cycles - f * q.lag - s * 0.07));
        if (wave) { x += Math.cos(th) * seg; y += Math.sin(th) * seg; } else { x += Math.sin(th) * seg; y += Math.cos(th) * seg; }
        pts.push([x, y]);
      }
      const col = s % 3 === 1 ? pal.accent(0) : s % 3 === 2 ? pal.accent(1) : pal.ink;
      ctx.strokeStyle = col; ctx.fillStyle = col;
      for (let j = 1; j < pts.length; j++) {
        ctx.lineWidth = u * 0.008 * (q.taper ? 1 - (j / pts.length) * 0.75 : 0.6);
        ctx.beginPath(); ctx.moveTo(pts[j - 1][0], pts[j - 1][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke();
      }
      const [ex, ey] = pts[pts.length - 1]; ctx.beginPath(); ctx.arc(ex, ey, u * 0.018, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], u * 0.006, 0, TAU); ctx.fill();
    }
  },
};

const plexus = {
  id: 'plexus', name: 'Plexus', category: 'particles',
  blurb: 'Drifting points connect to their neighbours in a living network.',
  params: {
    points: P.int('Points', 20, 260, 120),
    distance: P.range('Link distance', 0.05, 0.4, 0.17),
    drift: P.range('Drift', 0, 1, 0.5),
    dot: P.range('Dot size', 0.3, 3, 1),
    lines: P.range('Line strength', 0, 1, 0.6),
    depth: P.toggle('Depth', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u, noise } = S; const D = u * q.distance, D2 = D * D;
    const pts = [];
    for (let i = 0; i < q.points; i++) {
      const z = q.depth ? hash(S.seed, i, 9) : 0.6;
      const bx = hash(S.seed, i, 1) * w, by = hash(S.seed, i, 2) * h;
      const dx = noise.loop(i * 1.7, 0.3, p, 0.35) * u * 0.18 * q.drift * (0.5 + z), dy = noise.loop(0.7, i * 1.3, p, 0.35) * u * 0.18 * q.drift * (0.5 + z);
      pts.push([bx + dx, by + dy, z]);
    }
    ctx.lineWidth = Math.max(0.6, u * 0.0012); ctx.strokeStyle = pal.ink;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], d2 = dx * dx + dy * dy;
      if (d2 < D2) { ctx.globalAlpha = (1 - Math.sqrt(d2) / D) * q.lines * (0.4 + 0.6 * (pts[i][2] + pts[j][2]) / 2); ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke(); }
    }
    for (let i = 0; i < pts.length; i++) {
      const [x, y, z] = pts[i]; ctx.globalAlpha = 0.5 + 0.5 * z;
      ctx.fillStyle = hash(i, S.seed, 4) < 0.2 ? pal.accent(0) : pal.ink;
      ctx.beginPath(); ctx.arc(x, y, u * 0.004 * q.dot * (0.5 + z), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
};

// =====================================================================
// GENERATIVE
// =====================================================================
const ridgelines = {
  id: 'ridgelines', name: 'Ridgelines', category: 'generative',
  blurb: 'Stacked noise horizons with occlusion, like a pulsar plot or mountain range.',
  params: {
    lines: P.int('Lines', 8, 90, 44),
    amplitude: P.range('Amplitude', 0, 1, 0.55),
    scale: P.range('Noise scale', 0.3, 4, 1.4),
    focus: P.range('Centre focus', 0, 1, 0.7),
    detail: P.int('Detail', 1, 4, 2),
    fill: P.toggle('Occlude', true),
    weight: P.range('Line weight', 0.3, 3, 1),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u, noise } = S; const mx = w * 0.08, top = h * 0.16, bot = h * 0.9;
    const cols = 160; ctx.lineWidth = Math.max(0.8, u * 0.0022 * q.weight); ctx.lineJoin = 'round';
    for (let k = 0; k < q.lines; k++) {
      const y0 = lerp(top, bot, k / (q.lines - 1)); ctx.beginPath(); ctx.moveTo(mx, y0);
      for (let c = 0; c <= cols; c++) {
        const f = c / cols, x = lerp(mx, w - mx, f);
        const bell = Math.pow(Math.max(0, 1 - Math.pow((f - 0.5) * 2, 2)), 1 + q.focus * 3);
        let n = 0, amp = 1, fr = 1;
        for (let o = 0; o < q.detail; o++) { n += amp * (noise.loop(f * 3 * q.scale * fr, k * 0.19 * fr, p, 0.45) * 0.5 + 0.5); amp *= 0.5; fr *= 2.1; }
        ctx.lineTo(x, y0 - bell * n * q.amplitude * u * 0.32);
      }
      ctx.lineTo(w - mx, y0);
      if (q.fill) { ctx.fillStyle = pal.bg; ctx.fill(); }
      ctx.strokeStyle = k % 11 === 5 ? pal.accent(0) : pal.ink; ctx.stroke();
    }
  },
};

const halftone = {
  id: 'halftone', name: 'Halftone Wave', category: 'generative',
  blurb: 'A rotated dot screen modulated by orbiting interference sources.',
  params: {
    cell: P.range('Cell size', 0.015, 0.08, 0.03, 0.001),
    sources: P.int('Sources', 1, 5, 3),
    frequency: P.range('Frequency', 0.5, 6, 2.2),
    angle: P.range('Screen angle', 0, 90, 15, 1, { unit: '°' }),
    shape: P.select('Dot', ['circle', 'square', 'line'], 'circle'),
    contrast: P.range('Contrast', 0, 1, 0.55),
    duotone: P.toggle('Duotone', true),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S; const cs = u * q.cell, D = Math.hypot(w, h) / 2;
    const src = [];
    for (let s = 0; s < q.sources; s++) { const a = TAU * (p * (s % 2 ? 1 : -1) + s / q.sources); src.push([w / 2 + Math.cos(a) * u * 0.28, h / 2 + Math.sin(a) * u * 0.22]); }
    const an = (q.angle * Math.PI) / 180, ca = Math.cos(an), sa = Math.sin(an);
    for (let gy = -D; gy <= D; gy += cs) for (let gx = -D; gx <= D; gx += cs) {
      const x = w / 2 + gx * ca - gy * sa, y = h / 2 + gx * sa + gy * ca;
      if (x < -cs || y < -cs || x > w + cs || y > h + cs) continue;
      let v = 0; for (const [sx, sy] of src) v += 0.5 + 0.5 * Math.cos(TAU * (Math.hypot(x - sx, y - sy) / u * q.frequency - p));
      v /= q.sources; v = q.contrast > 0 ? smooth(0.5 - (1 - q.contrast) / 2 - 0.001, 0.5 + (1 - q.contrast) / 2 + 0.001, v) : v;
      const r = v * cs * 0.55; if (r < 0.3) continue;
      ctx.fillStyle = q.duotone && v > 0.7 ? pal.accent(0) : pal.ink;
      if (q.shape === 'circle') { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      else if (q.shape === 'square') { ctx.save(); ctx.translate(x, y); ctx.rotate(an); ctx.fillRect(-r, -r, r * 2, r * 2); ctx.restore(); }
      else { ctx.save(); ctx.translate(x, y); ctx.rotate(an); ctx.fillRect(-cs / 2, -r * 0.6, cs, r * 1.2); ctx.restore(); }
    }
  },
};

const metaballs = {
  id: 'metaballs', gpu: true, name: 'Metaballs', category: 'generative',
  blurb: 'Liquid blobs merge and split along looping orbits.',
  params: {
    blobs: P.int('Blobs', 3, 16, 7),
    size: P.range('Size', 0.3, 2, 1),
    threshold: P.range('Threshold', 0.4, 1.6, 1),
    cycles: P.int('Cycles', 1, 3, 1),
    look: P.select('Look', ['fill', 'rings', 'duotone'], 'duotone'),
    softness: P.range('Softness', 0, 1, 0.15),
    resolution: P.select('Resolution', ['low', 'medium', 'high', 'full'], 'medium'),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal } = S; const gw = { low: 110, medium: 170, high: 250, full: 250 }[q.resolution];
    const gh = Math.max(8, Math.round(gw * h / w));
    const cv = memo(`mb|${gw}|${gh}`, () => makeCanvas(gw, gh)); const x = cv.getContext('2d');
    const img = x.createImageData(gw, gh), d = img.data;
    const B = [], m = Math.min(gw, gh);
    for (let i = 0; i < q.blobs; i++) {
      const mx = 1 + (i % q.cycles), my = 1 + ((i + 1) % (q.cycles + 1));
      const cx = gw / 2 + Math.sin(TAU * (p * mx + hash(S.seed, i))) * gw * (0.18 + 0.2 * hash(i, 2));
      const cy = gh / 2 + Math.cos(TAU * (p * my + hash(S.seed, i, 3))) * gh * (0.16 + 0.2 * hash(i, 4));
      const r = m * 0.09 * q.size * (0.6 + 0.8 * hash(S.seed, i, 5)); B.push([cx, cy, r * r]);
    }
    const c0 = pal.rgbOf(pal.accent(0)), c1 = pal.rgbOf(pal.accent(1)), ci = pal.rgbOf(pal.ink);
    const soft = 0.02 + q.softness * 0.35, th = q.threshold;
    for (let yy = 0; yy < gh; yy++) for (let xx = 0; xx < gw; xx++) {
      let f = 0; for (const [bx, by, r2] of B) { const dx = xx - bx, dy = yy - by; f += r2 / (dx * dx + dy * dy + 1); }
      const k = (yy * gw + xx) * 4; let a = 0, col = c0;
      if (q.look === 'fill') a = smooth(th - soft, th + soft, f);
      else if (q.look === 'rings') { const band = Math.abs(fract(f * 3) - 0.5); a = f > th * 0.4 ? smooth(0.18 + soft * 0.3, 0.1, band) : 0; col = f > th ? c0 : ci; }
      else { a = smooth(th * 0.6 - soft, th * 0.6 + soft, f); col = f > th * 1.25 ? c1 : c0; }
      d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = Math.round(a * 255);
    }
    x.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(cv, 0, 0, w, h);
  },
};

const kaleidoscope = {
  id: 'kaleidoscope', name: 'Kaleidoscope', category: 'generative',
  blurb: 'Shapes stream outward through mirrored wedges that turn as one.',
  params: {
    segments: P.int('Segments', 3, 16, 8),
    shapes: P.int('Shapes', 3, 24, 12),
    type: P.select('Shape', ['circle', 'triangle', 'rect', 'mixed', 'lines'], 'mixed'),
    turns: P.int('Turns', 0, 3, 1),
    pulse: P.range('Zoom pulse', 0, 1, 0.3),
    mirror: P.toggle('Mirror', true),
    size: P.range('Shape size', 0.3, 2.5, 1),
  },
  render(ctx, S) {
    const { w, h, p, P: q, pal, u } = S; const N = q.segments, A = TAU / N, R = Math.hypot(w, h) * 0.55;
    const zoom = 1 + q.pulse * 0.25 * Math.sin(TAU * p);
    for (let k = 0; k < N; k++) {
      ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(k * A + TAU * p * q.turns / N); ctx.scale(zoom, zoom);
      if (q.mirror && k % 2) ctx.scale(1, -1);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -A / 2 - 0.002, A / 2 + 0.002); ctx.closePath(); ctx.clip();
      for (let m = 0; m < q.shapes; m++) {
        const rho = R * fract(hash(S.seed, m) + p), th = (hash(S.seed, m, 2) - 0.5) * A * 0.9 + 0.1 * Math.sin(TAU * (p + m / q.shapes));
        const s = u * 0.02 * q.size * (0.6 + (rho / R) * 3.2);
        const x = Math.cos(th) * rho, y = Math.sin(th) * rho;
        const kind = q.type === 'mixed' ? ['circle', 'triangle', 'rect'][m % 3] : q.type;
        ctx.globalAlpha = smooth(0, 0.08, rho / R) * (1 - smooth(0.85, 1, rho / R));
        ctx.fillStyle = pal.pick(m); ctx.strokeStyle = ctx.fillStyle;
        ctx.save(); ctx.translate(x, y); ctx.rotate(TAU * p * (m % 2 ? 1 : -1) + m);
        if (kind === 'circle') { ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill(); }
        else if (kind === 'triangle') { ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.87, s * 0.5); ctx.lineTo(-s * 0.87, s * 0.5); ctx.fill(); }
        else if (kind === 'rect') ctx.fillRect(-s, -s * 0.5, s * 2, s);
        else { ctx.lineWidth = Math.max(1, s * 0.2); ctx.beginPath(); ctx.moveTo(-s * 1.5, 0); ctx.lineTo(s * 1.5, 0); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  },
};

const STYLES = [
  staggerRise, widthWave, typeTunnel, slitScan, marqueeStack, scramble,
  orbitRings, gridPulse, radialBurst, shapeMorph, lissajous, moire, isoBlocks, truchet,
  particleForm, flowField, orbitalSwarm, fireworks, bounce, ropeChain, plexus,
  ridgelines, halftone, metaballs, kaleidoscope,
];

function getStyle(id) { return STYLES.find(s => s.id === id) || STYLES[0]; }

// Look helpers — the public parameter API used by the shell and exporter.
function defaultLook(styleId, shared) {
  const st = getStyle(styleId);
  return { styleId: st.id, params: defaults(st.params), shared: shared ? sanitize(shared, SHARED_SCHEMA) : defaults(SHARED_SCHEMA) };
}
function sanitizeLook(look) {
  const st = getStyle(look && look.styleId);
  return { styleId: st.id, params: sanitize(look && look.params, st.params), shared: sanitize(look && look.shared, SHARED_SCHEMA) };
}
function mutateLook(look, strength, locks, rng, includeColour) {
  const st = getStyle(look.styleId);
  const a = mutate(look.params, st.params, strength, locks, rng);
  const b = mutate(look.shared, SHARED_SCHEMA, strength, locks, rng);
  const shared = { ...b.values };
  const changed = [...a.changed, ...b.changed];
  if (!locks.has('seed')) { shared.seed = 1 + Math.floor(rng() * 9998); changed.push('seed'); }
  if (includeColour === true && !locks.has('palette') && rng() < 0.6) { shared.palette = PALETTES[Math.floor(rng() * PALETTES.length)].id; changed.push('palette'); }
  return { look: { styleId: st.id, params: a.values, shared }, changed };
}
function randomizeLook(look, locks, rng) {
  const st = getStyle(look.styleId);
  const a = randomize(look.params, st.params, locks, rng);
  const shared = { ...look.shared };
  if (!locks.has('seed')) shared.seed = 1 + Math.floor(rng() * 9998);
  return { look: { styleId: st.id, params: a.values, shared }, changed: a.changed };
}
function frameState(look, w, h, t) {
  const st = getStyle(look.styleId), sh = look.shared;
  const L = sh.loop || 6;
  const p = fract((t / L) * sh.tempo + sh.phase);
  return { style: st, S: { w, h, u: Math.min(w, h), t, p, L, tempo: sh.tempo, P: look.params, seed: sh.seed, noise: createNoise(sh.seed) } };
}

return { CATEGORIES, SHARED_SCHEMA, STYLES, getStyle, defaultLook, sanitizeLook, mutateLook, randomizeLook, frameState, mulberry32, fontCss };

})();

