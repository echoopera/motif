import { R, I, lens } from '../../tools/helpers.mjs';

const params = {
  petals: I('Petal count', 48, 240, 144, { group: 'Form', hint: 'Number of petals in each golden-angle spiral. Spatial count, not a motion rate.', mutate: 0.3 }),
  pitch: R('Spiral pitch', 0.08, 0.35, 0.18, { group: 'Form', hint: 'Growth rate b of the glowing logarithmic scaffold r = r0·e^(b·a). Separate from the petal lattice.' }),
  bladeLen: R('Blade length', 0.03, 0.16, 0.075, { step: 0.001, group: 'Form', hint: 'Half length of a mid-field blade in scene units (short side = 1).' }),
  taper: R('Blade taper', 0.15, 0.9, 0.5, { group: 'Form', hint: 'How sharply each blade narrows toward its tip.' }),
  depth: R('Depth spacing', 0.02, 0.3, 0.12, { group: 'Form', hint: 'Separation of the far, middle and foreground strata. Drives parallax and defocus.' }),
  translucency: R('Translucency', 0, 0.75, 0.3, { group: 'Material', hint: 'Light transmitted through thin edges and tips.' }),
  rim: R('Rim intensity', 0, 2, 0.7, { group: 'Material', hint: 'Champagne rim light on blade edges.', randMax: 1.4 }),
  caustic: R('Copper caustics', 0, 1.5, 0.9, { group: 'Material', hint: 'Thin copper light threads that follow the blade form.', randMax: 1 }),
  core: R('Core glow', 0, 3, 0.7, { group: 'Light', hint: 'Seed light at the spiral centre. Keep low so the geometry stays visible.', randMax: 1.6 }),
  turns: I('Turns per loop', 0, 2, 1, { group: 'Motion', hint: 'Complete rotations of the whole field per loop (whole numbers only).', mutate: 0 }),
  breath: R('Breath amplitude', 0, 0.12, 0.035, { group: 'Motion', hint: 'Petal breathing, sin(theta + seed phase).' }),
  unfold: R('Unfold', 0, 0.3, 0.08, { group: 'Motion', hint: 'A radial unfold wave that returns through a fold. 0 holds the blooms open.' }),
  flow: I('Flow steps per loop', 0, 3, 0, { group: 'Motion', hint: 'Whole lattice indices the petals travel along the spiral each loop. 0 = rotation only.', mutate: 0 }),
  orbit: R('Camera orbit', 0, 0.25, 0.06, { group: 'Motion', hint: 'Closed camera orbit amplitude. Drives parallax between the strata.' }),
  ...lens({ keyAngle: 125, exposure: 1.0, bloom: 0.55, quality: 'live' }),
};

export default {
  id: 'phi-bloom', name: 'Phi Bloom', version: '1.0.0', accent: '#E9CE97', post: 'luminous', sceneScale: 1, ssaa: 1, cost: 2.5,
  description: 'Golden-angle botanical sculpture: layered translucent blades, a readable logarithmic spiral, ivory and champagne against jade-black depth. Nine seamless infinite loops.',
  palettes: [
    { id: 'ivory-jade', name: 'Ivory Jade', bg: '#02100F', ink: '#F6EBD0', a: ['#E8CC93', '#D9803F', '#0F5B50'] },
    { id: 'copper-night', name: 'Copper Night', bg: '#0D0604', ink: '#F7E3CC', a: ['#E9A864', '#C8552B', '#3E1D12'] },
    { id: 'opal-dusk', name: 'Opal Dusk', bg: '#05080F', ink: '#EEF1F6', a: ['#B9D0EA', '#E6A3C1', '#1C2F55'] },
    { id: 'verdant', name: 'Verdant', bg: '#03100A', ink: '#EAF3DA', a: ['#C9E39B', '#E0B24C', '#124F2F'] },
    { id: 'rose-gold', name: 'Rose Gold', bg: '#0F0609', ink: '#FBEAE4', a: ['#F2BFA4', '#E27C86', '#4B1A2A'] },
  ],
  params,
  styles: [
    { id: 'phi-bloom-hero', name: 'Phi Bloom Hero', variant: 0, palette: 'ivory-jade', tags: ['flagship', 'botanical', 'golden-angle'], blurb: 'The flagship: 144 ivory blades on a golden-angle lattice, a champagne log-spiral thread and a copper-lit foreground.', fingerprint: 'Form: golden-angle blades, three depth strata. Material: ivory translucent, champagne rim, copper caustics. Motion: one field turn, breathing, unfold wave, camera orbit.', over: {} },
    { id: 'golden-seed', name: 'Golden Seed', variant: 1, palette: 'ivory-jade', tags: ['seed head', 'macro'], blurb: 'A dense seed-head of rounded florets; a bloom wave rolls out from the centre while the field holds still.', fingerprint: 'Form: 200 rounded florets, macro scale. Material: lacquered champagne beads. Motion: radial breathing wave, no field rotation.', over: { petals: 200, turns: 0, unfold: 0.14, breath: 0.06, pitch: 0.3, bladeLen: 0.062, depth: 0.08, translucency: 0.2 } },
    { id: 'copper-fern', name: 'Copper Fern', variant: 2, palette: 'copper-night', tags: ['fern', 'log spiral'], blurb: 'A copper frond curls along a logarithmic spiral and uncurls through a closed bell, twinned by a distant mirror frond.', fingerprint: 'Form: log-spiral spine with paired leaflets (not phyllotaxis). Material: copper foil on ivory rachis. Motion: unroll and re-curl.', drop: ['petals', 'taper', 'flow'], over: { petals: 120, turns: 0, bladeLen: 0.055, pitch: 0.2, unfold: 0.14, depth: 0.1, rim: 0.9, caustic: 0.9 } },
    { id: 'ivory-helix', name: 'Ivory Helix', variant: 3, palette: 'ivory-jade', tags: ['helix', 'flow'], blurb: 'Swept ivory blades travel one lattice step per loop along the spiral and dissolve into the seed.', fingerprint: 'Form: tangent-swept blades on the lattice. Material: ivory sculpture, cool rim. Motion: index flow along the parastichy, no rotation.', over: { petals: 168, turns: 0, flow: 1, unfold: 0.04, bladeLen: 0.082, taper: 0.62, rim: 1.0, caustic: 0.3, core: 0.5 } },
    { id: 'jade-crown', name: 'Jade Crown', variant: 4, palette: 'verdant', tags: ['crown', 'rings'], blurb: 'Concentric crowns of upright blades counter-rotate through whole turns, stepping down in depth.', fingerprint: 'Form: radial polar-repeat rings (not a lattice). Material: jade-ivory lacquer. Motion: alternating ring rotation, staggered breath.', drop: ['pitch', 'unfold', 'flow'], over: { petals: 168, turns: 1, bladeLen: 0.05, taper: 0.7, depth: 0.14, rim: 0.9, translucency: 0.4, unfold: 0.06 } },
    { id: 'spiral-canopy', name: 'Spiral Canopy', variant: 5, palette: 'opal-dusk', tags: ['backlit', 'canopy'], blurb: 'Seen from beneath: broad translucent leaves backlit by a bright seed, with defocused foreground leaves.', fingerprint: 'Form: broad lattice leaves under a strong near stratum. Material: backlit translucent, high transmission. Motion: slow turn, deep camera orbit.', over: { petals: 110, turns: 1, bladeLen: 0.1, taper: 0.4, depth: 0.22, translucency: 0.62, core: 1.8, rim: 0.5, orbit: 0.12, bloom: 0.8 } },
    { id: 'twin-phyllotaxis', name: 'Twin Phyllotaxis', variant: 6, palette: 'rose-gold', tags: ['interference', 'twin'], blurb: 'Two golden-angle lattices turn against each other, ivory over copper, and beat as they pass.', fingerprint: 'Form: two interleaved lattices at a 1:0.618 count ratio. Material: ivory over copper. Motion: counter-rotation at 1x and 2x.', over: { petals: 150, turns: 1, bladeLen: 0.066, taper: 0.55, depth: 0.1, caustic: 0.8, unfold: 0.05 } },
    { id: 'orbital-petals', name: 'Orbital Petals', variant: 7, palette: 'opal-dusk', tags: ['orbits', 'gyroscope'], blurb: 'Tilted rings of tangent petals turn like a gyroscope, each at its own whole-number rate.', fingerprint: 'Form: tilted elliptical orbit rings, tangent petals. Material: opal pearl. Motion: counter-rotating rings, breathing tilt.', drop: ['pitch', 'unfold', 'flow'], over: { petals: 180, turns: 1, bladeLen: 0.05, taper: 0.5, rim: 1.1, unfold: 0, flow: 0 } },
    { id: 'quiet-unfold', name: 'Quiet Unfold', variant: 8, palette: 'ivory-jade', tags: ['calm', 'ambient'], blurb: 'The calmest bloom: one slow unfold wave, low contrast, soft light. Made for text-safe backgrounds.', fingerprint: 'Form: sparse lattice, low relief. Material: matte ivory, minimal rim. Motion: a single unfold wave, no rotation.', over: { petals: 96, turns: 0, bladeLen: 0.082, unfold: 0.22, breath: 0.02, rim: 0.35, caustic: 0.2, core: 0.35, bloom: 0.3, vignette: 0.5, orbit: 0.03, exposure: 0.92 } },
  ],
};
