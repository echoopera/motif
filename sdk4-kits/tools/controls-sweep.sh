#!/bin/sh
# runs the per-control evidence for every style of every kit
cd "$(dirname "$0")/.."
for k in kits/*/; do id=$(basename $k)
  for s in $(node -e "console.log(require('./kits/$id/manifest.json').styles.map(x=>x.id).join(' '))"); do
    node tools/qa.mjs controls $id $s 2>&1 | grep -a -v "^    at" | tail -1
  done
done
