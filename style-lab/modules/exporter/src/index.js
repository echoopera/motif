// exporter — frame-accurate renders to MP4 / WebM (WebCodecs + muxers), PNG sequence ZIP,
// single PNG and preset JSON. Uses globals Mp4Muxer, WebMMuxer and fflate when present.
import { renderFrame, exportSize, frameCount } from '@modules/renderer';
import { sanitizeLook, getStyle } from '@modules/style-library';
import { makeCanvas } from '@modules/engine-core';

export const PRESET_FORMAT = 'motif-style-lab/preset@1';
export const TIERS = [720, 1080, 1440];
export const FPS = [24, 30, 60];

const g = typeof globalThis !== 'undefined' ? globalThis : window;
let capsPromise = null;

async function supported(cfg) {
  try { const r = await g.VideoEncoder.isConfigSupported(cfg); return !!r.supported; } catch (e) { return false; }
}

// Probe once: which encoders this browser offers.
export function probeCapabilities() {
  if (capsPromise) return capsPromise;
  capsPromise = (async () => {
    const caps = { webcodecs: typeof g.VideoEncoder === 'function' && typeof g.VideoFrame === 'function', mp4: null, webm: null, webmAlpha: false, recorder: typeof g.MediaRecorder === 'function', zip: !!g.fflate, muxers: !!g.Mp4Muxer && !!g.WebMMuxer };
    if (caps.webcodecs && caps.muxers) {
      const base = { width: 1920, height: 1080, bitrate: 12e6, framerate: 30 };
      for (const c of ['avc1.640033', 'avc1.4d0033', 'avc1.42e033']) if (await supported({ ...base, codec: c })) { caps.mp4 = c; break; }
      for (const c of ['vp09.00.41.08', 'vp8']) if (await supported({ ...base, codec: c })) { caps.webm = c; break; }
      if (caps.webm) caps.webmAlpha = await supported({ ...base, codec: caps.webm, alpha: 'keep' });
    }
    return caps;
  })();
  return capsPromise;
}

export function fileName(look, s, ext) {
  const { w, h } = exportSize(s.aspect, s.tier);
  return `motif-${look.styleId}-${s.aspect}-${w}x${h}${ext === 'png' || ext === 'json' ? '' : `-${s.fps}fps`}.${ext}`;
}

export function presetJSON(look, aspect) {
  return JSON.stringify({ format: PRESET_FORMAT, style: getStyle(look.styleId).name, aspect, look }, null, 2);
}

export function parsePreset(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('it isn’t valid JSON'); }
  if (!data || data.format !== PRESET_FORMAT) throw new Error('the format tag is missing or unknown');
  if (!data.look || !data.look.styleId) throw new Error('it has no look');
  return { look: sanitizeLook(data.look), aspect: data.aspect || '16x9' };
}

const tick = () => new Promise(r => setTimeout(r, 0));
const abortErr = () => { const e = new Error('Export cancelled'); e.name = 'AbortError'; return e; };

async function encodeVideo(look, s, caps, onProgress, signal) {
  const { w, h } = exportSize(s.aspect, s.tier); const N = frameCount(look, s.fps, s.loops);
  const isMp4 = s.format === 'mp4', alpha = !isMp4 && s.transparent && caps.webmAlpha;
  const canvas = makeCanvas(w, h), ctx = canvas.getContext('2d', { alpha: true });
  const M = isMp4 ? g.Mp4Muxer : g.WebMMuxer;
  const muxer = new M.Muxer(isMp4
    ? { target: new M.ArrayBufferTarget(), video: { codec: 'avc', width: w, height: h, frameRate: s.fps }, fastStart: 'in-memory' }
    : { target: new M.ArrayBufferTarget(), video: { codec: caps.webm === 'vp8' ? 'V_VP8' : 'V_VP9', width: w, height: h, frameRate: s.fps, alpha } });
  let failure = null;
  const enc = new g.VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; } });
  const bitrate = Math.round(w * h * s.fps * 0.14);
  enc.configure({ codec: isMp4 ? caps.mp4 : caps.webm, width: w, height: h, bitrate, framerate: s.fps, latencyMode: 'quality', ...(alpha ? { alpha: 'keep' } : {}), ...(isMp4 ? { avc: { format: 'avc' } } : {}) });
  for (let i = 0; i < N; i++) {
    if (signal && signal.aborted) { try { enc.close(); } catch (e) { /* closed */ } throw abortErr(); }
    if (failure) throw failure;
    renderFrame(ctx, w, h, look, i / s.fps, { transparent: !isMp4 && s.transparent });
    const frame = new g.VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / s.fps), duration: Math.round(1e6 / s.fps), alpha: alpha ? 'keep' : 'discard' });
    enc.encode(frame, { keyFrame: i % (s.fps * 2) === 0 }); frame.close();
    while (enc.encodeQueueSize > 6) await tick();
    onProgress && onProgress((i + 1) / N, `Rendering frame ${i + 1} of ${N}`);
    if (i % 4 === 0) await tick();
  }
  onProgress && onProgress(1, 'Finishing file');
  await enc.flush(); enc.close();
  if (failure) throw failure;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' });
}

// Real-time fallback for browsers without WebCodecs.
async function recordRealtime(look, s, onProgress, signal) {
  const { w, h } = exportSize(s.aspect, s.tier); const N = frameCount(look, s.fps, s.loops);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); const stream = canvas.captureStream(s.fps);
  const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(t => g.MediaRecorder.isTypeSupported(t));
  const rec = new g.MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: Math.round(w * h * s.fps * 0.14) }); const parts = [];
  rec.ondataavailable = e => e.data.size && parts.push(e.data);
  const done = new Promise(r => { rec.onstop = r; });
  rec.start();
  const start = performance.now();
  for (let i = 0; i < N; i++) {
    if (signal && signal.aborted) { rec.stop(); throw abortErr(); }
    renderFrame(ctx, w, h, look, i / s.fps);
    onProgress && onProgress((i + 1) / N, `Recording in real time: frame ${i + 1} of ${N}`);
    const due = start + ((i + 1) * 1000) / s.fps; await new Promise(r => setTimeout(r, Math.max(0, due - performance.now())));
  }
  rec.stop(); await done;
  return new Blob(parts, { type: (type || 'video/webm').split(';')[0] });
}

async function canvasPng(canvas) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: 'image/png' });
  return new Promise(r => canvas.toBlob(r, 'image/png'));
}

async function pngSequence(look, s, onProgress, signal) {
  const { w, h } = exportSize(s.aspect, s.tier); const N = frameCount(look, s.fps, s.loops);
  const canvas = makeCanvas(w, h), ctx = canvas.getContext('2d'); const files = {};
  const pad = String(N).length < 4 ? 4 : String(N).length;
  for (let i = 0; i < N; i++) {
    if (signal && signal.aborted) throw abortErr();
    renderFrame(ctx, w, h, look, i / s.fps, { transparent: s.transparent });
    const buf = new Uint8Array(await (await canvasPng(canvas)).arrayBuffer());
    files[`${look.styleId}_${String(i).padStart(pad, '0')}.png`] = [buf, { level: 0 }];
    onProgress && onProgress((i + 1) / N, `Rendering frame ${i + 1} of ${N}`);
  }
  onProgress && onProgress(1, 'Packing ZIP');
  await tick();
  return new Blob([g.fflate.zipSync(files)], { type: 'application/zip' });
}

// Run one export. Returns { blob, filename, note }.
export async function runExport(look, s, { onProgress, signal } = {}) {
  const caps = await probeCapabilities();
  if (s.format === 'json') return { blob: new Blob([presetJSON(look, s.aspect)], { type: 'application/json' }), filename: `motif-${look.styleId}-preset.json` };
  if (s.format === 'png') {
    const { w, h } = exportSize(s.aspect, s.tier); const c = makeCanvas(w, h);
    renderFrame(c.getContext('2d'), w, h, look, s.time || 0, { transparent: s.transparent });
    return { blob: await canvasPng(c), filename: fileName(look, s, 'png') };
  }
  if (s.format === 'png-seq') {
    if (!caps.zip) throw new Error('The ZIP library did not load. Check your connection and reload.');
    return { blob: await pngSequence(look, s, onProgress, signal), filename: fileName(look, s, 'zip') };
  }
  const want = s.format === 'mp4' ? caps.mp4 : caps.webm;
  if (caps.webcodecs && caps.muxers && want) {
    const blob = await encodeVideo(look, s, caps, onProgress, signal);
    const note = s.format === 'webm' && s.transparent && !caps.webmAlpha ? 'This browser can’t encode alpha, so the background was kept.' : '';
    return { blob, filename: fileName(look, s, s.format), note };
  }
  if (caps.recorder && s.format === 'webm') {
    const blob = await recordRealtime(look, s, onProgress, signal);
    return { blob, filename: fileName(look, s, 'webm'), note: 'Recorded in real time because this browser has no WebCodecs encoder.' };
  }
  throw new Error(`This browser can’t encode ${s.format === 'mp4' ? 'H.264' : 'VP9'}. Try ${s.format === 'mp4' ? 'WebM' : 'PNG sequence'}.`);
}
