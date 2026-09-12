const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isFullscreen: () => ipcRenderer.invoke('window:fullscreen-state'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  onFullscreenChange: (listener) => {
    const handler = (_event, fullscreen) => listener(fullscreen);
    ipcRenderer.on('window:fullscreen-changed', handler);
    return () =>
      ipcRenderer.removeListener('window:fullscreen-changed', handler);
  },
});
