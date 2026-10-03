import { R, I, lens } from '../../tools/helpers.mjs';

const params = {
  freq: R('Spatial frequency', 2, 7, 4, { group: 'Form', hint: 'Gyroid frequency k (cells per radian of object space). Higher = finer lattice.' }),
  shell: R('Shell thickness', 0.04, 0.35, 0.16, { group: 'Form', hint: 'Wall thickness of the implicit shell, in gyroid units.' }),
  bound: R('Bound radius', 0.6, 1.6, 1.1, { group: 'Form', hint: 'Radius of the clipping ball. Larger shows more of the lattice.' }),
  warp: R('Warp amplitude', 0, 0.15, 0.04, { group: 'Form', hint: 'Domain warp. The sphere-tracing bound is re-derived for it.' }),
  metal: R('Ceramic ↔ metal mix', 0, 1, 0.3, { group: 'Material', hint: '0 = all ivory ceramic, 1 = all copper metal. Metal appears on one wall of the shell first.' }),
  rough: R('Roughness', 0.12, 0.7, 0.28, { group: 'Material', hint: 'Surface roughness of both materials.' }),
  cavity: R('Cavity contrast', 0, 1, 0.55, { group: 'Light', hint: 'Strength of ambient occlusion and contact shadows in the cavities.' }),
  morph: R('Morph amplitude', 0, 0.12, 0.035, { group: 'Motion', hint: 'Periodic breathing of shell thickness.' }),
  turns: I('Turns per loop', 0, 2, 1, { group: 'Motion', hint: 'Whole object rotations per loop.', mutate: 0 }),
  orbit: R('Camera orbit', 0, 0.25, 0.06, { group: 'Motion', hint: 'Closed camera orbit amplitude, radians.' }),
  ...lens({ keyAngle: 130, exposure: 1.0, bloom: 0.25, vignette: 0.4 }),
};

export default {
  id: 'topological-tide', name: 'Topological Tide', version: '1.0.0', accent: '#D8803F', post: 'luminous', sceneScale: 1, cost: 4,
  description: 'Ivory ceramic and copper metal implicit surfaces with cobalt shadows: gyroid shells, tori, Möbius ribbons and folded plates, sphere-traced with derived Lipschitz bounds. Nine seamless infinite loops.',
  palettes: [
    { id: 'ivory-cobalt', name: 'Ivory Cobalt', bg: '#03081C', ink: '#F2EBDD', a: ['#2A55D8', '#D8803F', '#0A1A4D'] },
    { id: 'porcelain-rose', name: 'Porcelain Rose', bg: '#12070B', ink: '#F7EBE6', a: ['#9C4A66', '#E8A56E', '#3A1020'] },
    { id: 'celadon', name: 'Celadon', bg: '#031210', ink: '#EEF2E2', a: ['#4FA38C', '#D9B25A', '#0A3A33'] },
    { id: 'graphite-gold', name: 'Graphite Gold', bg: '#08090B', ink: '#EDEBE6', a: ['#5A6470', '#E3B65C', '#1A1E24'] },
  ],
  params,
  styles: [
    { id: 'topological-tide-hero', name: 'Topological Tide Hero', variant: 0, palette: 'ivory-cobalt', tags: ['flagship', 'gyroid', 'ceramic'], blurb: 'An ivory gyroid shell with a copper inner wall and cobalt shadows in its cavities, turning once per loop.', fingerprint: 'Form: gyroid shell in a clipping ball. Material: ivory ceramic, copper on one wall. Motion: one object turn, breathing wall.', over: {} },
    { id: 'ivory-gyroid', name: 'Ivory Gyroid', variant: 1, palette: 'ivory-cobalt', tags: ['ceramic', 'matte'], blurb: 'Pure matte ivory: thicker walls, no metal, soft shadows deep in the channels.', fingerprint: 'Form: thick gyroid, k=3. Material: matte ceramic only. Motion: slow turn.', over: { freq: 3, shell: 0.24, metal: 0, rough: 0.5, cavity: 0.8, bound: 1.2 } },
    { id: 'chrome-channels', name: 'Chrome Channels', variant: 2, palette: 'graphite-gold', tags: ['chrome', 'reflective'], blurb: 'Thin polished chrome channels reflecting a warm softbox and a cobalt sky.', fingerprint: 'Form: thin gyroid, k=4.6. Material: all polished metal. Motion: turn with sheen travelling over the walls.', over: { freq: 4.6, shell: 0.1, metal: 1, rough: 0.14, cavity: 0.4, bloom: 0.35 } },
    { id: 'cobalt-torus', name: 'Cobalt Torus', variant: 3, palette: 'ivory-cobalt', tags: ['torus', 'glaze'], blurb: 'A cobalt-glazed torus whose wall is perforated by a gyroid cut; the ring breathes as it turns.', fingerprint: 'Form: exact torus perforated by a bound gyroid (max). Material: cobalt glaze. Motion: turn, breathing tube.', over: { freq: 5, shell: 0.2, metal: 0.15, rough: 0.2, bound: 1.3 } },
    { id: 'mobius-current', name: 'Mobius Current', variant: 4, palette: 'porcelain-rose', tags: ['mobius', 'inlay'], blurb: 'A half-twisted ceramic ribbon with copper inlay stripes that run once around the loop.', fingerprint: 'Form: half-twisted box swept on a circle (Mobius). Material: porcelain with copper inlay. Motion: turn, inlay stripes travelling.', over: { metal: 0.5, rough: 0.22, bound: 1.35, cavity: 0.5 } },
    { id: 'perforated-fold', name: 'Perforated Fold', variant: 5, palette: 'celadon', tags: ['fold', 'plate'], blurb: 'A folded celadon plate perforated by a regular array of holes, folding and unfolding in place.', fingerprint: 'Form: sine-folded plate with a hole grid. Material: celadon ceramic. Motion: fold amplitude breathing, turn.', over: { shell: 0.3, metal: 0, rough: 0.3, morph: 0.08, bound: 1.2 } },
    { id: 'ceramic-web', name: 'Ceramic Web', variant: 6, palette: 'porcelain-rose', tags: ['web', 'lattice'], blurb: 'A fine, thin lattice: almost a web of porcelain with deep, dark pockets.', fingerprint: 'Form: very fine thin gyroid, k=6.6. Material: porcelain. Motion: slow turn, small warp.', over: { freq: 6.6, shell: 0.075, metal: 0.1, rough: 0.35, cavity: 0.9, bound: 1.0, warp: 0.06 } },
    { id: 'golden-neck', name: 'Golden Neck', variant: 7, palette: 'graphite-gold', tags: ['necking', 'gold'], blurb: 'Gold-bright gyroid lobes join and pinch as the iso-level slides: topology changes through smooth necks.', fingerprint: 'Form: gyroid with sliding iso-level (necking). Material: gold-leaning metal. Motion: iso-level oscillation, turn.', over: { freq: 3.4, shell: 0.17, metal: 0.8, rough: 0.2, bound: 1.2 } },
    { id: 'quiet-surface', name: 'Quiet Surface', variant: 8, palette: 'celadon', tags: ['calm', 'ambient'], blurb: 'One large, soft surface in even light. The calmest of the set, for text-safe backgrounds.', fingerprint: 'Form: broad gyroid, k=2.2. Material: soft matte celadon. Motion: single slow turn, no morph.', over: { freq: 2.2, shell: 0.26, metal: 0, rough: 0.55, cavity: 0.35, morph: 0.01, orbit: 0.02, bloom: 0.15, exposure: 0.92, warp: 0.02, bound: 1.3 } },
  ],
};
