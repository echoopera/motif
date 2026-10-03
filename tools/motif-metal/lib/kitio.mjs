// Read a Motif kit from a folder, a .motifkit zip (manifest at root or inside one folder) or a JSON bundle
// { manifest, files }. No dependencies: zip entries are read with node:zlib.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function unzip(buf) {
  // Locate the end-of-central-directory record, then walk the central directory.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a zip archive.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt zip directory.');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28), elen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    p += 46 + nlen + elen + clen;
    if (name.endsWith('/')) continue;
    const ln = buf.readUInt16LE(lho + 26), le = buf.readUInt16LE(lho + 28);
    const data = buf.subarray(lho + 30 + ln + le, lho + 30 + ln + le + csize);
    out[name] = method === 0 ? Buffer.from(data) : zlib.inflateRawSync(data);
  }
  return out;
}

const TEXT = /\.(glsl|json|md|txt)$/i;

export function readKit(p) {
  const st = fs.statSync(p);
  let manifest = null, files = {};
  if (st.isDirectory()) {
    const walk = d => { for (const f of fs.readdirSync(d)) { const q = path.join(d, f); if (fs.statSync(q).isDirectory()) walk(q); else if (!f.startsWith('.') && TEXT.test(f)) files[path.relative(p, q).split(path.sep).join('/')] = fs.readFileSync(q, 'utf8'); } };
    walk(p);
  } else if (/\.json$/i.test(p)) {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!j.manifest || !j.files) throw new Error('JSON kit bundles must look like { "manifest": {…}, "files": { "path": "text" } }.');
    return { manifest: j.manifest, files: { ...j.files } };
  } else {
    const un = unzip(fs.readFileSync(p));
    // Accept a zip with the kit folder inside it.
    const names = Object.keys(un);
    const mf = names.find(n => n === 'manifest.json') || names.find(n => /^[^/]+\/manifest\.json$/.test(n));
    if (!mf) throw new Error('No manifest.json in archive.');
    const root = mf.slice(0, mf.length - 'manifest.json'.length);
    for (const n of names) if (n.startsWith(root) && TEXT.test(n)) files[n.slice(root.length)] = un[n].toString('utf8');
  }
  if (!files['manifest.json']) throw new Error(`No manifest.json in ${p}`);
  manifest = JSON.parse(files['manifest.json']);
  delete files['manifest.json'];
  return { manifest, files };
}
