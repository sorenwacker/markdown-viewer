const { test, expect } = require('./electron.fixture');

// Drive the real file-load path by sending the 'load-markdown' IPC the main
// process normally sends after parsing a file. The payload carries the raw
// markdown source the copy feature reads.
async function loadMarkdown(electronApp, file) {
  await electronApp.evaluate(({ BrowserWindow }, payload) => {
    BrowserWindow.getAllWindows()[0].webContents.send('load-markdown', payload);
  }, file);
}

// Read the system clipboard through Electron's main-process clipboard module.
async function readClipboard(electronApp) {
  return electronApp.evaluate(({ clipboard }) => clipboard.readText());
}

test.describe('Copy markdown source', () => {
  test('the copy button is hidden until a document is open', async ({ window }) => {
    await expect(window.locator('#copySourceBtn')).not.toBeVisible();
  });

  test('clicking the copy button writes the raw markdown to the clipboard', async ({ electronApp, window }) => {
    const markdown = '# Title\n\nSome **bold** body text.\n';
    await loadMarkdown(electronApp, {
      html: '<h1 id="title">Title</h1>',
      markdown,
      fileName: 'doc.md',
      filePath: '/tmp/doc.md',
      outline: []
    });

    await expect(window.locator('#copySourceBtn')).toBeVisible();
    await window.locator('#copySourceBtn').click();

    expect(await readClipboard(electronApp)).toBe(markdown);
  });

  test('Cmd/Ctrl+Shift+C copies the active document source', async ({ electronApp, window }) => {
    const markdown = '## Shortcut\n\nCopied via keyboard.\n';
    await loadMarkdown(electronApp, {
      html: '<h2 id="shortcut">Shortcut</h2>',
      markdown,
      fileName: 'doc.md',
      filePath: '/tmp/doc.md',
      outline: []
    });

    await window.keyboard.press('ControlOrMeta+Shift+C');

    expect(await readClipboard(electronApp)).toBe(markdown);
  });

  test('the copy button copies the source of the active tab', async ({ electronApp, window }) => {
    await loadMarkdown(electronApp, {
      html: '<h1 id="one">One</h1>', markdown: '# One\n',
      fileName: 'one.md', filePath: '/tmp/one.md', outline: []
    });
    await loadMarkdown(electronApp, {
      html: '<h1 id="two">Two</h1>', markdown: '# Two\n',
      fileName: 'two.md', filePath: '/tmp/two.md', outline: []
    });

    // Second file is now the active tab.
    await window.locator('#copySourceBtn').click();
    expect(await readClipboard(electronApp)).toBe('# Two\n');
  });

  test('the copy confirmation does not linger after switching tabs', async ({ electronApp, window }) => {
    await loadMarkdown(electronApp, {
      html: '<h1 id="one">One</h1>', markdown: '# One\n',
      fileName: 'one.md', filePath: '/tmp/one.md', outline: []
    });
    await loadMarkdown(electronApp, {
      html: '<h1 id="two">Two</h1>', markdown: '# Two\n',
      fileName: 'two.md', filePath: '/tmp/two.md', outline: []
    });

    const copyBtn = window.locator('#copySourceBtn');
    await copyBtn.click();
    // Confirmation state is shown immediately after copying.
    await expect(copyBtn).toHaveClass(/copied/);

    // Switch back to the first tab; the confirmation must reset.
    await window.locator('#tabBarContent .tab-item').nth(0).click();
    await expect(copyBtn).not.toHaveClass(/copied/);
  });
});
