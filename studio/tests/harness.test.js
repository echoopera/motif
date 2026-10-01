'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const L = require('../harness/scripts/lib');

const ROOT = path.resolve(__dirname, '..');

test('ownership overlap detection is conservative at path boundaries', () => {
  assert.equal(L.globsOverlap('modules/web-*/src/**', 'modules/web-saas-*/src/**'), true);
  assert.equal(L.globsOverlap('modules/web-product-*/src/**', 'modules/web-saas-*/src/**'), false);
  assert.equal(L.globsOverlap('design/app/screens/ios/**', 'design/app/screens/ipados/**'), false);
  assert.equal(L.globsOverlap('modules/*/module.json', 'modules/web-shell/src/**'), false);
});

test('brief schema rejects unsupported platforms and accepts the golden brief', () => {
  const golden = L.readJson(path.join(ROOT, 'examples/golden-brief.json'));
  assert.deepEqual(L.validateAgainst('brief', golden), []);
  const bad = JSON.parse(JSON.stringify(golden));
  bad.platforms = ['unknown-platform'];
  assert.ok(L.validateAgainst('brief', bad).length > 0);
});

test('planner produces a valid dependency graph for the golden brief', () => {
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'harness/scripts/plan.js'),
    path.join(ROOT, 'examples/golden-brief.json')
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /work orders: no overlaps, cycles or duplicate outputs/);
});

test('registry is unique and every canonical agent file exists', () => {
  const registry = L.readJson(path.join(ROOT, 'agents/registry.json'));
  const ids = registry.agents.map(a => a.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const agent of registry.agents) {
    const file = path.join(ROOT, agent.path);
    assert.equal(fs.existsSync(file), true, agent.path);
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, new RegExp(`(?:name: ${agent.id}\\b|Agent ID: [^\\n]*\\b${agent.id}\\b)`), agent.path);
  }
});

test('markdown file links are local and resolve', () => {
  const markdown = L.walk(ROOT).filter(file => file.endsWith('.md'));
  const link = /\[[^\]]+\]\(([^)]+)\)/g;
  for (const file of markdown) {
    const source = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = link.exec(source))) {
      const target = match[1].split('#')[0];
      assert.equal(/^https?:\/\//.test(target), false, `remote link in ${path.relative(ROOT, file)}`);
      if (!target || target.includes('<')) continue;
      assert.equal(fs.existsSync(path.resolve(path.dirname(file), target)), true, `broken link ${target} in ${path.relative(ROOT, file)}`);
    }
  }
});

