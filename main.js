const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { marked } = require('marked');

let mainWindow;
let fileToOpen = null;

// Handle file opening on macOS
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  fileToOpen = filePath;

  if (mainWindow) {
    loadMarkdownFile(filePath);
  }
});

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

async function loadMarkdownFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // Configure marked options
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: true,
      mangle: false
    });

    // Parse markdown to HTML
    let html = marked.parse(content);

    // Wrap tables in a container with toggle button
    html = wrapTablesWithToggle(html);

    // Extract headings for outline
    const outline = extractOutline(html);

    mainWindow.webContents.send('load-markdown', {
      html: html,
      filePath: filePath,
      fileName: path.basename(filePath),
      outline: outline
    });
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

// Handle read file request from renderer
ipcMain.handle('read-file', async (event, filePath) => {
  await loadMarkdownFile(filePath);
  return true;
});

// Handle export to PDF request
ipcMain.handle('export-pdf', async (event, orientation) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export to PDF',
    defaultPath: 'document.pdf',
    filters: [
      { name: 'PDF Files', extensions: ['pdf'] }
    ]
  });

  if (!result.canceled && result.filePath) {
    try {
      const data = await mainWindow.webContents.printToPDF({
        printBackground: true,
        landscape: orientation === 'landscape',
        pageSize: 'A4',
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
        }
      });

      await fs.writeFile(result.filePath, data);
      return { success: true, path: result.filePath };
    } catch (error) {
      console.error('Error exporting PDF:', error);
      return { success: false, error: error.message };
    }
  }

  return { success: false };
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
