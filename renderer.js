// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggleMain = document.getElementById('sidebarToggleMain');
const openFileBtn = document.getElementById('openFileBtn');
const openFolderBtn = document.getElementById('openFolderBtn');
const welcomeOpenFileBtn = document.getElementById('welcomeOpenFileBtn');
const welcomeOpenFolderBtn = document.getElementById('welcomeOpenFolderBtn');
const treeContainer = document.getElementById('treeContainer');
const outlineContainer = document.getElementById('outlineContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const markdownContent = document.getElementById('markdownContent');
const fileInfo = document.getElementById('fileInfo');
const filesTab = document.getElementById('filesTab');
const outlineTab = document.getElementById('outlineTab');
const darkModeToggle = document.getElementById('darkModeToggle');
const folderPath = document.getElementById('folderPath');
const viewModeToggle = document.getElementById('viewModeToggle');
const fontIncreaseBtn = document.getElementById('fontIncreaseBtn');
const fontDecreaseBtn = document.getElementById('fontDecreaseBtn');
const reloadBtn = document.getElementById('reloadBtn');
const contentWrapper = document.querySelector('.content-wrapper');

// State
let currentFolder = null;
let currentFile = null;
let expandedFolders = new Set();
let currentFolderPath = null;
let currentOutline = [];
let fontSize = 'medium'; // small, medium, large, xlarge

// Recent documents (max 15)
const MAX_RECENT_DOCS = 15;

function getRecentDocuments() {
  const stored = localStorage.getItem('recentDocuments');
  return stored ? JSON.parse(stored) : [];
}

function saveRecentDocuments(docs) {
  localStorage.setItem('recentDocuments', JSON.stringify(docs));
}

function addToRecentDocuments(filePath, fileName) {
  let recent = getRecentDocuments();

  // Remove if already exists
  recent = recent.filter(doc => doc.path !== filePath);

  // Add to beginning
  recent.unshift({ path: filePath, name: fileName });

  // Limit to max
  if (recent.length > MAX_RECENT_DOCS) {
    recent = recent.slice(0, MAX_RECENT_DOCS);
  }

  saveRecentDocuments(recent);

  // Update UI if no folder is open
  if (!currentFolder) {
    renderRecentDocuments();
  }
}

function removeFromRecentDocuments(filePath) {
  let recent = getRecentDocuments();
  recent = recent.filter(doc => doc.path !== filePath);
  saveRecentDocuments(recent);
  renderRecentDocuments();
}

function renderRecentDocuments() {
  const recent = getRecentDocuments();

  if (recent.length === 0) {
    treeContainer.innerHTML = `
      <div class="tree-empty">
        <p>No folder opened</p>
        <p class="hint">Open a folder to browse files</p>
      </div>
    `;
    return;
  }

  let html = '<div class="recent-docs-header">Recent Documents</div>';
  html += '<div class="tree-root">';

  recent.forEach(doc => {
    html += `
      <div class="tree-item recent-doc-item" data-path="${doc.path}" data-type="recent" title="${doc.path}">
        <span class="tree-item-icon">&#128196;</span>
        <span class="tree-item-name">${doc.name}</span>
        <button class="recent-doc-remove" data-path="${doc.path}" title="Remove from recent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  });

  html += '</div>';
  treeContainer.innerHTML = html;

  // Add click handlers for recent docs
  const recentItems = treeContainer.querySelectorAll('.recent-doc-item');
  recentItems.forEach(item => {
    item.addEventListener('click', async (e) => {
      // Ignore clicks on remove button
      if (e.target.closest('.recent-doc-remove')) return;

      const path = item.getAttribute('data-path');
      currentFile = path;
      await window.electronAPI.readFile(path);

      // Update active state
      recentItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // Add click handlers for remove buttons
  const removeButtons = treeContainer.querySelectorAll('.recent-doc-remove');
  removeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const path = btn.getAttribute('data-path');
      removeFromRecentDocuments(path);
    });
  });
}

// Reload file
async function handleReload() {
  await window.electronAPI.reloadFile();
}

reloadBtn.addEventListener('click', handleReload);

// Listen for file changes (auto-reload)
window.electronAPI.onFileChanged((event, filePath) => {
  // File was auto-reloaded, could show notification if needed
  console.log('File changed and reloaded:', filePath);
});

// Dark mode
const initDarkMode = () => {
  const savedMode = localStorage.getItem('darkMode');
  if (savedMode === 'true') {
    document.body.classList.add('dark-mode');
    updateDarkModeIcon(true);
  }
};

const updateDarkModeIcon = (isDark) => {
  const sunIcon = darkModeToggle.querySelector('.sun-icon');
  const moonIcon = darkModeToggle.querySelector('.moon-icon');
  if (isDark) {
    sunIcon.style.display = 'none';
    moonIcon.style.display = 'block';
  } else {
    sunIcon.style.display = 'block';
    moonIcon.style.display = 'none';
  }
};

darkModeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark);
  updateDarkModeIcon(isDark);
});

initDarkMode();

// View mode toggle (A4 vs Full Width)
const initViewMode = () => {
  const savedMode = localStorage.getItem('viewMode');
  if (savedMode === 'a4') {
    contentWrapper.classList.add('a4-mode');
  }
};

viewModeToggle.addEventListener('click', () => {
  const isA4 = contentWrapper.classList.toggle('a4-mode');
  localStorage.setItem('viewMode', isA4 ? 'a4' : 'full');
  viewModeToggle.title = isA4 ? 'Switch to Full Width' : 'Switch to A4 View';
});

initViewMode();

// Font size controls
const fontSizes = ['small', 'medium', 'large', 'xlarge'];

const initFontSize = () => {
  const savedSize = localStorage.getItem('fontSize') || 'medium';
  fontSize = savedSize;
  updateFontSize();
};

const updateFontSize = () => {
  // Remove all font size classes
  fontSizes.forEach(size => {
    contentWrapper.classList.remove(`font-${size}`);
  });

  // Add current font size class (if not medium, which is default)
  if (fontSize !== 'medium') {
    contentWrapper.classList.add(`font-${fontSize}`);
  }

  // Update button states
  const currentIndex = fontSizes.indexOf(fontSize);
  fontDecreaseBtn.disabled = currentIndex === 0;
  fontIncreaseBtn.disabled = currentIndex === fontSizes.length - 1;

  fontDecreaseBtn.style.opacity = currentIndex === 0 ? '0.4' : '1';
  fontIncreaseBtn.style.opacity = currentIndex === fontSizes.length - 1 ? '0.4' : '1';
};

fontIncreaseBtn.addEventListener('click', () => {
  const currentIndex = fontSizes.indexOf(fontSize);
  if (currentIndex < fontSizes.length - 1) {
    fontSize = fontSizes[currentIndex + 1];
    localStorage.setItem('fontSize', fontSize);
    updateFontSize();
  }
});

fontDecreaseBtn.addEventListener('click', () => {
  const currentIndex = fontSizes.indexOf(fontSize);
  if (currentIndex > 0) {
    fontSize = fontSizes[currentIndex - 1];
    localStorage.setItem('fontSize', fontSize);
    updateFontSize();
  }
});

initFontSize();

// Toggle sidebar
function toggleSidebar() {
  const isCollapsed = sidebar.classList.toggle('collapsed');

  // Update toggle button icon
  const openIcon = sidebarToggleMain.querySelector('.sidebar-open-icon');
  const closedIcon = sidebarToggleMain.querySelector('.sidebar-closed-icon');

  if (isCollapsed) {
    openIcon.style.display = 'none';
    closedIcon.style.display = 'block';
    sidebarToggleMain.title = 'Show Sidebar';
  } else {
    openIcon.style.display = 'block';
    closedIcon.style.display = 'none';
    sidebarToggleMain.title = 'Hide Sidebar';
  }
}

sidebarToggleMain.addEventListener('click', toggleSidebar);

// Tab switching
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.querySelector(`.tab-content[data-tab="${tabName}"]`).classList.add('active');
}

filesTab.addEventListener('click', () => switchTab('files'));
outlineTab.addEventListener('click', () => switchTab('outline'));

// Open file
async function handleOpenFile() {
  await window.electronAPI.openFile();
}

openFileBtn.addEventListener('click', handleOpenFile);
welcomeOpenFileBtn.addEventListener('click', handleOpenFile);

// Open folder
async function handleOpenFolder() {
  const result = await window.electronAPI.openFolder();
  if (result.success) {
    currentFolder = result.path;
    currentFolderPath = result.path;
    folderPath.textContent = result.path;
    folderPath.style.display = 'block';
    renderFileTree(result.tree, result.path);
  }
}

// Navigate to folder
async function navigateToFolder(path) {
  const result = await window.electronAPI.navigateFolder(path);
  if (result.success) {
    currentFolder = result.path;
    currentFolderPath = result.path;
    folderPath.textContent = result.path;
    folderPath.style.display = 'block';
    expandedFolders.clear(); // Clear expanded state when navigating
    renderFileTree(result.tree, result.path);
  }
}

openFolderBtn.addEventListener('click', handleOpenFolder);
welcomeOpenFolderBtn.addEventListener('click', handleOpenFolder);

// Render file tree
function renderFileTree(tree, currentPath) {
  if (!tree || tree.length === 0) {
    treeContainer.innerHTML = `
      <div class="tree-empty">
        <p>No markdown files found</p>
        <p class="hint">Try selecting a different folder</p>
      </div>
    `;
    return;
  }

  // Add parent folder navigation (if not at root)
  const parentPath = getParentPath(currentPath);
  let parentFolderHtml = '';
  if (parentPath && parentPath !== currentPath) {
    parentFolderHtml = `
      <div class="tree-item folder parent-folder" data-path="${parentPath}" data-type="parent">
        <span class="tree-item-icon">⬆️</span>
        <span class="tree-item-name">..</span>
      </div>
    `;
  }

  const treeHtml = buildTreeHtml(tree);
  treeContainer.innerHTML = `<div class="tree-root">${parentFolderHtml}${treeHtml}</div>`;

  // Add click handlers
  addTreeClickHandlers();
}

// Get parent folder path
function getParentPath(path) {
  if (!path || path === '/' || path.match(/^[A-Z]:\\?$/)) {
    return null;
  }
  const parts = path.split(/[\\/]/);
  parts.pop();
  return parts.join('/') || '/';
}

// Build tree HTML recursively
function buildTreeHtml(items, level = 0) {
  let html = '';

  for (const item of items) {
    if (item.type === 'folder') {
      const isExpanded = expandedFolders.has(item.path);
      const folderIcon = isExpanded ? '📂' : '📁';
      const childrenHtml = item.children && item.children.length > 0
        ? `<div class="tree-children" style="display: ${isExpanded ? 'block' : 'none'};" data-folder-path="${item.path}">
             ${buildTreeHtml(item.children, level + 1)}
           </div>`
        : '';

      html += `
        <div class="tree-item folder" data-path="${item.path}" data-type="folder">
          <span class="tree-item-icon">${folderIcon}</span>
          <span class="tree-item-name">${item.name}</span>
        </div>
        ${childrenHtml}
      `;
    } else {
      html += `
        <div class="tree-item" data-path="${item.path}" data-type="file" data-name="${item.name}">
          <span class="tree-item-icon">📄</span>
          <span class="tree-item-name">${item.name}</span>
        </div>
      `;
    }
  }

  return html;
}

// Add click handlers to tree items
function addTreeClickHandlers() {
  const treeItems = treeContainer.querySelectorAll('.tree-item');

  treeItems.forEach(item => {
    let clickTimer = null;

    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const path = item.getAttribute('data-path');
      const type = item.getAttribute('data-type');

      // Handle parent folder click - navigate immediately
      if (type === 'parent') {
        await navigateToFolder(path);
        return;
      }

      // Handle file click
      if (type === 'file') {
        // Load file
        currentFile = path;
        await window.electronAPI.readFile(path);

        // Update active state
        treeContainer.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        return;
      }

      // Handle folder click - toggle expand/collapse
      if (type === 'folder') {
        // Clear any existing timer
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
          // Double click - navigate into folder
          await navigateToFolder(path);
        } else {
          // Single click - toggle expand
          clickTimer = setTimeout(() => {
            clickTimer = null;
            const isExpanded = expandedFolders.has(path);
            if (isExpanded) {
              expandedFolders.delete(path);
            } else {
              expandedFolders.add(path);
            }

            // Find and toggle children visibility
            const children = item.nextElementSibling;
            if (children && children.classList.contains('tree-children')) {
              children.style.display = isExpanded ? 'none' : 'block';
            }

            // Update icon
            const icon = item.querySelector('.tree-item-icon');
            icon.textContent = isExpanded ? '📁' : '📂';
          }, 250);
        }
      }
    });
  });
}

// Setup table toggle buttons
function setupTableToggles() {
  const toggleButtons = markdownContent.querySelectorAll('.table-toggle');

  toggleButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const tableId = button.getAttribute('data-table-id');
      const wrapper = document.getElementById(`table-wrapper-${tableId}`);

      if (wrapper.classList.contains('full-width')) {
        wrapper.classList.remove('full-width');
        button.textContent = 'Fit Width';
      } else {
        wrapper.classList.add('full-width');
        button.textContent = 'Scroll';
      }
    });
  });
}

// Render outline
function renderOutline(outline) {
  if (!outline || outline.length === 0) {
    outlineContainer.innerHTML = `
      <div class="tree-empty">
        <p>No headings found</p>
        <p class="hint">This file has no headings</p>
      </div>
    `;
    return;
  }

  currentOutline = outline;
  let outlineHtml = '';

  outline.forEach(item => {
    outlineHtml += `
      <div class="outline-item level-${item.level}" data-id="${item.id}">
        ${item.text}
      </div>
    `;
  });

  outlineContainer.innerHTML = outlineHtml;

  // Add click handlers
  const outlineItems = outlineContainer.querySelectorAll('.outline-item');
  outlineItems.forEach(item => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-id');
      const targetElement = document.getElementById(id);
      if (targetElement) {
        // Scroll to the heading
        const contentWrapper = document.querySelector('.content-wrapper');
        const offsetTop = targetElement.offsetTop - 80; // Offset for header
        contentWrapper.scrollTo({
          top: offsetTop,
          behavior: 'smooth'
        });

        // Update active state
        outlineItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });
  });
}

// Listen for markdown content from main process
window.electronAPI.onLoadMarkdown((event, data) => {
  const { html, fileName, filePath, outline } = data;

  // Hide welcome screen and show markdown content
  welcomeScreen.style.display = 'none';
  markdownContent.style.display = 'block';

  // Update file info
  fileInfo.textContent = fileName;
  currentFile = filePath;

  // Show reload button
  reloadBtn.style.display = 'flex';

  // Display the rendered HTML
  markdownContent.innerHTML = html;

  // Scroll to top
  const contentWrapper = document.querySelector('.content-wrapper');
  contentWrapper.scrollTop = 0;

  // Setup table toggle buttons
  setupTableToggles();

  // Render outline
  renderOutline(outline);

  // Add to recent documents
  addToRecentDocuments(filePath, fileName);

  // Update active state in tree if file is in current tree
  if (currentFolder) {
    const treeItems = treeContainer.querySelectorAll('.tree-item[data-type="file"]');
    treeItems.forEach(item => {
      if (item.getAttribute('data-path') === filePath) {
        treeContainer.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
      }
    });
  } else {
    // Update active state for recent docs
    const recentItems = treeContainer.querySelectorAll('.recent-doc-item');
    recentItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-path') === filePath);
    });
  }
});

// Listen for load errors
window.electronAPI.onLoadError((event, errorMessage) => {
  markdownContent.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
      <h3 style="color: #d32f2f; margin-bottom: 12px;">Error Loading File</h3>
      <p>${errorMessage}</p>
    </div>
  `;
  markdownContent.style.display = 'block';
  welcomeScreen.style.display = 'none';
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Cmd/Ctrl + O: Open file
  if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
    e.preventDefault();
    handleOpenFile();
  }

  // Cmd/Ctrl + Shift + O: Open folder
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'O') {
    e.preventDefault();
    handleOpenFolder();
  }

  // Cmd/Ctrl + B: Toggle sidebar
  if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
    e.preventDefault();
    toggleSidebar();
  }

  // Cmd/Ctrl + R: Reload file
  if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
    e.preventDefault();
    if (currentFile) {
      handleReload();
    }
  }
});

// Initialize recent documents display on startup
renderRecentDocuments();
