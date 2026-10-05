// Prints the MotifGraph node registry as JSON (types, kinds, parameter schemas): the single source for the JSON Schema and the docs.
import { loadGraph } from './engine-load.mjs';
const G = loadGraph(), out = {};
for (const k of G.TYPE_IDS) { const t = G.TYPES[k]; out[k] = { id: t.id, kind: t.kind, name: t.name, hint: t.hint || '', params: Object.fromEntries(Object.entries(t.schema).map(([key, s]) => [key, { type: s.type, label: s.label, min: s.min, max: s.max, def: (t.preset && key in t.preset) ? t.preset[key] : s.def, options: s.options ? s.options.map(o => o.v) : undefined, unit: s.unit }])) }; }
console.log(JSON.stringify({ version: G.VERSION, maxNodes: G.MAX_NODES, maxInstances: G.MAX_INSTANCES, types: out, presets: G.PRESETS.map(p => ({ id: p.id, name: p.name, blurb: p.blurb })) }));
