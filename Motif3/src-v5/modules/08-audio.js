// ---- module: audio v1.0.0
const __m_audio = (() => {
// audio — offline analysis (8 band envelopes at 60 fps, onset flux), tempo + downbeat detection,
// smoothed envelope lookup, transport-synced playback of a looped region, and live input.
// Offline envelopes make audio-driven frames deterministic, so they export exactly.
const ENV_FPS = 60;
const BAND_HZ = { sub: [20, 60], bass: [60, 250], lowmid: [250, 500], mid: [500, 2000], highmid: [2000, 6000], high: [6000, 16000] };
const BAND_IDS = ['sub', 'bass', 'lowmid', 'mid', 'highmid', 'high', 'level', 'onset'];

// ---------- FFT (radix-2, in place) ----------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
function mono(buffer) {
  const n = buffer.length, out = new Float32Array(n), ch = buffer.numberOfChannels;
  for (let c = 0; c < ch; c++) { const d = buffer.getChannelData(c); for (let i = 0; i < n; i++) out[i] += d[i] / ch; }
  return out;
}
function percentile(arr, q) { const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] || 1e-9; }
const yieldTick = () => new Promise(r => setTimeout(r, 0));

// Analyse an AudioBuffer. onProgress(0..1). Returns an analysis object (plain data + helpers).
async function analyse(buffer, onProgress) {
  const sr = buffer.sampleRate, x = mono(buffer), N = 2048, hop = sr / ENV_FPS;
  const frames = Math.max(1, Math.floor((x.length - N) / hop) + 1);
  const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const bins = {}; for (const [id, [lo, hi]] of Object.entries(BAND_HZ)) bins[id] = [Math.max(1, Math.floor((lo * N) / sr)), Math.min(N / 2 - 1, Math.ceil((hi * N) / sr))];
  const bands = {}; for (const id of BAND_IDS) bands[id] = new Float32Array(frames);
  const re = new Float32Array(N), im = new Float32Array(N); let prev = new Float32Array(N / 2), cur = new Float32Array(N / 2);
  for (let f = 0; f < frames; f++) {
    const s0 = Math.floor(f * hop); let rms = 0;
    for (let i = 0; i < N; i++) { const v = x[s0 + i] || 0; re[i] = v * win[i]; im[i] = 0; rms += v * v; }
    fft(re, im);
    let flux = 0;
    for (let k = 1; k < N / 2; k++) { const m = Math.sqrt(re[k] * re[k] + im[k] * im[k]); cur[k] = m; const d = m - prev[k]; if (d > 0 && k < (4000 * N) / sr) flux += d; }
    for (const [id, [a, b]] of Object.entries(bins)) { let e = 0; for (let k = a; k <= b; k++) e += cur[k] * cur[k]; bands[id][f] = Math.sqrt(e / (b - a + 1)); }
    bands.level[f] = Math.sqrt(rms / N); bands.onset[f] = flux;
    const t = prev; prev = cur; cur = t;
    if (f % 400 === 0) { onProgress && onProgress(0.8 * (f / frames)); await yieldTick(); }
  }
  // Normalise each band to its 98th percentile, gentle compression.
  for (const id of BAND_IDS) { const a = bands[id], p = percentile(a, 0.98); for (let i = 0; i < a.length; i++) a[i] = Math.min(1, Math.pow(a[i] / p, 0.85)); }
  onProgress && onProgress(0.85, 'Detecting tempo'); await yieldTick();
  const tempo = detectTempo(bands.onset, ENV_FPS);
  onProgress && onProgress(1);
  return { sr, duration: buffer.duration, fps: ENV_FPS, frames, bands, bpm: tempo.bpm, beatOffset: tempo.offset, confidence: tempo.confidence, peaks: waveformPeaks(x, 600) };
}

// Tempo: autocorrelation of the (mean-removed) onset envelope over 70–180 BPM, parabolic
// refinement, then a fine comb search (±1.5 BPM, 0.02 steps) that also finds the beat phase.
function detectTempo(on, fps) {
  const n = on.length; if (n < fps * 4) return { bpm: 120, offset: 0, confidence: 0 };
  let mean = 0; for (let i = 0; i < n; i++) mean += on[i]; mean /= n;
  const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = Math.max(0, on[i] - mean);
  const lagMin = Math.floor((60 * fps) / 180), lagMax = Math.ceil((60 * fps) / 70);
  const ac = new Float32Array(lagMax + 2);
  for (let lag = lagMin - 1; lag <= lagMax + 1; lag++) { let s = 0; for (let i = lag; i < n; i++) s += o[i] * o[i - lag]; ac[lag] = s / (n - lag); }
  // Weight toward 120 BPM (log-Gaussian) to resolve octave ambiguity.
  let best = lagMin, bestScore = -Infinity;
  for (let lag = lagMin; lag <= lagMax; lag++) { const bpm = (60 * fps) / lag, wgt = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2)); const sc = ac[lag] * wgt; if (sc > bestScore) { bestScore = sc; best = lag; } }
  const y0 = ac[best - 1] || 0, y1 = ac[best], y2 = ac[best + 1] || 0; const den = y0 - 2 * y1 + y2;
  const lagF = best + (den ? (0.5 * (y0 - y2)) / den : 0);
  let bpm = (60 * fps) / lagF;
  const comb = (b) => { const period = (60 * fps) / b; let bestO = 0, bestS = -1; for (let ph = 0; ph < period; ph += 0.5) { let s = 0, c = 0; for (let t = ph; t < n - 1; t += period) { const i = Math.floor(t), f = t - i; s += o[i] * (1 - f) + o[i + 1] * f; c++; } s /= c || 1; if (s > bestS) { bestS = s; bestO = ph; } } return { s: bestS, o: bestO / fps }; };
  let bestB = bpm, bestC = comb(bpm);
  for (let b = bpm - 1.5; b <= bpm + 1.5; b += 0.02) { const c = comb(b); if (c.s > bestC.s) { bestC = c; bestB = b; } }
  bpm = Math.abs(bestB - Math.round(bestB)) < 0.12 ? Math.round(bestB) : Math.round(bestB * 10) / 10;
  const conf = Math.max(0, Math.min(1, bestC.s / (percentile(o, 0.99) || 1)));
  return { bpm, offset: bestC.o, confidence: conf };
}

function waveformPeaks(x, n) { const out = new Float32Array(n), step = x.length / n; for (let i = 0; i < n; i++) { let m = 0; const a = Math.floor(i * step), b = Math.floor((i + 1) * step); for (let j = a; j < b; j += 8) m = Math.max(m, Math.abs(x[j])); out[i] = m; } return out; }

// Smoothed envelope lookup. smooth 0..1 → release time 0..600 ms (attack 10 ms). Cached per band+smooth.
function makeEnv(an) {
  const cache = new Map();
  function series(band, smooth) {
    const key = band + '|' + smooth.toFixed(2); let s = cache.get(key); if (s) return s;
    const src = an.bands[band]; if (!src) return null;
    s = new Float32Array(src.length);
    const att = 1 - Math.exp(-1 / (0.01 * an.fps)), rel = smooth <= 0 ? 1 : 1 - Math.exp(-1 / (smooth * 0.6 * an.fps));
    let y = 0; for (let i = 0; i < src.length; i++) { const v = src[i]; y += (v - y) * (v > y ? att : rel); s[i] = y; }
    cache.set(key, s); if (cache.size > 40) cache.delete(cache.keys().next().value);
    return s;
  }
  function env(band, seconds, smooth = 0) {
    const s = series(band, smooth || 0); if (!s) return null;
    const f = seconds * an.fps; if (f < 0 || f >= s.length - 1) return f < 0 ? s[0] : s[s.length - 1];
    const i = Math.floor(f), t = f - i; return s[i] * (1 - t) + s[i + 1] * t;
  }
  env.source = { bands: an.bands, fps: an.fps }; // plain arrays: the render worker rebuilds the same envelope from these
  return env;
}

// Loop length that fits `bars` of 4/4 at `bpm`.
const barsToSeconds = (bpm, bars) => (bars * 4 * 60) / bpm;

// ---------- playback + live input ----------
function createPlayer() {
  let ctx = null, buffer = null, src = null, gain = null, startedAt = 0, region = [0, 6], playing = false, analyser = null, liveStream = null, liveBins = null, liveVals = null;
  const ensure = () => { if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw new Error('Web Audio isn’t available'); ctx = new AC(); gain = ctx.createGain(); gain.connect(ctx.destination); } return ctx; };
  async function decode(arrayBuf) { ensure(); buffer = await ctx.decodeAudioData(arrayBuf.slice(0)); return buffer; }
  function setRegion(offset, length) { region = [offset, length]; if (playing) { const t = time(); stop(); start(t); } }
  function start(t = 0) {
    if (!buffer || !ctx) return; stop();
    if (ctx.state === 'suspended') ctx.resume();
    src = ctx.createBufferSource(); src.buffer = buffer; src.loop = true;
    const [off, len] = region; src.loopStart = Math.min(off, buffer.duration - 0.05); src.loopEnd = Math.min(buffer.duration, off + len);
    src.connect(gain); const at = ((t % len) + len) % len; src.start(0, src.loopStart + at);
    startedAt = ctx.currentTime - at; playing = true;
  }
  function stop() { if (src) { try { src.stop(); } catch (e) { /* stopped */ } src.disconnect(); src = null; } playing = false; }
  // Transport time inside the loop region (seconds), from the audio clock.
  function time() { if (!playing || !ctx) return null; const len = Math.min(region[1], (buffer.duration - region[0]) || region[1]); return (ctx.currentTime - startedAt) % len; }
  function setVolume(v) { if (gain) gain.gain.value = v; }
  async function startLive() {
    ensure(); if (ctx.state === 'suspended') await ctx.resume();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser has no audio input access');
    liveStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const node = ctx.createMediaStreamSource(liveStream); analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.5; node.connect(analyser);
    liveBins = new Float32Array(analyser.frequencyBinCount); liveVals = { peak: {} }; for (const b of BAND_IDS) liveVals.peak[b] = 1e-3;
  }
  function stopLive() { if (liveStream) liveStream.getTracks().forEach(t => t.stop()); liveStream = null; analyser = null; }
  let prevSpec = null, lastRead = 0, cached = null;
  // Current live band values 0..1 (auto-gain by decaying peak). Read at most once per 8 ms.
  function liveBands() {
    if (!analyser) return null; const now = performance.now(); if (cached && now - lastRead < 8) return cached; lastRead = now;
    analyser.getFloatFrequencyData(liveBins); const sr = ctx.sampleRate, N = analyser.fftSize, out = {};
    const mag = liveBins.map(db => Math.pow(10, db / 20));
    for (const [id, [lo, hi]] of Object.entries(BAND_HZ)) { const a = Math.max(1, Math.floor((lo * N) / sr)), b = Math.min(mag.length - 1, Math.ceil((hi * N) / sr)); let e = 0; for (let k = a; k <= b; k++) e += mag[k] * mag[k]; out[id] = Math.sqrt(e / (b - a + 1)); }
    let lvl = 0; for (const m of mag) lvl += m * m; out.level = Math.sqrt(lvl / mag.length);
    let flux = 0; if (prevSpec) for (let k = 1; k < mag.length / 4; k++) { const d = mag[k] - prevSpec[k]; if (d > 0) flux += d; } prevSpec = mag; out.onset = flux;
    for (const b of BAND_IDS) { const pk = liveVals.peak; pk[b] = Math.max(out[b], pk[b] * 0.995, 1e-4); out[b] = Math.min(1, out[b] / pk[b]); }
    cached = out; return out;
  }
  function clear() { stop(); buffer = null; }
  return { decode, setRegion, start, stop, clear, time, setVolume, startLive, stopLive, liveBands, get playing() { return playing; }, get live() { return !!analyser; }, get buffer() { return buffer; }, get context() { return ctx; } };
}

// Slice [start, start+dur) of an AudioBuffer as planar Float32 channels (for export muxing).
function sliceBuffer(buffer, start, dur) {
  const sr = buffer.sampleRate, a = Math.floor(start * sr), n = Math.floor(dur * sr), ch = Math.min(2, buffer.numberOfChannels), out = [];
  for (let c = 0; c < ch; c++) { const d = buffer.getChannelData(c), o = new Float32Array(n); for (let i = 0; i < n; i++) { const j = a + i; o[i] = j < d.length ? d[j] : d[(j % d.length)] || 0; } out.push(o); }
  return { sampleRate: sr, channels: out, frames: n };
}

return { ENV_FPS, BAND_IDS, analyse, detectTempo, makeEnv, barsToSeconds, createPlayer, sliceBuffer, fft };

})();

