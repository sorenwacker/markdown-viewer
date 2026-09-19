const fs = require('fs');
const path = require('path');
const os = require('os');
const { test, expect } = require('./electron.fixture');
const { tempMarkdownFile, openFile, typeAtEnd } = require('./edit-helpers');

// Answer the next save dialog with a path, or cancel it.
async function answerSaveDialog(electronApp, filePath) {
  await electronApp.evaluate(({ dialog }, target) => {
    dialog.showSaveDialog = async (window, options) => {
      globalThis.__lastSaveOptions = options;
      return target ? { canceled: false, filePath: target } : { canceled: true, filePath: undefined };
    };
  }, filePath);
}

const savedOptions = (electronApp) => electronApp.evaluate(() => globalThis.__lastSaveOptions);
const outPath = (name) => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mv-pdf-')), name);

// The text of every page of a PDF, as the reader sees it.
async function pdfText(target) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(target)) }).promise;
  let text = '';
  for (let page = 1; page <= document.numPages; page++) {
    const content = await (await document.getPage(page)).getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

// Wait for the export to finish writing a PDF that can be read back. A file
// size threshold would only guess at that; parsing it is the real condition.
async function waitForFile(target, window) {
  let lastReadError = '';
  try {
    await expect.poll(async () => {
      if (!fs.existsSync(target)) return false;
      try {
        return (await pdfText(target)).length > 0;
      } catch (error) {
        // Keep the reason: a PDF that cannot be read is not the same failure
        // as a PDF that was never written.
        lastReadError = error.message;
        return false;
      }
    }, { timeout: 20000 }).toBe(true);
  } catch (error) {
    const banner = window && await window.locator('#exportErrorMessage').textContent().catch(() => '');
    throw new Error([
      error.message,
      `App reported: ${banner || '(no error shown)'}`,
      `File exists: ${fs.existsSync(target)}`,
      lastReadError ? `Reading the PDF failed: ${lastReadError}` : ''
    ].filter(Boolean).join('\n'));
  }
}

test.describe('Export as PDF', () => {
  test('the export button is hidden until a document is open', async ({ window }) => {
    await expect(window.locator('#exportPdfBtn')).not.toBeVisible();
  });

  test('the export button writes a PDF of the document', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Exported title\n\nBody text for the export.\n'));
    const target = outPath('doc.pdf');
    await answerSaveDialog(electronApp, target);

    await expect(window.locator('#exportPdfBtn')).toBeVisible();
    await window.locator('#exportPdfBtn').click();

    await waitForFile(target, window);
    expect(fs.readFileSync(target).subarray(0, 5).toString()).toBe('%PDF-');
    const text = await pdfText(target);
    expect(text).toContain('Exported title');
    expect(text).toContain('Body text for the export.');
  });

  test('Cmd/Ctrl+P exports the active document', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Shortcut\n'));
    const target = outPath('shortcut.pdf');
    await answerSaveDialog(electronApp, target);

    await window.keyboard.press('ControlOrMeta+p');

    await waitForFile(target, window);
  });

  test('the save dialog suggests the document name beside the document', async ({ electronApp, window }) => {
    const source = tempMarkdownFile('# Naming\n', 'my-notes.md');
    await openFile(electronApp, window, source);
    await answerSaveDialog(electronApp, null); // cancel

    await window.locator('#exportPdfBtn').click();

    await expect.poll(() => savedOptions(electronApp)).toBeTruthy();
    const options = await savedOptions(electronApp);
    expect(path.basename(options.defaultPath)).toBe('my-notes.pdf');
    expect(path.dirname(options.defaultPath)).toBe(path.dirname(source));
  });

  test('cancelling the save dialog writes nothing and reports no error', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Cancelled\n'));
    await answerSaveDialog(electronApp, null);

    await window.locator('#exportPdfBtn').click();
    await window.waitForTimeout(1000);

    await expect(window.locator('#exportErrorBanner')).not.toBeVisible();
  });

  test('mermaid diagrams are drawn before the PDF is written', async ({ electronApp, window }) => {
    const markdown = '# Diagram\n\n```mermaid\nflowchart LR\n  A[Start] --> B[End]\n```\n';
    await openFile(electronApp, window, tempMarkdownFile(markdown, 'diagram.md'));
    const target = outPath('diagram.pdf');
    await answerSaveDialog(electronApp, target);

    await window.locator('#exportPdfBtn').click();
    await waitForFile(target, window);

    // A diagram that was not rendered would leave its mermaid source in the
    // PDF instead of the node labels it draws.
    const text = await pdfText(target);
    expect(text).toContain('Start');
    expect(text).toContain('End');
    expect(text).not.toContain('flowchart LR');
  });

  test('the export works the same when the app is in dark mode', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Dark\n\nText.\n'));
    await window.evaluate(() => document.body.classList.add('dark-mode'));
    const target = outPath('dark.pdf');
    await answerSaveDialog(electronApp, target);

    await window.locator('#exportPdfBtn').click();
    await waitForFile(target, window);

    expect(await pdfText(target)).toContain('Dark');
  });

  // The export page is a separate window that never applies the app's dark
  // mode, so exports stay printable. A regression would be a dark-mode class or
  // a read of the stored preference creeping into it.
  test('the export page has no dark mode at all', () => {
    for (const file of ['print.html', 'print.js']) {
      const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
      expect(source, `${file} must not apply dark mode`).not.toContain('dark-mode');
      expect(source, `${file} must not read stored preferences`).not.toContain('localStorage');
    }
  });

  test('unsaved edits are included in the export', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Title\n'));
    await window.keyboard.press('ControlOrMeta+E');
    await typeAtEnd(window, '\n\n## Unsaved section\n');
    const target = outPath('draft.pdf');
    await answerSaveDialog(electronApp, target);

    await window.locator('#exportPdfBtn').click();
    await waitForFile(target, window);

    expect(await pdfText(target)).toContain('Unsaved section');
  });

  test('a failed write is reported and leaves no file', async ({ electronApp, window }) => {
    await openFile(electronApp, window, tempMarkdownFile('# Fails\n'));
    const target = path.join(os.tmpdir(), 'mv-missing-dir-' + Date.now(), 'nope.pdf');
    await answerSaveDialog(electronApp, target);

    await window.locator('#exportPdfBtn').click();

    await expect(window.locator('#exportErrorBanner')).toBeVisible();
    expect(fs.existsSync(target)).toBe(false);

    await window.locator('#exportErrorDismissBtn').click();
    await expect(window.locator('#exportErrorBanner')).not.toBeVisible();
  });
});
