const { contextBridge, ipcRenderer } = require('electron');

// Bridge for the hidden export window: it receives the document HTML and
// reports back once the page (including diagrams) is ready to be printed.
contextBridge.exposeInMainWorld('printAPI', {
  onContent: (callback) => ipcRenderer.on('print-content', callback),
  ready: (info) => ipcRenderer.send('print-ready', info),
  failed: (message) => ipcRenderer.send('print-failed', message)
});
