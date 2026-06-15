const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  navigateFolder: (folderPath) => ipcRenderer.invoke('navigate-folder', folderPath),
  onLoadMarkdown: (callback) => ipcRenderer.on('load-markdown', callback),
  onLoadError: (callback) => ipcRenderer.on('load-error', callback),
  onFileChanged: (callback) => ipcRenderer.on('file-changed', callback),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // Tab support
  openFileInTab: (filePath) => ipcRenderer.invoke('open-file-in-tab', filePath),
  closeTab: (filePath) => ipcRenderer.invoke('close-tab', filePath),
  resolveLink: (basePath, linkPath) => ipcRenderer.invoke('resolve-link', basePath, linkPath)
});
