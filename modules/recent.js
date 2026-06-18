// Recent documents list, persisted in localStorage and shown in the Files pane
// when no folder is open.
import { treeContainer } from './dom.js';
import { escapeHtml } from './html.js';
import { state } from './state.js';
import { createTab } from './tabs.js';

const MAX_RECENT_DOCS = 15;

export function getRecentDocuments() {
  const stored = localStorage.getItem('recentDocuments');
  if (!stored) return [];
  // Tolerate a corrupt or legacy value rather than throwing during init, which
  // would break the recent-documents panel on startup.
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    localStorage.removeItem('recentDocuments');
    return [];
  }
}

function saveRecentDocuments(docs) {
  localStorage.setItem('recentDocuments', JSON.stringify(docs));
}

export function addToRecentDocuments(filePath, fileName) {
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
  if (!state.currentFolder) {
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

export function renderRecentDocuments() {
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
