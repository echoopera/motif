import { R, I, lens } from '../../tools/helpers.mjs';

const params = {
  layers: I('Membrane layers', 3, 12, 7, { group: 'Form', hint: 'Number of nested membrane shells.', mutate: 0.3 }),
  aperture: R('Aperture radius', 0.08, 0.45, 0.2, { group: 'Form', hint: 'Radius of the innermost shell and the distant aperture.' }),
  filament: R('Filament scale', 0.02, 0.3, 0.09, { group: 'Form', hint: 'Spacing of the fine filaments on each membrane. Smaller = more filaments.', log: true }),
  warp: R('Warp amplitude', 0, 0.25, 0.08, { group: 'Form', hint: 'How far each membrane folds away from a circle.' }),
  density: R('Density', 0.1, 2, 0.8, { group: 'Material', hint: 'Overall membrane density.' }),
  absorb: R('Absorption', 0.1, 3, 1.6, { group: 'Material', hint: 'How strongly membranes block what lies behind them.' }),
  emission: R('Emission', 0.1, 5, 1.4, { group: 'Light', hint: 'Light emitted by the membranes.', randMax: 3 }),
  travel: R('Depth travel', 0, 0.4, 0.12, { group: 'Motion', hint: 'Closed camera excursion into the passage and back.' }),
  advect: I('Advection cycles per loop', 1, 3, 1, { group: 'Motion', hint: 'Whole cycles the filaments slide along the membranes per loop.', mutate: 0 }),
  ...lens({ keyAngle: 90, exposure: 1.0, bloom: 0.6 }),
};
delete params.keyAngle;   // emissive volume: no key light

export default {
  id: 'astral-threshold', name: 'Astral Threshold', version: '1.0.0', accent: '#8A4DFF', post: 'luminous', sceneScale: 0.6, ssaa: 1, cost: 4,
  description: 'Violet and ice-blue volumetric membranes: foreground curtains, middle sheets and a distant aperture. Step-normalised volume rendering. Nine seamless infinite loops.',
  palettes: [
    { id: 'violet-ice', name: 'Violet Ice', bg: '#040110', ink: '#EAF3FF', a: ['#7A2CF5', '#3FA5FF', '#2A0E6E'] },
    { id: 'aurora', name: 'Aurora', bg: '#010A0C', ink: '#E8FFF6', a: ['#2BC7A0', '#6A7BFF', '#0B3A52'] },
    { id: 'ember-veil', name: 'Ember Veil', bg: '#0C0306', ink: '#FFF0E6', a: ['#E24C7A', '#FFB05C', '#4A1030'] },
    { id: 'mono-ice', name: 'Mono Ice', bg: '#02050A', ink: '#F2F7FF', a: ['#8FA8D6', '#C9E0FF', '#1B2A48'] },
  ],
  params,
  styles: [
    { id: 'astral-threshold-hero', name: 'Astral Threshold Hero', variant: 0, palette: 'violet-ice', tags: ['flagship', 'volume', 'aperture'], blurb: 'Seven offset membranes recede to a distant aperture; the camera leans in and returns.', fingerprint: 'Form: offset cylindrical sheets bending to an off-centre aperture. Material: violet-to-ice emissive membranes. Motion: closed camera excursion, advecting filaments.', over: {} },
    { id: 'violet-passage', name: 'Violet Passage', variant: 1, palette: 'violet-ice', tags: ['tunnel', 'deep'], blurb: 'A longer, tighter passage: more layers and a deeper lean into the dark.', fingerprint: 'Form: 10 narrow shells, small aperture. Material: dense violet. Motion: long camera excursion.', over: { layers: 10, aperture: 0.13, travel: 0.32, density: 0.8, emission: 1.6 } },
    { id: 'blue-veil', name: 'Blue Veil', variant: 2, palette: 'mono-ice', tags: ['veil', 'cool'], blurb: 'Wide, thin, cool veils: low emission and soft thickness, an airy threshold.', fingerprint: 'Form: thick soft sheets, wide aperture. Material: pale ice veil. Motion: gentle excursion, slow advection.', over: { layers: 6, aperture: 0.32, density: 0.5, emission: 0.9, warp: 0.05, travel: 0.08, bloom: 0.5 } },
    { id: 'folded-ether', name: 'Folded Ether', variant: 3, palette: 'ember-veil', tags: ['folds', 'creased'], blurb: 'Sheets crease and fold like paper in light; glowing ridges follow the folds.', fingerprint: 'Form: creased (abs-folded) shells. Material: ember-rose emission, ridge fibres. Motion: advecting creases.', over: { layers: 7, warp: 0.2, density: 0.8, filament: 0.07, emission: 1.8, absorb: 1.4 } },
    { id: 'filament-gate', name: 'Filament Gate', variant: 4, palette: 'aurora', tags: ['filaments', 'gate'], blurb: 'The structure is the strands: sparse long filaments streak toward a bright gate.', fingerprint: 'Form: filament-dominated, sparse sheets. Material: aurora strands. Motion: fast advection of fibres.', over: { layers: 8, filament: 0.05, density: 0.4, emission: 2.6, advect: 2, warp: 0.1, absorb: 0.8 } },
    { id: 'luminous-expanse', name: 'Luminous Expanse', variant: 5, palette: 'aurora', tags: ['expanse', 'horizontal'], blurb: 'The tunnel opens into stacked horizontal curtains over a dark horizon, like a slow aurora.', fingerprint: 'Form: planar wavy sheets (no tunnel). Material: aurora curtains. Motion: curtain waves, small excursion.', over: { layers: 8, warp: 0.14, density: 0.7, emission: 1.8, travel: 0.06, aperture: 0.25 } },
    { id: 'membrane-drift', name: 'Membrane Drift', variant: 6, palette: 'violet-ice', tags: ['drift', 'sway'], blurb: 'The camera holds still while the membranes sway on closed orbits around each other.', fingerprint: 'Form: shells with orbiting centres. Material: violet-ice. Motion: layer orbits, nearly fixed camera.', over: { layers: 7, travel: 0.03, warp: 0.1, advect: 1, emission: 1.3 } },
    { id: 'deep-aperture', name: 'Deep Aperture', variant: 7, palette: 'mono-ice', tags: ['high-contrast', 'distance'], blurb: 'Few membranes, almost black, one small brilliant aperture a long way off.', fingerprint: 'Form: 4 shells, tiny far aperture. Material: dark with ice core. Motion: very long closed travel.', over: { layers: 4, aperture: 0.1, density: 0.35, emission: 1.0, travel: 0.38, bloom: 0.8, vignette: 0.55 } },
    { id: 'quiet-transit', name: 'Quiet Transit', variant: 8, palette: 'violet-ice', tags: ['calm', 'ambient'], blurb: 'The softest crossing: low emission, small warp, slow pass. Made for text-safe backgrounds.', fingerprint: 'Form: 5 gentle shells. Material: dim violet. Motion: small excursion, one slow advection.', over: { layers: 5, warp: 0.04, emission: 0.8, density: 0.5, travel: 0.06, bloom: 0.35, exposure: 0.9, vignette: 0.5 } },
  ],
};
