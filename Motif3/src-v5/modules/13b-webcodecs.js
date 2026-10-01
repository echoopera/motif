// ---- module: webcodecs v1.0.0
const __m_webcodecs = (() => {
// webcodecs — frame-accurate, deterministic video decode for scrubbing and export seeking.
// MP4/MOV files are demuxed by the vendored mediabunny subset (vendor/mediabunny-lite.js, MPL-2.0) and decoded with the
// browser's WebCodecs VideoDecoder (hardware where the browser offers it). Decoded frames land in a small bounded ring of
// ImageBitmaps. `frameAt(t)` returns the frame whose presentation interval contains t: same t, same pixels, every time.
// Everything is optional: open() resolves null when WebCodecs, the container or the codec is unavailable, and the media
// store keeps using its <video> element. WebM stays on <video> (no Matroska demuxer is bundled).
const MAX_FRAMES = 12, MAX_BYTES = 256 * 1048576, WINDOW = 4, LOOKAHEAD = 2, IDLE_MS = 4000, EPS = 1e-6;
const supported = () => typeof VideoDecoder === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function' && typeof MediabunnyLite === 'object';
const PARITY_MAX = 2.5;                           // mean abs RGB difference (0-255) tolerated against the <video> frame
const live = { sessions: 0, bitmaps: 0, bytes: 0, rejected: 0, lastProbe: NaN };   // process-wide counters (tests and the Media page read these)

async function open(blob, opts = {}) {
  if (!supported()) return null;
  const maxFrames = opts.maxFrames || MAX_FRAMES, maxBytes = opts.maxBytes || MAX_BYTES;
  const { Input, BlobSource, Mp4InputFormat, QuickTimeInputFormat, VideoSampleSink, EncodedPacketSink } = MediabunnyLite;
  let input, track, sink, packets;
  try {
    input = new Input({ source: new BlobSource(blob), formats: [new Mp4InputFormat(), new QuickTimeInputFormat()] });
    track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) { input.dispose(); return null; }
    sink = new VideoSampleSink(track, { hardwareAcceleration: opts.hardware || 'no-preference' }); packets = new EncodedPacketSink(track);
  } catch (e) { try { input && input.dispose(); } catch (_) { /* nothing to free */ } return null; }

  const first = await input.getFirstTimestamp([track]);
  let dur = 0; try { dur = await input.computeDuration([track]); } catch (e) { /* metadata fallback below */ }
  const w = await track.getDisplayWidth(), h = await track.getDisplayHeight(), codec = (await track.getCodec()) || '';
  let fps = 0; try { fps = (await track.computePacketStats(120)).averagePacketRate || 0; } catch (e) { /* unknown */ }
  const canvas = new OffscreenCanvas(w, h), ctx = canvas.getContext('2d', { alpha: false });
  const streamEnd = dur, frameBytes = w * h * 4;
  const ring = [];                                 // { ts, end, bitmap, tick } sorted by ts
  let tick = 0, pinned = null, cursor = null, idle = 0, queue = Promise.resolve(), disposed = false, decodes = 0, restarts = 0;
  live.sessions++;

  const covers = (e, t) => t >= e.ts - EPS && t < e.end - EPS;
  function remember(sample) {
    const dup = ring.find(e => Math.abs(e.ts - sample.timestamp) < EPS); if (dup) { dup.tick = ++tick; return dup; }
    sample.draw(ctx, 0, 0, w, h);                // rotation, flip and pixel aspect applied by the sample
    const bitmap = canvas.transferToImageBitmap();
    const e = { ts: sample.timestamp, end: sample.timestamp + (sample.duration || 1 / (fps || 30)), bitmap, tick: ++tick };
    ring.push(e); ring.sort((a, b) => a.ts - b.ts); live.bitmaps++; live.bytes += frameBytes;
    trim(); return e;
  }
  function drop(e) { const i = ring.indexOf(e); if (i >= 0) ring.splice(i, 1); try { e.bitmap.close(); } catch (_) { /* already closed */ } live.bitmaps--; live.bytes -= frameBytes; }
  function trim() { while (ring.length > maxFrames || ring.length * frameBytes > maxBytes) { const v = ring.filter(e => e !== pinned).sort((a, b) => a.tick - b.tick)[0]; if (!v) break; drop(v); } }
  const closeCursor = () => { if (cursor) { const c = cursor; cursor = null; try { c.pending && c.pending.close(); c.it.return(); } catch (_) { /* generator finished */ } } clearTimeout(idle); };
  const armIdle = () => { clearTimeout(idle); idle = setTimeout(closeCursor, IDLE_MS); };

  // Sequential path: advance an open sample iterator while t moves forward within LOOKAHEAD seconds (export, playback).
  async function advance(t) {
    const c = cursor; let best = null;
    for (;;) {
      let s = c.pending; c.pending = null;
      if (!s) { const r = await c.it.next(); if (r.done) { if (cursor === c) cursor = null; break; } s = r.value; decodes++; }
      if (s.timestamp <= t + EPS) { if (best) best.close(); best = s; c.last = s.timestamp; }
      else { c.pending = s; break; }
    }
    if (!best) return null;
    const e = remember(best); best.close(); return e;
  }
  // Random access: decode from the keyframe through t, keeping the last WINDOW frames so short backward steps hit the ring.
  async function restart(t) {
    closeCursor(); restarts++;
    const kp = await packets.getKeyPacket(t, { metadataOnly: true }), from = kp ? kp.timestamp : first;
    cursor = { it: sink.samples(from), pending: null, last: from };
    const win = []; let ans = null;
    for (;;) {
      const r = await cursor.it.next(); if (r.done) { cursor = null; break; } const s = r.value; decodes++;
      if (s.timestamp <= t + EPS) { win.push(s); if (win.length > WINDOW) win.shift().close(); cursor.last = s.timestamp; }
      else { cursor.pending = s; break; }
    }
    if (!win.length && cursor && cursor.pending) { win.push(cursor.pending); cursor.pending = null; }   // t precedes the first sample: show it
    for (const s of win) { const e = remember(s); if (s === win[win.length - 1]) ans = e; s.close(); }
    return ans;
  }
  async function locate(t) {
    t = Math.max(first, t); clearTimeout(idle);   // the idle release must never fire in the middle of a decode
    let e = ring.find(x => covers(x, t));
    if (!e) {
      if (cursor && t >= cursor.last - EPS && t - cursor.last < LOOKAHEAD) e = await advance(t);
      if (!e) e = await restart(t);
    }
    if (!e) throw new Error('No frame at ' + t);
    // A decoder that stops early must never pass a stale frame off as the requested one: callers fall back to <video>.
    if (t < streamEnd - 1 / (fps || 30) && !covers(e, t)) { closeCursor(); throw new Error(`Decoder returned frame ${e.ts} for ${t}`); }
    e.tick = ++tick; pinned = e; armIdle(); return e;
  }
  // frameAt(t): exact. Requests are serialised; resolves { bitmap, ts, end } (bitmap stays valid until the NEXT frameAt/scrub resolves).
  function frameAt(t) {
    if (disposed) return Promise.reject(new Error('decoder closed'));
    const p = queue.then(() => disposed ? Promise.reject(new Error('decoder closed')) : locate(t));
    queue = p.catch(() => {});
    return p.then(e => ({ bitmap: e.bitmap, ts: e.ts, end: e.end }));
  }
  // scrub(t): coalescing variant for pointer scrubbing. Only the newest target is decoded; superseded calls resolve null.
  let want = null, running = null;
  function scrub(t) {
    const mine = want = { t };
    if (!running) running = (async () => {
      let out = null;
      while (want) { const cur = want; want = null; try { out = { cur, f: await frameAt(cur.t) }; } catch (e) { out = { cur, f: null }; } if (want) continue; }
      running = null; return out;
    })();
    return running.then(r => (r && r.cur === mine ? r.f : null));
  }
  function stats() { return { frames: ring.length, bytes: ring.length * frameBytes, cursor: !!cursor, decodes, restarts, w, h, maxFrames }; }
  function dispose() {
    if (disposed) return; disposed = true; closeCursor(); pinned = null; while (ring.length) drop(ring[0]);
    try { input.dispose(); } catch (_) { /* nothing to free */ } live.sessions--;
  }
  const api = { w, h, dur: Math.max(0, dur - first), first, fps, codec, frameAt, scrub, stats, dispose, release: closeCursor };
  // Parity probe: the preview plays through a <video>, so a decoder that disagrees with it (untagged colour matrix, rotation,
  // pixel aspect) would make scrubbed and exported frames differ from playback. Compare one frame; reject on a visible gap.
  if (opts.reference) {
    let diff = Infinity;
    try {
      const v = opts.reference, f = await frameAt(v.currentTime || first), W = 32, H = Math.max(8, Math.round(W * v.videoHeight / v.videoWidth));
      const c1 = new OffscreenCanvas(W, H), c2 = new OffscreenCanvas(W, H), x1 = c1.getContext('2d', { willReadFrequently: true }), x2 = c2.getContext('2d', { willReadFrequently: true });
      x1.drawImage(v, 0, 0, W, H); x2.drawImage(f.bitmap, 0, 0, W, H);
      const a = x1.getImageData(0, 0, W, H).data, b = x2.getImageData(0, 0, W, H).data; let sum = 0, n = 0;
      for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) { sum += Math.abs(a[i + k] - b[i + k]); n++; }
      diff = sum / n;
    } catch (e) { /* treated as a mismatch */ }
    live.lastProbe = diff;
    if (!(diff < PARITY_MAX)) { live.rejected++; api.dispose(); return null; }
  }
  return api;
}

return { open, supported, live };

})();
