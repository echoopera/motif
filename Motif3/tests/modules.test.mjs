import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { load } from './load.mjs';
const root = path.resolve(import.meta.dirname, '..');

test('motif5.html is built from src-v5', () => { execFileSync('python3', [path.join(root, 'src-v5/build.py'), '--check']); });

test('every module is wrapped and versioned', () => {
  for (const f of fs.readdirSync(path.join(root, 'src-v5/modules')).filter(f => /^\d\d[a-z]?-/.test(f))) {
    const s = fs.readFileSync(path.join(root, 'src-v5/modules', f), 'utf8');
    assert.match(s, /^\/\/ ---- (module: [\w-]+|boot)/, f);
  }
});

test('engine-core is deterministic', () => {
  const { __m_engine_core: E } = load('engine-core');
  assert.ok(E.mulberry32, 'exports mulberry32');
  const a = E.mulberry32(42), b = E.mulberry32(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('timeline sanitizes and round-trips a new project', () => {
  const m = load('tokens', 'engine-core', 'style-library', 'kit-gl', 'kits', 'colour', 'timeline');
  assert.ok(m.__m_timeline.newProject);
});

test('budgets.json is well formed', () => {
  const b = JSON.parse(fs.readFileSync(path.join(root, 'tools/budgets.json'), 'utf8'));
  assert.equal(typeof b.default, 'number'); assert.equal(typeof b.styles, 'object');
});
