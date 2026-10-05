#!/usr/bin/env node
'use strict';
// Rejects raw values (hex colours, px/pt literals, font names) in module source when a token exists.
// Usage: node token-lint.js  — scans modules/*/src except modules/tokens
const L = require('./lib');
let okAll = true;
const RAW = [[/#[0-9a-fA-F]{3,8}\b/g, 'raw hex colour'], [/\b\d+(\.\d+)?(px|pt)\b/g, 'raw px/pt literal'], [/font-family\s*:/g, 'raw font-family'], [/(?:rgba?|hsla?)\(/g, 'raw colour function']];
for (const f of L.walk(L.P.modules)) {
  if (!/\/src\//.test(f) || /\/modules\/tokens\//.test(f) || !/\.(ts|tsx|js|jsx|css|swift|html)$/.test(f)) continue;
  const lines = L.fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((ln, i) => { if (/token-lint-ignore/.test(ln)) return; for (const [re, label] of RAW) if (re.test(ln)) { okAll = false; L.fail(`${L.path.relative(L.P.root, f)}:${i + 1}: ${label}`); L.info(ln.trim().slice(0, 100)); } });
}
if (okAll) L.ok('token-lint: no raw values outside modules/tokens');
process.exit(okAll ? 0 : 1);
