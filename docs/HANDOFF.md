# DMX_Pine3 — documento de passagem (handoff)

Estado em 25/10/2026 · versão **1.7.0** · autor do projeto: Francisco

> Secções 1–9 escritas na v1.5.0; o que mudou na v1.6.0 e v1.7.0 está na secção 10.

## 1. O que é

O DMX_Pine3 emula uma mesa de luz DMX para sessões ao vivo:
- Um palco 3D (three.js r128) com público que reage ao áudio, moving heads, feixes, ecrãs LED, a parede Elidy e 13 painéis «Justice» suspensos por guinchos (palco «Justice WWW», id interno `accor`).
- Uma consola skeuomórfica (inspirada na CueLux) com faders, cues, padrões, MIDI (Akai APC mini mk2) e captura de áudio do sistema.

É **um único ficheiro HTML** (`app/index.html`) com CSS, JS e o dicionário de idiomas embutidos. Esse ficheiro é empacotado como app macOS com **Electron 45** e distribuído em **DMG** (arm64 e x64).

O utilizador usa a app num **ecrã 4K**, com o **Ableton** a tocar no mesmo Mac. Fala PT-PT e prefere correções cirúrgicas a reescritas completas.

## 2. Estrutura de ficheiros

```
DMX_Pine3/
├── app/                      ← o que vai dentro da app (pasta Contents/Resources/app, sem asar)
│   ├── index.html            ← TUDO: UI, 3D, áudio, MIDI, i18n (~4580 linhas)
│   ├── main.js               ← processo principal Electron
│   ├── preload.js            ← ponte segura (contextBridge) → window.dmxApp
│   ├── three.min.js          ← three.js r128 local (offline ao vivo)
│   └── package.json          ← a VERSÃO da app vive aqui (pack.js e scripts leem-na)
├── build/DMX_Pine3.icns|png  ← ícone (gerado por make_icon.py)
├── dmgextra/                 ← vai para a raiz do DMG
│   ├── Instalar DMX_Pine3.command
│   └── LEIA-ME.txt
├── update/Atualizar DMX_Pine3.command ← atualiza uma app instalada sem DMG (docs/ATUALIZAR.md)
├── scripts/                  ← make-dmg.sh, apm_hfs.py, make-update-zip.sh, test.sh
├── pack.js                   ← @electron/packager → dist/ (darwin arm64 + x64)
├── test-harness.js           ← testes automáticos de UI (só com DMX_TEST=1)
└── make_icon.py              ← gera o ícone (Pillow)
```
As versões anteriores do HTML estão no histórico do git (`git log -- app/index.html`), já não em `backups/`.

`main.js` só carrega o `test-harness.js` quando `DMX_TEST=1`; o harness não vai para dentro da app.

## 3. Arquitetura do `index.html`

O script é um IIFE com `'use strict'`. `$=id=>document.getElementById(id)`. Os comentários do código estão em PT, e **o texto de origem da UI também está em PT-PT** (ver i18n).

| Zona | O que faz | Funções / nomes-chave |
|---|---|---|
| Áudio | AudioContext + AnalyserNode (FFT 4096) e 8 bandas. Fontes: `getDisplayMedia` (áudio do sistema), `getUserMedia` (entrada), demo sintetizada, ficheiro. Reconexão automática e vigia de sinal | `startSystem`, `startDevice`, `startDemo`, `startFile`, `onLost`, `autoReconnect`, `religarAudio`, `avisoMudo`, `analyse` |
| Níveis de luz | Tudo o que emite luz passa por `LV` (14 níveis) | `LV`, `LV_LAB`, `lvApply`, `lvMestre`, `lvSet` |
| Cena 3D | Palcos em `STAGES` (accor = Justice WWW, coachella, tomorrowland, glasto, ultra, rockinrio) | `buildStage`, `freezeStatic`, `applyQuality`, `resize` |
| Painéis Justice | 13 painéis em `jp[]` (grupos A, B, M), guinchos L/R com velocidade e aceleração limitadas, cardã (rx/ry) | `RECT_PATTERNS`, `rectPatternState`, `jTarget`, `rectLim`, `updateJ`, `applyRectPattern` |
| Secções da música | intro / groove / build / drop / break. **Só deteta com `secAuto` ligado** | `secUpdate`, `setSecAuto`, `SEC` |
| Moving heads | 8 + 20 no teto (Accor) | `MH_PATTERNS`, `mhPatternState`, `updateHeads`, `updateCeil` |
| Cues | Até 8; cada uma guarda um «look» completo + padrão dos painéis | `cues`, `chamarCue`, `verAtual`, `aplicar`, `renderCues` |
| Undo | Histórico de 24 estados | `registar`, `mexidaGrande`, `voltarAtras` |
| MIDI | Web MIDI, MIDI Learn, perfis APC mini mk2 / mk1 / genérico, LEDs de feedback | `midiAllDefs`, `midiApply`, `midiMessage`, `akaiSlots`, `APC`, `apcLeds` |
| Consola | Faders físicos (2 bancos × 8, LIGHT + FX) + MASTER | `BANKS`, `makeFader`, `renderBank`, `faderSyncAll`, `MASTER` |
| Layout | Colunas e cartões redimensionáveis; blocos do painel podem entrar na consola | `renderLayout`, `autoCols`, `autoLayout`, `lerLayout`, `guardaCustom`, `setEdit` |
| Previews | Callout no hover que simula a ação **sem mexer no estado real** | `pvShow`, `pvConteudo`, `pvDrawer`, `pvPainel`, `pvHeads`, `pvCam`, `pvStage`, `pvRange` |
| i18n | EN (omissão) / PT / FR | `DMX_I18N` (`[pt,en,fr]`), `DMX_I18N_RX`, `tr`, `setLang`, `MutationObserver` |
| Definições | Gravação automática + exportar/importar `.json` + repor origem | `saveNow`, `saveSoon`, `dmxSaveNow`, `dmxExport`, `dmxImport`, `dmxReset` |
| Loop | `requestAnimationFrame`, limite de fps, sem render com a janela escondida | `frameFn`, `loop` |

### Princípios a manter

1. **Uma só fonte de verdade.** Os botões e faders da consola não guardam estado próprio: escrevem nos controlos reais (inputs do painel, `LV`) e são re-sincronizados em `liveRefresh()` (de 6 em 6 frames: `faderSyncAll`, `apcLeds`, `syncRanges`, `pnSync`).
2. **Os blocos do painel são movidos, nunca copiados.** Os `<details class="banco" data-g="…">` mudam de pai entre `#panel` e os `.card` da consola, e assim ids, handlers e estado mantêm-se. Os ids `data-g` são: `som`, `palco`, `luz`, `paineis`, `camera`, `ecras`, `heads`, `mesa`.
3. **Os previews não podem alterar estado.** `pvPainel` e `pvHeads` guardam e repõem `rectPattern`, `gridDeck`, `mhPattern`, etc. num `try/finally`.
4. **Texto novo na UI** deve ser escrito em **PT-PT** no código e acrescentado ao `DMX_I18N` como `[pt, en, fr]`. Para frases com números, usar `DMX_I18N_RX`. O tradutor também parte as frases por ` · `, ` — `, ` › `, ` → `, `: `, `, ` e parênteses.

### Layout da consola (v1.5)
- `#bar` contém `.col` (colunas, largura = `flex-grow`), separadas por `.splitV`. Cada coluna tem `.card` (altura = `flex-grow`), separados por `.splitH`.
- **Cartões fixos:** `status`, `cues`, `heads`, `panels`, `faders`, `master`, `actions`. **Blocos do painel:** `b:<data-g>`.
- **AUTO** (`autoCols`): gera as colunas para a largura atual e acrescenta blocos de 300 px por esta ordem: `som, paineis, heads, ecras, camera, luz, palco, mesa`.
- **CUSTOM:** passa a este modo ao arrastar um divisor ou mover um cartão no modo LAYOUT (botão ▦). Fica guardado em `localStorage.dmxpine3_layout2` como `{mode, cols:[{w, cards:[{id, h}]}]}`.

### Padrões dos painéis (`RECT_PATTERNS`)
`audio, wave, fan, ripple, alternating, grid, diagonal, pendulum (olho), hit, tunnel, off`.
- **`tunnel`:** os painéis com |x| < 8 ficam deitados (`rx=DOWN`) e fazem o tecto. Os de fora descem até L ≈ 19,6 / 23,2 m e rodam (p ≈ 0,72 / 1,0 rad).
- **`off`:** L ≈ 1,6 m (junto ao truss), e a luz desce até zero via `p.offK`.
- `rectLim(id)` define os limites de guincho e rotação por padrão.
- **Velocidade:** os guinchos movem-se a 1,4 m/s com aceleração de 1,2 m/s², por isso o túnel demora ~7 s a formar-se.

### APC mini mk2 (protocolo oficial da Akai)
- **Pads:** notas 0–63, **0 = canto inferior esquerdo** (assumido; se estiver ao contrário, há a opção «Linha 1 em cima»).
- **Botões:** faixa 100–107, cena 112–119, shift 122.
- **Faders:** CC 48–56 (o 56 é o master).
- **LEDs dos pads:** Note On, canal 0–6 = brilho, velocity = cor da paleta.
- **mk1:** faixa 64–71, cena 82–89, shift 98.

## 4. Persistência (`localStorage`)
| Chave | Conteúdo |
|---|---|
| `palco3d_v3` | Estado geral (níveis `lv`, cores, tons, padrões, vista, banco, `secAuto`, `jpAuto`, última fonte de áudio, drawers…) |
| `palco3d_cues` | Cues |
| `palco3d_midi_v1` | Mapeamentos MIDI |
| `palco3d_akai_v1` | Perfil do controlador (`prof`, `flip`, `base`, `cc`) |
| `palco3d_bancos` | Bancos do painel abertos/fechados |
| `dmxpine3_layout2` | Layout da consola |
| `dmxpine3_lang` | Idioma |

O ficheiro exportado tem este formato: `{app:'DMX_Pine3', format:1, saved, data:{<todas as chaves palco3d_* e dmxpine3_*>}}`. Ao importar, substitui as chaves e recarrega a página.

## 5. Electron (`main.js` / `preload.js`)
- **Origem:** protocolo próprio `app://dmx/index.html` (origem estável, por isso o `localStorage` persiste).
- **Permissões:** `media`, `midi`, `display-capture`, `screen-wake-lock` e `fullscreen` são concedidas automaticamente.
- **Áudio do sistema:** `setDisplayMediaRequestHandler` responde com `{video: screen, audio: 'loopback'}`. Usa o CoreAudio Tap e precisa de macOS 14.2+ e de `NSAudioCaptureUsageDescription` no `Info.plist`.
- **Ao vivo:** `powerSaveBlocker` (não adormece), sem throttling em segundo plano, confirmação ao sair, sem Cmd+R.
- **Menu File:** Save / Open settings (Cmd+S / Cmd+O), que chamam `window.dmxExport` e `window.dmxImport`.
- **Menu Ajuda:** «Reset audio permissions», que corre `tccutil reset Microphone|ScreenCapture|AudioCapture pt.francisconobre.dmxpine3` e reinicia a app.
- **`preload.js`** expõe `window.dmxApp = { resetAudioPermissions, openPrivacy, info }`.
- **Bundle id:** `pt.francisconobre.dmxpine3`.

## 6. Build e DMG (feito em Linux)
```bash
npm ci                           # electron 45, @electron/packager, three 0.128
npm run icon                     # só se o ícone mudar
npm run pack                     # → dist/DMX_Pine3-darwin-{arm64,x64}/DMX_Pine3.app
npm run dmg                      # → release/DMX_Pine3-<versão>-{arm64,x64}.dmg
npm run update-zip               # → release/DMX_Pine3-update-<versão>.zip
```
- **Release no GitHub:** `.github/workflows/release.yml` gera os dois DMG e publica-os ao enviar uma tag `vX.Y.Z` (igual à versão de `app/package.json`), ou à mão em Actions → Release.
- **Versão:** está em `app/package.json` e deve subir a cada entrega (o `pack.js` lê-a daí).
- **Sem asar** (desde 1.7.0): o código fica em `Contents/Resources/app/`, por isso uma app instalada atualiza-se trocando o `index.html` e voltando a assinar (ver `docs/ATUALIZAR.md`). Atenção: se existir `app.asar`, o Electron ignora a pasta `app/`.
- **DMG** (`scripts/make-dmg.sh`): criado com `xorriso` (imagem híbrida ISO/HFS+), seguido de uma correção do volume HFS+ com `fsck.hfsplus` (`apt install xorriso hfsprogs`). Para cada arquitetura:
  1. `stage-<arch>/` leva `DMX_Pine3.app`, os ficheiros de `dmgextra/*` e um symlink `Applications → /Applications`.
  2. `xorriso -as mkisofs -V DMX_Pine3 -R -hfsplus -apm-block-size 2048 -o DMX_Pine3-<ver>-<arch>.dmg stage-<arch>`
  3. Extrair a partição `Apple_HFS` (ler o Apple Partition Map, blocos de 2048), correr `fsck.hfsplus -fy` duas vezes, voltar a escrever a partição com `dd conv=notrunc` e confirmar com `fsck.hfsplus -fn` que diz «appears to be OK».
- **Não há assinatura Apple** (sem conta de programador). O `Instalar DMX_Pine3.command`:
  - confirma a arquitetura;
  - copia a app para `/Applications`;
  - faz `xattr -cr`;
  - assina ad-hoc com o requisito fixo `designated => identifier "pt.francisconobre.dmxpine3"` (para as autorizações de áudio sobreviverem às atualizações);
  - faz `tccutil reset` e abre a app.
  - Se algum passo falhar, para e mostra o erro.
  - O utilizador tem de o abrir com **clique direito → Abrir**.

## 7. Testes
`npm test` (= `scripts/test.sh`) corre o comando abaixo e resume o resultado:
```bash
DMX_TEST=1 DMX_OUT=$PWD/out xvfb-run -a -s "-screen 0 3200x1800x24" \
  npx electron --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader \
  --use-fake-ui-for-media-stream --use-fake-device-for-media-stream app
```
- O resultado vai para `out/result.json` (`steps` + `log` da consola) e capturas `.png`.
- A v1.5.0 passa **91 passos com 0 erros na consola**. Os testes cobrem:
  - atalhos de teclado, palcos e qualidade;
  - captura de áudio e MIDI;
  - faders e divisores;
  - layout (4K/1600 px, arrastar cartões, AUTO);
  - Tunnel/Off;
  - previews, as 3 línguas (procura texto PT por traduzir) e export/import.
- Para testar a app empacotada: `node -e "require('@electron/packager').packager({dir:'app',platform:'linux',arch:'x64',asar:true,out:'distlinux',...})"`, copiar o `test-harness.js` para `resources/` e correr o binário da mesma forma.

## 8. Histórico de decisões e erros corrigidos
- **v1.0:** o HTML original não arrancava. As causas eram um `};` a mais em `STAGES`, o palco `'festival'` inexistente, ReferenceErrors em `updateJ` (`jpLit`/`jpN`/`wp`) e IDs duplicados. Também corrigi a nota base e o CC base do Akai, que estavam acoplados.
- **v1.1:** consola skeuomórfica e vistas SALA/MESA (tecla V).
  - O mapa do APC estava errado (a grelha partia da nota 36, com o pad 1 em cima).
  - O padrão duplicado «Reage com a secção» foi fundido em «Áudio · orgânico».
  - A deteção de secção passou a funcionar só com SECÇÃO AUTO.
- **v1.2:** «damaged» / áudio mudo depois de reinstalar. A causa é o TCC do macOS, que deixa de aplicar a autorização quando a assinatura ad-hoc muda. Resolvido com a assinatura de requisito fixo, o `tccutil reset` e o botão «Fix permissions» dentro da app.
  - Também: drawers (S / K / H), i18n EN/PT/FR e definições em ficheiro.
- **v1.3:** cues compactas, placa PANELS na consola e faders em 2 filas (8 + 8).
- **v1.4:** os faders passam a usar `pointerrawupdate`, que reduz o atraso com o palco 3D a carregar o processador.
- **v1.5:** layout em colunas e cartões redimensionáveis, e padrões Tunnel e Off.
  - **Erro corrigido:** ao encolher a janela, os blocos que saíam da consola eram apagados em vez de voltarem ao painel (`renderLayout` tem de chamar `paraDrawer` **antes** de remover as colunas velhas).

## 9. Pendentes e limitações conhecidas
- Nada foi testado em hardware real (Mac nem APC). O build é feito em Linux, e a orientação «nota 0 = em baixo à esquerda» do APC é uma suposição.
- Os LEDs do APC só são enviados para saídas MIDI cujo nome contém «apc».
- O DMG não é comprimido (~265 MB) e não tem layout de janela personalizado.
- Em 4K, a fluidez dos faders depende da carga do render. Se ainda houver atraso, a recomendação é Resolução 75% (bloco Desk).
- Ideias que ficaram no ar: tornar o túnel mais rápido para drops; um editor de cues na consola.

## 10. v1.6.0 e v1.7.0

### v1.6.0 (feita noutro agente)
- Palco «Accor Arena · Justice» substituído por **«Justice WWW»** (Woman Worldwide Tour), com o mesmo id `accor` para as definições e cues antigas continuarem a funcionar.
- **13 painéis** em `jp[]`: grupo **A** (arco de cima, 4), **B** (arco de baixo, 4) e **M** (linha atrás da dupla, 5).
- Cruz LED (`jCross[]`) removida; **Marshalls**: 4 grupos de 3×3, que acendem com o áudio e o fader LEDS, na cor dos painéis M.
- Cor dos painéis «Justice WWW · azul / violeta / rosa» como predefinição.

### v1.7.0 — animação dos painéis e parede Elidy
Módulo novo antes de `function updateJ`:
- **Estado `PJ`**: `{mode:'foco'|'ecra'|'misto', grp:{A,B,M}, uni, pre, foc, tgt, c1, c2, spd, react, trans}`.
- **Modos**: FOCO (face com 2×2 lâmpadas e feixes fortes; o painel vira-se para o alvo), ECRÃ (animação nas ripas, feixe fraco, a luz segue a cor média do que mostra) e MISTO (A/B/M independentes). **Unido** (`uni`) = uma imagem repartida pelos 13 painéis.
- **Presets de ecrã** `PJ_PRE`: faiscas, chuva, eq, varre, cascata, strobe, respirar, cruz. Desenho em `drawPP` (coordenadas de campo).
- **Padrões de foco** `PJ_FOC`: converge, starfan, crossed, sweep, twoblocks (c1 contra azul `0x4d7bff`), rain, strobe, off.
- **Apontamento a alvos**: `pjFocTarget`, `pjFocFace`, `pjTurn`; feixes em `pjBeamsEnsure`/`pjBeams` (2 feixes estreitos por painel, limite mecânico 78°, com inércia). Alvos: `centro`, DJs, cruz da parede.
- **Transição** `PJ_TR` por grupo, fade ao preto de `PJ_FADE = 0.6` s, medida em **tempo real** (`sd`, limitado a 0,25 s), não no `dt` do motor (que é limitado a 0,05 s e fazia o fade arrastar-se com poucos fps).
- **Parede Elidy**: posição `{x:0, y:5.3, z:-29.6, w:22, h:7.7}`; estado `EL = {on, pre, c1, c2, spd, react, txt, src}`; 10 presets `EL_PRE` (cruz, faíscas, cruz+faíscas, espectro, pixel, scanner, pulso, aurora, texto, preto/branco); desenho em `drawElidy`/`elidyWall`, chamada a partir de `drawScreens`.
- **LV**: novos níveis `foco` (0,85) e `elidy` (1). No banco FX, o fader Cross passou a **Elidy** e o Panel halo a **Focus**.
- **UI**: cartão `pl-anim` na consola (`anim` em PLATE/`autoCols`, por baixo dos painéis); bloco de drawer `data-g="elidy"`; `pjSrc` tem a opção `pp`. Previews `pvPP`, `pvFoc`, `pvKE`. MIDI: grupos «Animação dos painéis» e «Elidy».
- **Cues e definições**: `verAtual`/`aplicar` levam `pjA` e `el`; `saveNow` grava os dois. Os padrões «Foco ·» da v1.6 migram para os padrões de feixe em `applyRectPattern`.
- **Testes**: 101 passos (incluindo «v1.7 ·»), 0 erros na consola, nada por traduzir em EN/FR.

### Por confirmar com o utilizador
- Face em FOCO: 4 lâmpadas + ripas a ~25 % (o handoff pedia «cor sólida»).
- Significado do preset Elidy «Preto / Branco».
- Tamanho da parede (22 × 7,7 m) e transição (fade ao preto) ficaram nos valores por omissão.
- Nada testado num Mac nem num APC reais.
