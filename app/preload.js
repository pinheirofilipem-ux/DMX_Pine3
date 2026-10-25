// Ponte mínima e segura entre a página e o processo principal (contextIsolation).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('dmxApp', {
  resetAudioPermissions: () => ipcRenderer.invoke('dmx:reset-audio-permissions'),
  openPrivacy: (which) => ipcRenderer.invoke('dmx:open-privacy', which),
  info: () => ipcRenderer.invoke('dmx:info')
});
