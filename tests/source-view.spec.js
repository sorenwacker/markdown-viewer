const { test, expect } = require('./electron.fixture');

// Drive the real file-load path by sending the 'load-markdown' IPC the main
// process normally sends after parsing a file. The payload carries both the
// rendered HTML and the raw markdown source the source view reads.
async function loadMarkdown(electronApp, file) {
  await electronApp.evaluate(({ BrowserWindow }, payload) => {
    BrowserWindow.getAllWindows()[0].webContents.send('load-markdown', payload);
  }, file);
}

test.describe('Markdown source view', () => {
  test('the source toggle is hidden until a document is open', async ({ window }) => {
    await expect(window.locator('#sourceToggleBtn')).not.toBeVisible();
  });

  test('toggling shows the raw markdown source instead of the rendered HTML', async ({ electronApp, window }) => {
    const markdown = '# Title\n\nSome **bold** body text.\n';
    await loadMarkdown(electronApp, {
      html: '<h1 id="title">Title</h1>\n<p>Some <strong>bold</strong> body text.</p>',
      markdown,
      fileName: 'doc.md',
      filePath: '/tmp/doc.md',
      outline: []
    });

    // Rendered HTML is shown first.
    await expect(window.locator('#markdownContent h1')).toBeVisible();
    await expect(window.locator('#sourceToggleBtn')).toBeVisible();

    await window.locator('#sourceToggleBtn').click();

    // The raw source replaces the rendered HTML, verbatim and unparsed.
    await expect(window.locator('#markdownContent .markdown-source')).toHaveCount(1);
    await expect(window.locator('#markdownContent h1')).toHaveCount(0);
    await expect(window.locator('#markdownContent .markdown-source')).toHaveText(markdown);
  });

  test('toggling again returns to the rendered view', async ({ electronApp, window }) => {
    await loadMarkdown(electronApp, {
      html: '<h1 id="title">Title</h1>', markdown: '# Title\n',
      fileName: 'doc.md', filePath: '/tmp/doc.md', outline: []
    });

    const toggle = window.locator('#sourceToggleBtn');
    await toggle.click();
    await expect(window.locator('#markdownContent .markdown-source')).toHaveCount(1);

    await toggle.click();
    await expect(window.locator('#markdownContent .markdown-source')).toHaveCount(0);
    await expect(window.locator('#markdownContent h1')).toBeVisible();
  });

  test('Cmd/Ctrl+Shift+S toggles the source view', async ({ electronApp, window }) => {
    await loadMarkdown(electronApp, {
      html: '<h1 id="title">Title</h1>', markdown: '# Title\n',
      fileName: 'doc.md', filePath: '/tmp/doc.md', outline: []
    });

    await window.keyboard.press('ControlOrMeta+Shift+S');
    await expect(window.locator('#markdownContent .markdown-source')).toHaveCount(1);

    await window.keyboard.press('ControlOrMeta+Shift+S');
    await expect(window.locator('#markdownContent .markdown-source')).toHaveCount(0);
  });

  test('the source view is remembered per tab', async ({ electronApp, window }) => {
    await loadMarkdown(electronApp, {
      html: '<h1 id="one">One</h1>', markdown: '# One\n',
      fileName: 'one.md', filePath: '/tmp/one.md', outline: []
    });
    await loadMarkdown(electronApp, {
      html: '<h1 id="two">Two</h1>', markdown: '# Two\n',
      fileName: 'two.md', filePath: '/tmp/two.md', outline: []
    });

    // Turn on source view for the second (active) tab only.
    await window.locator('#sourceToggleBtn').click();
    await expect(window.locator('#markdownContent .markdown-source')).toHaveText('# Two\n');

    // The first tab stays in rendered mode.
    await window.locator('#tabBarContent .tab-item').nth(0).click();
    await expect(window.locator('#markdownContent .markdown-source')).toHaveCount(0);
    await expect(window.locator('#markdownContent h1')).toBeVisible();

    // Returning to the second tab restores its source view.
    await window.locator('#tabBarContent .tab-item').nth(1).click();
    await expect(window.locator('#markdownContent .markdown-source')).toHaveText('# Two\n');
  });
});
