#!/usr/bin/env python3
"""Motif 5 build: python3 src-v5/build.py  ->  ../motif5.html (single self-contained file).
Modules in src-v5/modules/NN-name.js are concatenated in filename order between head.html and tail.html.
Third-party libraries in vendor/ (pinned, see vendor/VENDOR.md) are inlined where head.html has a <!--vendor:name--> marker, so the build never needs a CDN.
`--check` rebuilds in memory and fails if motif5.html differs (CI guard)."""
import os, sys, glob
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, '..', 'motif5.html')
VENDOR = {'fflate': 'fflate-0.8.3.umd.js', 'mp4-muxer': 'mp4-muxer-5.2.2.js', 'webm-muxer': 'webm-muxer-5.1.4.js'}
def vendor_tag(name):
    src = open(os.path.join(ROOT, '..', 'vendor', VENDOR[name])).read()
    assert '</script' not in src.lower(), name
    return f'<script>/* vendor: {VENDOR[name]} */\n{src.rstrip()}\n</script>\n'
def build():
    head = open(f'{ROOT}/head.html').read()
    for n in VENDOR:
        assert f'<!--vendor:{n}-->\n' in head, f'head.html is missing the vendor marker for {n}'
        head = head.replace(f'<!--vendor:{n}-->\n', vendor_tag(n))
    parts = [head]
    for f in sorted(glob.glob(f'{ROOT}/modules/*.js')): parts.append(open(f).read())
    parts.append(open(f'{ROOT}/tail.html').read())
    return ''.join(parts)
if __name__ == '__main__':
    out = build()
    if '--check' in sys.argv:
        if open(OUT).read() != out: sys.exit('motif5.html is stale: run python3 src-v5/build.py')
        print('motif5.html up to date'); sys.exit(0)
    open(OUT, 'w').write(out); print(f'wrote motif5.html ({len(out):,} bytes)')
