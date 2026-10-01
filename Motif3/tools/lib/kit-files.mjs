// Kit package readers shared by tools and tests: a minimal ZIP reader (stored + deflate, node:zlib) and folder reader.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';

export function unzip(buf) {
  const out = {}; let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip');
  const n = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl); p += 46 + nl + xl + cl;
    if (name.endsWith('/')) continue;
    const ds = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28), data = buf.subarray(ds, ds + csize);
    out[name] = method === 0 ? Buffer.from(data) : zlib.inflateRawSync(data);
  }
  return out;
}
export function rawFromZip(buf) {
  const un = unzip(buf); let prefix = '';
  if (!un['manifest.json']) { const m = Object.keys(un).find(n => /(^|\/)manifest\.json$/.test(n)); if (!m) throw new Error('no manifest'); prefix = m.slice(0, -'manifest.json'.length); }
  const files = {}; let manifest = null;
  for (const [n, b] of Object.entries(un)) {
    if (!n.startsWith(prefix)) continue; const rel = n.slice(prefix.length);
    if (rel === 'manifest.json') manifest = JSON.parse(b.toString('utf8')); else if (/\.(glsl|json|md|txt)$/i.test(rel)) files[rel] = b.toString('utf8');
  }
  return { manifest, files };
}
export function rawFromDir(dir) {
  const files = {};
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (!f.startsWith('.') && /\.(glsl|json|md|txt)$/i.test(f)) files[path.relative(dir, p).split(path.sep).join('/')] = fs.readFileSync(p, 'utf8'); } };
  walk(dir); const manifest = JSON.parse(files['manifest.json']); delete files['manifest.json'];
  return { manifest, files };
}
// A .motifkit zip, a { manifest, files } JSON bundle, or a kit folder.
export function readKitPath(p) {
  if (fs.statSync(p).isDirectory()) return rawFromDir(p);
  const buf = fs.readFileSync(p);
  if (buf[0] === 0x50 && buf[1] === 0x4B) return rawFromZip(buf);
  const j = JSON.parse(buf.toString('utf8')); if (j && j.manifest && j.files) return { manifest: j.manifest, files: j.files };
  throw new Error(`${p} is not a .motifkit package, kit bundle or kit folder`);
}
