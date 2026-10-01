#!/usr/bin/env python3
"""Motif 5 build: python3 src-v5/build.py  ->  ../motif5.html (single self-contained file).
Modules in src-v5/modules/NN-name.js are concatenated in filename order between head.html and tail.html.
Engine modules (NN <= 12, incl. lettered 12a-, 12b-) are emitted once as text in <script type="text/plain"
id="motif-engine-src">: the page evaluates that text (indirect eval) and the render worker boots from the same
text through a Blob URL, so the engine is never duplicated in the file. Shell modules (13+) run as a normal script.
`--check` rebuilds in memory and fails if motif5.html differs (CI guard)."""
import os, re, sys, glob
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, '..', 'motif5.html')
ENGINE_MAX = 12
def build():
    head = open(f'{ROOT}/head.html').read()
    cut = head.rindex('<script>')  # head ends with the app script's opening tag and "use strict"
    files = sorted(glob.glob(f'{ROOT}/modules/*.js'))
    is_engine = lambda f: int(re.match(r'(\d+)', os.path.basename(f)).group(1)) <= ENGINE_MAX
    engine = ''.join(open(f).read() for f in files if is_engine(f))
    if re.search(r'</script|<!--', engine, re.I): sys.exit('engine modules must not contain "</script" or "<!--" (they are embedded as script text)')
    names = re.findall(r'^const (__m_\w+) = \(', engine, re.M)
    boot = ('const __motifEngine = (0, eval)(\'"use strict";\\n\' + document.getElementById(\'motif-engine-src\').textContent'
            f' + \'\\n;({{ {", ".join(names)} }})\\n//# sourceURL=motif-engine.js\');\n'
            f'const {{ {", ".join(names)} }} = __motifEngine;\n')
    parts = [head[:cut], '<script type="text/plain" id="motif-engine-src">\n', engine, '</script>\n', head[cut:], boot]
    for f in files:
        if not is_engine(f): parts.append(open(f).read())
    parts.append(open(f'{ROOT}/tail.html').read())
    return ''.join(parts)
if __name__ == '__main__':
    out = build()
    if '--check' in sys.argv:
        if open(OUT).read() != out: sys.exit('motif5.html is stale: run python3 src-v5/build.py')
        print('motif5.html up to date'); sys.exit(0)
    open(OUT, 'w').write(out); print(f'wrote motif5.html ({len(out):,} bytes)')
