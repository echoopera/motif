import { R, I, lens } from '../../tools/helpers.mjs';

const params = {
  count: I('Colony count', 8, 36, 18, { group: 'Form', hint: 'Approximate number of colonies in the frame. Sets the cell size.', mutate: 0.3 }),
  species: R('Species mix', 0, 1, 0.6, { group: 'Form', hint: 'Share of coral colonies against emerald cells.' }),
  membrane: R('Membrane width', 0.003, 0.035, 0.012, { group: 'Material', hint: 'Width of the bright membrane and its dark channel, scene units.', log: true }),
  translucency: R('Translucency', 0, 0.7, 0.25, { group: 'Material', hint: 'How glassy the cell bodies are.' }),
  organelles: R('Organelle density', 0.1, 1, 0.6, { group: 'Material', hint: 'Number of organelle points circling each nucleus.' }),
  filaments: I('Filament count', 8, 48, 24, { group: 'Material', hint: 'Radial filaments around each nucleus. A spatial count.', mutate: 0.3 }),
  divAmp: R('Division amplitude', 0, 0.4, 0.18, { group: 'Motion', hint: 'How far a daughter cell separates from its parent.' }),
  migrate: R('Migration radius', 0, 0.25, 0.1, { group: 'Motion', hint: 'Radius of each colony\'s closed migration orbit.' }),
  cycles: I('Lifecycles per loop', 1, 3, 1, { group: 'Motion', hint: 'Whole division and reintegration cycles per loop.', mutate: 0 }),
  wobble: R('Membrane wobble', 0, 0.3, 0.08, { group: 'Motion', hint: 'Standing wave along the membranes (used by Membrane Choir).' }),
  ...lens({ keyAngle: 60, exposure: 1.0, bloom: 0.45 }),
};
delete params.keyAngle;   // cells are lit by their own emission: no key light

export default {
  id: 'cellular-cosmos', name: 'Cellular Cosmos', version: '1.0.0', accent: '#2FD39A', post: 'luminous', sceneScale: 1, ssaa: 4, cost: 1.5,
  description: 'Translucent emerald membranes, coral colonies, radial organs and dark channels. A deterministic periodic lifecycle of division, migration and reintegration. Nine seamless infinite loops.',
  palettes: [
    { id: 'emerald-coral', name: 'Emerald Coral', bg: '#010C09', ink: '#F7F0DA', a: ['#2FD39A', '#FF5C3A', '#0A4A3D'] },
    { id: 'abyss', name: 'Abyss', bg: '#01070D', ink: '#E8F6FF', a: ['#3DB8E8', '#F2A65A', '#0B3050'] },
    { id: 'lagoon-pink', name: 'Lagoon Pink', bg: '#020D0C', ink: '#FFF0F2', a: ['#4FE0C8', '#FF7AA8', '#0E4B4A'] },
    { id: 'bloom-amber', name: 'Bloom Amber', bg: '#0B0705', ink: '#FFF3DC', a: ['#C9D94E', '#FF8A3A', '#3A3010'] },
  ],
  params,
  styles: [
    { id: 'cellular-cosmos-hero', name: 'Cellular Cosmos Hero', variant: 0, palette: 'emerald-coral', tags: ['flagship', 'cells', 'lifecycle'], blurb: 'Emerald and coral colonies with radial organs; daughters divide, wander and rejoin on one closed cycle.', fingerprint: 'Form: weighted Voronoi, two species. Material: translucent bodies, bright membranes in dark channels. Motion: division, migration, reintegration.', drop: ['wobble'], over: {} },
    { id: 'emerald-colonies', name: 'Emerald Colonies', variant: 1, palette: 'emerald-coral', tags: ['emerald', 'large'], blurb: 'One species of large, glassy emerald colonies drifting slowly in their dark channels.', fingerprint: 'Form: fewer, larger cells, one species. Material: glassy emerald. Motion: slow migration, gentle division.', drop: ['wobble', 'species'], over: { count: 12, species: 0, translucency: 0.45, divAmp: 0.12, filaments: 20 } },
    { id: 'coral-division', name: 'Coral Division', variant: 2, palette: 'emerald-coral', tags: ['coral', 'division'], blurb: 'Coral colonies bud and split decisively, daughters sliding well apart before they rejoin.', fingerprint: 'Form: coral-only scalloped colonies with polyp tips. Material: coral membrane, warm nuclei. Motion: wide division swing.', drop: ['wobble', 'species'], over: { count: 16, species: 1, divAmp: 0.34, migrate: 0.06, membrane: 0.014 } },
    { id: 'membrane-choir', name: 'Membrane Choir', variant: 3, palette: 'abyss', tags: ['membranes', 'wave'], blurb: 'The membranes are the subject: bright, thick borders that waver together like a choir.', fingerprint: 'Form: wobbling membrane borders, no organs. Material: thick luminous border. Motion: standing wave along every membrane.', drop: ['organelles', 'filaments'], over: { count: 20, membrane: 0.016, wobble: 0.16, divAmp: 0.1, migrate: 0.05, translucency: 0.5, bloom: 0.4 } },
    { id: 'spore-drift', name: 'Spore Drift', variant: 4, palette: 'bloom-amber', tags: ['spores', 'small'], blurb: 'A fine scatter of small cells and spores drifting on tight closed loops.', fingerprint: 'Form: many tiny cells. Material: pale bodies, fine membranes. Motion: tight orbits, tiny divisions.', drop: ['wobble', 'species', 'organelles', 'filaments'], over: { count: 36, species: 0.35, membrane: 0.006, migrate: 0.07, divAmp: 0.15, organelles: 0.25, filaments: 12, translucency: 0.5 } },
    { id: 'symbiotic-web', name: 'Symbiotic Web', variant: 5, palette: 'lagoon-pink', tags: ['web', 'network'], blurb: 'Neighbouring colonies are tied by luminous filaments that tighten and slacken as they move.', fingerprint: 'Form: cells + neighbour filament web. Material: pink-teal filaments. Motion: migration pulls the web.', drop: ['wobble', 'organelles', 'filaments'], over: { count: 22, species: 0.5, migrate: 0.12, divAmp: 0.1, membrane: 0.01 } },
    { id: 'radial-organs', name: 'Radial Organs', variant: 6, palette: 'bloom-amber', tags: ['radial', 'sun'], blurb: 'A few big cells each with a sunburst of radial organs and orbiting organelle rings.', fingerprint: 'Form: 10 large cells, dense radial filaments. Material: amber-lime organs. Motion: counter-turning filaments.', drop: ['wobble'], over: { count: 10, species: 0.3, filaments: 40, organelles: 0.95, divAmp: 0.08, migrate: 0.05 } },
    { id: 'quiet-mitosis', name: 'Quiet Mitosis', variant: 7, palette: 'abyss', tags: ['calm', 'ambient'], blurb: 'The softest cycle: few cells, dim light, one slow division at a time. Made for quiet backgrounds.', fingerprint: 'Form: sparse cells. Material: dim translucent. Motion: single slow cycle, small migration.', drop: ['wobble'], over: { count: 11, species: 0.2, divAmp: 0.16, migrate: 0.04, filaments: 16, organelles: 0.35, bloom: 0.3, exposure: 0.9, vignette: 0.5 } },
    { id: 'tidal-habitat', name: 'Tidal Habitat', variant: 8, palette: 'lagoon-pink', tags: ['tide', 'sway'], blurb: 'The whole habitat sways in a tidal wave: neighbouring colonies lag one another.', fingerprint: 'Form: standard colonies. Material: lagoon pink-teal. Motion: phase-gradient tidal migration.', drop: ['wobble'], over: { count: 18, migrate: 0.2, divAmp: 0.12, species: 0.45 } },
  ],
};
