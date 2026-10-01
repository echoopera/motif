#!/usr/bin/env python3
"""Motif 5 build: python3 src-v5/build.py  ->  ../motif5.html (single self-contained file).
Modules in src-v5/modules/NN-name.js are concatenated in filename order between head.html and tail.html.
`--check` rebuilds in memory and fails if motif5.html differs (CI guard)."""
import os, sys, glob
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, '..', 'motif5.html')
def build():
    parts = [open(f'{ROOT}/head.html').read()]
    for f in sorted(glob.glob(f'{ROOT}/modules/*.js')): parts.append(open(f).read())
    parts.append(open(f'{ROOT}/tail.html').read())
    return ''.join(parts)
if __name__ == '__main__':
    out = build()
    if '--check' in sys.argv:
        if open(OUT).read() != out: sys.exit('motif5.html is stale: run python3 src-v5/build.py')
        print('motif5.html up to date'); sys.exit(0)
    open(OUT, 'w').write(out); print(f'wrote motif5.html ({len(out):,} bytes)')
