#!/usr/bin/env node
'use strict';
// Runs the mechanical gates. Usage: node gate.js [all|plan|modules|tokens|claims|handoff]
const L = require('./lib'); const { spawnSync } = require('child_process');
const which = process.argv[2] || 'all';
const run = (label, script, args = []) => { console.log(`\n── ${label}`); const r = spawnSync(process.execPath, [L.path.join(__dirname, script), ...args], { stdio: 'inherit' }); return r.status === 0; };
const results = {};
if (['all', 'plan'].includes(which)) results.plan = L.listJson(L.P.workOrders).length ? run('plan', 'plan.js', ['check']) : (L.fail('no work orders; generate and review a plan before running release gates'), false);
if (['all', 'modules'].includes(which)) results.modules = run('module boundaries', 'boundary-check.js');
if (['all', 'tokens'].includes(which)) results.tokens = run('token lint', 'token-lint.js');
if (['all', 'claims'].includes(which)) { console.log('\n── stale claims'); let s = true; for (const c of L.listJson(L.P.claims)) if (new Date(c.data.expiresAt).getTime() < Date.now()) { s = false; L.fail(`${c.data.wo} held by ${c.data.agent} expired ${c.data.expiresAt}`); } if (s) L.ok('no stale claims'); results.claims = s; }
if (['all', 'ddm'].includes(which)) { console.log('\n── decision model'); let s = true; for (const d of L.listJson(L.P.ddm)) { const e = L.validateAgainst('ddm', d.data); if (e.length) { s = false; L.fail(`${L.path.basename(d.file)}: ${e.join('; ')}`); } } if (s) L.ok('DDM files valid'); results.ddm = s; }
if (['all', 'stubs'].includes(which)) { console.log('\n── stubs'); let s = true; for (const f of L.walk(L.P.modules).filter(f => f.endsWith('stub.json'))) { const stub = L.readJson(f); const mj = L.path.join(L.path.dirname(f), 'module.json'); if (L.exists(mj)) { const m = L.readJson(mj); if (m.status !== 'stub' && stub.version !== m.version) { s = false; L.fail(`${L.path.relative(L.P.root, f)} v${stub.version} ≠ module v${m.version} — consumers built against a stale shape`); } } } if (s) L.ok('stubs consistent'); results.stubs = s; }
if (which === 'handoff') { console.log('\n── handoff package'); let s = true; const need = ['00-summary.md', '01-decisions.md', '02-screens', '03-flows.md', '04-tokens', '05-modules', '06-copy.md', '07-accessibility.md', '08-motion.md', '09-open-questions.md', '10-next.md']; for (const n of need) if (!L.exists(L.path.join(L.P.handoff, n))) { s = false; L.fail(`handoff/${n} missing`); } if (s) L.ok('handoff package complete'); results.handoff = s && run('module boundaries', 'boundary-check.js'); }
console.log('\n══ GATE SUMMARY'); let all = true; for (const [k, v] of Object.entries(results)) { all &= v; console.log(`  ${v ? '\x1b[32mpass\x1b[0m' : '\x1b[31mfail\x1b[0m'}  ${k}`); }
process.exit(all ? 0 : 1);
