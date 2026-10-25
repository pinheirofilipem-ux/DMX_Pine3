#!/bin/bash
# Instala o DMX_Pine3 em /Applications e prepara-o para abrir.
# A app não é assinada pela Apple, por isso: copiar, tirar a quarentena e assinar
# localmente (ad-hoc) com o codesign do macOS. Cada passo mostra o erro, se houver.
SRC="$(cd "$(dirname "$0")" && pwd)/DMX_Pine3.app"
DST="/Applications/DMX_Pine3.app"
falha(){ echo; echo "✗ Falhou: $1"; echo "Copia esta janela e envia-a."; read -r -p "Enter para fechar…"; exit 1; }
echo "Mac: $(sw_vers -productVersion) · $(uname -m)"
case "$(uname -m)" in arm64) [[ "$(lipo -archs "$SRC/Contents/MacOS/DMX_Pine3" 2>/dev/null)" == *arm64* ]] || falha "este DMG é para Intel (x64); usa o DMG arm64";;
  x86_64) [[ "$(lipo -archs "$SRC/Contents/MacOS/DMX_Pine3" 2>/dev/null)" == *x86_64* ]] || falha "este DMG é para Apple Silicon (arm64); usa o DMG x64";; esac
pgrep -xq DMX_Pine3 && { osascript -e 'quit app "DMX_Pine3"'; sleep 1; }
echo "→ A copiar para /Applications…"
if [ -w /Applications ]; then rm -rf "$DST" && ditto "$SRC" "$DST" || falha "cópia"
else sudo rm -rf "$DST" && sudo ditto "$SRC" "$DST" && sudo chown -R "$USER" "$DST" || falha "cópia (sudo)"; fi
echo "→ A tirar a quarentena…"
xattr -cr "$DST" || falha "xattr"
echo "→ A assinar localmente (ad-hoc)…"
codesign --force --deep --sign - "$DST" || falha "codesign"
# Requisito de identidade fixo (pelo bundle id e não pelo hash): assim as autorizações
# de áudio do macOS continuam válidas nas próximas atualizações.
codesign --force --sign - -r='designated => identifier "pt.francisconobre.dmxpine3"' "$DST" || falha "codesign (requisito)"
codesign --verify --deep --strict "$DST" || falha "verificação da assinatura"
echo "→ A repor as autorizações de áudio antigas (o macOS volta a perguntar)…"
for svc in Microphone ScreenCapture AudioCapture; do tccutil reset "$svc" pt.francisconobre.dmxpine3 >/dev/null 2>&1; done
echo "✓ Instalado e assinado."
open "$DST" || falha "abrir a app"
echo "Aceita os pedidos de Microfone e de Gravação de ecrã e áudio do sistema."
read -r -t 8 -p "Esta janela fecha sozinha…" ; exit 0
