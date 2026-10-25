// DMX_Pine3 — invólucro Electron do palco3d (index.html).
// Faz três coisas que o browser não deixa fazer bem numa sessão ao vivo:
//  1. dá à página as permissões de áudio, MIDI, captura e wake-lock sem perguntar;
//  2. captura o áudio do sistema no macOS (CoreAudio Tap, macOS 14.2+) sem BlackHole
//     nem painel de escolha de ecrã;
//  3. impede o Mac de adormecer, não abranda em segundo plano e pede confirmação
//     antes de fechar (Cmd+Q por engano a meio de um concerto).
'use strict';
const { app, BrowserWindow, Menu, dialog, session, desktopCapturer,
        systemPreferences, powerSaveBlocker, protocol, net, shell, ipcMain } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_NAME = 'DMX_Pine3';
const ORIGIN = 'app://dmx';
const TEST = process.env.DMX_TEST === '1';   // só para validação automática
const BUNDLE_ID = 'pt.francisconobre.dmxpine3';

app.setName(APP_NAME);
// origem própria, estável e "segura": localStorage, getUserMedia e Web MIDI ficam
// sempre na mesma origem (as cues e os mapeamentos MIDI não se perdem)
protocol.registerSchemesAsPrivileged([{ scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

// ao vivo: nada de abrandar timers nem o AudioContext quando a janela perde o foco
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

if (!TEST && !app.requestSingleInstanceLock()) { app.quit(); }

let win = null, sleepBlock = null, quitting = false;

const ALLOWED = new Set(['media', 'midi', 'midiSysex', 'display-capture', 'fullscreen',
  'screen-wake-lock', 'clipboard-sanitized-write', 'speaker-selection']);

function setupSession() {
  const ses = session.defaultSession;
  const fromApp = (url) => typeof url === 'string' && url.startsWith(ORIGIN);

  ses.setPermissionRequestHandler((wc, perm, cb, details) => {
    cb(ALLOWED.has(perm) && fromApp(details.requestingUrl || wc.getURL()));
  });
  ses.setPermissionCheckHandler((wc, perm, origin) => ALLOWED.has(perm) && fromApp(origin + '/'));
  ses.setDevicePermissionHandler(() => true);

  // getDisplayMedia(): ecrã inteiro + áudio do sistema ("loopback"), sem diálogo.
  // O vídeo é só o suporte que o Chromium exige; a página baixa-o para 1 fps.
  ses.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
      .then((sources) => {
        if (!sources.length) { callback({}); return; }
        callback({ video: sources[0], audio: 'loopback' });
      })
      .catch(() => callback({}));
  });

  // exportar definições: o <a download> da página abre um "Guardar como…" com a pasta Documentos
  ses.on('will-download', (e, item) => {
    item.setSaveDialogOptions({ title: 'Save DMX_Pine3 settings',
      defaultPath: path.join(app.getPath('documents'), item.getFilename()),
      filters: [{ name: 'DMX_Pine3 settings', extensions: ['json'] }] });
  });

  // app://dmx/… serve os ficheiros da pasta da app (index.html, three.min.js)
  protocol.handle('app', (req) => {
    const u = new URL(req.url);
    let p = decodeURIComponent(u.pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(__dirname, p));
    if (!file.startsWith(__dirname)) return new Response('forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

async function askMacPermissions() {
  if (process.platform !== 'darwin') return;
  try {
    // microfone/entradas de áudio (BlackHole, placa de som, interface do Ableton)
    if (systemPreferences.getMediaAccessStatus('microphone') !== 'granted')
      await systemPreferences.askForMediaAccess('microphone');
  } catch (e) { /* sem consequência: a página mostra o erro */ }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const tpl = [
    ...(isMac ? [{ label: APP_NAME, submenu: [
      { role: 'about', label: 'Acerca do ' + APP_NAME }, { type: 'separator' },
      { role: 'hide', label: 'Esconder ' + APP_NAME }, { role: 'hideOthers', label: 'Esconder outras' },
      { type: 'separator' }, { role: 'quit', label: 'Sair do ' + APP_NAME } ] }] : []),
    { label: 'File', submenu: [
      { label: 'Save settings to file…', accelerator: 'CmdOrCtrl+S', click: () => page('window.dmxExport && dmxExport()') },
      { label: 'Open settings file…', accelerator: 'CmdOrCtrl+O', click: () => page('window.dmxImport && dmxImport()') },
      { type: 'separator' },
      { label: 'Reset to default settings…', click: () => page('window.dmxReset && dmxReset()') } ] },
    { label: 'Editar', submenu: [ { role: 'undo', label: 'Desfazer' }, { role: 'redo', label: 'Refazer' },
      { type: 'separator' }, { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' },
      { role: 'paste', label: 'Colar' }, { role: 'selectAll', label: 'Selecionar tudo' } ] },
    // Sem Cmd+R: recarregar a meio de um concerto corta o áudio e a imagem.
    { label: 'Ver', submenu: [
      { role: 'togglefullscreen', label: 'Ecrã inteiro' },
      { label: 'Manter por cima de tudo', type: 'checkbox', click: (m) => win && win.setAlwaysOnTop(m.checked, 'screen-saver') },
      { type: 'separator' },
      { label: 'Recarregar (corta o áudio)', click: () => confirmReload() },
      { label: 'Ferramentas de programador', accelerator: 'Alt+CmdOrCtrl+I', click: () => win && win.webContents.toggleDevTools() } ] },
    { label: 'Ajuda', submenu: [
      { label: 'Reset audio permissions (fix silent capture)…', visible: isMac, click: () => resetAudioPermissions(true) },
      { type: 'separator', visible: isMac },
      { label: 'Definições de privacidade — Microfone', visible: isMac,
        click: () => shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone') },
      { label: 'Definições de privacidade — Gravação de ecrã e áudio', visible: isMac,
        click: () => shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture') } ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function page(js) { if (win) win.webContents.executeJavaScript(js, true).catch(() => {}); }

// Cada reinstalação muda a assinatura ad-hoc: o macOS mantém a autorização "ligada"
// nas Definições, mas deixa de a aplicar e a captura chega muda, sem erro. Repor as
// autorizações desta app obriga o macOS a perguntar de novo, já para a versão atual.
function resetAudioPermissions(ask) {
  if (process.platform !== 'darwin') return Promise.resolve(false);
  if (ask) {
    const r = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['Cancel', 'Reset and restart'], defaultId: 1, cancelId: 0,
      message: 'Reset audio permissions?',
      detail: 'Use this if audio capture stopped working after an update. The app restarts and macOS asks again for Microphone and Screen & System Audio Recording.' });
    if (r !== 1) return Promise.resolve(false);
  }
  const svc = ['Microphone', 'ScreenCapture', 'AudioCapture'];
  return Promise.all(svc.map((s) => new Promise((res) => execFile('/usr/bin/tccutil', ['reset', s, BUNDLE_ID], () => res()))))
    .then(() => { quitting = true; app.relaunch(); app.exit(0); return true; });
}
ipcMain.handle('dmx:reset-audio-permissions', () => resetAudioPermissions(true));
ipcMain.handle('dmx:open-privacy', (e, which) => shell.openExternal(which === 'mic'
  ? 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone'
  : 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'));
ipcMain.handle('dmx:info', () => ({ platform: process.platform, version: app.getVersion(),
  mic: process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('microphone') : 'n/a',
  screen: process.platform === 'darwin' ? systemPreferences.getMediaAccessStatus('screen') : 'n/a' }));

function confirmReload() {
  if (!win) return;
  const r = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['Cancelar', 'Recarregar'],
    defaultId: 0, cancelId: 0, message: 'Recarregar o palco?', detail: 'O áudio e a imagem param durante uns segundos.' });
  if (r === 1) win.webContents.reload();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 960, minWidth: 1024, minHeight: 640,
    backgroundColor: '#000000', title: APP_NAME, show: TEST ? true : false,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.once('ready-to-show', () => win.show());
  // nada de navegar para fora (largar um ficheiro errado na janela, links)
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) e.preventDefault(); });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('close', (e) => {
    if (quitting || TEST) return;
    const r = dialog.showMessageBoxSync(win, { type: 'question', buttons: ['Cancelar', 'Sair'],
      defaultId: 0, cancelId: 0, message: 'Sair do ' + APP_NAME + '?', detail: 'O palco e a captura de áudio param.' });
    if (r !== 1) e.preventDefault(); else quitting = true;
  });
  win.loadURL(ORIGIN + '/index.html');
  if (TEST) require(path.join(__dirname, '..', 'test-harness.js'))(win);
}

app.whenReady().then(async () => {
  setupSession();
  buildMenu();
  await askMacPermissions();
  sleepBlock = powerSaveBlocker.start('prevent-display-sleep');
  createWindow();
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('before-quit', () => { quitting = true;
  // guarda já as definições em disco (o localStorage pode ficar só em memória)
  try { if (win) win.webContents.executeJavaScript('window.dmxSaveNow && dmxSaveNow()', true); } catch (e) {}
  try { session.defaultSession.flushStorageData(); } catch (e) {} });
app.on('window-all-closed', () => {
  if (sleepBlock !== null && powerSaveBlocker.isStarted(sleepBlock)) powerSaveBlocker.stop(sleepBlock);
  app.quit();
});
