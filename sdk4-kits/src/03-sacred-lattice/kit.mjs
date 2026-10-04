import { R, I, lens } from '../../tools/helpers.mjs';

const params = {
  levels: I('Nesting levels', 2, 7, 4, { group: 'Form', hint: 'Number of nested cages. Each is scaled by the nesting ratio.', mutate: 0.3 }),
  ratio: R('Nesting ratio', 0.45, 0.85, 0.618, { group: 'Form', hint: 'Scale of each cage relative to the one outside it. 0.618 is the golden ratio.' }),
  depthSp: R('Depth spacing', 0.05, 0.6, 0.22, { group: 'Form', hint: 'Separation of the cages in depth. Drives perspective and parallax.' }),
  circleLayers: I('Circle layers', 0, 8, 4, { group: 'Form', hint: 'Concentric circles with inscribed chord polygons. 0 removes them.', mutate: 0.3 }),
  edgeR: R('Edge radius', 0.001, 0.016, 0.004, { group: 'Material', hint: 'Radius of gold edges in scene units.', log: true }),
  facet: R('Facet opacity', 0, 0.55, 0.16, { group: 'Material', hint: 'Pale glass faces on tetra and octahedra. Approximate glass, not refraction.' }),
  core: R('Core intensity', 0.1, 3, 0.7, { group: 'Light', hint: 'Central light. Kept small so geometry stays readable at the focus.', randMax: 1.6 }),
  cageTurns: I('Cage turns per loop', 0, 3, 1, { group: 'Motion', hint: 'Whole revolutions of each cage per loop, alternating direction.', mutate: 0 }),
  orbit: R('Camera orbit amplitude', 0, 0.25, 0.08, { group: 'Motion', hint: 'Closed camera orbit, radians.' }),
  breath: R('Breath', 0, 0.1, 0.03, { group: 'Motion', hint: 'Scale and facet breathing, sin(theta + phase).' }),
  ...lens({ keyAngle: 130, exposure: 1.0, bloom: 0.5 }),
};

export default {
  id: 'sacred-lattice', name: 'Sacred Lattice', version: '1.0.0', accent: '#E9B24A', post: 'luminous', sceneScale: 1, ssaa: 4, cost: 2,
  description: 'Gold connections, pale glass and obsidian blue: nested polyhedral cages, circles and chord networks in exact geometry. Nine seamless infinite loops.',
  palettes: [
    { id: 'gold-obsidian', name: 'Gold Obsidian', bg: '#02040C', ink: '#E4EDFF', a: ['#E9B24A', '#7FB2FF', '#1B2A66'] },
    { id: 'rose-gold', name: 'Rose Gold', bg: '#090409', ink: '#FCEAEC', a: ['#F0B08C', '#C99BE8', '#3A1A4E'] },
    { id: 'emerald-brass', name: 'Emerald Brass', bg: '#010C0A', ink: '#E3F7EF', a: ['#D9B253', '#5FE0B8', '#0B4A3F'] },
    { id: 'silver-ice', name: 'Silver Ice', bg: '#03060C', ink: '#EEF4FF', a: ['#C4D2E6', '#8FC4FF', '#1E3358'] },
  ],
  params,
  styles: [
    { id: 'sacred-lattice-hero', name: 'Sacred Lattice Hero', variant: 0, palette: 'gold-obsidian', tags: ['flagship', 'geometry', 'cages'], blurb: 'Four nested octa/tetra cages turn against each other inside golden circles, pale glass faces catching the key.', fingerprint: 'Form: nested dual cages + circle chords. Material: gold edges, pale glass. Motion: alternating whole turns, closed camera orbit.', over: {} },
    { id: 'octahedral-chapel', name: 'Octahedral Chapel', variant: 1, palette: 'silver-ice', tags: ['octahedron', 'chapel'], blurb: 'Octahedra nest in deep perspective like arches; glass faces are strong and the vault feels tall.', fingerprint: 'Form: nested octahedra, deep depth spacing. Material: glass-forward. Motion: one slow turn, steady orbit.', over: { levels: 5, depthSp: 0.42, facet: 0.12, circleLayers: 2, ratio: 0.7, cageTurns: 1, bloom: 0.3, exposure: 0.8 } },
    { id: 'tetrahedral-orbit', name: 'Tetrahedral Orbit', variant: 2, palette: 'rose-gold', tags: ['tetrahedron', 'orbit'], blurb: 'Tetrahedra spin at different whole rates while small bodies orbit on tracks around them.', fingerprint: 'Form: nested tetrahedra + orbit tracks. Material: rose gold line, bright nodes. Motion: 1x and 2x counter-rotation with orbiting beads.', drop: ['circleLayers'], over: { levels: 4, circleLayers: 0, facet: 0.12, cageTurns: 1, edgeR: 0.0035 } },
    { id: 'golden-icosahedron', name: 'Golden Icosahedron', variant: 3, palette: 'gold-obsidian', tags: ['icosahedron', 'golden'], blurb: 'Icosahedra built from golden-ratio coordinates, heavy gold edges with bright vertex jewels.', fingerprint: 'Form: nested icosahedra (golden coordinates). Material: thick gold, vertex jewels. Motion: slow alternating turns.', drop: ['circleLayers', 'facet', 'keyAngle'], over: { levels: 4, edgeR: 0.0065, circleLayers: 3, facet: 0, core: 1.0, ratio: 0.618 } },
    { id: 'circle-cathedral', name: 'Circle Cathedral', variant: 4, palette: 'emerald-brass', tags: ['circles', 'flat', 'lattice'], blurb: 'Seven interlocked circles and tick rings: a flat, luminous rose window with counter-turning bands.', fingerprint: 'Form: 6-fold circle lattice + tick bands (2D, no polyhedra). Material: brass line. Motion: counter-rotating bands.', drop: ['levels', 'depthSp', 'facet', 'orbit', 'breath', 'keyAngle'], over: { circleLayers: 5, edgeR: 0.0035, core: 0.5, cageTurns: 1, facet: 0 } },
    { id: 'nested-compass', name: 'Nested Compass', variant: 5, palette: 'silver-ice', tags: ['compass', 'chords'], blurb: 'Concentric compass rings carry ticks and inscribed chord polygons that turn like an astrolabe.', fingerprint: 'Form: rings, ticks, n-gon chords, needles. Material: silver line. Motion: counter-rotating rings.', drop: ['depthSp', 'facet', 'orbit', 'breath', 'keyAngle'], over: { circleLayers: 7, levels: 5, ratio: 0.8, edgeR: 0.0032, core: 0.4, cageTurns: 1 } },
    { id: 'glass-constellation', name: 'Glass Constellation', variant: 6, palette: 'gold-obsidian', tags: ['constellation', 'nodes'], blurb: 'Vertices become stars: fine hairline chords join icosa and cube nodes in a slowly turning constellation.', fingerprint: 'Form: icosa/cube node networks, hairline edges. Material: glowing jewel nodes. Motion: slow turns, wide orbit.', drop: ['circleLayers', 'facet', 'keyAngle'], over: { levels: 5, edgeR: 0.0035, circleLayers: 0, facet: 0, orbit: 0.14, ratio: 0.74, core: 0.5 } },
    { id: 'axial-halo', name: 'Axial Halo', variant: 7, palette: 'rose-gold', tags: ['halo', 'axial'], blurb: 'Cages spin about the view axis inside a bright halo ring: a mandala you look straight into.', fingerprint: 'Form: cages rotating about the view axis + halo ring. Material: gold and glass. Motion: axial turns, breathing halo.', over: { levels: 4, circleLayers: 2, facet: 0.22, cageTurns: 1, core: 0.9, bloom: 0.7 } },
    { id: 'silent-symmetry', name: 'Silent Symmetry', variant: 8, palette: 'silver-ice', tags: ['calm', 'ambient'], blurb: 'Cubes and octahedra at rest-like speed, thin lines, wide negative space: made for quiet backgrounds.', fingerprint: 'Form: cube/octa compound, hairlines. Material: dim silver. Motion: very slow single turn.', over: { levels: 3, edgeR: 0.0025, circleLayers: 1, facet: 0.1, core: 0.35, bloom: 0.3, exposure: 0.9, orbit: 0.03, cageTurns: 1 } },
  ],
};
