// In-app source viewer: toggles the active tab between its rendered HTML and its
// raw markdown source. The chosen mode is stored on the tab (see tab.sourceView
// in state.js) so each document remembers it independently. Content rendering
// itself lives in renderActiveTabContent (tabs.js); this module owns the toggle
// button, its icon/title state, and the toggle action.
import { sourceToggleBtn, contentWrapper } from './dom.js';
import { tabManager } from './state.js';
import { renderActiveTabContent } from './tabs.js';

// Sync the toggle button's icon, active styling, and tooltip to the tab's mode.
// In rendered mode the source (code) icon invites a switch to source; in source
// mode the rendered (eye) icon invites a switch back.
export function updateSourceToggleUI(tab) {
  const showingSource = !!tab.sourceView;
  sourceToggleBtn.classList.toggle('active', showingSource);
  sourceToggleBtn.querySelector('.source-icon').style.display = showingSource ? 'none' : 'block';
  sourceToggleBtn.querySelector('.rendered-icon').style.display = showingSource ? 'block' : 'none';
  sourceToggleBtn.title = showingSource
    ? 'Show Rendered View (Cmd+Shift+S)'
    : 'Show Markdown Source (Cmd+Shift+S)';
}

export function handleToggleSource() {
  if (!tabManager.activeTabId) return;
  const tab = tabManager.tabs.get(tabManager.activeTabId);
  if (!tab) return;

  tab.sourceView = !tab.sourceView;
  renderActiveTabContent(tab);
  // Rendered and source views have unrelated layouts, so a preserved scroll
  // offset would be meaningless; start the new view at the top.
  contentWrapper.scrollTop = 0;
}

sourceToggleBtn.addEventListener('click', handleToggleSource);
