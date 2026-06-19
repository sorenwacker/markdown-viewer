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
