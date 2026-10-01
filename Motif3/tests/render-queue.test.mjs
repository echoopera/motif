// Render queue logic against a fake backend and an in-memory store (no browser): ordering, pause/resume, cancel, retry, reload recovery.
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './load.mjs';
const m = load('tokens', 'engine-core', 'style-library', 'kit-gl', 'kits', 'colour', 'timeline', 'audio', 'gpu-engine', 'compositor', 'finish', 'renderer', 'exporter', 'render-queue');
const RQ = m.__m_render_queue, T = m.__m_timeline;
const project = () => { const p = T.newProject(); p.finish.loop = 1; p.output.fps = 24; return p; };
const fakeBlob = n => ({ size: n, type: 'video/mp4' });
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
const quiet = { update() {}, done() {}, request: async () => 'denied' };
const until = async (f, ms = 2000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) throw new Error('timeout'); await tick(2); } };

function mkQueue(store, backend) { const q = RQ.createQueue({ store, backend, notifier: quiet }); q.setProvider({ context: () => ({}) }); return q; }

test('presets resolve to export settings', () => {
  const ids = RQ.BUILTIN_PRESETS.map(p => p.id);
  assert.deepEqual([...ids], ['youtube-1080', 'hevc-4k', 'social-vertical', 'transparent-webm', 'png-sequence', 'master']);
  const pr = project();
  const yt = RQ.resolveSettings(RQ.BUILTIN_PRESETS[0], pr, '1x1'), vert = RQ.resolveSettings(RQ.BUILTIN_PRESETS[2], pr, '16x9'), master = RQ.resolveSettings(RQ.BUILTIN_PRESETS[5], pr, '4x5');
  assert.equal(yt.codec, 'avc'); assert.equal(yt.aspect, '16x9'); assert.equal(yt.fps, 24);
  assert.equal(vert.aspect, '9x16'); assert.equal(master.aspect, '4x5'); assert.equal(master.bitrateMbps, 100); assert.equal(master.tier, 2160);
  assert.equal(RQ.resolveSettings(RQ.BUILTIN_PRESETS[3], pr, '16x9').transparent, true);
  assert.equal(RQ.resolveSettings(RQ.BUILTIN_PRESETS[4], pr, '16x9').codec, undefined);
  assert.ok(RQ.estimateBytes(master, pr) > RQ.estimateBytes(yt, pr), 'master is larger than 1080p high');
  assert.equal(RQ.cleanPreset({ format: 'nope', tier: 99, loops: 100, codec: 'x' }).tier, 1080);
});

test('jobs render one at a time, in order, and outputs are stored', async () => {
  const store = RQ.memoryStore(); const order = []; let live = 0, maxLive = 0;
  const q = mkQueue(store, async (p, s, ctx) => { live++; maxLive = Math.max(maxLive, live); order.push(s.format + s.tier); for (let i = 1; i <= 4; i++) { await ctx.gate(); ctx.onProgress(i / 4, 'frame ' + i); await tick(2); } live--; return { blob: fakeBlob(1000), filename: 'a.mp4', codec: 'avc', stats: { fps: 9 } }; });
  await q.init(); const pr = project();
  await q.add(pr, 'youtube-1080'); await q.add(pr, 'hevc-4k'); await q.add(pr, 'png-sequence');
  await until(() => q.snapshot().jobs.every(j => j.status === 'done'));
  assert.deepEqual([...order], ['mp41080', 'mp42160', 'png-seq1080']); assert.equal(maxLive, 1);
  const s = q.snapshot(); assert.ok(s.jobs.every(j => j.output && j.output.size === 1000 && j.progress === 1));
  assert.equal(s.jobs[1].output.codec, 'H.264'); assert.equal(s.jobs[0].output.width, 1920);
  assert.equal((await q.output(s.jobs[0].id)).size, 1000);
  assert.equal((await store.all()).length, 3, 'persisted');
});

test('pause holds a running job at the gate and resume continues it', async () => {
  let frames = 0;
  const q = mkQueue(RQ.memoryStore(), async (p, s, ctx) => { for (let i = 1; i <= 10; i++) { await ctx.gate(); frames = i; ctx.onProgress(i / 10, ''); await tick(5); } return { blob: fakeBlob(5), filename: 'x.mp4' }; });
  await q.init(); await q.add(project(), 'youtube-1080');
  await until(() => frames >= 3); q.pause(); await tick(40); const at = frames; await tick(60);
  assert.equal(frames, at, 'no progress while paused'); assert.equal(q.snapshot().running.status, 'running'); assert.ok(q.snapshot().paused);
  q.resume(); await until(() => q.snapshot().jobs[0].status === 'done'); assert.equal(frames, 10);
});

test('cancel, error and retry', async () => {
  let fail = true;
  const q = mkQueue(RQ.memoryStore(), async (p, s, ctx) => { for (let i = 0; i < 50; i++) { await ctx.gate(); if (ctx.signal.aborted) { const e = new Error('Export cancelled'); e.name = 'AbortError'; throw e; } ctx.onProgress(i / 50, ''); await tick(5); if (fail && i === 3 && s.tier === 2160) throw new Error('encoder exploded'); } return { blob: fakeBlob(7), filename: 'y.mp4' }; });
  await q.init(); const pr = project();
  const a = await q.add(pr, 'youtube-1080'); const b = await q.add(pr, 'hevc-4k');
  await until(() => q.snapshot().running && q.snapshot().running.progress > 0.02); q.cancel(a);
  await until(() => q.snapshot().jobs.find(j => j.id === b).status === 'error');
  let s = q.snapshot(); assert.equal(s.jobs.find(j => j.id === a).status, 'cancelled'); assert.match(s.jobs.find(j => j.id === b).error, /exploded/);
  fail = false; q.retry(b); await until(() => q.snapshot().jobs.find(j => j.id === b).status === 'done');
  assert.equal(q.snapshot().jobs.find(j => j.id === b).attempts, 2);
  await q.remove(a); assert.equal(q.snapshot().jobs.length, 1);
});

test('reload: a running job becomes interrupted, queued jobs wait paused, retry finishes them', async () => {
  const store = RQ.memoryStore(); let stall = true;
  const q1 = mkQueue(store, async (p, s, ctx) => { ctx.onProgress(0.4, 'half'); await new Promise(() => {}); });
  await q1.init(); const pr = project(); await q1.add(pr, 'youtube-1080'); await q1.add(pr, 'social-vertical');
  await until(() => q1.snapshot().running && q1.snapshot().running.progress > 0.3); await tick(20);
  // "reload": a new queue over the same store; the old one is simply gone
  let ran = 0; const q2 = mkQueue(store, async () => { ran++; return { blob: fakeBlob(3), filename: 'r.mp4' }; });
  await q2.init(); const s = q2.snapshot();
  assert.deepEqual([...s.jobs.map(j => j.status)], ['interrupted', 'queued']); assert.ok(s.paused); assert.equal(s.pauseReason, 'reload'); assert.match(s.jobs[0].message, /Interrupted/);
  await tick(30); assert.equal(ran, 0, 'nothing starts by itself after a reload');
  q2.retry(s.jobs[0].id); q2.resume(); await until(() => q2.snapshot().jobs.every(j => j.status === 'done')); assert.equal(ran, 2);
});

test('the quick-export lock stops jobs from starting and refuses while one runs', async () => {
  let ran = 0; const q = mkQueue(RQ.memoryStore(), async () => { ran++; await tick(30); return { blob: fakeBlob(1), filename: 'l.mp4' }; });
  await q.init(); const unlock = q.lock(); assert.ok(unlock); await q.add(project(), 'youtube-1080'); await tick(30); assert.equal(ran, 0);
  unlock(); await until(() => ran === 1); assert.equal(q.lock(), null, 'locked out while a job renders'); await until(() => q.snapshot().jobs[0].status === 'done'); const u2 = q.lock(); assert.ok(u2); u2();
});
