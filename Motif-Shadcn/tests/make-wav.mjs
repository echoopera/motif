// A 120 BPM test loop (kick, snare-ish noise, hat) as 16-bit mono WAV bytes: node tests/make-wav.mjs out.wav
import fs from 'node:fs';
export function wavBytes(seconds = 8, bpm = 120, sr = 22050) {
  const n = Math.floor(seconds * sr), beat = 60 / bpm, d = new Int16Array(n); let seed = 1; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (let i = 0; i < n; i++) { const t = i / sr, b = t % beat, bar = Math.floor(t / beat) % 4; let v = 0;
    v += Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-b * 30)) * t) * Math.exp(-b * 9) * 0.8;               // kick every beat
    if (bar % 2 === 1) v += rnd() * Math.exp(-b * 14) * 0.35;                                               // snare on 2 and 4
    const h = (t + beat / 2) % beat; v += rnd() * Math.exp(-h * 60) * 0.12;                                 // off-beat hat
    d[i] = Math.max(-1, Math.min(1, v)) * 32000; }
  const buf = Buffer.alloc(44 + n * 2); buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  Buffer.from(d.buffer).copy(buf, 44); return buf;
}
if (process.argv[1] && process.argv[1].endsWith('make-wav.mjs') && process.argv[2]) fs.writeFileSync(process.argv[2], wavBytes());
