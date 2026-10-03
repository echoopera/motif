// npm test: translator unit tests, then convert + type-check a real kit through the clang shim, then WebGL↔CPU parity
// on a few styles. Skips parity when Chromium/clang are missing.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const bin = path.join(here, '../bin/motif-metal.mjs');
const kit = path.join(here, '../../../motifKits/wallcast-1.0.0.motifkit');
const step = (name, cmd, args) => { console.log(`\n== ${name}`); const r = spawnSync(cmd, args, { stdio: 'inherit' }); if (r.status) { console.error(`FAILED: ${name}`); process.exit(r.status); } };
step('unit tests', process.execPath, ['--test', path.join(here, 'unit.mjs')]);
step('convert + type-check wallcast', process.execPath, [bin, 'check', kit]);
if (spawnSync('clang++', ['--version']).status === 0) step('parity (WebGL vs generated Metal on CPU)', process.execPath, [bin, 'parity', kit, '--styles=prism-split,kaleido-wall,depth-stack']);
else console.log('\n(clang++ not found: skipping parity)');
