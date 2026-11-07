const { test, expect } = require('./electron.fixture');

// A corrupt or legacy `recentDocuments` value must not break renderer startup:
// getRecentDocuments runs during init (via renderRecentDocuments) and used to
// throw on invalid JSON.
test.describe('Recent documents storage', () => {
  test('a corrupt recentDocuments value is tolerated and cleared on startup', async ({ window }) => {
    await window.evaluate(() => localStorage.setItem('recentDocuments', '{not valid json'));
    await window.reload();
    await window.waitForLoadState('domcontentloaded');

    // App still initializes: the welcome screen is shown and the file tree is
    // not stuck on an error.
    await expect(window.locator('#welcomeScreen')).toBeVisible();

    // The guard removed the unparseable value rather than leaving it to throw
    // again on the next read.
    const stored = await window.evaluate(() => localStorage.getItem('recentDocuments'));
    expect(stored).toBeNull();
  });
});

// Entries whose file was deleted or moved must not linger in the list.
test.describe('Recent documents pruning', () => {
  test('paths that no longer exist are dropped when the list is shown', async ({ window }) => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-recent-'));
    const kept = path.join(dir, 'kept.md');
    const gone = path.join(dir, 'gone.md');
    fs.writeFileSync(kept, '# kept\n');

    await window.evaluate(([k, g]) => localStorage.setItem('recentDocuments', JSON.stringify([
      { path: k, name: 'kept.md' },
      { path: g, name: 'gone.md' },
    ])), [kept, gone]);
    await window.reload();
    await window.waitForLoadState('domcontentloaded');
    await window.locator('#filesTab').click();

    await expect(window.locator(`.recent-doc-item[data-path="${kept}"]`)).toBeVisible();
    await expect(window.locator('.recent-doc-item')).toHaveCount(1);
    const stored = await window.evaluate(() => JSON.parse(localStorage.getItem('recentDocuments')));
    expect(stored.map(d => d.path)).toEqual([kept]);

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
