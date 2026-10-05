// Loads the MotifGraph engine module in plain Node (it only needs a stand-in for engine-core's parameter helpers).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
export const src = path.resolve(here, '../../src-v9/modules/graph-engine.js');
export function loadGraph() {
  const P = {
    range: (label, min, max, def, step, o) => ({ type: 'range', label, min, max, def, step, ...o }), int: (label, min, max, def, o) => ({ type: 'int', label, min, max, def, step: 1, ...o }),
    select: (label, options, def, o) => ({ type: 'select', label, options, def, ...o }), toggle: (label, def, o) => ({ type: 'toggle', label, def, ...o }),
  };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const sanitize = (v, schema) => { const out = {}; for (const [k, s] of Object.entries(schema)) { let x = v && k in v ? v[k] : s.def;
    if (s.type === 'range' || s.type === 'int') { x = Number(x); if (!Number.isFinite(x)) x = s.def; x = clamp(x, s.min, s.max); if (s.type === 'int') x = Math.round(x); }
    else if (s.type === 'select') { if (!s.options.some(o => o.v === x)) x = s.def; } else if (s.type === 'toggle') x = !!x; out[k] = x; } return out; };
  const defaults = schema => Object.fromEntries(Object.entries(schema).map(([k, s]) => [k, s.def]));
  const f = new Function('__m_engine_core', fs.readFileSync(src, 'utf8') + '\nreturn __m_graph;');
  return f({ P, sanitize, defaults, clamp });
}
