// Export the active document as PDF. The rendered HTML the tab holds is sent to
// the main process, which prints it in a hidden window; see docs/exporting.md.
import {
  exportPdfBtn, exportErrorBanner, exportErrorMessage, exportErrorDismissBtn,
} from './dom.js';
import { getActiveTab, currentText } from './state.js';

function showError(message) {
  exportErrorMessage.textContent = `Could not export: ${message}`;
  exportErrorBanner.style.display = 'flex';
}

function hideError() {
  exportErrorBanner.style.display = 'none';
  exportErrorMessage.textContent = '';
}

export async function handleExportPdf() {
  const tab = getActiveTab();
  if (!tab) return;

  hideError();
  // Render the tab's current text rather than reusing the preview: the preview
  // trails typing by its debounce, so it can still be a keystroke behind.
  const { html } = await window.electronAPI.renderMarkdown(tab.filePath, currentText(tab));
  const result = await window.electronAPI.exportPdf(tab.filePath, tab.fileName, html);
  if (!result.success && !result.canceled) {
    showError(result.error);
  }
}

exportPdfBtn.addEventListener('click', handleExportPdf);
exportErrorDismissBtn.addEventListener('click', hideError);
