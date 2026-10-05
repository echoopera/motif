#!/usr/bin/env node
'use strict';
// Design Harness 3.0: brief -> disjoint work orders.
// Usage: node harness/scripts/plan.js <brief.json> [--write]
//        node harness/scripts/plan.js check
// Standard library only. This plans work; it does not launch agents or provide distributed locks.
const L = require('./lib');
const [, , arg, flag] = process.argv;

const PLATFORM_AGENT = {
  ios: 'ios-designer',
  ipados: 'ipados-designer',
  macos: 'macos-designer',
  web: 'saas-product-designer',
  'web-immersive': 'immersive-web-designer',
  'web-saas': 'saas-product-designer',
  'web-editorial': 'editorial-internal-tools-designer',
  'web-internal': 'editorial-internal-tools-designer'
};
const DOMAIN_AGENT = {
  music: 'music-software-designer',
  art: 'creative-tools-designer',
  content: 'content-systems-designer',
  editorial: 'content-systems-designer',
  marketing: 'marketing-designer'
};
const ENGINEER = {
  ios: 'ios-engineer',
  ipados: 'ios-engineer',
  macos: 'native-engineer',
  web: 'web-engineer',
  'web-immersive': 'web-engineer',
  'web-saas': 'web-engineer',
  'web-editorial': 'web-engineer',
  'web-internal': 'web-engineer'
};
const MODULE_PREFIX = {
  ios: 'ios',
  ipados: 'ipados',
  macos: 'macos',
  web: 'web-product',
  'web-immersive': 'web-immersive',
  'web-saas': 'web-saas',
  'web-editorial': 'web-editorial',
  'web-internal': 'web-internal'
};

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function planFromBrief(brief) {
  const errs = L.validateAgainst('brief', brief);
  if (errs.length) L.die('brief invalid:\n  ' + errs.join('\n  '));

  const project = slug(brief.project);
  const mode = brief.engagementMode || 'build';
  const risks = new Set(brief.riskLanes || []);
  const wos = [];
  let n = 0;

  const add = (record) => {
    const id = `WO-${String(++n).padStart(3, '0')}`;
    wos.push(Object.assign({
      id,
      status: 'draft',
      reads: ['AGENTS.md', 'ROSTER.md', 'harness/knowledge/**', `design/${project}/**`],
      dependsOn: [],
      ttlMinutes: 240
    }, record));
    return id;
  };

  const research = add({
    title: 'Problem framing, evidence and critical journeys',
    owner: 'ux-researcher',
    lane: 'foundation',
    stage: 1,
    owns: [`design/${project}/research/**`],
    outputs: [`design/${project}/research/framing.md`, `design/${project}/research/evidence-ledger.md`],
    acceptance: ['Every brief journey has a step-level map', 'Facts and assumptions are visibly separated', 'Riskiest unknowns are named']
  });

  const ia = add({
    title: 'Object, state and information architecture',
    owner: 'information-architect',
    lane: 'foundation',
    stage: 1,
    owns: [`design/${project}/ia/**`],
    dependsOn: [research],
    outputs: [`design/${project}/ia/object-model.md`, `design/${project}/ia/state-model.md`, `design/${project}/ia/navigation.md`],
    acceptance: ['Every journey step maps to an object/state transition', 'Navigation and recovery paths are explicit']
  });

  const direction = add({
    title: 'Creative direction and design principles',
    owner: 'creative-director',
    lane: 'direction',
    stage: 2,
    owns: [`design/${project}/direction/**`],
    dependsOn: [research],
    outputs: [`design/${project}/direction/direction.md`],
    acceptance: ['Direction responds to the brief rather than a house style', 'Alternatives and sacrifices are recorded when choice was material']
  });

  const visual = add({
    title: 'Visual grammar',
    owner: 'graphic-designer',
    lane: 'direction',
    stage: 2,
    owns: [`design/${project}/visual/**`],
    dependsOn: [direction],
    outputs: [`design/${project}/visual/system.md`],
    acceptance: ['Type, color, grid, icon and imagery rules use semantic names', 'Legibility and content bounds are specified']
  });

  const systemContract = add({
    title: 'Design-system contract and semantic token stub',
    owner: 'design-systems-engineer',
    lane: 'system',
    stage: 3,
    owns: [`design/${project}/system/**`, 'modules/tokens/stub.json'],
    dependsOn: [visual, ia],
    outputs: [`design/${project}/system/contract.md`, 'modules/tokens/stub.json'],
    acceptance: ['Foundations, semantics, components, patterns and platform adapters are separated', 'Token names and types are versioned before consumer work']
  });

  const platformWos = [];
  for (const platform of brief.platforms) {
    const agent = PLATFORM_AGENT[platform];
    platformWos.push(add({
      title: `State-complete screens and flows — ${platform}`,
      owner: agent,
      lane: `platform-${platform}`,
      stage: 4,
      owns: [`design/${project}/screens/${platform}/**`],
      dependsOn: [ia, direction, systemContract],
      outputs: [`design/${project}/screens/${platform}/index.md`],
      acceptance: ['Every critical journey step has a surface or system transition', 'Applicable empty/loading/error/permission/offline/recovery states are specified', 'Input, resize, text scaling and platform conventions are addressed']
    }));
  }

  const domainWos = [];
  const domainAgent = DOMAIN_AGENT[brief.domain];
  if (domainAgent) {
    domainWos.push(add({
      title: `Domain interaction model — ${brief.domain}`,
      owner: domainAgent,
      lane: 'domain',
      stage: 4,
      owns: [`design/${project}/domain/**`],
      dependsOn: [ia, direction],
      outputs: [`design/${project}/domain/interactions.md`],
      acceptance: ['Domain-critical interactions are specified at gesture/keystroke level', 'Expert and first-use paths are both considered']
    }));
  }

  const crossWos = [];
  if (risks.has('ai')) {
    crossWos.push(add({
      title: 'AI interaction, autonomy and trust contract',
      owner: 'ai-experience-designer',
      lane: 'ai',
      stage: 4,
      owns: [`design/${project}/ai/**`],
      dependsOn: [ia, direction],
      outputs: [`design/${project}/ai/contract.md`],
      acceptance: ['Scope, system states, approval, undo, provenance and fallback are explicit', 'Representative failure and uncertainty scenarios are included']
    }));
  }
  if (risks.has('data-visualization')) {
    crossWos.push(add({
      title: 'Data visualization grammar',
      owner: 'data-visualization-designer',
      lane: 'visualization',
      stage: 4,
      owns: [`design/${project}/visualization/**`],
      dependsOn: [ia, systemContract],
      outputs: [`design/${project}/visualization/grammar.md`],
      acceptance: ['Every visual maps to a user decision and defined measure', 'Accessible alternatives and sparse/dense/error fixtures exist']
    }));
  }
  if (risks.has('localization')) {
    crossWos.push(add({
      title: 'Localization and global-readiness specification',
      owner: 'localization-designer',
      lane: 'localization',
      stage: 4,
      owns: [`design/${project}/localization/**`],
      dependsOn: [systemContract],
      outputs: [`design/${project}/localization/matrix.md`],
      acceptance: ['Text expansion, RTL and locale formats are specified', 'Pseudolocalized and representative long-string fixtures exist']
    }));
  }

  const designDeps = [...platformWos, ...domainWos, ...crossWos];

  const motion = add({
    title: 'Motion and realtime feedback specification',
    owner: 'motion-designer',
    lane: 'craft',
    stage: 4,
    owns: [`design/${project}/motion/**`],
    dependsOn: platformWos,
    outputs: [`design/${project}/motion/spec.md`],
    acceptance: ['Transitions name trigger, duration/physics, interruption and completion', 'Reduced-motion behavior preserves meaning']
  });

  const copy = add({
    title: 'Product language and complete copy deck',
    owner: 'ux-writer',
    lane: 'craft',
    stage: 4,
    owns: [`design/${project}/copy/**`],
    dependsOn: designDeps,
    outputs: [`design/${project}/copy/deck.md`, `design/${project}/copy/glossary.md`],
    acceptance: ['Every specified string and error is present', 'Errors explain what happened and what the user can do']
  });

  let prototype = null;
  if (mode === 'prototype' || risks.has('prototype')) {
    prototype = add({
      title: 'Prototype the highest-risk behavior',
      owner: 'interaction-prototyper',
      lane: 'prototype',
      stage: 5,
      owns: [`prototypes/${project}/**`],
      dependsOn: [...designDeps, motion, copy],
      outputs: [`prototypes/${project}/README.md`, `prototypes/${project}/findings.md`],
      acceptance: ['Prototype runs from documented instructions and resets deterministically', 'Critical path and one consequential recovery path are testable', 'Simulated behavior and limitations are visible']
    });
  }

  const tokens = add({
    title: 'Implement design tokens and primitive contracts',
    owner: 'design-systems-engineer',
    lane: 'system',
    stage: 5,
    owns: ['modules/tokens/src/**', 'modules/tokens/tests/**', 'modules/primitives-*/src/**', 'modules/primitives-*/tests/**'],
    dependsOn: [systemContract, ...platformWos],
    outputs: ['modules/tokens/src/index.ts'],
    acceptance: ['Semantic tokens cover declared platforms, themes, contrast and density', 'Primitives define applicable states and consume semantic tokens', 'token-lint passes']
  });

  let architecture = null;
  const builds = [];
  if (mode === 'build' || mode === 'design-system') {
    architecture = add({
      title: 'Module architecture and public contracts',
      owner: 'systems-architect',
      lane: 'architecture',
      stage: 5,
      owns: ['modules/*/module.json', 'modules/*/README.md', 'modules/*/CONTRACT.md', 'modules/graph.json'],
      dependsOn: [systemContract, ...designDeps],
      outputs: ['modules/graph.json'],
      acceptance: ['Module graph is acyclic', 'Every module has owner, public entry and contract', 'No module has more than four direct dependencies without an approved decision']
    });
  }

  if (mode === 'build') {
    for (const platform of brief.platforms) {
      const engineer = ENGINEER[platform];
      const prefix = MODULE_PREFIX[platform];
      builds.push(add({
        title: `Implement product modules — ${platform}`,
        owner: engineer,
        lane: `build-${platform}`,
        stage: 6,
        owns: [`modules/${prefix}-*/src/**`, `modules/${prefix}-*/tests/**`],
        dependsOn: [architecture, tokens, ...(prototype ? [prototype] : [])],
        outputs: [`modules/${prefix}-shell/src/index`],
        acceptance: ['Module boundary check passes', 'Critical journey and recovery behavior have executable evidence', 'Only public module entries are imported']
      }));
    }
  }

  const critique = add({
    title: 'Independent craft and coherence review',
    owner: 'aesthetic-critic',
    lane: 'quality',
    stage: 7,
    owns: [`harness/state/reviews/critique-${project}.md`],
    dependsOn: [...designDeps, motion, copy],
    outputs: [`harness/state/reviews/critique-${project}.md`],
    acceptance: ['Rendered evidence is reviewed against the brief and direction', 'No unresolved craft HALT condition remains']
  });

  const a11y = add({
    title: 'Accessibility review',
    owner: 'accessibility-specialist',
    lane: 'quality',
    stage: 7,
    owns: [`harness/state/reviews/a11y-${project}.md`],
    dependsOn: [...designDeps, copy, ...builds],
    outputs: [`harness/state/reviews/a11y-${project}.md`],
    acceptance: ['Essential tasks have declared nonvisual and alternate-input paths', 'Test environment and unverified claims are explicit']
  });

  const riskReviews = [];
  if (risks.has('security')) {
    riskReviews.push(add({
      title: 'Security and privacy review',
      owner: 'security-privacy',
      lane: 'quality-security',
      stage: 7,
      owns: [`harness/state/reviews/security-${project}.md`],
      dependsOn: [...designDeps, ...builds],
      outputs: [`harness/state/reviews/security-${project}.md`],
      acceptance: ['Permissions and data boundaries match trusted enforcement', 'Denied, stale, partial and destructive recovery cases are evidenced']
    }));
  }
  if (risks.has('performance')) {
    riskReviews.push(add({
      title: 'Performance and resilience review',
      owner: 'performance-resilience',
      lane: 'quality-performance',
      stage: 7,
      owns: [`harness/state/reviews/performance-${project}.md`],
      dependsOn: [...builds, ...(prototype ? [prototype] : [])],
      outputs: [`harness/state/reviews/performance-${project}.md`],
      acceptance: ['Workload, device/runtime, revision and method are recorded', 'Critical journey budgets are measured or clearly marked unverified']
    }));
  }

  let integration = null;
  if (mode === 'build') {
    integration = add({
      title: 'Integrate accepted modules and verify consumers',
      owner: 'integration-engineer',
      lane: 'integration',
      stage: 8,
      owns: ['integration/**'],
      dependsOn: [...builds, ...riskReviews],
      outputs: ['integration/release-inventory.md', 'integration/runbook.md', 'integration/rollback.md'],
      acceptance: ['Integrated revision is recorded', 'Affected consumers and assembled critical journey are rerun', 'Migration and rollback are documented']
    });
  }

  const verificationDeps = [critique, a11y, ...riskReviews, ...(integration ? [integration] : []), ...(!integration && prototype ? [prototype] : []), ...(!integration ? [tokens] : [])];
  const verify = add({
    title: 'Verify acceptance criteria against evidence',
    owner: 'verifier',
    lane: 'quality',
    stage: 8,
    owns: [`harness/state/reviews/verify-${project}.md`],
    dependsOn: verificationDeps,
    outputs: [`harness/state/reviews/verify-${project}.md`],
    acceptance: brief.acceptance.map(a => `${a.id}: ${a.criterion} — evidence attached or marked not met`)
  });

  add({
    title: 'Client-ready handoff and next steps',
    owner: 'engagement-lead',
    lane: 'handoff',
    stage: 9,
    owns: ['handoff/**'],
    dependsOn: [verify],
    outputs: ['handoff/00-summary.md', 'handoff/01-decisions.md', 'handoff/10-next.md'],
    acceptance: ['Handoff identifies the exact artifact/revision and editable sources', 'Run instructions, decisions, limitations, open questions and aftercare are included']
  });

  return wos;
}

function checkSet(wos) {
  let okAll = true;
  for (const w of wos) {
    const errors = L.validateAgainst('work-order', w);
    if (errors.length) {
      okAll = false;
      L.fail(`${w.id}: ${errors.join('; ')}`);
    }
  }

  for (let i = 0; i < wos.length; i++) {
    for (let j = i + 1; j < wos.length; j++) {
      for (const a of wos[i].owns) {
        for (const b of wos[j].owns) {
          if (L.globsOverlap(a, b)) {
            okAll = false;
            L.fail(`ownership overlap: ${wos[i].id}:${a} vs ${wos[j].id}:${b}`);
          }
        }
      }
    }
  }

  const outputs = new Map();
  for (const w of wos) {
    for (const output of w.outputs) {
      if (outputs.has(output)) {
        okAll = false;
        L.fail(`duplicate output ${output}: ${outputs.get(output)} and ${w.id}`);
      }
      outputs.set(output, w.id);
    }
  }

  const ids = new Set(wos.map(w => w.id));
  const state = {};
  const order = [];
  const visit = (id, stack = []) => {
    if (state[id] === 2) return;
    if (state[id] === 1) {
      okAll = false;
      L.fail(`cycle: ${[...stack, id].join(' -> ')}`);
      return;
    }
    state[id] = 1;
    const work = wos.find(w => w.id === id);
    for (const dependency of work.dependsOn || []) {
      if (!ids.has(dependency)) {
        okAll = false;
        L.fail(`${id} depends on unknown ${dependency}`);
      } else {
        visit(dependency, [...stack, id]);
      }
    }
    state[id] = 2;
    order.push(id);
  };
  for (const w of wos) visit(w.id);

  if (okAll) L.ok(`${wos.length} work orders: no overlaps, cycles or duplicate outputs`);
  return { okAll, order };
}

function printLanes(wos) {
  const lanes = {};
  for (const w of wos) (lanes[w.lane] ||= []).push(w);
  console.log('\nLANES (independent lanes may run in parallel; dependencies still govern readiness)\n');
  for (const [lane, works] of Object.entries(lanes)) {
    console.log(`  ${lane}`);
    for (const w of works) {
      console.log(`    ${w.id}  s${w.stage}  ${w.owner.padEnd(32)} ${w.title}${w.dependsOn.length ? '  <- ' + w.dependsOn.join(',') : ''}`);
    }
  }
  console.log();
}

if (arg === 'check') {
  const wos = L.listJson(L.P.workOrders).map(x => x.data);
  if (!wos.length) L.die('no work orders');
  process.exit(checkSet(wos).okAll ? 0 : 1);
}

if (!arg) {
  console.log('Usage: node plan.js <brief.json> [--write] | node plan.js check');
  process.exit(2);
}

const brief = L.readJson(L.path.resolve(arg));
const wos = planFromBrief(brief);
const { okAll } = checkSet(wos);
if (!okAll) process.exit(1);
printLanes(wos);

if (flag === '--write') {
  if (L.listJson(L.P.workOrders).length) L.die('work orders already exist; use a clean state or archive the current engagement');
  for (const work of wos) L.writeJson(L.path.join(L.P.workOrders, work.id + '.json'), work);
  L.ok(`wrote ${wos.length} draft work orders; Producer reviews and promotes them to ready`);
} else {
  L.info('dry run — add --write to emit work-order files');
}
