// Posterflow generator: writes ../../src/posterflow/manifest.json, the sequences and styles/<id>.glsl for the
// body/*.glsl styles (head.glsl prepended). The three v1 styles live directly in the kit folder.
// Run: node build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(HERE, '../../src/posterflow');
const R = (label, min, max, def, o = {}) => ({ type: 'range', label, min, max, def, step: 0.01, ...o });
const I = (label, min, max, def, o = {}) => ({ type: 'int', label, min, max, def, ...o });
const T = (label, def, o = {}) => ({ type: 'toggle', label, def, ...o });
const S = (label, options, def, o = {}) => ({ type: 'select', label, options, def, mutate: 0, ...o });
const turns = (max = 3) => I('Cycles / loop', 1, max, 1, { group: 'Motion', hint: 'Whole cycles per loop; the loop always closes.' });
const flow = (warp = 1.1, scale = 1.4) => ({
  scale: R('Flow scale', 0.4, 4, scale, { group: 'Flow', log: true }),
  warp: R('Warp', 0, 2.5, warp, { group: 'Flow' }),
});
const poster = (g = 'Poster') => ({
  bands: I('Bands', 2, 16, 7, { group: g, randMax: 10, hint: 'Number of tonal steps.' }),
  soft: R('Edge softness', 0, 1, 0.2, { group: g, hint: '0 is a hard posterize edge.' }),
  hue: R('Hue steps', 0, 1, 0.35, { group: g, hint: 'Quantize each colour channel as well as brightness.' }),
  mode: S('Colour', [{ v: 'source', l: 'Source' }, { v: 'pal', l: 'Palette ramp' }, { v: 'mix', l: 'Mix' }], 'source', { group: g }),
  palMix: R('Palette mix', 0, 1, 0.5, { group: g, show: { param: 'mode', is: 'mix' } }),
  veins: R('Veins', 0, 1, 0.4, { group: g, hint: 'Thin dark lines along band edges.' }),
  veinW: R('Vein width', 0.5, 4, 1.1, { group: g, unit: 'px', log: true }),
  vein: { type: 'color', label: 'Vein colour', def: '#06070C', group: g },
});
const finish = (vig = 0.25, grain = 0.3) => ({
  vignette: R('Vignette', 0, 0.6, vig, { group: 'Lens', randMax: 0.5 }),
  exposure: R('Exposure', 0.5, 1.6, 1, { group: 'Lens', mutate: 0.2 }),
  grain: R('Grain', 0, 1, grain, { group: 'Lens', randMax: 0.6 }),
});
const pal = (id, name, bg, ink, a) => ({ id, name, bg, ink, a });
const st = (id, name, palette, tags, blurb, cost, params, extra = {}) => ({
  id, name, group: 'Posterflow', palette, tags: ['media', ...tags], blurb, cost, flash: false,
  passes: [{ src: `styles/${id}.glsl` }], params, ...extra,
});

const styles = [
  st('marble-flow', 'Marble Flow', 'tidal', ['posterize', 'liquid', 'marble'], 'Pours your image through a looping flow-warp and snaps it to quantized colour bands with vein lines.', 1,
    { ...flow(), turns: turns(), swirl: R('Vortex', 0, 2, 0.6, { group: 'Flow' }), drift: R('Drift', 0, 1.5, 0.35, { group: 'Motion' }), ...poster(), ...finish() }),
  st('streak-melt', 'Streak Melt', 'ember', ['smear', 'chromatic', 'streak'], 'A looping mask opens streaks that drag the image along a direction, with RGB split and optional slabs.', 1.6, {
    angle: R('Angle', -180, 180, 8, { group: 'Streak', unit: '°', step: 1 }),
    length: R('Length', 0, 1.2, 0.5, { group: 'Streak' }),
    thresh: R('Coverage', 0.1, 0.9, 0.45, { group: 'Streak', hint: 'Higher = fewer streaks.' }),
    scale: R('Streak scale', 0.5, 8, 2.4, { group: 'Streak', log: true }),
    slabs: I('Slabs', 0, 40, 14, { group: 'Streak', hint: '0 = smooth, else sheared strips.', randMax: 24 }),
    jitter: R('Slab jitter', 0, 2, 0.8, { group: 'Streak', show: { param: 'slabs', gt: 0 } }),
    taps: I('Smear taps', 2, 12, 8, { group: 'Quality', mutate: 0 }),
    split: R('RGB split', 0, 2, 0.8, { group: 'Streak' }),
    turns: turns(), ...poster(), ...finish() }),
  st('ink-drag', 'Ink Drag', 'rosewater', ['curl', 'ink', 'streamline'], 'Carries colour along looping curl streamlines, like ink drawn through water, then bands it.', 2.4, {
    scale: R('Flow scale', 0.4, 4, 1.3, { group: 'Flow', log: true }),
    drag: R('Drag', 0, 3, 1.4, { group: 'Flow' }),
    steps: I('Steps', 2, 14, 8, { group: 'Quality', mutate: 0, hint: 'More steps = longer, smoother streams.' }),
    turns: turns(), ...poster(), ...finish() }),
  st('thin-film', 'Thin Film', 'mineral', ['iridescent', 'halo', 'oil'], 'Iridescent halos bloom wherever brightness changes fast, over a soft liquid warp, like oil film on glass.', 1.8, {
    ...flow(0.9, 1.1), turns: turns(),
    radius: R('Film reach', 0.005, 0.12, 0.04, { group: 'Film', log: true, hint: 'How far the halo spreads from an edge.' }),
    gain: R('Edge gain', 0.5, 8, 3, { group: 'Film', log: true }),
    thick: R('Thickness', 0, 8, 3, { group: 'Film', hint: 'More colour bands per unit of edge.' }),
    hue: R('Hue shift', 0, 1, 0.1, { group: 'Film' }),
    amount: R('Amount', 0, 1.5, 1, { group: 'Film' }),
    glow: R('Bright rim', 0, 3, 0.8, { group: 'Film' }),
    ...finish(0.3, 0.45) }),
  st('mosaic-tide', 'Mosaic Tide', 'tidal', ['pixel', 'posterize', 'stairs'], 'Block-sampled, dithered colour stairs over a liquid warp: water and fabric turn into poster pixels.', 1, {
    ...flow(0.8, 1.2), turns: turns(),
    cells: I('Blocks', 8, 160, 56, { group: 'Poster', hint: 'Blocks across the short side.', randMax: 110 }),
    bands: I('Bands', 2, 12, 5, { group: 'Poster', randMax: 9 }),
    soft: R('Edge softness', 0, 1, 0.05, { group: 'Poster' }),
    dither: R('Dither', 0, 1.5, 0.3, { group: 'Poster' }),
    amount: R('Amount', 0, 1, 1, { group: 'Poster' }),
    gap: R('Block gap', 0, 0.3, 0, { group: 'Poster', hint: 'Dark mortar between blocks.' }),
    ...finish(0.2, 0.2) }),
  st('gill-lines', 'Gill Lines', 'rosewater', ['engrave', 'lines', 'petal'], 'Engraved iso-lines of the warped brightness in contour, parallel or radial patterns; shadows thicken.', 1.2, {
    ...flow(0.7, 1.0), turns: turns(),
    pattern: S('Pattern', ['contour', 'parallel', 'radial'], 'radial', { group: 'Lines' }),
    lines: R('Line count', 6, 120, 30, { group: 'Lines', log: true, randMax: 90 }),
    angle: R('Angle', -180, 180, 20, { group: 'Lines', unit: '°', step: 1, show: { param: 'pattern', is: 'parallel' } }),
    follow: R('Follow tone', 0, 3, 0.35, { group: 'Lines', hint: 'How strongly lines bend with the image.', show: { param: 'pattern', not: 'contour' } }),
    weight: R('Weight', 0.2, 1.6, 0.5, { group: 'Lines' }),
    inkMix: R('Ink vs colour', 0, 1, 0.15, { group: 'Lines' }),
    ghost: R('Ghost image', 0, 0.6, 0.22, { group: 'Lines', hint: 'Let the source show faintly between lines.' }),
    ...finish(0.3, 0.3) }),
  st('satin-pour', 'Satin Pour', 'ember', ['silk', 'chrome', 'sheen'], 'A soft height field refracts the image and is lit with a stretched sheen: silk, satin, liquid chrome.', 2.2, {
    scale: R('Fold scale', 0.3, 3, 0.9, { group: 'Form', log: true }),
    turns: turns(),
    relief: R('Relief', 0, 4, 0.7, { group: 'Form' }),
    refract: R('Refraction', 0, 3, 1.2, { group: 'Form' }),
    light: R('Light angle', -180, 180, 40, { group: 'Light', unit: '°', step: 1 }),
    gloss: R('Gloss', 2, 120, 40, { group: 'Light', log: true }),
    sheen: R('Sheen', 0, 3, 1.4, { group: 'Light' }),
    ...finish(0.35, 0.25) }),
  st('dot-screen', 'Dot Screen', 'mineral', ['halftone', 'dots', 'print'], 'A halftone carried by liquid flow: dot size follows tone, colour follows the source.', 1.2, {
    ...flow(0.8, 1.0), turns: turns(),
    cells: I('Dots', 12, 120, 48, { group: 'Screen', randMax: 90 }),
    angle: R('Screen angle', -90, 90, 22, { group: 'Screen', unit: '°', step: 1 }),
    size: R('Dot size', 0.3, 1.6, 1.15, { group: 'Screen' }),
    flip: T('Light dots', false, { group: 'Screen', hint: 'Dots grow with brightness instead of shadow.' }),
    palMix: R('Palette ink', 0, 1, 0.2, { group: 'Screen' }),
    ...finish(0.25, 0.2) }),
  st('tide-glint', 'Tide Glint', 'tidal', ['water', 'sparkle', 'glint'], 'Looping ripples refract the image and every highlight throws a four-way glint, like sun on water.', 2.6, {
    scale: R('Ripple scale', 0.5, 6, 2.2, { group: 'Water', log: true }),
    ripple: R('Ripple', 0, 3, 1.1, { group: 'Water' }),
    turns: turns(),
    thresh: R('Glint threshold', 0.2, 1.4, 0.55, { group: 'Glint' }),
    glint: R('Glint', 0, 3, 1.2, { group: 'Glint' }),
    length: R('Glint length', 0.02, 0.4, 0.14, { group: 'Glint', log: true }),
    angle: R('Glint angle', 0, 45, 20, { group: 'Glint', unit: '°', step: 1 }),
    tint: R('Palette tint', 0, 1, 0.25, { group: 'Light' }),
    ...finish(0.35, 0.3) }),
  st('oil-wash', 'Oil Wash', 'rosewater', ['paint', 'kuwahara', 'painterly'], 'A Kuwahara painter: detail melts into brush-like colour fields with crisp edges between them.', 3,
    { ...flow(0.6, 1.0), turns: turns(),
      radius: I('Brush radius', 1, 3, 3, { group: 'Brush', mutate: 0.3 }),
      stroke: R('Stroke size', 0.5, 5, 3.2, { group: 'Brush', log: true, unit: 'px' }),
      chroma: R('Colour', 0, 1.6, 1.15, { group: 'Brush' }),
      edge: R('Edge light', 0, 2, 0.5, { group: 'Brush' }),
      ...finish(0.3, 0.2) }),
  st('petal-fold', 'Petal Fold', 'ember', ['kaleidoscope', 'symmetry', 'bloom'], 'The source is mirror-folded into petals, then poured through the flow: any photo becomes a symmetric bloom.', 1.2, {
    ...flow(0.9, 1.0), turns: turns(),
    petals: I('Petals', 2, 14, 6, { group: 'Fold', randMax: 10 }),
    centre: { type: 'point', label: 'Centre', min: -0.5, max: 0.5, def: [0, 0], group: 'Fold' },
    pick: { type: 'point', label: 'Source region', min: -0.5, max: 0.5, def: [0.12, 0.05], group: 'Fold', hint: 'Which part of the image feeds the petals.' },
    spin: R('Spin', -3, 3, 0, { group: 'Fold' }),
    zoomIn: R('Bloom', -1, 1.5, 0.5, { group: 'Fold' }),
    seam: R('Seams', 0, 1, 0.15, { group: 'Fold', hint: 'Dark lines along the mirror folds.' }),
    ...finish(0.3, 0.25) }),
  st('aura-wash', 'Aura Wash', 'tidal', ['blur', 'bloom', 'gradient', 'soft'], 'An out-of-focus, drifting bloom of the source graded through the palette, with film grain.', 1.6, {
    ...flow(1.0, 0.9), turns: turns(),
    blur: R('Blur', 0.01, 0.4, 0.12, { group: 'Soft', log: true }),
    palMix: R('Palette grade', 0, 1, 0.35, { group: 'Soft' }),
    chroma: R('Colour', 0, 1.6, 1.2, { group: 'Soft' }),
    glow: R('Glow', 0, 2, 0.7, { group: 'Soft' }),
    ...finish(0.35, 0.55) }),
];

const manifest = {
  format: 'motif-kit@4', id: 'posterflow', name: 'Posterflow', version: '2.0.0', author: 'Motif',
  description: 'Twelve liquid poster looks for your own images and clips: banded marbles, streak melts, ink drags, iridescent film, mosaic water, engraved gills, satin, halftone, glinting tides, oil paint, petal folds and soft auras. Plus a layer effect and a liquid cut transition.',
  license: 'MIT', accent: '#4D7CFF', common: 'common.glsl', capabilities: ['media'],
  palettes: [
    pal('tidal', 'Tidal', '#04070F', '#EEF3FF', ['#3F6FFF', '#A8D2FF', '#0A1C55']),
    pal('ember', 'Ember', '#08040A', '#FFF1E6', ['#FF4A1C', '#FFB38A', '#4A0B1E']),
    pal('rosewater', 'Rosewater', '#16060B', '#FFF0F2', ['#E0457B', '#F7B6C6', '#5A0F2A']),
    pal('mineral', 'Mineral', '#07080B', '#F5EFE3', ['#6C8FD6', '#E8C9A0', '#232A44']),
  ],
  inputs: [{ id: 'source', type: 'media', label: 'Source', fit: 'fill', hint: 'Photo or clip to treat. Without one a palette ink marble plays.' }],
  styles,
  effects: [{
    id: 'poster-wash', name: 'Poster Wash', target: 'any', group: 'Posterflow', cost: 0.8, tags: ['posterize', 'veins'],
    blurb: 'Bands and vein-lines any layer or the whole frame, with an optional liquid warp.',
    inputs: [], passes: [{ src: 'effects/poster-wash.glsl' }],
    params: { ...flow(0.5, 1.4), turns: turns(), ...poster() },
  }],
  transitions: [{
    id: 'liquid-cut', name: 'Liquid Cut', duration: 1.4, group: 'Posterflow', cost: 0.8, tags: ['ink', 'wipe'],
    blurb: 'An ink front sweeps from one shot to the next while both flow; exact at both ends.',
    inputs: [], passes: [{ src: 'transitions/liquid-cut.glsl' }],
    params: { scale: R('Scale', 0.5, 4, 1.6, { log: true }), warp: R('Warp', 0, 2.5, 1.2), soft: R('Edge softness', 0.02, 0.4, 0.14), rim: R('Rim light', 0, 2, 0.6) },
  }],
  sequences: [{ id: 'poster-reel', file: 'sequences/poster-reel.json' }, { id: 'soft-reel', file: 'sequences/soft-reel.json' }],
  exporters: [
    { id: 'reel-vertical', name: 'Reel 9:16', blurb: 'Vertical 1080p MP4, three loops.', preset: { format: 'mp4', aspect: '9x16', tier: 1080, fps: 30, loops: 3, quality: 'high' } },
    { id: 'master-square', name: 'Square master', blurb: '1:1 1080p WebM.', preset: { format: 'webm', aspect: '1x1', tier: 1080, fps: 30, loops: 1, quality: 'high' } },
  ],
};
const w = (rel, s) => { fs.mkdirSync(path.dirname(path.join(KIT, rel)), { recursive: true }); fs.writeFileSync(path.join(KIT, rel), s); };
w('manifest.json', JSON.stringify(manifest, null, 2) + '\n');
const head = fs.readFileSync(path.join(HERE, 'head.glsl'), 'utf8');
for (const f of fs.readdirSync(path.join(HERE, 'body'))) w(`styles/${f}`, head + '\n' + fs.readFileSync(path.join(HERE, 'body', f), 'utf8'));
const cue = (id, style, at, len, lane, o = {}) => ({ id, style, at, len, lane, cycles: 1, fadeIn: 0.25, fadeOut: 0.25, ...o });
w('sequences/poster-reel.json', JSON.stringify({
  format: 'motif-seq@1', id: 'poster-reel', name: 'Poster Reel', description: 'Twelve seconds: a marble bed with streaks, drags, film and engraving crossing over it. Never more than two shaders at once.',
  loop: 12, bpm: 90, seed: 11, maxActive: 2,
  cues: [cue('bed', 'marble-flow', 0, '1', 0, { fadeIn: 0, fadeOut: 0 }), cue('melt', 'streak-melt', '2s', '3s', 1), cue('film', 'thin-film', '5.5s', '3s', 1), cue('drag', 'ink-drag', '9s', '3s', 1)],
}, null, 2) + '\n');
w('sequences/soft-reel.json', JSON.stringify({
  format: 'motif-seq@1', id: 'soft-reel', name: 'Soft Reel', description: 'A calmer twelve seconds: aura bed, satin and petal fold, oil wash and glints.',
  loop: 12, bpm: 70, seed: 5, maxActive: 2,
  cues: [cue('bed', 'aura-wash', 0, '1', 0, { fadeIn: 0, fadeOut: 0 }), cue('satin', 'satin-pour', '1s', '4s', 1, { opacity: 0.9 }), cue('petal', 'petal-fold', '5s', '3.5s', 1), cue('glint', 'tide-glint', '8.5s', '3.5s', 1, { blend: 'screen' })],
}, null, 2) + '\n');
console.log('wrote', styles.length, 'styles');
