// Renderer entry point. Composes the feature modules, wires the top-level
// controls and IPC listeners, and defines the cross-cutting actions (reload,
// sidebar toggle/pane switch, keyboard shortcuts) that coordinate them.
import {
  sidebar, sidebarToggleMain, reloadBtn, supportLink, filesTab, outlineTab,
  openFileBtn, welcomeOpenFileBtn, openFolderBtn, welcomeOpenFolderBtn,
  markdownContent, welcomeScreen, contentWrapper,
} from './modules/dom.js';
import { escapeHtml, sanitizeHtml } from './modules/html.js';
import { state, tabManager } from './modules/state.js';
import {
  createTab, switchToTab, closeTab, getNextTabId, findTabByPath,
} from './modules/tabs.js';
import {
  setupTableToggles, renderMermaidDiagrams, renderOutline, setupLinkInterception,
} from './modules/view.js';
import { addToRecentDocuments, renderRecentDocuments } from './modules/recent.js';
import { handleOpenFile, handleOpenFolder, renderFileTree } from './modules/filetree.js';
import { handleCopySource } from './modules/copy.js';
import { openSearch } from './modules/search.js';
import './modules/prefs.js';

// Support link handler
supportLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.electronAPI.openExternal('https://buymeacoffee.com/soerendip');
});

// Reload file and refresh sidebar
async function handleReload() {
  // Refresh the file tree if a folder is open
  if (state.currentFolder) {
    const result = await window.electronAPI.navigateFolder(state.currentFolder);
    if (result.success) {
      renderFileTree(result.tree, result.path);
    }
  } else {
    // Refresh recent documents list
    renderRecentDocuments();
  }

  // Reload the active tab content
  if (tabManager.activeTabId && state.currentFile) {
    const result = await window.electronAPI.openFileInTab(state.currentFile);
    if (result.success) {
      const tab = tabManager.tabs.get(tabManager.activeTabId);
      if (tab) {
        const scrollTop = contentWrapper.scrollTop;
        tab.html = result.html;
        tab.markdown = result.markdown;
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
  tab.markdown = data.markdown;
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

// Switch the sidebar between its Files and Outline panes. Distinct from
// switchToTab, which activates an open document tab.
function switchSidebarPane(paneName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.tab-btn[data-tab="${paneName}"]`).classList.add('active');

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.querySelector(`.tab-content[data-tab="${paneName}"]`).classList.add('active');
}

filesTab.addEventListener('click', () => switchSidebarPane('files'));
outlineTab.addEventListener('click', () => switchSidebarPane('outline'));

openFileBtn.addEventListener('click', handleOpenFile);
welcomeOpenFileBtn.addEventListener('click', handleOpenFile);
openFolderBtn.addEventListener('click', handleOpenFolder);
welcomeOpenFolderBtn.addEventListener('click', handleOpenFolder);

// Listen for markdown content from main process (initial file load via dialog or command line)
window.electronAPI.onLoadMarkdown((event, data) => {
  const { html, markdown, fileName, filePath, outline } = data;

  // Create a tab for this file
  createTab(filePath, { html, markdown, fileName, filePath, outline });

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

  // Cmd/Ctrl + Shift + C: Copy markdown source
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
    e.preventDefault();
    handleCopySource();
  }

  // Cmd/Ctrl + R: Reload file
  if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
    e.preventDefault();
    if (state.currentFile) {
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
