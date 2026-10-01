// Compare two bench reports and fail on p95 regressions.
//   node tools/bench-compare.mjs old.json new.json [--threshold 0.15] [--min-delta 0.25] [--md out.md]
// Exit 0: no regression. Exit 1: at least one style regressed (new p95 > old p95 by more than the threshold AND by >= min-delta ms).
// Exit 2: not comparable (different GPU class / GPU / size) or unreadable input; nothing was gated.
import fs from 'node:fs';
import { compareReports, compareMarkdown } from './budget-lib.mjs';
const args = process.argv.slice(2), val = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1]; };
const files = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (files.length < 2) { console.error('usage: bench-compare.mjs old.json new.json [--threshold 0.15] [--min-delta 0.25] [--md out.md]'); process.exit(2); }
let oldR, newR;
try { oldR = JSON.parse(fs.readFileSync(files[0], 'utf8')); newR = JSON.parse(fs.readFileSync(files[1], 'utf8')); } catch (e) { console.error('cannot read reports: ' + e.message); process.exit(2); }
const c = compareReports(oldR, newR, { threshold: +val('threshold', 0.15), minDeltaMs: +val('min-delta', 0.25) });
const md = compareMarkdown(c, oldR, newR); console.log(md);
if (val('md', null)) fs.writeFileSync(val('md'), md);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
if (!c.comparable) { console.error('NOT COMPARABLE: ' + c.reason); process.exit(2); }
if (c.regressions.length) { console.error(`FAIL: ${c.regressions.length} style(s) regressed more than ${(c.threshold * 100).toFixed(0)}% on p95: ${c.regressions.map(r => r.id).join(', ')}`); process.exit(1); }
console.log('OK: no p95 regression over threshold');
