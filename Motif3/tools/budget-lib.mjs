// Pure helpers shared by bench.mjs, bench-compare.mjs and the unit tests. No browser, no I/O.
//
// budgets.json contract (schema 2):
//   { "schema": 2, "unit": "ms", "default": <p95 ms for styles without an entry>,
//     "reference": null | { device, renderer, size, frames, runs, margin, date },   // set only by `bench.mjs --update-budgets` on a real GPU
//     "styles": { "<style id>": <number p95>  |  { "p95": n, "p50"?: n, "max"?: n } } }
// A bare number is shorthand for { p95: n }, so schema-1 files keep working.

export function budgetFor(budgets, id) {
  const v = budgets && budgets.styles && budgets.styles[id];
  const d = typeof budgets.default === 'number' ? budgets.default : 16.7;
  if (v == null) return { p95: d, source: 'default' };
  if (typeof v === 'number') return { p95: v, source: 'style' };
  return { p95: typeof v.p95 === 'number' ? v.p95 : d, p50: v.p50, max: v.max, source: 'style' };
}

export function validateBudgets(b) {
  const errs = [];
  if (!b || typeof b !== 'object') return ['not an object'];
  if (typeof b.default !== 'number' || !(b.default > 0)) errs.push('default must be a positive number');
  if (!b.styles || typeof b.styles !== 'object' || Array.isArray(b.styles)) errs.push('styles must be an object');
  else for (const [id, v] of Object.entries(b.styles)) {
    if (typeof v === 'number') { if (!(v > 0)) errs.push(`${id}: p95 must be > 0`); continue; }
    if (!v || typeof v !== 'object' || !(v.p95 > 0)) { errs.push(`${id}: needs p95 > 0`); continue; }
    for (const k of ['p50', 'max']) if (k in v && !(v[k] > 0)) errs.push(`${id}: ${k} must be > 0`);
  }
  if (b.reference != null && typeof b.reference !== 'object') errs.push('reference must be null or an object');
  return errs;
}

export const rendererClass = r => (r.software ? 'swiftshader' : 'real');

// Evaluate a bench report against budgets: per scene { id, p50, p95, max, budget, ok, reasons }.
export function evaluateReport(report, budgets) {
  return report.scenes.map(s => {
    const b = budgetFor(budgets, s.id), reasons = [];
    if (s.p95 > b.p95) reasons.push(`p95 ${s.p95} > ${b.p95}`);
    if (b.p50 != null && s.p50 > b.p50) reasons.push(`p50 ${s.p50} > ${b.p50}`);
    if (b.max != null && s.max > b.max) reasons.push(`max ${s.max} > ${b.max}`);
    if (s.errors && s.errors.length) reasons.push(`errors: ${s.errors.join('; ')}`);
    return { id: s.id, p50: s.p50, p95: s.p95, max: s.max, budget: b.p95, budgetSource: b.source, ok: reasons.length === 0, reasons };
  });
}

// Propose budgets from a measured run: p95 * (1 + margin), rounded up to 0.1 ms. Never invents a number for a style that was not measured
// or that errored, and never touches `default`.
export function proposeBudgets(report, prev, { margin = 0.25 } = {}) {
  if (report.software) throw new Error('refusing to propose budgets from software GL (SwiftShader/llvmpipe): measure on a real GPU');
  const styles = { ...(prev && prev.styles || {}) }, skipped = [];
  for (const s of report.scenes) {
    if (!s.errors || s.errors.length || !(s.p95 > 0)) { skipped.push(s.id); continue; }
    styles[s.id] = { p95: Math.ceil(s.p95 * (1 + margin) * 10) / 10 };
  }
  return {
    budgets: { ...(prev || {}), schema: 2, unit: 'ms', default: prev && typeof prev.default === 'number' ? prev.default : 16.7,
      reference: { device: report.renderer, size: report.size, frames: report.frames, runs: report.runs || 1, margin, date: report.date, cores: report.cores, memoryGB: report.memoryGB },
      styles },
    skipped,
  };
}

export function renderMarkdown(report, budgets, { title = 'Motif benchmark' } = {}) {
  const rows = evaluateReport(report, budgets), bad = rows.filter(r => !r.ok), sorted = [...rows].sort((a, b) => b.p95 - a.p95);
  const cls = rendererClass(report);
  const L = [`# ${title}`, '',
    `- Device: ${report.renderer || 'unknown'} (${cls === 'swiftshader' ? '**software GL, not representative**' : 'hardware GPU'})`,
    `- Size: ${report.size} · frames per style: ${report.frames}${report.runs > 1 ? ` · runs: ${report.runs} (p95 is the max across runs)` : ''}`,
    `- Browser: ${report.browser || report.ua || 'n/a'} · cores ${report.cores ?? 'n/a'} · memory ${report.memoryGB ?? 'n/a'} GB · ${report.date}`,
    `- Budgets: ${report.software ? 'not enforced (software GL)' : `${bad.length ? `**${bad.length} over budget**` : 'all within budget'}`} · reference ${budgets.reference ? `${budgets.reference.device}, measured ${String(budgets.reference.date).slice(0, 10)}` : '**none recorded yet (defaults are placeholders, not measurements)**'}`, '',
    '| style | p50 ms | p95 ms | max ms | budget p95 | status |', '| --- | ---: | ---: | ---: | ---: | --- |'];
  for (const r of sorted) L.push(`| ${r.id} | ${r.p50} | ${r.p95} | ${r.max} | ${r.budget}${r.budgetSource === 'default' ? ' (default)' : ''} | ${report.software ? (r.reasons.some(x => x.startsWith('errors')) ? 'ERROR' : 'n/a') : r.ok ? 'ok' : 'OVER: ' + r.reasons.join('; ')} |`);
  if (report.pageErrors && report.pageErrors.length) L.push('', '**Page errors:**', ...report.pageErrors.map(e => `- ${e}`));
  return L.join('\n') + '\n';
}

// Compare two bench reports. Regression = new p95 above old p95 by more than `threshold` (relative) AND by at least `minDeltaMs`
// (so sub-millisecond noise on trivial styles does not fail a build).
export function compareReports(oldR, newR, { threshold = 0.15, minDeltaMs = 0.25 } = {}) {
  const notes = [];
  if (rendererClass(oldR) !== rendererClass(newR)) return { comparable: false, reason: `renderer class differs (${rendererClass(oldR)} vs ${rendererClass(newR)})`, regressions: [], improvements: [], rows: [] };
  if (!oldR.software && oldR.renderer !== newR.renderer) return { comparable: false, reason: `GPU differs ("${oldR.renderer}" vs "${newR.renderer}")`, regressions: [], improvements: [], rows: [] };
  if (oldR.size !== newR.size) return { comparable: false, reason: `size differs (${oldR.size} vs ${newR.size})`, regressions: [], improvements: [], rows: [] };
  const o = new Map(oldR.scenes.map(s => [s.id, s])), rows = [], added = [];
  for (const s of newR.scenes) {
    const p = o.get(s.id); if (!p) { added.push(s.id); continue; } o.delete(s.id);
    const delta = s.p95 - p.p95, rel = p.p95 > 0 ? delta / p.p95 : 0;
    rows.push({ id: s.id, old: p.p95, new: s.p95, delta: +delta.toFixed(2), rel, regression: rel > threshold && delta >= minDeltaMs, improvement: rel < -threshold && -delta >= minDeltaMs });
  }
  return { comparable: true, threshold, minDeltaMs, rows, regressions: rows.filter(r => r.regression), improvements: rows.filter(r => r.improvement), added, removed: [...o.keys()], notes };
}

export function compareMarkdown(c, oldR, newR) {
  if (!c.comparable) return `## Benchmark comparison\n\nNot comparable: ${c.reason}.\n`;
  const L = ['## Benchmark comparison', '', `Old: ${oldR.date} · New: ${newR.date} · ${newR.renderer} · ${newR.size} · fail on p95 > +${(c.threshold * 100).toFixed(0)}% and >= ${c.minDeltaMs} ms`, '',
    `**${c.regressions.length} regression(s)**, ${c.improvements.length} improvement(s), ${c.added.length} new style(s), ${c.removed.length} removed.`, ''];
  const show = [...c.regressions, ...c.improvements].sort((a, b) => b.rel - a.rel);
  if (show.length) { L.push('| style | old p95 | new p95 | change | verdict |', '| --- | ---: | ---: | ---: | --- |'); for (const r of show) L.push(`| ${r.id} | ${r.old} | ${r.new} | ${r.rel >= 0 ? '+' : ''}${(r.rel * 100).toFixed(1)}% | ${r.regression ? 'REGRESSION' : 'faster'} |`); }
  return L.join('\n') + '\n';
}
