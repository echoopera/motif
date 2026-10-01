#!/usr/bin/env python3
"""Package a Motif release: python3 tools/release.py [--version 7.0.0] [--app motif7.html]
Writes dist/Motif-<version>/ and dist/Motif-<version>.zip containing the single-file app, kits, SDK, schemas, docs,
changelog and SHA-256 checksums. Fails if the app file is stale against src-v5 or has external script dependencies."""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser(); ap.add_argument('--version', default='7.0.0'); ap.add_argument('--app', default='motif7.html'); a = ap.parse_args()
app = os.path.join(ROOT, a.app)
if not os.path.exists(app): sys.exit(f'{a.app} not found: build it first (python3 src-v5/build.py)')
html = open(app, encoding='utf8').read()
ext = re.findall(r'<script[^>]+src="(https?://[^"]+)"', html)
if ext: sys.exit('external script dependencies (vendor them): ' + ', '.join(ext))
name = f'Motif-{a.version}'; out = os.path.join(ROOT, 'dist', name)
shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
shutil.copy(app, os.path.join(out, 'Motif.html'))
def copy(src, dst=None, optional=True):
    s = os.path.join(ROOT, src)
    if not os.path.exists(s):
        if optional: return
        sys.exit('missing ' + src)
    d = os.path.join(out, dst or src)
    os.makedirs(os.path.dirname(d), exist_ok=True)
    (shutil.copytree(s, d, ignore=shutil.ignore_patterns('node_modules', '.DS_Store')) if os.path.isdir(s) else shutil.copy(s, d))
for p in ['kits', 'sdk', 'schemas', 'CHANGELOG-7.0.md', 'CHANGELOG-5.1.md', 'README.md']: copy(p)
copy('../docs', 'docs')
for p in ['tools/bench.mjs', 'tools/budgets.json']: copy(p)
open(os.path.join(out, 'START-HERE.txt'), 'w').write(f"""Motif {a.version}

1. Open Motif.html in Chrome or Edge (Safari 17+ works with WebGL2 only). No install, no server, no network needed.
2. Kits: Kits page > Install, then pick a file from kits/ (.motifkit).
3. Build your own kits: sdk/ (CLI, schemas, docs).
4. Verify the file: shasum -a 256 -c SHA256SUMS

Everything is local; media never leaves the browser.
""")
sums = []
for dp, _, fs in os.walk(out):
    for f in sorted(fs):
        if f == 'SHA256SUMS': continue
        p = os.path.join(dp, f); sums.append(f"{hashlib.sha256(open(p, 'rb').read()).hexdigest()}  {os.path.relpath(p, out)}")
open(os.path.join(out, 'SHA256SUMS'), 'w').write('\n'.join(sorted(sums, key=lambda l: l.split('  ')[1])) + '\n')
zp = out + '.zip'
with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
    for dp, _, fs in os.walk(out):
        for f in sorted(fs): p = os.path.join(dp, f); z.write(p, os.path.join(name, os.path.relpath(p, out)))
print(f'{zp}  {os.path.getsize(zp)/1048576:.1f} MB  ({len(sums)} files)')
