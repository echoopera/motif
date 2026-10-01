#!/usr/bin/env python3
"""Pack a kit source folder into a .motifkit (zip: manifest.json first, then README/common/styles), without Node packages.
   python3 tools/pack-kit.py kits/source/facetype kits    ->  kits/<id>-<version>.motifkit
Entries carry a fixed timestamp so the package is reproducible."""
import json, os, sys, zipfile
src, out = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else '.'
m = json.load(open(os.path.join(src, 'manifest.json')))
dest = os.path.join(out, f"{m['id']}-{m['version']}.motifkit")
names = []
for d, _, fs in os.walk(src):
    for f in fs:
        rel = os.path.relpath(os.path.join(d, f), src).replace(os.sep, '/')
        if rel != 'manifest.json' and not f.startswith('.') and f.lower().endswith(('.glsl', '.json', '.md', '.txt')): names.append(rel)
names.sort(key=lambda n: (n != 'README.md', n.count('/'), n))
with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as z:
    for n in ['manifest.json'] + names:
        zi = zipfile.ZipInfo(n, date_time=(2026, 10, 1, 0, 0, 0)); zi.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(zi, open(os.path.join(src, n), 'rb').read())
print('wrote', dest)
