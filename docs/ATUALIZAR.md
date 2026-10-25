# Atualizar uma app instalada sem DMG novo

Desde a 1.7.0 a app é empacotada **sem asar**: o código fica em
`/Applications/DMX_Pine3.app/Contents/Resources/app/`. Para atualizar basta trocar
os ficheiros dessa pasta e **voltar a assinar** a app.

## Com o script (recomendado)
1. `npm run update-zip` gera `release/DMX_Pine3-update-<versão>.zip` (o script + a pasta `app/`).
2. No Mac: descompactar e fazer **clique direito → Abrir** em «Atualizar DMX_Pine3.command».
   - Se a app instalada ainda tiver `app.asar` (instalações ≤ 1.6), o script tira-o para
     `~/Library/Application Support/DMX_Pine3-backup/` e cria a pasta `app/`.
   - Copia os ficheiros, acerta `CFBundleShortVersionString` a partir de `app/package.json`,
     faz `xattr -cr`, assina ad-hoc com o requisito fixo e abre a app.
3. Nas versões seguintes também chega pôr só um `index.html` ao lado do script e corrê-lo.

Se aparecer «could not be executed because you do not have appropriate access privileges»,
o bit de execução perdeu-se (zip feito sem ele). Alternativa: no Terminal, `bash ` e arrastar
o ficheiro para a janela.

## À mão
```bash
cp index.html /Applications/DMX_Pine3.app/Contents/Resources/app/
xattr -cr /Applications/DMX_Pine3.app
codesign --force --deep -s - /Applications/DMX_Pine3.app
codesign --force -s - -r='designated => identifier "pt.francisconobre.dmxpine3"' /Applications/DMX_Pine3.app
```
Sem voltar a assinar, o macOS diz que a app está «damaged». A assinatura com identidade fixa
é o que mantém as autorizações de microfone e de áudio do sistema (TCC).

As definições, cues e MIDI mantêm-se: ficam no `localStorage` da origem `app://dmx`.
