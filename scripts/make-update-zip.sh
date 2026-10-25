#!/bin/bash
# Gera release/DMX_Pine3-update-<versão>.zip: o script «Atualizar DMX_Pine3.command» + a pasta app/.
# Serve para atualizar uma app já instalada sem DMG novo (ver docs/ATUALIZAR.md).
set -euo pipefail
cd "$(dirname "$0")/.."
VER=$(node -p "require('./app/package.json').version")
T="release/DMX_Pine3-update"; rm -rf "./$T"; mkdir -p "$T/app"
cp app/{index.html,main.js,preload.js,package.json,three.min.js} "$T/app/"
cp "update/Atualizar DMX_Pine3.command" "$T/"; chmod 755 "$T/Atualizar DMX_Pine3.command"
Z="DMX_Pine3-update-$VER.zip"; rm -f "release/$Z"
(cd release && zip -rqX "$Z" DMX_Pine3-update)      # zip guarda o bit de execução do .command
rm -rf "./$T"; echo "✓ release/$Z"
