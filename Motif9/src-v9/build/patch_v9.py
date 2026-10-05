#!/usr/bin/env python3
# Builds Motif 9 from the Motif 8.0.0 single-file build: python3 build/patch_v9.py <Motif-8.0.0.html> <Motif.html>
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from patchlib import Patcher
import patch_engine, patch_ui, patch_meta
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mods = {n: open(os.path.join(root, 'modules', f), encoding='utf-8').read().rstrip('\n') + '\n' for n, f in [('graph-engine', 'graph-engine.js'), ('shell-graph', 'shell-graph.js')]}
src = open(sys.argv[1], encoding='utf-8').read()
P = Patcher(src)
patch_engine.apply(P, mods); patch_ui.apply(P, mods); patch_meta.apply(P, mods)
open(sys.argv[2], 'w', encoding='utf-8').write(P.t)
print(f'ok: {P.n} patches, {len(src)} -> {len(P.t)} bytes')
