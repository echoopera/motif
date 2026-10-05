#!/usr/bin/env node
'use strict';
// Design Decision Model helpers.
// node ddm.js init <project>
// node ddm.js add <project> <owner> <stage> "<decision>" "<rationale>" ["alt1|alt2"] ["sacrifice"]
// node ddm.js loopback <project> <from> <to> "<reason>"
// node ddm.js export <project>   — markdown for handoff/01-decisions.md
const L = require('./lib');
const [, , cmd, project, ...rest] = process.argv;
const file = p => L.path.join(L.P.ddm, p + '.json');
const load = p => { if (!L.exists(file(p))) L.die(`no DDM for ${p}; run ddm.js init ${p}`); return L.readJson(file(p)); };
const cmds = {
  init() { if (L.exists(file(project))) L.die('exists'); L.writeJson(file(project), { project, version: '3.0', direction: {}, decisions: [], loopbacks: [] }); L.ok(`DDM created for ${project}`); },
  add() { const [owner, stage, decision, rationale, alts, sacrifices] = rest; if (!decision || !rationale) L.die('decision and rationale required'); const d = load(project); const id = `D-${String(d.decisions.length + 1).padStart(3, '0')}`; d.decisions.push({ id, owner, stage: Number(stage), decision, rationale, alternatives: alts ? alts.split('|') : [], sacrifices: sacrifices || '', status: 'accepted', affects: [], at: L.nowIso() }); const e = L.validateAgainst('ddm', d); if (e.length) L.die(e.join('; ')); L.writeJson(file(project), d); L.ok(`${id} recorded`); },
  loopback() { const [from, to, reason] = rest; const d = load(project); d.loopbacks.push({ fromStage: Number(from), toStage: Number(to), reason, at: L.nowIso() }); L.writeJson(file(project), d); L.ok('loopback logged'); },
  export() { const d = load(project); const out = [`# Decisions — ${d.project}`, '', d.direction.chosen ? `**Direction:** ${d.direction.chosen} — ${d.direction.rationale || ''}` : '', '', '| ID | Stage | Owner | Decision | Why | Rejected | Sacrifices |', '|---|---|---|---|---|---|---|', ...d.decisions.map(x => `| ${x.id} | ${x.stage} | ${x.owner} | ${x.decision} | ${x.rationale} | ${(x.alternatives || []).join('; ')} | ${x.sacrifices || ''} |`), '', d.loopbacks.length ? '## Loop-backs\n' + d.loopbacks.map(l => `- ${l.fromStage} → ${l.toStage}: ${l.reason}`).join('\n') : ''].join('\n'); process.stdout.write(out + '\n'); },
};
(cmds[cmd] || (() => { console.log('Usage: init|add|loopback|export <project> ...'); process.exit(2); }))();
