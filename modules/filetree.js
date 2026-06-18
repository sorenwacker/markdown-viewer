// Folder browsing: opening/navigating folders and rendering the file tree in the
// Files pane.
import { treeContainer, folderPath } from './dom.js';
import { escapeHtml } from './html.js';
import { state } from './state.js';
import { createTab } from './tabs.js';
import { addToRecentDocuments } from './recent.js';

// Open file
export async function handleOpenFile() {
  await window.electronAPI.openFile();
}

// Open folder
export async function handleOpenFolder() {
  const result = await window.electronAPI.openFolder();
  if (result.success) {
    state.currentFolder = result.path;
    folderPath.textContent = result.path;
    folderPath.style.display = 'block';
    renderFileTree(result.tree, result.path);
  }
}

// Navigate to folder
async function navigateToFolder(path) {
  const result = await window.electronAPI.navigateFolder(path);
  if (result.success) {
    state.currentFolder = result.path;
    folderPath.textContent = result.path;
    folderPath.style.display = 'block';
    state.expandedFolders.clear(); // Clear expanded state when navigating
    renderFileTree(result.tree, result.path);
  }
}

// Render file tree
export function renderFileTree(tree, currentPath) {
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
      const isExpanded = state.expandedFolders.has(item.path);
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
            const isExpanded = state.expandedFolders.has(path);
            if (isExpanded) {
              state.expandedFolders.delete(path);
            } else {
              state.expandedFolders.add(path);
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
