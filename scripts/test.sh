#!/bin/bash
# Testes automáticos de UI: abre app/ no Electron com o test-harness.js (DMX_TEST=1).
# Resultado em test-out/result.json (passos + consola) e capturas .png.
# Precisa de xvfb em Linux; é lento em VM (render por software).
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${DMX_OUT:-$PWD/test-out}"; rm -rf "$OUT"
DMX_TEST=1 DMX_OUT="$OUT" xvfb-run -a -s "-screen 0 3200x1800x24" \
  npx electron --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader \
  --use-fake-ui-for-media-stream --use-fake-device-for-media-stream app || true
node -e '
const r=require(process.argv[1]+"/result.json");
const bad=r.steps.filter(s=>!s.ok), err=r.log.filter(l=>l.level>=3||l.level==="error"||l.level==="fatal");
console.log(r.steps.length+" passos, "+bad.length+" falhados, "+err.length+" erros na consola");
bad.forEach(s=>console.log("✗",s.name,s.err)); err.forEach(l=>console.log("!",l.msg));
process.exit(bad.length||err.length?1:0)' "$OUT"
