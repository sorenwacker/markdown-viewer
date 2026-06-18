// Document tab lifecycle: creating, switching, closing, and rendering the tab
// bar. Distinct from the sidebar Files/Outline panes (see switchSidebarPane in
// renderer.js).
import {
  welcomeScreen, markdownContent, fileInfo, copySourceBtn, outlineContainer,
  contentWrapper, tabBar, tabBarContent, treeContainer,
} from './dom.js';
import { escapeHtml, sanitizeHtml } from './html.js';
import { state, tabManager } from './state.js';
import {
  setupTableToggles, renderMermaidDiagrams, renderOutline, setupLinkInterception,
} from './view.js';
import { resetCopyFeedback } from './copy.js';

// Generate unique tab ID
function generateTabId() {
  return `tab-${tabManager.nextTabId++}`;
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
    scrollPosition: 0
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
  markdownContent.innerHTML = sanitizeHtml(tab.html);
  fileInfo.textContent = tab.fileName;
  copySourceBtn.style.display = 'flex';
  resetCopyFeedback();

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
export async function closeTab(tabId) {
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
      state.currentFile = null;
      welcomeScreen.style.display = 'flex';
      markdownContent.style.display = 'none';
      fileInfo.textContent = 'Markdown Viewer';
      copySourceBtn.style.display = 'none';
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
