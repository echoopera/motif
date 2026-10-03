#!/usr/bin/env python3
# Builds Motif 8 from the Motif 7.1.1 single-file build: python3 build/patch_v8.py <Motif-7.1.1.html> <Motif.html>
import sys, os, re
sys.path.insert(0, os.path.dirname(__file__))
from patchlib import Patcher
import patch_engine, patch_ui, patch_meta
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mods = {n: open(os.path.join(root, 'modules', f)).read().rstrip('\n') + '\n' for n, f in [('kit-v4', '04a0-kit-v4.js'), ('shell-sequencer', 'shell-sequencer.js')]}
src = open(sys.argv[1], encoding='utf-8').read()
P = Patcher(src)
patch_engine.apply(P, mods); patch_ui.apply(P, mods); patch_meta.apply(P, mods)
open(sys.argv[2], 'w', encoding='utf-8').write(P.t)
print(f'ok: {P.n} patches, {len(src)} -> {len(P.t)} bytes')
