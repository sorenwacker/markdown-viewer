// Edit mode: a per-tab split view with the shared markdown editor on the left and
// a rendered preview on the right, explicit saving, unsaved-change tracking, and
// handling of changes on disk. Behavior is specified in docs/editing.md.
import { createMarkdownEditor } from '../vendor/markdown-editor.js';
import {
  editToggleBtn, editorPane, contentWrapper, markdownContent, fileInfo, sourceToggleBtn,
  diskChangeBanner, diskReloadBtn, diskKeepBtn,
  saveErrorBanner, saveErrorMessage, saveErrorDismissBtn,
} from './dom.js';
import { tabManager, getActiveTab, isModified, currentText, fileLabel } from './state.js';
import { renderActiveTabContent, renderTabBar } from './tabs.js';

const PREVIEW_DELAY_MS = 300;

// Editors are created on first use and kept per tab, so each tab keeps its own
// undo history. Map<tabId, { handle, container, previewTimer }>
const editors = new Map();

let reportedUnsavedCount = 0;

const isDarkMode = () => document.body.classList.contains('dark-mode');

function editorFor(tab) {
  let entry = editors.get(tab.id);
  if (!entry) {
    const container = document.createElement('div');
    container.className = 'editor-instance';
    editorPane.appendChild(container);
    const handle = createMarkdownEditor({
      parent: container,
      doc: currentText(tab),
      dark: isDarkMode(),
      onChange: (text) => handleEdit(tab, text),
    });
    entry = { handle, container, previewTimer: null };
    editors.set(tab.id, entry);
  }
  return entry;
}

// Show or hide the editor pane, the edit toggle state, and the banners for the
// tab being rendered. Called from renderActiveTabContent.
export function syncEditMode(tab) {
  const editing = !!tab.editMode;
  if (editing) editorFor(tab);

  contentWrapper.classList.toggle('editing', editing);
  editorPane.style.display = editing ? 'block' : 'none';
  for (const [tabId, entry] of editors) {
    const visible = editing && tabId === tab.id;
    entry.container.style.display = visible ? 'block' : 'none';
    if (visible) entry.handle.view.requestMeasure();
  }

  editToggleBtn.classList.toggle('active', editing);
  editToggleBtn.title = editing ? 'Stop Editing (Cmd+E)' : 'Edit Document (Cmd+E)';
  sourceToggleBtn.style.display = editing ? 'none' : 'flex';
  syncBanners(tab);
}

function syncBanners(tab) {
  diskChangeBanner.style.display = tab.diskChange ? 'flex' : 'none';
  saveErrorBanner.style.display = tab.saveError ? 'flex' : 'none';
  saveErrorMessage.textContent = tab.saveError ? `Could not save: ${tab.saveError}` : '';
}

// Hide all edit-mode UI when no document is open.
export function resetEditModeUI() {
  contentWrapper.classList.remove('editing');
  editorPane.style.display = 'none';
  editToggleBtn.style.display = 'none';
  diskChangeBanner.style.display = 'none';
  saveErrorBanner.style.display = 'none';
}

// Refresh everything that shows whether tabs are modified: the header label,
// the tab bar marker, and the count the main process uses on window close.
export function updateModifiedUI() {
  const tab = getActiveTab();
  if (tab) fileInfo.textContent = fileLabel(tab);
  renderTabBar();

  const count = [...tabManager.tabs.values()].filter(isModified).length;
  if (count !== reportedUnsavedCount) {
    reportedUnsavedCount = count;
    window.electronAPI.setUnsavedCount(count);
  }
}

function handleEdit(tab, text) {
  tab.draft = text;
  updateModifiedUI();
  schedulePreview(tab);
}

function schedulePreview(tab) {
  const entry = editors.get(tab.id);
  if (!entry) return;
  clearTimeout(entry.previewTimer);
  entry.previewTimer = setTimeout(() => refreshPreview(tab), PREVIEW_DELAY_MS);
}

async function refreshPreview(tab) {
  const text = currentText(tab);
  const result = await window.electronAPI.renderMarkdown(tab.filePath, text);
  // Drop a result that is stale (more typing happened) or for a closed tab.
  if (currentText(tab) !== text || !tabManager.tabs.has(tab.id)) return;
  tab.html = result.html;
  tab.outline = result.outline;
  if (tab.id === tabManager.activeTabId) {
    const scrollTop = markdownContent.scrollTop;
    renderActiveTabContent(tab);
    markdownContent.scrollTop = scrollTop;
  }
}

export function handleToggleEdit() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.editMode = !tab.editMode;
  renderActiveTabContent(tab);
  contentWrapper.scrollTop = 0;
  if (tab.editMode) editors.get(tab.id).handle.focus();
}

// Write a tab's edits to its file. Returns true when nothing is left unsaved.
export async function saveTab(tab) {
  if (!isModified(tab)) return true;
  const text = tab.draft;
  const result = await window.electronAPI.saveFile(tab.filePath, text);
  if (!result.success) {
    tab.saveError = result.error;
    if (tab.id === tabManager.activeTabId) syncBanners(tab);
    return false;
  }

  tab.markdown = result.markdown;
  tab.saveError = null;
  tab.diskChange = null;
  // Text typed while the write was in flight stays a draft.
  if (tab.draft === text) {
    tab.draft = null;
    tab.html = result.html;
    tab.outline = result.outline;
  }
  if (tab.id === tabManager.activeTabId) syncBanners(tab);
  updateModifiedUI();
  return true;
}

export async function handleSave() {
  const tab = getActiveTab();
  if (tab) await saveTab(tab);
}

// Replace a tab's text with file content, discarding its edits.
export function loadDiskContent(tab, data) {
  tab.markdown = data.markdown;
  tab.html = data.html;
  tab.outline = data.outline;
  tab.draft = null;
  tab.diskChange = null;
  tab.saveError = null;

  const entry = editors.get(tab.id);
  if (entry) {
    clearTimeout(entry.previewTimer);
    entry.handle.setValue(data.markdown);
  }

  updateModifiedUI();
  if (tab.id === tabManager.activeTabId) {
    const scrollTop = contentWrapper.scrollTop;
    const previewScrollTop = markdownContent.scrollTop;
    renderActiveTabContent(tab);
    contentWrapper.scrollTop = scrollTop;
    markdownContent.scrollTop = previewScrollTop;
  }
}

// Apply a file-watcher update to a tab. Content equal to what the tab last
// read or wrote (including the app's own save) is ignored; a modified tab keeps
// its edits and reports the change instead.
export function applyDiskChange(tab, data) {
  if (data.markdown === tab.markdown) return;
  if (isModified(tab) && data.markdown !== tab.draft) {
    tab.diskChange = data;
    if (tab.id === tabManager.activeTabId) syncBanners(tab);
    return;
  }
  loadDiskContent(tab, data);
}

// Ask before discarding a modified tab's edits. Resolves true to proceed.
export async function confirmDiscard(tab) {
  if (!isModified(tab)) return true;
  return window.electronAPI.confirmDiscard(tab.fileName);
}

// Resolve a modified tab before it closes: save, discard, or cancel. Resolves
// true when the tab may close.
export async function resolveBeforeClose(tab) {
  if (!isModified(tab)) return true;
  const decision = await window.electronAPI.confirmCloseModified(tab.fileName);
  if (decision === 'save') return saveTab(tab);
  return decision === 'discard';
}

// Release a closed tab's editor.
export function disposeEditor(tabId) {
  const entry = editors.get(tabId);
  if (!entry) return;
  clearTimeout(entry.previewTimer);
  entry.handle.destroy();
  entry.container.remove();
  editors.delete(tabId);
}

editToggleBtn.addEventListener('click', handleToggleEdit);

diskReloadBtn.addEventListener('click', () => {
  const tab = getActiveTab();
  if (tab?.diskChange) loadDiskContent(tab, tab.diskChange);
});

diskKeepBtn.addEventListener('click', () => {
  const tab = getActiveTab();
  if (!tab) return;
  tab.diskChange = null;
  syncBanners(tab);
});

saveErrorDismissBtn.addEventListener('click', () => {
  const tab = getActiveTab();
  if (!tab) return;
  tab.saveError = null;
  syncBanners(tab);
});

// Editors follow the app's dark mode, which prefs.js sets as a body class.
new MutationObserver(() => {
  for (const entry of editors.values()) entry.handle.setDark(isDarkMode());
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });
