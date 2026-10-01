// A tiny, valid TrueType font for tests (no fontTools needed): every printable ASCII character except space is the same
// glyph, a solid block, so text drawn with it is unmistakable (no installed font looks like this). Family name is
// configurable so two different files can be generated (different bytes → different content ids).
export function tinyFont(family = 'Motif Test Block', { block = [100, 0, 900, 700] } = {}) {
  const tables = {};
  const u16 = v => [(v >> 8) & 255, v & 255], i16 = v => u16(v & 0xFFFF), u32 = v => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
  const [x0, y0, x1, y1] = block;
  // head (54 bytes); checkSumAdjustment patched at the end.
  tables.head = [...u32(0x00010000), ...u32(0x00010000), ...u32(0), ...u32(0x5F0F3CF5), ...u16(0x000B), ...u16(1000), ...Array(16).fill(0), ...i16(0), ...i16(0), ...i16(x1), ...i16(y1), ...u16(0), ...u16(8), ...i16(2), ...i16(0), ...i16(0)];
  tables.hhea = [...u32(0x00010000), ...i16(800), ...i16(-200), ...i16(0), ...u16(1000), ...i16(0), ...i16(0), ...i16(x1), ...i16(1), ...i16(0), ...i16(0), ...Array(8).fill(0), ...i16(0), ...u16(3)];
  tables.maxp = [...u32(0x00010000), ...u16(3), ...u16(4), ...u16(1), ...u16(0), ...u16(0), ...u16(2), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(0)];
  tables.hmtx = [...u16(500), ...i16(0), ...u16(500), ...i16(0), ...u16(1000), ...i16(x0)];
  // glyf: 0 .notdef (empty), 1 space (empty), 2 block (one clockwise contour).
  const sq = [...i16(1), ...i16(x0), ...i16(y0), ...i16(x1), ...i16(y1), ...u16(3), ...u16(0), 1, 1, 1, 1, ...i16(x0), ...i16(0), ...i16(x1 - x0), ...i16(0), ...i16(y0), ...i16(y1 - y0), ...i16(0), ...i16(y0 - y1)];
  while (sq.length % 4) sq.push(0);
  tables.glyf = sq;
  tables.loca = [...u16(0), ...u16(0), ...u16(0), ...u16(sq.length / 2)];
  // cmap format 4: 0x20 → 1, 0x21..0x7E → 2 (through glyphIdArray), 0xFFFF terminator.
  const seg = 3, n = 0x7E - 0x21 + 1;
  const f4 = [...u16(4), ...u16(0), ...u16(0), ...u16(seg * 2), ...u16(4), ...u16(1), ...u16(2),
    ...u16(0x20), ...u16(0x7E), ...u16(0xFFFF), ...u16(0),
    ...u16(0x20), ...u16(0x21), ...u16(0xFFFF),
    ...i16(1 - 0x20), ...i16(0), ...i16(1),
    ...u16(0), ...u16(4), ...u16(0),
    ...Array.from({ length: n }, () => u16(2)).flat()];
  f4[2] = (f4.length >> 8) & 255; f4[3] = f4.length & 255;
  tables.cmap = [...u16(0), ...u16(1), ...u16(3), ...u16(1), ...u32(12), ...f4];
  const os2 = [...u16(3), ...i16(1000), ...u16(400), ...u16(5), ...u16(0), ...Array(16).fill(0), ...i16(50), ...i16(250), ...i16(0), ...Array(10).fill(0), ...u32(1), ...u32(0), ...u32(0), ...u32(0), 77, 79, 84, 70, ...u16(0x40), ...u16(0x20), ...u16(0x7E), ...i16(800), ...i16(-200), ...i16(0), ...u16(800), ...u16(200), ...u32(1), ...u32(0), ...i16(500), ...i16(700), ...u16(0), ...u16(0x20), ...u16(1)];
  tables['OS/2'] = os2;
  // name: family (1), subfamily (2), full (4), PostScript (6), Windows Unicode BMP.
  const enc = s => Array.from(s).flatMap(c => u16(c.charCodeAt(0)));
  const ps = family.replace(/[^A-Za-z0-9]/g, '') + '-Regular';
  const recs = [[1, family], [2, 'Regular'], [4, family + ' Regular'], [6, ps]];
  let strs = [], hdr = [];
  for (const [id, s] of recs) { const b = enc(s); hdr.push(...u16(3), ...u16(1), ...u16(0x409), ...u16(id), ...u16(b.length), ...u16(strs.length)); strs.push(...b); }
  tables.name = [...u16(0), ...u16(recs.length), ...u16(6 + recs.length * 12), ...hdr, ...strs];
  tables.post = [...u32(0x00030000), ...u32(0), ...i16(-100), ...i16(50), ...u32(0), ...u32(0), ...u32(0), ...u32(0), ...u32(0)];
  // Assemble with a table directory sorted by tag; tables 4-byte aligned; checksums; head.checkSumAdjustment.
  const tags = Object.keys(tables).sort();
  const sum = b => { let s = 0; for (let i = 0; i < b.length; i += 4) s = (s + ((b[i] << 24) | ((b[i + 1] || 0) << 16) | ((b[i + 2] || 0) << 8) | (b[i + 3] || 0))) >>> 0; return s; };
  const nt = tags.length, es = Math.floor(Math.log2(nt)), sr = (1 << es) * 16;
  const head = [...u32(0x00010000), ...u16(nt), ...u16(sr), ...u16(es), ...u16(nt * 16 - sr)];
  let off = 12 + nt * 16; const dir = [], body = [];
  for (const t of tags) {
    const b = tables[t].slice(); const len = b.length; while (b.length % 4) b.push(0);
    dir.push(...Array.from(t.padEnd(4, ' ')).map(c => c.charCodeAt(0)), ...u32(sum(b)), ...u32(off), ...u32(len));
    if (t === 'head') tables.headAt = off;
    body.push(...b); off += b.length;
  }
  const font = Uint8Array.from([...head, ...dir, ...body]);
  const adj = (0xB1B0AFBA - sum(font)) >>> 0; font.set(u32(adj), tables.headAt + 8);
  return font;
}
