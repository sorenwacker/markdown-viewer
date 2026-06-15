const { test, expect } = require('./electron.fixture');

// Drive the real file-load path by sending the 'load-markdown' IPC the main
// process normally sends after parsing a file. The renderer creates a tab and
// renders the (already-parsed) html through its sanitizing display path.
async function loadMarkdown(electronApp, file) {
  await electronApp.evaluate(({ BrowserWindow }, payload) => {
    BrowserWindow.getAllWindows()[0].webContents.send('load-markdown', payload);
  }, file);
}

test.describe('Tab Bar visibility', () => {
  test('is hidden when no files are open', async ({ window }) => {
    const tabBar = window.locator('#tabBar');
    await expect(tabBar).not.toBeVisible();
    await expect(tabBar).toHaveCSS('display', 'none');
  });

  test('stays hidden with a single open file', async ({ electronApp, window }) => {
    await loadMarkdown(electronApp, {
      html: '<h1 id="one">File One</h1>',
      fileName: 'one.md',
      filePath: '/tmp/one.md',
      outline: []
    });

    await expect(window.locator('#markdownContent')).toBeVisible();
    // Tab bar only appears with more than one tab.
    await expect(window.locator('#tabBar')).not.toBeVisible();
  });

  test('appears with the open file names once a second file opens', async ({ electronApp, window }) => {
    await loadMarkdown(electronApp, {
      html: '<h1 id="one">File One</h1>',
      fileName: 'one.md',
      filePath: '/tmp/one.md',
      outline: []
    });
    await loadMarkdown(electronApp, {
      html: '<h1 id="two">File Two</h1>',
      fileName: 'two.md',
      filePath: '/tmp/two.md',
      outline: []
    });

    await expect(window.locator('#tabBar')).toBeVisible();
    const names = window.locator('#tabBarContent .tab-item-name');
    await expect(names).toHaveCount(2);
    await expect(names.nth(0)).toHaveText('one.md');
    await expect(names.nth(1)).toHaveText('two.md');
  });
});

test.describe('Tab bar escapes file names', () => {
  test('a malicious file name is rendered as text, not markup', async ({ electronApp, window }) => {
    await window.evaluate(() => { window.__tabXss = false; });

    const malicious = 'evil<img src=x onerror="window.__tabXss=true">.md';
    await loadMarkdown(electronApp, {
      html: '<h1 id="a">A</h1>', fileName: 'a.md', filePath: '/tmp/a.md', outline: []
    });
    await loadMarkdown(electronApp, {
      html: '<h1 id="b">B</h1>', fileName: malicious, filePath: '/tmp/b.md', outline: []
    });

    // No injected element, and the name shows verbatim as text.
    await expect(window.locator('#tabBarContent img')).toHaveCount(0);
    await expect(window.locator('#tabBarContent .tab-item-name').nth(1)).toHaveText(malicious);

    // Give any (stripped) onerror handler a chance to run, then confirm it did not.
    await window.waitForTimeout(50);
    expect(await window.evaluate(() => window.__tabXss)).toBe(false);
  });
});

test.describe('Keyboard shortcuts', () => {
  test('Cmd/Ctrl+W is handled without errors when no tabs are open', async ({ window }) => {
    await window.keyboard.press('ControlOrMeta+w');
    // App should still be functional.
    await expect(window.locator('#welcomeScreen')).toBeVisible();
  });
});
