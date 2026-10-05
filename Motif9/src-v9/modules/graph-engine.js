// ---- module: graph v1.0.0 (MotifGraph: realtime procedural motion graphics on a layer or the composite)
const __m_graph = (() => {
// graph — MotifGraph. A small, versioned, data-only node stack that turns a layer (or the whole composite) into a deformable mesh
// and a cloned array, drives it with fields and effectors, and hands the picture back to the compositor. The stack is
//   Stage (once) · Cloner (at most one) · Fields · Effectors · Deformers
// and is evaluated as a pure function of (loop phase p, seed, params): motion is whole cycles per loop, so frame 0 equals frame L,
// scrubbing, the render cache, the render Worker and exports agree. Parameters are ordinary project channels
// (path M:<layerId|@>:<nodeId>:<key>): keyframable, audio-mappable, saved with projects and presets.
// Engine side: no DOM beyond a canvas, runs unchanged in a Worker. One static WebGL2 program (no per-graph codegen, no recompiles);
// `cpu` is the reference evaluator that the tests compare the GPU against.
const { P, sanitize, defaults, clamp } = __m_engine_core;

const VERSION = 1, MAX_NODES = 20, STRIDE = 32, MAX_INSTANCES = 16384, MAX_VERTS = 3000000, TAU = 6.283185307179586;
// A single mesh (no Cloner) is drawn OVER times larger than the frame, so the edge of the picture can be stretched, mirrored or repeated
// where a deformer pulls it inwards; its segment count scales with it so the density inside the frame is what Mesh detail says.
const OVER = 1.6;
const COMPOSITE = '@';

// ---------- schema kit ----------
const R = (l, a, b, d, s = 0.01, o = {}) => P.range(l, a, b, d, s, { mutate: 0.3, ...o });
const I = (l, a, b, d, o = {}) => P.int(l, a, b, d, { mutate: 0.2, ...o });
const S = (l, opts, d, o = {}) => P.select(l, opts, d, { mutate: 0, ...o });
const T = (l, d, o = {}) => P.toggle(l, d, { mutate: 0, ...o });
const DEG = { unit: '°' };
const CURVES = [{ v: 'linear', l: 'Linear' }, { v: 'smooth', l: 'Smooth' }, { v: 'in', l: 'Ease in' }, { v: 'out', l: 'Ease out' }];
const CURVE_IX = { linear: 0, smooth: 1, in: 2, out: 3 };
const PAL_COLORS = [{ v: 'ink', l: 'Ink' }, { v: 'a0', l: 'Accent 1' }, { v: 'a1', l: 'Accent 2' }, { v: 'a2', l: 'Accent 3' }, { v: 'bg', l: 'Background' }, { v: 'cycle', l: 'Cycle palette' }, { v: 'ramp', l: 'Ramp' }];

// ---------- node kinds: a union layout per kind fixes the uniform slot of every key; each type shows the subset it uses ----------
const KINDS = {
  stage: { layout: {
    detail: I('Mesh detail', 8, 256, 64, { mutate: 0 }), mix: R('Mix with original', 0, 1, 1, 0.01, { mutate: 0 }),
    edge: S('Outside the picture', [{ v: 'clamp', l: 'Stretch edge' }, { v: 'mirror', l: 'Mirror' }, { v: 'repeat', l: 'Repeat' }, { v: 'clear', l: 'Transparent' }], 'clamp'),
    camera: S('Camera', [{ v: 'flat', l: 'Flat (2D)' }, { v: 'persp', l: 'Perspective' }], 'flat'),
    fov: R('Perspective', 15, 120, 55, 1, { unit: '°' }), orbitX: R('Orbit up/down', -80, 80, 0, 0.5, DEG), orbitY: R('Orbit left/right', -80, 80, 0, 0.5, DEG),
    panX: R('Pan x', -2, 2, 0, 0.01), panY: R('Pan y', -2, 2, 0, 0.01),
    light: R('Lighting', 0, 1, 0, 0.01), lightAngle: R('Light direction', 0, 360, 315, 1, { unit: '°' }), depth: T('Sort by depth', false) } },
  cloner: { layout: {
    mode: S('Layout', [{ v: 'grid', l: 'Grid' }, { v: 'honeycomb', l: 'Honeycomb' }, { v: 'linear', l: 'Linear' }, { v: 'radial', l: 'Radial' }, { v: 'spiral', l: 'Spiral' }, { v: 'phyllo', l: 'Sunflower' }, { v: 'scatter', l: 'Scatter' }], 'grid'),
    content: S('Each clone shows', [{ v: 'tiles', l: 'Tile of picture' }, { v: 'whole', l: 'Whole picture' }, { v: 'dots', l: 'Picture dots' }], 'tiles'),
    count: I('Count', 1, MAX_INSTANCES, 48, { log: true }), cols: I('Columns', 1, 128, 8), rows: I('Rows', 1, 128, 6),
    size: R('Clone size', 0.02, 2, 0.3, 0.01), fill: R('Tile fill', 0.1, 1.5, 1, 0.01),
    posX: R('Position x', -2, 2, 0, 0.01), posY: R('Position y', -2, 2, 0, 0.01), width: R('Width / radius', 0, 3, 1, 0.01), height: R('Height', 0, 3, 1, 0.01),
    angle: R('Angle', -360, 360, 0, 1, DEG), arc: R('Arc', 0, 360, 360, 1, DEG), turns: R('Turns', 0, 20, 3, 0.05),
    rotate: R('Rotate each', -360, 360, 0, 1, DEG), stepRot: R('Spin along array', -720, 720, 0, 1, DEG), scale: R('Scale', 0.01, 4, 1, 0.01), stepScale: R('Grow along array', -1, 4, 0, 0.01),
    align: T('Face the centre', false), seed: I('Seed', 0, 9999, 1, { mutate: 0.5 }), detail: I('Clone detail', 1, 32, 4), reverse: T('Reverse draw order', false),
    shape: S('Dot shape', [{ v: 'circle', l: 'Circle' }, { v: 'square', l: 'Square' }, { v: 'diamond', l: 'Diamond' }, { v: 'ring', l: 'Ring' }], 'circle'),
    dotMin: R('Dot size, dark', 0, 1.5, 0.15, 0.01), dotMax: R('Dot size, light', 0, 1.5, 1, 0.01), dotInvert: T('Invert dot size', false) } },
  field: { layout: {
    x: R('Centre x', -2, 2, 0, 0.01), y: R('Centre y', -2, 2, 0, 0.01), sizeX: R('Size x', 0.01, 4, 0.6, 0.01), sizeY: R('Size y', 0.01, 4, 0.6, 0.01), angle: R('Angle', -360, 360, 0, 1, DEG),
    falloff: R('Falloff', 0, 1, 0.5, 0.01), curve: S('Falloff curve', CURVES, 'smooth'), invert: T('Invert', false), outMin: R('Output at 0', -2, 2, 0, 0.01), outMax: R('Output at 1', -2, 2, 1, 0.01),
    motion: S('Motion', [{ v: 'none', l: 'None' }, { v: 'sweep', l: 'Sweep' }, { v: 'orbit', l: 'Orbit' }, { v: 'pulse', l: 'Pulse' }], 'none'), travel: R('Travel', 0, 3, 1, 0.01), cycles: I('Cycles per loop', 0, 16, 1), phase: R('Phase', 0, 1, 0, 0.01),
    combine: S('Combine mode', [{ v: 'add', l: 'Add' }, { v: 'mul', l: 'Multiply' }, { v: 'min', l: 'Minimum' }, { v: 'max', l: 'Maximum' }, { v: 'sub', l: 'Subtract' }, { v: 'over', l: 'Over' }], 'mul'),
    scale: R('Scale', 0.1, 24, 3, 0.1), seed: I('Seed', 0, 9999, 1, { mutate: 0.5 }) } },
  effector: { layout: {
    strength: R('Strength', -2, 2, 1, 0.01, { mutate: 0.15 }), posX: R('Move x', -2, 2, 0, 0.01), posY: R('Move y', -2, 2, 0, 0.01), posZ: R('Move z', -2, 2, 0, 0.01),
    rotX: R('Rotate x', -720, 720, 0, 1, DEG), rotY: R('Rotate y', -720, 720, 0, 1, DEG), rotZ: R('Rotate z', -720, 720, 0, 1, DEG),
    scale: R('Scale', -1, 3, 0, 0.01), scaleX: R('Scale x', -1, 3, 0, 0.01), scaleY: R('Scale y', -1, 3, 0, 0.01), opacity: R('Opacity', -1, 1, 0, 0.01),
    tint: R('Colour amount', 0, 1, 0, 0.01), tintColor: S('Colour', PAL_COLORS, 'ink'),
    cycles: I('Cycles per loop', 0, 16, 1), phase: R('Phase', 0, 1, 0, 0.01), spread: R('Spread', 0, 4, 1, 0.01), shape: S('Wave', [{ v: 'pulse', l: 'Pulse' }, { v: 'sine', l: 'Sine' }, { v: 'saw', l: 'Saw' }, { v: 'tri', l: 'Triangle' }, { v: 'spring', l: 'Spring pop' }], 'pulse'),
    noiseScale: R('Noise scale', 0.1, 24, 2, 0.1), seed: I('Seed', 0, 9999, 1, { mutate: 0.5 }), curve: S('Curve', CURVES, 'linear'), bands: I('Bands', 1, 8, 8), bandStart: I('First band', 0, 7, 0) } },
  deformer: { layout: {
    space: S('Acts on', [{ v: 'world', l: 'Whole array' }, { v: 'object', l: 'Each clone' }], 'world'), strength: R('Amount', -6, 6, 0.5, 0.01),
    size: R('Size', 0.05, 6, 0.8, 0.01), x: R('Origin x', -2, 2, 0, 0.01), y: R('Origin y', -2, 2, 0, 0.01), angle: R('Direction', -360, 360, 0, 1, DEG),
    dir: S('Direction of push', [{ v: 'plane', l: 'In the picture' }, { v: 'z', l: 'Toward viewer' }, { v: 'both', l: 'Both' }], 'plane'),
    cycles: I('Cycles per loop', 0, 16, 1), phase: R('Phase', 0, 1, 0, 0.01), scale: R('Decay', 0, 6, 1, 0.01), seed: I('Seed', 0, 9999, 1, { mutate: 0.5 }), mid: R('Midpoint', 0, 1, 0.5, 0.01) } },
};
const LAYOUT = {}, SLOT = {}; // LAYOUT[kind] = ordered keys; SLOT[kind][key] = uniform slot
for (const [k, d] of Object.entries(KINDS)) { LAYOUT[k] = Object.keys(d.layout); SLOT[k] = Object.fromEntries(LAYOUT[k].map((key, i) => [key, i])); if (LAYOUT[k].length > STRIDE) throw new Error('graph: layout too wide ' + k); }

const ov = (kind, keys, over = {}) => Object.fromEntries(keys.map(k => [k, { ...KINDS[kind].layout[k], ...(over[k] || {}) }]));
const EFF_CH = ['strength', 'posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ', 'scale', 'scaleX', 'scaleY', 'opacity', 'tint', 'tintColor'];
const eff = (extra, over, d) => ({ kind: 'effector', schema: ov('effector', [...EFF_CH, ...extra], over), preset: d });
const dfm = (keys, over, d) => ({ kind: 'deformer', schema: ov('deformer', keys, over), preset: d });
const fld = (keys, over, d) => ({ kind: 'field', schema: ov('field', keys, over), preset: d });
const FCOMMON = ['curve', 'invert', 'outMin', 'outMax', 'combine'];

// Registry: ids are stable forever (they are saved in projects).
const TYPES = {
  stage: { id: 1, kind: 'stage', name: 'Stage', short: 'STG', hint: 'Mesh detail, camera, lighting and the mix with the original', schema: ov('stage', LAYOUT.stage) },
  cloner: { id: 2, kind: 'cloner', name: 'Cloner', short: 'CLN', hint: 'Copies the picture into an array: grid, honeycomb, linear, radial, spiral, sunflower, scatter', schema: ov('cloner', LAYOUT.cloner) },
  // effectors
  plain: { id: 10, name: 'Plain effector', short: 'EFF', hint: 'Moves, rotates, scales and tints every clone by the same amount, weighted by a field', ...eff([], {}, { posY: 0.3, scale: -0.3 }) },
  random: { id: 11, name: 'Random effector', short: 'RND', hint: 'A different random amount per clone; loop-exact when animated', ...eff(['cycles', 'phase', 'seed'], { cycles: { label: 'Animate (cycles per loop)' } }, { posX: 0.25, posY: 0.25, rotZ: 30, cycles: 1 }) },
  step: { id: 12, name: 'Step effector', short: 'STP', hint: 'A ramp across the array: first clone none, last clone full', ...eff(['curve'], {}, { rotZ: 90, scale: -0.5 }) },
  delay: { id: 13, name: 'Delay effector', short: 'DLY', hint: 'A wave that travels through the array in time: stagger, pop, cascade', ...eff(['cycles', 'phase', 'spread', 'shape'], {}, { scale: 0.8, shape: 'spring', spread: 1 }) },
  noise: { id: 14, name: 'Noise effector', short: 'NSE', hint: 'Smooth noise over space, animated in a perfect loop', ...eff(['cycles', 'phase', 'noiseScale', 'seed'], {}, { posX: 0.2, posY: 0.2, rotZ: 25 }) },
  sound: { id: 15, name: 'Sound effector', short: 'SND', hint: 'Spreads the audio spectrum across the array; needs audio loaded', ...eff(['bands', 'bandStart'], {}, { scale: 1.2 }) },
  // fields
  sphere: { id: 20, name: 'Sphere field', short: 'SPH', hint: 'A soft ellipse; weights whatever references it', ...fld(['x', 'y', 'sizeX', 'sizeY', 'angle', 'falloff', 'motion', 'travel', 'cycles', 'phase', ...FCOMMON], { sizeX: { label: 'Radius x' }, sizeY: { label: 'Radius y' } }, { motion: 'sweep' }) },
  box: { id: 21, name: 'Box field', short: 'BOX', hint: 'A soft rectangle', ...fld(['x', 'y', 'sizeX', 'sizeY', 'angle', 'falloff', 'motion', 'travel', 'cycles', 'phase', ...FCOMMON], {}, {}) },
  linear: { id: 22, name: 'Linear field', short: 'LIN', hint: 'A gradient across the picture', ...fld(['x', 'y', 'sizeX', 'angle', 'motion', 'travel', 'cycles', 'phase', ...FCOMMON], { sizeX: { label: 'Length' } }, { motion: 'sweep' }) },
  radial: { id: 23, name: 'Radial field', short: 'RAD', hint: 'A gradient that sweeps around a point', ...fld(['x', 'y', 'angle', ...FCOMMON], {}, {}) },
  noisef: { id: 24, name: 'Noise field', short: 'NSF', hint: 'Smooth noise', ...fld(['x', 'y', 'scale', 'seed', 'cycles', 'phase', ...FCOMMON], {}, { cycles: 1 }) },
  randomf: { id: 25, name: 'Random field', short: 'RNF', hint: 'A random weight per clone', ...fld(['seed', 'cycles', 'phase', ...FCOMMON], {}, { cycles: 0 }) },
  index: { id: 26, name: 'Index field', short: 'IDX', hint: 'A ramp across the array', ...fld([...FCOMMON], {}, {}) },
  luma: { id: 27, name: 'Picture field', short: 'PIC', hint: 'Brightness of the picture itself drives the weight', ...fld([...FCOMMON], {}, {}) },
  stripes: { id: 28, name: 'Stripes field', short: 'STR', hint: 'Travelling stripes', ...fld(['x', 'y', 'angle', 'scale', 'falloff', 'cycles', 'phase', 'invert', 'outMin', 'outMax', 'combine'], { scale: { label: 'Stripes' }, falloff: { label: 'Softness' } }, { cycles: 1 }) },
  // deformers
  bend: { id: 30, name: 'Bend', short: 'BND', hint: 'Curves the picture around an axis', ...dfm(['space', 'strength', 'x', 'y', 'angle'], { strength: { label: 'Curvature', min: -4, max: 4, def: 0.9 } }, {}) },
  twist: { id: 31, name: 'Twist', short: 'TWS', hint: 'Twists about an axis (best with the perspective camera)', ...dfm(['space', 'strength', 'x', 'y', 'angle'], { strength: { label: 'Twist', min: -6, max: 6, def: 1.4 } }, {}) },
  swirl: { id: 32, name: 'Swirl', short: 'SWL', hint: 'Rotates the picture around a point, strongest in the middle', ...dfm(['space', 'strength', 'size', 'x', 'y'], { strength: { label: 'Swirl', min: -6, max: 6, def: 2.2 }, size: { label: 'Radius' } }, {}) },
  taper: { id: 33, name: 'Taper', short: 'TPR', hint: 'Narrows one end', ...dfm(['space', 'strength', 'x', 'y', 'angle'], { strength: { label: 'Taper', min: -2, max: 2, def: 0.7 } }, {}) },
  shear: { id: 34, name: 'Shear', short: 'SHR', hint: 'Slants the picture', ...dfm(['space', 'strength', 'x', 'y', 'angle'], { strength: { label: 'Shear', min: -2, max: 2, def: 0.4 } }, {}) },
  squash: { id: 35, name: 'Squash & stretch', short: 'SQS', hint: 'Stretches one way, squashes the other', ...dfm(['space', 'strength', 'x', 'y', 'angle'], { strength: { label: 'Stretch', min: -1.5, max: 1.5, def: 0.3 } }, {}) },
  wave: { id: 36, name: 'Wave', short: 'WAV', hint: 'A travelling wave, loop-exact', ...dfm(['space', 'strength', 'size', 'x', 'y', 'angle', 'dir', 'cycles', 'phase'], { strength: { label: 'Amplitude', min: -1, max: 1, def: 0.07 }, size: { label: 'Wavelength', def: 0.7 } }, {}) },
  ripple: { id: 37, name: 'Ripple', short: 'RPL', hint: 'Rings expanding from a point', ...dfm(['space', 'strength', 'size', 'x', 'y', 'dir', 'cycles', 'phase', 'scale'], { strength: { label: 'Amplitude', min: -1, max: 1, def: 0.06 }, size: { label: 'Wavelength', def: 0.35 }, dir: { options: [{ v: 'plane', l: 'Outward' }, { v: 'z', l: 'Toward viewer' }, { v: 'both', l: 'Both' }] } }, {}) },
  noised: { id: 38, name: 'Noise', short: 'NSD', hint: 'Organic displacement, animated in a perfect loop', ...dfm(['space', 'strength', 'size', 'dir', 'cycles', 'phase', 'seed'], { strength: { label: 'Amount', min: -1, max: 1, def: 0.09 }, size: { label: 'Feature size', def: 0.5 } }, {}) },
  bulge: { id: 39, name: 'Bulge', short: 'BLG', hint: 'Magnifies (or pinches) around a point', ...dfm(['space', 'strength', 'size', 'x', 'y'], { strength: { label: 'Bulge', min: -2, max: 2, def: 0.7 }, size: { label: 'Radius' } }, {}) },
  spherify: { id: 40, name: 'Spherify', short: 'SPF', hint: 'Wraps the picture onto a dome', ...dfm(['space', 'strength', 'size', 'x', 'y'], { strength: { label: 'Amount', min: 0, max: 1.5, def: 0.9 }, size: { label: 'Radius', def: 1 } }, {}) },
  lens: { id: 41, name: 'Lens', short: 'LNS', hint: 'Barrel or pincushion distortion', ...dfm(['space', 'strength', 'size', 'x', 'y'], { strength: { label: 'Distortion', min: -2, max: 2, def: 0.6 }, size: { label: 'Radius', def: 1.2 } }, {}) },
  displace: { id: 42, name: 'Displace', short: 'DSP', hint: 'The picture displaces itself by brightness', ...dfm(['space', 'strength', 'dir', 'mid'], { strength: { label: 'Amount', min: -1, max: 1, def: 0.25 }, dir: { def: 'z' } }, { dir: 'z' }) },
};
for (const [k, t] of Object.entries(TYPES)) { t.key = k; if (!t.preset) t.preset = {}; }
const TYPE_IDS = Object.keys(TYPES);
const BY_ID = Object.fromEntries(TYPE_IDS.map(k => [TYPES[k].id, k]));
if (new Set(TYPE_IDS.map(k => TYPES[k].id)).size !== TYPE_IDS.length) throw new Error('graph: duplicate type ids');
const FAMILY = { stage: 'Stage', cloner: 'Cloner', effector: 'Effector', field: 'Field', deformer: 'Deformer' };
const kindOf = type => (TYPES[type] ? TYPES[type].kind : null);
const schemaFor = type => (TYPES[type] ? TYPES[type].schema : null);
// Type defaults: the schema default, overridden by the type's preset values.
const typeDefaults = type => { const d = defaults(schemaFor(type)); return Object.assign(d, TYPES[type].preset); };

// ---------- model ----------
const ID_RE = /^g[a-z0-9]{1,10}$/;
function freshId(used) { let i = used.size + 1, id; do { id = 'g' + (i++).toString(36); } while (used.has(id)); return id; }
function newGraph(scope) {
  const st = { id: 'stage', type: 'stage', on: true, params: defaults(TYPES.stage.schema) };
  st.params.edge = 'clamp';
  return { v: VERSION, on: true, place: 'pre', nodes: [st] };
}
function newNode(type, used, extra = {}) {
  if (!TYPES[type]) throw new Error('graph: unknown node type ' + type);
  const ids = used instanceof Set ? used : new Set((used || []).map(n => (typeof n === 'string' ? n : n && n.id)));
  return Object.assign({ id: freshId(ids), type, on: true, params: typeDefaults(type) }, TYPES[type].kind === 'effector' || TYPES[type].kind === 'deformer' ? { ref: '' } : {}, TYPES[type].kind === 'field' ? { ref: '' } : {}, extra);
}
const nodeById = (g, id) => (g && Array.isArray(g.nodes) ? g.nodes.find(n => n.id === id) || null : null);
function sanitizeGraph(g, scope) {
  if (!g || typeof g !== 'object') return null;
  const out = { v: VERSION, on: g.on !== false, place: g.place === 'post' && scope === COMPOSITE ? 'post' : 'pre', nodes: [] }, used = new Set(); let cl = 0, st = 0;
  for (const n of (Array.isArray(g.nodes) ? g.nodes : []).slice(0, MAX_NODES + 4)) {
    if (!n || typeof n !== 'object') continue;
    let id = typeof n.id === 'string' && ID_RE.test(n.id) || n.id === 'stage' ? n.id : freshId(used); while (used.has(id)) id = freshId(used);
    const type = String(n.type || '');
    if (!TYPES[type]) { if (out.nodes.length < MAX_NODES) { used.add(id); out.nodes.push({ id, type: type.slice(0, 24).replace(/[^a-z0-9_-]/gi, ''), on: n.on !== false, unknown: true, params: clipRaw(n.params) }); } continue; }
    if (TYPES[type].kind === 'stage') { if (st++) continue; id = 'stage'; }
    if (TYPES[type].kind === 'cloner' && cl++) continue;
    if (out.nodes.length >= MAX_NODES) break;
    used.add(id);
    const node = { id, type, on: n.on !== false, params: sanitize(Object.assign(typeDefaults(type), n.params && typeof n.params === 'object' ? n.params : {}), schemaFor(type)) };
    if (n.ref !== undefined || ['field', 'effector', 'deformer'].includes(TYPES[type].kind)) node.ref = typeof n.ref === 'string' ? n.ref : '';
    out.nodes.push(node);
  }
  if (!out.nodes.some(n => n.type === 'stage')) out.nodes.unshift({ id: 'stage', type: 'stage', on: true, params: defaults(TYPES.stage.schema) });
  else out.nodes.sort((a, b) => (b.type === 'stage') - (a.type === 'stage'));
  // References: only to an existing field, never to itself; chains are cut at depth 3 (the shader's limit).
  const fields = new Set(out.nodes.filter(n => kindOf(n.type) === 'field').map(n => n.id));
  for (const n of out.nodes) if ('ref' in n) { if (!fields.has(n.ref) || n.ref === n.id) n.ref = ''; }
  const depth = (n, d = 0) => { const r = n.ref && nodeById(out, n.ref); return r && d < 8 ? 1 + depth(r, d + 1) : 0; };
  for (const n of out.nodes) if (kindOf(n.type) === 'field' && depth(n) > 2) n.ref = '';
  return out;
}
function clipRaw(p) { try { const s = JSON.stringify(p && typeof p === 'object' ? p : {}); return s.length <= 2048 ? JSON.parse(s) : {}; } catch (e) { return {}; } }
// What the renderer sees: enabled, known nodes with sanitized values. Keyframes and audio maps have already been applied by timeline.evaluate.
function evalCopy(g) {
  if (!g) return null;
  return { v: g.v, on: g.on !== false, place: g.place === 'post' ? 'post' : 'pre', nodes: (g.nodes || []).filter(n => n && TYPES[n.type]).map(n => ({ id: n.id, type: n.type, on: n.on !== false, ref: n.ref || '', params: sanitize(Object.assign(typeDefaults(n.type), n.params), schemaFor(n.type)) })) };
}
const stageOf = g => (g && g.nodes ? g.nodes.find(n => n.type === 'stage') : null);
// Does the graph change the picture at all? (Stage alone is a pass-through.)
function active(g) { return !!(g && g.on !== false && g.nodes && g.nodes.some(n => n.on !== false && n.type !== 'stage' && TYPES[n.type])); }
function usesSound(g) { return !!(g && g.nodes && g.nodes.some(n => n.on !== false && n.type === 'sound')); }
function schemaAt(g, nodeId, key) { const n = nodeById(g, nodeId); const s = n && schemaFor(n.type); return (s && s[key]) || null; }
function nodeLabel(g, n) { if (!n) return ''; const same = (g.nodes || []).filter(x => x.type === n.type); return TYPES[n.type] ? TYPES[n.type].name + (same.length > 1 ? ' ' + (same.indexOf(n) + 1) : '') : n.type; }
// Every addressable numeric channel of a graph (audio targets, lanes).
function paths(g, scope, numericOnly, label) {
  const out = []; if (!g) return out;
  for (const n of g.nodes || []) { const sc = schemaFor(n.type); if (!sc || n.unknown) continue; for (const [k, s] of Object.entries(sc)) if (!numericOnly || s.type === 'range' || s.type === 'int') out.push({ path: `M:${scope}:${n.id}:${k}`, label: `${label} · ${nodeLabel(g, n)} · ${s.label}`, group: label }); }
  return out;
}

// ---------- hashing and noise: integer arithmetic, so the CPU reference and the GLSL agree bit for bit ----------
const pcg = v => { v >>>= 0; const s = (Math.imul(v, 747796405) + 2891336453) >>> 0, w = Math.imul(((s >>> ((s >>> 28) + 4)) ^ s) >>> 0, 277803737) >>> 0; return ((w >>> 22) ^ w) >>> 0; };
const U32 = 2.3283064365386963e-10;
const h2 = (a, b) => pcg((pcg(a) + (b >>> 0)) >>> 0);
const rnd = (a, b) => Math.fround(Math.fround(h2(a, b)) * U32);
function h4(x, y, z, w, s) { let h = pcg((s ^ 0x68E31DA4) >>> 0); h = pcg((h + (x >>> 0)) >>> 0); h = pcg((h + (y >>> 0)) >>> 0); h = pcg((h + (z >>> 0)) >>> 0); h = pcg((h + (w >>> 0)) >>> 0); return Math.fround(Math.fround(h) * U32); }
function vn4(x, y, z, w, seed) { // value noise in 4D, 0..1
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), iw = Math.floor(w), fx = x - ix, fy = y - iy, fz = z - iz, fw = w - iw;
  const q = f => f * f * f * (f * (f * 6 - 15) + 10), ux = q(fx), uy = q(fy), uz = q(fz), uw = q(fw); let acc = 0;
  for (let k = 0; k < 16; k++) {
    const dx = k & 1, dy = (k >> 1) & 1, dz = (k >> 2) & 1, dw = (k >> 3) & 1;
    const wgt = (dx ? ux : 1 - ux) * (dy ? uy : 1 - uy) * (dz ? uz : 1 - uz) * (dw ? uw : 1 - uw);
    acc += wgt * h4(ix + dx, iy + dy, iz + dz, iw + dw, seed >>> 0);
  }
  return acc;
}
const NOISE_R = 0.9;
const curveFn = (c, x) => { x = x < 0 ? 0 : x > 1 ? 1 : x; return c === 0 ? x : c === 1 ? x * x * (3 - 2 * x) : c === 2 ? x * x : 1 - (1 - x) * (1 - x); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rotv = (x, y, a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };

// ---------- the CPU reference evaluator (the spec; the GLSL below mirrors it) ----------
const SEL = (kind, key, v) => { const s = KINDS[kind].layout[key]; const i = s.options.findIndex(o => o.v === v); return i < 0 ? 0 : i; };
// Pack an evaluated graph into the flat form both evaluators read: table[i] = { ty, base, ref, on }, vals = Float32Array(MAX_NODES * STRIDE).
function pack(ev) {
  const all = ev.nodes || [], table = [], vals = new Float32Array(MAX_NODES * STRIDE);
  const index = new Map(); let n = 0;
  for (const nd of all.slice(0, MAX_NODES)) { if (!nd.on && nd.type !== 'stage') continue; index.set(nd.id, n); n++; }
  n = 0; let cl = -1, st = -1;
  for (const nd of all.slice(0, MAX_NODES)) {
    if (!nd.on && nd.type !== 'stage') continue;
    const T0 = TYPES[nd.type], kind = T0.kind, lay = LAYOUT[kind], base = n * STRIDE;
    lay.forEach((key, i) => { const s = KINDS[kind].layout[key]; let v = key in nd.params ? nd.params[key] : s.def; vals[base + i] = s.type === 'select' ? SEL(kind, key, v) : s.type === 'toggle' ? (v ? 1 : 0) : Number(v); });
    // selects whose options a type overrides (e.g. ripple's direction) keep the same index order as the union layout
    table.push({ ty: T0.id, kind, base, ref: nd.ref && index.has(nd.ref) ? index.get(nd.ref) : -1, node: nd });
    if (kind === 'cloner' && cl < 0) cl = n; if (kind === 'stage') st = n; n++;
  }
  return { table, vals, cl, st, count: n };
}
function springResp(x) { return (1 - Math.exp(-7 * x) * Math.cos(TAU * 1.5 * x)) * (1 - sstep(0.78, 1, x)); }
function waveShape(si, x) { // x in [0,1)
  if (si === 0) { const s = Math.sin(Math.PI * x); return s * s; } if (si === 1) return 0.5 - 0.5 * Math.cos(TAU * x); if (si === 2) return x; if (si === 3) return 1 - Math.abs(2 * x - 1); return springResp(x);
}
const fract = x => x - Math.floor(x);

// ctx: { A, p, pal:[5][3], spec:[8], luma(u,v) }
function cpuField(pk, k, pos, idxN, idx, X) {
  const nd = pk.table[k], V = pk.vals, b = nd.base, S_ = SLOT.field, g = key => V[b + S_[key]], ty = nd.ty;
  let v = 0;
  const th = TAU * (g('cycles') * X.p + g('phase')); let cx = g('x'), cy = g('y'), sm = 1;
  const mo = g('motion'), travel = g('travel'), ang = g('angle') * Math.PI / 180;
  if (mo === 1) { const s = Math.sin(th) * travel; cx += Math.cos(ang) * s; cy += Math.sin(ang) * s; } else if (mo === 2) { cx += travel * Math.cos(th); cy += travel * Math.sin(th); } else if (mo === 3) sm = Math.max(0.05, 1 + travel * 0.5 * Math.sin(th));
  const q = rotv(pos[0] - cx, pos[1] - cy, -ang), sx = Math.max(g('sizeX'), 0.01) * sm, sy = Math.max(g('sizeY'), 0.01) * sm, cv = CURVE_IX[CURVES[g('curve')].v], fo = Math.max(g('falloff'), 1e-3);
  switch (ty) {
    case 20: v = curveFn(cv, (1 - Math.hypot(q[0] / sx, q[1] / sy)) / fo); break;
    case 21: v = curveFn(cv, (1 - Math.max(Math.abs(q[0]) / sx, Math.abs(q[1]) / sy)) / fo); break;
    case 22: v = curveFn(cv, 0.5 - q[0] / (2 * sx)); break;
    case 23: v = curveFn(cv, Math.atan2(q[1], q[0]) / TAU + 0.5); break;
    case 24: v = curveFn(cv, vn4(q[0] * g('scale'), q[1] * g('scale'), Math.cos(th) * NOISE_R, Math.sin(th) * NOISE_R, g('seed'))); break;
    case 25: { const ra = rnd(idx, g('seed') * 2 + 1) * 2 - 1, rb = rnd(idx, g('seed') * 2 + 2) * 2 - 1; v = curveFn(cv, 0.5 + 0.5 * (ra * Math.cos(th) + rb * Math.sin(th))); break; }
    case 26: v = curveFn(cv, idxN); break;
    case 27: v = curveFn(cv, X.luma(pos[0] / (2 * X.A) + 0.5, 0.5 - pos[1] / 2)); break;
    case 28: { const s = 0.5 + 0.5 * Math.sin(TAU * (q[0] * g('scale') * 0.5 - (g('cycles') * X.p + g('phase')))); const w = 1 - g('falloff'); v = sstep(0.5 - w * 0.5 - 0.001, 0.5 + w * 0.5 + 0.001, s); break; }
    default: v = 0;
  }
  if (g('invert') > 0.5) v = 1 - v;
  return g('outMin') + (g('outMax') - g('outMin')) * v;
}
function combine(m, a, b) { a = clamp(a, 0, 1); b = clamp(b, 0, 1); return m === 0 ? Math.min(a + b, 1) : m === 1 ? a * b : m === 2 ? Math.min(a, b) : m === 3 ? Math.max(a, b) : m === 4 ? clamp(a - b, 0, 1) : a + b * (1 - a); }
function cpuFieldVal(pk, k, pos, idxN, idx, X, d = 0) {
  const nd = pk.table[k]; let v = cpuField(pk, k, pos, idxN, idx, X);
  if (nd.ref >= 0 && d < 2) v = combine(pk.vals[nd.base + SLOT.field.combine], v, cpuFieldVal(pk, nd.ref, pos, idxN, idx, X, d + 1));
  return v;
}
function cpuLayout(pk, idx, N, X) {
  const A = X.A; let L = { c: [0, 0], rot: 0, sc: 1, cw: 2 * A, ch: 2, idxN: 0, src: null, tile: false };
  if (pk.cl < 0) return L;
  const nd = pk.table[pk.cl], b = nd.base, V = pk.vals, g = key => V[b + SLOT.cloner[key]], mode = g('mode');
  const C = Math.max(1, Math.round(g('cols'))), Rr = Math.max(1, Math.round(g('rows'))), n = N, idxN = n > 1 ? idx / (n - 1) : 0, ang = g('angle') * Math.PI / 180;
  let c, rot = 0, cw, ch, src = null;
  if (mode === 0 || mode === 1) {
    const col = idx % C, row = Math.floor(idx / C), tw = 2 * A / C, th = 2 / Rr, shift = mode === 1 && (row & 1) ? 0.5 * tw : 0;
    const ux = -A + (col + 0.5) * tw + shift, uy = 1 - (row + 0.5) * th;
    c = [ux * g('width'), uy * g('height')]; cw = tw * g('fill'); ch = th * g('fill'); src = [ux, uy, tw, th];
  } else {
    const size = g('size'); cw = 2 * A * size; ch = 2 * size; let u;
    if (mode === 2) { const t = idxN - 0.5, len = g('width') * 2; u = [Math.cos(ang) * t * len, Math.sin(ang) * t * len]; }
    else if (mode === 3) { const arc = g('arc'), full = arc >= 359.9, th = ang + (arc * Math.PI / 180) * (full ? idx / n : idxN); u = [Math.cos(th) * g('width'), Math.sin(th) * g('height')]; if (g('align') > 0.5) rot += th + Math.PI / 2; }
    else if (mode === 4) { const th = ang + g('turns') * TAU * idxN; u = [Math.cos(th) * g('width') * idxN, Math.sin(th) * g('height') * idxN]; }
    else if (mode === 5) { const th = idx * 2.399963229728653 + ang, r = Math.sqrt((idx + 0.5) / n); u = [Math.cos(th) * r * g('width'), Math.sin(th) * r * g('height')]; if (g('align') > 0.5) rot += th + Math.PI / 2; }
    else { u = [(rnd(idx, g('seed') * 3 + 1) * 2 - 1) * A * g('width'), (rnd(idx, g('seed') * 3 + 2) * 2 - 1) * g('height')]; }
    c = [u[0], u[1]]; src = [u[0], u[1], cw, ch];
  }
  const sc = g('scale') * (1 + g('stepScale') * idxN);
  rot += (g('rotate') + g('stepRot') * idxN) * Math.PI / 180;
  c = [c[0] + g('posX'), c[1] + g('posY')];
  return { c, rot, sc, cw, ch, idxN, src, tile: true, content: g('content'), mode, n };
}
function cpuInstance(pk, idx, N, X) {
  const L = cpuLayout(pk, idx, N, X), E = { pos: [0, 0, 0], rx: 0, ry: 0, rz: 0, s: 0, sx: 0, sy: 0, op: 0, tint: 0, col: 0 }, V = pk.vals, SS = SLOT.effector;
  for (let k = 0; k < pk.count; k++) {
    const nd = pk.table[k]; if (nd.kind !== 'effector') continue;
    const b = nd.base, g = key => V[b + SS[key]], ty = nd.ty, th = TAU * (g('cycles') * X.p + g('phase'));
    let Tm = 1;
    if (ty === 11) { const ra = rnd(idx, g('seed') * 2 + 1) * 2 - 1, rb = rnd(idx, g('seed') * 2 + 2) * 2 - 1; Tm = ra * Math.cos(th) + rb * Math.sin(th); }
    else if (ty === 12) Tm = curveFn(CURVE_IX[CURVES[g('curve')].v], L.idxN);
    else if (ty === 13) Tm = waveShape(g('shape'), fract(g('cycles') * X.p + g('phase') - L.idxN * g('spread')));
    else if (ty === 14) Tm = vn4(L.c[0] * g('noiseScale'), L.c[1] * g('noiseScale'), Math.cos(th) * NOISE_R, Math.sin(th) * NOISE_R, g('seed')) * 2 - 1;
    else if (ty === 15) { const nb = Math.max(1, Math.round(g('bands'))), f = nb > 1 ? L.idxN * (nb - 1) : 0, i0 = Math.floor(f), i1 = Math.min(i0 + 1, nb - 1), fr = f - i0, s0 = Math.round(g('bandStart')); const sp = i => X.spec[Math.min(7, s0 + i)]; Tm = sp(i0) * (1 - fr) + sp(i1) * fr; }
    const fv = nd.ref >= 0 ? cpuFieldVal(pk, nd.ref, L.c, L.idxN, idx, X) : 1, w = fv * g('strength') * Tm;
    E.pos[0] += g('posX') * w; E.pos[1] += g('posY') * w; E.pos[2] += g('posZ') * w; E.rx += g('rotX') * w; E.ry += g('rotY') * w; E.rz += g('rotZ') * w;
    E.s += g('scale') * w; E.sx += g('scaleX') * w; E.sy += g('scaleY') * w; E.op += g('opacity') * w;
    const tw = clamp(g('tint') * w, 0, 1); if (tw > E.tint) { E.tint = tw; E.col = g('tintColor'); }
  }
  return { L, E };
}
function cpuDeform(ty, b, V, pk, u, w, X, srcUV) {
  const g = key => V[b + SLOT.deformer[key]], ang = g('angle') * Math.PI / 180, c = [g('x'), g('y')];
  const rq = rotv(u[0] - c[0], u[1] - c[1], -ang); let qx = rq[0], qy = rq[1], z = u[2];
  const k = g('strength'), size = Math.max(g('size'), 0.05), th = TAU * (g('cycles') * X.p + g('phase')), dirv = g('dir');
  switch (ty) {
    case 30: if (Math.abs(k) > 1e-4) { const a = k * qx, nx = Math.sin(a) / k - qy * Math.sin(a), ny = (1 - Math.cos(a)) / k + qy * Math.cos(a); qx = nx; qy = ny; } break;
    case 31: { const a = k * qx, cc = Math.cos(a), ss = Math.sin(a), ny = qy * cc - z * ss, nz = qy * ss + z * cc; qy = ny; z = nz; break; }
    case 32: { const r = Math.hypot(qx, qy), t = clamp(1 - r / size, 0, 1), f = t * t * (3 - 2 * t), r2 = rotv(qx, qy, k * f); qx = r2[0]; qy = r2[1]; break; }
    case 33: { const s = Math.max(0.02, 1 + k * qx); qy *= s; z *= s; break; }
    case 34: qx += k * qy; break;
    case 35: { const s = Math.exp(k); qx *= s; qy /= s; break; }
    case 36: { const d = k * Math.sin(TAU * (qx / size) - th); if (dirv === 0 || dirv === 2) qy += d; if (dirv === 1 || dirv === 2) z += d; break; }
    case 37: { const r = Math.hypot(qx, qy), d = k * Math.sin(TAU * (r / size) - th) * Math.exp(-g('scale') * r); if (dirv === 0 || dirv === 2) { const rr = Math.max(r, 1e-4); qx += qx / rr * d; qy += qy / rr * d; } if (dirv === 1 || dirv === 2) z += d; break; }
    case 38: {
      const cs = Math.cos(th) * NOISE_R, sn = Math.sin(th) * NOISE_R, s0 = g('seed');
      const nx = vn4(qx / size, qy / size, cs, sn, s0) * 2 - 1, ny = vn4(qx / size + 17.31, qy / size + 9.17, cs, sn, s0 + 1) * 2 - 1, nz = vn4(qx / size + 41.7, qy / size + 3.3, cs, sn, s0 + 2) * 2 - 1;
      if (dirv === 0 || dirv === 2) { qx += nx * k; qy += ny * k; } if (dirv === 1 || dirv === 2) z += nz * k; break;
    }
    case 39: { const r = Math.hypot(qx, qy), t = clamp(1 - r / size, 0, 1), f = t * t * (3 - 2 * t); qx *= 1 + k * f; qy *= 1 + k * f; break; }
    case 40: { const r = Math.hypot(qx, qy) / size; if (r < 1) { const m = clamp(k, 0, 1), nr = r + (Math.asin(r) * 2 / Math.PI - r) * m, f = r > 1e-4 ? nr / r : 1; qx *= f; qy *= f; z += k * size * Math.sqrt(Math.max(0, 1 - r * r)); } break; }
    case 41: { const r = Math.hypot(qx, qy) / size, f = 1 + k * r * r; qx *= f; qy *= f; break; }
    case 42: { const d = (X.luma(srcUV[0], srcUV[1]) - g('mid')) * k; if (dirv === 0 || dirv === 2) qy += d; if (dirv === 1 || dirv === 2) z += d; break; }
    default: break;
  }
  const r2 = rotv(qx, qy, ang); return [c[0] + r2[0], c[1] + r2[1], z];
}
// One vertex: instance idx of N, quad coordinate quv in [0,1]^2. Returns the world point, source uv and attributes.
function cpuVertex(pk, idx, N, quv, X) {
  const A = X.A, { L, E } = cpuInstance(pk, idx, N, X), V = pk.vals, one = pk.cl < 0;
  if (one) quv = [(quv[0] - 0.5) * OVER + 0.5, (quv[1] - 0.5) * OVER + 0.5];
  const lp = [(quv[0] - 0.5) * L.cw, (quv[1] - 0.5) * L.ch, 0], suv = (x, y) => [x / (2 * A) + 0.5, 0.5 - y / 2];
  const sct = Math.max(0, L.sc * (1 + E.s)), sx = sct * Math.max(0, 1 + E.sx), sy = sct * Math.max(0, 1 + E.sy);
  const rx = E.rx * Math.PI / 180, ry = E.ry * Math.PI / 180, rz = L.rot + E.rz * Math.PI / 180;
  const inst = (p3) => { // scale, rotate (x, then y, then z), translate
    let x = p3[0] * sx, y = p3[1] * sy, z = p3[2]; let t;
    t = rotv(y, z, rx); y = t[0]; z = t[1]; t = rotv(z, x, ry); z = t[0]; x = t[1]; t = rotv(x, y, rz); x = t[0]; y = t[1];
    return [x + L.c[0] + E.pos[0], y + L.c[1] + E.pos[1], z + E.pos[2]];
  };
  let wp0 = inst(lp), p3 = lp.slice();
  for (let k = 0; k < pk.count; k++) { // object-space deformers: unit = half the clone's height
    const nd = pk.table[k]; if (nd.kind !== 'deformer' || V[nd.base + SLOT.deformer.space] < 0.5) continue;
    const u = L.ch * 0.5, w = nd.ref >= 0 ? cpuFieldVal(pk, nd.ref, wp0, L.idxN, idx, X) : 1, q = cpuDeform(nd.ty, nd.base, V, pk, [p3[0] / u, p3[1] / u, p3[2] / u], w, X, suv(wp0[0], wp0[1])), mix = (a, b2) => a + (b2 - a) * w;
    p3 = [mix(p3[0], q[0] * u), mix(p3[1], q[1] * u), mix(p3[2], q[2] * u)];
  }
  let wp = inst(p3);
  for (let k = 0; k < pk.count; k++) {
    const nd = pk.table[k]; if (nd.kind !== 'deformer' || V[nd.base + SLOT.deformer.space] > 0.5) continue;
    const w = nd.ref >= 0 ? cpuFieldVal(pk, nd.ref, wp, L.idxN, idx, X) : 1, q = cpuDeform(nd.ty, nd.base, V, pk, wp, w, X, suv(wp[0], wp[1])), mix = (a, b2) => a + (b2 - a) * w;
    wp = [mix(wp[0], q[0]), mix(wp[1], q[1]), mix(wp[2], q[2])];
  }
  // source uv
  let uv;
  const content = one ? 0 : L.content; // 0 tiles 1 whole 2 dots
  if (one || content === 1) uv = [quv[0], 1 - quv[1]];
  else { const s = L.src; const ctr = suv(s[0], s[1]); uv = [ctr[0] + (quv[0] - 0.5) * s[2] / (2 * A), ctr[1] - (quv[1] - 0.5) * s[3] / 2]; }
  return { pos: wp, uv, alpha: clamp(1 + E.op, 0, 1), tint: E.tint, tintCol: E.col, color: tintColorOf(E.col, idx, L.idxN, X.pal), idxN: L.idxN, L };
}
function instanceCount(pk) {
  if (pk.cl < 0) return 1; const nd = pk.table[pk.cl], g = key => pk.vals[nd.base + SLOT.cloner[key]], mode = g('mode');
  return clamp(mode <= 1 ? Math.round(g('cols')) * Math.round(g('rows')) : Math.round(g('count')), 1, MAX_INSTANCES);
}
// Colour an effector tints with: a palette slot, one per clone in turn, or a ramp across the array (a0 to a1 to a2).
function tintColorOf(ci, idx, idxN, pal) {
  const list = [pal.ink, pal.a0, pal.a1, pal.a2, pal.bg];
  if (ci <= 4) return list[ci]; if (ci === 5) return list[idx % 5];
  const tt = idxN * 2, i0 = Math.min(Math.floor(tt), 1), f = tt - i0, a = list[1 + i0], b = list[2 + i0]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
const cpu = { pack, vertex: cpuVertex, tintColorOf, instanceCount, field: cpuFieldVal, vn4, rnd, pcg };

// ---------- cost ----------
// Vertices drawn for this graph at this size, after the budget caps; the Inspector shows it, the renderer enforces it.
function estimate(ev) {
  const pk = pack(ev), st = pk.st >= 0 ? pk.table[pk.st] : null, g = key => pk.vals[st.base + SLOT.stage[key]];
  const n = instanceCount(pk); let seg;
  if (pk.cl < 0) seg = Math.round((st ? g('detail') : 64) * OVER); else seg = Math.round(pk.vals[pk.table[pk.cl].base + SLOT.cloner.detail]);
  let verts = n * (seg + 1) * (seg + 1), capped = false;
  while (verts > MAX_VERTS && seg > 1) { seg = Math.max(1, Math.floor(seg * 0.8)); verts = n * (seg + 1) * (seg + 1); capped = true; }
  return { instances: n, seg, vertices: verts, triangles: n * seg * seg * 2, capped, effectors: pk.table.filter(t => t.kind === 'effector').length, deformers: pk.table.filter(t => t.kind === 'deformer').length, fields: pk.table.filter(t => t.kind === 'field').length };
}

// ---------- GLSL (mirrors the reference above) ----------
const slotDefs = () => Object.entries(SLOT).map(([kind, m]) => Object.entries(m).map(([k, i]) => `#define ${kind[0].toUpperCase()}_${k} ${i}`).join('\n')).join('\n');
const VS = () => `#version 300 es
precision highp float; precision highp int;
in vec2 a_uv;
uniform vec4 u_P4[${MAX_NODES * STRIDE / 4}]; uniform ivec4 u_N[${MAX_NODES}]; uniform int u_nn, u_cl, u_st, u_count, u_rev, u_sizeOne;
uniform float u_p, u_A; uniform vec3 u_pal[5]; uniform vec4 u_spec4[2]; uniform sampler2D u_src; uniform float u_eps;
out vec2 v_uv; out vec2 v_q; out vec2 v_ctr; out vec4 v_att; out vec3 v_tint; out vec3 v_n; out vec4 v_pos; out vec3 v_cinfo;
${slotDefs()}
const float TAU = 6.283185307179586;
float P(int i){ return u_P4[i >> 2][i & 3]; }
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd(uint a, uint b){ return float(pcg(pcg(a) + b)) * 2.3283064365386963e-10; }
float h4(int x, int y, int z, int w, uint s){ uint h = pcg(s ^ 0x68E31DA4u); h = pcg(h + uint(x)); h = pcg(h + uint(y)); h = pcg(h + uint(z)); h = pcg(h + uint(w)); return float(h) * 2.3283064365386963e-10; }
float vn4(vec4 p, uint seed){
  vec4 i = floor(p), f = p - i; vec4 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); ivec4 ii = ivec4(i); float acc = 0.0;
  for (int k = 0; k < 16; k++) {
    ivec4 d = ivec4(k & 1, (k >> 1) & 1, (k >> 2) & 1, (k >> 3) & 1);
    float wgt = (d.x == 1 ? u.x : 1.0 - u.x) * (d.y == 1 ? u.y : 1.0 - u.y) * (d.z == 1 ? u.z : 1.0 - u.z) * (d.w == 1 ? u.w : 1.0 - u.w);
    acc += wgt * h4(ii.x + d.x, ii.y + d.y, ii.z + d.z, ii.w + d.w, seed);
  }
  return acc;
}
float curveF(int c, float x){ x = clamp(x, 0.0, 1.0); return c == 0 ? x : c == 1 ? x * x * (3.0 - 2.0 * x) : c == 2 ? x * x : 1.0 - (1.0 - x) * (1.0 - x); }
vec2 rot2(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(v.x * c - v.y * s, v.x * s + v.y * c); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float srcLuma(vec2 uv){ return luma(textureLod(u_src, uv, 0.0).rgb); }
vec2 suv(vec2 p){ return vec2(p.x / (2.0 * u_A) + 0.5, 0.5 - p.y / 2.0); }
float gP(int b, int s){ return P(b + s); }
// --- fields ---
float fraw(int k, vec2 pos, float idxN, uint idx){
  int b = u_N[k].y, ty = u_N[k].x; float v = 0.0;
  float th = TAU * (gP(b, F_cycles) * u_p + gP(b, F_phase)); float cx = gP(b, F_x), cy = gP(b, F_y), sm = 1.0;
  int mo = int(gP(b, F_motion) + 0.5); float travel = gP(b, F_travel), ang = gP(b, F_angle) * 0.017453292519943295;
  if (mo == 1) { float s = sin(th) * travel; cx += cos(ang) * s; cy += sin(ang) * s; } else if (mo == 2) { cx += travel * cos(th); cy += travel * sin(th); } else if (mo == 3) sm = max(0.05, 1.0 + travel * 0.5 * sin(th));
  vec2 q = rot2(pos - vec2(cx, cy), -ang); float sx = max(gP(b, F_sizeX), 0.01) * sm, sy = max(gP(b, F_sizeY), 0.01) * sm; int cv = int(gP(b, F_curve) + 0.5); float fo = max(gP(b, F_falloff), 0.001);
  if (ty == 20) v = curveF(cv, (1.0 - length(vec2(q.x / sx, q.y / sy))) / fo);
  else if (ty == 21) v = curveF(cv, (1.0 - max(abs(q.x) / sx, abs(q.y) / sy)) / fo);
  else if (ty == 22) v = curveF(cv, 0.5 - q.x / (2.0 * sx));
  else if (ty == 23) v = curveF(cv, atan(q.y, q.x) / TAU + 0.5);
  else if (ty == 24) v = curveF(cv, vn4(vec4(q * gP(b, F_scale), cos(th) * ${NOISE_R.toFixed(1)}, sin(th) * ${NOISE_R.toFixed(1)}), uint(gP(b, F_seed) + 0.5)));
  else if (ty == 25) { uint sd = uint(gP(b, F_seed) + 0.5); float ra = rnd(idx, sd * 2u + 1u) * 2.0 - 1.0, rb = rnd(idx, sd * 2u + 2u) * 2.0 - 1.0; v = curveF(cv, 0.5 + 0.5 * (ra * cos(th) + rb * sin(th))); }
  else if (ty == 26) v = curveF(cv, idxN);
  else if (ty == 27) v = curveF(cv, srcLuma(suv(pos)));
  else if (ty == 28) { float s = 0.5 + 0.5 * sin(TAU * (q.x * gP(b, F_scale) * 0.5 - (gP(b, F_cycles) * u_p + gP(b, F_phase)))); float w = 1.0 - gP(b, F_falloff); v = smoothstep(0.5 - w * 0.5 - 0.001, 0.5 + w * 0.5 + 0.001, s); }
  if (gP(b, F_invert) > 0.5) v = 1.0 - v;
  return gP(b, F_outMin) + (gP(b, F_outMax) - gP(b, F_outMin)) * v;
}
float fcomb(int m, float a, float b){ a = clamp(a, 0.0, 1.0); b = clamp(b, 0.0, 1.0); return m == 0 ? min(a + b, 1.0) : m == 1 ? a * b : m == 2 ? min(a, b) : m == 3 ? max(a, b) : m == 4 ? clamp(a - b, 0.0, 1.0) : a + b * (1.0 - a); }
float fv2(int k, vec2 pos, float idxN, uint idx){ return fraw(k, pos, idxN, idx); }
float fv1(int k, vec2 pos, float idxN, uint idx){ float v = fraw(k, pos, idxN, idx); int r = u_N[k].z; if (r >= 0) v = fcomb(int(gP(u_N[k].y, F_combine) + 0.5), v, fv2(r, pos, idxN, idx)); return v; }
float fv0(int k, vec2 pos, float idxN, uint idx){ float v = fraw(k, pos, idxN, idx); int r = u_N[k].z; if (r >= 0) v = fcomb(int(gP(u_N[k].y, F_combine) + 0.5), v, fv1(r, pos, idxN, idx)); return v; }
// --- cloner ---
struct Lay { vec2 c; float rot, sc, cw, ch, idxN; vec4 src; int content; };
Lay cloneLayout(uint idx, int N){
  Lay L; L.c = vec2(0.0); L.rot = 0.0; L.sc = 1.0; L.cw = 2.0 * u_A; L.ch = 2.0; L.idxN = 0.0; L.src = vec4(0.0); L.content = 1;
  if (u_cl < 0) return L;
  int b = u_N[u_cl].y; int mode = int(gP(b, C_mode) + 0.5); float n = float(N);
  int C = max(1, int(gP(b, C_cols) + 0.5)), Rr = max(1, int(gP(b, C_rows) + 0.5)); float fi = float(idx); float idxN = N > 1 ? fi / (n - 1.0) : 0.0; float ang = gP(b, C_angle) * 0.017453292519943295;
  vec2 c; float rot = 0.0, cw, ch; vec4 src;
  if (mode <= 1) {
    int col = int(idx) % C, row = int(idx) / C; float tw = 2.0 * u_A / float(C), th = 2.0 / float(Rr), shift = (mode == 1 && (row & 1) == 1) ? 0.5 * tw : 0.0;
    float ux = -u_A + (float(col) + 0.5) * tw + shift, uy = 1.0 - (float(row) + 0.5) * th;
    c = vec2(ux * gP(b, C_width), uy * gP(b, C_height)); cw = tw * gP(b, C_fill); ch = th * gP(b, C_fill); src = vec4(ux, uy, tw, th);
  } else {
    float size = gP(b, C_size); cw = 2.0 * u_A * size; ch = 2.0 * size; vec2 u;
    if (mode == 2) { float t = idxN - 0.5, len = gP(b, C_width) * 2.0; u = vec2(cos(ang), sin(ang)) * t * len; }
    else if (mode == 3) { float arc = gP(b, C_arc); bool full = arc >= 359.9; float th = ang + (arc * 0.017453292519943295) * (full ? fi / n : idxN); u = vec2(cos(th) * gP(b, C_width), sin(th) * gP(b, C_height)); if (gP(b, C_align) > 0.5) rot += th + 1.5707963267948966; }
    else if (mode == 4) { float th = ang + gP(b, C_turns) * TAU * idxN; u = vec2(cos(th) * gP(b, C_width) * idxN, sin(th) * gP(b, C_height) * idxN); }
    else if (mode == 5) { float th = fi * 2.399963229728653 + ang, r = sqrt((fi + 0.5) / n); u = vec2(cos(th) * r * gP(b, C_width), sin(th) * r * gP(b, C_height)); if (gP(b, C_align) > 0.5) rot += th + 1.5707963267948966; }
    else { uint sd = uint(gP(b, C_seed) + 0.5); u = vec2((rnd(idx, sd * 3u + 1u) * 2.0 - 1.0) * u_A * gP(b, C_width), (rnd(idx, sd * 3u + 2u) * 2.0 - 1.0) * gP(b, C_height)); }
    c = u; src = vec4(u, cw, ch);
  }
  L.sc = gP(b, C_scale) * (1.0 + gP(b, C_stepScale) * idxN);
  rot += (gP(b, C_rotate) + gP(b, C_stepRot) * idxN) * 0.017453292519943295;
  L.c = c + vec2(gP(b, C_posX), gP(b, C_posY)); L.rot = rot; L.cw = cw; L.ch = ch; L.idxN = idxN; L.src = src; L.content = int(gP(b, C_content) + 0.5);
  return L;
}
// --- effectors ---
struct Eff { vec3 pos; vec3 rot; float s, sx, sy, op, tint, col; };
float springResp(float x){ return (1.0 - exp(-7.0 * x) * cos(TAU * 1.5 * x)) * (1.0 - smoothstep(0.78, 1.0, x)); }
float waveShape(int si, float x){ if (si == 0) { float s = sin(3.141592653589793 * x); return s * s; } if (si == 1) return 0.5 - 0.5 * cos(TAU * x); if (si == 2) return x; if (si == 3) return 1.0 - abs(2.0 * x - 1.0); return springResp(x); }
float spec(int i){ return u_spec4[i >> 2][i & 3]; }
Eff effectors(Lay L, uint idx){
  Eff E; E.pos = vec3(0.0); E.rot = vec3(0.0); E.s = 0.0; E.sx = 0.0; E.sy = 0.0; E.op = 0.0; E.tint = 0.0; E.col = 0.0;
  for (int k = 0; k < u_nn; k++) {
    int ty = u_N[k].x; if (ty < 10 || ty > 15) continue;
    int b = u_N[k].y; float th = TAU * (gP(b, E_cycles) * u_p + gP(b, E_phase)); float Tm = 1.0;
    if (ty == 11) { uint sd = uint(gP(b, E_seed) + 0.5); float ra = rnd(idx, sd * 2u + 1u) * 2.0 - 1.0, rb = rnd(idx, sd * 2u + 2u) * 2.0 - 1.0; Tm = ra * cos(th) + rb * sin(th); }
    else if (ty == 12) Tm = curveF(int(gP(b, E_curve) + 0.5), L.idxN);
    else if (ty == 13) { float x = gP(b, E_cycles) * u_p + gP(b, E_phase) - L.idxN * gP(b, E_spread); Tm = waveShape(int(gP(b, E_shape) + 0.5), x - floor(x)); }
    else if (ty == 14) Tm = vn4(vec4(L.c * gP(b, E_noiseScale), cos(th) * ${NOISE_R.toFixed(1)}, sin(th) * ${NOISE_R.toFixed(1)}), uint(gP(b, E_seed) + 0.5)) * 2.0 - 1.0;
    else if (ty == 15) { int nb = max(1, int(gP(b, E_bands) + 0.5)); float f = nb > 1 ? L.idxN * float(nb - 1) : 0.0; int i0 = int(floor(f)), i1 = min(i0 + 1, nb - 1); float fr = f - float(i0); int s0 = int(gP(b, E_bandStart) + 0.5); Tm = spec(min(7, s0 + i0)) * (1.0 - fr) + spec(min(7, s0 + i1)) * fr; }
    float fv = u_N[k].z >= 0 ? fv0(u_N[k].z, L.c, L.idxN, idx) : 1.0; float w = fv * gP(b, E_strength) * Tm;
    E.pos += vec3(gP(b, E_posX), gP(b, E_posY), gP(b, E_posZ)) * w; E.rot += vec3(gP(b, E_rotX), gP(b, E_rotY), gP(b, E_rotZ)) * w;
    E.s += gP(b, E_scale) * w; E.sx += gP(b, E_scaleX) * w; E.sy += gP(b, E_scaleY) * w; E.op += gP(b, E_opacity) * w;
    float tw = clamp(gP(b, E_tint) * w, 0.0, 1.0); if (tw > E.tint) { E.tint = tw; E.col = gP(b, E_tintColor); }
  }
  return E;
}
// --- deformers ---
vec3 deform(int ty, int b, vec3 u, vec2 sUV){
  float ang = gP(b, D_angle) * 0.017453292519943295; vec2 c = vec2(gP(b, D_x), gP(b, D_y));
  vec2 rq = rot2(u.xy - c, -ang); float qx = rq.x, qy = rq.y, z = u.z;
  float k = gP(b, D_strength), size = max(gP(b, D_size), 0.05), th = TAU * (gP(b, D_cycles) * u_p + gP(b, D_phase)); int dirv = int(gP(b, D_dir) + 0.5);
  if (ty == 30) { if (abs(k) > 1e-4) { float a = k * qx; float nx = sin(a) / k - qy * sin(a), ny = (1.0 - cos(a)) / k + qy * cos(a); qx = nx; qy = ny; } }
  else if (ty == 31) { float a = k * qx, cc = cos(a), ss = sin(a); float ny = qy * cc - z * ss, nz = qy * ss + z * cc; qy = ny; z = nz; }
  else if (ty == 32) { float r = length(vec2(qx, qy)), t = clamp(1.0 - r / size, 0.0, 1.0), f = t * t * (3.0 - 2.0 * t); vec2 r2 = rot2(vec2(qx, qy), k * f); qx = r2.x; qy = r2.y; }
  else if (ty == 33) { float s = max(0.02, 1.0 + k * qx); qy *= s; z *= s; }
  else if (ty == 34) qx += k * qy;
  else if (ty == 35) { float s = exp(k); qx *= s; qy /= s; }
  else if (ty == 36) { float d = k * sin(TAU * (qx / size) - th); if (dirv == 0 || dirv == 2) qy += d; if (dirv == 1 || dirv == 2) z += d; }
  else if (ty == 37) { float r = length(vec2(qx, qy)), d = k * sin(TAU * (r / size) - th) * exp(-gP(b, D_scale) * r); if (dirv == 0 || dirv == 2) { float rr = max(r, 1e-4); qx += qx / rr * d; qy += qy / rr * d; } if (dirv == 1 || dirv == 2) z += d; }
  else if (ty == 38) {
    float cs = cos(th) * ${NOISE_R.toFixed(1)}, sn = sin(th) * ${NOISE_R.toFixed(1)}; uint s0 = uint(gP(b, D_seed) + 0.5);
    float nx = vn4(vec4(qx / size, qy / size, cs, sn), s0) * 2.0 - 1.0, ny = vn4(vec4(qx / size + 17.31, qy / size + 9.17, cs, sn), s0 + 1u) * 2.0 - 1.0, nz = vn4(vec4(qx / size + 41.7, qy / size + 3.3, cs, sn), s0 + 2u) * 2.0 - 1.0;
    if (dirv == 0 || dirv == 2) { qx += nx * k; qy += ny * k; } if (dirv == 1 || dirv == 2) z += nz * k;
  }
  else if (ty == 39) { float r = length(vec2(qx, qy)), t = clamp(1.0 - r / size, 0.0, 1.0), f = t * t * (3.0 - 2.0 * t); qx *= 1.0 + k * f; qy *= 1.0 + k * f; }
  else if (ty == 40) { float r = length(vec2(qx, qy)) / size; if (r < 1.0) { float m = clamp(k, 0.0, 1.0), nr = r + (asin(r) * 2.0 / 3.141592653589793 - r) * m, f = r > 1e-4 ? nr / r : 1.0; qx *= f; qy *= f; z += k * size * sqrt(max(0.0, 1.0 - r * r)); } }
  else if (ty == 41) { float r = length(vec2(qx, qy)) / size, f = 1.0 + k * r * r; qx *= f; qy *= f; }
  else if (ty == 42) { float d = (srcLuma(sUV) - gP(b, D_mid)) * k; if (dirv == 0 || dirv == 2) qy += d; if (dirv == 1 || dirv == 2) z += d; }
  vec2 r2 = rot2(vec2(qx, qy), ang); return vec3(c + r2, z);
}
// One vertex of instance idx: the whole transform stack; returns the world point, source uv and attributes through outputs.
struct Vtx { vec3 pos; vec2 uv; float alpha, tint, col, idxN; Lay L; Eff E; };
Vtx vertexAt(vec2 quv, uint idx, int N, Lay L, Eff E){
  if (u_sizeOne == 1) quv = (quv - 0.5) * ${OVER.toFixed(1)} + 0.5;
  Vtx V; V.L = L; V.E = E; V.alpha = clamp(1.0 + E.op, 0.0, 1.0); V.tint = E.tint; V.col = E.col; V.idxN = L.idxN;
  vec3 lp = vec3((quv.x - 0.5) * L.cw, (quv.y - 0.5) * L.ch, 0.0);
  float sct = max(0.0, L.sc * (1.0 + E.s)), sx = sct * max(0.0, 1.0 + E.sx), sy = sct * max(0.0, 1.0 + E.sy);
  vec3 rr = E.rot * 0.017453292519943295; float rz = L.rot + rr.z;
  vec3 wp0; { vec3 p3 = lp; float x = p3.x * sx, y = p3.y * sy, z = p3.z; vec2 t = rot2(vec2(y, z), rr.x); y = t.x; z = t.y; t = rot2(vec2(z, x), rr.y); z = t.x; x = t.y; t = rot2(vec2(x, y), rz); wp0 = vec3(t + L.c + E.pos.xy, z + E.pos.z); }
  vec3 p3 = lp;
  for (int k = 0; k < u_nn; k++) {
    int ty = u_N[k].x; if (ty < 30 || ty > 42) continue; int b = u_N[k].y; if (gP(b, D_space) < 0.5) continue;
    float u = L.ch * 0.5, w = u_N[k].z >= 0 ? fv0(u_N[k].z, wp0.xy, L.idxN, idx) : 1.0; vec3 q = deform(ty, b, p3 / u, suv(wp0.xy)); p3 = mix(p3, q * u, w);
  }
  vec3 wp; { float x = p3.x * sx, y = p3.y * sy, z = p3.z; vec2 t = rot2(vec2(y, z), rr.x); y = t.x; z = t.y; t = rot2(vec2(z, x), rr.y); z = t.x; x = t.y; t = rot2(vec2(x, y), rz); wp = vec3(t + L.c + E.pos.xy, z + E.pos.z); }
  for (int k = 0; k < u_nn; k++) {
    int ty = u_N[k].x; if (ty < 30 || ty > 42) continue; int b = u_N[k].y; if (gP(b, D_space) > 0.5) continue;
    float w = u_N[k].z >= 0 ? fv0(u_N[k].z, wp.xy, L.idxN, idx) : 1.0; vec3 q = deform(ty, b, wp, suv(wp.xy)); wp = mix(wp, q, w);
  }
  V.pos = wp;
  if (u_sizeOne == 1 || L.content == 1) V.uv = vec2(quv.x, 1.0 - quv.y);
  else { vec2 ctr = suv(L.src.xy); V.uv = vec2(ctr.x + (quv.x - 0.5) * L.src.z / (2.0 * u_A), ctr.y - (quv.y - 0.5) * L.src.w / 2.0); }
  return V;
}
vec4 project(vec3 wp){
  int b = u_N[u_st].y; vec3 p = wp;
  if (gP(b, S_camera) > 0.5) {
    float ox = gP(b, S_orbitX) * 0.017453292519943295, oy = gP(b, S_orbitY) * 0.017453292519943295;
    vec2 t = rot2(vec2(p.z, p.y), ox); p.z = t.x; p.y = t.y; t = rot2(vec2(p.x, p.z), oy); p.x = t.x; p.z = t.y; // orbit about the origin
    p.xy += vec2(gP(b, S_panX), gP(b, S_panY));
    float d = 1.0 / tan(gP(b, S_fov) * 0.5 * 0.017453292519943295); float s = d / max(0.05, d - p.z);
    return vec4(p.x / u_A * s, p.y * s, clamp(-p.z * 0.1, -0.99, 0.99), 1.0);
  }
  return vec4(p.x / u_A, p.y, clamp(-p.z * 0.1, -0.99, 0.99), 1.0);
}
void main(){
  uint id = uint(gl_InstanceID); uint idx = u_rev == 1 ? uint(u_count - 1) - id : id; int N = u_count;
  Lay L = cloneLayout(idx, N); Eff E = effectors(L, idx);
  Vtx V = vertexAt(a_uv, idx, N, L, E);
  vec3 n = vec3(0.0, 0.0, 1.0);
  int sb = u_N[u_st].y;
  if (gP(sb, S_light) > 0.001) {
    Vtx Vx = vertexAt(a_uv + vec2(u_eps, 0.0), idx, N, L, E), Vy = vertexAt(a_uv + vec2(0.0, u_eps), idx, N, L, E);
    n = normalize(cross(Vx.pos - V.pos, Vy.pos - V.pos)); if (!(length(n) > 0.0)) n = vec3(0.0, 0.0, 1.0);
  }
  gl_Position = project(V.pos);
  v_uv = V.uv; v_q = a_uv; v_n = n; v_pos = vec4(V.pos, V.alpha);
  v_att = vec4(V.alpha, V.tint, float(L.content), 0.0);
  int ci = int(V.col + 0.5);
  if (ci <= 4) v_tint = u_pal[ci]; else if (ci == 5) v_tint = u_pal[int(idx % 5u)];
  else { float tt = V.idxN * 2.0; int i0 = int(min(floor(tt), 1.0)); v_tint = mix(u_pal[1 + i0], u_pal[2 + i0], tt - float(i0)); }
  vec2 ctr = L.src.xy; v_ctr = suv(ctr);
  v_cinfo = vec3(L.src.z / (2.0 * u_A), L.src.w / 2.0, V.idxN);
}`;
const FS = () => `#version 300 es
precision highp float; precision highp int; in vec2 v_uv; in vec2 v_q; in vec2 v_ctr; in vec4 v_att; in vec3 v_tint; in vec3 v_n; in vec4 v_pos; in vec3 v_cinfo;
uniform sampler2D u_src; uniform vec4 u_P4[${MAX_NODES * STRIDE / 4}]; uniform ivec4 u_N[${MAX_NODES}]; uniform int u_cl, u_st, u_sizeOne, u_depthSort;
uniform float u_A;
${slotDefs()}
out vec4 o;
float P(int i){ return u_P4[i >> 2][i & 3]; }
float gP(int b, int s){ return P(b + s); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
void main(){
  int sb = u_N[u_st].y; int edge = int(gP(sb, S_edge) + 0.5);
  vec2 uv = v_uv; float inside = 1.0;
  if (edge == 1) { vec2 m = mod(uv, 2.0); uv = mix(m, 2.0 - m, step(1.0, m)); }
  else if (edge == 2) uv = fract(uv);
  else if (edge == 3) { vec2 e = min(uv, 1.0 - uv); vec2 fw = max(fwidth(uv), vec2(1e-6)); inside = clamp(min(e.x / fw.x, e.y / fw.y) + 0.5, 0.0, 1.0); }
  uv = clamp(uv, 0.0, 1.0);
  int content = u_sizeOne == 1 ? 1 : int(v_att.z + 0.5);
  vec4 c;
  float cover = 1.0;
  if (content == 2) {
    int cb = u_N[u_cl].y; vec2 ctr = clamp(v_ctr, 0.0, 1.0); vec2 hs = vec2(v_cinfo.x, v_cinfo.y) * 0.25;
    c = 0.25 * texture(u_src, ctr) + 0.125 * (texture(u_src, ctr + vec2(hs.x, 0.0)) + texture(u_src, ctr - vec2(hs.x, 0.0)) + texture(u_src, ctr + vec2(0.0, hs.y)) + texture(u_src, ctr - vec2(0.0, hs.y))) + 0.0625 * (texture(u_src, ctr + hs) + texture(u_src, ctr - hs) + texture(u_src, ctr + vec2(hs.x, -hs.y)) + texture(u_src, ctr + vec2(-hs.x, hs.y)));
    float L = luma(c.rgb / max(c.a, 1e-4)) * c.a; if (gP(cb, C_dotInvert) > 0.5) L = 1.0 - L;
    float rad = mix(gP(cb, C_dotMin), gP(cb, C_dotMax), L); vec2 q = (v_q - 0.5) * 2.0; int shp = int(gP(cb, C_shape) + 0.5); float d;
    if (shp == 0) d = length(q) - rad; else if (shp == 1) d = max(abs(q.x), abs(q.y)) - rad; else if (shp == 2) d = (abs(q.x) + abs(q.y)) - rad * 1.2; else d = abs(length(q) - rad * 0.8) - rad * 0.2;
    float px = max(fwidth(d), 1e-5); cover = clamp(0.5 - d / px, 0.0, 1.0);
  } else {
    c = texture(u_src, uv);
    if (u_sizeOne == 0) { vec2 e = min(v_q, 1.0 - v_q); vec2 fw = max(fwidth(v_q), vec2(1e-6)); cover = clamp(min(e.x / fw.x, e.y / fw.y) + 0.5, 0.0, 1.0); }
  }
  c *= cover * inside;
  float a = v_att.x; float tn = v_att.y; vec3 un = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  c.rgb = mix(c.rgb, v_tint * c.a, tn);
  float lt = gP(sb, S_light);
  if (lt > 0.001) { float la = gP(sb, S_lightAngle) * 0.017453292519943295; vec3 Ld = normalize(vec3(cos(la) * 0.6, sin(la) * 0.6, 0.8)); float lam = max(dot(normalize(v_n), Ld), 0.0); c.rgb *= mix(1.0, 0.25 + 0.95 * lam, lt); }
  c *= a;
  if (u_depthSort == 1 && c.a < 0.02) discard;
  o = c;
}`;
// Transform-feedback probe: the same vertex program, no fragment work; the tests read the positions back.
const FS_PROBE = `#version 300 es
precision lowp float; out vec4 o; void main(){ o = vec4(0.0); }`;

// ---------- renderer ----------
function createRenderer() {
  let canvas = null, gl = null, ok = false, prog = null, probe = null, tex = null, W = 0, H = 0, space = 'srgb', lost = false, lastErr = '';
  const meshes = new Map(), U = {}, stats = { frames: 0, last: null };
  const compile = (vs, fs, tf) => {
    const mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error((t === gl.VERTEX_SHADER ? 'vertex: ' : 'fragment: ') + gl.getShaderInfoLog(x)); return x; };
    const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'a_uv');
    if (tf) gl.transformFeedbackVaryings(p, tf, gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i), nm = a.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  };
  function init() {
    try {
      if (!canvas) { canvas = document.createElement('canvas'); canvas.width = 2; canvas.height = 2; }
      gl = gl || canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: false, alpha: true, depth: true });
      if (!gl) { lastErr = 'WebGL2 unavailable'; return; }
      prog = compile(VS(), FS());
      tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      ok = true; lost = false; lastErr = '';
    } catch (e) { ok = false; lastErr = String(e && e.message || e).slice(0, 400); console.error('graph:', lastErr); }
  }
  init();
  if (canvas && canvas.addEventListener) {
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ok = false; lost = true; meshes.clear(); setTimeout(() => { try { const x = gl && gl.getExtension('WEBGL_lose_context'); if (x && gl.isContextLost()) x.restoreContext(); } catch (er) { /* stays lost */ } }, 300); });
    canvas.addEventListener('webglcontextrestored', () => { gl = null; prog = null; probe = null; init(); });
  }
  function setSpace(s) { space = s; if (!ok) return; const cs = s === 'p3' ? 'display-p3' : 'srgb'; try { if ('drawingBufferColorSpace' in gl) gl.drawingBufferColorSpace = cs; if ('unpackColorSpace' in gl) gl.unpackColorSpace = cs; } catch (e) { /* unsupported */ } }
  function mesh(seg) {
    let m = meshes.get(seg); if (m) return m;
    const n = seg + 1, pos = new Float32Array(n * n * 2), idx = new Uint32Array(seg * seg * 6);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { pos[(j * n + i) * 2] = i / seg; pos[(j * n + i) * 2 + 1] = j / seg; }
    let k = 0; for (let j = 0; j < seg; j++) for (let i = 0; i < seg; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c; }
    const vb = gl.createBuffer(), ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    m = { vb, ib, count: idx.length, seg }; meshes.set(seg, m); if (meshes.size > 12) { const f = meshes.keys().next().value, o = meshes.get(f); gl.deleteBuffer(o.vb); gl.deleteBuffer(o.ib); meshes.delete(f); } return m;
  }
  const palVec = pal => { const v = new Float32Array(15); [pal.ink, pal.a0, pal.a1, pal.a2, pal.bg].forEach((c, i) => { v.set(c, i * 3); }); return v; };
  function setup(pg, pk, X, w, h) {
    const u = pg.u; gl.useProgram(pg.p);
    const N = new Int32Array(MAX_NODES * 4); pk.table.forEach((t, i) => { N[i * 4] = t.ty; N[i * 4 + 1] = t.base; N[i * 4 + 2] = t.ref; N[i * 4 + 3] = 1; });
    if (u.u_P4) gl.uniform4fv(u.u_P4, pk.vals); if (u.u_N) gl.uniform4iv(u.u_N, N);
    const set1i = (n, v) => { if (u[n] != null) gl.uniform1i(u[n], v); }, set1f = (n, v) => { if (u[n] != null) gl.uniform1f(u[n], v); };
    set1i('u_nn', pk.count); set1i('u_cl', pk.cl); set1i('u_st', Math.max(0, pk.st)); set1f('u_p', X.p); set1f('u_A', X.A); set1i('u_sizeOne', pk.cl < 0 ? 1 : 0);
    if (u.u_pal) gl.uniform3fv(u.u_pal, palVec(X.pal)); if (u.u_spec4) gl.uniform4fv(u.u_spec4, new Float32Array(X.spec));
    set1i('u_src', 0);
  }
  // Render srcCanvas through the graph. X: { A, p, pal, spec, w, h, space }. Returns the GL canvas (premultiplied) or null.
  function render(srcCanvas, ev, X, w, h) {
    if (!ok) return null;
    try {
      const pk = pack(ev); if (pk.st < 0) return null;
      const N = instanceCount(pk), est = estimate(ev), seg = est.seg, one = pk.cl < 0, st = pk.table[pk.st];
      if (w !== W || h !== H) { W = w; H = h; canvas.width = w; canvas.height = h; }
      const mc = mesh(seg);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);
      setup(prog, pk, X, w, h);
      const cl = pk.cl >= 0 ? pk.table[pk.cl] : null, u = prog.u;
      gl.uniform1i(u.u_count, N); gl.uniform1i(u.u_rev, cl && pk.vals[cl.base + SLOT.cloner.reverse] > 0.5 ? 1 : 0); gl.uniform1f(u.u_eps, 1 / Math.max(2, seg * 2));
      const depth = pk.vals[st.base + SLOT.stage.depth] > 0.5; gl.uniform1i(u.u_depthSort, depth ? 1 : 0);
      if (depth) { gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); } else gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.bindBuffer(gl.ARRAY_BUFFER, mc.vb); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mc.ib);
      gl.drawElementsInstanced(gl.TRIANGLES, mc.count, gl.UNSIGNED_INT, 0, N);
      gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
      stats.frames++; stats.last = est;
      return canvas;
    } catch (e) { lastErr = String(e && e.message || e).slice(0, 400); console.error('graph render:', lastErr); return null; }
  }
  // Probe (tests): vertex outputs read back through transform feedback. pts = [{ q: [u, v] }]; returns instance-major [{ inst, pos, alpha, uv }].
  function probeVertices(ev, X, pts) {
    if (!ok) return null;
    if (!probe) probe = compile(VS(), FS_PROBE, ['v_pos', 'v_uv', 'v_tint']);
    const pk = pack(ev), N = instanceCount(pk), out = [], per = 9;
    const buf = gl.createBuffer(), tfo = gl.createTransformFeedback(), vb = gl.createBuffer();
    const arr = new Float32Array(pts.length * 2); pts.forEach((p, i) => { arr[i * 2] = p.q[0]; arr[i * 2 + 1] = p.q[1]; });
    gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    if (!tex) tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (X.lumaTex) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, X.lumaTex); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
    setup(probe, pk, X, 8, 8); const u = probe.u; gl.uniform1i(u.u_count, N); gl.uniform1i(u.u_rev, 0); gl.uniform1f(u.u_eps, 0.01);
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, buf); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, pts.length * N * per * 4, gl.STREAM_READ);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfo); gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buf);
    gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS); gl.drawArraysInstanced(gl.POINTS, 0, pts.length, N); gl.endTransformFeedback(); gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    const res = new Float32Array(pts.length * N * per); gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, buf); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, res);
    for (let inst = 0; inst < N; inst++) for (let i = 0; i < pts.length; i++) { const o = (inst * pts.length + i) * per; out.push({ inst, pos: [res[o], res[o + 1], res[o + 2]], alpha: res[o + 3], uv: [res[o + 4], res[o + 5]], color: [res[o + 6], res[o + 7], res[o + 8]] }); }
    gl.deleteBuffer(buf); gl.deleteBuffer(vb); gl.deleteTransformFeedback(tfo);
    return out;
  }
  return { get ok() { return ok; }, get error() { return lastErr; }, get canvas() { return canvas; }, get stats() { return stats; }, setSpace, render, probeVertices, get gl() { return gl; } };
}

// ---------- presets: whole graphs as data (the node ids are renamed on apply) ----------
const N_ = (type, params = {}, ref) => ({ type, params, ref: ref || '' });
const PRESETS = [
  { id: 'radial-array', name: 'Radial array', blurb: 'The picture copied around a ring, each copy popping in turn.', scope: 'any', nodes: [N_('cloner', { mode: 'radial', content: 'whole', count: 14, size: 0.24, width: 0.66, height: 0.66, align: true }), N_('delay', { scale: 0.45, shape: 'spring', spread: 1, cycles: 1 })] },
  { id: 'grid-cascade', name: 'Grid cascade', blurb: 'The picture cut into tiles that drop in as a wave.', scope: 'any', nodes: [N_('cloner', { mode: 'grid', content: 'tiles', cols: 12, rows: 7, fill: 0.96, detail: 2 }), N_('delay', { posY: 0.5, scale: -0.7, opacity: -1, shape: 'pulse', spread: 1.2, cycles: 1 })] },
  { id: 'type-wave', name: 'Type wave', blurb: 'A travelling wave through the whole picture.', scope: 'any', nodes: [N_('wave', { strength: 0.06, size: 0.9, angle: 0, cycles: 1 }), N_('wave', { strength: 0.03, size: 0.35, angle: 90, cycles: 2, phase: 0.25 })] },
  { id: 'lens-ripple', name: 'Lens ripple', blurb: 'A pond ripple with a lens that swells and settles.', scope: 'any', nodes: [N_('ripple', { strength: 0.04, size: 0.3, cycles: 1, scale: 0.9, dir: 'plane' }), N_('lens', { strength: 0.35, size: 1.4 })] },
  { id: 'shatter-reveal', name: 'Shatter', blurb: 'Tiles scatter outward as a soft field sweeps across.', scope: 'any', nodes: [N_('cloner', { mode: 'grid', content: 'tiles', cols: 16, rows: 9, fill: 0.98, detail: 1 }), N_('sphere', { sizeX: 0.55, sizeY: 1.6, motion: 'sweep', travel: 1.6, cycles: 1, angle: 0 }), N_('random', { posX: 0.5, posY: 0.4, posZ: 0.6, rotZ: 90, rotX: 120, scale: -0.3, opacity: -0.6, cycles: 1 }, 'field')] },
  { id: 'halftone-dots', name: 'Halftone dots', blurb: 'The picture rebuilt from dots sized by brightness.', scope: 'any', nodes: [N_('cloner', { mode: 'grid', content: 'dots', cols: 64, rows: 36, fill: 1, detail: 1, dotMin: 0.1, dotMax: 0.95 }), N_('noise', { scale: 0.2, posX: 0, posY: 0, rotZ: 0, noiseScale: 1.2 })] },
  { id: 'honeycomb-pop', name: 'Honeycomb pop', blurb: 'A honeycomb of tiles that pop through a wave.', scope: 'any', nodes: [N_('cloner', { mode: 'honeycomb', content: 'tiles', cols: 10, rows: 9, fill: 0.9, detail: 2 }), N_('delay', { scale: 0.45, rotZ: 25, shape: 'sine', spread: 2, cycles: 1 })] },
  { id: 'twist-taper', name: 'Twist and taper', blurb: 'A 3D twist seen through a perspective camera.', scope: 'any', nodes: [N_('stage', { camera: 'persp', fov: 60, orbitY: 18, orbitX: -6, light: 0.5 }), N_('twist', { strength: 0.9, angle: 0 }), N_('taper', { strength: 0.25, angle: 0 })] },
  { id: 'noise-melt', name: 'Noise melt', blurb: 'Organic noise warp with a slow swirl.', scope: 'any', nodes: [N_('noised', { strength: 0.12, size: 0.55, cycles: 1, dir: 'plane' }), N_('swirl', { strength: 1.4, size: 1.0 })] },
  { id: 'sunflower-bloom', name: 'Sunflower bloom', blurb: 'Copies in a sunflower spiral blooming outward.', scope: 'any', nodes: [N_('cloner', { mode: 'phyllo', content: 'whole', count: 90, size: 0.16, width: 1, height: 1 }), N_('delay', { scale: 0.9, shape: 'spring', spread: 1.5, cycles: 1 })] },
  { id: 'kick-pump', name: 'Kick pump', blurb: 'The picture pumps on the beat and bulges a little. Load audio to see it move.', scope: 'any', nodes: [N_('sound', { scale: 0.14, bands: 1, bandStart: 7 }), N_('bulge', { strength: 0.25, size: 1.1 })] },
  { id: 'perspective-cards', name: 'Perspective cards', blurb: 'Tiles flip as cards in 3D.', scope: 'any', nodes: [N_('stage', { camera: 'persp', fov: 50, orbitX: -10, orbitY: 12, light: 0.35, depth: true }), N_('cloner', { mode: 'grid', content: 'tiles', cols: 8, rows: 5, fill: 0.94, detail: 1 }), N_('delay', { rotY: 180, shape: 'sine', spread: 1, cycles: 1 })] },
];
function applyPreset(id, scope) {
  const p = PRESETS.find(x => x.id === id); if (!p) return null;
  const g = newGraph(scope), used = new Set(g.nodes.map(n => n.id)); const ids = []; // ids by order for refs: 'field' = the last field added
  let lastField = '';
  for (const spec of p.nodes) {
    if (spec.type === 'stage') { Object.assign(g.nodes[0].params, sanitize(Object.assign(g.nodes[0].params, spec.params), TYPES.stage.schema)); continue; }
    const n = newNode(spec.type, used); used.add(n.id); Object.assign(n.params, spec.params); n.params = sanitize(n.params, schemaFor(n.type));
    if (kindOf(n.type) === 'field') lastField = n.id; ids.push(n.id);
    if (spec.ref === 'field') n.ref = lastField; else if ('ref' in n) n.ref = '';
    g.nodes.push(n);
  }
  return sanitizeGraph(g, scope);
}

return { VERSION, OVER, COMPOSITE, MAX_NODES, MAX_INSTANCES, MAX_VERTS, STRIDE, TYPES, TYPE_IDS, KINDS, FAMILY, LAYOUT, SLOT, CURVES, PRESETS, kindOf, schemaFor, typeDefaults, newGraph, newNode, sanitizeGraph, evalCopy, nodeById, stageOf, active, usesSound, schemaAt, nodeLabel, paths, pack, estimate, cpu, createRenderer, applyPreset, VS, FS };

})();
