// ---- module: exporter v2.0.0
const __m_exporter = (() => {
// exporter — frame-accurate renders of a v2 project to MP4 / WebM (WebCodecs + muxers) with
// colour-space tags and optional audio, PNG sequence ZIP, single PNG and preset@2 JSON.
// Imports preset@1 (v1 looks) and preset@2. Uses globals Mp4Muxer, WebMMuxer and fflate.
const { exportSize, frameCount, frameTime } = __m_renderer;
const { getStyle } = __m_style_library;
const { makeCanvas } = __m_engine_core;
const { FORMAT, sanitizeProject, fromV1, clone } = __m_timeline;
const { spaceById, sanitizeCustom } = __m_colour;
const { sliceBuffer } = __m_audio;
const V1_FORMAT = 'motif-style-lab/preset@1';
const TIERS = [720, 1080, 1440, 2160];
const FPS = [24, 25, 30, 50, 60];

const g = typeof globalThis !== 'undefined' ? globalThis : window;
let capsPromise = null;
async function supported(cfg) { try { const r = await g.VideoEncoder.isConfigSupported(cfg); return !!r.supported; } catch (e) { return false; } }
async function audioSupported(cfg) { try { const r = await g.AudioEncoder.isConfigSupported(cfg); return !!r.supported; } catch (e) { return false; } }

function probeCapabilities() {
  if (capsPromise) return capsPromise;
  capsPromise = (async () => {
    const caps = { webcodecs: typeof g.VideoEncoder === 'function' && typeof g.VideoFrame === 'function', mp4: null, webm: null, webmAlpha: false, recorder: typeof g.MediaRecorder === 'function', zip: !!g.fflate, muxers: !!g.Mp4Muxer && !!g.WebMMuxer, aac: false, opus: false, p3: false };
    if (caps.webcodecs && caps.muxers) {
      const base = { width: 1920, height: 1080, bitrate: 12e6, framerate: 30 };
      for (const c of ['avc1.640033', 'avc1.4d0033', 'avc1.42e033']) if (await supported({ ...base, codec: c })) { caps.mp4 = c; break; }
      for (const c of ['vp09.00.41.08', 'vp8']) if (await supported({ ...base, codec: c })) { caps.webm = c; break; }
      if (caps.webm) caps.webmAlpha = await supported({ ...base, codec: caps.webm, alpha: 'keep' });
    }
    if (typeof g.AudioEncoder === 'function') {
      caps.aac = await audioSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 });
      caps.opus = await audioSupported({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 });
    }
    try { caps.p3 = document.createElement('canvas').getContext('2d', { colorSpace: 'display-p3' }).getContextAttributes().colorSpace === 'display-p3'; } catch (e) { caps.p3 = false; }
    return caps;
  })();
  return capsPromise;
}

function slug(project) { return project.layers.map(l => l.styleId).join('+').slice(0, 60); }
function fileName(project, s, ext) {
  const { w, h } = exportSize(s.aspect, s.tier);
  const sp = project.output.space === 'srgb' ? '' : `-${project.output.space}`;
  return `motif-${slug(project)}-${s.aspect}-${w}x${h}${ext === 'png' || ext === 'json' ? '' : `-${s.fps}fps`}${ext === 'json' ? '' : sp}.${ext}`;
}
function presetJSON(project, aspect) {
  const p = clone(project); delete p.active;
  return JSON.stringify({ format: FORMAT, styles: project.layers.map(l => getStyle(l.styleId).name), aspect, project: p }, null, 2);
}
function parsePreset(text) {
  let data; try { data = JSON.parse(text); } catch (e) { throw new Error('it isn’t valid JSON'); }
  if (data && data.format === V1_FORMAT && data.look && data.look.styleId) return fromV1(data.look, data.aspect);
  if (data && data.format === FORMAT && data.project) return { project: sanitizeProject(data.project, sanitizeCustom), aspect: data.aspect || '16x9' };
  throw new Error('the format tag is missing or unknown');
}

const tick = (() => { try { const ch = new MessageChannel(), q = []; ch.port1.onmessage = () => { const f = q.shift(); f && f(); }; return () => new Promise(r => { q.push(r); ch.port2.postMessage(0); }); } catch (e) { return () => new Promise(r => setTimeout(r, 0)); } })();
// Media hook for the export in progress: awaited before each frame (loads assets, seeks videos to that frame).
let mediaPrep = null;
// One frame, rendered in short slices so Cancel is honoured within ~100 ms even for very heavy frames.
async function frameCoop(pipeline, ctx, w, h, project, t, ropts, job, signal) {
  if (mediaPrep) { await mediaPrep(project, t); if (signal && signal.aborted) throw abortErr(); }
  if (!job) { if (signal && signal.aborted) throw abortErr(); return pipeline.renderFrame(ctx, w, h, project, t, ropts); }
  job.begin();
  try {
    for (;;) {
      if (signal && signal.aborted) throw abortErr();
      job.arm();
      try { return pipeline.renderFrame(ctx, w, h, project, t, { ...ropts, job }); }
      catch (e) { if (!(e && e.isSuspend)) throw e; await tick(); }
    }
  } finally { job.end(); }
}
// RGBA (straight alpha) → I420 / I420A planes with BT.709 coefficients, limited or full range.
function toI420(rgba, w, h, fullRange, withAlpha) {
  const Kr = 0.2126, Kb = 0.0722, Kg = 1 - Kr - Kb;
  const yS = fullRange ? 255 : 219, yO = fullRange ? 0 : 16, cS = fullRange ? 255 : 224;
  const cw = w >> 1, ch = h >> 1, ySize = w * h, cSize = cw * ch;
  const out = new Uint8Array(ySize + 2 * cSize + (withAlpha ? ySize : 0));
  const U = ySize, V = ySize + cSize, A = ySize + 2 * cSize;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; out[y * w + x] = yO + yS * (Kr * rgba[i] + Kg * rgba[i + 1] + Kb * rgba[i + 2]) / 255 + 0.5; if (withAlpha) out[A + y * w + x] = rgba[i + 3]; }
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const i = ((2 * y + dy) * w + 2 * x + dx) * 4; r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; }
    r /= 1020; g /= 1020; b /= 1020; const Y = Kr * r + Kg * g + Kb * b;
    out[U + y * cw + x] = Math.max(0, Math.min(255, 128 + cS * (b - Y) / (2 * (1 - Kb)) + 0.5));
    out[V + y * cw + x] = Math.max(0, Math.min(255, 128 + cS * (r - Y) / (2 * (1 - Kr)) + 0.5));
  }
  return out;
}
const abortErr = () => { const e = new Error('Export cancelled'); e.name = 'AbortError'; return e; };
function makeExportCanvas(w, h, space) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { colorSpace: spaceById(space).canvas, willReadFrequently: true, alpha: true });
  return { c, ctx };
}

// Resample to 48 kHz stereo for the encoders.
async function audioFor(buffer, start, dur) {
  const sl = sliceBuffer(buffer, start, dur);
  const OAC = g.OfflineAudioContext || g.webkitOfflineAudioContext;
  const frames = Math.ceil(dur * 48000);
  const oac = new OAC(2, frames, 48000); const b = oac.createBuffer(sl.channels.length, sl.frames, sl.sampleRate);
  sl.channels.forEach((d, i) => b.copyToChannel(d, i));
  const src = oac.createBufferSource(); src.buffer = b; src.connect(oac.destination); src.start();
  const out = await oac.startRendering();
  return [out.getChannelData(0), out.getChannelData(out.numberOfChannels > 1 ? 1 : 0)];
}

// Browsers without a WebCodecs AAC encoder (some Chromium/Electron builds) would otherwise get Opus inside the MP4, which
// QuickTime, Resolve and most editors ignore. Fall back to FDK-AAC (WebAssembly) so MP4 always carries playable AAC.
let fdkP = null;
function loadFdk() {
  if (!fdkP) fdkP = import('https://cdn.jsdelivr.net/npm/@audio/encode-aac@1.2.1/aac-encode.js').then(m => m.default).catch(() => null);
  return fdkP;
}
function aacAsc(desc) { // bare AudioSpecificConfig from a description that may be an ASC or a full MPEG-4 ES_Descriptor
  const fallback = new Uint8Array([0x11, 0x90]); if (!desc) return fallback;
  const d = new Uint8Array(desc.buffer ? desc.buffer.slice(desc.byteOffset, desc.byteOffset + desc.byteLength) : desc);
  if (d.length > 2 && d[0] === 0x03) {
    let o = 0;
    while (o < d.length - 1) {
      const tag = d[o++]; let len = 0, b; do { b = d[o++]; len = (len << 7) | (b & 0x7f); } while ((b & 0x80) && o < d.length);
      if (tag === 0x03) o += 3; else if (tag === 0x04) o += 13; else if (tag === 0x05) return d.slice(o, o + len); else o += len;
    }
    return fallback;
  }
  return d.length >= 2 ? d : fallback;
}
function splitAdts(u8) { // → raw AAC access units
  const out = []; let o = 0;
  while (o + 7 <= u8.length && u8[o] === 0xFF && (u8[o + 1] & 0xF0) === 0xF0) {
    const len = ((u8[o + 3] & 3) << 11) | (u8[o + 4] << 3) | (u8[o + 5] >> 5), hdr = (u8[o + 1] & 1) ? 7 : 9;
    if (len < hdr || o + len > u8.length) break; out.push(u8.slice(o + hdr, o + len)); o += len;
  }
  return out;
}
async function encodeVideo(pipeline, project, s, caps, env, audio, onProgress, signal, job) {
  const { w, h } = exportSize(s.aspect, s.tier); const N = frameCount(project, s.fps, s.loops);
  const isMp4 = s.format === 'mp4', alpha = !isMp4 && s.transparent && caps.webmAlpha;
  const space = spaceById(project.output.space);
  const { c: canvas, ctx } = makeExportCanvas(w, h, space.id);
  const M = isMp4 ? g.Mp4Muxer : g.WebMMuxer;
  const fdk = audio && isMp4 && !caps.aac ? await loadFdk() : null;
  const acodec = audio ? (isMp4 ? ((caps.aac || fdk) ? 'aac' : caps.opus ? 'opus' : null) : (caps.opus ? 'opus' : null)) : null;
  const muxOpts = isMp4
    ? { target: new M.ArrayBufferTarget(), video: { codec: 'avc', width: w, height: h, frameRate: s.fps }, fastStart: 'in-memory', ...(acodec ? { audio: { codec: acodec, sampleRate: 48000, numberOfChannels: 2 } } : {}) }
    : { target: new M.ArrayBufferTarget(), video: { codec: caps.webm === 'vp8' ? 'V_VP8' : 'V_VP9', width: w, height: h, frameRate: s.fps, alpha }, ...(acodec ? { audio: { codec: 'A_OPUS', sampleRate: 48000, numberOfChannels: 2 } } : {}) };
  const muxer = new M.Muxer(muxOpts);
  let failure = null, reportedSpace = null;
  const enc = new g.VideoEncoder({ output: (chunk, meta) => { if (meta && meta.decoderConfig) { reportedSpace = meta.decoderConfig.colorSpace || null; meta = { ...meta, decoderConfig: { ...meta.decoderConfig, colorSpace: { ...space.video } } }; } muxer.addVideoChunk(chunk, meta); }, error: e => { failure = e; } });
  enc.configure({ codec: isMp4 ? caps.mp4 : caps.webm, width: w, height: h, bitrate: Math.round(w * h * s.fps * ({ standard: 0.3, high: 0.55, max: 1.0 }[s.quality] || 0.55)), framerate: s.fps, latencyMode: /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ? 'realtime' : 'quality', ...(alpha ? { alpha: 'keep' } : {}), ...(isMp4 ? { avc: { format: 'avc' } } : {}) });
  const ropts = { transparent: !isMp4 && s.transparent, env, space: space.id };
  g.__exportTiming = null;
  await frameCoop(pipeline, ctx, w, h, project, 0, ropts, job, signal); // warm-up: scratch canvases settle before frame 0
  for (let i = 0; i < N; i++) {
    if (signal && signal.aborted) { try { enc.close(); } catch (e) { /* closed */ } throw abortErr(); }
    if (failure) throw failure;
    const T0 = performance.now();
    await frameCoop(pipeline, ctx, w, h, project, frameTime(project, s.fps, i), ropts, job, signal);
    const T1 = performance.now();
    const img = ctx.getImageData(0, 0, w, h);
    const T2 = performance.now();
    const yuv = toI420(img.data, w, h, space.video.fullRange, alpha);
    const T3 = performance.now();
    const frame = new g.VideoFrame(yuv, { format: alpha ? 'I420A' : 'I420', codedWidth: w, codedHeight: h, timestamp: Math.round((i * 1e6) / s.fps), duration: Math.round(1e6 / s.fps), colorSpace: space.video });
    enc.encode(frame, { keyFrame: i % (s.fps * 2) === 0 }); frame.close();
    const T4 = performance.now();
    // Bounded backpressure: some encoders (Safari's) hold frames until more arrive, so never wait on the queue forever.
    for (let w0 = performance.now(); enc.encodeQueueSize > 4 && (enc.encodeQueueSize > 40 ? performance.now() - w0 < 20000 : performance.now() - w0 < 30); ) { if (signal && signal.aborted) break; if (failure) throw failure; await tick(); }
    if (enc.encodeQueueSize > 40) throw new Error('The video encoder stopped responding. Try WebM, or a smaller size.');
    const T5 = performance.now();
    const tm = (g.__exportTiming = g.__exportTiming || { n: 0, draw: 0, read: 0, conv: 0, enc: 0, wait: 0 });
    tm.n++; tm.draw += T1 - T0; tm.read += T2 - T1; tm.conv += T3 - T2; tm.enc += T4 - T3; tm.wait += T5 - T4;
    const av = k => Math.round(tm[k] / tm.n);
    onProgress && onProgress((i + 1) / N * (acodec ? 0.95 : 1), `Rendering frame ${i + 1} of ${N} · draw ${av('draw')} ms · read ${av('read')} · convert ${av('conv')} · encode ${av('enc') + av('wait')}`);
    if (i % 3 === 0) await tick();
  }
  onProgress && onProgress(acodec ? 0.95 : 1, 'Finishing video');
  await enc.flush(); enc.close(); if (failure) throw failure;
  let audioNote = '';
  if (audio && acodec) {
    onProgress && onProgress(0.96, 'Encoding audio');
    const [L, R] = await audioFor(audio.buffer, audio.offset, N / s.fps);
    let aerr = null, achunks = 0;
    if (fdk) {
      const fe = await fdk({ sampleRate: 48000, channels: 2, bitrate: 192 }), parts = [];
      for (let off = 0; off < L.length; off += 48000) { parts.push(await fe.encode([L.subarray(off, off + 48000), R.subarray(off, off + 48000)])); if (signal && signal.aborted) throw abortErr(); }
      parts.push(await fe.flush());
      const all = new Uint8Array(parts.reduce((n, a) => n + a.length, 0)); let po = 0; for (const a of parts) { all.set(a, po); po += a.length; }
      const skip = Math.round((fe.priming || 2048) / 1024), frames = splitAdts(all).slice(skip);
      const meta = { decoderConfig: { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, description: new Uint8Array([0x11, 0x90]) } };
      frames.forEach((f, k) => { muxer.addAudioChunkRaw(f, 'key', Math.round(k * 1024 / 48000 * 1e6), Math.round(1024 / 48000 * 1e6), k === 0 ? meta : undefined); achunks++; });
      if (!achunks) throw new Error('AAC encoding produced no data.');
    } else {
    // Errors thrown inside an encoder output callback never reach the encoder's error handler, so catch them here;
    // otherwise the muxer silently ends up with an empty audio track and the file plays without sound.
    let akey = 0;
    const onAudio = (chunk, meta) => {
      try {
        if (acodec !== 'aac') { muxer.addAudioChunk(chunk, meta); achunks++; return; }
        // AAC for MP4 must be raw access units plus a bare 2-byte AudioSpecificConfig. Some encoders (Safari/WebKit) hand back
        // ADTS framing and/or a whole MPEG-4 ES_Descriptor as the description, which the muxer would embed verbatim and
        // QuickTime then reads as garbage (silent file). Normalise both, and space timestamps evenly (1024 samples/frame).
        let raw = new Uint8Array(chunk.byteLength); chunk.copyTo(raw);
        if (raw.length > 7 && raw[0] === 0xFF && (raw[1] & 0xF0) === 0xF0) raw = raw.slice((raw[1] & 1) ? 7 : 9);
        let m;
        if (akey === 0) m = { decoderConfig: { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, description: aacAsc(meta && meta.decoderConfig && meta.decoderConfig.description) } };
        muxer.addAudioChunkRaw(raw, 'key', Math.round(akey * 1024 / 48000 * 1e6), Math.round(1024 / 48000 * 1e6), m); akey++; achunks++;
      } catch (e) { if (!aerr) aerr = e; }
    };
    const aenc = new g.AudioEncoder({ output: onAudio, error: e => { aerr = e; } });
    aenc.configure({ codec: acodec === 'aac' ? 'mp4a.40.2' : 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: acodec === 'aac' ? 192000 : 160000, ...(acodec === 'aac' ? { aac: { format: 'aac' } } : {}) });
    const block = 4800;
    for (let off = 0; off < L.length; off += block) {
      const n = Math.min(block, L.length - off), data = new Float32Array(n * 2); data.set(L.subarray(off, off + n), 0); data.set(R.subarray(off, off + n), n);
      const ad = new g.AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((off / 48000) * 1e6), data });
      aenc.encode(ad); ad.close(); if (aerr) throw aerr;
    }
    await aenc.flush(); aenc.close();
    if (aerr) throw new Error('Audio encoding failed: ' + (aerr.message || aerr));
    if (!achunks) throw new Error('Audio encoding produced no data, so the file would be silent. Try WebM, or another browser.');
    }
  } else if (audio && !acodec) audioNote = ' This browser has no audio encoder, so the file is silent.';
  if (acodec === 'opus' && isMp4) audioNote += ' MP4 audio is Opus, which QuickTime and many editors will not play; use WebM or a browser with AAC.';
  muxer.finalize();
  const v = space.video, tag = `${v.primaries}/${v.transfer}/${v.matrix}/${v.fullRange ? 'full' : 'limited'}`;
  const encTag = reportedSpace ? `${reportedSpace.primaries}/${reportedSpace.transfer}/${reportedSpace.matrix}/${reportedSpace.fullRange ? 'full' : 'limited'}` : 'none';
  return { blob: new Blob([muxer.target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' }), note: audioNote.trim(), colorTag: tag, encoderTag: encTag, audio: !!acodec, audioCodec: acodec ? (acodec === 'aac' ? 'AAC' : 'Opus') : null };
}

async function canvasPng(canvas) { return new Promise(r => canvas.toBlob(r, 'image/png')); }
async function pngSequence(pipeline, project, s, env, onProgress, signal, job) {
  const { w, h } = exportSize(s.aspect, s.tier); const N = frameCount(project, s.fps, s.loops);
  const { c: canvas, ctx } = makeExportCanvas(w, h, project.output.space); const files = {};
  const pad = Math.max(4, String(N).length); const base = slug(project).replace(/\+/g, '_');
  await frameCoop(pipeline, ctx, w, h, project, 0, { transparent: s.transparent, env }, job, signal);
  for (let i = 0; i < N; i++) {
    if (signal && signal.aborted) throw abortErr();
    await frameCoop(pipeline, ctx, w, h, project, frameTime(project, s.fps, i), { transparent: s.transparent, env }, job, signal);
    files[`${base}_${String(i).padStart(pad, '0')}.png`] = [new Uint8Array(await (await canvasPng(canvas)).arrayBuffer()), { level: 0 }];
    onProgress && onProgress((i + 1) / N, `Rendering frame ${i + 1} of ${N}`);
  }
  onProgress && onProgress(1, 'Packing ZIP'); await tick();
  return new Blob([g.fflate.zipSync(files)], { type: 'application/zip' });
}

// Run one export. s: { format, aspect, tier, fps, loops, transparent, time, withAudio }.
// ctx: { pipeline, env, audio: { buffer, offset } | null, onProgress, signal }. Returns { blob, filename, note, colorTag }.
async function runExport(project, s, ctx = {}) {
  mediaPrep = ctx.media && ctx.media.prepare ? ctx.media.prepare : null;
  try { return await runExportInner(project, s, ctx); }
  finally { mediaPrep = null; if (ctx.media && ctx.media.release) ctx.media.release(); }
}
async function runExportInner(project, s, { pipeline, env, audio, onProgress, signal, job } = {}) {
  const caps = await probeCapabilities();
  project = { ...project, output: { ...project.output, fps: s.fps || project.output.fps } };
  if (s.format === 'json') return { blob: new Blob([presetJSON(project, s.aspect)], { type: 'application/json' }), filename: `motif-${slug(project)}-preset.json` };
  if (s.format === 'png') {
    const { w, h } = exportSize(s.aspect, s.tier); const { c, ctx } = makeExportCanvas(w, h, project.output.space);
    await frameCoop(pipeline, ctx, w, h, project, s.time || 0, { transparent: s.transparent, env }, job, signal);
    return { blob: await canvasPng(c), filename: fileName(project, s, 'png') };
  }
  if (s.format === 'png-seq') {
    if (!caps.zip) throw new Error('The ZIP library did not load. Check your connection and reload.');
    return { blob: await pngSequence(pipeline, project, s, env, onProgress, signal, job), filename: fileName(project, s, 'zip') };
  }
  const want = s.format === 'mp4' ? caps.mp4 : caps.webm;
  if (caps.webcodecs && caps.muxers && want) {
    const r = await encodeVideo(pipeline, project, s, caps, env, s.withAudio ? audio : null, onProgress, signal, job);
    const alphaNote = s.format === 'webm' && s.transparent && !caps.webmAlpha ? 'This browser can’t encode alpha, so the background was kept.' : '';
    return { blob: r.blob, filename: fileName(project, s, s.format), note: [alphaNote, r.note].filter(Boolean).join(' '), colorTag: r.colorTag, encoderTag: r.encoderTag, audio: r.audio, audioCodec: r.audioCodec };
  }
  throw new Error(`This browser can’t encode ${s.format === 'mp4' ? 'H.264' : 'VP9'}. Try ${s.format === 'mp4' ? 'WebM' : 'PNG sequence'}.`);
}

return { FORMAT, TIERS, FPS, probeCapabilities, fileName, presetJSON, parsePreset, runExport };

})();

