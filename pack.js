// Empacota a app para macOS (arm64 e x64) a partir de Linux.
const { packager } = require('@electron/packager');
const path = require('path');
const VERSION = require('./app/package.json').version;   // a versão vive só em app/package.json
(async () => {
  for (const arch of (process.argv[2] || 'arm64,x64').split(',')) {
    const out = await packager({
      dir: path.join(__dirname, 'app'),
      name: 'DMX_Pine3',
      executableName: 'DMX_Pine3',
      platform: 'darwin', arch,
      electronVersion: require('electron/package.json').version,
      icon: path.join(__dirname, 'build', 'DMX_Pine3.icns'),
      appBundleId: 'pt.francisconobre.dmxpine3',
      appVersion: VERSION, buildVersion: '1',
      appCategoryType: 'public.app-category.music',
      appCopyright: '© 2026 Francisco Nobre Pinheiro',
      darwinDarkModeSupport: true,
      asar: false,          // pasta Resources/app (não app.asar): para atualizar basta trocar o index.html
      out: path.join(__dirname, 'dist'), overwrite: true, prune: true,
      ignore: [/^\/node_modules/, /\.DS_Store$/],
      extendInfo: {
        NSMicrophoneUsageDescription: 'O DMX_Pine3 ouve a entrada de áudio (placa de som, BlackHole, Ableton) para pôr as luzes e o público a reagir à música.',
        NSAudioCaptureUsageDescription: 'O DMX_Pine3 ouve o áudio que o Mac está a tocar (por exemplo o Ableton) para as luzes reagirem à música.',
        NSCameraUsageDescription: 'O DMX_Pine3 não usa a câmara.',
        NSHighResolutionCapable: true,
        LSMinimumSystemVersion: '12.0',
        NSSupportsAutomaticGraphicsSwitching: false
      }
    });
    console.log('ok', out);
  }
})().catch((e) => { console.error(e); process.exit(1); });
