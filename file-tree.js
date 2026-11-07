// Folder tree for the sidebar. Kept free of Electron so it can be unit tested.
const path = require('path');
const fs = require('fs').promises;

const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd'];

// Build the tree of markdown files under dirPath. A missing or unreadable top
// folder throws, so callers can report the failure; an unreadable subfolder is
// shown as empty rather than failing the whole tree.
async function buildFileTree(dirPath, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return [];

  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (depth === 0) throw error;
    console.error('Error reading folder:', dirPath, error.message);
    return [];
  }

  const tree = [];
  for (const entry of entries) {
    // Skip hidden files and common ignore patterns
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, depth + 1, maxDepth);
      tree.push({ name: entry.name, path: fullPath, type: 'folder', children });
    } else if (entry.isFile()) {
      // Only include markdown files
      const ext = path.extname(entry.name).toLowerCase();
      if (MARKDOWN_EXTENSIONS.includes(ext)) {
        tree.push({ name: entry.name, path: fullPath, type: 'file' });
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
}

module.exports = { buildFileTree, MARKDOWN_EXTENSIONS };
