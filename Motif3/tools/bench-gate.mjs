// Offline budget gate for a saved bench report (the same decision bench.mjs --budget makes, without a browser).
//   node tools/bench-gate.mjs performance-review/bench-<date>.json [--budgets tools/budgets.json]
// Exit 0: within budget, or software GL (not representative, skipped). Exit 1: a style is over budget or errored. Exit 2: unreadable input.
import fs from 'node:fs';
import path from 'node:path';
import { evaluateReport, validateBudgets } from './budget-lib.mjs';
const args = process.argv.slice(2), val = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const file = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--budgets');
if (!file) { console.error('usage: bench-gate.mjs report.json [--budgets file]'); process.exit(2); }
let report, budgets;
try { report = JSON.parse(fs.readFileSync(file, 'utf8')); budgets = JSON.parse(fs.readFileSync(val('budgets', path.join(import.meta.dirname, 'budgets.json')), 'utf8')); } catch (e) { console.error('cannot read input: ' + e.message); process.exit(2); }
const bad = validateBudgets(budgets); if (bad.length) { console.error('budgets invalid: ' + bad.join('; ')); process.exit(2); }
const rows = evaluateReport(report, budgets), errs = rows.filter(r => r.reasons.some(x => x.startsWith('errors'))), over = rows.filter(r => !r.ok && !r.reasons.every(x => x.startsWith('errors')));
if (errs.length) { console.error(`Render errors: ${errs.map(r => r.id).join(', ')}`); process.exit(1); }
if (report.software) { console.log('Budget gate skipped: software GL is not representative.'); process.exit(0); }
if (over.length) { console.error(`Over budget: ${over.map(r => `${r.id} (${r.reasons.join('; ')})`).join(', ')}`); process.exit(1); }
console.log(`Within budget: ${rows.length} styles on ${report.renderer}`);
