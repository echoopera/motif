#!/usr/bin/env node
'use strict';
// Ownership claims. A claim is a lock file naming who owns which paths right now.
// Usage: node claim.js claim <WO-###> <agent>
//        node claim.js release <WO-###> <agent>
//        node claim.js renew <WO-###> <agent>   — extend the TTL of a healthy long-running claim
//        node claim.js list
//        node claim.js check <agent> <path>    — may this agent write this path?
const L = require('./lib');
const [, , cmd, a, b] = process.argv;

const woFile = id => L.path.join(L.P.workOrders, id + '.json');
const claimFile = id => L.path.join(L.P.claims, id + '.json');
const active = () => L.listJson(L.P.claims).map(x => x.data);

function claim(id, agent) {
  if (!L.exists(woFile(id))) L.die(`no work order ${id}`);
  const wo = L.readJson(woFile(id));
  if (wo.owner !== agent) L.die(`${id} is owned by ${wo.owner}, not ${agent}`);
  if (!['ready', 'claimed', 'blocked'].includes(wo.status)) L.die(`${id} is ${wo.status}; only Producer can make it ready`);
  if (L.exists(claimFile(id))) { const c = L.readJson(claimFile(id)); if (c.agent !== agent) L.die(`${id} already claimed by ${c.agent}`); L.ok(`${id} already claimed by you`); return; }
  for (const c of active()) for (const g of c.owns) for (const h of wo.owns) if (L.globsOverlap(g, h)) L.die(`overlap: ${id}:${h} collides with ${c.wo}:${g} (held by ${c.agent})`);
  const ttl = wo.ttlMinutes || 240;
  const rec = { wo: id, agent, owns: wo.owns, claimedAt: L.nowIso(), expiresAt: new Date(Date.now() + ttl * 60000).toISOString() };
  const errs = L.validateAgainst('claim', rec); if (errs.length) L.die(errs.join('; '));
  L.writeJson(claimFile(id), rec);
  wo.status = 'claimed'; L.writeJson(woFile(id), wo);
  L.ok(`${agent} now owns ${wo.owns.join(', ')} via ${id} (ttl ${ttl}m)`);
}
function release(id, agent) {
  if (!L.exists(claimFile(id))) L.die(`${id} is not claimed`);
  const c = L.readJson(claimFile(id)); if (c.agent !== agent) L.die(`${id} is held by ${c.agent}`);
  L.fs.unlinkSync(claimFile(id));
  const wo = L.readJson(woFile(id)); if (wo.status === 'claimed') { wo.status = 'in-review'; L.writeJson(woFile(id), wo); }
  L.ok(`${id} released by ${agent}; status → ${wo.status}`);
}
function renew(id, agent) {
  if (!L.exists(claimFile(id))) L.die(`${id} is not claimed`);
  const c = L.readJson(claimFile(id)); if (c.agent !== agent) L.die(`${id} is held by ${c.agent}`);
  const ttl = (L.readJson(woFile(id)).ttlMinutes) || 240; c.expiresAt = new Date(Date.now() + ttl * 60000).toISOString(); L.writeJson(claimFile(id), c);
  L.ok(`${id} renewed for ${agent} until ${c.expiresAt}`);
}
function list() {
  const cs = active(); if (!cs.length) return console.log('no active claims');
  const now = Date.now();
  for (const c of cs) console.log(`${c.wo}  ${c.agent.padEnd(30)} ${c.owns.join(', ')}  ${new Date(c.expiresAt).getTime() < now ? '\x1b[33m[expired]\x1b[0m' : ''}`);
}
function check(agent, file) {
  const rel = L.path.relative(L.P.root, L.path.resolve(file)).replace(/\\/g, '/');
  const hit = active().find(c => c.agent === agent && c.owns.some(g => L.globMatch(g, rel)));
  if (hit) { L.ok(`${agent} may write ${rel} (${hit.wo})`); process.exit(0); }
  const other = active().find(c => c.owns.some(g => L.globMatch(g, rel)));
  L.die(other ? `${rel} is owned by ${other.agent} (${other.wo})` : `${rel} is unowned; claim a work order first`);
}

({ claim: () => claim(a, b), release: () => release(a, b), renew: () => renew(a, b), list, check: () => check(a, b) }[cmd] || (() => { console.log('Usage: claim|release|renew <WO> <agent> | list | check <agent> <path>'); process.exit(2); }))();
