#!/usr/bin/env node
'use strict';
// Scaffold an isolated module.  Usage: node scaffold.js module <name> [--kind ui|feature|domain|data|platform|tokens|shell|util] [--platform ios|ipados|web] [--owner agent]
// Produces modules/<name>/ with module.json, README.md, src/index.<ext>, tests/, and a public-API contract.
const L = require('./lib');
const args = process.argv.slice(2);
if (args[0] !== 'module' || !args[1]) { console.log('Usage: node scaffold.js module <name> [--kind K] [--platform P] [--owner A]'); process.exit(2); }
const name = args[1]; const opt = (k, d) => { const i = args.indexOf('--' + k); return i > -1 ? args[i + 1] : d; };
const kind = opt('kind', 'feature'); const platform = opt('platform', 'web'); const owner = opt('owner', 'systems-architect');
if (!/^[a-z][a-z0-9-]*$/.test(name)) L.die('module name must be kebab-case');
const dir = L.path.join(L.P.modules, name); if (L.exists(dir)) L.die(`modules/${name} already exists`);
const ext = platform === 'web' ? 'ts' : 'swift';
const entry = `src/index.${ext}`;
const mod = { name, version: '0.1.0', kind, platforms: [platform], entry, owner, dependsOn: [], exports: [], status: 'stub', description: '' };
L.writeJson(L.path.join(dir, 'module.json'), mod);
L.fs.mkdirSync(L.path.join(dir, 'src'), { recursive: true }); L.fs.mkdirSync(L.path.join(dir, 'tests'), { recursive: true });
const tpl = f => L.fs.readFileSync(L.path.join(L.P.templates, 'module', f), 'utf8').replace(/\{\{name\}\}/g, name).replace(/\{\{kind\}\}/g, kind).replace(/\{\{platform\}\}/g, platform).replace(/\{\{owner\}\}/g, owner);
L.fs.writeFileSync(L.path.join(dir, 'README.md'), tpl('README.md'));
L.fs.writeFileSync(L.path.join(dir, 'CONTRACT.md'), tpl('CONTRACT.md'));
L.fs.writeFileSync(L.path.join(dir, entry), tpl(ext === 'ts' ? 'index.ts' : 'index.swift'));
L.fs.writeFileSync(L.path.join(dir, 'tests', `${name}.test.${ext === 'ts' ? 'ts' : 'swift'}`), tpl(ext === 'ts' ? 'test.ts' : 'test.swift'));
L.ok(`modules/${name} scaffolded (${kind}, ${platform}, owner ${owner})`);
L.info('next: fill CONTRACT.md, add exports to module.json, register dependsOn, run boundary-check.js');
