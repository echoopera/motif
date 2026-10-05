// Generates docs/MotifGraph-nodes.md (the node reference) from the registry: node tests/v9/gen-docs.mjs
import fs from 'node:fs'; import path from 'node:path'; import { loadGraph, src } from './engine-load.mjs';
const G = loadGraph(), out = [];
const fam = { stage: 'Stage', cloner: 'Cloner', field: 'Fields', effector: 'Effectors', deformer: 'Deformers' };
out.push('# MotifGraph node reference', '', 'Generated from the node registry (`tests/v9/gen-docs.mjs`). Parameters are project channels addressed `M:<layerId or @>:<nodeId>:<key>`: keyframable, audio-mappable, saved with the project. "Cycles per loop" parameters are whole numbers so every loop closes exactly.', '');
for (const kind of ['stage', 'cloner', 'field', 'effector', 'deformer']) {
  out.push(`## ${fam[kind]}`, '');
  for (const k of G.TYPE_IDS.filter(t => G.TYPES[t].kind === kind)) {
    const t = G.TYPES[k]; out.push(`### ${t.name}  \`${k}\` · id ${t.id}`, '', t.hint, '', '| Key | Control | Range | Default |', '| --- | --- | --- | --- |');
    for (const [key, s] of Object.entries(t.schema)) {
      const def = key in t.preset ? t.preset[key] : s.def;
      const range = s.type === 'range' || s.type === 'int' ? `${s.min} to ${s.max}${s.unit || ''}` : s.type === 'select' ? s.options.map(o => o.v).join(' · ') : 'on / off';
      out.push(`| \`${key}\` | ${s.label} | ${range} | ${def} |`);
    }
    out.push('');
  }
}
out.push('## Presets', '', ...G.PRESETS.map(p => `- **${p.name}** (\`${p.id}\`): ${p.blurb}`), '');
const dest = path.resolve(path.dirname(src), '../../docs/MotifGraph-nodes.md'); fs.writeFileSync(dest, out.join('\n')); console.log('wrote', dest, out.length, 'lines');
