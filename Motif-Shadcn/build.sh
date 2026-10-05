#!/bin/sh
# Rebuilds Motif.html: the React islands (ui/), then the anchored patch over the 9.0.1 build.  sh build.sh
set -e
cd "$(dirname "$0")"
(cd ui && { [ -d node_modules ] || npm install --no-audit --no-fund; } && npx tsc --noEmit && npx vite build)
python3 src-shadcn/build/patch_shadcn.py src-shadcn/Motif-9.0.1.html ui/dist/motif-shadcn.js Motif.html
