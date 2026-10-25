# DMX_Pine3 — instruções para o Claude Code

Emulador de mesa de luz DMX para sessões ao vivo: palco 3D (three.js r128) + consola,
num **único ficheiro** `app/index.html`, empacotado como app macOS com Electron 45.
Documentação completa: `docs/HANDOFF.md` (arquitetura, nomes-chave, persistência, build, histórico).

## Regras
- **Responder em PT-PT**, direto e tecnicamente preciso. Assinalar erros com honestidade.
- **Mudanças cirúrgicas** no `index.html` (~4600 linhas): acrescentar código novo e tocar no existente só quando necessário. Nunca reescrever o ficheiro inteiro.
- **Versão**: subir em `app/package.json` a cada entrega (`pack.js` e os scripts leem-na daí). Não há backups manuais: o histórico é o git.
- **Texto da UI em PT-PT** no código; cada texto novo entra no `DMX_I18N` como `[pt, en, fr]` (frases com números: `DMX_I18N_RX`).
- **Tudo o que é controlável passa por `LV`**, para os faders e o MIDI continuarem a funcionar.
- **Uma só fonte de verdade**: a consola escreve nos controlos reais e é re-sincronizada em `liveRefresh()`. Os blocos do painel são **movidos**, nunca copiados.
- **Previews nunca alteram estado** (guardar/repor num `try/finally`).
- **Cues**: máximo 8. Estado novo tem de entrar em `verAtual`/`aplicar` (cues) e em `saveNow` (definições exportadas).
- **0 erros na consola.** Acrescentar passos ao `test-harness.js` para o que for novo e correr `npm test`.
- Não mudar o bundle id `pt.francisconobre.dmxpine3` nem a origem `app://dmx` (perdiam-se autorizações de áudio e definições guardadas).
- **Entrega**: normalmente só o `index.html` (e outros ficheiros alterados, dizendo onde os pôr). Perguntar antes de gastar tempo a gerar DMG ou zip.

## Comandos
```bash
npm ci                 # dependências de build (electron 45, @electron/packager, three)
npm start              # abre app/ no Electron
npm test               # harness de UI em xvfb → test-out/result.json (lento em VM)
npm run pack           # → dist/ (darwin arm64 + x64), sem asar
npm run dmg            # → release/*.dmg (precisa de xorriso + hfsprogs)
npm run update-zip     # → release/DMX_Pine3-update-<versão>.zip (docs/ATUALIZAR.md)
```
O build é feito em Linux, sem assinatura Apple: as apps são assinadas ad-hoc no Mac pelos
scripts `dmgextra/Instalar DMX_Pine3.command` e `update/Atualizar DMX_Pine3.command`.
Os ficheiros `.command` têm de manter o bit de execução (`git update-index --chmod=+x`).
