// Shared mutable renderer state. Kept as a single object so feature modules read
// and write the same live values across module boundaries (ES module bindings
// only let the declaring module reassign an exported `let`).
export const state = {
  currentFolder: null,
  currentFile: null,
  expandedFolders: new Set(),
};

// Tab manager state.
// Tab object structure: { id, filePath, fileName, html, markdown, outline, scrollPosition, sourceView }
export const tabManager = {
  tabs: new Map(), // Map<tabId, tabData>
  activeTabId: null,
  tabOrder: [], // Array of tabIds in display order
  nextTabId: 1,
};
