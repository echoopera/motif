import { R, I, crispLens } from '../../tools/helpers.mjs';

const params = {
  planes: I('Plane count', 6, 28, 14, { group: 'Form', hint: 'Number of planes in the composition. Most are small; a few dominate.', mutate: 0.3 }),
  arcR: R('Arc radius', 0.1, 0.65, 0.35, { group: 'Form', hint: 'Radius of the principal cobalt arc in scene units.' }),
  grid: R('Grid spacing', 0.015, 0.12, 0.04, { step: 0.001, group: 'Form', hint: 'Spacing of the hairline grids that ride on the planes.' }),
  lineW: R('Line width', 0.7, 3, 1.2, { group: 'Material', step: 0.05, unit: 'px', hint: 'Hairline width in screen pixels.' }),
  sep: R('Layer separation', 0, 0.15, 0.05, { group: 'Light', hint: 'Soft shadow offset between layers. 0 prints everything flat.' }),
  offset: R('Offset amplitude', 0, 0.35, 0.12, { group: 'Motion', hint: 'How far planes travel on their moves.' }),
  rot: R('Rotation amplitude', 0, 0.5, 0.12, { group: 'Motion', hint: 'How far planes rotate on their moves, radians.' }),
  hold: R('Hold fraction', 0.1, 0.6, 0.3, { group: 'Motion', hint: 'Share of each half cycle spent at rest.' }),
  recomp: I('Recompositions per loop', 1, 3, 1, { group: 'Motion', hint: 'Whole in-hold-out-return cycles per loop.', mutate: 0 }),
  ...crispLens({ keyAngle: -45, exposure: 1 }),
};

export default {
  id: 'deconstruct-field', name: 'Deconstruct Field', version: '1.0.0', accent: '#1B3FD6', post: 'crisp', ssaa: 4, cost: 2,
  description: 'Cream ground, black structure, cobalt arcs and vermilion accents: asymmetric planes and grids that slide, rotate and return on staggered in-hold-out schedules. Nine seamless infinite loops.',
  palettes: [
    { id: 'cream-cobalt', name: 'Cream Cobalt', bg: '#E8E2D0', ink: '#0B0C10', a: ['#1B3FD6', '#E4331B', '#8E8671'] },
    { id: 'bone-ink', name: 'Bone Ink', bg: '#EDEAE2', ink: '#14151A', a: ['#27408B', '#D9482B', '#9A9788'] },
    { id: 'sand-teal', name: 'Sand Teal', bg: '#E2D8BF', ink: '#10201F', a: ['#0E6C6C', '#E0552B', '#8C8268'] },
    { id: 'night-paper', name: 'Night Paper', bg: '#15161B', ink: '#ECE7D8', a: ['#4F73F0', '#FF5A3C', '#6A6A72'] },
  ],
  params,
  styles: [
    { id: 'deconstruct-field-hero', name: 'Deconstruct Field Hero', variant: 0, palette: 'cream-cobalt', tags: ['flagship', 'graphic', 'planes'], blurb: 'Fourteen planes, a cobalt arc and hairline grids slide out of place and return, each on its own schedule.', fingerprint: 'Form: asymmetric planes + arcs + grids. Material: flat print, soft layer shadow. Motion: staggered in-hold-out-return.', over: {} },
    { id: 'broken-axis', name: 'Broken Axis', variant: 1, palette: 'bone-ink', tags: ['axis', 'vertical'], blurb: 'A vertical axis of narrow bars, each shearing off the line in turn and coming back.', fingerprint: 'Form: bars strung on a vertical axis. Material: black on bone. Motion: alternating up/down breaks.', over: { planes: 18, offset: 0.2, arcR: 0.2, grid: 0.03 } },
    { id: 'cobalt-cut', name: 'Cobalt Cut', variant: 2, palette: 'cream-cobalt', tags: ['cobalt', 'cut-outs'], blurb: 'Cobalt leads: large blue planes bitten by circular cuts, with black bars for structure.', fingerprint: 'Form: cobalt-dominant planes with circular bites. Material: flat cobalt. Motion: slow slides.', over: { planes: 12, arcR: 0.42, grid: 0.05, rot: 0.08 } },
    { id: 'offset-scaffold', name: 'Offset Scaffold', variant: 4, palette: 'bone-ink', tags: ['outline', 'registration'], blurb: 'Outline-only planes with a registration ghost sliding behind each, like a misprinted plan.', fingerprint: 'Form: stroked planes with offset ghost copies. Material: line only. Motion: ghost lags the plane.', over: { planes: 16, lineW: 1.5, grid: 0.03, sep: 0, rot: 0.09 } },
    { id: 'plane-argument', name: 'Plane Argument', variant: 5, palette: 'cream-cobalt', tags: ['large planes', 'opposition'], blurb: 'A few huge planes lean against each other and slide apart, arguing across the page.', fingerprint: 'Form: 7 huge angled planes in two camps. Material: flat print. Motion: opposed lateral slides.', over: { planes: 7, offset: 0.2, rot: 0.15, grid: 0.06, arcR: 0.5, hold: 0.35 } },
    { id: 'partial-circle', name: 'Partial Circle', variant: 6, palette: 'sand-teal', tags: ['arcs', 'circle'], blurb: 'Concentric partial circles of different weights rotate through short, eased arcs.', fingerprint: 'Form: five concentric partial arcs, few planes. Material: sand and teal print. Motion: eased arc rotations.', over: { planes: 8, arcR: 0.5, rot: 0.3, offset: 0.08, grid: 0.045 } },
    { id: 'red-interruption', name: 'Red Interruption', variant: 7, palette: 'bone-ink', tags: ['vermilion', 'accent'], blurb: 'Mostly black and bone, until a vermilion bar slides across and interrupts the composition.', fingerprint: 'Form: black planes + one traversing vermilion plane. Material: flat print. Motion: wide red slide, long rests.', over: { planes: 13, offset: 0.14, hold: 0.4 } },
    { id: 'grid-dislocation', name: 'Grid Dislocation', variant: 8, palette: 'night-paper', tags: ['grid', 'dislocation'], blurb: 'The grid is the subject: rows of it slip sideways against each other and settle back.', fingerprint: 'Form: planes carrying large grids, rows slip. Material: light on dark paper. Motion: row-wise dislocation.', over: { planes: 10, grid: 0.055, lineW: 1.4, offset: 0.1 } },
    { id: 'quiet-construct', name: 'Quiet Construct', variant: 9, palette: 'bone-ink', tags: ['calm', 'ambient'], blurb: 'Six planes and a single arc in lots of white space; small, slow moves. Made for text-safe backgrounds.', fingerprint: 'Form: 6 planes, one arc, wide negative space. Material: light line weight. Motion: small offsets, long holds.', over: { planes: 6, arcR: 0.3, grid: 0.07, lineW: 1, offset: 0.05, rot: 0.04, hold: 0.5, sep: 0.03, vignette: 0 } },
  ],
};
