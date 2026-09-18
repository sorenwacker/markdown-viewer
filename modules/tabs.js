// Document tab lifecycle: creating, switching, closing, and rendering the tab
// bar. Distinct from the sidebar Files/Outline panes (see switchSidebarPane in
// renderer.js).
import {
  welcomeScreen, markdownContent, fileInfo, copySourceBtn, sourceToggleBtn, editToggleBtn, exportPdfBtn,
  outlineContainer, contentWrapper, tabBar, tabBarContent, treeContainer,
} from './dom.js';
import { escapeHtml, sanitizeHtml } from './html.js';
import { state, tabManager, isModified, currentText, fileLabel } from './state.js';
import {
  setupTableToggles, renderMermaidDiagrams, renderOutline, setupLinkInterception,
} from './view.js';
import { resetCopyFeedback } from './copy.js';
import { updateSourceToggleUI } from './source-view.js';
import {
  syncEditMode, resolveBeforeClose, disposeEditor, resetEditModeUI, updateModifiedUI,
} from './edit-mode.js';

// Generate unique tab ID
function generateTabId() {
  return `tab-${tabManager.nextTabId++}`;
}

// Render the active tab's content according to its view mode, then run the
// post-render setup the rendered view needs (diagrams, table toggles, links)
// and refresh the outline. The single place that writes #markdownContent, so
// tab switching, reloading, file-watch updates, the source toggle, and the
// edit-mode preview all stay consistent. In edit mode #markdownContent is the
// preview, so it is always rendered. Callers handle scroll position around it.
export function renderActiveTabContent(tab) {
  if (tab.sourceView && !tab.editMode) {
    // Insert the raw markdown as text, never as markup, so it is shown verbatim
    // and cannot inject HTML.
    markdownContent.innerHTML = '<pre class="markdown-source"><code></code></pre>';
    markdownContent.querySelector('.markdown-source code').textContent = currentText(tab) ?? '';
  } else {
    markdownContent.innerHTML = sanitizeHtml(tab.html);
    setupTableToggles();
    renderMermaidDiagrams();
    setupLinkInterception();
  }

  renderOutline(tab.outline);
  updateSourceToggleUI(tab);
  syncEditMode(tab);
}

// Find tab by file path
export function findTabByPath(filePath) {
  for (const [tabId, tab] of tabManager.tabs) {
    if (tab.filePath === filePath) {
      return tabId;
    }
  }
  return null;
}

// Create a new tab
export async function createTab(filePath, data = null) {
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
    markdown: data.markdown,
    outline: data.outline,
    scrollPosition: 0,
    sourceView: false,
    editMode: false,
    draft: null,
    diskChange: null,
    saveError: null
  };

  tabManager.tabs.set(tabId, tab);
  tabManager.tabOrder.push(tabId);

  renderTabBar();
  switchToTab(tabId);

  return tabId;
}

// Switch to a tab
export function switchToTab(tabId) {
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
  state.currentFile = tab.filePath;

  // Update UI
  welcomeScreen.style.display = 'none';
  markdownContent.style.display = 'block';
  fileInfo.textContent = fileLabel(tab);
  copySourceBtn.style.display = 'flex';
  sourceToggleBtn.style.display = 'flex';
  editToggleBtn.style.display = 'flex';
  exportPdfBtn.style.display = 'flex';
  resetCopyFeedback();

  // Render content in this tab's view mode, then restore its scroll position.
  renderActiveTabContent(tab);
  contentWrapper.scrollTop = tab.scrollPosition;

  // Update tab bar active state
  renderTabBar();

  // Update active state in file tree
  updateTreeActiveState(tab.filePath);
}

// Close a tab
export async function closeTab(tabId) {
  const tab = tabManager.tabs.get(tabId);
  if (!tab) return;

  // A modified tab is saved, discarded, or kept open, as the user chooses.
  if (!(await resolveBeforeClose(tab))) return;
  // Discarded edits no longer count as unsaved.
  tab.draft = null;
  disposeEditor(tabId);

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
      state.currentFile = null;
      welcomeScreen.style.display = 'flex';
      markdownContent.style.display = 'none';
      fileInfo.textContent = 'Markdown Viewer';
      copySourceBtn.style.display = 'none';
      sourceToggleBtn.style.display = 'none';
      exportPdfBtn.style.display = 'none';
      resetEditModeUI();
      outlineContainer.innerHTML = `
        <div class="tree-empty">
          <p>No file opened</p>
          <p class="hint">Open a file to see its outline</p>
        </div>
      `;
    }
  }

  updateModifiedUI();
}

// Render the tab bar
export function renderTabBar() {
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
        ${isModified(tab) ? '<span class="tab-item-modified" title="Unsaved changes">•</span>' : ''}
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

// Get next/previous tab
export function getNextTabId(current, direction = 1) {
  const currentIndex = tabManager.tabOrder.indexOf(current);
  if (currentIndex === -1 || tabManager.tabOrder.length <= 1) return null;

  let newIndex = currentIndex + direction;
  if (newIndex >= tabManager.tabOrder.length) newIndex = 0;
  if (newIndex < 0) newIndex = tabManager.tabOrder.length - 1;

  return tabManager.tabOrder[newIndex];
}

// Update tree active state for a file path
function updateTreeActiveState(filePath) {
  if (state.currentFolder) {
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
