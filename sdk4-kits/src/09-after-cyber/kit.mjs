import { R, I, lens } from '../../tools/helpers.mjs';

const params = {
  res: I('Lattice resolution', 6, 18, 10, { group: 'Form', hint: 'Nodes along each side of the lattice. A spatial count.', mutate: 0.3 }),
  connect: R('Connection radius', 0.03, 0.2, 0.09, { group: 'Form', hint: 'Longest connection that stays fully drawn; longer links fade smoothly.' }),
  disperse: R('Dispersal radius', 0, 0.5, 0.2, { group: 'Form', hint: 'How far nodes travel when they dissolve. Clamped to the lattice search window.' }),
  edgeR: R('Edge radius', 0.001, 0.01, 0.002, { group: 'Material', hint: 'Radius of the cyan hairlines, scene units.', log: true }),
  glass: R('Glass opacity', 0, 0.55, 0.16, { group: 'Material', hint: 'Smoky tint inside the polyhedron.' }),
  refr: R('Refraction strength', 0, 0.12, 0.035, { group: 'Material', hint: 'Screen-space offset of the lattice seen through facets. An approximation, not transport.' }),
  particleR: R('Particle radius', 0.001, 0.01, 0.003, { group: 'Particles', hint: 'Node and particle radius, scene units.', log: true }),
  lime: R('Lime fraction', 0, 0.35, 0.12, { group: 'Particles', hint: 'Share of nodes that read as acid-lime particles.' }),
  cycles: I('Reconstructions per loop', 1, 3, 1, { group: 'Motion', hint: 'Whole dissolve - transport - reassemble cycles per loop.', mutate: 0 }),
  ...lens({ keyAngle: 60, exposure: 1.0, bloom: 0.55 }),
};

export default {
  id: 'after-cyber', name: 'After Cyber', version: '1.0.0', accent: '#C6F000', post: 'luminous', sceneScale: 0.75, cost: 3,
  description: 'Smoky glass, cyan hairlines, selective acid-lime particles in deep black: lattices that dissolve, travel and reassemble. Nine seamless infinite loops.',
  palettes: [
    { id: 'smoke-cyan-lime', name: 'Smoke Cyan Lime', bg: '#010608', ink: '#DDF8FF', a: ['#22C8E8', '#C6F000', '#0B2A30'] },
    { id: 'ink-ice', name: 'Ink Ice', bg: '#02040A', ink: '#EAF2FF', a: ['#7FB8FF', '#E8FF6A', '#101C36'] },
    { id: 'dusk-magenta', name: 'Dusk Magenta', bg: '#07030A', ink: '#F6E6FF', a: ['#E04AD6', '#B8FF3A', '#2A0F3A'] },
    { id: 'steel', name: 'Steel', bg: '#040506', ink: '#E8EEF2', a: ['#9FB4C0', '#D4F23A', '#1C262C'] },
  ],
  params,
  styles: [
    { id: 'after-cyber-hero', name: 'After Cyber Hero', variant: 0, palette: 'smoke-cyan-lime', tags: ['flagship', 'lattice', 'glass'], blurb: 'A cyan hairline lattice dissolves into lime particles, travels, and reassembles behind a smoky glass polyhedron.', fingerprint: 'Form: tilted node sheet + dodecahedral glass. Material: smoky glass, cyan hairlines, lime particles. Motion: dissolve-transport-reassemble with holds.', over: {} },
    { id: 'cyan-scaffold', name: 'Cyan Scaffold', variant: 1, palette: 'ink-ice', tags: ['scaffold', 'struts'], blurb: 'A scaffold of long diagonal struts: no particles, just crisp hairlines that stretch and settle.', fingerprint: 'Form: lattice with diagonal struts, no glass. Material: cyan hairline. Motion: lattice relaxes and returns.', over: { res: 9, connect: 0.16, lime: 0, disperse: 0.1, edgeR: 0.0018 } },
    { id: 'glass-drift', name: 'Glass Drift', variant: 2, palette: 'smoke-cyan-lime', tags: ['glass', 'refraction'], blurb: 'A large polyhedron of smoky glass drifts over the lattice, bending it as it turns.', fingerprint: 'Form: large dodecahedral glass over a wavy lattice. Material: refractive smoke glass. Motion: slow glass tilt.', over: { res: 12, glass: 0.3, refr: 0.08, lime: 0.06, disperse: 0.12 } },
    { id: 'lime-assembly', name: 'Lime Assembly', variant: 3, palette: 'smoke-cyan-lime', tags: ['lime', 'assembly'], blurb: 'Lime-heavy: nodes fly in from far across the frame and click into the lattice, particles trailing.', fingerprint: 'Form: lattice with long transport. Material: lime-dominant particles. Motion: wide dispersal and assembly.', over: { lime: 0.32, disperse: 0.5, res: 10, particleR: 0.0034, connect: 0.1 } },
    { id: 'particle-covenant', name: 'Particle Covenant', variant: 4, palette: 'dusk-magenta', tags: ['rings', 'particles'], blurb: 'No lines at all: rings of particles hold a covenant, scatter on closed orbits and gather again.', fingerprint: 'Form: concentric rings of nodes (no edges). Material: bright particle rings. Motion: ring dissolve and gather.', over: { res: 14, lime: 0.2, disperse: 0.3, particleR: 0.0036 } },
    { id: 'broken-polyhedron', name: 'Broken Polyhedron', variant: 5, palette: 'steel', tags: ['polyhedron', 'broken'], blurb: 'An octahedron whose faces slide in and out of true while a strut lattice floats behind it.', fingerprint: 'Form: octahedral glass with face-wise breathing + strut lattice. Material: steel glass. Motion: facet breathing.', over: { res: 8, glass: 0.24, refr: 0.07, connect: 0.14, disperse: 0.08, lime: 0.1 } },
    { id: 'organic-circuit', name: 'Organic Circuit', variant: 7, palette: 'ink-ice', tags: ['circuit', 'traces'], blurb: 'Traces run in right-angled routes between slightly irregular pads, lime at the pads that wander off.', fingerprint: 'Form: jittered pads with Manhattan traces. Material: cyan trace, lime pads. Motion: pads wander, traces follow.', over: { res: 11, connect: 0.15, lime: 0.16, disperse: 0.14, edgeR: 0.0022 } },
    { id: 'smoky-network', name: 'Smoky Network', variant: 6, palette: 'steel', tags: ['network', 'smoke'], blurb: 'An irregular network in thick smoke: links appear only where nodes stay close, lime nodes drift.', fingerprint: 'Form: jittered nodes with sparse random struts. Material: heavy smoke. Motion: slow dispersal.', over: { res: 10, connect: 0.13, lime: 0.1, disperse: 0.16, exposure: 0.95 } },
    { id: 'quiet-reconstruction', name: 'Quiet Reconstruction', variant: 8, palette: 'smoke-cyan-lime', tags: ['calm', 'ambient'], blurb: 'Seven nodes a side, a dim glass shape and a slow, small dissolve. Made for quiet backgrounds.', fingerprint: 'Form: sparse lattice + small glass. Material: dim cyan. Motion: small slow dissolve.', over: { res: 7, glass: 0.1, refr: 0.02, disperse: 0.08, lime: 0.05, bloom: 0.3, exposure: 0.9, vignette: 0.5 } },
  ],
};
