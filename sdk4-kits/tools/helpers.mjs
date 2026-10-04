// Shared parameter blocks and helpers for kit definitions (src/<id>/kit.mjs).
export const R = (label, min, max, def, extra = {}) => ({ type: 'range', label, min, max, def, step: extra.step ?? +((max - min) / 200).toPrecision(2), ...extra });
export const I = (label, min, max, def, extra = {}) => ({ type: 'int', label, min, max, def, ...extra });
const QUALITY = def => ({ type: 'select', label: 'Quality', options: [{ v: 'live', l: 'Live' }, { v: 'balanced', l: 'Balanced' }, { v: 'export', l: 'Export' }], def, mutate: 0, group: 'Quality', hint: 'Sample counts only. Composition, phase and exposure stay the same.' });

export const lens = (o = {}) => ({
  keyAngle: R('Key direction', -180, 180, o.keyAngle ?? 135, { step: 1, unit: '°', group: 'Light', hint: 'Direction of the key light in the picture plane, degrees.', randMax: 180 }),
  exposure: R('Exposure', 0.4, 2.4, o.exposure ?? 1, { step: 0.01, unit: '×', log: true, group: 'Light', hint: 'Linear exposure before the single tone map.', randMax: 1.4 }),
  bloom: R('Bloom', 0, 1.6, o.bloom ?? 0.5, { step: 0.01, group: 'Lens', hint: 'Glow added around emissive light. 0 shows the bare geometry.', randMax: 0.9 }),
  bloomRadius: R('Bloom radius', 0.4, 2.2, o.bloomRadius ?? 1, { step: 0.01, group: 'Lens', hint: 'Width of the glow relative to the frame.', randMax: 1.5 }),
  lensCA: R('Edge fringe', 0, 0.5, o.lensCA ?? 0.12, { step: 0.01, group: 'Lens', hint: 'Spectral fringing toward the frame edge.', randMax: 0.25 }),
  vignette: R('Vignette', 0, 0.8, o.vignette ?? 0.38, { step: 0.01, group: 'Lens', hint: 'Darkens the frame edge; never touches the focal area.', randMax: 0.55 }),
  quality: QUALITY(o.quality ?? 'export'),
});
export const crispLens = (o = {}) => ({
  keyAngle: R('Shadow direction', -180, 180, o.keyAngle ?? -45, { step: 1, unit: '°', group: 'Light', hint: 'Direction the soft layer shadow falls, degrees.', randMax: 180 }),
  exposure: R('Exposure', 0.7, 1.4, o.exposure ?? 1, { step: 0.01, unit: '×', group: 'Light', hint: 'Overall level of the printed colours.' }),
  vignette: R('Vignette', 0, 0.5, o.vignette ?? 0, { step: 0.01, group: 'Lens', hint: 'Darkens the frame edge. Off by default for graphic work.', randMax: 0.2 }),
  quality: QUALITY(o.quality ?? 'export'),
});

export function merge(base, over) {
  const o = JSON.parse(JSON.stringify(base));
  for (const [k, v] of Object.entries(over || {})) {
    if (!o[k]) throw new Error(`override for unknown param ${k}`);
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) Object.assign(o[k], v); else o[k].def = v;
  }
  return o;
}
export const kitHelpers = { merge };
