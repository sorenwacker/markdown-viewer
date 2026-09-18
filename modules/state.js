// Shared mutable renderer state. Kept as a single object so feature modules read
// and write the same live values across module boundaries (ES module bindings
// only let the declaring module reassign an exported `let`).
export const state = {
  currentFolder: null,
  currentFile: null,
  expandedFolders: new Set(),
};

// Tab manager state.
// Tab object structure: { id, filePath, fileName, html, markdown, outline,
// scrollPosition, sourceView, editMode, draft, diskChange, saveError }.
// `markdown` is the content last read from or written to disk; `draft` is the
// edited text, null when there are no edits. `html` and `outline` render the
// tab's current text (the draft when there is one).
export const tabManager = {
  tabs: new Map(), // Map<tabId, tabData>
  activeTabId: null,
  tabOrder: [], // Array of tabIds in display order
  nextTabId: 1,
};

// The active tab object, or null when no document is open.
export function getActiveTab() {
  return tabManager.activeTabId ? tabManager.tabs.get(tabManager.activeTabId) ?? null : null;
}

// A tab is modified when it holds edited text that differs from the file.
export function isModified(tab) {
  return tab.draft !== null && tab.draft !== undefined && tab.draft !== tab.markdown;
}

// The text a tab currently shows: its unsaved edits, or the file content.
export function currentText(tab) {
  return tab.draft ?? tab.markdown;
}

// The file name as shown in the header and tab bar, marked when modified.
export function fileLabel(tab) {
  return isModified(tab) ? `• ${tab.fileName}` : tab.fileName;
}
