import { R, I, crispLens } from '../../tools/helpers.mjs';

const params = {
  pitch: R('Stripe pitch', 4, 28, 12, { group: 'Form', step: 0.5, unit: 'px', hint: 'Stripe period in screen pixels. Filtered, so it stays clean as it changes.' }),
  rings: I('Ring count', 3, 12, 6, { group: 'Form', hint: 'Number of black ring bands. A spatial count.', mutate: 0.3 }),
  wave: R('Wave amplitude', 0.02, 0.3, 0.14, { group: 'Form', hint: 'Height of the wave traces, scene units.' }),
  trace: R('Trace width', 1, 8, 3, { group: 'Material', step: 0.1, unit: 'px', hint: 'Line weight of wave traces in screen pixels.' }),
  black: R('Black area', 0.2, 0.7, 0.45, { group: 'Material', hint: 'How much of the composition is black.' }),
  accent: R('Accent area', 0.05, 0.35, 0.15, { group: 'Material', hint: 'Size of the yellow and red accents.' }),
  slice: R('Slice displacement', 0, 0.25, 0.09, { group: 'Motion', hint: 'Horizontal slices shift during moves and return to zero at rest.' }),
  hold: R('Hold fraction', 0.15, 0.65, 0.35, { group: 'Motion', hint: 'Share of each beat spent at rest.' }),
  beats: I('Beats per loop', 1, 4, 2, { group: 'Motion', hint: 'Rhythmic segments per loop. Each beat eases to the next pose.', mutate: 0 }),
  stepped: { type: 'toggle', label: 'On twos', def: false, group: 'Motion', hint: 'Hold each move in six stepped poses, like animation on twos.' },
  ...crispLens({ keyAngle: -45, exposure: 1 }),
};
delete params.keyAngle; delete params.quality;   // not used by this style: dead controls are removed

export default {
  id: 'post-punk-resonance', name: 'Post-Punk Resonance', version: '1.0.0', accent: '#E6F000', post: 'crisp', cost: 1,
  description: 'Acid yellow, red, black and warm white: stripes, ring bands and wave traces with strong negative shapes, moved on two or four clear beats with long rests. No grain, no strobe. Nine seamless infinite loops.',
  palettes: [
    { id: 'acid-warm', name: 'Acid Warm', bg: '#EEE6AE', ink: '#05050A', a: ['#F0120A', '#F2E800', '#8A8460'] },
    { id: 'bone-red', name: 'Bone Red', bg: '#EFEBE0', ink: '#0A0A0C', a: ['#E1180E', '#FFD400', '#8E8A7A'] },
    { id: 'signal-night', name: 'Signal Night', bg: '#0B0B0F', ink: '#F4F0E4', a: ['#FF2A1C', '#E8F20A', '#5A5A60'] },
    { id: 'pink-black', name: 'Pink Black', bg: '#F3E2DA', ink: '#0C0A0C', a: ['#E82A6A', '#F6E400', '#9A8A86'] },
  ],
  params,
  styles: [
    { id: 'post-punk-hero', name: 'Post-Punk Resonance Hero', variant: 0, palette: 'acid-warm', tags: ['flagship', 'stripes', 'rings'], blurb: 'Stripes, black ring bands, a red wave cut and an acid-yellow slab step to new poses on two beats.', fingerprint: 'Form: stripe block + ring bands + wave cut + slabs. Material: flat acid print. Motion: two eased beats with long rests.', drop: ['trace'], over: {} },
    { id: 'acid-carrier', name: 'Acid Carrier', variant: 1, palette: 'acid-warm', tags: ['yellow', 'traces'], blurb: 'An acid-yellow field carrying stacked black wave traces, each at its own phase.', fingerprint: 'Form: yellow ground with 7 wave traces. Material: black line on yellow. Motion: phase steps on beats.', drop: ['black', 'rings'], over: { wave: 0.06, trace: 2.5, beats: 2 } },
    { id: 'red-signal', name: 'Red Signal', variant: 2, palette: 'bone-red', tags: ['red', 'signal'], blurb: 'A red disc behind triangular signal traces and a black bar; the signals shift on each beat.', fingerprint: 'Form: red disc + triangle-wave traces. Material: red and black on bone. Motion: trace phase stepping.', drop: ['black', 'pitch', 'rings'], over: { accent: 0.2, beats: 2, trace: 3.5 } },
    { id: 'broken-ring', name: 'Broken Ring', variant: 3, palette: 'bone-red', tags: ['rings', 'arcs'], blurb: 'Concentric black rings broken into segments that turn to new positions beat by beat.', fingerprint: 'Form: segmented concentric rings. Material: black on bone with two accents. Motion: segment turns per beat.', drop: ['pitch', 'trace', 'wave'], over: { rings: 8, black: 0.5, beats: 4, hold: 0.3 } },
    { id: 'blackout-geometry', name: 'Blackout Geometry', variant: 4, palette: 'signal-night', tags: ['black', 'negative'], blurb: 'Black ground with warm-white geometry cut out of it: circle, triangle and a sliding red bar.', fingerprint: 'Form: negative-space shapes on black. Material: cut-out white, one red bar. Motion: slab slides, circle breath.', drop: ['black', 'pitch', 'rings', 'trace', 'wave'], over: { beats: 2, accent: 0.18, hold: 0.4 } },
    { id: 'interference-cut', name: 'Interference Cut', variant: 5, palette: 'pink-black', tags: ['stripes', 'interference'], blurb: 'Two stripe fields at a slight angle, cut along a diagonal that moves; moiré is bounded by design.', fingerprint: 'Form: two filtered stripe fields + cut. Material: black stripes, pink/yellow slabs. Motion: stripe shift per beat.', drop: ['black', 'rings', 'trace', 'wave'], over: { pitch: 9, beats: 2, accent: 0.16 } },
    { id: 'stepped-oscillator', name: 'Stepped Oscillator', variant: 6, palette: 'signal-night', tags: ['oscillator', 'stepped'], blurb: 'Pixel-stepped oscilloscope traces that jump pose on every beat, always animated on twos.', fingerprint: 'Form: 9 quantised wave traces. Material: light line on night. Motion: stepped poses on 4 beats.', drop: ['black', 'pitch', 'rings'], over: { wave: 0.1, trace: 2.2, beats: 4, stepped: true } },
    { id: 'graphic-feedback', name: 'Graphic Feedback', variant: 7, palette: 'bone-red', tags: ['tunnel', 'nested'], blurb: 'Nested rectangles shrink toward the centre, one full level per loop, in black, red and yellow.', fingerprint: 'Form: self-similar nested frames (analytic, no feedback buffer). Material: three-colour print. Motion: one level of zoom per loop.', drop: ['black', 'pitch', 'rings', 'trace', 'wave', 'accent'], over: { beats: 2, accent: 0.2 } },
    { id: 'quiet-noise', name: 'Quiet Noise', variant: 8, palette: 'bone-red', tags: ['halftone', 'calm'], blurb: 'A structured halftone field that breathes slowly. Noise as pattern, never grain.', fingerprint: 'Form: halftone dot field. Material: black dots on bone, one red accent. Motion: one slow ripple per loop.', drop: ['black', 'pitch', 'rings', 'trace', 'wave'], over: { beats: 1, hold: 0.5, accent: 0.1, slice: 0 } },
  ],
};
