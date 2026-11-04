const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs').promises;
const fsSync = require('fs');
const { Marked } = require('marked');

let mainWindow;
let fileToOpen = null;

// Run without showing any window, for the automated test suite. Hidden windows
// keep rendering at full rate so layout, timers, and animation frames behave as
// in a visible window.
const headless = process.env.MARKDOWN_VIEWER_HEADLESS === '1';

// Map of file path -> { watcher, debounceTimer }
const fileWatchers = new Map();

// Paths of documents currently open in a tab. save-file only writes to these,
// so the channel cannot be used to write arbitrary files.
const openDocuments = new Set();

// Number of tabs with unsaved edits, reported by the renderer. The window close
// confirmation reads it.
let unsavedCount = 0;

// Set once the close confirmation is answered, so the repeated close goes
// through instead of asking again.
let closeConfirmed = false;

// Whether the pending close came from quitting the app. Cancelling a close also
// cancels the quit, so a confirmed close has to resume it; on macOS closing the
// window alone would leave the app running.
let quitting = false;

// Resolves the renderer's reply to a save-all request.
let saveAllReply = null;

// Ask what to do with unsaved edits when the window is closing, then close it
// unless the answer was Cancel or a save failed.
async function confirmCloseWithUnsavedEdits() {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Save All', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: unsavedCount === 1
      ? 'A document has unsaved changes.'
      : `${unsavedCount} documents have unsaved changes.`,
    detail: 'Closing the window discards them unless they are saved.'
  });
  if (response === 2 || !mainWindow) {
    quitting = false;
    return;
  }

  if (response === 0) {
    const saved = await new Promise(resolve => {
      saveAllReply = resolve;
      mainWindow.webContents.send('save-all-requested');
    });
    saveAllReply = null;
    // A failed write leaves the window open with the error on its tab.
    if (!saved) {
      quitting = false;
      return;
    }
  }

  unsavedCount = 0;
  closeConfirmed = true;
  if (quitting) {
    app.quit();
  } else if (mainWindow) {
    mainWindow.close();
  }
}

// Handle file opening on macOS
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  fileToOpen = filePath;

  if (mainWindow) {
    loadMarkdownFile(filePath);
  }
});

function createMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'GitHub Repository',
          click: async () => {
            await shell.openExternal('https://github.com/sorenwacker/markdown-viewer');
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/sorenwacker/markdown-viewer/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'Support Development',
          click: async () => {
            await shell.openExternal('https://buymeacoffee.com/soerendip');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: !headless,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: !headless
    },
    title: 'Markdown Viewer',
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('renderer.html');

  // Handle file opening from command line (Windows/Linux)
  if (process.platform !== 'darwin' && process.argv.length >= 2) {
    const filePath = process.argv[process.argv.length - 1];
    if (filePath.endsWith('.md')) {
      fileToOpen = filePath;
    }
  }

  // Load file if one was specified
  if (fileToOpen) {
    mainWindow.webContents.on('did-finish-load', () => {
      loadMarkdownFile(fileToOpen);
    });
  }

  // Confirm before discarding unsaved edits. The close is cancelled while the
  // answer (and any saving) is awaited, then repeated once it is settled.
  mainWindow.on('close', (event) => {
    if (unsavedCount === 0 || closeConfirmed) return;
    event.preventDefault();
    confirmCloseWithUnsavedEdits();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Watch a file for changes (multi-file support)
function watchFile(filePath) {
  // If already watching this file, do nothing
  if (fileWatchers.has(filePath)) {
    return;
  }

  // Set up new watcher with debounce. The timer is stored on the map entry so
  // unwatchFile can clear a pending reload (a local variable would not be
  // visible to it, leaving a reload to fire after the file is unwatched).
  const entry = { watcher: null, debounceTimer: null };
  try {
    entry.watcher = fsSync.watch(filePath, (eventType) => {
      if (eventType === 'change') {
        // Debounce to avoid multiple reloads
        if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
        entry.debounceTimer = setTimeout(async () => {
          // No window to receive the update (the macOS app stays alive with the
          // window closed) — skip the disk read and parse entirely.
          if (!mainWindow) return;
          // Re-parse the file and send updated content
          try {
            const data = await parseMarkdownFile(filePath);
            if (mainWindow) {
              mainWindow.webContents.send('file-changed', {
                filePath,
                ...data
              });
            }
          } catch (error) {
            console.error('Error reloading file:', error);
          }
        }, 100);
      }
    });
    fileWatchers.set(filePath, entry);
  } catch (error) {
    console.error('Error watching file:', error);
  }
}

// Stop watching a file
function unwatchFile(filePath) {
  const watcherData = fileWatchers.get(filePath);
  if (watcherData) {
    if (watcherData.debounceTimer) {
      clearTimeout(watcherData.debounceTimer);
    }
    watcherData.watcher.close();
    fileWatchers.delete(filePath);
  }
}

// Generate slug from text for heading IDs
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
}

// Escape a string for safe interpolation into an HTML attribute value.
function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Resolve a markdown image source so embedded images display. Absolute URLs
// (http(s), data:, file:, protocol-relative) are kept as-is; a path relative to
// the markdown file is converted to an absolute file:// URL so it loads
// regardless of the renderer's own location.
function resolveImageSrc(src, filePath) {
  if (!src) return '';
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) {
    return src;
  }
  const absolute = path.resolve(path.dirname(filePath), src);
  return pathToFileURL(absolute).href;
}

// Render markdown text to HTML and extract its outline. filePath is the
// document the text belongs to; relative image paths resolve against it.
function parseMarkdown(content, filePath) {
  // Track heading IDs to handle duplicates
  const headingIds = {};

  // Custom renderer to add IDs to headings and handle mermaid code blocks
  const renderer = {
    heading(text, level, _raw) {
      // Handle both old API (text, level, raw) and new API (object)
      let headingText, headingLevel;

      if (typeof text === 'object') {
        // New marked v11+ API - token object
        headingText = text.text || '';
        headingLevel = text.depth || 1;
      } else {
        // Old API - separate arguments
        headingText = text;
        headingLevel = level;
      }

      let slug = generateSlug(headingText);

      // Handle duplicate IDs
      if (headingIds[slug]) {
        headingIds[slug]++;
        slug = `${slug}-${headingIds[slug]}`;
      } else {
        headingIds[slug] = 1;
      }

      return `<h${headingLevel} id="${slug}">${headingText}</h${headingLevel}>\n`;
    },
    image(href, title, text) {
      // Handle both old API (href, title, text) and new API (token object)
      let imgHref, imgTitle, imgText;

      if (typeof href === 'object') {
        imgHref = href.href || '';
        imgTitle = href.title || '';
        imgText = href.text || '';
      } else {
        imgHref = href || '';
        imgTitle = title || '';
        imgText = text || '';
      }

      const src = escapeAttribute(resolveImageSrc(imgHref, filePath));
      const altAttr = ` alt="${escapeAttribute(imgText)}"`;
      const titleAttr = imgTitle ? ` title="${escapeAttribute(imgTitle)}"` : '';
      return `<img src="${src}"${altAttr}${titleAttr}>`;
    },
    code(code, language) {
      // Handle both old API (code, language) and new API (object)
      let codeText, codeLang;

      if (typeof code === 'object') {
        // New marked v11+ API - token object
        codeText = code.text || '';
        codeLang = code.lang || '';
      } else {
        // Old API - separate arguments
        codeText = code;
        codeLang = language || '';
      }

      // Handle mermaid code blocks specially
      if (codeLang === 'mermaid') {
        return `<div class="mermaid">${codeText}</div>\n`;
      }

      // Default code block rendering
      const langClass = codeLang ? ` class="language-${codeLang}"` : '';
      const escaped = codeText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      return `<pre><code${langClass}>${escaped}</code></pre>\n`;
    }
  };

  // Use a per-parse Marked instance so options and the renderer (which closes
  // over this call's headingIds) are scoped to this call rather than mutating
  // the shared global marked singleton on every parse.
  const md = new Marked({
    breaks: true,
    gfm: true,
    renderer: renderer
  });

  // Parse markdown to HTML
  let html = md.parse(content);

  // Wrap tables in a container with toggle button
  html = wrapTablesWithToggle(html);

  // Extract headings for outline
  const outline = extractOutline(html);

  return { html, outline };
}

// Read and parse a markdown file and return the rendered data
async function parseMarkdownFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return {
    ...parseMarkdown(content, filePath),
    markdown: content,
    filePath,
    fileName: path.basename(filePath)
  };
}

async function loadMarkdownFile(filePath, setupWatcher = true) {
  try {
    const data = await parseMarkdownFile(filePath);

    openDocuments.add(filePath);
    mainWindow.webContents.send('load-markdown', data);

    // Set up file watcher
    if (setupWatcher) {
      watchFile(filePath);
    }
  } catch (error) {
    console.error('Error reading file:', error);
    mainWindow.webContents.send('load-error', error.message);
  }
}

// Wrap tables in a container with toggle button
function wrapTablesWithToggle(html) {
  const tableRegex = /(<table[^>]*>[\s\S]*?<\/table>)/gi;
  let tableIndex = 0;

  return html.replace(tableRegex, (match) => {
    tableIndex++;
    return `
      <div class="table-wrapper" id="table-wrapper-${tableIndex}">
        <button class="table-toggle" data-table-id="${tableIndex}">Fit Width</button>
        ${match}
      </div>
    `;
  });
}

// Extract headings from HTML for outline/table of contents
function extractOutline(html) {
  const headingRegex = /<h([1-6])([^>]*?)>(.*?)<\/h\1>/gi;
  const outline = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const attributes = match[2];
    const text = match[3].replace(/<[^>]*>/g, ''); // Strip HTML tags from heading text

    // Extract id from attributes
    const idMatch = attributes.match(/id="([^"]+)"/);
    const id = idMatch ? idMatch[1] : '';

    outline.push({
      level: level,
      text: text,
      id: id
    });
  }

  return outline;
}

// Handle open file request from renderer
ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    await loadMarkdownFile(filePath);
    return true;
  }
  return false;
});

// Handle open folder request from renderer
ipcMain.handle('open-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];
    const fileTree = await buildFileTree(folderPath);
    const folderName = path.basename(folderPath);
    return { success: true, path: folderPath, tree: fileTree, name: folderName };
  }
  return { success: false };
});

// Handle navigate to folder request from renderer
ipcMain.handle('navigate-folder', async (event, folderPath) => {
  try {
    const fileTree = await buildFileTree(folderPath);
    const folderName = path.basename(folderPath);
    return { success: true, path: folderPath, tree: fileTree, name: folderName };
  } catch (error) {
    console.error('Error navigating to folder:', error);
    return { success: false };
  }
});

// Handle opening external URLs. Validate the scheme here because this channel
// is reachable from any renderer-context code, so the renderer-side checks are
// not a security boundary; shell.openExternal can otherwise launch arbitrary
// protocol handlers.
ipcMain.handle('open-external', async (event, url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  if (!['http:', 'https:', 'mailto:', 'file:'].includes(parsed.protocol)) {
    return;
  }
  await shell.openExternal(url);
});

// Write text to the system clipboard. The clipboard lives in the main process,
// so the renderer's copy action is routed here rather than relying on the
// renderer's restricted clipboard access.
ipcMain.handle('copy-to-clipboard', async (event, text) => {
  clipboard.writeText(String(text ?? ''));
  return true;
});

// Handle opening a file in a new tab (returns parsed data without sending to renderer)
ipcMain.handle('open-file-in-tab', async (event, filePath) => {
  try {
    const data = await parseMarkdownFile(filePath);
    openDocuments.add(filePath);
    watchFile(filePath);
    return { success: true, ...data };
  } catch (error) {
    console.error('Error opening file in tab:', error);
    return { success: false, error: error.message };
  }
});

// Handle closing a tab (stop watching the file)
ipcMain.handle('close-tab', async (event, filePath) => {
  openDocuments.delete(filePath);
  unwatchFile(filePath);
  return true;
});

// Render edited text for the edit-mode preview, with the parser used for files.
ipcMain.handle('render-markdown', async (event, filePath, markdown) => {
  return parseMarkdown(String(markdown ?? ''), filePath);
});

// Write edited text to an open document and return the parsed result.
ipcMain.handle('save-file', async (event, filePath, markdown) => {
  if (!openDocuments.has(filePath)) {
    return { success: false, error: 'The file is not open in a tab.' };
  }
  const content = String(markdown ?? '');
  try {
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    return { success: false, error: error.message };
  }
  return { success: true, ...parseMarkdown(content, filePath), markdown: content };
});

// The renderer reports the outcome of a save-all requested at window close.
ipcMain.handle('save-all-finished', async (event, saved) => {
  if (saveAllReply) saveAllReply(!!saved);
});

// The renderer reports how many tabs have unsaved edits.
ipcMain.handle('set-unsaved-count', async (event, count) => {
  unsavedCount = Number(count) || 0;
});

// Ask what to do with a modified tab being closed: 'save', 'discard', or 'cancel'.
ipcMain.handle('confirm-close-modified', async (event, fileName) => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: `Save changes to ${fileName}?`,
    detail: 'Your changes are lost if you don\'t save them.'
  });
  return ['save', 'discard', 'cancel'][response] ?? 'cancel';
});

// Ask whether to discard a modified tab's edits before reloading: true to discard.
ipcMain.handle('confirm-discard', async (event, fileName) => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Discard Changes', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `Discard unsaved changes to ${fileName}?`,
    detail: 'The file is reloaded from disk.'
  });
  return response === 0;
});

// How long the export page may take to render before the export is abandoned.
const EXPORT_RENDER_TIMEOUT_MS = 20000;

// Render a document's HTML in a hidden window and return it as PDF bytes. The
// window loads print.html, which reports back once diagrams are drawn, so the
// PDF is never captured mid-render.
async function renderPdf(html) {
  const printWindow = new BrowserWindow({
    show: false,
    // The window is never shown, so it must be told to paint and not to
    // throttle: a throttled hidden window can stall before it has rendered.
    paintWhenInitiallyHidden: true,
    webPreferences: {
      preload: path.join(__dirname, 'print-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  try {
    await printWindow.loadFile('print.html');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('The document took too long to render.'));
      }, EXPORT_RENDER_TIMEOUT_MS);
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onFailed = (event, message) => {
        cleanup();
        reject(new Error(message));
      };
      function cleanup() {
        clearTimeout(timer);
        ipcMain.removeListener('print-ready', onReady);
        ipcMain.removeListener('print-failed', onFailed);
      }
      ipcMain.once('print-ready', onReady);
      ipcMain.once('print-failed', onFailed);
      printWindow.webContents.send('print-content', html);
    });

    return await printWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true
    });
  } finally {
    printWindow.destroy();
  }
}

// Export the active document as PDF. The renderer supplies the HTML it shows,
// so unsaved edits are included.
ipcMain.handle('export-pdf', async (event, filePath, fileName, html) => {
  const suggested = `${path.basename(fileName, path.extname(fileName))}.pdf`;
  const { canceled, filePath: target } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(path.dirname(filePath), suggested),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !target) return { success: false, canceled: true };

  try {
    const pdf = await renderPdf(html);
    await fs.writeFile(target, pdf);
    return { success: true, filePath: target };
  } catch (error) {
    console.error('Error exporting PDF:', error);
    return { success: false, error: error.message };
  }
});

// Handle resolving a relative link path
ipcMain.handle('resolve-link', async (event, basePath, linkPath) => {
  try {
    // Get the directory of the current file
    const baseDir = path.dirname(basePath);

    // Resolve the relative path
    const resolvedPath = path.resolve(baseDir, linkPath);

    // Check if the file exists
    const exists = fsSync.existsSync(resolvedPath);

    // Check if it's a markdown file
    const ext = path.extname(resolvedPath).toLowerCase();
    const isMarkdown = ['.md', '.markdown', '.mdown', '.mkd'].includes(ext);

    return {
      success: true,
      resolvedPath,
      exists,
      isMarkdown
    };
  } catch (error) {
    console.error('Error resolving link:', error);
    return { success: false, error: error.message };
  }
});

// Build file tree recursively
async function buildFileTree(dirPath, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const tree = [];

    for (const entry of entries) {
      // Skip hidden files and common ignore patterns
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const children = await buildFileTree(fullPath, depth + 1, maxDepth);
        tree.push({
          name: entry.name,
          path: fullPath,
          type: 'folder',
          children: children
        });
      } else if (entry.isFile()) {
        // Only include markdown files
        const ext = path.extname(entry.name).toLowerCase();
        if (['.md', '.markdown', '.mdown', '.mkd'].includes(ext)) {
          tree.push({
            name: entry.name,
            path: fullPath,
            type: 'file'
          });
        }
      }
    }

    // Sort: folders first, then files, both alphabetically
    tree.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'folder' ? -1 : 1;
    });

    return tree;
  } catch (error) {
    console.error('Error building file tree:', error);
    return [];
  }
}

app.on('before-quit', () => {
  quitting = true;
});

app.whenReady().then(() => {
  if (headless && app.dock) app.dock.hide();
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
