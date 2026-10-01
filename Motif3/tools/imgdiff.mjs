// Dependency-free PNG encode/decode (8-bit RGB/RGBA, non-interlaced) and the perceptual-tolerance image comparison used by tests/browser/visual.mjs.
import zlib from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); out.write(type, 4, 'ascii'); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length); return out;
}
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };

// rgba: Uint8Array|Uint8ClampedArray|Buffer of w*h*4. Writes RGB (colour type 2) when every pixel is opaque, else RGBA (6).
// Each row picks the cheapest of None/Sub/Up/Paeth by sum of absolute residuals, which keeps goldens small.
export function encodePng(w, h, rgba) {
  let opaque = true; for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) { opaque = false; break; }
  const bpp = opaque ? 3 : 4, stride = w * bpp, raw = Buffer.alloc((stride + 1) * h), cur = Buffer.alloc(stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) for (let c = 0; c < bpp; c++) cur[x * bpp + c] = rgba[(y * w + x) * 4 + c];
    let best = -1, bestCost = Infinity, bestRow = null;
    for (let f = 0; f < 5; f++) {
      const row = Buffer.alloc(stride); let cost = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c);
        const v = (cur[i] - pred) & 255; row[i] = v; cost += v < 128 ? v : 256 - v;
      }
      if (cost < bestCost) { bestCost = cost; best = f; bestRow = row; }
    }
    raw[y * (stride + 1)] = best; bestRow.copy(raw, y * (stride + 1) + 1); prev = Buffer.from(cur);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Returns { w, h, data: Uint8Array RGBA }.
export function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), d = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); if (d[8] !== 8 || d[12] !== 0) throw new Error('unsupported PNG (need 8-bit, non-interlaced)'); ct = d[9]; }
    else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (ct !== 2 && ct !== 6) throw new Error('unsupported PNG colour type ' + ct);
  const bpp = ct === 2 ? 3 : 4, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), out = new Uint8Array(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      row[i] = (row[i] + (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c))) & 255;
    }
    for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; out[o] = row[x * bpp]; out[o + 1] = row[x * bpp + 1]; out[o + 2] = row[x * bpp + 2]; out[o + 3] = bpp === 4 ? row[x * bpp + 3] : 255; }
    prev = row;
  }
  return { w, h, data: out };
}

export const DEFAULT_TOLERANCE = { channel: 6, fraction: 0.004, mean: 1.5 };

// Perceptual-ish comparison: a pixel "differs" when any channel moves by more than `channel` (0-255). The image fails when the
// differing fraction exceeds `fraction` or the mean absolute channel error exceeds `mean`. Size mismatch always fails.
export function compareImages(a, b, tol = DEFAULT_TOLERANCE) {
  const t = { ...DEFAULT_TOLERANCE, ...tol };
  if (a.w !== b.w || a.h !== b.h) return { ok: false, reason: `size ${a.w}x${a.h} vs ${b.w}x${b.h}`, fraction: 1, mean: 255, maxDelta: 255, differing: a.w * a.h };
  const n = a.w * a.h; let differing = 0, sum = 0, maxDelta = 0;
  for (let i = 0; i < n; i++) {
    let m = 0; for (let c = 0; c < 3; c++) { const d = Math.abs(a.data[i * 4 + c] - b.data[i * 4 + c]); sum += d; if (d > m) m = d; }
    const da = Math.abs(a.data[i * 4 + 3] - b.data[i * 4 + 3]); if (da > m) m = da;
    if (m > t.channel) differing++; if (m > maxDelta) maxDelta = m;
  }
  const fraction = differing / n, mean = sum / (n * 3);
  const ok = fraction <= t.fraction && mean <= t.mean;
  return { ok, fraction, mean, maxDelta, differing, reason: ok ? '' : fraction > t.fraction ? `${(fraction * 100).toFixed(2)}% of pixels differ (> ${(t.fraction * 100).toFixed(2)}%)` : `mean error ${mean.toFixed(2)} (> ${t.mean})` };
}

// Side-by-side evidence image: expected | actual | amplified difference (differing pixels in red over a dimmed actual).
export function diffTriptych(expected, actual, tol = DEFAULT_TOLERANCE) {
  const t = { ...DEFAULT_TOLERANCE, ...tol }, w = expected.w, h = expected.h, same = expected.w === actual.w && expected.h === actual.h;
  const W = w * 3 + 8, out = new Uint8Array(W * h * 4).fill(255);
  const put = (img, ox) => { for (let y = 0; y < Math.min(h, img.h); y++) for (let x = 0; x < Math.min(w, img.w); x++) for (let c = 0; c < 4; c++) out[(y * W + ox + x) * 4 + c] = img.data[(y * img.w + x) * 4 + c]; };
  put(expected, 0); put(actual, w + 4);
  if (same) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(expected.data[i + c] - actual.data[i + c]));
    const o = (y * W + 2 * w + 8 + x) * 4, dim = 0.25;
    if (m > t.channel) { out[o] = 255; out[o + 1] = Math.max(0, 60 - m); out[o + 2] = 40; } else { for (let c = 0; c < 3; c++) out[o + c] = actual.data[i + c] * dim + 190 * (1 - dim) * (m > 0 ? 0.6 : 1); }
    out[o + 3] = 255;
  }
  return { w: W, h, data: out };
}
