// The built app must not need a CDN for scripts: muxers and fflate are vendored and inlined. Only fonts stay external.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'motif5.html'), 'utf8');
const vendorMd = fs.readFileSync(path.join(root, 'vendor/VENDOR.md'), 'utf8');

test('built file has no external script dependency (fonts only)', () => {
  const tags = [...html.matchAll(/<script\b[^>]*>/gi)].map(m => m[0]);
  assert.ok(tags.length >= 4, 'inline scripts present');
  for (const t of tags) assert.doesNotMatch(t, /\bsrc\s*=/i, 'external <script src>: ' + t);
  assert.doesNotMatch(html, /<!--vendor:/, 'unreplaced vendor marker');
  // Every absolute URL left in the file is a font host, a namespace/doc link in a comment, or the one documented optional dynamic import.
  const urls = [...new Set([...html.matchAll(/https?:\/\/[A-Za-z0-9.\-]+/g)].map(m => m[0]))];
  const allowed = [/fonts\.googleapis\.com$/, /fonts\.gstatic\.com$/, /www\.w3\.org$/, /wiki\.multimedia\.cx$/, /stackoverflow\.com$/, /github\.com$/, /^mozilla\.org$/];
  const extra = urls.filter(u => !allowed.some(a => a.test(u.replace(/^https?:\/\//, ''))));
  assert.deepEqual(extra, ['https://cdn.jsdelivr.net'], 'only the optional FDK-AAC dynamic import may reference a CDN: ' + extra.join(', '));
  const imports = [...html.matchAll(/import\(\s*['"](https?:[^'"]+)['"]/g)].map(m => m[1]);
  assert.equal(imports.length, 1); assert.match(imports[0], /encode-aac/);
});

test('vendored libraries are inlined, pinned and match VENDOR.md', () => {
  const libs = [['fflate-0.8.3.umd.js', 'fflate'], ['mp4-muxer-5.2.2.js', 'Mp4Muxer'], ['webm-muxer-5.1.4.js', 'WebMMuxer']];
  for (const [file] of libs) {
    const src = fs.readFileSync(path.join(root, 'vendor', file), 'utf8');
    assert.ok(html.includes(src.trimEnd()), file + ' is inlined byte for byte');
    const sha = crypto.createHash('sha256').update(src).digest('hex'); assert.ok(vendorMd.includes(sha), file + ' sha256 recorded in VENDOR.md');
    assert.ok(vendorMd.includes(src.length.toLocaleString('en-US')), file + ' size recorded');
  }
  for (const l of ['LICENSE.fflate', 'LICENSE.mp4-muxer', 'LICENSE.webm-muxer']) assert.match(fs.readFileSync(path.join(root, 'vendor', l), 'utf8'), /MIT License/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'src-v5/head.html'), 'utf8'), /cdn\.jsdelivr/);
});
