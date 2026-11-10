/**
 * Electron Preload Script
 * Secure Context Bridge between Desktop Engine and Frontend Platform
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopUpdater', {
  isDesktop: true,
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  applyUpdate: (updateInfo) => ipcRenderer.invoke('apply-update', updateInfo),
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available-alert', (event, info) => callback(info));
  },
  onUpdateProgress: (callback) => {
    ipcRenderer.on('update-download-progress', (event, pct) => callback(pct));
  },
  onUpdateReady: (callback) => {
    ipcRenderer.on('update-download-ready', (event, info) => callback(info));
  },
  onUpdateError: (callback) => {
    ipcRenderer.on('update-download-error', (event, err) => callback(err));
  }
});
