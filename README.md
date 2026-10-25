# DMX_Pine3

Emulador de mesa de luz DMX para sessões ao vivo: um palco 3D (three.js) com painéis
«Justice», moving heads, parede Elidy e público que reage ao áudio, controlado por uma
consola skeuomórfica com faders, cues e MIDI (Akai APC mini mk2). Corre como app macOS
(Electron 45) e capta diretamente o áudio do sistema (por exemplo o Ableton).

- **App**: `app/index.html` (tudo: UI, 3D, áudio, MIDI, EN/PT/FR) + invólucro Electron.
- **Instalar**: DMG de `npm run dmg` → «Instalar DMX_Pine3.command» (clique direito → Abrir).
- **Atualizar sem DMG**: ver [docs/ATUALIZAR.md](docs/ATUALIZAR.md).
- **Arquitetura e decisões**: [docs/HANDOFF.md](docs/HANDOFF.md).

```bash
npm ci && npm start
```
