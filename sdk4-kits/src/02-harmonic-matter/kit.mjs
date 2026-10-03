import { R, I, lens } from '../../tools/helpers.mjs';

const params = {
  modes: I('Wave modes', 2, 6, 3, { group: 'Form', hint: 'Number of superposed standing modes.', mutate: 0.3 }),
  amp: R('Amplitude', 0.03, 0.35, 0.2, { group: 'Form', hint: 'Peak height of the surface in scene units.' }),
  wavelength: R('Wavelength', 0.15, 1.5, 0.6, { group: 'Form', hint: 'Base spatial wavelength in scene units.', log: true }),
  tilt: R('Camera pitch', 0.15, 1.2, 0.85, { group: 'Form', hint: 'Elevation of the camera above the surface, radians.' }),
  nodeWidth: R('Node width', 0.002, 0.03, 0.006, { group: 'Material', hint: 'Width of the glowing nodal contours, measured on the surface.', log: true }),
  opacity: R('Membrane opacity', 0.05, 0.7, 0.4, { group: 'Material', hint: 'How much each thin sheet covers what lies beneath.' }),
  warmth: R('Peak warmth', 0, 1, 0.6, { group: 'Material', hint: 'Amber light concentrated on the wave peaks.' }),
  density: R('Particle density', 0.1, 1, 0.3, { group: 'Particles', hint: 'Fraction of lattice cells that hold a particle.' }),
  particleR: R('Particle radius', 0.001, 0.012, 0.003, { group: 'Particles', hint: 'Particle radius in scene units.', log: true }),
  drift: R('Particle drift', 0, 0.5, 0.25, { group: 'Particles', hint: 'Displacement along the field gradient. Follows the same wave.' }),
  osc: I('Oscillations per loop', 1, 4, 1, { group: 'Motion', hint: 'Whole standing-wave cycles per loop.', mutate: 0 }),
  orbit: R('Camera orbit', 0, 0.3, 0.08, { group: 'Motion', hint: 'Closed yaw excursion of the camera.' }),
  ...lens({ keyAngle: 40, exposure: 1.0, bloom: 0.5 }),
};

export default {
  id: 'harmonic-matter', name: 'Harmonic Matter', version: '1.0.0', accent: '#6FA8E8', post: 'luminous', sceneScale: 0.75, cost: 3,
  description: 'Standing-wave membranes in blue-silver with concentrated amber peaks and particles attached to the field. Nine seamless infinite loops.',
  palettes: [
    { id: 'navy-silver', name: 'Navy Silver', bg: '#030818', ink: '#E6EEF8', a: ['#6FA8E8', '#FFB04A', '#0E2A6B'] },
    { id: 'graphite-amber', name: 'Graphite Amber', bg: '#08090B', ink: '#EEF0F2', a: ['#9FB4C8', '#FF9F3A', '#2A3138'] },
    { id: 'teal-glass', name: 'Teal Glass', bg: '#021210', ink: '#E4F6F2', a: ['#5CD1C0', '#F6C766', '#0C4A47'] },
    { id: 'violet-mist', name: 'Violet Mist', bg: '#07041A', ink: '#EEE9FB', a: ['#9C8DF0', '#FF9CC2', '#2C1E6B'] },
  ],
  params,
  styles: [
    { id: 'harmonic-matter-hero', name: 'Harmonic Matter Hero', variant: 0, palette: 'navy-silver', tags: ['flagship', 'wave', 'particles'], blurb: 'Three stacked silver membranes ring with a standing wave; amber peaks and attached particles follow the field.', fingerprint: 'Form: three stacked analytic sheets. Material: silver-blue thin membrane, amber peaks. Motion: one coherent standing oscillation.', over: {} },
    { id: 'nodal-sea', name: 'Nodal Sea', variant: 1, palette: 'navy-silver', tags: ['nodal', 'contours'], blurb: 'One broad sheet where the nodal lines carry the picture: a glowing silver network on dark water.', fingerprint: 'Form: single wide sheet, many modes. Material: nodal network emission. Motion: standing wave, slow.', over: { modes: 5, amp: 0.12, wavelength: 0.45, nodeWidth: 0.014, density: 0.3, opacity: 0.4, tilt: 0.42 } },
    { id: 'amber-antinodes', name: 'Amber Antinodes', variant: 2, palette: 'graphite-amber', tags: ['amber', 'peaks'], blurb: 'The peaks glow. Particles gather on the antinodes and thin out toward the nodes.', fingerprint: 'Form: two sheets, no contours. Material: amber antinode emission. Motion: particles breathe in with the crests.', drop: ['nodeWidth'], over: { modes: 3, amp: 0.22, warmth: 0.85, density: 0.7, particleR: 0.005, opacity: 0.22, nodeWidth: 0.004 } },
    { id: 'crosswave-veil', name: 'Crosswave Veil', variant: 3, palette: 'violet-mist', tags: ['veil', 'crossing'], blurb: 'Two wave families cross at right angles and weave a translucent veil.', fingerprint: 'Form: crossing mode families (90 degrees). Material: veil, high translucency. Motion: two oscillation rates beating.', over: { modes: 4, amp: 0.18, wavelength: 0.5, opacity: 0.42, density: 0.35, warmth: 0.25, osc: 2 } },
    { id: 'resonant-basin', name: 'Resonant Basin', variant: 4, palette: 'teal-glass', tags: ['radial', 'basin'], blurb: 'A circular basin rings in radial modes; ripples stand where the rings meet.', fingerprint: 'Form: radial Bessel-like modes. Material: teal glass sheets. Motion: radial standing ring pulses.', over: { modes: 4, amp: 0.2, wavelength: 0.42, tilt: 0.7, density: 0.4, opacity: 0.3, nodeWidth: 0.008 } },
    { id: 'silver-interference', name: 'Silver Interference', variant: 5, palette: 'graphite-amber', tags: ['interference', 'top-down'], blurb: 'Two sources interfere under a near top-down camera: silver ripple contours that never reset.', fingerprint: 'Form: two-source interference sheet, top-down. Material: silver topographic contours. Motion: standing interference.', over: { modes: 3, amp: 0.14, wavelength: 0.3, tilt: 1.1, nodeWidth: 0.006, density: 0.2, warmth: 0.2, opacity: 0.35 } },
    { id: 'phase-ribbons', name: 'Phase Ribbons', variant: 6, palette: 'navy-silver', tags: ['ribbons', 'traces'], blurb: 'Rows of luminous traces carry the same wave at staggered phase, with pearls riding each line.', fingerprint: 'Form: 2D stacked wave traces. Material: glowing line, pearls. Motion: phase-staggered standing wave.', over: { modes: 3, amp: 0.1, wavelength: 0.7, nodeWidth: 0.004, density: 0.55, opacity: 0.4 } },
    { id: 'standing-crest', name: 'Standing Crest', variant: 7, palette: 'violet-mist', tags: ['ridgeline', 'crest'], blurb: 'Layered ridgelines recede into the dark; the crests stand and fall in place.', fingerprint: 'Form: ridgeline silhouettes, painter ordered. Material: dark fill, bright rim. Motion: standing crest oscillation.', over: { modes: 3, amp: 0.2, wavelength: 0.8, nodeWidth: 0.005, opacity: 0.35, density: 0.4, warmth: 0.5 } },
    { id: 'quiet-chladni', name: 'Quiet Chladni', variant: 8, palette: 'graphite-amber', tags: ['chladni', 'calm'], blurb: 'Sand on a vibrating plate: grains settle on the nodal lines as the mode slowly morphs.', fingerprint: 'Form: Chladni plate nodal lines. Material: sand on dark metal. Motion: mode morph, very slow.', over: { modes: 3, wavelength: 0.8, nodeWidth: 0.006, density: 0.75, particleR: 0.0035, bloom: 0.3, warmth: 0.2, exposure: 0.95 } },
  ],
};
