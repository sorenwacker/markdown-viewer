const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs').promises;
const fsSync = require('fs');
const { Marked } = require('marked');

let mainWindow;
let fileToOpen = null;

// Map of file path -> { watcher, debounceTimer }
const fileWatchers = new Map();

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
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

// Parse a markdown file and return the rendered data
async function parseMarkdownFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');

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

  return {
    html,
    filePath,
    fileName: path.basename(filePath),
    outline
  };
}

async function loadMarkdownFile(filePath, setupWatcher = true) {
  try {
    const data = await parseMarkdownFile(filePath);

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

// Handle opening a file in a new tab (returns parsed data without sending to renderer)
ipcMain.handle('open-file-in-tab', async (event, filePath) => {
  try {
    const data = await parseMarkdownFile(filePath);
    watchFile(filePath);
    return { success: true, ...data };
  } catch (error) {
    console.error('Error opening file in tab:', error);
    return { success: false, error: error.message };
  }
});

// Handle closing a tab (stop watching the file)
ipcMain.handle('close-tab', async (event, filePath) => {
  unwatchFile(filePath);
  return true;
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

app.whenReady().then(() => {
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
