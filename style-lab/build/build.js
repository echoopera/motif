#!/usr/bin/env node
'use strict';
// Bundles harness modules into one self-contained page: dist/index.html (artifact body) and dist/standalone.html.
// Standard library only. Order comes from modules/graph.json; imports become namespace lookups.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const graph = JSON.parse(fs.readFileSync(path.join(root, 'modules/graph.json'), 'utf8'));
const ns = n => '__m_' + n.replace(/-/g, '_');

function transform(name) {
  const mod = JSON.parse(fs.readFileSync(path.join(root, 'modules', name, 'module.json'), 'utf8'));
  let src = fs.readFileSync(path.join(root, 'modules', name, mod.entry), 'utf8');
  const exported = [];
  src = src.replace(/^import\s*\{([^}]+)\}\s*from\s*'@modules\/([a-z-]+)';\s*$/gm, (m, names, dep) => {
    if (!(mod.dependsOn || []).includes(dep)) throw new Error(`${name} imports undeclared ${dep}`);
    const parts = names.split(',').map(s => s.trim()).filter(Boolean).map(s => s.replace(/\s+as\s+/, ': '));
    return `const { ${parts.join(', ')} } = ${ns(dep)};`;
  });
  src = src.replace(/^export\s+(const|let|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm, (m, kw, id) => { exported.push(id); return `${kw} ${id}`; });
  src = src.replace(/^export\s*\{([^}]+)\};?\s*$/gm, (m, names) => { names.split(',').map(s => s.trim()).filter(Boolean).forEach(n => exported.push(n)); return ''; });
  for (const e of mod.exports) if (!exported.includes(e)) throw new Error(`${name}: CONTRACT export "${e}" not found in source`);
  return `// ---- module: ${name} v${mod.version}\nconst ${ns(name)} = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();\n`;
}

const bundle = graph.order.map(transform).join('\n');
// Extract static strings (CSS, markup, font link) by evaluating the pure module bodies.
const sandbox = { console, Math, Map, Set, JSON, Number, String, Array, Object, Promise, Error, Uint8Array, globalThis: {} };
const out = vm.runInNewContext(bundle + `;({ tokens: ${ns('tokens')}, shell: ${ns('web-immersive-shell')} })`, sandbox);
const libs = [
  'https://cdn.jsdelivr.net/npm/fflate@0.8.3/umd/index.js',
  'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.js',
  'https://cdn.jsdelivr.net/npm/webm-muxer@5.1.4/build/webm-muxer.js',
];
const head = `<title>Motif Style Lab</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${out.tokens.FONT_LINK}">
<style>${out.tokens.uiCss}\n${out.shell.shellCss}</style>`;
const body = `${out.shell.shellHtml}
${libs.map(u => `<script src="${u}"></script>`).join('\n')}
<script>
"use strict";
${bundle}
${ns('web-immersive-shell')}.boot();
</script>`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), head + '\n' + body + '\n');
fs.writeFileSync(path.join(root, 'dist/standalone.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${head}\n</head><body>\n${body}\n</body></html>\n`);
const kb = n => (fs.statSync(path.join(root, n)).size / 1024).toFixed(1) + ' KB';
console.log(`built dist/index.html (${kb('dist/index.html')}) and dist/standalone.html from ${graph.order.length} modules`);
