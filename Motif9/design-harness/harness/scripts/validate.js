#!/usr/bin/env node
'use strict';
// Usage: node validate.js <schema> <file.json> [more files...]
//        node validate.js all      — validates every work order, claim, module.json and DDM in state
const L = require('./lib');
const [, , schema, ...files] = process.argv;

function run(schemaName, file) {
  const errs = L.validateAgainst(schemaName, L.readJson(file));
  if (errs.length) { L.fail(`${L.path.relative(L.P.root, file)} (${schemaName})`); errs.forEach(L.info); return false; }
  L.ok(`${L.path.relative(L.P.root, file)} (${schemaName})`); return true;
}

let allOk = true;
if (schema === 'all') {
  for (const w of L.listJson(L.P.workOrders)) allOk &= run('work-order', w.file);
  for (const w of L.listJson(L.P.claims)) allOk &= run('claim', w.file);
  for (const w of L.listJson(L.P.ddm)) allOk &= run('ddm', w.file);
  for (const f of L.walk(L.P.modules).filter(f => f.endsWith('module.json'))) allOk &= run('module', f);
} else if (schema && files.length) {
  for (const f of files) allOk &= run(schema, L.path.resolve(f));
} else {
  console.log('Usage: node validate.js <brief|work-order|claim|module|ddm> <file.json>... | node validate.js all');
  process.exit(2);
}
process.exit(allOk ? 0 : 1);
