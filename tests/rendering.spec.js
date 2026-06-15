const { test, expect } = require('./electron.fixture');

// Send the 'load-markdown' IPC the main process emits after parsing a file, so
// the renderer renders this html through its real (sanitizing) display path.
async function loadMarkdown(electronApp, file) {
  await electronApp.evaluate(({ BrowserWindow }, payload) => {
    BrowserWindow.getAllWindows()[0].webContents.send('load-markdown', payload);
  }, file);
}

test.describe('Markdown HTML sanitization', () => {
  test('DOMPurify is available in the renderer', async ({ window }) => {
    expect(await window.evaluate(() => typeof window.DOMPurify?.sanitize)).toBe('function');
  });

  test('dangerous markup is stripped but benign content is kept', async ({ electronApp, window }) => {
    await window.evaluate(() => { window.__xssFired = false; });

    const html = [
      '<h1 id="safe">Safe Heading</h1>',
      '<p>Benign <em>emphasis</em> and <code>code</code>.</p>',
      '<img src="x" onerror="window.__xssFired = true">',
      '<script>window.__xssFired = true;</script>',
      '<a id="jsLink" href="javascript:window.__xssFired = true">click</a>'
    ].join('\n');

    await loadMarkdown(electronApp, {
      html, fileName: 'payload.md', filePath: '/tmp/payload.md', outline: []
    });

    const content = window.locator('#markdownContent');
    await expect(content).toBeVisible();

    // Benign content survives.
    await expect(content.locator('h1#safe')).toHaveText('Safe Heading');
    await expect(content.locator('em')).toHaveText('emphasis');

    // Dangerous constructs are removed.
    await expect(content.locator('script')).toHaveCount(0);
    await expect(content.locator('[onerror]')).toHaveCount(0);

    // The javascript: URL is stripped (DOMPurify removes the attribute).
    const jsHref = await content.locator('#jsLink').getAttribute('href');
    expect(jsHref === null || !jsHref.startsWith('javascript:')).toBe(true);

    // Confirm no injected handler ever executed.
    await window.waitForTimeout(50);
    expect(await window.evaluate(() => window.__xssFired)).toBe(false);
  });

  test('embedded images and mermaid blocks survive sanitization', async ({ electronApp, window }) => {
    const html = [
      '<img id="remote" src="https://example.com/a.png" alt="remote">',
      '<img id="data" src="data:image/png;base64,iVBOR" alt="data">',
      '<img id="local" src="file:///tmp/local.png" alt="local">',
      '<div class="mermaid">graph TD; A--&gt;B</div>'
    ].join('\n');

    await loadMarkdown(electronApp, {
      html, fileName: 'media.md', filePath: '/tmp/media.md', outline: []
    });

    const content = window.locator('#markdownContent');
    await expect(content.locator('#remote')).toHaveAttribute('src', 'https://example.com/a.png');
    await expect(content.locator('#data')).toHaveAttribute('src', /^data:image\/png/);
    await expect(content.locator('#local')).toHaveAttribute('src', 'file:///tmp/local.png');
    await expect(content.locator('div.mermaid')).toHaveCount(1);
  });
});
