#!/bin/bash
# Gera release/DMX_Pine3-<versão>-<arch>.dmg a partir de dist/ (correr antes: node pack.js).
# Feito em Linux: imagem híbrida ISO/HFS+ (xorriso) + reparação do volume HFS+ (hfsprogs).
#   apt install xorriso hfsprogs
# Uso: scripts/make-dmg.sh [arm64] [x64]
set -euo pipefail
cd "$(dirname "$0")/.."
VER=$(node -p "require('./app/package.json').version")
mkdir -p release
for ARCH in "${@:-arm64 x64}"; do for A in $ARCH; do
  SRC="dist/DMX_Pine3-darwin-$A/DMX_Pine3.app"
  [ -d "$SRC" ] || { echo "falta $SRC (corre: node pack.js $A)"; exit 1; }
  ST="stage-$A"; rm -rf "./$ST"; mkdir -p "$ST"
  cp -a "$SRC" "$ST/"; cp -a dmgextra/. "$ST/"; ln -s /Applications "$ST/Applications"
  OUT="release/DMX_Pine3-$VER-$A.dmg"; rm -f "$OUT"
  xorriso -as mkisofs -quiet -V DMX_Pine3 -R -hfsplus -apm-block-size 2048 -o "$OUT" "$ST"
  read -r OFF LEN < <(python3 scripts/apm_hfs.py "$OUT")
  dd if="$OUT" of=hfs.img bs=1M iflag=skip_bytes,count_bytes skip="$OFF" count="$LEN" status=none
  fsck.hfsplus -fy hfs.img >/dev/null || true
  fsck.hfsplus -fy hfs.img >/dev/null || true
  fsck.hfsplus -fn hfs.img | grep -q "appears to be OK" || { echo "✗ HFS+ com erros em $OUT"; exit 1; }
  dd if=hfs.img of="$OUT" bs=1M oflag=seek_bytes seek="$OFF" conv=notrunc status=none
  rm -f hfs.img; rm -rf "./$ST"
  echo "✓ $OUT ($(du -h "$OUT" | cut -f1))"
done; done
