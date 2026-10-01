#!/bin/sh
# Rebuilds vendor/mediabunny-lite.js: a tree-shaken, minified bundle of mediabunny
# (MP4/MOV demux + VideoSampleSink only; WebM/Matroska is left to the <video> path, saving ~44 KB).
# Usage, from Motif3/:  sh src-v5/vendor/build-mediabunny.sh   (needs npm registry access)
set -e
VER=1.61.0
ROOT=$(pwd)
TMP=$(mktemp -d)
cd "$TMP"
npm init -y >/dev/null
npm i esbuild "mediabunny@$VER" >/dev/null
printf "export { Input, BlobSource, Mp4InputFormat, QuickTimeInputFormat, VideoSampleSink, EncodedPacketSink } from 'mediabunny';\n" > entry.mjs
npx esbuild entry.mjs --bundle --minify --format=iife --global-name=MediabunnyLite --legal-comments=none --outfile=out.js
OUT="$ROOT/src-v5/vendor/mediabunny-lite.js"
{
  printf '/*! mediabunny %s (https://github.com/Vanilagy/mediabunny). Copyright (c) 2026-present, Vanilagy and contributors.\n' "$VER"
  printf ' * Licensed under the Mozilla Public License 2.0 (https://mozilla.org/MPL/2.0/), file-level copyleft: this file is the\n'
  printf ' * unmodified esbuild bundle of the upstream sources (subset: Input, BlobSource, Mp4InputFormat, QuickTimeInputFormat,\n'
  printf ' * VideoSampleSink, EncodedPacketSink). Regenerate with src-v5/vendor/build-mediabunny.sh. */\n'
  cat out.js
} > "$OUT"
echo "wrote $OUT"
