const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', Object.freeze({
  fullscreen: () => ipcRenderer.invoke('window:fullscreen'),
  quit: () => ipcRenderer.send('window:quit'),
}));
