// Copy the raw markdown source of the active tab to the clipboard, with a brief
// checkmark confirmation on the button.
import { copySourceBtn } from './dom.js';
import { tabManager, currentText } from './state.js';

let copyFeedbackTimer = null;

// Restore the copy button to its default (non-confirmation) state. Called after
// the confirmation delay and on tab switch so a checkmark never lingers on a
// different document.
export function resetCopyFeedback() {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = null;
  }
  copySourceBtn.querySelector('.copy-icon').style.display = 'block';
  copySourceBtn.querySelector('.copied-icon').style.display = 'none';
  copySourceBtn.classList.remove('copied');
}

export async function handleCopySource() {
  if (!tabManager.activeTabId) return;
  const tab = tabManager.tabs.get(tabManager.activeTabId);
  if (!tab || currentText(tab) == null) return;

  // Copy the text as shown, including unsaved edits.
  await window.electronAPI.copyToClipboard(currentText(tab));

  copySourceBtn.querySelector('.copy-icon').style.display = 'none';
  copySourceBtn.querySelector('.copied-icon').style.display = 'block';
  copySourceBtn.classList.add('copied');

  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
  copyFeedbackTimer = setTimeout(resetCopyFeedback, 1500);
}

copySourceBtn.addEventListener('click', handleCopySource);
