#!/bin/sh
# Optional: precompile every pass into metallibs (macOS and iPadOS). The Swift package works without this.
# Needs Xcode: xcrun metal. Fast math is off so isnan() and the photosensitive limiter behave as on the web.
set -e
cd "$(dirname "$0")"
mkdir -p build
for sdk in macosx iphoneos; do
  for f in Metal/*.metal; do
    xcrun -sdk $sdk metal -std=metal3.0 -fno-fast-math -c "$f" -o "build/$(basename "$f" .metal)-$sdk.air"
  done
  xcrun -sdk $sdk metallib build/*-$sdk.air -o build/infokit-$sdk.metallib
done
echo "wrote build/infokit-macosx.metallib and build/infokit-iphoneos.metallib"
