#!/bin/bash
# Atualiza o DMX_Pine3 instalado sem precisar de um DMG novo.
#  · 1.ª vez: troca o app.asar (arquivo fechado) pela pasta Contents/Resources/app
#  · depois: basta pôr o index.html novo ao lado deste script (ou na pasta app/) e correr outra vez
# No fim volta a assinar a app (ad-hoc, identidade fixa) para o macOS não a dar como
# «danificada» e para as autorizações de microfone e de áudio do sistema se manterem.
APP="/Applications/DMX_Pine3.app"
AQUI="$(cd "$(dirname "$0")" && pwd)"
RES="$APP/Contents/Resources"
ID="pt.francisconobre.dmxpine3"
falha(){ echo; echo "✗ Falhou: $1"; echo "Copia esta janela e envia-a."; read -r -p "Enter para fechar…"; exit 1; }
corre(){ "$@" 2>/dev/null || sudo "$@" || falha "$*"; }

[ -d "$APP" ] || falha "não encontrei $APP (instala primeiro com o DMG)"
[ -f "$AQUI/app/index.html" ] || [ -f "$AQUI/index.html" ] || falha "não há index.html ao lado deste script"

if pgrep -xq DMX_Pine3; then
  echo "→ A fechar o DMX_Pine3…"
  osascript -e 'quit app "DMX_Pine3"' >/dev/null 2>&1; sleep 2; pkill -x DMX_Pine3 2>/dev/null
fi

if [ -f "$RES/app.asar" ]; then
  echo "→ 1.ª atualização: a trocar o app.asar pela pasta app/"
  [ -d "$AQUI/app" ] || falha "falta a pasta app/ (main.js, preload.js, package.json, three.min.js, index.html)"
  BK="$HOME/Library/Application Support/DMX_Pine3-backup"; mkdir -p "$BK"
  corre mv "$RES/app.asar" "$BK/app.asar-$(date +%Y%m%d-%H%M%S)"
  echo "   (o antigo ficou guardado em $BK)"
fi

corre mkdir -p "$RES/app"
if [ -d "$AQUI/app" ]; then
  echo "→ A copiar a pasta app/…"
  for f in main.js preload.js package.json three.min.js index.html; do
    if [ -f "$AQUI/app/$f" ]; then corre cp "$AQUI/app/$f" "$RES/app/$f"; fi
  done
fi
if [ -f "$AQUI/index.html" ]; then echo "→ A copiar o index.html…"; corre cp "$AQUI/index.html" "$RES/app/index.html"; fi
for f in main.js preload.js package.json three.min.js index.html; do
  [ -f "$RES/app/$f" ] || falha "falta $f em $RES/app"
done

V=$(sed -n 's/.*"version" *: *"\([^"]*\)".*/\1/p' "$RES/app/package.json")
if [ -n "$V" ]; then /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $V" "$APP/Contents/Info.plist" 2>/dev/null; fi

echo "→ A tirar a quarentena e a assinar de novo (ad-hoc)…"
corre xattr -cr "$APP"
corre codesign --force --deep --sign - "$APP"
corre codesign --force --sign - -r="designated => identifier \"$ID\"" "$APP"
codesign --verify --deep --strict "$APP" || falha "verificação da assinatura"

echo "✓ DMX_Pine3 atualizado${V:+ para a versão $V}. As definições, cues e MIDI mantêm-se."
open "$APP"
read -r -t 6 -p "Esta janela fecha sozinha…"; exit 0
