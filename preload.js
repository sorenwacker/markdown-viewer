const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('open-file'),
  openFolder: () => ipcRenderer.invoke('open-folder'),
  navigateFolder: (folderPath) => ipcRenderer.invoke('navigate-folder', folderPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  exportPdf: (orientation) => ipcRenderer.invoke('export-pdf', orientation),
  onLoadMarkdown: (callback) => ipcRenderer.on('load-markdown', callback),
  onLoadError: (callback) => ipcRenderer.on('load-error', callback)
});
