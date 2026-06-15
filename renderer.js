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
const searchBar = document.getElementById('searchBar');
const searchInput = document.getElementById('searchInput');
const searchCount = document.getElementById('searchCount');
const searchPrev = document.getElementById('searchPrev');
const searchNext = document.getElementById('searchNext');
const searchClose = document.getElementById('searchClose');
const supportLink = document.getElementById('supportLink');
const tabBar = document.getElementById('tabBar');
const tabBarContent = document.getElementById('tabBarContent');

// Escape text before interpolating it into an innerHTML template string, so
// file names/paths containing HTML metacharacters cannot break markup or inject
// nodes.
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Sanitize rendered markdown HTML before inserting it into the DOM. The HTML
// comes from marked (no built-in sanitizer) and may contain raw HTML from an
// untrusted markdown file. DOMPurify is loaded as a vendored script in
// renderer.html.
//
// The default DOMPurify URI allow-list permits http(s), data: (on images), and
// relative URLs but not file:. This viewer rewrites relative image sources to
// absolute file:// URLs (see resolveImageSrc in main.js), so file: is added to
// the allow-list to let local embedded images load.
const ALLOWED_URI_REGEXP =
  /^(?:(?:(?:f|ht)tps?|file|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;

function sanitizeHtml(html) {
  return window.DOMPurify.sanitize(html, { ALLOWED_URI_REGEXP });
}

// Support link handler
supportLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.electronAPI.openExternal('https://buymeacoffee.com/soerendip');
});

// State
let currentFolder = null;
let currentFile = null;
let expandedFolders = new Set();
let fontSize = 'medium'; // small, medium, large, xlarge

// Search state
let searchMatches = [];
let currentMatchIndex = -1;

// Tab manager state
const tabManager = {
  tabs: new Map(), // Map<tabId, tabData>
  activeTabId: null,
  tabOrder: [], // Array of tabIds in display order
  nextTabId: 1
};

// Tab object structure:
// { id, filePath, fileName, html, outline, scrollPosition }

// Generate unique tab ID
function generateTabId() {
  return `tab-${tabManager.nextTabId++}`;
}

// Find tab by file path
function findTabByPath(filePath) {
  for (const [tabId, tab] of tabManager.tabs) {
    if (tab.filePath === filePath) {
      return tabId;
    }
  }
  return null;
}

// Create a new tab
async function createTab(filePath, data = null) {
  // Check if tab already exists for this file
  const existingTabId = findTabByPath(filePath);
  if (existingTabId) {
    switchToTab(existingTabId);
    return existingTabId;
  }

  // If no data provided, fetch it
  if (!data) {
    const result = await window.electronAPI.openFileInTab(filePath);
    if (!result.success) {
      console.error('Failed to open file in tab:', result.error);
      return null;
    }
    data = result;
  }

  const tabId = generateTabId();
  const tab = {
    id: tabId,
    filePath: data.filePath,
    fileName: data.fileName,
    html: data.html,
    outline: data.outline,
    scrollPosition: 0
  };

  tabManager.tabs.set(tabId, tab);
  tabManager.tabOrder.push(tabId);

  renderTabBar();
  switchToTab(tabId);

  return tabId;
}

// Switch to a tab
function switchToTab(tabId) {
  const tab = tabManager.tabs.get(tabId);
  if (!tab) return;

  // Save scroll position of current tab
  if (tabManager.activeTabId) {
    const currentTab = tabManager.tabs.get(tabManager.activeTabId);
    if (currentTab) {
      currentTab.scrollPosition = contentWrapper.scrollTop;
    }
  }

  tabManager.activeTabId = tabId;
  currentFile = tab.filePath;

  // Update UI
  welcomeScreen.style.display = 'none';
  markdownContent.style.display = 'block';
  markdownContent.innerHTML = sanitizeHtml(tab.html);
  fileInfo.textContent = tab.fileName;

  // Restore scroll position
  contentWrapper.scrollTop = tab.scrollPosition;

  // Setup post-render elements
  setupTableToggles();
  renderMermaidDiagrams();
  renderOutline(tab.outline);
  setupLinkInterception();

  // Update tab bar active state
  renderTabBar();

  // Update active state in file tree
  updateTreeActiveState(tab.filePath);
}

// Close a tab
async function closeTab(tabId) {
  const tab = tabManager.tabs.get(tabId);
  if (!tab) return;

  // Notify main process to stop watching this file
  await window.electronAPI.closeTab(tab.filePath);

  // Remove tab from state
  tabManager.tabs.delete(tabId);
  const orderIndex = tabManager.tabOrder.indexOf(tabId);
  if (orderIndex > -1) {
    tabManager.tabOrder.splice(orderIndex, 1);
  }

  // If this was the active tab, switch to another
  if (tabManager.activeTabId === tabId) {
    if (tabManager.tabOrder.length > 0) {
      // Switch to the previous tab, or the first one if we closed the first
      const newIndex = Math.max(0, orderIndex - 1);
      switchToTab(tabManager.tabOrder[newIndex]);
    } else {
      // No more tabs, show welcome screen
      tabManager.activeTabId = null;
      currentFile = null;
      welcomeScreen.style.display = 'flex';
      markdownContent.style.display = 'none';
      fileInfo.textContent = 'Markdown Viewer';
      outlineContainer.innerHTML = `
        <div class="tree-empty">
          <p>No file opened</p>
          <p class="hint">Open a file to see its outline</p>
        </div>
      `;
    }
  }

  renderTabBar();
}

// Render the tab bar
function renderTabBar() {
  // Hide tab bar if 0 or 1 tabs
  if (tabManager.tabOrder.length <= 1) {
    tabBar.style.display = 'none';
    return;
  }

  tabBar.style.display = 'flex';

  const html = tabManager.tabOrder.map(tabId => {
    const tab = tabManager.tabs.get(tabId);
    const isActive = tabId === tabManager.activeTabId;
    return `
      <div class="tab-item${isActive ? ' active' : ''}" data-tab-id="${tabId}" title="${escapeHtml(tab.filePath)}">
        <span class="tab-item-name">${escapeHtml(tab.fileName)}</span>
        <button class="tab-item-close" data-tab-id="${tabId}" title="Close tab">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  tabBarContent.innerHTML = html;

  // Add event listeners
  const tabItems = tabBarContent.querySelectorAll('.tab-item');
  tabItems.forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.tab-item-close')) return;
      const tabId = item.dataset.tabId;
      switchToTab(tabId);
    });
  });

  const closeButtons = tabBarContent.querySelectorAll('.tab-item-close');
  closeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tabId = btn.dataset.tabId;
      closeTab(tabId);
    });
  });
}

// Update tree active state for a file path
function updateTreeActiveState(filePath) {
  if (currentFolder) {
    const treeItems = treeContainer.querySelectorAll('.tree-item[data-type="file"]');
    treeItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-path') === filePath);
    });
  } else {
    // Update active state for recent docs
    const recentItems = treeContainer.querySelectorAll('.recent-doc-item');
    recentItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-path') === filePath);
    });
  }
}

// Setup link interception on markdown content
function setupLinkInterception() {
  const links = markdownContent.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', handleLinkClick);
  });
}

// Handle link clicks
async function handleLinkClick(e) {
  const href = e.currentTarget.getAttribute('href');
  if (!href) return;

  // Handle anchor links (scroll within document)
  if (href.startsWith('#')) {
    e.preventDefault();
    const targetId = href.slice(1);
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      const offsetTop = targetElement.offsetTop - 80;
      contentWrapper.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
    return;
  }

  // Handle external URLs
  if (href.startsWith('http://') || href.startsWith('https://')) {
    e.preventDefault();
    window.electronAPI.openExternal(href);
    return;
  }

  // Handle relative links
  if (currentFile) {
    e.preventDefault();
    const result = await window.electronAPI.resolveLink(currentFile, href);

    if (result.success && result.exists && result.isMarkdown) {
      // Open markdown file in new tab
      await createTab(result.resolvedPath);
    } else if (result.success && result.exists) {
      // Open non-markdown file with system default
      window.electronAPI.openExternal(`file://${result.resolvedPath}`);
    }
  }
}

// Get next/previous tab
function getNextTabId(current, direction = 1) {
  const currentIndex = tabManager.tabOrder.indexOf(current);
  if (currentIndex === -1 || tabManager.tabOrder.length <= 1) return null;

  let newIndex = currentIndex + direction;
  if (newIndex >= tabManager.tabOrder.length) newIndex = 0;
  if (newIndex < 0) newIndex = tabManager.tabOrder.length - 1;

  return tabManager.tabOrder[newIndex];
}

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

// Get directory path without the filename, truncated from the beginning
function getDirectoryPath(filePath, maxLength = 35) {
  const lastSlash = filePath.lastIndexOf('/');
  const dir = lastSlash > 0 ? filePath.substring(0, lastSlash) : filePath;
  if (dir.length <= maxLength) return dir;
  return '...' + dir.slice(-(maxLength - 3));
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
    const dirPath = getDirectoryPath(doc.path);
    html += `
      <div class="tree-item recent-doc-item" data-path="${escapeHtml(doc.path)}" data-type="recent">
        <div class="recent-doc-text">
          <span class="tree-item-name">${escapeHtml(doc.name)}</span>
          <span class="recent-doc-path" title="${escapeHtml(doc.path)}">${escapeHtml(dirPath)}</span>
        </div>
        <button class="recent-doc-remove" data-path="${escapeHtml(doc.path)}" title="Remove from recent">
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
      await createTab(path);
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

// Reload file and refresh sidebar
async function handleReload() {
  // Refresh the file tree if a folder is open
  if (currentFolder) {
    const result = await window.electronAPI.navigateFolder(currentFolder);
    if (result.success) {
      renderFileTree(result.tree, result.path);
    }
  } else {
    // Refresh recent documents list
    renderRecentDocuments();
  }

  // Reload the active tab content
  if (tabManager.activeTabId && currentFile) {
    const result = await window.electronAPI.openFileInTab(currentFile);
    if (result.success) {
      const tab = tabManager.tabs.get(tabManager.activeTabId);
      if (tab) {
        const scrollTop = contentWrapper.scrollTop;
        tab.html = result.html;
        tab.outline = result.outline;
        markdownContent.innerHTML = sanitizeHtml(tab.html);
        contentWrapper.scrollTop = scrollTop;

        setupTableToggles();
        renderMermaidDiagrams();
        renderOutline(tab.outline);
        setupLinkInterception();
      }
    }
  }
}

reloadBtn.addEventListener('click', handleReload);

// Listen for file changes (auto-reload)
window.electronAPI.onFileChanged((_event, data) => {
  // data contains { filePath, html, fileName, outline }
  const tabId = findTabByPath(data.filePath);
  if (!tabId) return;

  const tab = tabManager.tabs.get(tabId);
  if (!tab) return;

  // Update tab data
  tab.html = data.html;
  tab.outline = data.outline;

  // If this is the active tab, update the display
  if (tabId === tabManager.activeTabId) {
    const scrollTop = contentWrapper.scrollTop;
    markdownContent.innerHTML = sanitizeHtml(tab.html);
    contentWrapper.scrollTop = scrollTop;

    setupTableToggles();
    renderMermaidDiagrams();
    renderOutline(tab.outline);
    setupLinkInterception();
  }
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
      <div class="tree-item folder parent-folder" data-path="${escapeHtml(parentPath)}" data-type="parent">
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
        ? `<div class="tree-children" style="display: ${isExpanded ? 'block' : 'none'};" data-folder-path="${escapeHtml(item.path)}">
             ${buildTreeHtml(item.children, level + 1)}
           </div>`
        : '';

      html += `
        <div class="tree-item folder" data-path="${escapeHtml(item.path)}" data-type="folder">
          <span class="tree-item-icon">${folderIcon}</span>
          <span class="tree-item-name">${escapeHtml(item.name)}</span>
        </div>
        ${childrenHtml}
      `;
    } else {
      html += `
        <div class="tree-item" data-path="${escapeHtml(item.path)}" data-type="file" data-name="${escapeHtml(item.name)}">
          <span class="tree-item-icon">📄</span>
          <span class="tree-item-name">${escapeHtml(item.name)}</span>
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
        // Open file in tab
        await createTab(path);
        // Add to recent documents
        const fileName = item.getAttribute('data-name');
        addToRecentDocuments(path, fileName);
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

// Render mermaid diagrams
async function renderMermaidDiagrams() {
  if (typeof mermaid === 'undefined') {
    console.warn('Mermaid not loaded');
    return;
  }

  const mermaidDivs = markdownContent.querySelectorAll('.mermaid');
  if (mermaidDivs.length === 0) return;

  // Update mermaid theme based on dark mode
  const isDarkMode = document.body.classList.contains('dark-mode');
  mermaid.initialize({
    startOnLoad: false,
    theme: isDarkMode ? 'dark' : 'default',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true
    },
    er: {
      useMaxWidth: true
    }
  });

  try {
    await mermaid.run({
      nodes: mermaidDivs
    });
  } catch (error) {
    console.error('Mermaid rendering error:', error);
  }
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

// Listen for markdown content from main process (initial file load via dialog or command line)
window.electronAPI.onLoadMarkdown((event, data) => {
  const { html, fileName, filePath, outline } = data;

  // Create a tab for this file
  createTab(filePath, { html, fileName, filePath, outline });

  // Add to recent documents
  addToRecentDocuments(filePath, fileName);
});

// Listen for load errors
window.electronAPI.onLoadError((event, errorMessage) => {
  markdownContent.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
      <h3 style="color: #d32f2f; margin-bottom: 12px;">Error Loading File</h3>
      <p>${escapeHtml(errorMessage)}</p>
    </div>
  `;
  markdownContent.style.display = 'block';
  welcomeScreen.style.display = 'none';
});

// In-document search
function openSearch() {
  searchBar.style.display = 'flex';
  searchInput.focus();
  searchInput.select();
}

function closeSearch() {
  searchBar.style.display = 'none';
  searchInput.value = '';
  clearHighlights();
  searchCount.textContent = '';
  searchMatches = [];
  currentMatchIndex = -1;
}

function clearHighlights() {
  const highlights = markdownContent.querySelectorAll('.search-highlight');
  highlights.forEach(highlight => {
    const parent = highlight.parentNode;
    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
    parent.normalize();
  });
}

function performSearch(query) {
  clearHighlights();
  searchMatches = [];
  currentMatchIndex = -1;

  if (!query || query.length === 0) {
    searchCount.textContent = '';
    return;
  }

  const searchText = query.toLowerCase();
  const treeWalker = document.createTreeWalker(
    markdownContent,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const textNodes = [];
  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode;
    // Skip nodes inside mermaid diagrams and code blocks
    if (!node.parentElement.closest('.mermaid') &&
        !node.parentElement.closest('pre') &&
        !node.parentElement.closest('code')) {
      textNodes.push(node);
    }
  }

  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    const lowerText = text.toLowerCase();
    let startIndex = 0;
    let index;

    while ((index = lowerText.indexOf(searchText, startIndex)) !== -1) {
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + query.length);
      searchMatches.push(range.cloneRange());
      startIndex = index + 1;
    }
  });

  // Highlight all matches
  searchMatches.forEach((range, idx) => {
    try {
      const highlight = document.createElement('span');
      highlight.className = 'search-highlight';
      highlight.dataset.matchIndex = idx;
      range.surroundContents(highlight);
    } catch (_e) {
      // Range may cross element boundaries, skip this match
    }
  });

  // Re-collect highlighted elements as matches
  const highlightedElements = markdownContent.querySelectorAll('.search-highlight');
  searchMatches = Array.from(highlightedElements);

  if (searchMatches.length > 0) {
    currentMatchIndex = 0;
    highlightCurrentMatch();
    searchCount.textContent = `1 of ${searchMatches.length}`;
  } else {
    searchCount.textContent = 'No results';
  }
}

function highlightCurrentMatch() {
  searchMatches.forEach((el, idx) => {
    el.classList.remove('search-highlight-current');
    if (idx === currentMatchIndex) {
      el.classList.add('search-highlight-current');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

function goToNextMatch() {
  if (searchMatches.length === 0) return;
  currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
  highlightCurrentMatch();
  searchCount.textContent = `${currentMatchIndex + 1} of ${searchMatches.length}`;
}

function goToPrevMatch() {
  if (searchMatches.length === 0) return;
  currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
  highlightCurrentMatch();
  searchCount.textContent = `${currentMatchIndex + 1} of ${searchMatches.length}`;
}

// Search event listeners
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    performSearch(e.target.value);
  }, 150);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      goToPrevMatch();
    } else {
      goToNextMatch();
    }
  }
  if (e.key === 'Escape') {
    closeSearch();
  }
});

searchNext.addEventListener('click', goToNextMatch);
searchPrev.addEventListener('click', goToPrevMatch);
searchClose.addEventListener('click', closeSearch);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Cmd/Ctrl + F: Open search
  if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
    e.preventDefault();
    openSearch();
  }

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

  // Cmd/Ctrl + W: Close current tab
  if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
    e.preventDefault();
    if (tabManager.activeTabId) {
      closeTab(tabManager.activeTabId);
    }
  }

  // Cmd/Ctrl + Tab: Next tab
  if ((e.metaKey || e.ctrlKey) && e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    if (tabManager.activeTabId) {
      const nextTabId = getNextTabId(tabManager.activeTabId, 1);
      if (nextTabId) {
        switchToTab(nextTabId);
      }
    }
  }

  // Cmd/Ctrl + Shift + Tab: Previous tab
  if ((e.metaKey || e.ctrlKey) && e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    if (tabManager.activeTabId) {
      const prevTabId = getNextTabId(tabManager.activeTabId, -1);
      if (prevTabId) {
        switchToTab(prevTabId);
      }
    }
  }
});

// Initialize recent documents display on startup
renderRecentDocuments();
