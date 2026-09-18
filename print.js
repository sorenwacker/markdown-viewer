// The export page. It renders a document the way the main window does, without
// any of the app's interface, and tells the main process when the page is
// finished so the PDF is never written mid-render. See docs/exporting.md.
// The sanitizer is the main window's, so both insert document HTML under the
// same rules.
import { sanitizeHtml } from './modules/html.js';

// Render any mermaid diagrams and return how many were drawn.
async function renderDiagrams(container) {
  const nodes = container.querySelectorAll('.mermaid');
  if (nodes.length === 0) return 0;

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    flowchart: { useMaxWidth: true, htmlLabels: true },
    er: { useMaxWidth: true }
  });
  await mermaid.run({ nodes });
  return container.querySelectorAll('.mermaid svg').length;
}

window.printAPI.onContent(async (_event, html) => {
  const container = document.getElementById('printContent');
  try {
    container.innerHTML = sanitizeHtml(html);

    // The table width toggle is a control of the main window, not content.
    container.querySelectorAll('.table-toggle').forEach(button => button.remove());

    const diagrams = await renderDiagrams(container);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    // Let the page lay out and paint what was just inserted; printing before
    // that can capture a page that is still empty.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    window.printAPI.ready({ diagrams });
  } catch (error) {
    window.printAPI.failed(error.message);
  }
});
