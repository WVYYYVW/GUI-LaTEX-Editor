// 画面側へ公開する最小限の API
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  openFile: () => ipcRenderer.invoke('file:open'),
  readFile: (p) => ipcRenderer.invoke('file:read', p),
  saveFile: (args) => ipcRenderer.invoke('file:save', args),
  exportTex: (args) => ipcRenderer.invoke('export:tex', args),
  compilePdf: (args) => ipcRenderer.invoke('pdf:compile', args),
  printPdf: (args) => ipcRenderer.invoke('pdf:print', args),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  getEngine: () => ipcRenderer.invoke('tex:engine'),
  chooseEngine: () => ipcRenderer.invoke('tex:choose'),
  openDocx: () => ipcRenderer.invoke('docx:open'),
  chooseImage: (args) => ipcRenderer.invoke('fig:choose-image', args),
  readImage: (args) => ipcRenderer.invoke('fig:read-image', args),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (data) => ipcRenderer.invoke('clipboard:write', data),
  confirmDiscard: () => ipcRenderer.invoke('app:confirm-discard'),
  setDirty: (d) => ipcRenderer.send('app:dirty', d),
  setTitle: (t) => ipcRenderer.send('app:title', t),
  setRepresentedFile: (p) => ipcRenderer.send('app:represented-file', p),
  closeConfirmed: () => ipcRenderer.send('app:close-confirmed'),
  onMenu: (cb) => ipcRenderer.on('menu', (_e, action, payload) => cb(action, payload)),
});
